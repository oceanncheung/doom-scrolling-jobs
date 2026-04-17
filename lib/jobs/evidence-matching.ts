import type { EvidenceBankEntryRecord } from '@/lib/domain/evidence'
import type { NormalizedJobRecord } from '@/lib/jobs/contracts'

/**
 * Phase D matching — picks the confirmed evidence entries that are relevant to a specific
 * JD. Run at generation time (resume + cover letter). Returns an ordered list, most-relevant
 * first, ready to feed into the LLM prompt as a "Confirmed industry work" section.
 *
 * Matching rules (simple on purpose — the LLM does the final synthesis):
 *   1. Direct-industry match: any of the entry's industryTags overlaps the JD's
 *      `primaryIndustry` or `adjacentIndustries`.
 *   2. Scope overlap fallback: when industries don't overlap, an entry whose scope words
 *      literally appear in the JD's title or description still qualifies (e.g. "packaging
 *      design" on a designer's evidence entry would hit a JD mentioning "packaging").
 *   3. High-confidence rescue: evidence entries confirmed with confidence="high" and
 *      marked as linked to a role that IS on the candidate's active resume surface
 *      regardless of JD industry, because high-confidence confirmed work is a known-good
 *      proof point worth surfacing.
 *
 * Cap on output size — we don't want to blow the LLM prompt.
 */

const MAX_EVIDENCE_PER_GENERATION = 6

function normalizeTag(value: string): string {
  return value.toLowerCase().trim()
}

function hasIndustryOverlap(entry: EvidenceBankEntryRecord, jobTags: ReadonlySet<string>): boolean {
  if (jobTags.size === 0) return false
  for (const tag of entry.industryTags) {
    if (jobTags.has(normalizeTag(tag))) return true
  }
  return false
}

function hasScopeOverlap(entry: EvidenceBankEntryRecord, jobHaystack: string): boolean {
  if (!jobHaystack) return false
  for (const scopeTerm of entry.scope) {
    const normalized = normalizeTag(scopeTerm)
    if (normalized.length < 4) continue
    if (jobHaystack.includes(normalized)) return true
  }
  return false
}

function entryScore(
  entry: EvidenceBankEntryRecord,
  jobTags: ReadonlySet<string>,
  jobHaystack: string,
): number {
  let score = 0
  if (hasIndustryOverlap(entry, jobTags)) score += 10
  if (hasScopeOverlap(entry, jobHaystack)) score += 4
  if (entry.confidence === 'high') score += 2
  if (entry.confidence === 'medium') score += 1
  // Penalize low-confidence entries so high-confidence wins ties.
  if (entry.confidence === 'low') score -= 1
  // Bonus for entries linked to a role the candidate already has on their resume —
  // those are extensions of a known work block, not floating claims.
  if (entry.linkedExperienceSourceKey) score += 1
  return score
}

export interface RelevantEvidenceResult {
  entries: EvidenceBankEntryRecord[]
  hadDirectIndustryMatch: boolean
}

export function selectRelevantEvidenceForJob(
  confirmedEvidence: EvidenceBankEntryRecord[],
  job: Pick<
    NormalizedJobRecord,
    'primaryIndustry' | 'adjacentIndustries' | 'title' | 'descriptionText' | 'descriptionTextFetched'
  >,
): RelevantEvidenceResult {
  if (confirmedEvidence.length === 0) {
    return { entries: [], hadDirectIndustryMatch: false }
  }

  const jobTags = new Set<string>()
  if (job.primaryIndustry) jobTags.add(normalizeTag(job.primaryIndustry))
  for (const tag of job.adjacentIndustries ?? []) {
    jobTags.add(normalizeTag(tag))
  }

  const jobHaystack = [
    job.title ?? '',
    job.descriptionText ?? '',
    job.descriptionTextFetched ?? '',
  ]
    .join(' ')
    .toLowerCase()

  const scored = confirmedEvidence
    .map((entry) => ({ entry, score: entryScore(entry, jobTags, jobHaystack) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_EVIDENCE_PER_GENERATION)
    .map((item) => item.entry)

  const hadDirectIndustryMatch = scored.some((entry) => hasIndustryOverlap(entry, jobTags))

  return {
    entries: scored,
    hadDirectIndustryMatch,
  }
}

/**
 * Format an evidence entry as a line the LLM prompt can include verbatim. The generator
 * prompts consume this via a simple "Confirmed industry work:" block. Phrasing is
 * deliberately factual — clientName, scope, industry — so the LLM has structured proof
 * points to weave in rather than claims it could embellish.
 */
export function formatEvidenceForPrompt(entry: EvidenceBankEntryRecord): string {
  const parts: string[] = []
  parts.push(entry.summary)
  if (entry.clientName) parts.push(`client: ${entry.clientName}`)
  if (entry.industryTags.length > 0) parts.push(`industry: ${entry.industryTags.join(', ')}`)
  if (entry.scope.length > 0) parts.push(`scope: ${entry.scope.join(', ')}`)
  if (entry.tools.length > 0) parts.push(`tools: ${entry.tools.join(', ')}`)
  if (entry.proofPoints.length > 0) {
    parts.push(`proof: ${entry.proofPoints.slice(0, 2).join(' | ')}`)
  }
  return parts.join(' · ')
}
