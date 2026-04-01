import 'server-only'

import { defaultOperator } from '@/lib/config/runtime'
import type { OperatorProfileRecord } from '@/lib/domain/types'
import { hasSupabaseServerEnv } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

type ProfileSource = 'seed' | 'database' | 'database-fallback'

export interface OperatorProfileResult {
  issue?: string
  profile: OperatorProfileRecord
  source: ProfileSource
}

const seededProfile: OperatorProfileRecord = {
  userId: defaultOperator.userId,
  profileId: defaultOperator.profileId,
  displayName: 'Internal Operator',
  email: 'internal@doomscrollingjobs.local',
  headline: 'Graphic Designer',
  locationLabel: 'Toronto, Canada',
  timezone: 'America/Toronto',
  remoteRequired: true,
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
  skills: ['visual systems', 'brand identity', 'presentation design', 'campaign design'],
  tools: ['Figma', 'Adobe Creative Suite', 'Photoshop', 'Illustrator'],
  portfolioPrimaryUrl: '',
  linkedinUrl: '',
  personalSiteUrl: '',
  bioSummary:
    'Single internal operator profile used to rank remote design opportunities and prepare high-quality manual applications.',
  preferencesNotes:
    'Internal single-user mode for Ocean / Alvis. Replace these defaults as the real operator profile is filled in.',
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function asNumericString(value: unknown) {
  return typeof value === 'number' ? String(value) : ''
}

export async function getOperatorProfile(): Promise<OperatorProfileResult> {
  if (!hasSupabaseServerEnv()) {
    return {
      issue:
        'Supabase server environment variables are not configured yet, so this screen is showing the seeded internal fallback profile.',
      profile: seededProfile,
      source: 'seed',
    }
  }

  const supabase = createClient()

  const [userResult, profileResult] = await Promise.all([
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
  ])

  if (userResult.error || profileResult.error || !profileResult.data) {
    return {
      issue:
        'The internal operator seed is not available in Supabase yet. Apply the migration and seed to persist changes.',
      profile: seededProfile,
      source: 'database-fallback',
    }
  }

  const user = userResult.data
  const profile = profileResult.data

  return {
    profile: {
      userId: user?.id ?? seededProfile.userId,
      profileId: profile.id ?? seededProfile.profileId,
      displayName: asString(user?.display_name) || seededProfile.displayName,
      email: asString(user?.email) || seededProfile.email,
      headline: asString(profile.headline) || seededProfile.headline,
      locationLabel: asString(profile.location_label),
      timezone: asString(profile.timezone) || seededProfile.timezone,
      remoteRequired:
        typeof profile.remote_required === 'boolean'
          ? profile.remote_required
          : seededProfile.remoteRequired,
      salaryFloorCurrency:
        asString(profile.salary_floor_currency) || seededProfile.salaryFloorCurrency,
      salaryFloorAmount: asNumericString(profile.salary_floor_amount),
      salaryTargetMin: asNumericString(profile.salary_target_min),
      salaryTargetMax: asNumericString(profile.salary_target_max),
      seniorityLevel: asString(profile.seniority_level),
      targetRoles: asStringArray(profile.target_roles),
      allowedAdjacentRoles: asStringArray(profile.allowed_adjacent_roles),
      skills: asStringArray(profile.skills),
      tools: asStringArray(profile.tools),
      portfolioPrimaryUrl: asString(profile.portfolio_primary_url),
      linkedinUrl: asString(profile.linkedin_url),
      personalSiteUrl: asString(profile.personal_site_url),
      bioSummary: asString(profile.bio_summary),
      preferencesNotes: asString(profile.preferences_notes),
    },
    source: 'database',
  }
}
