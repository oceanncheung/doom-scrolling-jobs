'use server'

import { refresh, revalidatePath } from 'next/cache'

import { getActiveOperatorContext } from '@/lib/data/operators'
import { getApplicationPacketReview } from '@/lib/data/application-packets'
import {
  packetStatuses,
  workflowStatuses,
  type PacketStatus,
  type WorkflowStatus,
} from '@/lib/domain/types'
import { hasSupabaseServerEnv } from '@/lib/env'
import { generateAndPersistApplicationPacket } from '@/lib/jobs/application-packet-generation'
import { persistPreferenceSignal } from '@/lib/jobs/learning'
import { createClient } from '@/lib/supabase/server'

export interface JobWorkflowActionState {
  message: string
  status: 'error' | 'idle' | 'success'
}

export interface ApplicationPacketActionState {
  message: string
  status: 'error' | 'idle' | 'success'
}

export interface PacketGenerationActionState {
  message: string
  status: 'error' | 'idle' | 'success'
}

function asTextValue(value: FormDataEntryValue | null) {
  return String(value ?? '').trim()
}

function asWorkflowStatus(value: string): WorkflowStatus | null {
  return workflowStatuses.includes(value as WorkflowStatus) ? (value as WorkflowStatus) : null
}

function asOptionalText(value: FormDataEntryValue | null) {
  const text = asTextValue(value)

  return text.length > 0 ? text : null
}

function asFieldArray(formData: FormData, name: string) {
  return formData.getAll(name).map((value) => String(value ?? '').trim())
}

function asList(value: FormDataEntryValue | null) {
  return String(value ?? '')
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function asPersistedId(value: FormDataEntryValue | null) {
  const text = asTextValue(value)

  if (!text || text.startsWith('seed-')) {
    return null
  }

  return text
}

function parseJsonArray<T>(value: FormDataEntryValue | null, fallback: T[]) {
  const text = asTextValue(value)

  if (!text) {
    return fallback
  }

  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? (parsed as T[]) : fallback
  } catch {
    return fallback
  }
}

function asPacketStatus(value: string): PacketStatus {
  return packetStatuses.includes(value as PacketStatus) ? (value as PacketStatus) : 'draft'
}

interface ParsedApplicationAnswer {
  answer_text: string
  answer_variant_short: string
  character_limit: number | null
  field_type: string
  id: string
  question_key: string
  question_text: string
  review_status: 'approved' | 'draft' | 'edited'
  source_context: Record<string, never>
}

function parseApplicationAnswers(formData: FormData) {
  const ids = asFieldArray(formData, 'answerId')
  const questionKeys = asFieldArray(formData, 'questionKey')
  const questionTexts = asFieldArray(formData, 'questionText')
  const fieldTypes = asFieldArray(formData, 'fieldType')
  const answerTexts = asFieldArray(formData, 'answerText')
  const answerVariantShorts = asFieldArray(formData, 'answerVariantShort')
  const reviewStatuses = asFieldArray(formData, 'reviewStatus')
  const characterLimits = asFieldArray(formData, 'characterLimit')
  const count = Math.max(
    ids.length,
    questionKeys.length,
    questionTexts.length,
    fieldTypes.length,
    answerTexts.length,
    answerVariantShorts.length,
    reviewStatuses.length,
    characterLimits.length,
  )

  return Array.from({ length: count }, (_, index): ParsedApplicationAnswer | null => {
    const questionText = questionTexts[index] ?? ''
    const questionKey = questionKeys[index] ?? ''

    if (!questionText && !questionKey) {
      return null
    }

    const reviewStatus = reviewStatuses[index] ?? 'draft'

    return {
      answer_text: answerTexts[index] ?? '',
      answer_variant_short: answerVariantShorts[index] ?? '',
      character_limit: characterLimits[index]
        ? Number.parseInt(characterLimits[index] ?? '', 10) || null
        : null,
      field_type: fieldTypes[index] ?? 'textarea',
      id: asPersistedId(ids[index] ?? null) ?? crypto.randomUUID(),
      question_key: questionKey,
      question_text: questionText,
      review_status:
      reviewStatus === 'edited' || reviewStatus === 'approved' ? reviewStatus : 'draft',
      source_context: {},
    }
  }).filter((item): item is ParsedApplicationAnswer => item !== null)
}

function resolveTargetStatus(formData: FormData) {
  const intent = asTextValue(formData.get('intent'))

  if (intent === 'shortlist') {
    return 'shortlisted' as const
  }

  if (intent === 'dismiss') {
    return 'archived' as const
  }

  return asWorkflowStatus(asTextValue(formData.get('workflowStatus')))
}

function getEventType(targetStatus: WorkflowStatus) {
  if (targetStatus === 'applied') {
    return 'applied' as const
  }

  if (targetStatus === 'follow_up_due') {
    return 'follow_up_due' as const
  }

  return 'status_changed' as const
}

function getSuccessMessage(targetStatus: WorkflowStatus) {
  switch (targetStatus) {
    case 'ranked':
      return 'Job returned to the Potential queue.'
    case 'shortlisted':
      return 'Job saved to the queue.'
    case 'archived':
      return 'Job dismissed from the active queue.'
    case 'preparing':
      return 'Job moved into packet preparation.'
    case 'ready_to_apply':
      return 'Job marked ready.'
    case 'applied':
      return 'Job marked as applied.'
    case 'follow_up_due':
      return 'Follow-up is now due for this job.'
    case 'interview':
      return 'Job moved into interview stage.'
    case 'rejected':
      return 'Job marked as rejected.'
    default:
      return 'Job workflow status saved.'
  }
}

function inferPacketGenerationStatus(record: Record<string, unknown> | null) {
  if (!record) {
    return 'not_started'
  }

  const explicitStatus = asTextValue((record.generation_status as string | undefined) ?? '')

  if (
    explicitStatus === 'not_started' ||
    explicitStatus === 'running' ||
    explicitStatus === 'generated' ||
    explicitStatus === 'failed'
  ) {
    return explicitStatus
  }

  if (
    asTextValue((record.generated_at as string | undefined) ?? '') ||
    asTextValue((record.cover_letter_draft as string | undefined) ?? '') ||
    asTextValue((record.professional_summary as string | undefined) ?? '')
  ) {
    return 'generated'
  }

  return 'not_started'
}

export async function updateJobWorkflow(
  _previousState: JobWorkflowActionState,
  formData: FormData,
): Promise<JobWorkflowActionState> {
  const jobId = asTextValue(formData.get('jobId'))
  const intent = asTextValue(formData.get('intent')) || 'save'
  const sourceContext = asTextValue(formData.get('sourceContext')) || 'workflow-controls'

  if (!jobId) {
    return {
      message: 'This workflow update is missing a job reference.',
      status: 'error',
    }
  }

  if (!hasSupabaseServerEnv()) {
    return {
      message: 'Add the Supabase server environment before saving shortlist or dismiss signals.',
      status: 'error',
    }
  }

  const operatorContext = await getActiveOperatorContext()

  if (!operatorContext) {
    return {
      message: 'Choose an operator before updating workflow status.',
      status: 'error',
    }
  }

  const targetStatus = resolveTargetStatus(formData)

  if (!targetStatus) {
    return {
      message: 'Choose a valid workflow status before saving.',
      status: 'error',
    }
  }

  const supabase = createClient()
  const { data: existingScore, error: existingScoreError } = await supabase
    .from('job_scores')
    .select('id, workflow_status')
    .eq('operator_id', operatorContext.operator.id)
    .eq('job_id', jobId)
    .maybeSingle()

  if (existingScoreError) {
    return {
      message: existingScoreError.message,
      status: 'error',
    }
  }

  if (!existingScore) {
    return {
      message:
        'This job does not have a persisted score row yet, so the workflow status could not be updated.',
      status: 'error',
    }
  }

  const currentStatus = asWorkflowStatus(existingScore.workflow_status)

  if (currentStatus === targetStatus) {
    return {
      message: `This job is already marked ${targetStatus.replaceAll('_', ' ')}.`,
      status: 'success',
    }
  }

  const now = new Date().toISOString()
  const updateResult = await supabase
    .from('job_scores')
    .update({
      last_status_changed_at: now,
      workflow_status: targetStatus,
    })
    .eq('id', existingScore.id)
    .eq('operator_id', operatorContext.operator.id)

  if (updateResult.error) {
    return {
      message: updateResult.error.message,
      status: 'error',
    }
  }

  const eventResult = await supabase.from('application_events').insert({
    operator_id: operatorContext.operator.id,
    user_id: operatorContext.userId,
    job_id: jobId,
    event_type: getEventType(targetStatus),
    from_status: currentStatus,
    to_status: targetStatus,
    event_payload: {
      intent,
      sourceContext,
      targetStatus,
    },
    notes:
      intent === 'dismiss'
        ? 'Dismissed from the ranked queue.'
        : intent === 'shortlist'
          ? 'Moved into the shortlist.'
          : `Workflow status updated to ${targetStatus.replaceAll('_', ' ')}.`,
  })

  await persistPreferenceSignal({
    jobId,
    operatorId: operatorContext.operator.id,
    sourceContext,
    targetStatus,
    userId: operatorContext.userId,
  })

  if (targetStatus === 'shortlisted' || targetStatus === 'preparing') {
    await getApplicationPacketReview(jobId, {
      ensurePacket: true,
      syncQuestionSnapshot: true,
      syncQuestionSnapshotIfStale: true,
    }).catch(() => null)
  }

  revalidatePath('/dashboard')
  revalidatePath(`/jobs/${jobId}`)
  refresh()

  if (eventResult.error) {
    return {
      message: `${getSuccessMessage(targetStatus)} Activity history could not be written: ${eventResult.error.message}`,
      status: 'success',
    }
  }

  return {
    message: getSuccessMessage(targetStatus),
    status: 'success',
  }
}

export async function generateApplicationPacket(
  _previousState: PacketGenerationActionState,
  formData: FormData,
): Promise<PacketGenerationActionState> {
  const jobId = asTextValue(formData.get('jobId'))

  if (!jobId) {
    return {
      message: 'This generation request is missing its job reference.',
      status: 'error',
    }
  }
  const result = await generateAndPersistApplicationPacket(jobId)

  revalidatePath('/dashboard')
  revalidatePath(`/jobs/${jobId}`)
  revalidatePath(`/jobs/${jobId}/packet`)
  refresh()

  return {
    message: result.message,
    status: result.status,
  }
}

export async function saveApplicationPacket(
  _previousState: ApplicationPacketActionState,
  formData: FormData,
): Promise<ApplicationPacketActionState> {
  if (!hasSupabaseServerEnv()) {
    return {
      message:
        'Add the Supabase server environment before saving packet edits. The screen can still show generated packet content without persistence.',
      status: 'error',
    }
  }

  const jobId = asTextValue(formData.get('jobId'))
  const submitIntent = asTextValue(formData.get('submitIntent')) || 'save-review'
  const packetId = asPersistedId(formData.get('packetId')) ?? crypto.randomUUID()
  const resumeVersionId = asPersistedId(formData.get('resumeVersionId')) ?? crypto.randomUUID()
  const suppliedJobScoreId = asPersistedId(formData.get('jobScoreId'))
  const operatorContext = await getActiveOperatorContext()

  if (!jobId) {
    return {
      message: 'The packet save is missing its job reference.',
      status: 'error',
    }
  }

  if (!operatorContext || !operatorContext.resumeMasterId) {
    return {
      message: 'Choose an operator before saving packet prep.',
      status: 'error',
    }
  }

  const supabase = createClient()
  const { data: jobScore, error: jobScoreError } = await supabase
    .from('job_scores')
    .select('id, workflow_status')
    .eq('operator_id', operatorContext.operator.id)
    .eq('job_id', jobId)
    .maybeSingle()

  if (jobScoreError) {
    return {
      message: jobScoreError.message,
      status: 'error',
    }
  }

  const jobScoreId = suppliedJobScoreId ?? jobScore?.id

  if (!jobScoreId) {
    return {
      message:
        'This job does not have a persisted score row yet, so the packet cannot be saved against the application workflow.',
      status: 'error',
    }
  }

  const { data: existingPacket, error: existingPacketError } = await supabase
    .from('application_packets')
    .select('*')
    .eq('operator_id', operatorContext.operator.id)
    .eq('job_id', jobId)
    .maybeSingle()

  if (existingPacketError) {
    return {
      message: existingPacketError.message,
      status: 'error',
    }
  }

  const persistedPacketId = existingPacket?.id ?? packetId
  const persistedResumeVersionId = existingPacket?.resume_version_id ?? resumeVersionId
  const persistedGenerationStatus = inferPacketGenerationStatus(
    (existingPacket as Record<string, unknown> | null) ?? null,
  )
  const now = new Date().toISOString()
  const nextPacketStatus =
    submitIntent === 'mark-ready'
      ? 'ready'
      : submitIntent === 'apply'
        ? 'applied'
        : asPacketStatus(asTextValue(formData.get('packetStatus')))
  const experienceEntries = parseJsonArray(formData.get('resumeExperienceEntriesJson'), [])
  const caseStudySelection = parseJsonArray(formData.get('caseStudySelectionJson'), [])
  const applicationAnswers = parseApplicationAnswers(formData)

  if (!existingPacket) {
    return {
      message: 'Generate content first before marking this application ready.',
      status: 'error',
    }
  }

  if (submitIntent === 'mark-ready' && persistedGenerationStatus !== 'generated') {
    return {
      message: 'Generate the resume, cover letter, and answers before marking this application ready.',
      status: 'error',
    }
  }

  const resumeVersionResult = await supabase.from('resume_versions').upsert(
    {
      application_packet_id: persistedPacketId,
      change_summary_text: asOptionalText(formData.get('resumeChangeSummaryText')),
      experience_entries: experienceEntries,
      export_status: 'draft',
      headline_text: asOptionalText(formData.get('resumeHeadlineText')),
      highlighted_requirements: asList(formData.get('highlightedRequirements')),
      id: persistedResumeVersionId,
      job_id: jobId,
      operator_id: operatorContext.operator.id,
      resume_master_id: operatorContext.resumeMasterId,
      skills_section: asList(formData.get('resumeSkillsSection')),
      summary_text: asOptionalText(formData.get('resumeSummaryText')),
      tailoring_notes: asOptionalText(formData.get('tailoringNotes')),
      user_id: operatorContext.userId,
      version_label: asTextValue(formData.get('resumeVersionLabel')) || 'Packet resume',
    },
    { onConflict: 'id' },
  )

  if (resumeVersionResult.error) {
    return {
      message: resumeVersionResult.error.message,
      status: 'error',
    }
  }

  const packetResult = await supabase.from('application_packets').upsert(
    {
      application_checklist: asList(formData.get('checklistItems')),
      case_study_selection: caseStudySelection,
      cover_letter_draft: asOptionalText(formData.get('coverLetterDraft')),
      cover_letter_summary: asOptionalText(formData.get('coverLetterSummary')),
      generated_at: existingPacket?.generated_at ?? now,
      generation_error: existingPacket.generation_error,
      generation_model: existingPacket.generation_model,
      generation_prompt_version: existingPacket.generation_prompt_version,
      generation_provider: existingPacket.generation_provider,
      generation_status: persistedGenerationStatus,
      id: persistedPacketId,
      job_id: jobId,
      job_score_id: jobScoreId,
      last_reviewed_at: now,
      manual_notes: asOptionalText(formData.get('manualNotes')),
      operator_id: operatorContext.operator.id,
      packet_status: nextPacketStatus,
      portfolio_recommendation: {
        primaryLabel: asTextValue(formData.get('portfolioPrimaryLabel')),
        primaryUrl: asTextValue(formData.get('portfolioPrimaryUrl')),
        rationale: asTextValue(formData.get('portfolioRationale')),
      },
      professional_summary: asOptionalText(formData.get('professionalSummary')),
      question_snapshot_error: existingPacket.question_snapshot_error,
      question_snapshot_refreshed_at: existingPacket.question_snapshot_refreshed_at,
      question_snapshot_status: existingPacket.question_snapshot_status,
      resume_version_id: persistedResumeVersionId,
      user_id: operatorContext.userId,
    },
    { onConflict: 'id' },
  )

  if (packetResult.error) {
    return {
      message: packetResult.error.message,
      status: 'error',
    }
  }

  const deleteAnswersResult = await supabase
    .from('application_answers')
    .delete()
    .eq('application_packet_id', persistedPacketId)

  if (deleteAnswersResult.error) {
    return {
      message: deleteAnswersResult.error.message,
      status: 'error',
    }
  }

  if (applicationAnswers.length > 0) {
    const insertAnswersResult = await supabase.from('application_answers').insert(
      applicationAnswers.map((answer) => ({
        ...answer,
        application_packet_id: persistedPacketId,
        job_id: jobId,
        operator_id: operatorContext.operator.id,
        user_id: operatorContext.userId,
      })),
    )

    if (insertAnswersResult.error) {
      return {
        message: insertAnswersResult.error.message,
        status: 'error',
      }
    }
  }

  const currentWorkflowStatus = asWorkflowStatus(asTextValue(jobScore?.workflow_status))
  const shouldMarkReady = submitIntent === 'mark-ready'
  const shouldMarkPreparing =
    !shouldMarkReady &&
    (currentWorkflowStatus === 'new' ||
      currentWorkflowStatus === 'ranked' ||
      currentWorkflowStatus === 'shortlisted')

  if (shouldMarkReady) {
    await supabase
      .from('job_scores')
      .update({
        last_status_changed_at: now,
        workflow_status: 'ready_to_apply',
      })
      .eq('operator_id', operatorContext.operator.id)
      .eq('job_id', jobId)

    await supabase.from('application_events').insert({
      operator_id: operatorContext.operator.id,
      user_id: operatorContext.userId,
      job_id: jobId,
      event_type: 'status_changed',
      from_status: currentWorkflowStatus,
      to_status: 'ready_to_apply',
      event_payload: {
        sourceContext: 'packet-save',
        submitIntent,
        targetStatus: 'ready_to_apply',
      },
      notes: 'Packet marked ready from the prep workspace.',
    })
  } else if (shouldMarkPreparing) {
    await supabase
      .from('job_scores')
      .update({
        last_status_changed_at: now,
        workflow_status: 'preparing',
      })
      .eq('operator_id', operatorContext.operator.id)
      .eq('job_id', jobId)

    await supabase.from('application_events').insert({
      operator_id: operatorContext.operator.id,
      user_id: operatorContext.userId,
      job_id: jobId,
      event_type: 'status_changed',
      from_status: currentWorkflowStatus,
      to_status: 'preparing',
      event_payload: {
        sourceContext: 'packet-save',
        targetStatus: 'preparing',
      },
      notes: 'Packet work started from the prep workspace.',
    })
  }

  const signalStatus =
    shouldMarkReady
      ? 'ready_to_apply'
      : currentWorkflowStatus === 'ready_to_apply' || currentWorkflowStatus === 'applied'
        ? currentWorkflowStatus
      : currentWorkflowStatus === 'archived' || currentWorkflowStatus === 'rejected'
        ? null
        : 'preparing'

  if (signalStatus) {
    await persistPreferenceSignal({
      jobId,
      operatorId: operatorContext.operator.id,
      sourceContext: 'packet-save',
      targetStatus: signalStatus,
      userId: operatorContext.userId,
    })
  }

  revalidatePath('/dashboard')
  revalidatePath(`/jobs/${jobId}`)
  revalidatePath(`/jobs/${jobId}/packet`)
  refresh()

  return {
    message:
      submitIntent === 'mark-ready'
        ? 'Draft saved and marked ready.'
        : submitIntent === 'apply'
          ? 'Application materials saved and marked applied.'
          : `Draft saved with ${applicationAnswers.length} structured answers.`,
    status: 'success',
  }
}
