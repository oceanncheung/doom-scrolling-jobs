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

function keywordAppears(keyword: string, haystack: string) {
  const token = keyword.toLowerCase().trim()
  if (!token) return false
  const boundary = `(^|[^a-z0-9+#])${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9+#])`
  return new RegExp(boundary, 'i').test(haystack)
}

function titleSimilarityScore(sourceTitle: string, jdTitle: string) {
  const sourceTokens = new Set(tokenize(sourceTitle))
  const jdTokens = tokenize(jdTitle)
  if (jdTokens.length === 0) return 0
  let matches = 0
  for (const token of jdTokens) {
    if (sourceTokens.has(token)) matches += 1
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
  const keywordPool = Array.from(
    new Set(
      [...job.skillsKeywords, ...job.requirements, ...job.preferredQualifications]
        .flatMap((line) =>
          line
            .toLowerCase()
            .split(/[,;|/]+/)
            .map((part) => part.trim()),
        )
        .filter((token) => token.length >= 3 && !TITLE_STOPWORDS.has(token))
        // The broader requirements text is noisy; prefer canonical skillsKeywords first by
        // keeping only short, skill-like phrases. Phrases over ~40 chars are full sentences.
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
