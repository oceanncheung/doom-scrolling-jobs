import 'server-only'

import type { ResumeExperienceRecord } from '@/lib/domain/types'
import type { RankedJobRecord } from '@/lib/jobs/contracts'

export type RelevanceHint = 'high' | 'medium' | 'low'

export interface RelevanceAnnotation {
  /** Stable id matching the experience catalog entry. */
  id: string
  /** "high" | "medium" | "low" bucket. */
  relevanceHint: RelevanceHint
  /** Count of JD skills keywords that appear in the entry's source text. */
  keywordMatches: number
  /** Total usable JD skills keywords considered. */
  keywordTotal: number
  /** Token-overlap ratio between source role title and JD title (0–1). */
  titleSimilarity: number
}

// Mirror of the small stopword set used elsewhere — kept local to avoid a shared-util sprawl
// before the shape is stable.
//
// Seniority markers (senior/junior/lead/staff/etc.) are deliberately included as stopwords
// because they create false title-similarity matches across unrelated domains — e.g.
// "Senior Executive Assistant" vs "Senior Graphic Designer" would otherwise share "Senior"
// and bucket as medium-similarity when they're actually unrelated. Domain tokens (designer,
// engineer, marketing) are the real signal; seniority is noise for cross-role matching.
const TITLE_STOPWORDS = new Set([
  'and',
  'or',
  'the',
  'of',
  'for',
  'to',
  'with',
  'in',
  'on',
  'at',
  'by',
  'a',
  'an',
  'i',
  'ii',
  'iii',
  'iv',
  // seniority and level markers — purely indicative of level, not domain
  'senior',
  'sr',
  'junior',
  'jr',
  'lead',
  'staff',
  'principal',
  'associate',
  'intern',
  'trainee',
  'entry',
])

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#/.\s-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token && !TITLE_STOPWORDS.has(token))
}

function buildEntryHaystack(entry: ResumeExperienceRecord) {
  return [entry.roleTitle, entry.summary, ...entry.highlights]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesWordInHaystack(word: string, haystack: string) {
  // Word-boundary match with a tolerant boundary char class (treats punctuation and spaces
  // as boundaries but preserves +, #, /, . as intra-word characters for tokens like "C++").
  // Also accepts a trailing "s" to catch simple plurals (system↔systems) without a full
  // stemmer — covers ~90% of the real cases cheaply.
  const escaped = escapeForRegex(word)
  const pattern = `(^|[^a-z0-9+#])${escaped}s?($|[^a-z0-9+#])`
  return new RegExp(pattern, 'i').test(haystack)
}

function keywordAppears(keyword: string, haystack: string) {
  const token = keyword.toLowerCase().trim()
  if (!token) return false
  // Multi-word keywords: require ALL words to appear somewhere in the haystack (not
  // necessarily adjacent). "design systems" matches when the bullet says "shipped design
  // system components" — we'd rather over-match than miss the real case.
  const words = token.split(/\s+/).filter(Boolean)
  if (words.length === 0) return false
  return words.every((word) => matchesWordInHaystack(word, haystack))
}

// Shared prefix length that counts as a stem match. Tuned to catch designer/design,
// engineer/engineering, marketer/marketing without over-matching (e.g. "design" and "designate"
// share 6 chars but "designate" is rare enough in role titles that we accept the risk).
const STEM_MATCH_PREFIX_LEN = 5

/**
 * Domain synonym groups — tokens within a group are treated as semantically equivalent for the
 * purpose of title-similarity matching. This exists because stem matching fails on cross-word
 * synonyms: "Creative Director" ≡ "Graphic Designer" in the design industry, but they share no
 * 5-char stem. Without this, a Creative Director role would score 0 similarity against a
 * Designer JD and get bucketed low even though it's obviously the same function.
 *
 * Keep this list conservative — each group should be tokens that a hiring manager would
 * unambiguously read as the same role family on a resume. If a word appears in multiple
 * industries (e.g. "manager"), leave it out rather than risk false-positive cross-domain
 * matches.
 */
const DOMAIN_SYNONYM_GROUPS: Record<string, ReadonlySet<string>> = {
  design: new Set([
    'design', 'designer', 'designing',
    'creative', 'creator', 'creatives',
    'director',
    'visual', 'visuals',
    'art', 'artist', 'artistic',
    'graphic', 'graphics',
    'brand', 'branding',
    'ux', 'ui',
    'typography', 'typographic',
    'layout',
    'illustrator', 'illustration',
  ]),
  engineering: new Set([
    'engineer', 'engineering', 'engineers',
    'developer', 'developers', 'dev',
    'software',
    'programmer', 'programming',
    'coder', 'coding',
    'architect', 'architecture',
  ]),
  marketing: new Set([
    'marketing', 'marketer', 'marketers',
    'growth',
    'content', 'copy', 'copywriter',
    'communications', 'comms',
    'seo', 'sem',
    'social',
  ]),
  product: new Set([
    'product',
    'pm',
    'owner',
  ]),
  data: new Set([
    'data',
    'analyst', 'analytics', 'analysis',
    'scientist', 'science',
    'statistician',
  ]),
}

function findSynonymGroup(token: string): string | null {
  for (const groupName in DOMAIN_SYNONYM_GROUPS) {
    if (DOMAIN_SYNONYM_GROUPS[groupName].has(token)) return groupName
  }
  return null
}

function titleSimilarityScore(sourceTitle: string, jdTitle: string) {
  const sourceTokens = tokenize(sourceTitle)
  const jdTokens = tokenize(jdTitle)
  if (jdTokens.length === 0) return 0

  // Pre-compute synonym-group membership on the source side so we can check once per JD token.
  const sourceGroups = new Set<string>()
  for (const token of sourceTokens) {
    const group = findSynonymGroup(token)
    if (group) sourceGroups.add(group)
  }

  let matches = 0
  for (const jdToken of jdTokens) {
    let matched = false

    // 1. Exact token match.
    for (const sourceToken of sourceTokens) {
      if (jdToken === sourceToken) {
        matched = true
        break
      }
      // 2. Stem match: shared 5-char prefix. Catches designer↔design, engineer↔engineering, etc.
      if (
        !matched &&
        jdToken.length >= STEM_MATCH_PREFIX_LEN &&
        sourceToken.length >= STEM_MATCH_PREFIX_LEN &&
        jdToken.slice(0, STEM_MATCH_PREFIX_LEN) === sourceToken.slice(0, STEM_MATCH_PREFIX_LEN)
      ) {
        matched = true
        break
      }
    }

    // 3. Synonym group match: the JD token and the source title share a domain family
    //    (e.g. JD says "Designer", candidate says "Creative Director" — both are `design`).
    if (!matched) {
      const jdGroup = findSynonymGroup(jdToken)
      if (jdGroup && sourceGroups.has(jdGroup)) {
        matched = true
      }
    }

    if (matched) matches += 1
  }
  return matches / jdTokens.length
}

function bucketRelevance(keywordRatio: number, titleSimilarity: number): RelevanceHint {
  if (keywordRatio >= 0.3 || titleSimilarity >= 0.5) return 'high'
  if (keywordRatio >= 0.1 || titleSimilarity >= 0.25) return 'medium'
  return 'low'
}

export function computeRelevanceHints(
  entries: Array<ResumeExperienceRecord & { id: string }>,
  job: Pick<RankedJobRecord, 'title' | 'skillsKeywords' | 'requirements' | 'preferredQualifications'>,
): RelevanceAnnotation[] {
  // Relevance is measured against the curated skillsKeywords list ONLY. Requirements and
  // preferredQualifications are full JD sentences — including them here creates noisy keywords
  // like "5+ years", "fluent in", "agency experience" that water down the ratio. skillsKeywords
  // has already been normalized at ingest time and represents the highest-signal terms.
  const keywordPool = Array.from(
    new Set(
      job.skillsKeywords
        .flatMap((line) =>
          line
            .toLowerCase()
            .split(/[,;|/]+/)
            .map((part) => part.trim()),
        )
        .filter((token) => token.length >= 3 && !TITLE_STOPWORDS.has(token))
        .filter((token) => token.length <= 40),
    ),
  )

  return entries.map((entry) => {
    const haystack = buildEntryHaystack(entry)
    let matches = 0
    for (const keyword of keywordPool) {
      if (keywordAppears(keyword, haystack)) matches += 1
    }
    const keywordRatio = keywordPool.length > 0 ? matches / keywordPool.length : 0
    const titleSimilarity = titleSimilarityScore(entry.roleTitle, job.title)
    return {
      id: entry.id,
      relevanceHint: bucketRelevance(keywordRatio, titleSimilarity),
      keywordMatches: matches,
      keywordTotal: keywordPool.length,
      titleSimilarity: Number(titleSimilarity.toFixed(2)),
    }
  })
}
