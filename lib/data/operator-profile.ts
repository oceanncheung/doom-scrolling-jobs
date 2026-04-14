import 'server-only'

import { defaultOperator } from '@/lib/config/runtime'
import { getActiveOperatorContext } from '@/lib/data/operators'
import type {
  CoverLetterMasterRecord,
  OperatorPortfolioItemRecord,
  OperatorProfileRecord,
  OperatorWorkspaceRecord,
  ResumeMasterRecord
} from '@/lib/domain/types'
import { hasSupabaseServerEnv } from '@/lib/env'
import {
  normalizeCoverLetterMasterRecord,
  normalizeResumeMasterRecord,
} from '@/lib/profile/master-assets'
import { defaultMatchingPreferences, normalizeMatchingPreferences } from '@/lib/profile/matching-preferences'
import { ensureLocationCountryFirst } from '@/lib/profile/location-market'
import { getTargetSeniorityLevels } from '@/lib/profile/seniority-level'
import { deriveProfileWorkspaceStatus } from '@/lib/profile/workspace-status'
import { createClient } from '@/lib/supabase/server'

type ProfileSource = 'seed' | 'database' | 'database-fallback'

export interface OperatorProfileResult {
  issue?: string
  source: ProfileSource
  workspace: OperatorWorkspaceRecord
}

const seededProfile: OperatorProfileRecord = {
  userId: defaultOperator.userId,
  profileId: defaultOperator.profileId,
  updatedAt: undefined,
  displayName: 'Internal Operator',
  email: 'internal@doomscrollingjobs.local',
  phoneNumber: '',
  searchBrief: '',
  headline: '',
  locationLabel: '',
  timezone: 'America/Toronto',
  remoteRequired: true,
  primaryMarket: '',
  secondaryMarkets: [],
  allowedRemoteRegions: [],
  timezoneToleranceHours: '',
  relocationOpen: false,
  salaryFloorCurrency: 'USD',
  salaryFloorAmount: '',
  salaryTargetMin: '',
  salaryTargetMax: '',
  seniorityLevel: '',
  targetSeniorityLevels: [],
  targetRoles: [],
  allowedAdjacentRoles: [],
  industriesPreferred: [],
  industriesAvoid: [],
  skills: [],
  tools: [],
  languages: [],
  workAuthorizationNotes: '',
  portfolioPrimaryUrl: '',
  linkedinUrl: '',
  personalSiteUrl: '',
  bioSummary: '',
  preferencesNotes: '',
  matchingPreferences: defaultMatchingPreferences,
  canonicalProfileReviewedAt: undefined,
}

const seededResumeMasterBase: ResumeMasterRecord = {
  additionalInformation: [],
  approvalStatus: 'draft',
  approvedAt: undefined,
  archivedExperienceEntries: [],
  baseTitle: '',
  baseCoverLetterText: '',
  contactSnapshot: {
    email: seededProfile.email,
    linkedinUrl: '',
    location: '',
    name: seededProfile.displayName,
    phone: '',
    portfolioUrl: '',
    websiteUrl: '',
  },
  coreExpertise: [],
  hasSourceMaterial: false,
  generationIssues: [],
  languages: [],
  rawSourceText: '',
  renderedMarkdown: '',
  sectionProvenance: {
    additionalInformation: { confidence: 'high', notes: [], sourceLabels: [] },
    archivedExperience: { confidence: 'high', notes: [], sourceLabels: [] },
    certifications: { confidence: 'high', notes: [], sourceLabels: [] },
    contact: { confidence: 'high', notes: [], sourceLabels: [] },
    coreExpertise: { confidence: 'high', notes: [], sourceLabels: [] },
    education: { confidence: 'high', notes: [], sourceLabels: [] },
    languages: { confidence: 'high', notes: [], sourceLabels: [] },
    professionalExperience: { confidence: 'high', notes: [], sourceLabels: [] },
    professionalSummary: { confidence: 'high', notes: [], sourceLabels: [] },
    selectedImpactHighlights: { confidence: 'high', notes: [], sourceLabels: [] },
    toolsPlatforms: { confidence: 'high', notes: [], sourceLabels: [] },
  },
  selectedImpactHighlights: [],
  sourceContent: {
    createdFrom: 'blank-onboarding-fallback',
  },
  sourceFormat: 'structured_json',
  summaryText: '',
  experienceEntries: [],
  achievementBank: [],
  skillsSection: [],
  educationEntries: [],
  certifications: [],
  toolsPlatforms: [],
  coverLetterPdfFileName: '',
  portfolioPdfFileName: '',
  resumePdfFileName: '',
}

const seededResumeMaster: ResumeMasterRecord = {
  ...seededResumeMasterBase,
  renderedMarkdown: '',
}

const seededCoverLetterMasterBase: CoverLetterMasterRecord = {
  approvalStatus: 'draft',
  approvedAt: undefined,
  capabilities: {
    disciplines: [],
    productionTools: [],
  },
  contactSnapshot: {
    location: '',
    name: seededProfile.displayName,
    roleTargets: [],
  },
  generationIssues: [],
  hasSourceMaterial: false,
  keyDifferentiators: [],
  outputConstraints: [],
  positioningPhilosophy: '',
  proofBank: [],
  rawSourceText: '',
  renderedMarkdown: '',
  sectionProvenance: {
    capabilities: { confidence: 'high', notes: [], sourceLabels: [] },
    contact: { confidence: 'high', notes: [], sourceLabels: [] },
    keyDifferentiators: { confidence: 'high', notes: [], sourceLabels: [] },
    outputConstraints: { confidence: 'high', notes: [], sourceLabels: [] },
    positioningPhilosophy: { confidence: 'high', notes: [], sourceLabels: [] },
    proofBank: { confidence: 'high', notes: [], sourceLabels: [] },
    selectionRules: { confidence: 'high', notes: [], sourceLabels: [] },
    toneVoice: { confidence: 'high', notes: [], sourceLabels: [] },
  },
  selectionRules: [],
  sourceContent: {
    createdFrom: 'blank-onboarding-fallback',
  },
  sourceFormat: 'structured_json',
  toneVoice: [],
}

const seededCoverLetterMaster: CoverLetterMasterRecord = {
  ...seededCoverLetterMasterBase,
  renderedMarkdown: '',
}

const seededPortfolioItems: OperatorPortfolioItemRecord[] = []

const seededWorkspace: OperatorWorkspaceRecord = {
  coverLetterMaster: seededCoverLetterMaster,
  portfolioItems: seededPortfolioItems,
  profile: seededProfile,
  resumeMaster: seededResumeMaster,
  status: deriveProfileWorkspaceStatus({
    coverLetterMaster: seededCoverLetterMaster,
    profile: seededProfile,
    resumeMaster: seededResumeMaster,
  }),
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function asNumericString(value: unknown) {
  return typeof value === 'number' ? String(value) : ''
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function normalizePortfolioItem(value: unknown): OperatorPortfolioItemRecord {
  const record = asRecord(value)

  return {
    id: asString(record?.id),
    title: asString(record?.title),
    url: asString(record?.url),
    projectType: asString(record?.project_type ?? record?.projectType),
    roleLabel: asString(record?.role_label ?? record?.roleLabel),
    summary: asString(record?.summary),
    skillsTags: asStringArray(record?.skills_tags ?? record?.skillsTags),
    industryTags: asStringArray(record?.industry_tags ?? record?.industryTags),
    outcomeMetrics: asStringArray(record?.outcome_metrics ?? record?.outcomeMetrics),
    visualStrengthRating: asNumericString(
      record?.visual_strength_rating ?? record?.visualStrengthRating,
    ),
    isPrimary: asBoolean(record?.is_primary ?? record?.isPrimary),
    isActive: asBoolean(record?.is_active ?? record?.isActive, true),
  }
}

export async function getOperatorProfile(): Promise<OperatorProfileResult> {
  if (!hasSupabaseServerEnv()) {
    return {
      issue:
        "The saved workspace connection isn't available right now, so this screen is showing a blank onboarding workspace.",
      source: 'seed',
      workspace: seededWorkspace,
    }
  }

  const operatorContext = await getActiveOperatorContext()

  if (!operatorContext) {
    return {
      issue: 'Choose a workspace before loading the profile.',
      source: 'database-fallback',
      workspace: seededWorkspace,
    }
  }

  const supabase = createClient()

  const [profileResult, resumeResult, coverLetterResult, portfolioResult] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('*')
      .eq('operator_id', operatorContext.operator.id)
      .maybeSingle(),
    supabase
      .from('resume_master')
      .select('*')
      .eq('operator_id', operatorContext.operator.id)
      .maybeSingle(),
    supabase
      .from('cover_letter_master')
      .select('*')
      .eq('operator_id', operatorContext.operator.id)
      .maybeSingle(),
    supabase
      .from('portfolio_items')
      .select('*')
      .eq('operator_id', operatorContext.operator.id)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true }),
  ])

  if (profileResult.error || !profileResult.data) {
    return {
      issue:
        'The selected operator does not have a persisted workspace yet. Open the operator picker to create one, or apply the latest migration and seed.',
      source: 'database-fallback',
      workspace: seededWorkspace,
    }
  }

  const profile = profileResult.data
  const issues: string[] = []
  const locationLabel = asString(profile.location_label)
  const normalizedHiringMarkets = ensureLocationCountryFirst(
    [asString(profile.primary_market), ...asStringArray(profile.secondary_markets)],
    locationLabel,
  )
  const secondaryMarkets = normalizedHiringMarkets.slice(1)
  const allowedRemoteRegions = asStringArray(profile.allowed_remote_regions)
  const targetSeniorityLevels = getTargetSeniorityLevels(
    asStringArray(profile.target_seniority_levels),
    asString(profile.seniority_level),
  )

  const resumeMaster =
    resumeResult.error || !resumeResult.data
      ? (() => {
          issues.push(
            'Resume master content is not seeded in Supabase yet, so the page is using a blank onboarding fallback workspace.',
          )
          return seededResumeMaster
        })()
      : normalizeResumeMasterRecord(resumeResult.data, seededResumeMaster)

  const coverLetterMaster =
    coverLetterResult.error || !coverLetterResult.data
      ? seededCoverLetterMaster
      : normalizeCoverLetterMasterRecord(coverLetterResult.data, seededCoverLetterMaster)

  const portfolioItems =
    portfolioResult.error || !portfolioResult.data
      ? (() => {
          issues.push(
            'Portfolio items could not be loaded from Supabase, so the page is showing a blank onboarding portfolio state.',
          )
          return seededPortfolioItems
        })()
      : portfolioResult.data.map((item) => normalizePortfolioItem(item))

  const normalizedProfile: OperatorProfileRecord = {
    userId: operatorContext.userId,
    profileId: profile.id ?? seededProfile.profileId,
    updatedAt: asString(profile.updated_at) || undefined,
    displayName: operatorContext.operator.displayName || seededProfile.displayName,
    email: operatorContext.operator.email || seededProfile.email,
    phoneNumber: asString(profile.phone_number),
    searchBrief: asString(profile.search_brief),
    headline: asString(profile.headline),
    locationLabel,
    timezone: asString(profile.timezone) || 'America/Toronto',
    remoteRequired:
      typeof profile.remote_required === 'boolean'
        ? profile.remote_required
        : seededProfile.remoteRequired,
    primaryMarket: normalizedHiringMarkets[0] ?? '',
    secondaryMarkets,
    allowedRemoteRegions,
    timezoneToleranceHours: asNumericString(profile.timezone_tolerance_hours),
    relocationOpen:
      typeof profile.relocation_open === 'boolean'
        ? profile.relocation_open
        : seededProfile.relocationOpen,
    salaryFloorCurrency: asString(profile.salary_floor_currency) || 'USD',
    salaryFloorAmount: asNumericString(profile.salary_floor_amount),
    salaryTargetMin: asNumericString(profile.salary_target_min),
    salaryTargetMax: asNumericString(profile.salary_target_max),
    seniorityLevel: asString(profile.seniority_level),
    targetSeniorityLevels,
    targetRoles: asStringArray(profile.target_roles),
    allowedAdjacentRoles: asStringArray(profile.allowed_adjacent_roles),
    industriesPreferred: asStringArray(profile.industries_preferred),
    industriesAvoid: asStringArray(profile.industries_avoid),
    skills: asStringArray(profile.skills),
    tools: asStringArray(profile.tools),
    languages: asStringArray(profile.languages),
    workAuthorizationNotes: asString(profile.work_authorization_notes),
    portfolioPrimaryUrl: asString(profile.portfolio_primary_url),
    linkedinUrl: asString(profile.linkedin_url),
    personalSiteUrl: asString(profile.personal_site_url),
    bioSummary: asString(profile.bio_summary),
    preferencesNotes: asString(profile.preferences_notes),
    matchingPreferences: normalizeMatchingPreferences(profile.matching_preferences),
    canonicalProfileReviewedAt: asString(profile.canonical_profile_reviewed_at) || undefined,
  }

  return {
    issue: issues.length > 0 ? issues.join(' ') : undefined,
    source: issues.length > 0 ? 'database-fallback' : 'database',
    workspace: {
      portfolioItems,
      profile: normalizedProfile,
      coverLetterMaster,
      resumeMaster,
      status: deriveProfileWorkspaceStatus({
        coverLetterMaster,
        profile: normalizedProfile,
        resumeMaster,
      }),
    },
  }
}
