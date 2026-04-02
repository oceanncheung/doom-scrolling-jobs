import 'server-only'

import { defaultOperator } from '@/lib/config/runtime'
import type {
  OperatorPortfolioItemRecord,
  OperatorProfileRecord,
  OperatorWorkspaceRecord,
  ResumeAchievementRecord,
  ResumeEducationRecord,
  ResumeExperienceRecord,
  ResumeMasterRecord,
} from '@/lib/domain/types'
import { hasSupabaseServerEnv } from '@/lib/env'
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
  displayName: 'Internal Operator',
  email: 'internal@doomscrollingjobs.local',
  searchBrief:
    'Find remote-first design roles that prioritize quality, strong salary, and thoughtful brand, presentation, or campaign work. Designers first, but adjacent creative roles are okay if the fit is genuinely high.',
  headline: 'Graphic Designer',
  locationLabel: 'Toronto, Canada',
  timezone: 'America/Toronto',
  remoteRequired: true,
  primaryMarket: 'Canada',
  secondaryMarkets: ['United States'],
  allowedRemoteRegions: ['Canada', 'United States', 'North America'],
  timezoneToleranceHours: '3',
  relocationOpen: false,
  salaryFloorCurrency: 'USD',
  salaryFloorAmount: '',
  salaryTargetMin: '',
  salaryTargetMax: '',
  seniorityLevel: 'senior',
  targetRoles: [
    'graphic designer',
    'brand designer',
    'visual designer',
    'marketing designer',
    'presentation designer',
  ],
  allowedAdjacentRoles: [
    'product designer',
    'motion designer',
    'art director',
    'creative lead',
    'creative director',
    'content designer',
    'campaign designer',
    'ui designer',
  ],
  industriesPreferred: ['technology', 'education', 'media'],
  industriesAvoid: ['gambling', 'crypto scams'],
  skills: ['visual systems', 'brand identity', 'presentation design', 'campaign design'],
  tools: ['Figma', 'Adobe Creative Suite', 'Photoshop', 'Illustrator'],
  workAuthorizationNotes: 'Authorized to work remotely for roles open to Canada-based candidates.',
  portfolioPrimaryUrl: 'https://portfolio.example.com',
  linkedinUrl: '',
  personalSiteUrl: '',
  bioSummary:
    'Single internal operator profile used to rank remote design opportunities and prepare high-quality manual applications.',
  preferencesNotes:
    'Internal single-user mode for Ocean / Alvis. Replace these defaults as the real operator profile is filled in.',
}

const seededResumeMaster: ResumeMasterRecord = {
  baseTitle: 'Graphic Designer',
  summaryText:
    'Designer focused on brand systems, presentation design, and campaign work for high-quality remote teams.',
  experienceEntries: [
    {
      companyName: 'Northshore Studio',
      roleTitle: 'Senior Graphic Designer',
      locationLabel: 'Toronto, Canada',
      startDate: '2022-01',
      endDate: '',
      summary:
        'Own brand design systems, launch campaigns, and executive presentation work across marketing and product initiatives.',
      highlights: [
        'Built a reusable campaign design system adopted across multiple product launches.',
        'Led high-visibility deck design for executive and investor presentations.',
      ],
    },
    {
      companyName: 'Signal Works',
      roleTitle: 'Visual Designer',
      locationLabel: 'Remote',
      startDate: '2019-04',
      endDate: '2021-12',
      summary:
        'Delivered visual identity, landing pages, and growth creative for a distributed SaaS team.',
      highlights: [
        'Created campaign assets that improved paid social click-through performance.',
        'Partnered with product marketing to turn strategy into launch-ready visuals.',
      ],
    },
  ],
  achievementBank: [
    {
      category: 'brand',
      title: 'Scaled brand systems',
      detail: 'Created reusable visual systems that improved consistency across campaigns and presentations.',
    },
    {
      category: 'collaboration',
      title: 'Cross-functional execution',
      detail: 'Worked closely with marketing, product, and leadership teams to ship polished launch assets.',
    },
  ],
  skillsSection: ['branding', 'campaign design', 'presentation design', 'visual storytelling'],
  educationEntries: [
    {
      schoolName: 'OCAD University',
      credential: 'Bachelor of Design',
      fieldOfStudy: 'Graphic Design',
      startDate: '2014',
      endDate: '2018',
      notes: 'Focused on visual communication and brand systems.',
    },
  ],
  certifications: [],
}

const seededPortfolioItems: OperatorPortfolioItemRecord[] = [
  {
    id: '44444444-4444-4444-8444-444444444444',
    title: 'Brand System Refresh',
    url: 'https://portfolio.example.com/brand-system-refresh',
    projectType: 'brand design',
    roleLabel: 'Lead designer',
    summary: 'Rebuilt the visual system for a growing software brand across web, lifecycle, and sales touchpoints.',
    skillsTags: ['brand identity', 'visual systems', 'marketing design'],
    industryTags: ['saas', 'technology'],
    outcomeMetrics: ['Unified launch visuals across five channels', 'Improved internal design reuse'],
    visualStrengthRating: '5',
    isPrimary: true,
    isActive: true,
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    title: 'Executive Launch Deck',
    url: 'https://portfolio.example.com/executive-launch-deck',
    projectType: 'presentation design',
    roleLabel: 'Presentation designer',
    summary: 'Designed a narrative deck for leadership, sales, and investor-facing product launch communication.',
    skillsTags: ['presentation design', 'storytelling', 'information hierarchy'],
    industryTags: ['technology', 'b2b'],
    outcomeMetrics: ['Reduced ad hoc slide redesign work', 'Created reusable story modules for leadership'],
    visualStrengthRating: '4',
    isPrimary: false,
    isActive: true,
  },
]

const seededWorkspace: OperatorWorkspaceRecord = {
  portfolioItems: seededPortfolioItems,
  profile: seededProfile,
  resumeMaster: seededResumeMaster,
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

function asObjectArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null)
}

function normalizeExperienceEntry(value: unknown): ResumeExperienceRecord {
  const record = asRecord(value)

  return {
    companyName: asString(record?.companyName ?? record?.company_name),
    roleTitle: asString(record?.roleTitle ?? record?.role_title),
    locationLabel: asString(record?.locationLabel ?? record?.location_label),
    startDate: asString(record?.startDate ?? record?.start_date),
    endDate: asString(record?.endDate ?? record?.end_date),
    summary: asString(record?.summary),
    highlights: asStringArray(record?.highlights),
  }
}

function normalizeAchievementEntry(value: unknown): ResumeAchievementRecord {
  const record = asRecord(value)

  return {
    category: asString(record?.category),
    title: asString(record?.title),
    detail: asString(record?.detail),
  }
}

function normalizeEducationEntry(value: unknown): ResumeEducationRecord {
  const record = asRecord(value)

  return {
    schoolName: asString(record?.schoolName ?? record?.school_name),
    credential: asString(record?.credential),
    fieldOfStudy: asString(record?.fieldOfStudy ?? record?.field_of_study),
    startDate: asString(record?.startDate ?? record?.start_date),
    endDate: asString(record?.endDate ?? record?.end_date),
    notes: asString(record?.notes),
  }
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

function normalizeResumeMaster(value: unknown): ResumeMasterRecord {
  const record = asRecord(value)

  return {
    baseTitle: asString(record?.base_title ?? record?.baseTitle) || seededResumeMaster.baseTitle,
    summaryText: asString(record?.summary_text ?? record?.summaryText),
    experienceEntries: asObjectArray(record?.experience_entries ?? record?.experienceEntries).map(
      normalizeExperienceEntry,
    ),
    achievementBank: asObjectArray(record?.achievement_bank ?? record?.achievementBank).map(
      normalizeAchievementEntry,
    ),
    skillsSection: asStringArray(record?.skills_section ?? record?.skillsSection),
    educationEntries: asObjectArray(record?.education_entries ?? record?.educationEntries).map(
      normalizeEducationEntry,
    ),
    certifications: asStringArray(record?.certifications),
  }
}

export async function getOperatorProfile(): Promise<OperatorProfileResult> {
  if (!hasSupabaseServerEnv()) {
    return {
      issue:
        'Supabase server environment variables are not configured yet, so this screen is showing the seeded internal fallback workspace.',
      source: 'seed',
      workspace: seededWorkspace,
    }
  }

  const supabase = createClient()

  const [userResult, profileResult, resumeResult, portfolioResult] = await Promise.all([
    supabase
      .from('users')
      .select('id, email, display_name')
      .eq('id', defaultOperator.userId)
      .maybeSingle(),
    supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', defaultOperator.userId)
      .maybeSingle(),
    supabase
      .from('resume_master')
      .select('*')
      .eq('user_id', defaultOperator.userId)
      .maybeSingle(),
    supabase
      .from('portfolio_items')
      .select('*')
      .eq('user_id', defaultOperator.userId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true }),
  ])

  if (userResult.error || profileResult.error || !profileResult.data) {
    return {
      issue:
        'The internal operator seed is not available in Supabase yet. Apply the migration and seed to persist the profile workspace.',
      source: 'database-fallback',
      workspace: seededWorkspace,
    }
  }

  const user = userResult.data
  const profile = profileResult.data
  const issues: string[] = []
  const secondaryMarkets = asStringArray(profile.secondary_markets)
  const allowedRemoteRegions = asStringArray(profile.allowed_remote_regions)

  const resumeMaster =
    resumeResult.error || !resumeResult.data
      ? (() => {
          issues.push(
            'Resume master content is not seeded in Supabase yet, so the page is using the fallback resume workspace.',
          )
          return seededResumeMaster
        })()
      : normalizeResumeMaster(resumeResult.data)

  const portfolioItems =
    portfolioResult.error || !portfolioResult.data
      ? (() => {
          issues.push(
            'Portfolio items could not be loaded from Supabase, so the page is showing the fallback portfolio library.',
          )
          return seededPortfolioItems
        })()
      : portfolioResult.data.map((item) => normalizePortfolioItem(item))

  return {
    issue: issues.length > 0 ? issues.join(' ') : undefined,
    source: issues.length > 0 ? 'database-fallback' : 'database',
    workspace: {
      portfolioItems,
      profile: {
        userId: user?.id ?? seededProfile.userId,
        profileId: profile.id ?? seededProfile.profileId,
        displayName: asString(user?.display_name) || seededProfile.displayName,
        email: asString(user?.email) || seededProfile.email,
        searchBrief: asString(profile.search_brief) || seededProfile.searchBrief,
        headline: asString(profile.headline) || seededProfile.headline,
        locationLabel: asString(profile.location_label),
        timezone: asString(profile.timezone) || seededProfile.timezone,
        remoteRequired:
          typeof profile.remote_required === 'boolean'
            ? profile.remote_required
            : seededProfile.remoteRequired,
        primaryMarket: asString(profile.primary_market) || seededProfile.primaryMarket,
        secondaryMarkets:
          secondaryMarkets.length > 0 ? secondaryMarkets : seededProfile.secondaryMarkets,
        allowedRemoteRegions:
          allowedRemoteRegions.length > 0
            ? allowedRemoteRegions
            : seededProfile.allowedRemoteRegions,
        timezoneToleranceHours:
          asNumericString(profile.timezone_tolerance_hours) || seededProfile.timezoneToleranceHours,
        relocationOpen:
          typeof profile.relocation_open === 'boolean'
            ? profile.relocation_open
            : seededProfile.relocationOpen,
        salaryFloorCurrency:
          asString(profile.salary_floor_currency) || seededProfile.salaryFloorCurrency,
        salaryFloorAmount: asNumericString(profile.salary_floor_amount),
        salaryTargetMin: asNumericString(profile.salary_target_min),
        salaryTargetMax: asNumericString(profile.salary_target_max),
        seniorityLevel: asString(profile.seniority_level),
        targetRoles: asStringArray(profile.target_roles),
        allowedAdjacentRoles: asStringArray(profile.allowed_adjacent_roles),
        industriesPreferred: asStringArray(profile.industries_preferred),
        industriesAvoid: asStringArray(profile.industries_avoid),
        skills: asStringArray(profile.skills),
        tools: asStringArray(profile.tools),
        workAuthorizationNotes: asString(profile.work_authorization_notes),
        portfolioPrimaryUrl: asString(profile.portfolio_primary_url),
        linkedinUrl: asString(profile.linkedin_url),
        personalSiteUrl: asString(profile.personal_site_url),
        bioSummary: asString(profile.bio_summary),
        preferencesNotes: asString(profile.preferences_notes),
      },
      resumeMaster,
    },
  }
}
