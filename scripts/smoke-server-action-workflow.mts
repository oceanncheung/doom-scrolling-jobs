import { randomUUID } from 'node:crypto'

import { chromium } from '@playwright/test'

import { activeOperatorCookieName } from '@/lib/data/operators'
import { hasSupabaseServerEnv } from '@/lib/env'
import { matchesQueueView } from '@/lib/jobs/workflow-state'
import { createClient } from '@/lib/supabase/server'
import { waitForUiSettled } from '@/tests/helpers/auth'

import { getSmokeBaseUrl, getSmokeOperatorId } from './smoke-helpers.mts'

interface ServerActionCheckResult {
  details?: Record<string, unknown>
  name: string
  passed: boolean
  summary: string
}

async function waitForPersistedTransition(options: {
  jobId: string
  operatorId: string
  scoreId: string
  supabase: ReturnType<typeof createClient>
}) {
  const timeoutAt = Date.now() + 8000

  while (Date.now() < timeoutAt) {
    const [{ data: score, error: scoreError }, { data: events, error: eventsError }] = await Promise.all([
      options.supabase
        .from('job_scores')
        .select('workflow_status')
        .eq('id', options.scoreId)
        .eq('operator_id', options.operatorId)
        .maybeSingle(),
      options.supabase
        .from('application_events')
        .select('event_type, from_status, to_status, event_payload, notes')
        .eq('job_id', options.jobId)
        .eq('operator_id', options.operatorId)
        .order('created_at', { ascending: true }),
    ])

    if (scoreError) {
      throw new Error(`Could not load the server-action smoke workflow status: ${scoreError.message}`)
    }

    if (eventsError) {
      throw new Error(`Could not load the server-action smoke event rows: ${eventsError.message}`)
    }

    const firstEvent = events?.[0]
    const archived =
      score?.workflow_status === 'archived' &&
      (events?.length ?? 0) === 1 &&
      firstEvent?.event_type === 'status_changed' &&
      firstEvent?.from_status === 'ranked' &&
      firstEvent?.to_status === 'archived'

    if (archived) {
      return {
        firstEvent,
        score,
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  throw new Error('Timed out waiting for the authenticated server action to persist the archived workflow state.')
}

async function main() {
  if (!hasSupabaseServerEnv()) {
    throw new Error(
      'Authenticated server-action smoke requires Supabase server environment variables because it writes isolated smoke fixtures.',
    )
  }

  const operatorId = await getSmokeOperatorId()
  const supabase = createClient()
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('operator_id', operatorId)
    .maybeSingle()

  if (profileError) {
    throw new Error(`Smoke profile lookup failed: ${profileError.message}`)
  }

  if (!profile?.id) {
    throw new Error(`No user profile is available for smoke operator ${operatorId}.`)
  }

  const tempJobId = randomUUID()
  const tempJobScoreId = randomUUID()
  const harnessSourceJobId = `harness-server-action-${tempJobId}`
  const fixtureLabel = `Harness Server Action ${tempJobId.slice(0, 8)}`
  const results: ServerActionCheckResult[] = []
  const browser = await chromium.launch({ headless: true })

  try {
    const insertJobResult = await supabase.from('jobs').insert({
      application_url: `https://example.com/apply/${harnessSourceJobId}`,
      company_domain: 'example.com',
      company_name: fixtureLabel,
      department: 'Design',
      description_text: 'Isolated harness fixture used for authenticated server-action workflow coverage.',
      duplicate_group_key: harnessSourceJobId,
      employment_type: 'full_time',
      id: tempJobId,
      listing_status: 'active',
      location_label: 'Remote',
      portfolio_required: 'no',
      posted_at: '2026-04-01T12:00:00.000Z',
      preferred_qualifications: [],
      red_flag_notes: [],
      remote_regions: ['Canada'],
      remote_type: 'remote',
      requirements: [],
      salary_currency: 'USD',
      salary_max: 140000,
      salary_min: 120000,
      salary_period: 'annual',
      seniority_label: 'Senior',
      skills_keywords: ['server-action smoke'],
      source_job_id: harnessSourceJobId,
      source_name: 'Harness Smoke',
      source_url: `https://example.com/jobs/${harnessSourceJobId}`,
      title: 'Senior Brand Designer',
      work_auth_notes: 'Harness fixture only.',
    })

    if (insertJobResult.error) {
      throw new Error(`Could not create the isolated server-action smoke job fixture: ${insertJobResult.error.message}`)
    }

    const insertScoreResult = await supabase.from('job_scores').insert({
      effort_score: 2,
      fit_reasons: ['Harness server-action smoke fixture'],
      fit_summary: 'Fixture row for authenticated server-action smoke coverage.',
      id: tempJobScoreId,
      job_id: tempJobId,
      missing_requirements: [],
      operator_id: operatorId,
      penalty_score: 0,
      portfolio_fit_score: 4,
      profile_id: profile.id,
      quality_score: 24,
      recommendation_level: 'strong_apply',
      red_flags: [],
      remote_gate_passed: true,
      role_relevance_score: 18,
      salary_score: 16,
      scam_risk_level: 'low',
      scored_at: '2026-04-01T12:00:00.000Z',
      seniority_score: 9,
      total_score: 82,
      user_id: operatorId,
      workflow_status: 'ranked',
    })

    if (insertScoreResult.error) {
      throw new Error(`Could not create the isolated server-action smoke job score: ${insertScoreResult.error.message}`)
    }

    const baseUrl = getSmokeBaseUrl()
    const context = await browser.newContext()
    await context.addCookies([
      {
        name: activeOperatorCookieName,
        url: baseUrl,
        value: operatorId,
      },
    ])

    const page = await context.newPage()

    try {
      await page.goto(`${baseUrl}/jobs/${tempJobId}`, { waitUntil: 'networkidle' })
      await waitForUiSettled(page)

      const skipButton = page.locator(
        '.job-overview-actions .stage-action-form:has(input[name="actionKind"][value="skip"]) button',
      )
      await skipButton.waitFor({ state: 'visible', timeout: 5000 })
      await skipButton.click()

      const { firstEvent, score } = await waitForPersistedTransition({
        jobId: tempJobId,
        operatorId,
        scoreId: tempJobScoreId,
        supabase,
      })

      const passed =
        score?.workflow_status === 'archived' &&
        firstEvent?.event_type === 'status_changed' &&
        firstEvent?.from_status === 'ranked' &&
        firstEvent?.to_status === 'archived' &&
        matchesQueueView('archived', 'archive')

      results.push({
        details: {
          eventCount: 1,
          eventPayload: firstEvent?.event_payload ?? null,
          eventType: firstEvent?.event_type ?? null,
          queueView: 'archive',
          workflowStatus: score?.workflow_status ?? null,
        },
        name: 'authenticated-skip-to-archive',
        passed,
        summary:
          'The real authenticated updateJobWorkflow server action archives a ranked job, writes a status-change event, and lands in the archive queue family.',
      })

      if (!passed) {
        throw new Error(
          'The authenticated server action did not persist the expected archived workflow state and event.',
        )
      }
    } finally {
      await context.close()
    }
  } finally {
    await browser.close()
    await supabase.from('application_events').delete().eq('job_id', tempJobId).eq('operator_id', operatorId)
    await supabase.from('job_scores').delete().eq('id', tempJobScoreId).eq('operator_id', operatorId)
    await supabase.from('jobs').delete().eq('id', tempJobId)
  }

  return {
    fixture: {
      jobId: tempJobId,
      jobScoreId: tempJobScoreId,
      operatorId,
      sourceContext: 'job-flow',
    },
    passed: results.every((result) => result.passed),
    results,
  }
}

try {
  const output = await main()
  console.log(JSON.stringify(output, null, 2))

  if (!output.passed) {
    process.exit(1)
  }
} catch (error) {
  console.log(
    JSON.stringify(
      {
        passed: false,
        results: [
          {
            details: {
              message: error instanceof Error ? error.message : String(error),
            },
            name: 'authenticated-server-action-workflow',
            passed: false,
            summary: 'The harness could not complete the authenticated server-action workflow smoke.',
          },
        ],
      },
      null,
      2,
    ),
  )
  process.exit(1)
}
