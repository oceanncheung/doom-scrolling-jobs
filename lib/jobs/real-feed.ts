import 'server-only'

import { createHash } from 'node:crypto'

import { defaultOperator } from '@/lib/config/runtime'
import type { RecommendationLevel, RemoteType, WorkflowStatus } from '@/lib/domain/types'
import type {
  JobSourceKind,
  NormalizedJobRecord,
  PortfolioRequirement,
  RawJobIntakeRecord,
  SourceDiagnostics,
} from '@/lib/jobs/contracts'
import { fetchGreenhouseCompanyJobs, type ImportedSourceBatch } from '@/lib/jobs/greenhouse'
import {
  getCompanyWatchlist,
  getImportedSourceNames,
  getSourceRegistry,
  getSourceRegistryBySlug,
  saveSourceDiagnostics,
  sourcePreferenceWeight,
  type SourceRegistryEntry,
} from '@/lib/jobs/source-registry'
import { createClient } from '@/lib/supabase/server'

import { getOperatorProfile } from '../data/operator-profile'

export const primaryImportedSourceName = 'Remote OK'
const primaryImportedSourceApiUrl = 'https://remoteok.com/api'
const maxImportedJobs = 30
const maxWatchedCompanies = 20

type DesignerRoleBucket = 'core' | 'adjacent'

interface DesignerRoleFamily {
  bucket: DesignerRoleBucket
  descriptionPhrases: string[]
  familyLabel: string
  titlePhrases: string[]
  titleTokenGroups: string[][]
}

interface DesignerRoleMatch {
  bucket: DesignerRoleBucket
  familyLabel: string
  matchedBy: 'title' | 'description'
}

const designerRoleFamilies: DesignerRoleFamily[] = [
  {
    bucket: 'core',
    descriptionPhrases: ['graphic design', 'editorial design', 'print design', 'layout design'],
    familyLabel: 'graphic design',
    titlePhrases: ['graphic designer', 'graphic design'],
    titleTokenGroups: [['graphic', 'designer'], ['graphic', 'design']],
  },
  {
    bucket: 'core',
    descriptionPhrases: ['brand design', 'brand identity', 'brand system', 'visual identity'],
    familyLabel: 'brand design',
    titlePhrases: ['brand designer', 'brand design'],
    titleTokenGroups: [['brand', 'designer'], ['brand', 'design']],
  },
  {
    bucket: 'core',
    descriptionPhrases: ['visual design', 'visual system', 'visual identity', 'visual language'],
    familyLabel: 'visual design',
    titlePhrases: ['visual designer', 'visual design'],
    titleTokenGroups: [['visual', 'designer'], ['visual', 'design']],
  },
  {
    bucket: 'core',
    descriptionPhrases: ['communication design', 'communications design', 'visual communication'],
    familyLabel: 'communication design',
    titlePhrases: ['communication designer', 'communications designer', 'communication design'],
    titleTokenGroups: [
      ['communication', 'designer'],
      ['communications', 'designer'],
      ['communication', 'design'],
    ],
  },
  {
    bucket: 'adjacent',
    descriptionPhrases: ['marketing design', 'campaign design', 'growth design'],
    familyLabel: 'marketing design',
    titlePhrases: ['marketing designer', 'marketing design', 'growth designer'],
    titleTokenGroups: [
      ['marketing', 'designer'],
      ['marketing', 'design'],
      ['growth', 'designer'],
    ],
  },
  {
    bucket: 'adjacent',
    descriptionPhrases: ['web design', 'website design', 'landing page design'],
    familyLabel: 'web design',
    titlePhrases: ['web designer', 'web design', 'website designer'],
    titleTokenGroups: [['web', 'designer'], ['web', 'design'], ['website', 'designer']],
  },
  {
    bucket: 'adjacent',
    descriptionPhrases: ['production design', 'production artwork', 'production artist'],
    familyLabel: 'production design',
    titlePhrases: ['production designer', 'production design', 'production artist'],
    titleTokenGroups: [
      ['production', 'designer'],
      ['production', 'design'],
      ['production', 'artist'],
    ],
  },
  {
    bucket: 'adjacent',
    descriptionPhrases: ['presentation design', 'pitch deck design', 'slide design'],
    familyLabel: 'presentation design',
    titlePhrases: ['presentation designer', 'presentation design', 'powerpoint designer'],
    titleTokenGroups: [
      ['presentation', 'designer'],
      ['presentation', 'design'],
      ['powerpoint', 'designer'],
    ],
  },
]

const genericDesignTitleTerms = ['designer', 'design']

const excludedTitlePhrases = [
  'finance',
  'accounting',
  'accountant',
  'bookkeeper',
  'data science',
  'data scientist',
  'data analyst',
  'analytics',
  'machine learning',
  'ml engineer',
  'software engineer',
  'software developer',
  'developer',
  'engineering',
  'sales',
  'account executive',
  'sales development',
  'business development',
  'operations',
  'revenue operations',
  'program manager',
  'project manager',
  'human resources',
  'talent acquisition',
  'recruiter',
  'legal',
  'counsel',
  'paralegal',
  'customer support',
  'customer success',
  'support specialist',
  'support engineer',
  'clinician',
  'psychologist',
  'product designer',
  'product design',
  'interior designer',
  'interior design',
  'ux designer',
  'ux design',
  'user experience',
  'ui ux',
  'ui designer',
  'interaction designer',
  'interaction design',
  'industrial designer',
  'industrial design',
]

const remoteOkBoilerplatePatterns = [
  /please mention the word [^.?!\n]+[.?!]?/gi,
  /please include the word [^.?!\n]+[.?!]?/gi,
  /when applying[, ]+(?:please )?(?:mention|include) [^.?!\n]+[.?!]?/gi,
  /in the subject line[, ]+(?:please )?(?:mention|include) [^.?!\n]+[.?!]?/gi,
  /to prove (?:that )?(?:you(?:'|’)re|you are) (?:human|not a bot|read this)[^.?!\n]*[.?!]?/gi,
  /this is a test to see if you read [^.?!\n]+[.?!]?/gi,
]

interface RemoteOkEnvelopeRecord {
  last_updated?: number
  legal?: string
}

interface RemoteOkJobApiRecord {
  apply_url?: string
  company?: string
  date?: string
  description?: string
  id?: number | string
  location?: string
  position?: string
  salary_max?: number
  salary_min?: number
  slug?: string
  tags?: string[]
  url?: string
}

interface BasicScoreResult {
  effortScore: number
  fitReasons: string[]
  fitSummary: string
  missingRequirements: string[]
  penaltyScore: number
  portfolioFitScore: number
  qualityScore: number
  recommendationLevel: RecommendationLevel
  redFlags: string[]
  remoteGatePassed: boolean
  roleRelevanceScore: number
  salaryScore: number
  scamRiskLevel: 'low'
  seniorityScore: number
  totalScore: number
}

export interface ImportedJobsSyncResult {
  importedCount: number
  issue?: string
  skipped?: boolean
  sourceDiagnostics?: SourceDiagnostics[]
  staleCount?: number
}

interface ImportedJobsSyncOptions {
  force?: boolean
  markMissingAsStale?: boolean
}

interface NormalizedImportedCandidate {
  normalizedJob: NormalizedJobRecord
  sourceKey: string
  sourceKind: JobSourceKind
  sourceName: string
}

interface FilteredSourceBatch {
  diagnostics: SourceDiagnostics
  jobs: NormalizedImportedCandidate[]
}

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeToken(value: string) {
  return normalizeWhitespace(value).toLowerCase()
}

function normalizeSearchText(value: string) {
  return ` ${normalizeToken(value).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()} `
}

function tokenize(value: string) {
  return normalizeToken(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1)
}

function roundScore(value: number) {
  return Math.round(value * 10) / 10
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function decodeHtmlEntities(value: string) {
  let decoded = value

  for (let index = 0; index < 2; index += 1) {
    decoded = decoded
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
  }

  return decoded
}

function stripHtml(value: string) {
  return normalizeWhitespace(
    decodeHtmlEntities(value)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|h1|h2|h3|div|ul|ol)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
}

function cleanImportedTitle(value: string) {
  return normalizeWhitespace(
    value
      .replace(/\((remote|hybrid|onsite|on site|worldwide|anywhere)\)/gi, ' ')
      .replace(/\s+[-|:]\s*(remote|hybrid|onsite|on site|worldwide|anywhere)\b.*$/gi, ' ')
      .replace(/\s+(remote|hybrid|onsite|on site|worldwide|anywhere)\b$/gi, ' '),
  )
}

function stripRemoteOkBoilerplate(value: string) {
  let cleaned = stripHtml(value)

  for (const pattern of remoteOkBoilerplatePatterns) {
    cleaned = cleaned.replace(pattern, ' ')
  }

  return normalizeWhitespace(cleaned)
}

function matchesPhrase(haystack: string, phrase: string) {
  return haystack.includes(normalizeSearchText(phrase))
}

function matchesTokenGroup(tokens: Set<string>, group: string[]) {
  return group.every((token) => tokens.has(normalizeToken(token)))
}

function hasGenericDesignTitleSignal(title: string) {
  const normalizedTitle = normalizeSearchText(title)
  const titleTokens = new Set(tokenize(title))

  return genericDesignTitleTerms.some(
    (term) => matchesPhrase(normalizedTitle, term) || titleTokens.has(normalizeToken(term)),
  )
}

function getExcludedTitleTerm(title: string) {
  const normalizedTitle = normalizeSearchText(title)

  return excludedTitlePhrases.find((phrase) => matchesPhrase(normalizedTitle, phrase)) ?? null
}

function findRoleFamilyMatch(value: string, source: 'title' | 'description') {
  const normalizedValue = normalizeSearchText(value)
  const valueTokens = new Set(tokenize(value))
  const matchedFamily = designerRoleFamilies.find(
    (family) =>
      family.titlePhrases.some((phrase) => matchesPhrase(normalizedValue, phrase)) ||
      family.titleTokenGroups.some((group) => matchesTokenGroup(valueTokens, group)) ||
      (source === 'description' &&
        family.descriptionPhrases.some((phrase) => matchesPhrase(normalizedValue, phrase))),
  )

  if (!matchedFamily) {
    return null
  }

  return {
    bucket: matchedFamily.bucket,
    familyLabel: matchedFamily.familyLabel,
    matchedBy: source,
  } satisfies DesignerRoleMatch
}

function getDesignerRoleMatch(title: string, descriptionText: string) {
  const titleMatch = findRoleFamilyMatch(title, 'title')

  if (titleMatch) {
    return titleMatch
  }

  if (!hasGenericDesignTitleSignal(title)) {
    return null
  }

  return findRoleFamilyMatch(descriptionText, 'description')
}

function isDesignCandidate(title: string, descriptionText: string) {
  if (getExcludedTitleTerm(title)) {
    return false
  }

  return getDesignerRoleMatch(title, descriptionText) !== null
}

function parseRemoteType(title: string, location: string, descriptionText: string): RemoteType {
  const combined = normalizeToken(`${title} ${location} ${descriptionText}`)

  if (combined.includes('hybrid')) {
    return 'hybrid'
  }

  if (combined.includes('onsite') || combined.includes('on site') || combined.includes('in office')) {
    return 'onsite'
  }

  if (
    combined.includes('remote') ||
    combined.includes('distributed') ||
    combined.includes('work from home') ||
    combined.includes('worldwide') ||
    combined.includes('anywhere')
  ) {
    return 'remote'
  }

  return 'remote'
}

function normalizeLocationLabel(location: string, remoteType: RemoteType) {
  const cleaned = normalizeWhitespace(location.replace(/\(.*?\)/g, ''))

  if (cleaned.length > 0) {
    return cleaned
  }

  return remoteType === 'remote' ? 'Remote' : ''
}

function normalizeRemoteRegions(location: string, remoteType: RemoteType) {
  if (remoteType !== 'remote') {
    return []
  }

  const cleaned = normalizeWhitespace(location)

  if (!cleaned) {
    return []
  }

  if (/worldwide|global|anywhere/i.test(cleaned)) {
    return ['Worldwide']
  }

  return [cleaned]
}

function parsePostedAt(value: string) {
  if (!value) {
    return undefined
  }

  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString()
}

function inferEmploymentType(title: string, descriptionText: string): NormalizedJobRecord['employmentType'] {
  const combined = normalizeSearchText(`${title} ${descriptionText}`)

  if (/\bpart time\b/i.test(combined)) {
    return 'part_time'
  }

  if (/\bcontract\b|\bcontractor\b/i.test(combined)) {
    return 'contract'
  }

  if (/\bfreelance\b|\bfreelancer\b/i.test(combined)) {
    return 'freelance'
  }

  if (/\btemporary\b|\btemp\b|\bseasonal\b/i.test(combined)) {
    return 'temporary'
  }

  if (/\bintern\b|\binternship\b/i.test(combined)) {
    return 'internship'
  }

  if (/\bfull time\b/i.test(combined)) {
    return 'full_time'
  }

  return 'unknown'
}

function inferSeniorityLabel(title: string) {
  const normalizedTitle = normalizeToken(title)

  if (normalizedTitle.includes('principal') || normalizedTitle.includes('staff')) {
    return 'Staff+'
  }

  if (normalizedTitle.includes('lead') || normalizedTitle.includes('director')) {
    return 'Lead'
  }

  if (normalizedTitle.includes('senior') || normalizedTitle.includes('sr ')) {
    return 'Senior'
  }

  if (normalizedTitle.includes('junior') || normalizedTitle.includes('associate')) {
    return 'Junior'
  }

  return 'Mid'
}

function inferPortfolioRequirement(title: string, descriptionText: string): PortfolioRequirement {
  return getDesignerRoleMatch(title, descriptionText) ? 'yes' : 'unknown'
}

function createDuplicateGroupKey(companyName: string, title: string, locationLabel: string) {
  return [companyName, title, locationLabel]
    .map((value) =>
      normalizeToken(value)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    )
    .filter(Boolean)
    .join('--')
}

function getProfileRolePhrases(values: string[]) {
  return values
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
}

function normalizeRemoteOkRawRecord(value: unknown, capturedAt: string): RawJobIntakeRecord | null {
  const record = asRecord(value)

  if (!record) {
    return null
  }

  const sourceJobId = asString(record.id)
  const companyNameRaw = asString(record.company)
  const titleRaw = asString(record.position)
  const sourceUrl = asString(record.url || record.apply_url)

  if (!sourceJobId || !companyNameRaw || !titleRaw || !sourceUrl) {
    return null
  }

  const salaryMin = asNumber(record.salary_min)
  const salaryMax = asNumber(record.salary_max)
  const compensationRaw =
    salaryMin > 0 || salaryMax > 0
      ? [salaryMin > 0 ? String(salaryMin) : '', salaryMax > 0 ? String(salaryMax) : '']
          .filter(Boolean)
          .join('-')
      : ''

  return {
    applicationUrl: asString(record.apply_url) || undefined,
    capturedAt,
    companyNameRaw,
    compensationRaw: compensationRaw || undefined,
    descriptionText: stripRemoteOkBoilerplate(asString(record.description)),
    locationRaw: asString(record.location) || undefined,
    metadata: {
      salary_max: salaryMax,
      salary_min: salaryMin,
      slug: asString(record.slug) || undefined,
      source_key: 'remote-ok',
      tags: asStringArray(record.tags),
    },
    postedAtRaw: asString(record.date) || undefined,
    sourceKey: 'remote-ok',
    sourceKind: 'remote_board',
    sourceJobId,
    sourceName: primaryImportedSourceName,
    sourceUrl,
    titleRaw,
  }
}

function normalizeImportedJob(rawJob: RawJobIntakeRecord): NormalizedJobRecord {
  const metadata = asRecord(rawJob.metadata)
  const departments = asStringArray(metadata?.departments)
  const title = cleanImportedTitle(rawJob.titleRaw)
  const companyName = normalizeWhitespace(rawJob.companyNameRaw)
  const location = normalizeWhitespace(rawJob.locationRaw ?? '')
  const remoteType = parseRemoteType(rawJob.titleRaw, location, rawJob.descriptionText)
  const locationLabel = normalizeLocationLabel(location, remoteType)
  const salaryMin = asNumber(metadata?.salary_min)
  const salaryMax = asNumber(metadata?.salary_max)

  return {
    applicationUrl: rawJob.applicationUrl || undefined,
    companyDomain: undefined,
    companyName,
    department: departments[0] || undefined,
    descriptionText: rawJob.descriptionText,
    duplicateGroupKey: createDuplicateGroupKey(companyName, title, locationLabel),
    employmentType: inferEmploymentType(title, rawJob.descriptionText),
    listingStatus: 'active',
    locationLabel,
    portfolioRequired: inferPortfolioRequirement(title, rawJob.descriptionText),
    postedAt: parsePostedAt(rawJob.postedAtRaw ?? ''),
    preferredQualifications: [],
    redFlagNotes: [],
    remoteRegions: normalizeRemoteRegions(location, remoteType),
    remoteType,
    requirements: [],
    salaryCurrency: salaryMin > 0 || salaryMax > 0 ? 'USD' : undefined,
    salaryMax: salaryMax > 0 ? salaryMax : undefined,
    salaryMin: salaryMin > 0 ? salaryMin : undefined,
    salaryPeriod: salaryMin > 0 || salaryMax > 0 ? 'annual' : 'unknown',
    seniorityLabel: inferSeniorityLabel(title),
    skillsKeywords: [],
    sourceKey: rawJob.sourceKey,
    sourceKind: rawJob.sourceKind,
    sourceJobId: rawJob.sourceJobId,
    sourceName: rawJob.sourceName,
    sourceUrl: rawJob.sourceUrl,
    title,
    workAuthNotes:
      locationLabel && locationLabel !== 'Remote'
        ? `${rawJob.sourceName} lists this role with location context: ${locationLabel}.`
        : undefined,
  }
}

function normalizeSourceUrl(value: string) {
  try {
    const url = new URL(value)
    const path = url.pathname.replace(/\/+$/, '')

    return `${url.origin.toLowerCase()}${path}`
  } catch {
    return normalizeToken(value)
  }
}

function createSourceIdentityKey(sourceName: string, sourceJobId: string) {
  return `${sourceName}::${sourceJobId}`
}

function buildCanonicalJobKey(job: NormalizedJobRecord) {
  return createHash('sha1')
    .update(
      [
        normalizeToken(job.companyName),
        normalizeToken(job.title),
        normalizeToken(job.locationLabel ?? job.remoteType),
      ].join('|'),
    )
    .digest('hex')
}

function createSourceDiagnostics(
  batch: ImportedSourceBatch,
  sourceKind: JobSourceKind,
): SourceDiagnostics {
  return {
    provider: batch.provider,
    rowsCandidate: 0,
    rowsDeduped: 0,
    rowsExcluded: 0,
    rowsImported: 0,
    rowsSeen: batch.rowsSeen,
    rowsStale: 0,
    sourceKey: batch.sourceKey,
    sourceKind,
    sourceName: batch.sourceName,
  }
}

function filterNormalizedSourceBatch(batch: ImportedSourceBatch): FilteredSourceBatch {
  const diagnostics = createSourceDiagnostics(batch, batch.sourceKind)
  const jobs: NormalizedImportedCandidate[] = []

  if (batch.issue) {
    diagnostics.issue = batch.issue
    return {
      diagnostics,
      jobs,
    }
  }

  for (const rawJob of batch.rawJobs) {
    const normalizedJob = normalizeImportedJob(rawJob)

    if (normalizedJob.remoteType !== 'remote') {
      diagnostics.rowsExcluded += 1
      continue
    }

    if (!isDesignCandidate(normalizedJob.title, normalizedJob.descriptionText)) {
      diagnostics.rowsExcluded += 1
      continue
    }

    diagnostics.rowsCandidate += 1
    jobs.push({
      normalizedJob,
      sourceKey: batch.sourceKey,
      sourceKind: batch.sourceKind,
      sourceName: batch.sourceName,
    })
  }

  return {
    diagnostics,
    jobs,
  }
}

function getCandidatePreference(candidate: NormalizedImportedCandidate) {
  const salaryPresence = candidate.normalizedJob.salaryMin || candidate.normalizedJob.salaryMax ? 1 : 0
  const applicationPresence = candidate.normalizedJob.applicationUrl ? 1 : 0
  const postedTimestamp = candidate.normalizedJob.postedAt
    ? Date.parse(candidate.normalizedJob.postedAt)
    : 0

  return (
    sourcePreferenceWeight(candidate.sourceKind) * 1000 +
    applicationPresence * 100 +
    salaryPresence * 10 +
    (Number.isNaN(postedTimestamp) ? 0 : postedTimestamp / 1000000000000)
  )
}

function dedupeImportedCandidates(
  filteredBatches: FilteredSourceBatch[],
) {
  const sortedCandidates = filteredBatches
    .flatMap((batch) => batch.jobs)
    .sort((left, right) => getCandidatePreference(right) - getCandidatePreference(left))
  const duplicateKeysBySource = new Map<string, number>()
  const seenCanonicalKeys = new Set<string>()
  const seenExactUrlKeys = new Set<string>()
  const keptCandidates: NormalizedImportedCandidate[] = []

  for (const candidate of sortedCandidates) {
    const canonicalKey =
      candidate.normalizedJob.duplicateGroupKey || buildCanonicalJobKey(candidate.normalizedJob)
    const exactUrlKey = normalizeSourceUrl(candidate.normalizedJob.sourceUrl)

    if (
      (canonicalKey && seenCanonicalKeys.has(canonicalKey)) ||
      (exactUrlKey && seenExactUrlKeys.has(exactUrlKey))
    ) {
      duplicateKeysBySource.set(
        candidate.sourceKey,
        (duplicateKeysBySource.get(candidate.sourceKey) ?? 0) + 1,
      )
      continue
    }

    if (canonicalKey) {
      seenCanonicalKeys.add(canonicalKey)
    }

    if (exactUrlKey) {
      seenExactUrlKeys.add(exactUrlKey)
    }

    keptCandidates.push(candidate)
  }

  return {
    candidates: keptCandidates,
    duplicateKeysBySource,
  }
}

function getAgeInDays(postedAt?: string) {
  if (!postedAt) {
    return undefined
  }

  const ageMs = Date.now() - new Date(postedAt).getTime()
  if (Number.isNaN(ageMs)) {
    return undefined
  }

  return ageMs / (1000 * 60 * 60 * 24)
}

function getProfileTargetAmount(profile: Awaited<ReturnType<typeof getOperatorProfile>>['workspace']['profile']) {
  const numericValue = Number.parseInt(
    profile.salaryTargetMin || profile.salaryFloorAmount || profile.salaryTargetMax,
    10,
  )

  return Number.isFinite(numericValue) ? numericValue : 0
}

function getRoleRelevanceScore(
  title: string,
  descriptionText: string,
  profile: Awaited<ReturnType<typeof getOperatorProfile>>['workspace']['profile'],
) {
  const normalizedTitle = normalizeToken(title)
  const targetRoles = getProfileRolePhrases(profile.targetRoles)
  const adjacentRoles = getProfileRolePhrases(profile.allowedAdjacentRoles)
  const designerRoleMatch = getDesignerRoleMatch(title, descriptionText)
  const exactTargetMatch = targetRoles.find((role) => normalizedTitle.includes(normalizeToken(role)))
  const exactAdjacentMatch = adjacentRoles.find((role) => normalizedTitle.includes(normalizeToken(role)))

  if (exactTargetMatch) {
    return {
      matchingRole: exactTargetMatch,
      score: 18,
    }
  }

  if (exactAdjacentMatch) {
    return {
      matchingRole: exactAdjacentMatch,
      score: 13,
    }
  }

  if (designerRoleMatch) {
    return {
      matchingRole: `${designerRoleMatch.bucket} role family: ${designerRoleMatch.familyLabel}`,
      score:
        designerRoleMatch.bucket === 'core'
          ? designerRoleMatch.matchedBy === 'title'
            ? 17
            : 15.5
          : designerRoleMatch.matchedBy === 'title'
            ? 13
            : 11.5,
    }
  }

  return {
    matchingRole: '',
    score: 4,
  }
}

function getSalaryScore(
  job: NormalizedJobRecord,
  profile: Awaited<ReturnType<typeof getOperatorProfile>>['workspace']['profile'],
) {
  if (!job.salaryMin && !job.salaryMax) {
    return {
      note: 'Salary was not listed in the source feed.',
      score: 8,
    }
  }

  const salaryTarget = getProfileTargetAmount(profile)
  const salaryFloor = job.salaryMin ?? job.salaryMax ?? 0
  const salaryCeiling = job.salaryMax ?? job.salaryMin ?? 0

  if (!salaryTarget) {
    return {
      note: 'Salary is listed, even though no user floor is set yet.',
      score: 15,
    }
  }

  if (salaryFloor >= salaryTarget) {
    return {
      note: 'Listed compensation clears the current salary target.',
      score: 22,
    }
  }

  if (salaryCeiling >= salaryTarget) {
    return {
      note: 'Top-end compensation reaches the current salary target.',
      score: 17,
    }
  }

  return {
    note: 'Listed compensation sits below the current salary target.',
    score: 6,
  }
}

function getQualityScore(job: NormalizedJobRecord) {
  const ageInDays = getAgeInDays(job.postedAt)
  let score = 16

  if (job.sourceUrl.startsWith('https://')) {
    score += 4
  }

  if (job.applicationUrl) {
    score += 2
  }

  if (job.salaryMin || job.salaryMax) {
    score += 3
  }

  if (typeof ageInDays === 'number') {
    if (ageInDays <= 7) {
      score += 10
    } else if (ageInDays <= 30) {
      score += 7
    } else {
      score += 3
    }
  }

  return clamp(score, 0, 35)
}

function getSeniorityScore(
  job: NormalizedJobRecord,
  profile: Awaited<ReturnType<typeof getOperatorProfile>>['workspace']['profile'],
) {
  const desired = normalizeToken(profile.seniorityLevel)
  const actual = normalizeToken(job.seniorityLabel ?? '')

  if (!desired || !actual) {
    return 6
  }

  if (desired.includes('senior') && (actual.includes('senior') || actual.includes('lead'))) {
    return 8.5
  }

  if (desired.includes('mid') && actual.includes('mid')) {
    return 8
  }

  if (desired.includes('junior') && actual.includes('junior')) {
    return 8
  }

  if (desired.includes('senior') && actual.includes('staff')) {
    return 7
  }

  return 5
}

function getPortfolioFitScore(job: NormalizedJobRecord) {
  if (job.portfolioRequired === 'yes') {
    return 4
  }

  return 2
}

function getEffortScore(job: NormalizedJobRecord) {
  let score = 3

  if (job.applicationUrl) {
    score += 1
  }

  if (job.postedAt) {
    score += 0.5
  }

  return clamp(score, 0, 5)
}

function getPenaltyScore(
  job: NormalizedJobRecord,
  remoteGatePassed: boolean,
  roleRelevanceScore: number,
) {
  const ageInDays = getAgeInDays(job.postedAt)
  let score = 0

  if (!remoteGatePassed) {
    score += 5
  }

  if (roleRelevanceScore < 8) {
    score += 4
  }

  if (!job.salaryMin && !job.salaryMax) {
    score += 1.5
  }

  if (typeof ageInDays === 'number' && ageInDays > 45) {
    score += 2
  }

  return clamp(score, 0, 10)
}

function getRecommendationLevel(totalScore: number): RecommendationLevel {
  if (totalScore >= 72) {
    return 'strong_apply'
  }

  if (totalScore >= 58) {
    return 'apply_if_interested'
  }

  if (totalScore >= 44) {
    return 'consider_carefully'
  }

  return 'skip'
}

function buildFitSummary(
  companyName: string,
  title: string,
  recommendationLevel: RecommendationLevel,
  remoteGatePassed: boolean,
) {
  const recommendationCopy: Record<RecommendationLevel, string> = {
    apply_if_interested: 'a credible adjacent fit',
    consider_carefully: 'a stretch worth reviewing carefully',
    skip: 'a weak fit against the current search brief',
    strong_apply: 'a strong direct-fit role',
  }

  return `${companyName}'s ${title} reads as ${recommendationCopy[recommendationLevel]}${
    remoteGatePassed ? ' with remote compatibility intact.' : ' but misses the remote requirement.'
  }`
}

function buildBasicScore(
  job: NormalizedJobRecord,
  profile: Awaited<ReturnType<typeof getOperatorProfile>>['workspace']['profile'],
): BasicScoreResult {
  const remoteGatePassed = !profile.remoteRequired || job.remoteType === 'remote'
  const roleMatch = getRoleRelevanceScore(job.title, job.descriptionText, profile)
  const designerRoleMatch = getDesignerRoleMatch(job.title, job.descriptionText)
  const salaryResult = getSalaryScore(job, profile)
  const qualityScore = getQualityScore(job)
  const seniorityScore = getSeniorityScore(job, profile)
  const portfolioFitScore = getPortfolioFitScore(job)
  const effortScore = getEffortScore(job)
  const penaltyScore = getPenaltyScore(job, remoteGatePassed, roleMatch.score)
  const totalScore = roundScore(
    qualityScore +
      salaryResult.score +
      roleMatch.score +
      seniorityScore +
      portfolioFitScore +
      effortScore -
      penaltyScore,
  )
  const recommendationLevel = getRecommendationLevel(totalScore)
  const fitReasons = [
    designerRoleMatch
      ? designerRoleMatch.matchedBy === 'title'
        ? `Matched ${designerRoleMatch.bucket} role family: ${designerRoleMatch.familyLabel}.`
        : `Generic design title passed because the description points to ${designerRoleMatch.familyLabel}.`
      : '',
    remoteGatePassed ? 'Remote requirement still passes for this imported role.' : '',
    roleMatch.matchingRole
      ? `Title overlap aligns with ${roleMatch.matchingRole}.`
      : 'The title is only loosely connected to the current role targets.',
    salaryResult.note,
    job.postedAt ? 'Posted date is available from the source feed.' : '',
  ].filter(Boolean)
  const missingRequirements = [
    !job.salaryMin && !job.salaryMax ? 'No salary was listed in the source feed.' : '',
    roleMatch.score < 12 ? 'Title alignment is weaker than the top target-role matches.' : '',
  ].filter(Boolean)
  const redFlags = [
    getAgeInDays(job.postedAt) && (getAgeInDays(job.postedAt) ?? 0) > 45
      ? 'Listing may be aging out based on the posted date.'
      : '',
  ].filter(Boolean)

  return {
    effortScore: roundScore(effortScore),
    fitReasons,
    fitSummary: buildFitSummary(job.companyName, job.title, recommendationLevel, remoteGatePassed),
    missingRequirements,
    penaltyScore: roundScore(penaltyScore),
    portfolioFitScore: roundScore(portfolioFitScore),
    qualityScore: roundScore(qualityScore),
    recommendationLevel,
    redFlags,
    remoteGatePassed,
    roleRelevanceScore: roundScore(roleMatch.score),
    salaryScore: roundScore(salaryResult.score),
    scamRiskLevel: 'low',
    seniorityScore: roundScore(seniorityScore),
    totalScore,
  }
}

async function fetchRemoteOkBatch(
  registryEntry?: SourceRegistryEntry,
): Promise<ImportedSourceBatch> {
  try {
    const response = await fetch(primaryImportedSourceApiUrl, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      return {
        issue: `Remote OK returned ${response.status}.`,
        provider: registryEntry?.provider ?? 'remoteok',
        rawJobs: [],
        rowsSeen: 0,
        sourceKey: 'remote-ok',
        sourceKind: registryEntry?.sourceKind ?? 'remote_board',
        sourceName: primaryImportedSourceName,
      }
    }

    const payload = (await response.json()) as Array<RemoteOkEnvelopeRecord | RemoteOkJobApiRecord>
    const capturedAt = new Date().toISOString()
    const allRawJobs = payload
      .map((item) => normalizeRemoteOkRawRecord(item, capturedAt))
      .filter((item): item is RawJobIntakeRecord => item !== null)
    const rawJobs = allRawJobs.slice(0, maxImportedJobs)

    return {
      provider: registryEntry?.provider ?? 'remoteok',
      rawJobs,
      rowsSeen: allRawJobs.length,
      sourceKey: 'remote-ok',
      sourceKind: registryEntry?.sourceKind ?? 'remote_board',
      sourceName: primaryImportedSourceName,
    }
  } catch (error) {
    return {
      issue: error instanceof Error ? error.message : 'Remote OK import failed.',
      provider: registryEntry?.provider ?? 'remoteok',
      rawJobs: [],
      rowsSeen: 0,
      sourceKey: 'remote-ok',
      sourceKind: registryEntry?.sourceKind ?? 'remote_board',
      sourceName: primaryImportedSourceName,
    }
  }
}

async function fetchImportedSourceBatches() {
  const [registry, watchlist] = await Promise.all([getSourceRegistry(), getCompanyWatchlist()])
  const registryBySlug = getSourceRegistryBySlug(registry)
  const remoteRegistryEntry = registry.find((entry) => entry.slug === 'remote-ok')
  const greenhouseWatchlist = watchlist
    .filter((entry) => {
      const registryEntry = registryBySlug.get(entry.sourceRegistrySlug)
      return registryEntry?.sourceKind === 'ats_hosted_job_page'
    })
    .slice(0, maxWatchedCompanies)

  const greenhouseBatches = await Promise.all(
    greenhouseWatchlist.map((entry) => fetchGreenhouseCompanyJobs(entry)),
  )

  return {
    batches: [await fetchRemoteOkBatch(remoteRegistryEntry), ...greenhouseBatches],
    importedSourceNames: getImportedSourceNames(watchlist),
  }
}

async function hasImportedScores(importedSourceNames: Set<string>) {
  const supabase = createClient()
  const sourceNames = [...importedSourceNames].filter(Boolean)

  if (sourceNames.length === 0) {
    return false
  }

  const { count, error } = await supabase
    .from('job_scores')
    .select(
      `
        id,
        jobs!inner (
          source_name
        )
      `,
      { count: 'exact', head: true },
    )
    .eq('user_id', defaultOperator.userId)
    .in('jobs.source_name', sourceNames)

  if (error) {
    return false
  }

  return (count ?? 0) > 0
}

async function markMissingImportedJobsAsStale(
  currentSourceJobIdsBySourceName: Map<string, string[]>,
  importedSourceNames: Set<string>,
  diagnosticsBySourceKey: Map<string, SourceDiagnostics>,
) {
  const supabase = createClient()
  const sourceNames = [...importedSourceNames].filter(Boolean)

  if (sourceNames.length === 0) {
    return {
      staleCount: 0,
    }
  }

  const { data: existingJobs, error: existingJobsError } = await supabase
    .from('jobs')
    .select('id, source_job_id, source_name')
    .in('source_name', sourceNames)

  if (existingJobsError || !existingJobs) {
    return {
      issue: existingJobsError?.message ?? 'Unable to load existing imported jobs for stale marking.',
      staleCount: 0,
    }
  }

  const staleJobIds = existingJobs
    .filter((job) => {
      const sourceJobId = asString(job.source_job_id)
      const sourceName = asString(job.source_name)
      const activeSourceJobIds = currentSourceJobIdsBySourceName.get(sourceName) ?? []

      return sourceJobId.length > 0 && !activeSourceJobIds.includes(sourceJobId)
    })
    .map((job) => asString(job.id))
    .filter(Boolean)

  if (staleJobIds.length === 0) {
    return {
      staleCount: 0,
    }
  }

  const { error: staleUpdateError } = await supabase
    .from('jobs')
    .update({
      listing_status: 'stale',
    })
    .in('id', staleJobIds)

  if (staleUpdateError) {
    return {
      issue: staleUpdateError.message,
      staleCount: 0,
    }
  }

  for (const [sourceKey, diagnostics] of diagnosticsBySourceKey.entries()) {
    const sourceSpecificStaleCount = existingJobs.filter((job) => {
      const sourceName = asString(job.source_name)
      const sourceJobId = asString(job.source_job_id)
      const activeSourceJobIds = currentSourceJobIdsBySourceName.get(sourceName) ?? []

      return (
        diagnostics.sourceName === sourceName &&
        sourceJobId.length > 0 &&
        !activeSourceJobIds.includes(sourceJobId)
      )
    }).length

    diagnosticsBySourceKey.set(sourceKey, {
      ...diagnostics,
      rowsStale: sourceSpecificStaleCount,
    })
  }

  return {
    staleCount: staleJobIds.length,
  }
}

export async function ensurePrimaryImportedJobs(
  options: ImportedJobsSyncOptions = {},
): Promise<ImportedJobsSyncResult> {
  try {
    const { batches, importedSourceNames } = await fetchImportedSourceBatches()

    if (!options.force && (await hasImportedScores(importedSourceNames))) {
      return {
        importedCount: 0,
        skipped: true,
      }
    }

    const { workspace } = await getOperatorProfile()
    const filteredBatches = batches.map((batch) => filterNormalizedSourceBatch(batch))
    const diagnosticsBySourceKey = new Map(
      filteredBatches.map((batch) => [batch.diagnostics.sourceKey, batch.diagnostics] as const),
    )
    const { candidates, duplicateKeysBySource } = dedupeImportedCandidates(filteredBatches)

    for (const [sourceKey, duplicateCount] of duplicateKeysBySource.entries()) {
      const diagnostics = diagnosticsBySourceKey.get(sourceKey)

      if (!diagnostics) {
        continue
      }

      diagnosticsBySourceKey.set(sourceKey, {
        ...diagnostics,
        rowsDeduped: duplicateCount,
      })
    }

    const normalizedJobs = candidates.map((candidate) => candidate.normalizedJob)
    const currentSourceJobIdsBySourceName = new Map<string, string[]>()

    for (const job of normalizedJobs) {
      const sourceJobId = job.sourceJobId ?? ''

      if (!sourceJobId) {
        continue
      }

      currentSourceJobIdsBySourceName.set(job.sourceName, [
        ...(currentSourceJobIdsBySourceName.get(job.sourceName) ?? []),
        sourceJobId,
      ])
    }

    if (normalizedJobs.length === 0) {
      const sourceDiagnostics = [...diagnosticsBySourceKey.values()]
      await saveSourceDiagnostics(sourceDiagnostics)

      return {
        importedCount: 0,
        issue: 'No remote designer-first roles passed the source expansion gate.',
        sourceDiagnostics,
      }
    }

    const supabase = createClient()
    const ingestedAt = new Date().toISOString()
    const baseRows = normalizedJobs.map((job) => ({
      application_url: job.applicationUrl ?? null,
      company_domain: job.companyDomain ?? null,
      company_name: job.companyName,
      department: job.department ?? null,
      description_text: job.descriptionText,
      duplicate_group_key: job.duplicateGroupKey ?? null,
      employment_type: job.employmentType,
      ingested_at: ingestedAt,
      listing_status: job.listingStatus,
      location_label: job.locationLabel ?? null,
      portfolio_required: job.portfolioRequired,
      posted_at: job.postedAt ?? null,
      preferred_qualifications: job.preferredQualifications,
      red_flag_notes: job.redFlagNotes,
      remote_regions: job.remoteRegions,
      remote_type: job.remoteType,
      requirements: job.requirements,
      salary_currency: job.salaryCurrency ?? null,
      salary_max: job.salaryMax ?? null,
      salary_min: job.salaryMin ?? null,
      salary_period: job.salaryPeriod,
      seniority_label: job.seniorityLabel ?? null,
      skills_keywords: job.skillsKeywords,
      source_job_id: job.sourceJobId ?? null,
      source_name: job.sourceName,
      source_url: job.sourceUrl,
      title: job.title,
      work_auth_notes: job.workAuthNotes ?? null,
    }))
    const sourceNames = Array.from(new Set(normalizedJobs.map((job) => job.sourceName)))
    const sourceIdentitySet = new Set(
      normalizedJobs
        .map((job) => {
          const sourceJobId = job.sourceJobId ?? ''
          return sourceJobId ? createSourceIdentityKey(job.sourceName, sourceJobId) : ''
        })
        .filter(Boolean),
    )

    const { data: existingJobs, error: existingJobsError } = await supabase
      .from('jobs')
      .select('id, source_job_id, source_name')
      .in('source_name', sourceNames)

    if (existingJobsError) {
      return {
        importedCount: 0,
        issue: existingJobsError.message,
        sourceDiagnostics: [...diagnosticsBySourceKey.values()],
      }
    }

    const existingJobIdBySourceId = new Map(
      (existingJobs ?? [])
        .map((row) => [
          createSourceIdentityKey(asString(row.source_name), asString(row.source_job_id)),
          asString(row.id),
        ] as const)
        .filter((entry) => entry[0] && sourceIdentitySet.has(entry[0]) && entry[1]),
    )
    const rowsToInsert = baseRows.filter((row) => {
      const sourceJobId = asString(row.source_job_id)
      return !existingJobIdBySourceId.has(createSourceIdentityKey(row.source_name, sourceJobId))
    })
    const rowsToUpdate = baseRows
      .filter((row) => {
        const sourceJobId = asString(row.source_job_id)
        return existingJobIdBySourceId.has(createSourceIdentityKey(row.source_name, sourceJobId))
      })
      .map((row) => ({
        ...row,
        id: existingJobIdBySourceId.get(
          createSourceIdentityKey(row.source_name, asString(row.source_job_id)),
        ),
      }))

    const persistedJobs: Array<{ id: string; source_job_id: string; source_name: string }> = []

    if (rowsToInsert.length > 0) {
      const { data: insertedJobs, error: insertJobsError } = await supabase
        .from('jobs')
        .insert(rowsToInsert)
        .select('id, source_job_id, source_name')

      if (insertJobsError || !insertedJobs) {
        return {
          importedCount: 0,
          issue: insertJobsError?.message ?? 'Imported jobs could not be inserted.',
          sourceDiagnostics: [...diagnosticsBySourceKey.values()],
        }
      }

      persistedJobs.push(
        ...insertedJobs.map((row) => ({
          id: asString(row.id),
          source_job_id: asString(row.source_job_id),
          source_name: asString(row.source_name),
        })),
      )
    }

    if (rowsToUpdate.length > 0) {
      const { data: updatedJobs, error: updateJobsError } = await supabase
        .from('jobs')
        .upsert(rowsToUpdate, {
          onConflict: 'id',
        })
        .select('id, source_job_id, source_name')

      if (updateJobsError || !updatedJobs) {
        return {
          importedCount: 0,
          issue: updateJobsError?.message ?? 'Imported jobs could not be updated.',
          sourceDiagnostics: [...diagnosticsBySourceKey.values()],
        }
      }

      persistedJobs.push(
        ...updatedJobs.map((row) => ({
          id: asString(row.id),
          source_job_id: asString(row.source_job_id),
          source_name: asString(row.source_name),
        })),
      )
    }

    const jobIdBySourceId = new Map(
      persistedJobs
        .map((row) => [
          createSourceIdentityKey(row.source_name, row.source_job_id),
          row.id,
        ] as const)
        .filter((entry) => entry[0] && entry[1]),
    )
    const persistedJobIds = [...jobIdBySourceId.values()]
    const { data: existingScores, error: scoreLookupError } = await supabase
      .from('job_scores')
      .select('job_id, workflow_status, last_status_changed_at')
      .eq('user_id', defaultOperator.userId)
      .in('job_id', persistedJobIds)

    if (scoreLookupError) {
      return {
        importedCount: 0,
        issue: scoreLookupError.message,
      }
    }

    const existingScoreMap = new Map(
      (existingScores ?? []).map((row) => [
        asString(row.job_id),
        {
          lastStatusChangedAt: asString(row.last_status_changed_at) || null,
          workflowStatus: asString(row.workflow_status) as WorkflowStatus,
        },
      ]),
    )
    const scoreRows = normalizedJobs
      .map((job) => {
        const sourceJobId = job.sourceJobId ?? ''
        const jobId = sourceJobId
          ? jobIdBySourceId.get(createSourceIdentityKey(job.sourceName, sourceJobId))
          : undefined

        if (!jobId) {
          return null
        }

        const score = buildBasicScore(job, workspace.profile)
        const existingScore = existingScoreMap.get(jobId)

        return {
          effort_score: score.effortScore,
          fit_reasons: score.fitReasons,
          fit_summary: score.fitSummary,
          job_id: jobId,
          last_status_changed_at: existingScore?.lastStatusChangedAt ?? ingestedAt,
          missing_requirements: score.missingRequirements,
          penalty_score: score.penaltyScore,
          portfolio_fit_score: score.portfolioFitScore,
          profile_id: workspace.profile.profileId,
          quality_score: score.qualityScore,
          recommendation_level: score.recommendationLevel,
          red_flags: score.redFlags,
          remote_gate_passed: score.remoteGatePassed,
          role_relevance_score: score.roleRelevanceScore,
          salary_score: score.salaryScore,
          scam_risk_level: score.scamRiskLevel,
          scored_at: ingestedAt,
          seniority_score: score.seniorityScore,
          total_score: score.totalScore,
          user_id: defaultOperator.userId,
          workflow_status: existingScore?.workflowStatus ?? 'ranked',
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    const { error: scoreUpsertError } = await supabase.from('job_scores').upsert(scoreRows, {
      onConflict: 'user_id,job_id',
    })

    if (scoreUpsertError) {
      return {
        importedCount: 0,
        issue: scoreUpsertError.message,
        sourceDiagnostics: [...diagnosticsBySourceKey.values()],
      }
    }

    for (const diagnostics of diagnosticsBySourceKey.values()) {
      diagnostics.rowsImported = normalizedJobs.filter((job) => job.sourceName === diagnostics.sourceName).length
    }

    let staleCount = 0
    let staleIssue: string | undefined

    if (options.markMissingAsStale) {
      const staleResult = await markMissingImportedJobsAsStale(
        currentSourceJobIdsBySourceName,
        importedSourceNames,
        diagnosticsBySourceKey,
      )
      staleCount = staleResult.staleCount ?? 0
      staleIssue = staleResult.issue
    }

    const sourceDiagnostics = [...diagnosticsBySourceKey.values()]
    await saveSourceDiagnostics(sourceDiagnostics)
    const sourceIssues = sourceDiagnostics
      .filter((entry) => entry.issue)
      .map((entry) => `${entry.sourceName}: ${entry.issue}`)
    const issue = [staleIssue, ...sourceIssues].filter(Boolean).join(' · ') || undefined

    return {
      importedCount: scoreRows.length,
      issue,
      sourceDiagnostics,
      staleCount,
    }
  } catch (error) {
    return {
      importedCount: 0,
      issue: error instanceof Error ? error.message : 'Imported-job bootstrap failed.',
    }
  }
}
