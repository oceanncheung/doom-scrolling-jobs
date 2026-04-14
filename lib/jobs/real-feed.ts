import 'server-only'

import { createHash } from 'node:crypto'

import { getActiveOperatorContext } from '@/lib/data/operators'
import type {
  MatchingPreferencesRecord,
  OperatorWorkspaceRecord,
  RecommendationLevel,
  RemoteType,
  WorkflowStatus,
} from '@/lib/domain/types'
import type {
  JobSourceKind,
  NormalizedJobRecord,
  PortfolioRequirement,
  RawJobIntakeRecord,
  SourceDiagnostics,
} from '@/lib/jobs/contracts'
import { fetchAuthenticJobs } from '@/lib/jobs/authentic-jobs'
import { fetchAshbyCompanyJobs } from '@/lib/jobs/ashby'
import { fetchWithTimeout } from '@/lib/jobs/fetch-with-timeout'
import { fetchGreenhouseCompanyJobs, type ImportedSourceBatch } from '@/lib/jobs/greenhouse'
import { fetchJobspressoJobs } from '@/lib/jobs/jobspresso'
import { fetchLeverCompanyJobs } from '@/lib/jobs/lever'
import { buildRemoteSourceJobUrl, fetchRemoteSourceJobs } from '@/lib/jobs/remote-source'
import { fetchRemotiveJobs } from '@/lib/jobs/remotive'
import { syncJobReviewCopy } from '@/lib/jobs/job-review-copy'
import { getEffectiveSalaryBounds } from '@/lib/jobs/salary-estimation'
import {
  buildSourceDescriptorBySourceName,
  getCompanyWatchlist,
  getImportedSourceNames,
  getSourceRegistry,
  getSourceRegistryBySlug,
  saveSourceDiagnostics,
  sourcePreferenceWeight,
  type SourceRegistryEntry,
} from '@/lib/jobs/source-registry'
import { fetchWellfoundJobs } from '@/lib/jobs/wellfound'
import { fetchWeWorkRemotelyJobs } from '@/lib/jobs/we-work-remotely'
import { defaultMatchingPreferences } from '@/lib/profile/matching-preferences'
import { getTargetSeniorityLevels } from '@/lib/profile/seniority-level'
import { createClient } from '@/lib/supabase/server'

import { getOperatorProfile } from '../data/operator-profile'

export const primaryImportedSourceName = 'Remote OK'
const primaryImportedSourceApiUrl = 'https://remoteok.com/api'
const maxJobReviewCopySyncPerPass = 4
const maxImportedJobsPerBoardSource = 240
const maxWatchedCompanies = 60
const minimumHealthyCandidatePool = 40

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
  {
    bucket: 'adjacent',
    descriptionPhrases: ['digital design', 'email design', 'social creative'],
    familyLabel: 'digital design',
    titlePhrases: ['digital designer', 'digital design'],
    titleTokenGroups: [['digital', 'designer'], ['digital', 'design']],
  },
  {
    bucket: 'adjacent',
    descriptionPhrases: ['motion design', 'motion graphics', 'animation design'],
    familyLabel: 'motion design',
    titlePhrases: ['motion designer', 'motion design', 'motion graphics designer'],
    titleTokenGroups: [
      ['motion', 'designer'],
      ['motion', 'design'],
      ['motion', 'graphics'],
    ],
  },
  {
    bucket: 'adjacent',
    descriptionPhrases: ['art direction', 'creative direction', 'integrated design'],
    familyLabel: 'art direction',
    titlePhrases: [
      'art director',
      'associate creative director',
      'creative designer',
      'creative director',
      'creative lead',
      'creative manager',
      'creative strategist',
      'head of creative',
      'head of creative studio',
      'integrated designer',
      'marketing creative strategist',
      'senior creative manager',
    ],
    titleTokenGroups: [
      ['art', 'director'],
      ['associate', 'creative', 'director'],
      ['creative', 'designer'],
      ['creative', 'director'],
      ['creative', 'lead'],
      ['creative', 'manager'],
      ['creative', 'strategist'],
      ['head', 'creative'],
      ['head', 'creative', 'studio'],
      ['integrated', 'designer'],
      ['marketing', 'creative', 'strategist'],
      ['senior', 'creative', 'manager'],
    ],
  },
  {
    bucket: 'adjacent',
    descriptionPhrases: [
      'brand leadership',
      'creative leadership',
      'design leadership',
      'brand marketing',
      'performance marketing',
    ],
    familyLabel: 'design leadership',
    titlePhrases: [
      'brand design lead',
      'brand design manager',
      'brand director',
      'design lead',
      'design manager',
      'director of brand marketing',
      'head of brand',
      'visual design lead',
    ],
    titleTokenGroups: [
      ['brand', 'design', 'lead'],
      ['brand', 'design', 'manager'],
      ['brand', 'director'],
      ['design', 'lead'],
      ['design', 'manager'],
      ['director', 'brand', 'marketing'],
      ['head', 'brand'],
      ['visual', 'design', 'lead'],
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
  'engineer',
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
  'instructional designer',
  'instructional design',
  'translator',
  'localization',
  'accessibility specialist',
  'accessibility',
  'architect',
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

interface PersistedImportedJobRow {
  id: string
  normalizedJob: NormalizedJobRecord
}

interface ExistingJobScoreSnapshot {
  aiDescriptionExcerpt?: string
  aiMatchSummary?: string
  aiSummaryError?: string
  aiSummaryGeneratedAt?: string | null
  aiSummaryModel?: string
  aiSummaryStatus: 'failed' | 'generated' | 'not_started'
  id: string
  lastStatusChangedAt: string | null
  workflowStatus: WorkflowStatus
}

function getMatchingPreferences(workspace?: OperatorWorkspaceRecord): MatchingPreferencesRecord {
  return workspace?.profile.matchingPreferences ?? defaultMatchingPreferences
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

function asOptionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
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

function matchesWorkspaceRoleSignal(title: string, workspace: OperatorWorkspaceRecord) {
  const normalizedTitle = normalizeSearchText(title)
  const roleSignals = getWorkspaceRoleSignals(workspace)
  const preferredRoles = [
    ...roleSignals.explicitTargets,
    ...roleSignals.adjacent,
    ...roleSignals.resumeDrivenTargets,
  ]
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)

  return preferredRoles.find((role) => matchesPhrase(normalizedTitle, role)) ?? null
}

function getDesignerRoleMatch(
  title: string,
  descriptionText: string,
  workspace?: OperatorWorkspaceRecord,
) {
  const workspaceRoleMatch = workspace ? matchesWorkspaceRoleSignal(title, workspace) : null

  if (workspaceRoleMatch) {
    return {
      bucket: 'core',
      familyLabel: workspaceRoleMatch,
      matchedBy: 'title',
    } satisfies DesignerRoleMatch
  }

  const titleMatch = findRoleFamilyMatch(title, 'title')

  if (titleMatch) {
    return titleMatch
  }

  if (!hasGenericDesignTitleSignal(title)) {
    return null
  }

  return findRoleFamilyMatch(descriptionText, 'description')
}

function isDesignCandidate(
  title: string,
  descriptionText: string,
  workspace?: OperatorWorkspaceRecord,
) {
  if (getExcludedTitleTerm(title)) {
    return false
  }

  return getDesignerRoleMatch(title, descriptionText, workspace) !== null
}

function buildDesignSignalText(job: Pick<NormalizedJobRecord, 'department' | 'descriptionText' | 'skillsKeywords' | 'title'>) {
  return [
    job.descriptionText,
    job.department ?? '',
    ...job.skillsKeywords,
  ]
    .filter(Boolean)
    .join(' ')
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

const extractedSkillPhrases = [
  'brand design',
  'visual design',
  'graphic design',
  'presentation design',
  'marketing design',
  'production design',
  'web design',
  'art direction',
  'creative direction',
  'editorial design',
  'campaign design',
  'motion design',
  'motion graphics',
  'typography',
  'layout design',
  'visual storytelling',
  'design systems',
  'landing pages',
  'social creative',
  'figma',
  'adobe creative suite',
  'photoshop',
  'illustrator',
  'indesign',
  'after effects',
  'powerpoint',
  'google slides',
]

function extractImportedSkillKeywords(
  title: string,
  descriptionText: string,
  metadata: Record<string, unknown> | null,
) {
  const searchText = normalizeSearchText([title, descriptionText].join(' '))
  const extracted = new Set<string>()
  const tags = asStringArray(metadata?.tags)
  const category = asString(metadata?.category)

  for (const tag of tags) {
    const normalizedTag = normalizeWhitespace(tag)

    if (normalizedTag) {
      extracted.add(normalizedTag)
    }
  }

  if (category) {
    extracted.add(category)
  }

  for (const phrase of extractedSkillPhrases) {
    if (matchesPhrase(searchText, phrase)) {
      extracted.add(phrase)
    }
  }

  const designerRoleMatch = getDesignerRoleMatch(title, descriptionText)

  if (designerRoleMatch) {
    extracted.add(designerRoleMatch.familyLabel)
  }

  return [...extracted].slice(0, 12)
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

function normalizePersistedImportedJobRow(
  value: unknown,
  sourceDescriptorBySourceName?: Map<
    string,
    Pick<SourceDiagnostics, 'provider' | 'sourceKey' | 'sourceKind' | 'sourceName'>
  >,
): PersistedImportedJobRow | null {
  const record = asRecord(value)

  if (!record) {
    return null
  }

  const id = asString(record.id)
  const sourceName = asString(record.source_name)
  const sourceJobId = asString(record.source_job_id) || undefined
  const sourceUrl =
    sourceName === 'Remote Source'
      ? buildRemoteSourceJobUrl({
          sourceJobId,
          sourceUrl: asString(record.source_url),
        })
      : asString(record.source_url)
  const sourceKind = sourceDescriptorBySourceName?.get(sourceName)?.sourceKind
  const companyName = asString(record.company_name)
  const title = asString(record.title)

  if (!id || !sourceName || !sourceUrl || !companyName || !title) {
    return null
  }

  return {
    id,
    normalizedJob: {
      applicationUrl: asString(record.application_url) || undefined,
      companyDomain: asString(record.company_domain) || undefined,
      companyName,
      department: asString(record.department) || undefined,
      descriptionText: asString(record.description_text),
      duplicateGroupKey: asString(record.duplicate_group_key) || undefined,
      employmentType: asString(record.employment_type) as NormalizedJobRecord['employmentType'],
      listingStatus: asString(record.listing_status) as NormalizedJobRecord['listingStatus'],
      locationLabel: asString(record.location_label) || undefined,
      portfolioRequired: asString(record.portfolio_required) as NormalizedJobRecord['portfolioRequired'],
      postedAt: asString(record.posted_at) || undefined,
      preferredQualifications: asStringArray(record.preferred_qualifications),
      redFlagNotes: asStringArray(record.red_flag_notes),
      remoteRegions: asStringArray(record.remote_regions),
      remoteType: asString(record.remote_type) as NormalizedJobRecord['remoteType'],
      requirements: asStringArray(record.requirements),
      salaryCurrency: asString(record.salary_currency) || undefined,
      salaryMax: asOptionalNumber(record.salary_max),
      salaryMin: asOptionalNumber(record.salary_min),
      salaryPeriod: asString(record.salary_period) as NormalizedJobRecord['salaryPeriod'],
      seniorityLabel: asString(record.seniority_label) || undefined,
      skillsKeywords: asStringArray(record.skills_keywords),
      sourceJobId,
      sourceKind,
      sourceName,
      sourceUrl,
      title,
      workAuthNotes: asString(record.work_auth_notes) || undefined,
    },
  }
}

function getProfileRolePhrases(values: string[]) {
  return values
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
}

function getWorkspaceRoleSignals(workspace: OperatorWorkspaceRecord) {
  const explicitTargets = getProfileRolePhrases(workspace.profile.targetRoles)
  const explicitAdjacent = getProfileRolePhrases(workspace.profile.allowedAdjacentRoles)
  const resumeDrivenTargets = getProfileRolePhrases([
    workspace.profile.headline,
    workspace.resumeMaster.baseTitle,
    ...workspace.resumeMaster.experienceEntries.map((entry) => entry.roleTitle),
  ]).filter((value) => !explicitTargets.includes(value))
  const adjacentFromPortfolio = getProfileRolePhrases([
    ...workspace.portfolioItems.map((item) => item.roleLabel),
    ...workspace.portfolioItems.map((item) => item.projectType),
  ]).filter((value) => !explicitAdjacent.includes(value))

  return {
    adjacent: [...new Set([...explicitAdjacent, ...adjacentFromPortfolio])],
    explicitTargets,
    resumeDrivenTargets: [...new Set(resumeDrivenTargets)],
  }
}

function getWorkspaceSkillPhrases(workspace: OperatorWorkspaceRecord) {
  return [
    ...new Set(
      [
        ...workspace.resumeMaster.skillsSection,
        ...workspace.profile.skills,
        ...workspace.profile.tools,
        ...workspace.portfolioItems.flatMap((item) => item.skillsTags),
      ]
        .map((value) => normalizeWhitespace(value))
        .filter((value) => value.length >= 3),
    ),
  ].slice(0, 24)
}

function getResumeSignalBoost(
  title: string,
  descriptionText: string,
  workspace: OperatorWorkspaceRecord,
) {
  const normalizedText = normalizeSearchText([title, descriptionText].join(' '))
  const matchedSkills = getWorkspaceSkillPhrases(workspace).filter((phrase) =>
    matchesPhrase(normalizedText, phrase),
  )

  if (matchedSkills.length === 0) {
    return {
      reason: '',
      score: 0,
    }
  }

  return {
    reason: `Resume and portfolio skills overlap with ${matchedSkills.slice(0, 2).join(', ')}.`,
    score: Math.min(3, matchedSkills.length * 1.2),
  }
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
  const salaryCurrency = asString(metadata?.salary_currency) || (salaryMin > 0 || salaryMax > 0 ? 'USD' : '')
  const salaryPeriod = asString(metadata?.salary_period) || (salaryMin > 0 || salaryMax > 0 ? 'annual' : 'unknown')
  const employmentContext = [rawJob.descriptionText, asString(metadata?.job_type)].filter(Boolean).join(' ')

  return {
    applicationUrl: rawJob.applicationUrl || undefined,
    companyDomain: undefined,
    companyName,
    department: departments[0] || asString(metadata?.category) || undefined,
    descriptionText: rawJob.descriptionText,
    duplicateGroupKey: createDuplicateGroupKey(companyName, title, locationLabel),
    employmentType: inferEmploymentType(title, employmentContext),
    listingStatus: 'active',
    locationLabel,
    portfolioRequired: inferPortfolioRequirement(title, rawJob.descriptionText),
    postedAt: parsePostedAt(rawJob.postedAtRaw ?? ''),
    preferredQualifications: [],
    redFlagNotes: [],
    remoteRegions: normalizeRemoteRegions(location, remoteType),
    remoteType,
    requirements: [],
    salaryCurrency: salaryCurrency || undefined,
    salaryMax: salaryMax > 0 ? salaryMax : undefined,
    salaryMin: salaryMin > 0 ? salaryMin : undefined,
    salaryPeriod: salaryPeriod as NormalizedJobRecord['salaryPeriod'],
    seniorityLabel: inferSeniorityLabel(title),
    skillsKeywords: extractImportedSkillKeywords(title, rawJob.descriptionText, metadata),
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
    rowsNormalized: 0,
    rowsQualified: 0,
    rowsSeen: batch.rowsSeen,
    rowsStale: 0,
    rowsVisible: 0,
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
    const designSignalText = buildDesignSignalText(normalizedJob)

    if (normalizedJob.remoteType !== 'remote') {
      diagnostics.rowsExcluded += 1
      continue
    }

    if (!isDesignCandidate(normalizedJob.title, designSignalText)) {
      diagnostics.rowsExcluded += 1
      continue
    }

    diagnostics.rowsCandidate += 1
    diagnostics.rowsNormalized += 1
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
    sourcePreferenceWeight(candidate.sourceKind, 'balanced') * 1000 +
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
  workspace: OperatorWorkspaceRecord,
) {
  const matchingPreferences = getMatchingPreferences(workspace)
  const normalizedTitle = normalizeToken(title)
  const roleSignals = getWorkspaceRoleSignals(workspace)
  const targetRoles = roleSignals.explicitTargets
  const adjacentRoles = roleSignals.adjacent
  const resumeRoles = roleSignals.resumeDrivenTargets
  const designerRoleMatch = getDesignerRoleMatch(title, descriptionText)
  const exactTargetMatch = targetRoles.find((role) => normalizedTitle.includes(normalizeToken(role)))
  const exactAdjacentMatch = adjacentRoles.find((role) => normalizedTitle.includes(normalizeToken(role)))
  const resumeRoleMatch = resumeRoles.find((role) => normalizedTitle.includes(normalizeToken(role)))
  const resumeSignal = getResumeSignalBoost(title, descriptionText, workspace)

  if (exactTargetMatch) {
    return {
      matchingRole: exactTargetMatch,
      score: Math.min(21, 18 + resumeSignal.score),
      supportingReason: resumeSignal.reason,
    }
  }

  if (resumeRoleMatch) {
    return {
      matchingRole: resumeRoleMatch,
      score: Math.min(20, 16 + resumeSignal.score),
      supportingReason: resumeSignal.reason,
    }
  }

  if (exactAdjacentMatch) {
    return {
      matchingRole: exactAdjacentMatch,
      score: Math.min(17, 13 + resumeSignal.score),
      supportingReason: resumeSignal.reason,
    }
  }

  if (designerRoleMatch) {
    if (matchingPreferences.roleBreadth === 'tight' && designerRoleMatch.bucket !== 'core') {
      return {
        matchingRole: '',
        score: Math.min(7, 4 + resumeSignal.score),
        supportingReason:
          resumeSignal.reason ||
          'Tight role breadth de-prioritizes adjacent creative families unless they are explicitly saved.',
      }
    }

    const baseScore =
      designerRoleMatch.bucket === 'core'
        ? designerRoleMatch.matchedBy === 'title'
          ? 17
          : 15.5
        : matchingPreferences.roleBreadth === 'broad'
          ? designerRoleMatch.matchedBy === 'title'
            ? 14.5
            : 13
          : designerRoleMatch.matchedBy === 'title'
            ? 13
            : 11.5

    return {
      matchingRole: `${designerRoleMatch.bucket} role family: ${designerRoleMatch.familyLabel}`,
      score: Math.min(20, baseScore + resumeSignal.score),
      supportingReason: resumeSignal.reason,
    }
  }

  if (
    matchingPreferences.roleBreadth === 'broad' &&
    hasGenericDesignTitleSignal(title) &&
    resumeSignal.score > 0
  ) {
    return {
      matchingRole: 'broad design-title signal',
      score: Math.min(12, 9 + resumeSignal.score),
      supportingReason:
        resumeSignal.reason ||
        'A generic design title stayed in play because other profile signals still overlap.',
    }
  }

  return {
    matchingRole: '',
    score: Math.min(8, 4 + resumeSignal.score),
    supportingReason: resumeSignal.reason,
  }
}

function getSalaryScore(
  job: NormalizedJobRecord,
  profile: Awaited<ReturnType<typeof getOperatorProfile>>['workspace']['profile'],
) {
  const salary = getEffectiveSalaryBounds(job, profile)

  if (!salary.min && !salary.max) {
    return {
      note: 'Salary was not listed in the source feed.',
      score: 8,
    }
  }

  const salaryTarget = getProfileTargetAmount(profile)
  const salaryFloor = salary.min ?? salary.max ?? 0
  const salaryCeiling = salary.max ?? salary.min ?? 0

  if (!salaryTarget) {
    return {
      note: salary.estimated
        ? 'Estimated compensation is available, even though no user floor is set yet.'
        : 'Salary is listed, even though no user floor is set yet.',
      score: salary.estimated ? 11 : 15,
    }
  }

  if (salaryFloor >= salaryTarget) {
    return {
      note: salary.estimated
        ? 'Estimated compensation clears the current salary target.'
        : 'Listed compensation clears the current salary target.',
      score: salary.estimated ? 16 : 22,
    }
  }

  if (salaryCeiling >= salaryTarget) {
    return {
      note: salary.estimated
        ? 'Estimated top-end compensation reaches the current salary target.'
        : 'Top-end compensation reaches the current salary target.',
      score: salary.estimated ? 12 : 17,
    }
  }

  return {
    note: salary.estimated
      ? 'Estimated compensation sits below the current salary target.'
      : 'Listed compensation sits below the current salary target.',
    score: salary.estimated ? 4 : 6,
  }
}

function getSourceMixAdjustment(
  sourceKind: JobSourceKind,
  matchingPreferences: MatchingPreferencesRecord,
) {
  if (matchingPreferences.sourceMix === 'ats_first') {
    if (sourceKind === 'company_career_page') {
      return 2
    }

    if (sourceKind === 'ats_hosted_job_page') {
      return 1
    }

    return -1
  }

  if (matchingPreferences.sourceMix === 'discovery') {
    if (sourceKind === 'remote_board') {
      return 2
    }

    if (sourceKind === 'company_career_page') {
      return -1
    }
  }

  return 0
}

function getQualityScore(
  job: NormalizedJobRecord,
  matchingPreferences: MatchingPreferencesRecord,
) {
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

  score += getSourceMixAdjustment(job.sourceKind ?? 'remote_board', matchingPreferences)

  return clamp(score, 0, 35)
}

function getSeniorityScore(
  job: NormalizedJobRecord,
  profile: Awaited<ReturnType<typeof getOperatorProfile>>['workspace']['profile'],
) {
  const actual = normalizeToken(job.seniorityLabel ?? '')
  const desiredLevels = getTargetSeniorityLevels(
    profile.targetSeniorityLevels,
    profile.seniorityLevel,
  ).map((value) => normalizeToken(value))

  if (desiredLevels.length === 0 || !actual) {
    return 6
  }

  const scores = desiredLevels.map((desired) => {
    if (desired.includes('lead') && actual.includes('lead')) {
      return 8.5
    }

    if (desired.includes('staff') && actual.includes('staff')) {
      return 8
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
  })

  return Math.max(...scores, 5)
}

function normalizeAiSummaryStatus(value: unknown): 'failed' | 'generated' | 'not_started' {
  const text = asString(value)

  return text === 'generated' || text === 'failed' ? text : 'not_started'
}

function normalizeAiSummaryGeneratedAt(value: unknown) {
  const text = asString(value)

  return text || null
}

function normalizeAiSummaryText(value: unknown) {
  const text = asString(value)

  return text || undefined
}

function normalizeAiSummaryModel(value: unknown) {
  const text = asString(value)

  return text || undefined
}

function normalizeAiSummaryError(value: unknown) {
  const text = asString(value)

  return text || undefined
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
  workspace: OperatorWorkspaceRecord,
): BasicScoreResult {
  const { profile } = workspace
  const matchingPreferences = getMatchingPreferences(workspace)
  const remoteGatePassed = !profile.remoteRequired || job.remoteType === 'remote'
  const designSignalText = buildDesignSignalText(job)
  const roleMatch = getRoleRelevanceScore(job.title, designSignalText, workspace)
  const designerRoleMatch = getDesignerRoleMatch(job.title, designSignalText)
  const salaryResult = getSalaryScore(job, profile)
  const qualityScore = getQualityScore(job, matchingPreferences)
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
    roleMatch.supportingReason,
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
    const response = await fetchWithTimeout(primaryImportedSourceApiUrl, {
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
    const rawJobs = allRawJobs.slice(0, maxImportedJobsPerBoardSource)

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

async function getImportedSourceContext() {
  const [registry, watchlist] = await Promise.all([getSourceRegistry(), getCompanyWatchlist()])

  return {
    importedSourceNames: getImportedSourceNames(registry, watchlist),
    registry,
    sourceDescriptorBySourceName: buildSourceDescriptorBySourceName(registry, watchlist),
    watchlist,
  }
}

async function fetchImportedSourceBatches(
  registry: SourceRegistryEntry[],
  watchlist: Awaited<ReturnType<typeof getCompanyWatchlist>>,
) {
  const registryBySlug = getSourceRegistryBySlug(registry)
  const remoteRegistryEntry = registry.find((entry) => entry.slug === 'remote-ok')
  const remotiveRegistryEntry = registry.find((entry) => entry.slug === 'remotive')
  const wellfoundRegistryEntry = registry.find((entry) => entry.slug === 'wellfound')
  const jobspressoRegistryEntry = registry.find((entry) => entry.slug === 'jobspresso')
  const weWorkRemotelyRegistryEntry = registry.find((entry) => entry.slug === 'we-work-remotely')
  const authenticJobsRegistryEntry = registry.find((entry) => entry.slug === 'authentic-jobs')
  const remoteSourceRegistryEntry = registry.find((entry) => entry.slug === 'remote-source')
  const atsWatchlist = watchlist
    .filter((entry) => {
      const registryEntry = registryBySlug.get(entry.sourceRegistrySlug)
      return registryEntry?.sourceKind === 'ats_hosted_job_page'
    })
    .slice(0, maxWatchedCompanies)

  const [
    remoteOkBatch,
    remotiveBatch,
    wellfoundBatch,
    jobspressoBatch,
    weWorkRemotelyBatch,
    authenticJobsBatch,
    remoteSourceBatch,
    atsBatches,
  ] = await Promise.all([
    fetchRemoteOkBatch(remoteRegistryEntry),
    remotiveRegistryEntry ? fetchRemotiveJobs() : Promise.resolve(null),
    wellfoundRegistryEntry ? fetchWellfoundJobs() : Promise.resolve(null),
    jobspressoRegistryEntry ? fetchJobspressoJobs() : Promise.resolve(null),
    weWorkRemotelyRegistryEntry ? fetchWeWorkRemotelyJobs() : Promise.resolve(null),
    authenticJobsRegistryEntry ? fetchAuthenticJobs() : Promise.resolve(null),
    remoteSourceRegistryEntry ? fetchRemoteSourceJobs() : Promise.resolve(null),
    Promise.all(
      atsWatchlist.map((entry) => {
        const registryEntry = registryBySlug.get(entry.sourceRegistrySlug)

        switch (registryEntry?.provider) {
          case 'ashby':
            return fetchAshbyCompanyJobs(entry)
          case 'lever':
            return fetchLeverCompanyJobs(entry)
          default:
            return fetchGreenhouseCompanyJobs(entry)
        }
      }),
    ),
  ])
  const batches = [
    remoteOkBatch,
    remotiveBatch,
    wellfoundBatch,
    jobspressoBatch,
    weWorkRemotelyBatch,
    authenticJobsBatch,
    remoteSourceBatch,
    ...atsBatches,
  ].filter((batch): batch is ImportedSourceBatch => batch !== null)
  const successfulSourceNames = new Set(
    batches.filter((batch) => !batch.issue).map((batch) => batch.sourceName),
  )

  return {
    batches,
    importedSourceNames: successfulSourceNames.size > 0 ? successfulSourceNames : getImportedSourceNames(registry, watchlist),
  }
}

async function hasImportedScores(operatorId: string, importedSourceNames: Set<string>) {
  const supabase = createClient()
  const sourceNames = [...importedSourceNames].filter(Boolean)

  if (sourceNames.length === 0) {
    return {
      count: 0,
      ready: false,
    }
  }

  const { data, error } = await supabase
    .from('job_scores')
    .select(
      `
        id,
        jobs!inner (
          source_name
        )
      `,
    )
    .eq('operator_id', operatorId)
    .in('jobs.source_name', sourceNames)

  if (error) {
    return {
      count: 0,
      ready: false,
    }
  }

  const rows = data ?? []
  const { data: diagnostics } = await supabase
    .from('source_sync_diagnostics')
    .select('source_name')
    .in('source_name', sourceNames)
  const diagnosticsSourceNames = new Set(
    ((diagnostics as Array<Record<string, unknown>> | null) ?? [])
      .map((row) => asString(row.source_name))
      .filter(Boolean),
  )
  const missingDiagnostics = sourceNames.filter((sourceName) => !diagnosticsSourceNames.has(sourceName))

  return {
    count: rows.length,
    ready: rows.length >= minimumHealthyCandidatePool && missingDiagnostics.length === 0,
  }
}

async function persistRawImports(batches: ImportedSourceBatch[]) {
  const rows = batches.flatMap((batch) =>
    batch.rawJobs.map((job) => ({
      application_url: job.applicationUrl ?? null,
      captured_at: job.capturedAt,
      company_name_raw: job.companyNameRaw,
      compensation_raw: job.compensationRaw ?? null,
      description_text: job.descriptionText,
      location_raw: job.locationRaw ?? null,
      posted_at_raw: job.postedAtRaw ?? null,
      raw_metadata: asRecord(job.metadata) ?? {},
      source_identity_key:
        job.sourceJobId && job.sourceJobId.length > 0
          ? `${job.sourceName}::${job.sourceJobId}`
          : normalizeSourceUrl(job.sourceUrl),
      source_job_id: job.sourceJobId ?? null,
      source_key: job.sourceKey ?? null,
      source_kind: job.sourceKind ?? 'remote_board',
      source_name: job.sourceName,
      source_url: job.sourceUrl,
      title_raw: job.titleRaw,
    })),
  )

  if (rows.length === 0) {
    return undefined
  }

  try {
    const supabase = createClient()
    const { error } = await supabase.from('raw_job_imports').upsert(rows, {
      onConflict: 'source_identity_key',
    })

    return error?.message
  } catch {
    return 'Raw job intake rows could not be persisted.'
  }
}

async function loadPersistedImportedPool(
  importedSourceNames: Set<string>,
  sourceDescriptorBySourceName: Map<
    string,
    Pick<SourceDiagnostics, 'provider' | 'sourceKey' | 'sourceKind' | 'sourceName'>
  >,
) {
  const supabase = createClient()
  const poolSourceNames = [...importedSourceNames].filter(Boolean)
  const { data: persistedImportedJobs, error: persistedJobsError } = await supabase
    .from('jobs')
    .select(
      `
        id,
        source_name,
        source_job_id,
        source_url,
        application_url,
        company_name,
        company_domain,
        title,
        department,
        employment_type,
        location_label,
        remote_type,
        remote_regions,
        salary_currency,
        salary_min,
        salary_max,
        salary_period,
        posted_at,
        description_text,
        requirements,
        preferred_qualifications,
        skills_keywords,
        seniority_label,
        portfolio_required,
        work_auth_notes,
        duplicate_group_key,
        listing_status,
        red_flag_notes
      `,
    )
    .in('source_name', poolSourceNames)
    .neq('listing_status', 'closed')
    .neq('listing_status', 'stale')

  if (persistedJobsError || !persistedImportedJobs) {
    return {
      issue: persistedJobsError?.message ?? 'Persisted imported jobs could not be loaded.',
      persistedPool: [] as PersistedImportedJobRow[],
    }
  }

  return {
    persistedPool: persistedImportedJobs
      .map((row) => normalizePersistedImportedJobRow(row, sourceDescriptorBySourceName))
      .filter((row): row is PersistedImportedJobRow => row !== null),
  }
}

function buildExistingScoreMap(existingScores: Array<Record<string, unknown>> | null) {
  return new Map<string, ExistingJobScoreSnapshot>(
    (existingScores ?? []).map((row) => [
      asString(row.job_id),
      {
        aiDescriptionExcerpt: normalizeAiSummaryText(row.ai_description_excerpt),
        aiMatchSummary: normalizeAiSummaryText(row.ai_match_summary),
        aiSummaryError: normalizeAiSummaryError(row.ai_summary_error),
        aiSummaryGeneratedAt: normalizeAiSummaryGeneratedAt(row.ai_summary_generated_at),
        aiSummaryModel: normalizeAiSummaryModel(row.ai_summary_model),
        aiSummaryStatus: normalizeAiSummaryStatus(row.ai_summary_status),
        id: asString(row.id),
        lastStatusChangedAt: asString(row.last_status_changed_at) || null,
        workflowStatus: asString(row.workflow_status) as WorkflowStatus,
      },
    ]),
  )
}

async function syncPersistedImportedScoreRows(options: {
  operatorContext: NonNullable<Awaited<ReturnType<typeof getActiveOperatorContext>>>
  persistedPool: PersistedImportedJobRow[]
  workspace: OperatorWorkspaceRecord
}) {
  const { operatorContext, persistedPool, workspace } = options
  const supabase = createClient()
  const persistedJobIds = persistedPool.map((row) => row.id)

  if (persistedJobIds.length === 0) {
    return {
      importedCount: 0,
      issue: 'No remote designer-first roles are available in the candidate pool yet.',
    } satisfies ImportedJobsSyncResult
  }

  const { data: existingScores, error: scoreLookupError } = await supabase
    .from('job_scores')
    .select(
      `
        id,
        job_id,
        workflow_status,
        last_status_changed_at,
        ai_match_summary,
        ai_description_excerpt,
        ai_summary_status,
        ai_summary_model,
        ai_summary_generated_at,
        ai_summary_error
      `,
    )
    .eq('operator_id', operatorContext.operator.id)
    .in('job_id', persistedJobIds)

  if (scoreLookupError) {
    return {
      importedCount: 0,
      issue: scoreLookupError.message,
    } satisfies ImportedJobsSyncResult
  }

  const existingScoreMap = buildExistingScoreMap(
    (existingScores as Array<Record<string, unknown>> | null) ?? null,
  )
  const scoredAt = new Date().toISOString()
  const scoreInputs = persistedPool.map(({ id: jobId, normalizedJob: job }) => {
    const score = buildBasicScore(job, workspace)
    const existingScore = existingScoreMap.get(jobId)

    return {
      existingScore,
      job,
      jobId,
      score,
    }
  })
  const scoreRows = scoreInputs.map(({ existingScore, jobId, score }) => ({
    ai_description_excerpt: existingScore?.aiDescriptionExcerpt ?? null,
    ai_match_summary: existingScore?.aiMatchSummary ?? null,
    ai_summary_error: existingScore?.aiSummaryError ?? null,
    ai_summary_generated_at: existingScore?.aiSummaryGeneratedAt ?? null,
    ai_summary_model: existingScore?.aiSummaryModel ?? null,
    ai_summary_status: existingScore?.aiSummaryStatus ?? 'not_started',
    effort_score: score.effortScore,
    fit_reasons: score.fitReasons,
    fit_summary: score.fitSummary,
    job_id: jobId,
    last_status_changed_at: existingScore?.lastStatusChangedAt ?? scoredAt,
    missing_requirements: score.missingRequirements,
    operator_id: operatorContext.operator.id,
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
    scored_at: scoredAt,
    seniority_score: score.seniorityScore,
    total_score: score.totalScore,
    user_id: operatorContext.userId,
    workflow_status: existingScore?.workflowStatus ?? 'ranked',
  }))

  const { data: upsertedScores, error: scoreUpsertError } = await supabase
    .from('job_scores')
    .upsert(scoreRows, {
      onConflict: 'operator_id,job_id',
    })
    .select('id, job_id')

  if (scoreUpsertError) {
    return {
      importedCount: 0,
      issue: scoreUpsertError.message,
    } satisfies ImportedJobsSyncResult
  }

  const scoreIdByJobId = new Map(
    (upsertedScores ?? []).map((row) => [asString(row.job_id), asString(row.id)]),
  )
  const reviewCopyInputs = scoreInputs
    .filter(
      ({ existingScore }) =>
        !(
          existingScore?.aiSummaryStatus === 'generated' &&
          existingScore.aiMatchSummary &&
          existingScore.aiDescriptionExcerpt
        ),
    )
    .sort((left, right) => right.score.totalScore - left.score.totalScore)
    .slice(0, maxJobReviewCopySyncPerPass)
    .map(({ existingScore, job, jobId, score }) => ({
      existingAiDescriptionExcerpt: existingScore?.aiDescriptionExcerpt,
      existingAiMatchSummary: existingScore?.aiMatchSummary,
      existingAiSummaryStatus: existingScore?.aiSummaryStatus,
      fitReasons: score.fitReasons,
      fitSummary: score.fitSummary,
      job,
      jobScoreId: scoreIdByJobId.get(jobId) ?? existingScore?.id ?? '',
    }))
    .filter((item) => item.jobScoreId.length > 0)

  if (reviewCopyInputs.length > 0) {
    await syncJobReviewCopy(reviewCopyInputs)
  }

  return {
    importedCount: scoreRows.length,
  } satisfies ImportedJobsSyncResult
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
    const operatorContext = await getActiveOperatorContext()

    if (!operatorContext) {
      return {
        importedCount: 0,
        issue: 'Choose an operator before syncing imported jobs.',
      }
    }

    const importedSourceContext = await getImportedSourceContext()
    const existingCoverage = await hasImportedScores(
      operatorContext.operator.id,
      importedSourceContext.importedSourceNames,
    )

    if (!options.force && existingCoverage.ready) {
      return {
        importedCount: existingCoverage.count,
        skipped: true,
      }
    }

    const { batches, importedSourceNames } = await fetchImportedSourceBatches(
      importedSourceContext.registry,
      importedSourceContext.watchlist,
    )
    const { workspace } = await getOperatorProfile()
    const rawImportIssue = await persistRawImports(batches)
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

    const existingJobs =
      sourceNames.length > 0
        ? await supabase
            .from('jobs')
            .select('id, source_job_id, source_name')
            .in('source_name', sourceNames)
        : { data: [], error: null }

    if (existingJobs.error) {
      return {
        importedCount: 0,
        issue: existingJobs.error.message,
        sourceDiagnostics: [...diagnosticsBySourceKey.values()],
      }
    }

    const existingJobIdBySourceId = new Map(
      ((existingJobs.data as Array<Record<string, unknown>> | null) ?? [])
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

    if (rowsToInsert.length > 0) {
      const { error: insertJobsError } = await supabase
        .from('jobs')
        .insert(rowsToInsert)

      if (insertJobsError) {
        return {
          importedCount: 0,
          issue: insertJobsError?.message ?? 'Imported jobs could not be inserted.',
          sourceDiagnostics: [...diagnosticsBySourceKey.values()],
        }
      }
    }

    if (rowsToUpdate.length > 0) {
      const { error: updateJobsError } = await supabase
        .from('jobs')
        .upsert(rowsToUpdate, {
          onConflict: 'id',
        })

      if (updateJobsError) {
        return {
          importedCount: 0,
          issue: updateJobsError?.message ?? 'Imported jobs could not be updated.',
          sourceDiagnostics: [...diagnosticsBySourceKey.values()],
        }
      }
    }

    const persistedPoolResult = await loadPersistedImportedPool(
      importedSourceNames,
      importedSourceContext.sourceDescriptorBySourceName,
    )

    if (persistedPoolResult.issue) {
      return {
        importedCount: 0,
        issue: persistedPoolResult.issue,
        sourceDiagnostics: [...diagnosticsBySourceKey.values()],
      }
    }

    if (persistedPoolResult.persistedPool.length === 0) {
      const sourceDiagnostics = [...diagnosticsBySourceKey.values()]
      const diagnosticsIssue = await saveSourceDiagnostics(sourceDiagnostics)

      return {
        importedCount: 0,
        issue:
          [rawImportIssue, diagnosticsIssue, 'No remote designer-first roles are available in the candidate pool yet.']
            .filter(Boolean)
            .join(' · '),
        sourceDiagnostics,
      }
    }
    const scoreSyncResult = await syncPersistedImportedScoreRows({
      operatorContext,
      persistedPool: persistedPoolResult.persistedPool,
      workspace,
    })

    if (scoreSyncResult.issue) {
      return {
        importedCount: 0,
        issue: scoreSyncResult.issue,
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
    const diagnosticsIssue = await saveSourceDiagnostics(sourceDiagnostics)
    const sourceIssues = sourceDiagnostics
      .filter((entry) => entry.issue)
      .map((entry) => `${entry.sourceName}: ${entry.issue}`)
    const issue = [rawImportIssue, diagnosticsIssue, staleIssue, ...sourceIssues].filter(Boolean).join(' · ') || undefined

    return {
      importedCount: scoreSyncResult.importedCount,
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

export async function rescorePersistedImportedJobs(): Promise<ImportedJobsSyncResult> {
  try {
    const operatorContext = await getActiveOperatorContext()

    if (!operatorContext) {
      return {
        importedCount: 0,
        issue: 'Choose an operator before refreshing imported-job scores.',
      }
    }

    const importedSourceContext = await getImportedSourceContext()
    const { workspace } = await getOperatorProfile()
    const persistedPoolResult = await loadPersistedImportedPool(
      importedSourceContext.importedSourceNames,
      importedSourceContext.sourceDescriptorBySourceName,
    )

    if (persistedPoolResult.issue) {
      return {
        importedCount: 0,
        issue: persistedPoolResult.issue,
      }
    }

    return syncPersistedImportedScoreRows({
      operatorContext,
      persistedPool: persistedPoolResult.persistedPool,
      workspace,
    })
  } catch (error) {
    return {
      importedCount: 0,
      issue: error instanceof Error ? error.message : 'Imported-job score refresh failed.',
    }
  }
}
