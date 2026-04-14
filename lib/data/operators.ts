import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { defaultOperator } from '@/lib/config/runtime'
import type { OperatorRecord } from '@/lib/domain/types'
import { hasSupabaseServerEnv } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export const activeOperatorCookieName = 'dsj-active-operator'

export interface OperatorSessionState {
  activeOperator?: OperatorRecord
  issue?: string
  needsSelection: boolean
  needsSetup: boolean
  operators: OperatorRecord[]
  source: 'database' | 'seed'
}

export interface ActiveOperatorContext {
  coverLetterMasterId: string
  operator: OperatorRecord
  profileId: string
  resumeMasterId: string
  userId: string
}

const seededOperator: OperatorRecord = {
  displayName: 'Internal Operator',
  email: 'internal@doomscrollingjobs.local',
  id: defaultOperator.userId,
  slug: 'internal-operator',
  userId: defaultOperator.userId,
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeOperatorRow(value: unknown): OperatorRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const id = asString(record.id)
  const email = asString(record.email)
  const slug = asString(record.slug)

  if (!id || !email || !slug) {
    return null
  }

  return {
    createdAt: asString(record.created_at) || undefined,
    displayName: asString(record.display_name) || email,
    email,
    id,
    slug,
    userId: id,
  }
}

async function loadOperators() {
  if (!hasSupabaseServerEnv()) {
    return {
      operators: [seededOperator],
      source: 'seed' as const,
    }
  }

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('operators')
      .select('id, display_name, email, slug, created_at')
      .order('display_name', { ascending: true })

    if (error || !data || data.length === 0) {
      return {
        issue: error?.message,
        operators: [],
        source: 'database' as const,
      }
    }

    return {
      operators: data
      .map((row) => normalizeOperatorRow(row))
      .filter((row): row is OperatorRecord => row !== null),
      source: 'database' as const,
    }
  } catch {
    return {
      issue: 'Operator storage is not ready yet.',
      operators: [],
      source: 'database' as const,
    }
  }
}

export async function listOperators(): Promise<OperatorRecord[]> {
  const result = await loadOperators()
  return result.operators
}

export async function getOperatorSessionState(): Promise<OperatorSessionState> {
  if (!hasSupabaseServerEnv()) {
    return {
      activeOperator: seededOperator,
      needsSelection: false,
      needsSetup: false,
      operators: [seededOperator],
      source: 'seed',
    }
  }

  const { issue, operators } = await loadOperators()

  if (operators.length === 0) {
    return {
      issue,
      needsSelection: false,
      needsSetup: true,
      operators: [],
      source: 'database',
    }
  }

  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(activeOperatorCookieName)?.value ?? ''
  const activeOperator = operators.find(
    (operator) => operator.id === cookieValue || operator.slug === cookieValue,
  )

  if (activeOperator) {
    return {
      activeOperator,
      needsSelection: false,
      needsSetup: false,
      operators,
      source: 'database',
    }
  }

  return {
    needsSelection: true,
    needsSetup: false,
    operators,
    source: 'database',
  }
}

export async function requireActiveOperatorSelection() {
  const session = await getOperatorSessionState()

  if (!session.activeOperator) {
    redirect('/')
  }

  return session.activeOperator
}

export async function getActiveOperatorContext(): Promise<ActiveOperatorContext | null> {
  const session = await getOperatorSessionState()

  if (!session.activeOperator) {
    return null
  }

  if (!hasSupabaseServerEnv()) {
    return {
      coverLetterMasterId: '',
      operator: session.activeOperator,
      profileId: defaultOperator.profileId,
      resumeMasterId: defaultOperator.resumeMasterId,
      userId: defaultOperator.userId,
    }
  }

  const supabase = createClient()
  const [profileResult, resumeResult, coverLetterResult] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('id')
      .eq('operator_id', session.activeOperator.id)
      .maybeSingle(),
    supabase
      .from('resume_master')
      .select('id')
      .eq('operator_id', session.activeOperator.id)
      .maybeSingle(),
    supabase
      .from('cover_letter_master')
      .select('id')
      .eq('operator_id', session.activeOperator.id)
      .maybeSingle(),
  ])

  return {
    coverLetterMasterId: asString(coverLetterResult.data?.id),
    operator: session.activeOperator,
    profileId: asString(profileResult.data?.id),
    resumeMasterId: asString(resumeResult.data?.id),
    userId: session.activeOperator.userId,
  }
}
