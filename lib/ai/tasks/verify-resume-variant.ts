import 'server-only'

import type { ResumeVariantOutput } from '@/lib/ai/contracts'
import type { OperatorWorkspaceRecord, ResumeExperienceRecord } from '@/lib/domain/types'
import type { RankedJobRecord } from '@/lib/jobs/contracts'

export interface ResumeVariantVerification {
  /** Short human-readable summary suitable for appending to changeSummaryForUser. */
  userFacingNote: string
  /** JD coverage score — how many of the JD's skillsKeywords landed in the resume. */
  coverage: {
    matched: number
    total: number
    matchedTerms: string[]
    missingTerms: string[]
  }
  /**
   * Numeric or scope claims in bullets that do not trace back to any source text for that role,
   * the selected impact highlights, or the master summary. Logging-mode only for now — we don't
   * strip these yet, just surface them so the user can eyeball and we can measure false-positive
   * rate before moving to strict stripping.
   */
  unverifiedClaims: Array<{
    company: string
    roleTitle: string
    bullet: string
    claim: string
    kind: 'percent' | 'currency' | 'count' | 'years'
  }>
}

function normalizeForSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#/.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizeKeyword(keyword: string) {
  return normalizeForSearch(keyword).replace(/^\s+|\s+$/g, '')
}

// Light stopword filter for deduping near-useless JD keyword entries. Intentionally conservative
// so we don't strip legitimate short tokens like "ux", "ai", "go".
const KEYWORD_STOPWORDS = new Set([
  'and',
  'or',
  'the',
  'with',
  'for',
  'to',
  'of',
  'a',
  'an',
  'in',
  'on',
  'at',
  'by',
  'experience',
  'skills',
  'required',
  'preferred',
  'strong',
  'excellent',
  'good',
])

function isUsefulKeyword(keyword: string) {
  const token = tokenizeKeyword(keyword)
  if (!token) return false
  if (token.length < 2) return false
  if (KEYWORD_STOPWORDS.has(token)) return false
  return true
}

function buildResumeHaystack(variant: ResumeVariantOutput): string {
  const parts: string[] = [variant.summary, variant.headline, ...variant.skillsSection]
  for (const entry of variant.experienceEntries) {
    parts.push(entry.roleTitle, entry.companyName, entry.summary)
    parts.push(...entry.highlights)
  }
  return normalizeForSearch(parts.filter(Boolean).join(' '))
}

function computeCoverage(
  variant: ResumeVariantOutput,
  job: Pick<RankedJobRecord, 'skillsKeywords'>,
): ResumeVariantVerification['coverage'] {
  const haystack = buildResumeHaystack(variant)
  const seen = new Set<string>()
  const keywords = job.skillsKeywords
    .map((keyword) => tokenizeKeyword(keyword))
    .filter(isUsefulKeyword)
    .filter((keyword) => {
      if (seen.has(keyword)) return false
      seen.add(keyword)
      return true
    })

  const matchedTerms: string[] = []
  const missingTerms: string[] = []
  for (const keyword of keywords) {
    // Word-boundary match so "ui" doesn't falsely match "guide". Use a conservative boundary
    // that treats punctuation, space, and string edges as boundaries.
    const boundary = `(^|[^a-z0-9+#])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9+#])`
    const matched = new RegExp(boundary, 'i').test(haystack)
    if (matched) {
      matchedTerms.push(keyword)
    } else {
      missingTerms.push(keyword)
    }
  }

  return {
    matched: matchedTerms.length,
    total: keywords.length,
    matchedTerms,
    missingTerms,
  }
}

// Regex-based claim extractor. Intentionally conservative — we'd rather miss a fabrication than
// false-flag a legitimate rephrase, because the user sees these notes. Matches:
//   - percentages: "38%", "2.5%"
//   - currency: "$3M", "$500K", "$1.2m", "$500,000"
//   - counts: "40+ clients", "12 markets", "4 product lines"
//   - year spans: "5+ years", "10 years"
const CLAIM_PATTERNS: Array<{ pattern: RegExp; kind: ResumeVariantVerification['unverifiedClaims'][number]['kind'] }> = [
  { pattern: /\b\d+(?:\.\d+)?\s?%/g, kind: 'percent' },
  { pattern: /\$\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m|b|million|billion|thousand)?\b/gi, kind: 'currency' },
  {
    pattern:
      /\b\d[\d,]*\+?\s+(?:clients?|accounts?|campaigns?|users?|customers?|followers?|projects?|people|members|markets?|countries|cities|brands?|partners?|stakeholders?|teams?|designers?|product lines?|product\b|launches?|deliverables?|assets?|pieces)\b/gi,
    kind: 'count',
  },
  { pattern: /\b\d+\+?\s+(?:years?|yrs?|months?|mos?)\b/gi, kind: 'years' },
]

function extractClaims(bullet: string) {
  const results: Array<{ claim: string; kind: ResumeVariantVerification['unverifiedClaims'][number]['kind'] }> = []
  for (const { pattern, kind } of CLAIM_PATTERNS) {
    const matches = bullet.match(pattern)
    if (!matches) continue
    for (const match of matches) {
      const normalized = match.trim()
      if (!normalized) continue
      results.push({ claim: normalized, kind })
    }
  }
  return results
}

function buildSourceHaystackForRole(
  source: ResumeExperienceRecord | null,
  workspace: OperatorWorkspaceRecord,
): string {
  const parts: string[] = []
  if (source) {
    parts.push(source.summary, ...source.highlights)
  }
  parts.push(workspace.resumeMaster.summaryText)
  parts.push(...workspace.resumeMaster.selectedImpactHighlights)
  return normalizeForSearch(parts.filter(Boolean).join(' '))
}

function claimAppearsInSource(claim: string, sourceHaystack: string) {
  const normalized = normalizeForSearch(claim)
  if (!normalized) return true
  return sourceHaystack.includes(normalized)
}

function findSourceForEntry(
  entry: ResumeExperienceRecord,
  workspace: OperatorWorkspaceRecord,
): ResumeExperienceRecord | null {
  const needle = `${entry.companyName}::${entry.roleTitle}`.toLowerCase()
  const all = [
    ...workspace.resumeMaster.experienceEntries,
    ...workspace.resumeMaster.archivedExperienceEntries,
  ]
  return all.find((candidate) => `${candidate.companyName}::${candidate.roleTitle}`.toLowerCase() === needle) ?? null
}

function detectUnverifiedClaims(
  variant: ResumeVariantOutput,
  workspace: OperatorWorkspaceRecord,
): ResumeVariantVerification['unverifiedClaims'] {
  const flagged: ResumeVariantVerification['unverifiedClaims'] = []
  for (const entry of variant.experienceEntries) {
    const source = findSourceForEntry(entry, workspace)
    const haystack = buildSourceHaystackForRole(source, workspace)
    for (const bullet of entry.highlights) {
      const claims = extractClaims(bullet)
      for (const { claim, kind } of claims) {
        if (!claimAppearsInSource(claim, haystack)) {
          flagged.push({
            company: entry.companyName,
            roleTitle: entry.roleTitle,
            bullet,
            claim,
            kind,
          })
        }
      }
    }
  }
  return flagged
}

function buildUserFacingNote(
  coverage: ResumeVariantVerification['coverage'],
  unverifiedClaims: ResumeVariantVerification['unverifiedClaims'],
): string {
  const parts: string[] = []
  if (coverage.total > 0) {
    parts.push(`JD keyword coverage: ${coverage.matched}/${coverage.total}`)
    if (coverage.missingTerms.length > 0 && coverage.missingTerms.length <= 4) {
      parts.push(`missing: ${coverage.missingTerms.join(', ')}`)
    } else if (coverage.missingTerms.length > 4) {
      parts.push(`missing ${coverage.missingTerms.length} terms`)
    }
  }
  if (unverifiedClaims.length > 0) {
    const sample = unverifiedClaims.slice(0, 2).map((item) => item.claim)
    parts.push(
      `${unverifiedClaims.length} unverified claim${unverifiedClaims.length === 1 ? '' : 's'} to review${
        sample.length > 0 ? ` (e.g. ${sample.join(', ')})` : ''
      }`,
    )
  }
  return parts.join(' · ')
}

export function verifyResumeVariant(
  variant: ResumeVariantOutput,
  job: Pick<RankedJobRecord, 'skillsKeywords'>,
  workspace: OperatorWorkspaceRecord,
): ResumeVariantVerification {
  const coverage = computeCoverage(variant, job)
  const unverifiedClaims = detectUnverifiedClaims(variant, workspace)
  const userFacingNote = buildUserFacingNote(coverage, unverifiedClaims)
  return { coverage, unverifiedClaims, userFacingNote }
}
