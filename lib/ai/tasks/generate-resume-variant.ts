import 'server-only'

import { generateOpenAIJson, canGenerateWithOpenAI } from '@/lib/ai/client'
import type { ResumeVariantInput, ResumeVariantOutput } from '@/lib/ai/contracts'
import { generateResumeVariantPrompt } from '@/lib/ai/prompts/generate-resume-variant'
import { computeRelevanceHints, type RelevanceAnnotation, type RelevanceHint } from '@/lib/ai/tasks/compute-relevance-hints'
import { verifyResumeVariant } from '@/lib/ai/tasks/verify-resume-variant'
import type { ResumeExperienceRecord } from '@/lib/domain/types'
import { getOpenAIEnv } from '@/lib/env'

function cleanLine(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

// Caps here are deliberately generous — the rendered DOCX is the authoritative size budget
// (see RESUME_BUDGET in lib/jobs/document-system.ts). We let the LLM produce up to 5 bullets
// per role so the renderer's two-page fitter has real material to work with; under-producing
// here used to force shallow one-bullet roles even when the source had more to say.
const MAX_HIGHLIGHTS_PER_ENTRY = 5
const MAX_EXPERIENCE_ENTRIES = 6
// Floor enforced AFTER the LLM call. If the model returns fewer bullets for a role than this,
// we top it up using the candidate's own master-source bullets verbatim. This is truthful — we
// never invent text — but it stops "1 bullet for a real role" from ever shipping. The user
// explicitly said: "having one bullet is insanely weird." We match the renderer's
// SUBSTANTIVE_ROLE_MIN_HIGHLIGHTS so the schema and renderer agree on the floor.
const MIN_HIGHLIGHTS_PER_ENTRY = 3

// Tenure-aware bullet targets. The longest-held role is the anchor of a candidate's narrative
// — it should read as densest, not sparsest. These targets are the FLOOR for a role given its
// tenure; if the LLM returns more, we keep what it returned (capped at MAX). If fewer, we pad
// from the source up to the target.
const MONTHS_FOR_MAX_BULLETS = 24 // >= 2 years of tenure → aim for the full 5 bullets
const MONTHS_FOR_FOUR_BULLETS = 12 // 1–2 years → aim for 4 bullets
// Shorter tenures fall through to MIN_HIGHLIGHTS_PER_ENTRY (3).

const MONTH_NAME_TO_INDEX = new Map<string, number>([
  ['jan', 0], ['january', 0],
  ['feb', 1], ['february', 1],
  ['mar', 2], ['march', 2],
  ['apr', 3], ['april', 3],
  ['may', 4],
  ['jun', 5], ['june', 5],
  ['jul', 6], ['july', 6],
  ['aug', 7], ['august', 7],
  ['sep', 8], ['sept', 8], ['september', 8],
  ['oct', 9], ['october', 9],
  ['nov', 10], ['november', 10],
  ['dec', 11], ['december', 11],
])

/**
 * Parse a resume date string into a sortable "months since year 0" integer. Handles:
 *   "Jan 2020" / "January 2020"    → (2020 * 12) + 0
 *   "2020"                         → (2020 * 12)
 *   "01/2020" / "2020-01"          → (2020 * 12) + 0
 *   "Present" / "Current" / ""     → returns null (caller decides how to sort current roles)
 * Unparseable input returns null.
 */
export function parseResumeDateToMonths(value: string | null | undefined): number | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (/^(present|current|now|ongoing|today)$/.test(normalized)) return null

  // ISO-ish: 2020-01, 2020/01
  const isoMatch = normalized.match(/^(\d{4})[-/](\d{1,2})\b/)
  if (isoMatch) {
    const year = Number(isoMatch[1])
    const month = Math.max(0, Math.min(11, Number(isoMatch[2]) - 1))
    return year * 12 + month
  }

  // US-ish: 01/2020, 1-2020
  const usMatch = normalized.match(/^(\d{1,2})[-/](\d{4})\b/)
  if (usMatch) {
    const month = Math.max(0, Math.min(11, Number(usMatch[1]) - 1))
    const year = Number(usMatch[2])
    return year * 12 + month
  }

  // "Jan 2020" / "January 2020"
  const monthYearMatch = normalized.match(/^([a-z]+)\.?\s+(\d{4})\b/)
  if (monthYearMatch) {
    const month = MONTH_NAME_TO_INDEX.get(monthYearMatch[1])
    const year = Number(monthYearMatch[2])
    if (month !== undefined) return year * 12 + month
  }

  // Bare year: "2020"
  const yearOnlyMatch = normalized.match(/^(\d{4})\b/)
  if (yearOnlyMatch) {
    return Number(yearOnlyMatch[1]) * 12
  }

  return null
}

// Current-date sort key for roles with endDate === "Present". We use a plain Date.now-derived
// month index so "Present" sorts ahead of any past date but ties break naturally on startDate.
function currentMonthsKey() {
  const now = new Date()
  return now.getFullYear() * 12 + now.getMonth()
}

function endDateSortKey(endDate: string | null | undefined): number {
  const parsed = parseResumeDateToMonths(endDate)
  if (parsed !== null) return parsed
  // Empty / "Present" / unparseable → treat as "current" (most recent).
  return currentMonthsKey()
}

function startDateSortKey(startDate: string | null | undefined): number {
  const parsed = parseResumeDateToMonths(startDate)
  // Unparseable start defaults to very old so parseable starts win tiebreaks.
  return parsed ?? -Infinity
}

/**
 * Compare two entries for reverse-chronological ordering. endDate descending is the primary key;
 * startDate descending breaks ties (two "Present" roles → the more-recently-started is first).
 */
export function compareEntriesByRecency(
  a: Pick<ResumeExperienceRecord, 'endDate' | 'startDate'>,
  b: Pick<ResumeExperienceRecord, 'endDate' | 'startDate'>,
): number {
  const endDiff = endDateSortKey(b.endDate) - endDateSortKey(a.endDate)
  if (endDiff !== 0) return endDiff
  return startDateSortKey(b.startDate) - startDateSortKey(a.startDate)
}

/**
 * Tenure in months between start and end. "Present" end → now. Unparseable start → 0. Floor at 0.
 */
export function computeTenureMonths(
  entry: Pick<ResumeExperienceRecord, 'startDate' | 'endDate'>,
): number {
  const start = parseResumeDateToMonths(entry.startDate)
  if (start === null) return 0
  const end = parseResumeDateToMonths(entry.endDate) ?? currentMonthsKey()
  return Math.max(0, end - start)
}

/**
 * Floor bullet count for a role. Relevance is the dominant signal — a high-relevance role is
 * the candidate's anchor and should carry the full 5 bullets when source supports. Tenure is a
 * secondary modifier for medium-relevance roles so very new side-gigs don't crowd out the
 * main narrative. Low-relevance roles, if kept at all (see filterIrrelevantEntries), get the
 * smallest allowable presence.
 *
 * This replaces the v4.1 pure-tenure target. Rationale: the user's anchor is often their most
 * relevant role, not necessarily their longest — e.g., a candidate with 7 years at a
 * consultancy and 2 years at a perfectly JD-matched current gig wants the JD-matched role
 * densely described.
 */
function targetBulletsForEntry(relevanceHint: RelevanceHint, tenureMonths: number): number {
  if (relevanceHint === 'high') return MAX_HIGHLIGHTS_PER_ENTRY
  if (relevanceHint === 'medium') {
    if (tenureMonths >= MONTHS_FOR_MAX_BULLETS) return MAX_HIGHLIGHTS_PER_ENTRY
    if (tenureMonths >= MONTHS_FOR_FOUR_BULLETS) return 4
    return MIN_HIGHLIGHTS_PER_ENTRY
  }
  // 'low' — only reachable when the relevance filter kept the entry because dropping would
  // violate MIN_EXPERIENCE_ENTRIES. Keep it compact.
  return 2
}

// Minimum roles to always keep on a resume — the code-level relevance filter will never strip
// below this count, even if every remaining role is 'low' relevance. A thin resume beats an
// empty one.
const MIN_EXPERIENCE_ENTRIES = 2

// Soft-skill phrases banned from skillsSection. The prompt already instructs the model not to
// emit these, but we strip them in code too so a single prompt regression can't leak them in.
// Matched case-insensitively against the full normalized skill string.
const SOFT_SKILL_PATTERNS: RegExp[] = [
  /^communication(?:\s+skills)?$/i,
  /^(?:strong\s+)?communicator$/i,
  /^leadership(?:\s+skills)?$/i,
  /^teamwork$/i,
  /^team\s+player$/i,
  /^collaboration$/i,
  /^problem[-\s]?solving$/i,
  /^critical\s+thinking$/i,
  /^time\s+management$/i,
  /^organization(?:al\s+skills)?$/i,
  /^adaptability$/i,
  /^adaptable$/i,
  /^creativity$/i,
  /^creative\s+thinking$/i,
  /^work\s+ethic$/i,
  /^attention\s+to\s+detail$/i,
  /^detail[-\s]?oriented$/i,
  /^self[-\s]?motivated$/i,
  /^self[-\s]?starter$/i,
  /^fast\s+learner$/i,
  /^quick\s+learner$/i,
  /^multitasking$/i,
  /^interpersonal\s+skills$/i,
  /^(?:strong\s+)?work[-\s]ethic$/i,
]

// A soft-skill phrase inside a bullet is fine (demonstrated through work); a bullet that is
// ENTIRELY a soft-skill claim is not. These match a whole-bullet soft-skill assertion.
const WEAK_BULLET_BODY_PATTERNS: RegExp[] = [
  /^strong\s+(?:communication|communicator|leadership|teamwork)\b/i,
  /^excellent\s+(?:communication|communicator|teamwork|interpersonal)\b/i,
  /^team\s+player\b/i,
  /^detail[-\s]?oriented\b/i,
]

// Minimum length for a source bullet to be usable as padding. Lowered from 40 to 20 chars —
// the previous threshold was stripping legitimate short-but-real bullets like "Led rebrand of
// Acme's B2C suite", starving roles of padding material. Genuinely fragmentary content (under
// ~20 chars) still gets filtered.
const MIN_BULLET_LENGTH = 20

// v4.2 note: we no longer filter source bullets by weak-prefix patterns ("Responsible for",
// "Worked on", "Helped"). The renderer already rewrites those to stronger verbs
// (see WEAK_BULLET_PREFIXES in lib/jobs/document-system.ts), so filtering them here starves
// the padding step without improving the final output. The only content we refuse to surface
// is whole-bullet soft-skill assertions (below) and tiny fragments.
function isUnusableSourceBullet(value: string) {
  const normalized = cleanLine(value)
  if (!normalized) return true
  if (normalized.length < MIN_BULLET_LENGTH) return true
  if (WEAK_BULLET_BODY_PATTERNS.some((pattern) => pattern.test(normalized))) return true
  return false
}

function isSoftSkill(value: string) {
  const normalized = cleanLine(value).replace(/[()]/g, '').trim()
  return SOFT_SKILL_PATTERNS.some((pattern) => pattern.test(normalized))
}

// Canonical key for skill comparison. Lowercases, strips punctuation/suffixes, collapses
// whitespace. "Adobe Illustrator" and "adobe-illustrator" and "Illustrator (Adobe)" should
// all normalize to roughly the same comparable token.
function canonicalizeSkillKey(value: string) {
  return cleanLine(value)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9+#./]+/g, ' ')
    .replace(/\b(?:software|tool|tools|platform|platforms|suite|experience|proficiency|proficient|skilled)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Alias map for tools that appear under multiple canonical names. Keys are canonical; values
// are any strings that should match as aliases. Deliberately small — expand only with real
// false-positive cases we see in generation logs.
const SKILL_ALIASES: Array<[string, string[]]> = [
  ['adobe creative suite', ['adobe cc', 'adobe creative cloud', 'creative cloud', 'adobe suite']],
  ['adobe illustrator', ['illustrator']],
  ['adobe photoshop', ['photoshop']],
  ['adobe indesign', ['indesign']],
  ['adobe after effects', ['after effects', 'ae']],
  ['adobe premiere', ['premiere pro', 'premiere']],
  ['figma', ['figjam']],
  ['google analytics', ['ga4', 'ga 4', 'google analytics 4']],
  ['search engine optimization', ['seo']],
  ['search engine marketing', ['sem']],
  ['user experience', ['ux']],
  ['user interface', ['ui']],
  ['user experience design', ['ux design', 'ux/ui design', 'ux ui']],
  ['customer relationship management', ['crm']],
  ['content management system', ['cms']],
  ['html/css', ['html', 'css', 'html and css', 'html + css']],
]

function buildSourceSkillLookup(sources: string[]) {
  const lookup = new Set<string>()
  for (const source of sources) {
    const key = canonicalizeSkillKey(source)
    if (!key) continue
    lookup.add(key)
    // Also add each aliased canonical key so "Illustrator" in source matches "Adobe Illustrator"
    // being shipped.
    for (const [canonical, aliases] of SKILL_ALIASES) {
      const canonicalKey = canonicalizeSkillKey(canonical)
      const aliasKeys = aliases.map((alias) => canonicalizeSkillKey(alias))
      if (key === canonicalKey || aliasKeys.includes(key)) {
        lookup.add(canonicalKey)
        aliasKeys.forEach((aliasKey) => lookup.add(aliasKey))
      }
    }
  }
  return lookup
}

function matchesSourceSkill(value: string, sourceLookup: Set<string>) {
  const key = canonicalizeSkillKey(value)
  if (!key) return false
  if (sourceLookup.has(key)) return true
  // Substring match catches "Figma (Advanced)" vs source "Figma", and multi-word
  // partial overlaps.
  for (const sourceKey of sourceLookup) {
    if (!sourceKey) continue
    if (key === sourceKey) return true
    if (sourceKey.length >= 4 && key.includes(sourceKey)) return true
    if (key.length >= 4 && sourceKey.includes(key)) return true
  }
  return false
}

interface FilterSkillsResult {
  kept: string[]
  stripped: string[]
}

// Filter skillsSection entries down to those that (a) are not soft skills, and (b) trace back
// to a source skill/tool/expertise token the candidate actually has. Prevents the LLM from
// padding the skills list with JD-named tools the candidate's source doesn't support.
export function filterSkillsToSource(
  skills: string[],
  sources: {
    toolsPlatforms: string[]
    resumeSkills: string[]
    coreExpertise: string[]
    profileSkills: string[]
  },
): FilterSkillsResult {
  const sourceLookup = buildSourceSkillLookup([
    ...sources.toolsPlatforms,
    ...sources.resumeSkills,
    ...sources.coreExpertise,
    ...sources.profileSkills,
  ])

  const kept: string[] = []
  const stripped: string[] = []
  const seenKeys = new Set<string>()

  for (const raw of skills) {
    const normalized = cleanLine(raw)
    if (!normalized) continue
    const key = canonicalizeSkillKey(normalized)
    if (!key || seenKeys.has(key)) continue
    seenKeys.add(key)

    if (isSoftSkill(normalized)) {
      stripped.push(normalized)
      continue
    }
    if (!matchesSourceSkill(normalized, sourceLookup)) {
      stripped.push(normalized)
      continue
    }
    kept.push(normalized)
  }

  return { kept, stripped }
}

function dedupeHighlights(values: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const key = value.toLowerCase().replace(/\s+/g, ' ').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

function normalizeExperienceEntry(
  source: ResumeExperienceRecord,
  draft: Partial<ResumeExperienceRecord> | undefined,
  relevanceHint: RelevanceHint,
): ResumeExperienceRecord {
  const summary = cleanLine(draft?.summary ?? source.summary)
  const draftHighlights = Array.isArray(draft?.highlights)
    ? draft.highlights
        .filter((item): item is string => typeof item === 'string')
        .map((item) => cleanLine(item))
        .filter(Boolean)
    : source.highlights
  // Pad up to a relevance-aware target with master-source bullets the LLM didn't already cover.
  // Relevance is the primary signal (high → 5, medium → 3–4, low → 2) with tenure as a
  // secondary modifier for medium-relevance. We never fabricate — if the master itself has
  // fewer bullets than the target, the role gets what the master has.
  //
  // v4.2: relevance-aware target + looser source-bullet filter. The weak-prefix filter from
  // v4 was stripping real source material the renderer would have rewritten to strong verbs,
  // leaving the user's most important role sparsely described. Now padding uses all source
  // bullets that aren't genuinely unusable (too short or whole-bullet soft-skill).
  const tenureMonths = computeTenureMonths(source)
  const target = targetBulletsForEntry(relevanceHint, tenureMonths)
  const sourceFallback = source.highlights
    .map((item) => cleanLine(item))
    .filter((item) => Boolean(item) && !isUnusableSourceBullet(item))
  const padded = dedupeHighlights([...draftHighlights, ...sourceFallback])
  const targetCount = Math.min(
    MAX_HIGHLIGHTS_PER_ENTRY,
    Math.max(draftHighlights.length, Math.min(target, padded.length)),
  )
  const highlights = padded.slice(0, targetCount)

  return {
    companyName: source.companyName,
    endDate: source.endDate,
    highlights,
    locationLabel: source.locationLabel,
    roleTitle: source.roleTitle,
    startDate: source.startDate,
    summary,
  }
}

function toSourceKey(entry: Pick<ResumeExperienceRecord, 'companyName' | 'roleTitle'>) {
  return `${entry.companyName}::${entry.roleTitle}`.toLowerCase()
}

// Rescue thresholds: a role with this much tenure AND this many source bullets is a clear
// career-anchor block. The filter must not drop it even if keyword/title heuristics miss,
// because those heuristics fail on (a) poorly-structured JDs with tiny keyword pools and
// (b) cross-word role synonyms the stem/synonym check misses.
//
// Real-world trigger for these constants: Ocean's "Founder / Fractional Creative Director"
// at MM.S (7 years tenure, 8 source bullets) was dropped on the Grüns "Senior Graphic
// Designer" JD because the JD only had 2 skill keywords and neither appeared literally in
// MM.S's bullets. A 7-year design-leadership role must NEVER be filtered out regardless of
// what the keyword heuristic scores. Synonym groups now rescue most of these via title
// similarity; this is belt-and-suspenders.
const SUBSTANTIVE_ROLE_MIN_TENURE_MONTHS = 24
const SUBSTANTIVE_ROLE_MIN_SOURCE_BULLETS = 3

/**
 * Code-level Tier-D filter. The prompt asks the LLM to omit irrelevant roles, but the LLM
 * sometimes keeps them as "credibility anchors" when they aren't credibility anchors — e.g.
 * an executive-assistant role at a government agency on a senior graphic designer resume.
 * This is the defense-in-depth layer: drop entries where every signal agrees the role is
 * unrelated.
 *
 * Drop rule (must satisfy ALL):
 *   - relevanceHint === 'low'
 *   - titleSimilarity < 0.2 (title tokens share virtually nothing with the JD title after
 *     stopwords, including seniority markers; synonym groups can rescue this — see
 *     DOMAIN_SYNONYM_GROUPS in compute-relevance-hints.ts)
 *   - keywordMatches === 0 (no JD skill keyword found in the role's source text)
 *   - NOT a substantive role (tenure < 24 months OR source bullets < 3)
 *
 * Safety net: never strip below MIN_EXPERIENCE_ENTRIES. A thin resume beats an empty one,
 * and an early-career candidate with no JD-matched history would otherwise have nothing.
 */
export function filterIrrelevantEntries(
  entries: ResumeExperienceRecord[],
  relevanceByKey: Map<string, RelevanceAnnotation>,
): { kept: ResumeExperienceRecord[]; dropped: Array<{ entry: ResumeExperienceRecord; reason: string }> } {
  const keepers: ResumeExperienceRecord[] = []
  const drops: Array<{ entry: ResumeExperienceRecord; reason: string }> = []

  for (const entry of entries) {
    const annotation = relevanceByKey.get(toSourceKey(entry))
    const hint = annotation?.relevanceHint ?? 'low'
    const titleSim = annotation?.titleSimilarity ?? 0
    const keywords = annotation?.keywordMatches ?? 0

    const tenureMonths = computeTenureMonths(entry)
    const isSubstantiveRole =
      tenureMonths >= SUBSTANTIVE_ROLE_MIN_TENURE_MONTHS &&
      entry.highlights.length >= SUBSTANTIVE_ROLE_MIN_SOURCE_BULLETS

    if (hint === 'low' && titleSim < 0.2 && keywords === 0 && !isSubstantiveRole) {
      drops.push({
        entry,
        reason: `relevanceHint=low titleSim=${titleSim.toFixed(2)} keywordMatches=0 tenure=${tenureMonths}mo bullets=${entry.highlights.length}`,
      })
      continue
    }
    keepers.push(entry)
  }

  // Safety net: if the filter took us below the floor, reinstate the strongest-looking drops
  // (highest titleSimilarity, then highest keywordMatches) until we hit the floor.
  if (keepers.length < MIN_EXPERIENCE_ENTRIES && drops.length > 0) {
    const needed = MIN_EXPERIENCE_ENTRIES - keepers.length
    const rescueOrder = [...drops].sort((a, b) => {
      const aAnn = relevanceByKey.get(toSourceKey(a.entry))
      const bAnn = relevanceByKey.get(toSourceKey(b.entry))
      const aScore = (aAnn?.titleSimilarity ?? 0) * 10 + (aAnn?.keywordMatches ?? 0)
      const bScore = (bAnn?.titleSimilarity ?? 0) * 10 + (bAnn?.keywordMatches ?? 0)
      return bScore - aScore
    })
    const rescued = rescueOrder.slice(0, needed).map((item) => item.entry)
    keepers.push(...rescued)
    const rescuedKeys = new Set(rescued.map(toSourceKey))
    return {
      kept: keepers,
      dropped: drops.filter((item) => !rescuedKeys.has(toSourceKey(item.entry))),
    }
  }

  return { kept: keepers, dropped: drops }
}

function asStringArray(value: unknown, max = 8) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => cleanLine(item))
        .filter(Boolean)
        .slice(0, max)
    : []
}

export async function generateResumeVariant(input: ResumeVariantInput): Promise<ResumeVariantOutput> {
  if (!canGenerateWithOpenAI()) {
    throw new Error('OpenAI environment variables are missing.')
  }

  const { packetModel } = getOpenAIEnv()
  const sourceExperience = [
    ...input.workspace.resumeMaster.experienceEntries,
    ...input.workspace.resumeMaster.archivedExperienceEntries,
  ]
  const baseCatalog = sourceExperience.map((entry, index) => ({
    id: `experience_${index + 1}`,
    ...entry,
  }))
  // v4: compute a cheap relevance hint per entry (keyword overlap + title similarity). Fed
  // to the LLM as a tiebreaker AND used by the task-layer filter to drop Tier-D roles the
  // LLM failed to omit. Two independent signals — the prompt reads it as advisory, the code
  // uses it as a deterministic filter.
  const relevanceAnnotations = computeRelevanceHints(baseCatalog, input.job)
  const annotationByCatalogId = new Map(relevanceAnnotations.map((item) => [item.id, item] as const))
  // Key relevance by source-identity (company::role) too, so we can look it up from any
  // ResumeExperienceRecord without needing the catalog id.
  const relevanceBySourceKey = new Map<string, RelevanceAnnotation>()
  for (const entry of baseCatalog) {
    const annotation = annotationByCatalogId.get(entry.id)
    if (annotation) relevanceBySourceKey.set(toSourceKey(entry), annotation)
  }
  const experienceCatalog = baseCatalog.map((entry) => {
    const annotation = annotationByCatalogId.get(entry.id)
    return {
      ...entry,
      relevanceHint: annotation?.relevanceHint ?? 'low',
      keywordMatches: annotation?.keywordMatches ?? 0,
      titleSimilarity: annotation?.titleSimilarity ?? 0,
    }
  })

  const relevanceHintFor = (entry: Pick<ResumeExperienceRecord, 'companyName' | 'roleTitle'>): RelevanceHint => {
    return relevanceBySourceKey.get(toSourceKey(entry))?.relevanceHint ?? 'low'
  }
  // Prefer the full fetched description when it exists and is substantially richer than
  // the feed stub. Many job feeds return a one-sentence summary (Grüns shipped as just
  // "Senior Graphic Designer. Creates natural performance supplements. Design & UX.
  // Senior. Remote"); the actual posting page has paragraphs of requirements, culture
  // notes, and tool lists that materially change which of the candidate's experiences
  // read as relevant. See lib/jobs/description-enrichment.ts for the fetch path.
  const feedDescription = input.job.descriptionText ?? ''
  const fetchedDescription = input.job.descriptionTextFetched ?? ''
  const descriptionForPrompt =
    fetchedDescription.length > feedDescription.length * 1.5 && fetchedDescription.length >= 400
      ? fetchedDescription
      : feedDescription
  const user = [
    `Target role: ${input.job.title} at ${input.job.companyName}`,
    `Target job description: ${descriptionForPrompt}`,
    `Requirements: ${input.job.requirements.join(' | ')}`,
    `Preferred qualifications: ${input.job.preferredQualifications.join(' | ')}`,
    `Skills keywords: ${input.job.skillsKeywords.join(' | ')}`,
    `Profile headline: ${input.workspace.profile.headline}`,
    `Base resume title: ${input.workspace.resumeMaster.baseTitle}`,
    `Base resume summary: ${input.workspace.resumeMaster.summaryText}`,
    `Impact highlights: ${input.workspace.resumeMaster.selectedImpactHighlights.join(' | ')}`,
    `Core expertise: ${input.workspace.resumeMaster.coreExpertise.join(' | ')}`,
    `Profile summary: ${input.workspace.profile.bioSummary}`,
    `Profile skills: ${input.workspace.profile.skills.join(' | ')}`,
    `Resume skills: ${input.workspace.resumeMaster.skillsSection.join(' | ')}`,
    `Resume tools and platforms: ${input.workspace.resumeMaster.toolsPlatforms.join(' | ')}`,
    `Allowed source experience entries (reuse facts only): ${JSON.stringify(experienceCatalog)}`,
  ].join('\n')

  const response = await generateOpenAIJson<ResumeVariantOutput>({
    model: packetModel,
    promptVersion: generateResumeVariantPrompt.version,
    schemaHint: generateResumeVariantPrompt.schemaHint,
    system: generateResumeVariantPrompt.system,
    user,
  })

  const sourceByKey = new Map(sourceExperience.map((entry) => [toSourceKey(entry), entry] as const))
  const rawEntries = Array.isArray(response.experienceEntries) ? response.experienceEntries : []
  const normalizedEntries = rawEntries
    .map((entry) => {
      const key = toSourceKey({
        companyName: cleanLine(entry?.companyName ?? ''),
        roleTitle: cleanLine(entry?.roleTitle ?? ''),
      })
      const source = sourceByKey.get(key)

      if (!source) {
        return null
      }

      return normalizeExperienceEntry(source, entry, relevanceHintFor(source))
    })
    .filter((entry): entry is ResumeExperienceRecord => entry !== null)

  // Fallback when the LLM returned no usable entries: surface the candidate's most recent roles
  // verbatim so the rendered resume still reflects real source material. The renderer's page
  // fitter then trims as needed.
  const preFilter =
    normalizedEntries.length > 0
      ? normalizedEntries
      : sourceExperience.length > 0
        ? sourceExperience
            .slice(0, MAX_EXPERIENCE_ENTRIES)
            .map((entry) => normalizeExperienceEntry(entry, entry, relevanceHintFor(entry)))
        : []

  // v4.2: code-level Tier-D filter. Drop entries the LLM left in despite having zero
  // overlap with the JD. See filterIrrelevantEntries for the drop rule and safety net.
  const { kept: relevantEntries, dropped: irrelevantDrops } = filterIrrelevantEntries(
    preFilter,
    relevanceBySourceKey,
  )

  // v4.1: enforce reverse-chronological order in code. The prompt tells the LLM to return
  // entries in reverse-chron, but the LLM sometimes ignores that or sorts by "relevance" it
  // invented. Resume order is ALWAYS reverse-chronological by endDate (Present first) with
  // startDate as tiebreaker — it's not a judgment call.
  const fallbackEntries = [...relevantEntries].sort(compareEntriesByRecency)

  // v4: filter skills against candidate's actual source before shipping. Soft skills (banned
  // by the prompt) and out-of-source tools get stripped. The prompt tells the model not to do
  // this; the code enforces it.
  const rawSkills = asStringArray(response.skillsSection, 24)
  const { kept: filteredSkills } = filterSkillsToSource(rawSkills, {
    toolsPlatforms: input.workspace.resumeMaster.toolsPlatforms,
    resumeSkills: input.workspace.resumeMaster.skillsSection,
    coreExpertise: input.workspace.resumeMaster.coreExpertise,
    profileSkills: input.workspace.profile.skills,
  })

  const normalized: ResumeVariantOutput = {
    changeSummaryForUser: cleanLine(response.changeSummaryForUser ?? ''),
    experienceEntries: fallbackEntries.slice(0, MAX_EXPERIENCE_ENTRIES),
    headline:
      cleanLine(response.headline ?? '') ||
      cleanLine(input.workspace.resumeMaster.baseTitle) ||
      cleanLine(input.workspace.profile.headline),
    highlightedRequirements: asStringArray(response.highlightedRequirements, 5),
    skillsSection: filteredSkills.slice(0, 12),
    summary:
      cleanLine(response.summary ?? '') ||
      cleanLine(input.workspace.resumeMaster.summaryText) ||
      cleanLine(input.workspace.profile.bioSummary),
    tailoringRationale: cleanLine(response.tailoringRationale ?? ''),
  }

  if (!normalized.summary || (sourceExperience.length > 0 && normalized.experienceEntries.length === 0)) {
    throw new Error('Resume generation returned incomplete ATS content.')
  }

  // v4: verify coverage + unverified claims. Logging mode — we surface a terse note to the user
  // via changeSummaryForUser and emit the structured payload to server logs for review. No
  // content is stripped yet; once we've watched false-positive rate for a week, we can flip
  // numeric-claim stripping to strict mode.
  const verification = verifyResumeVariant(normalized, input.job, input.workspace)
  const noteParts = [normalized.changeSummaryForUser, verification.userFacingNote]
  if (irrelevantDrops.length > 0) {
    const names = irrelevantDrops
      .map(({ entry }) => `${entry.companyName} (${entry.roleTitle})`)
      .join(', ')
    noteParts.push(`Filtered ${irrelevantDrops.length} irrelevant role${irrelevantDrops.length === 1 ? '' : 's'}: ${names}`)
  }
  normalized.changeSummaryForUser = noteParts.filter(Boolean).join(' · ')
  console.info('[resume-variant][verify]', {
    jobId: input.job.id,
    jobTitle: input.job.title,
    coverage: verification.coverage,
    unverifiedClaims: verification.unverifiedClaims,
    irrelevantDrops: irrelevantDrops.map(({ entry, reason }) => ({
      company: entry.companyName,
      role: entry.roleTitle,
      reason,
    })),
  })

  return normalized
}
