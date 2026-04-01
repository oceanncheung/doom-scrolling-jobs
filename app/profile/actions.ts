'use server'

import { revalidatePath } from 'next/cache'

import { defaultOperator } from '@/lib/config/runtime'
import { hasSupabaseServerEnv } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export interface ProfileActionState {
  message: string
  status: 'error' | 'idle' | 'success'
}

function asOptionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text.length > 0 ? text : null
}

function asList(value: FormDataEntryValue | null) {
  return String(value ?? '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function asOptionalInteger(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim()

  if (!raw) {
    return null
  }

  const parsed = Number.parseInt(raw, 10)

  return Number.isFinite(parsed) ? parsed : null
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

  const headline = String(formData.get('headline') ?? '').trim()

  if (!headline) {
    return {
      message: 'Headline is required so scoring and packet generation have a stable role anchor.',
      status: 'error',
    }
  }

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
    headline,
    location_label: asOptionalText(formData.get('locationLabel')) ?? '',
    timezone: asOptionalText(formData.get('timezone')) ?? 'America/Toronto',
    remote_required: formData.get('remoteRequired') === 'on',
    salary_floor_currency: asOptionalText(formData.get('salaryFloorCurrency')) ?? 'USD',
    salary_floor_amount: asOptionalInteger(formData.get('salaryFloorAmount')),
    salary_target_min: asOptionalInteger(formData.get('salaryTargetMin')),
    salary_target_max: asOptionalInteger(formData.get('salaryTargetMax')),
    seniority_level: asOptionalText(formData.get('seniorityLevel')),
    target_roles: asList(formData.get('targetRoles')),
    allowed_adjacent_roles: asList(formData.get('allowedAdjacentRoles')),
    skills: asList(formData.get('skills')),
    tools: asList(formData.get('tools')),
    portfolio_primary_url: asOptionalText(formData.get('portfolioPrimaryUrl')),
    linkedin_url: asOptionalText(formData.get('linkedinUrl')),
    personal_site_url: asOptionalText(formData.get('personalSiteUrl')),
    bio_summary: asOptionalText(formData.get('bioSummary')),
    preferences_notes: asOptionalText(formData.get('preferencesNotes')),
  }

  const resumePayload = {
    id: defaultOperator.resumeMasterId,
    user_id: defaultOperator.userId,
    base_title: headline,
    summary_text: asOptionalText(formData.get('bioSummary')),
    experience_entries: [],
    achievement_bank: [],
    skills_section: asList(formData.get('skills')),
    education_entries: [],
    certifications: [],
    links: {
      linkedin: asOptionalText(formData.get('linkedinUrl')),
      portfolio: asOptionalText(formData.get('portfolioPrimaryUrl')),
      website: asOptionalText(formData.get('personalSiteUrl')),
    },
    source_format: 'json',
    source_content: {
      updatedFrom: 'profile-settings',
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

  revalidatePath('/')
  revalidatePath('/dashboard')
  revalidatePath('/profile')

  return {
    message: 'Internal operator profile saved.',
    status: 'success',
  }
}
