import { randomUUID } from 'node:crypto'

import { hasSupabaseServerEnv } from '@/lib/env'
import { getWorkflowQueueView, matchesQueueView } from '@/lib/jobs/workflow-state'
import { getJobWorkflowTargetStatusForQuickAction } from '@/lib/jobs/workflow-actions'
import { persistJobWorkflowTransition } from '@/lib/jobs/workflow-transition'
import { createClient } from '@/lib/supabase/server'

import { getSmokeOperatorId } from './smoke-helpers.mts'

interface TransitionCheckResult {
  details?: Record<string, unknown>
  name: string
  passed: boolean
  summary: string
}

async function main() {
  if (!hasSupabaseServerEnv()) {
    throw new Error(
      'Workflow transition smoke requires Supabase server environment variables because it writes isolated smoke fixtures.',
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
  const harnessSourceJobId = `harness-workflow-transition-${tempJobId}`
  const fixtureLabel = `Harness Workflow Transition ${tempJobId.slice(0, 8)}`
  const sourceContext = 'harness-workflow-transition'
  const results: TransitionCheckResult[] = []

  try {
    const insertJobResult = await supabase.from('jobs').insert({
      application_url: `https://example.com/apply/${harnessSourceJobId}`,
      company_domain: 'example.com',
      company_name: fixtureLabel,
      department: 'Design',
      description_text: 'Isolated harness fixture used for workflow transition smoke coverage.',
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
      skills_keywords: ['workflow smoke'],
      source_job_id: harnessSourceJobId,
      source_name: 'Harness Smoke',
      source_url: `https://example.com/jobs/${harnessSourceJobId}`,
      title: 'Senior Brand Designer',
      work_auth_notes: 'Harness fixture only.',
    })

    if (insertJobResult.error) {
      throw new Error(`Could not create the isolated smoke job fixture: ${insertJobResult.error.message}`)
    }

    const insertScoreResult = await supabase.from('job_scores').insert({
      effort_score: 2,
      fit_reasons: ['Harness smoke fixture'],
      fit_summary: 'Fixture row for workflow transition smoke coverage.',
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
      throw new Error(`Could not create the isolated smoke job score: ${insertScoreResult.error.message}`)
    }

    const firstTargetStatus = getJobWorkflowTargetStatusForQuickAction('save')
    const firstTransition = await persistJobWorkflowTransition({
      actionKind: 'save',
      currentStatus: 'ranked',
      eventPayload: {
        actionKind: 'save',
        intent: 'save',
        sourceContext,
        targetStatus: firstTargetStatus,
      },
      jobId: tempJobId,
      operatorId,
      scoreId: tempJobScoreId,
      supabase,
      targetStatus: firstTargetStatus,
      userId: operatorId,
    })

    if (firstTransition.updateError || firstTransition.eventError) {
      throw new Error(firstTransition.updateError ?? firstTransition.eventError ?? 'First workflow transition failed.')
    }

    const { data: firstScore, error: firstScoreError } = await supabase
      .from('job_scores')
      .select('workflow_status')
      .eq('id', tempJobScoreId)
      .eq('operator_id', operatorId)
      .maybeSingle()

    if (firstScoreError) {
      throw new Error(`Could not load the saved smoke workflow status: ${firstScoreError.message}`)
    }

    const { data: firstEvents, error: firstEventsError } = await supabase
      .from('application_events')
      .select('event_type, from_status, to_status, event_payload, notes')
      .eq('job_id', tempJobId)
      .eq('operator_id', operatorId)
      .order('created_at', { ascending: true })

    if (firstEventsError) {
      throw new Error(`Could not load the first workflow event: ${firstEventsError.message}`)
    }

    const firstEvent = firstEvents?.[0]
    const firstQueueView = getWorkflowQueueView(firstTargetStatus)
    const firstPassed =
      firstScore?.workflow_status === firstTargetStatus &&
      (firstEvents?.length ?? 0) === 1 &&
      firstEvent?.from_status === 'ranked' &&
      firstEvent?.to_status === firstTargetStatus &&
      firstEvent?.event_type === 'status_changed' &&
      matchesQueueView(firstTargetStatus, 'saved')

    results.push({
      details: {
        eventCount: firstEvents?.length ?? 0,
        eventType: firstEvent?.event_type ?? null,
        queueView: firstQueueView,
        workflowStatus: firstScore?.workflow_status ?? null,
      },
      name: 'ranked-to-shortlisted',
      passed: firstPassed,
      summary: 'The smoke job moves from ranked to shortlisted, writes a status-change event, and lands in the saved queue family.',
    })

    if (!firstPassed) {
      throw new Error('The ranked -> shortlisted transition did not persist the expected workflow state and event.')
    }

    const secondTargetStatus = getJobWorkflowTargetStatusForQuickAction('archive')
    const secondTransition = await persistJobWorkflowTransition({
      actionKind: 'archive',
      currentStatus: firstTargetStatus,
      eventPayload: {
        actionKind: 'archive',
        intent: 'archive',
        sourceContext,
        targetStatus: secondTargetStatus,
      },
      jobId: tempJobId,
      operatorId,
      scoreId: tempJobScoreId,
      supabase,
      targetStatus: secondTargetStatus,
      userId: operatorId,
    })

    if (secondTransition.updateError || secondTransition.eventError) {
      throw new Error(secondTransition.updateError ?? secondTransition.eventError ?? 'Second workflow transition failed.')
    }

    const { data: secondScore, error: secondScoreError } = await supabase
      .from('job_scores')
      .select('workflow_status')
      .eq('id', tempJobScoreId)
      .eq('operator_id', operatorId)
      .maybeSingle()

    if (secondScoreError) {
      throw new Error(`Could not load the archived smoke workflow status: ${secondScoreError.message}`)
    }

    const { data: secondEvents, error: secondEventsError } = await supabase
      .from('application_events')
      .select('event_type, from_status, to_status, event_payload, notes')
      .eq('job_id', tempJobId)
      .eq('operator_id', operatorId)
      .order('created_at', { ascending: true })

    if (secondEventsError) {
      throw new Error(`Could not load the archived workflow event: ${secondEventsError.message}`)
    }

    const secondEvent = secondEvents?.[1]
    const secondQueueView = getWorkflowQueueView(secondTargetStatus)
    const secondPassed =
      secondScore?.workflow_status === secondTargetStatus &&
      (secondEvents?.length ?? 0) === 2 &&
      secondEvent?.from_status === firstTargetStatus &&
      secondEvent?.to_status === secondTargetStatus &&
      secondEvent?.event_type === 'status_changed' &&
      matchesQueueView(secondTargetStatus, 'archive')

    results.push({
      details: {
        eventCount: secondEvents?.length ?? 0,
        eventType: secondEvent?.event_type ?? null,
        queueView: secondQueueView,
        workflowStatus: secondScore?.workflow_status ?? null,
      },
      name: 'shortlisted-to-archived',
      passed: secondPassed,
      summary: 'The smoke job moves from shortlisted to archived, writes a second status-change event, and lands in the archive queue family.',
    })

    if (!secondPassed) {
      throw new Error('The shortlisted -> archived transition did not persist the expected workflow state and event.')
    }
  } finally {
    await supabase.from('application_events').delete().eq('job_id', tempJobId).eq('operator_id', operatorId)
    await supabase.from('job_scores').delete().eq('id', tempJobScoreId).eq('operator_id', operatorId)
    await supabase.from('jobs').delete().eq('id', tempJobId)
  }

  return {
    fixture: {
      jobId: tempJobId,
      jobScoreId: tempJobScoreId,
      operatorId,
      sourceContext,
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
            name: 'workflow-transition-round-trip',
            passed: false,
            summary: 'The harness could not complete the isolated workflow transition round-trip.',
          },
        ],
      },
      null,
      2,
    ),
  )
  process.exit(1)
}
