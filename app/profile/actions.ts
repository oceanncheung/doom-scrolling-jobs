'use server'

import { revalidatePath } from 'next/cache'

import { defaultOperator } from '@/lib/config/runtime'
import type {
  OperatorPortfolioItemRecord,
  ResumeAchievementRecord,
  ResumeEducationRecord,
  ResumeExperienceRecord,
} from '@/lib/domain/types'
import { hasSupabaseServerEnv } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export interface ProfileActionState {
  message: string
  status: 'error' | 'idle' | 'success'
}

interface ParseResult<T> {
  error?: string
  items: T[]
}

function asTextValue(value: FormDataEntryValue | null) {
  return String(value ?? '').trim()
}

function asOptionalText(value: FormDataEntryValue | null) {
  const text = asTextValue(value)
  return text.length > 0 ? text : null
}

function asList(value: FormDataEntryValue | null) {
  return String(value ?? '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function asOptionalInteger(value: FormDataEntryValue | null) {
  const raw = asTextValue(value)

  if (!raw) {
    return null
  }

  const parsed = Number.parseInt(raw, 10)

  return Number.isFinite(parsed) ? parsed : null
}

function asFieldArray(formData: FormData, name: string) {
  return formData.getAll(name).map((value) => String(value ?? '').trim())
}

function hasMeaningfulRow(values: Array<string | string[]>) {
  return values.some((value) =>
    Array.isArray(value) ? value.some((item) => item.length > 0) : value.length > 0,
  )
}

function asBooleanChoice(value: string, fallback = false) {
  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  return fallback
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function asRating(value: string) {
  if (!value) {
    return null
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed)) {
    return null
  }

  return Math.min(5, Math.max(1, parsed))
}

function toPostgresInList(values: string[]) {
  return `(${values.map((value) => `"${value}"`).join(',')})`
}

function parseExperienceEntries(formData: FormData): ParseResult<ResumeExperienceRecord> {
  const roleTitles = asFieldArray(formData, 'experienceRoleTitle')
  const companyNames = asFieldArray(formData, 'experienceCompanyName')
  const locationLabels = asFieldArray(formData, 'experienceLocationLabel')
  const startDates = asFieldArray(formData, 'experienceStartDate')
  const endDates = asFieldArray(formData, 'experienceEndDate')
  const summaries = asFieldArray(formData, 'experienceSummary')
  const highlights = asFieldArray(formData, 'experienceHighlights').map((value) => asList(value))

  const count = Math.max(
    roleTitles.length,
    companyNames.length,
    locationLabels.length,
    startDates.length,
    endDates.length,
    summaries.length,
    highlights.length,
  )

  const items: ResumeExperienceRecord[] = []

  for (let index = 0; index < count; index += 1) {
    const item: ResumeExperienceRecord = {
      companyName: companyNames[index] ?? '',
      roleTitle: roleTitles[index] ?? '',
      locationLabel: locationLabels[index] ?? '',
      startDate: startDates[index] ?? '',
      endDate: endDates[index] ?? '',
      summary: summaries[index] ?? '',
      highlights: highlights[index] ?? [],
    }

    if (!hasMeaningfulRow([item.companyName, item.roleTitle, item.summary, item.highlights])) {
      continue
    }

    if (!item.companyName || !item.roleTitle) {
      return {
        error: `Experience entry ${index + 1} needs both a company name and a role title.`,
        items: [],
      }
    }

    items.push(item)
  }

  return { items }
}

function parseAchievementBank(formData: FormData): ParseResult<ResumeAchievementRecord> {
  const categories = asFieldArray(formData, 'achievementCategory')
  const titles = asFieldArray(formData, 'achievementTitle')
  const details = asFieldArray(formData, 'achievementDetail')
  const count = Math.max(categories.length, titles.length, details.length)
  const items: ResumeAchievementRecord[] = []

  for (let index = 0; index < count; index += 1) {
    const item: ResumeAchievementRecord = {
      category: categories[index] ?? '',
      title: titles[index] ?? '',
      detail: details[index] ?? '',
    }

    if (!hasMeaningfulRow([item.category, item.title, item.detail])) {
      continue
    }

    if (!item.title || !item.detail) {
      return {
        error: `Achievement entry ${index + 1} needs both a title and a detail.`,
        items: [],
      }
    }

    items.push(item)
  }

  return { items }
}

function parseEducationEntries(formData: FormData): ParseResult<ResumeEducationRecord> {
  const schoolNames = asFieldArray(formData, 'educationSchoolName')
  const credentials = asFieldArray(formData, 'educationCredential')
  const fieldsOfStudy = asFieldArray(formData, 'educationFieldOfStudy')
  const startDates = asFieldArray(formData, 'educationStartDate')
  const endDates = asFieldArray(formData, 'educationEndDate')
  const notes = asFieldArray(formData, 'educationNotes')
  const count = Math.max(
    schoolNames.length,
    credentials.length,
    fieldsOfStudy.length,
    startDates.length,
    endDates.length,
    notes.length,
  )

  const items: ResumeEducationRecord[] = []

  for (let index = 0; index < count; index += 1) {
    const item: ResumeEducationRecord = {
      schoolName: schoolNames[index] ?? '',
      credential: credentials[index] ?? '',
      fieldOfStudy: fieldsOfStudy[index] ?? '',
      startDate: startDates[index] ?? '',
      endDate: endDates[index] ?? '',
      notes: notes[index] ?? '',
    }

    if (!hasMeaningfulRow([item.schoolName, item.credential, item.fieldOfStudy, item.notes])) {
      continue
    }

    if (!item.schoolName || !item.credential) {
      return {
        error: `Education entry ${index + 1} needs both a school name and a credential.`,
        items: [],
      }
    }

    items.push(item)
  }

  return { items }
}

function parsePortfolioItems(formData: FormData): ParseResult<OperatorPortfolioItemRecord> {
  const ids = asFieldArray(formData, 'portfolioItemId')
  const titles = asFieldArray(formData, 'portfolioTitle')
  const urls = asFieldArray(formData, 'portfolioUrl')
  const projectTypes = asFieldArray(formData, 'portfolioProjectType')
  const roleLabels = asFieldArray(formData, 'portfolioRoleLabel')
  const summaries = asFieldArray(formData, 'portfolioSummary')
  const skillsTags = asFieldArray(formData, 'portfolioSkillsTags').map((value) => asList(value))
  const industryTags = asFieldArray(formData, 'portfolioIndustryTags').map((value) => asList(value))
  const outcomeMetrics = asFieldArray(formData, 'portfolioOutcomeMetrics').map((value) =>
    asList(value),
  )
  const visualStrengthRatings = asFieldArray(formData, 'portfolioVisualStrengthRating')
  const primaryChoices = asFieldArray(formData, 'portfolioIsPrimary')
  const activeChoices = asFieldArray(formData, 'portfolioIsActive')

  const count = Math.max(
    ids.length,
    titles.length,
    urls.length,
    projectTypes.length,
    roleLabels.length,
    summaries.length,
    skillsTags.length,
    industryTags.length,
    outcomeMetrics.length,
    visualStrengthRatings.length,
    primaryChoices.length,
    activeChoices.length,
  )

  const items: OperatorPortfolioItemRecord[] = []

  for (let index = 0; index < count; index += 1) {
    const item: OperatorPortfolioItemRecord = {
      id: ids[index] ?? '',
      title: titles[index] ?? '',
      url: urls[index] ?? '',
      projectType: projectTypes[index] ?? '',
      roleLabel: roleLabels[index] ?? '',
      summary: summaries[index] ?? '',
      skillsTags: skillsTags[index] ?? [],
      industryTags: industryTags[index] ?? [],
      outcomeMetrics: outcomeMetrics[index] ?? [],
      visualStrengthRating: visualStrengthRatings[index] ?? '',
      isPrimary: asBooleanChoice(primaryChoices[index] ?? 'false'),
      isActive: asBooleanChoice(activeChoices[index] ?? 'true', true),
    }

    if (
      !hasMeaningfulRow([
        item.title,
        item.url,
        item.projectType,
        item.roleLabel,
        item.summary,
        item.skillsTags,
        item.industryTags,
        item.outcomeMetrics,
      ])
    ) {
      continue
    }

    if (!item.id) {
      return {
        error: `Portfolio item ${index + 1} is missing its internal ID. Refresh the page and try again.`,
        items: [],
      }
    }

    if (!item.title || !item.url) {
      return {
        error: `Portfolio item ${index + 1} needs both a title and a URL.`,
        items: [],
      }
    }

    items.push(item)
  }

  return { items }
}

export async function saveOperatorProfile(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  if (!hasSupabaseServerEnv()) {
    return {
      message: 'Add the Supabase URL, publishable key, and service role key before trying to save profile changes.',
      status: 'error',
    }
  }

  const headline = asTextValue(formData.get('headline'))

  if (!headline) {
    return {
      message: 'Headline is required so scoring and packet generation have a stable role anchor.',
      status: 'error',
    }
  }

  const experienceResult = parseExperienceEntries(formData)
  const achievementResult = parseAchievementBank(formData)
  const educationResult = parseEducationEntries(formData)
  const portfolioResult = parsePortfolioItems(formData)

  const parseError =
    experienceResult.error ??
    achievementResult.error ??
    educationResult.error ??
    portfolioResult.error

  if (parseError) {
    return {
      message: parseError,
      status: 'error',
    }
  }

  const experienceEntries = experienceResult.items
  const achievementBank = achievementResult.items
  const educationEntries = educationResult.items
  const portfolioItems = portfolioResult.items
  const resumeSkillsSection = asList(formData.get('resumeSkillsSection'))
  const certifications = asList(formData.get('certifications'))
  const derivedPortfolioPrimaryUrl =
    asOptionalText(formData.get('portfolioPrimaryUrl')) ??
    portfolioItems.find((item) => item.isPrimary && item.isActive)?.url ??
    portfolioItems.find((item) => item.isActive)?.url ??
    null
  const searchBrief = asOptionalText(formData.get('searchBrief')) ?? ''

  const supabase = createClient()
  const displayName = asOptionalText(formData.get('displayName'))

  const userPayload = {
    account_status: 'active',
    auth_provider: 'internal',
    display_name: displayName,
    email: 'internal@doomscrollingjobs.local',
    id: defaultOperator.userId,
    is_internal: true,
  }

  const profilePayload = {
    id: defaultOperator.profileId,
    user_id: defaultOperator.userId,
    search_brief: searchBrief,
    headline,
    location_label: asOptionalText(formData.get('locationLabel')) ?? '',
    timezone: asOptionalText(formData.get('timezone')) ?? 'America/Toronto',
    remote_required: formData.get('remoteRequired') === 'on',
    primary_market: asOptionalText(formData.get('primaryMarket')) ?? '',
    secondary_markets: asList(formData.get('secondaryMarkets')),
    allowed_remote_regions: asList(formData.get('allowedRemoteRegions')),
    timezone_tolerance_hours: asOptionalInteger(formData.get('timezoneToleranceHours')),
    relocation_open: formData.get('relocationOpen') === 'on',
    salary_floor_currency: asOptionalText(formData.get('salaryFloorCurrency')) ?? 'USD',
    salary_floor_amount: asOptionalInteger(formData.get('salaryFloorAmount')),
    salary_target_min: asOptionalInteger(formData.get('salaryTargetMin')),
    salary_target_max: asOptionalInteger(formData.get('salaryTargetMax')),
    seniority_level: asOptionalText(formData.get('seniorityLevel')),
    target_roles: asList(formData.get('targetRoles')),
    allowed_adjacent_roles: asList(formData.get('allowedAdjacentRoles')),
    industries_preferred: asList(formData.get('industriesPreferred')),
    industries_avoid: asList(formData.get('industriesAvoid')),
    skills: asList(formData.get('skills')),
    tools: asList(formData.get('tools')),
    work_authorization_notes: asOptionalText(formData.get('workAuthorizationNotes')),
    portfolio_primary_url: derivedPortfolioPrimaryUrl,
    linkedin_url: asOptionalText(formData.get('linkedinUrl')),
    personal_site_url: asOptionalText(formData.get('personalSiteUrl')),
    bio_summary: asOptionalText(formData.get('bioSummary')),
    experience_summary: experienceEntries,
    education_summary: educationEntries,
    preferences_notes: asOptionalText(formData.get('preferencesNotes')),
  }

  const resumePayload = {
    id: defaultOperator.resumeMasterId,
    user_id: defaultOperator.userId,
    base_title: headline,
    summary_text: asOptionalText(formData.get('resumeSummaryText')),
    experience_entries: experienceEntries,
    achievement_bank: achievementBank,
    skills_section: resumeSkillsSection,
    education_entries: educationEntries,
    certifications,
    links: {
      linkedin: asOptionalText(formData.get('linkedinUrl')),
      portfolio: derivedPortfolioPrimaryUrl,
      website: asOptionalText(formData.get('personalSiteUrl')),
    },
    source_format: 'structured_json',
    source_content: {
      achievementCount: achievementBank.length,
      educationCount: educationEntries.length,
      experienceCount: experienceEntries.length,
      portfolioItemCount: portfolioItems.length,
      searchBrief,
      updatedFrom: 'profile-workspace',
    },
  }

  const [userResult, profileResult, resumeResult] = await Promise.all([
    supabase.from('users').upsert(userPayload, { onConflict: 'id' }),
    supabase.from('user_profiles').upsert(profilePayload, { onConflict: 'id' }),
    supabase.from('resume_master').upsert(resumePayload, { onConflict: 'id' }),
  ])

  if (userResult.error || profileResult.error || resumeResult.error) {
    return {
      message:
        userResult.error?.message ??
        profileResult.error?.message ??
        resumeResult.error?.message ??
        'Supabase rejected the profile update.',
      status: 'error',
    }
  }

  const portfolioPayload = portfolioItems.map((item) => ({
    id: item.id,
    user_id: defaultOperator.userId,
    title: item.title,
    slug: toSlug(item.title),
    url: item.url,
    project_type: item.projectType || 'general design',
    role_label: item.roleLabel || 'designer',
    summary: item.summary || null,
    skills_tags: item.skillsTags,
    industry_tags: item.industryTags,
    outcome_metrics: item.outcomeMetrics,
    visual_strength_rating: asRating(item.visualStrengthRating),
    is_primary: item.isPrimary,
    is_active: item.isActive,
  }))

  if (portfolioPayload.length > 0) {
    const upsertResult = await supabase.from('portfolio_items').upsert(portfolioPayload, {
      onConflict: 'id',
    })

    if (upsertResult.error) {
      return {
        message: upsertResult.error.message,
        status: 'error',
      }
    }

    const deleteResult = await supabase
      .from('portfolio_items')
      .delete()
      .eq('user_id', defaultOperator.userId)
      .not('id', 'in', toPostgresInList(portfolioPayload.map((item) => item.id)))

    if (deleteResult.error) {
      return {
        message: deleteResult.error.message,
        status: 'error',
      }
    }
  } else {
    const deleteResult = await supabase
      .from('portfolio_items')
      .delete()
      .eq('user_id', defaultOperator.userId)

    if (deleteResult.error) {
      return {
        message: deleteResult.error.message,
        status: 'error',
      }
    }
  }

  revalidatePath('/')
  revalidatePath('/dashboard')
  revalidatePath('/profile')

  return {
    message: `Internal operator workspace saved with ${experienceEntries.length} experience entries and ${portfolioItems.length} portfolio items.`,
    status: 'success',
  }
}
