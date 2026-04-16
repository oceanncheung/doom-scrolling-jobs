import { randomUUID } from 'node:crypto'

import { hasSupabaseServerEnv } from '@/lib/env'
import {
  generatedContentRequiredGuardMessage,
  getPacketSaveGuardMessage,
  inferPacketGenerationStatus,
} from '@/lib/jobs/packet-save-guards'
import { getNextPacketStatus, getPacketWorkflowTargetStatus } from '@/lib/jobs/packet-lifecycle'
import { getWorkflowEventType } from '@/lib/jobs/workflow-actions'
import { createClient } from '@/lib/supabase/server'

import { getSmokeOperatorId } from './smoke-helpers.mts'

interface PacketCheckResult {
  details?: Record<string, unknown>
  name: string
  passed: boolean
  summary: string
}

const missingCoverLetterChangeSummaryColumn =
  "Could not find the 'cover_letter_change_summary' column of 'application_packets' in the schema cache"

async function updatePacketDraftWithLegacyFallback({
  operatorId,
  packetId,
  payload,
  supabase,
}: {
  operatorId: string
  packetId: string
  payload: Record<string, unknown>
  supabase: ReturnType<typeof createClient>
}) {
  const result = await supabase
    .from('application_packets')
    .update(payload)
    .eq('id', packetId)
    .eq('operator_id', operatorId)

  if (!result.error || !String(result.error.message ?? '').includes(missingCoverLetterChangeSummaryColumn)) {
    return result
  }

  const legacyPayload = { ...payload }
  delete legacyPayload.cover_letter_change_summary

  return supabase
    .from('application_packets')
    .update(legacyPayload)
    .eq('id', packetId)
    .eq('operator_id', operatorId)
}

async function main() {
  if (!hasSupabaseServerEnv()) {
    throw new Error(
      'Packet persistence smoke requires Supabase server environment variables because it writes isolated packet fixtures.',
    )
  }

  const operatorId = await getSmokeOperatorId()
  const supabase = createClient()
  const [{ data: profile, error: profileError }, { data: resumeMaster, error: resumeMasterError }] = await Promise.all([
    supabase.from('user_profiles').select('id').eq('operator_id', operatorId).maybeSingle(),
    supabase.from('resume_master').select('id').eq('operator_id', operatorId).maybeSingle(),
  ])

  if (profileError) {
    throw new Error(`Smoke profile lookup failed: ${profileError.message}`)
  }

  if (resumeMasterError) {
    throw new Error(`Smoke resume master lookup failed: ${resumeMasterError.message}`)
  }

  if (!profile?.id) {
    throw new Error(`No user profile is available for smoke operator ${operatorId}.`)
  }

  if (!resumeMaster?.id) {
    throw new Error(`No resume master is available for smoke operator ${operatorId}.`)
  }

  const tempJobId = randomUUID()
  const tempJobScoreId = randomUUID()
  const tempPacketId = randomUUID()
  const tempResumeVersionId = randomUUID()
  const harnessSourceJobId = `harness-packet-persistence-${tempJobId}`
  const fixtureLabel = `Harness Packet Persistence ${tempJobId.slice(0, 8)}`
  const now = new Date().toISOString()
  const packetStatus = 'draft'
  const sourceContext = 'harness-packet-persistence'
  const results: PacketCheckResult[] = []

  try {
    const insertJobResult = await supabase.from('jobs').insert({
      application_url: `https://example.com/apply/${harnessSourceJobId}`,
      company_domain: 'example.com',
      company_name: fixtureLabel,
      department: 'Design',
      description_text: 'Isolated harness fixture used for packet persistence smoke coverage.',
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
      skills_keywords: ['packet smoke'],
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
      fit_summary: 'Fixture row for packet persistence smoke coverage.',
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

    const createPacketResult = await supabase.from('application_packets').insert({
      application_checklist: ['Confirm portfolio case study'],
      case_study_selection: [],
      generation_status: 'not_started',
      id: tempPacketId,
      job_focus_summary: 'Harness packet focus summary',
      job_id: tempJobId,
      job_score_id: tempJobScoreId,
      job_summary: 'Harness packet summary',
      operator_id: operatorId,
      packet_status: packetStatus,
      portfolio_recommendation: {
        primaryLabel: 'Primary case study',
        primaryUrl: 'https://example.com/portfolio/case-study',
        rationale: 'Stable harness case study recommendation.',
      },
      question_snapshot_status: 'not_started',
      user_id: operatorId,
    })

    if (createPacketResult.error) {
      throw new Error(`Could not create the isolated packet workspace: ${createPacketResult.error.message}`)
    }

    const { data: existingPacketRow, error: existingPacketError } = await supabase
      .from('application_packets')
      .select('*')
      .eq('id', tempPacketId)
      .eq('operator_id', operatorId)
      .maybeSingle()

    if (existingPacketError || !existingPacketRow) {
      throw new Error(
        `Could not load the isolated packet workspace: ${existingPacketError?.message ?? 'Packet row missing.'}`,
      )
    }

    const guardMessage = getPacketSaveGuardMessage({
      existingPacket: existingPacketRow as Record<string, unknown>,
      submitIntent: 'mark-ready',
    })

    const guardPassed =
      guardMessage === generatedContentRequiredGuardMessage &&
      inferPacketGenerationStatus(existingPacketRow as Record<string, unknown>) === 'not_started'

    results.push({
      details: {
        generationStatus: inferPacketGenerationStatus(existingPacketRow as Record<string, unknown>),
        guardMessage,
      },
      name: 'mark-ready-guardrail',
      passed: guardPassed,
      summary: 'Marking a packet ready before generation is rejected with the expected guardrail message.',
    })

    if (!guardPassed) {
      throw new Error('The packet ready-state guardrail did not return the expected message.')
    }

    const nextPacketStatus = getNextPacketStatus({
      currentStatus: packetStatus,
      submitIntent: 'save-review',
    })
    const experienceEntries = [
      {
        companyName: 'Harness Studio',
        endDate: '2026-03',
        highlights: ['Built stable workflow fixtures'],
        locationLabel: 'Remote',
        roleTitle: 'Brand Designer',
        startDate: '2025-01',
        summary: 'Owned workflow harness stability.',
      },
    ]
    const highlightedRequirements = ['Strong portfolio', 'Comfort with remote teams']
    const skillsSection = ['Brand systems', 'Figma']
    const answers = [
      {
        answer_text: 'I build stable workflow harnesses.',
        answer_variant_short: 'Stable harness builder',
        character_limit: 280,
        field_type: 'textarea',
        id: randomUUID(),
        question_key: 'why-fit',
        question_text: 'Why are you a fit?',
        review_status: 'draft',
        source_context: {},
      },
    ]

    const resumeVersionResult = await supabase.from('resume_versions').upsert(
      {
        application_packet_id: tempPacketId,
        change_summary_text: 'Focused the experience on harness stabilization.',
        experience_entries: experienceEntries,
        export_status: 'draft',
        headline_text: 'Senior Brand Designer',
        highlighted_requirements: highlightedRequirements,
        id: tempResumeVersionId,
        job_id: tempJobId,
        operator_id: operatorId,
        resume_master_id: resumeMaster.id,
        skills_section: skillsSection,
        summary_text: 'Harness-focused summary.',
        tailoring_notes: 'Deterministic packet save smoke.',
        user_id: operatorId,
        version_label: 'Harness packet resume',
      },
      { onConflict: 'id' },
    )

    if (resumeVersionResult.error) {
      throw new Error(`Could not persist the smoke resume version: ${resumeVersionResult.error.message}`)
    }

    const packetResult = await updatePacketDraftWithLegacyFallback({
      operatorId,
      packetId: tempPacketId,
      payload: {
        application_checklist: ['Confirm portfolio case study', 'Proofread cover letter'],
        case_study_selection: [],
        cover_letter_change_summary: 'Adjusted opening paragraph for the harness fixture.',
        cover_letter_draft: 'Harness cover letter draft.',
        cover_letter_summary: 'Harness cover letter summary.',
        last_reviewed_at: now,
        manual_notes: 'Harness manual notes.',
        packet_status: nextPacketStatus,
        professional_summary: 'Harness professional summary.',
        resume_version_id: tempResumeVersionId,
      },
      supabase,
    })

    if (packetResult.error) {
      throw new Error(`Could not persist the smoke packet draft: ${packetResult.error.message}`)
    }

    const deleteAnswersResult = await supabase
      .from('application_answers')
      .delete()
      .eq('application_packet_id', tempPacketId)

    if (deleteAnswersResult.error) {
      throw new Error(`Could not clear previous smoke answers: ${deleteAnswersResult.error.message}`)
    }

    const insertAnswersResult = await supabase.from('application_answers').insert(
      answers.map((answer) => ({
        ...answer,
        application_packet_id: tempPacketId,
        job_id: tempJobId,
        operator_id: operatorId,
        user_id: operatorId,
      })),
    )

    if (insertAnswersResult.error) {
      throw new Error(`Could not persist the smoke application answers: ${insertAnswersResult.error.message}`)
    }

    const nextWorkflowStatus = getPacketWorkflowTargetStatus({
      currentWorkflowStatus: 'ranked',
      submitIntent: 'save-review',
    })

    if (!nextWorkflowStatus) {
      throw new Error('The packet save smoke could not resolve the next workflow status.')
    }

    const workflowUpdateResult = await supabase
      .from('job_scores')
      .update({
        last_status_changed_at: now,
        workflow_status: nextWorkflowStatus,
      })
      .eq('id', tempJobScoreId)
      .eq('operator_id', operatorId)

    if (workflowUpdateResult.error) {
      throw new Error(`Could not persist the smoke packet workflow status: ${workflowUpdateResult.error.message}`)
    }

    const eventInsertResult = await supabase.from('application_events').insert({
      event_payload: {
        sourceContext,
        submitIntent: 'save-review',
        targetStatus: nextWorkflowStatus,
      },
      event_type: getWorkflowEventType(nextWorkflowStatus),
      from_status: 'ranked',
      job_id: tempJobId,
      notes: 'Packet work started from the prep workspace.',
      operator_id: operatorId,
      to_status: nextWorkflowStatus,
      user_id: operatorId,
    })

    if (eventInsertResult.error) {
      throw new Error(`Could not persist the smoke packet workflow event: ${eventInsertResult.error.message}`)
    }

    const [{ data: persistedPacket, error: persistedPacketError }, { data: persistedResume, error: persistedResumeError }, { data: persistedAnswers, error: persistedAnswersError }, { data: persistedScore, error: persistedScoreError }, { data: persistedEvents, error: persistedEventsError }] =
      await Promise.all([
        supabase
          .from('application_packets')
          .select(
            'id, resume_version_id, packet_status, generation_status, manual_notes, professional_summary, last_reviewed_at',
          )
          .eq('id', tempPacketId)
          .eq('operator_id', operatorId)
          .maybeSingle(),
        supabase
          .from('resume_versions')
          .select('id, application_packet_id, summary_text, headline_text, highlighted_requirements, skills_section')
          .eq('id', tempResumeVersionId)
          .eq('operator_id', operatorId)
          .maybeSingle(),
        supabase
          .from('application_answers')
          .select('id, question_key, question_text, answer_text, answer_variant_short')
          .eq('application_packet_id', tempPacketId)
          .eq('operator_id', operatorId),
        supabase
          .from('job_scores')
          .select('workflow_status')
          .eq('id', tempJobScoreId)
          .eq('operator_id', operatorId)
          .maybeSingle(),
        supabase
          .from('application_events')
          .select('event_type, from_status, to_status, event_payload, notes')
          .eq('job_id', tempJobId)
          .eq('operator_id', operatorId)
          .order('created_at', { ascending: true }),
      ])

    if (persistedPacketError || !persistedPacket) {
      throw new Error(`Could not reload the persisted smoke packet: ${persistedPacketError?.message ?? 'Missing packet row.'}`)
    }

    if (persistedResumeError || !persistedResume) {
      throw new Error(`Could not reload the persisted smoke resume version: ${persistedResumeError?.message ?? 'Missing resume row.'}`)
    }

    if (persistedAnswersError) {
      throw new Error(`Could not reload the persisted smoke answers: ${persistedAnswersError.message}`)
    }

    if (persistedScoreError || !persistedScore) {
      throw new Error(`Could not reload the persisted smoke job score: ${persistedScoreError?.message ?? 'Missing score row.'}`)
    }

    if (persistedEventsError) {
      throw new Error(`Could not reload the persisted smoke events: ${persistedEventsError.message}`)
    }

    const persistencePassed =
      persistedPacket.resume_version_id === tempResumeVersionId &&
      persistedPacket.packet_status === 'draft' &&
      persistedPacket.generation_status === 'not_started' &&
      persistedPacket.manual_notes === 'Harness manual notes.' &&
      persistedPacket.professional_summary === 'Harness professional summary.' &&
      persistedResume.application_packet_id === tempPacketId &&
      persistedResume.summary_text === 'Harness-focused summary.' &&
      persistedResume.headline_text === 'Senior Brand Designer' &&
      Array.isArray(persistedAnswers) &&
      persistedAnswers.length === 1 &&
      persistedAnswers[0]?.question_key === 'why-fit' &&
      persistedScore.workflow_status === 'preparing' &&
      Array.isArray(persistedEvents) &&
      persistedEvents.length === 1 &&
      persistedEvents[0]?.event_type === 'status_changed' &&
      persistedEvents[0]?.from_status === 'ranked' &&
      persistedEvents[0]?.to_status === 'preparing'

    results.push({
      details: {
        answerCount: persistedAnswers?.length ?? 0,
        eventCount: persistedEvents?.length ?? 0,
        packetGenerationStatus: persistedPacket.generation_status,
        packetStatus: persistedPacket.packet_status,
        resumeVersionId: persistedPacket.resume_version_id,
        workflowStatus: persistedScore.workflow_status,
      },
      name: 'draft-persistence',
      passed: persistencePassed,
      summary:
        'Draft packet save persists application_packets, resume_versions, application_answers, and the expected packet workflow transition.',
    })

    if (!persistencePassed) {
      throw new Error('The packet draft persistence smoke did not persist the expected records and workflow state.')
    }
  } finally {
    await supabase.from('application_answers').delete().eq('application_packet_id', tempPacketId).eq('operator_id', operatorId)
    await supabase.from('application_events').delete().eq('job_id', tempJobId).eq('operator_id', operatorId)
    await supabase.from('application_packets').delete().eq('id', tempPacketId).eq('operator_id', operatorId)
    await supabase.from('resume_versions').delete().eq('id', tempResumeVersionId).eq('operator_id', operatorId)
    await supabase.from('job_scores').delete().eq('id', tempJobScoreId).eq('operator_id', operatorId)
    await supabase.from('jobs').delete().eq('id', tempJobId)
  }

  return {
    fixture: {
      jobId: tempJobId,
      operatorId,
      packetId: tempPacketId,
      resumeVersionId: tempResumeVersionId,
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
            name: 'packet-persistence',
            passed: false,
            summary: 'The harness could not complete the isolated packet persistence smoke.',
          },
        ],
      },
      null,
      2,
    ),
  )
  process.exit(1)
}
