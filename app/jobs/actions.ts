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
import type { ActionState } from '@/lib/form/action-state'
import { asOptionalText, asTextValue } from '@/lib/form/parse-helpers'
import { generateAndPersistApplicationPacket } from '@/lib/jobs/application-packet-generation'
import {
  getPacketSaveGuardMessage,
  inferPacketGenerationStatus,
} from '@/lib/jobs/packet-save-guards'
import { persistPreferenceSignal } from '@/lib/jobs/learning'
import {
  asPacketSubmitIntent,
  getNextPacketStatus,
  getPacketWorkflowTargetStatus,
} from '@/lib/jobs/packet-lifecycle'
import {
  asJobWorkflowQuickActionKind,
  getJobWorkflowTargetStatusForQuickAction,
  getWorkflowEventType,
  getWorkflowSuccessMessage,
} from '@/lib/jobs/workflow-actions'
import {
  shouldEnsurePacketWorkspace,
} from '@/lib/jobs/workflow-state'
import { persistJobWorkflowTransition } from '@/lib/jobs/workflow-transition'
import { createClient } from '@/lib/supabase/server'

export type JobWorkflowActionState = ActionState
export type ApplicationPacketActionState = ActionState
export type PacketGenerationActionState = ActionState

const initialJobWorkflowActionState: JobWorkflowActionState = {
  message: '',
  status: 'idle',
}

const MISSING_COVER_LETTER_CHANGE_SUMMARY_COLUMN =
  "Could not find the 'cover_letter_change_summary' column of 'application_packets' in the schema cache"

function asWorkflowStatus(value: string): WorkflowStatus | null {
  return workflowStatuses.includes(value as WorkflowStatus) ? (value as WorkflowStatus) : null
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

function isMissingCoverLetterChangeSummaryColumnError(message?: string | null) {
  return Boolean(message?.includes(MISSING_COVER_LETTER_CHANGE_SUMMARY_COLUMN))
}

async function upsertApplicationPacketRecord(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
) {
  const result = await supabase.from('application_packets').upsert(payload, {
    onConflict: 'id',
  })

  if (
    !result.error ||
    !isMissingCoverLetterChangeSummaryColumnError(String(result.error.message ?? ''))
  ) {
    return result
  }

  const legacyPayload = { ...payload }
  delete legacyPayload.cover_letter_change_summary

  return supabase.from('application_packets').upsert(legacyPayload, {
    onConflict: 'id',
  })
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
  const actionKind = asJobWorkflowQuickActionKind(asTextValue(formData.get('actionKind')))

  if (actionKind) {
    return getJobWorkflowTargetStatusForQuickAction(actionKind)
  }

  const intent = asTextValue(formData.get('intent'))

  if (intent === 'shortlist') {
    return 'shortlisted' as const
  }

  if (intent === 'dismiss') {
    return 'archived' as const
  }

  return asWorkflowStatus(asTextValue(formData.get('workflowStatus')))
}

export async function updateJobWorkflow(
  _previousState: JobWorkflowActionState,
  formData: FormData,
): Promise<JobWorkflowActionState> {
  const jobId = asTextValue(formData.get('jobId'))
  const actionKind = asJobWorkflowQuickActionKind(asTextValue(formData.get('actionKind')))
  const intent = asTextValue(formData.get('intent')) || actionKind || 'save'
  const sourceContext = asTextValue(formData.get('sourceContext')) || 'workflow-controls'

  if (!jobId) {
    return {
      message: 'This workflow update is missing a job reference.',
      status: 'error',
    }
  }

  if (!hasSupabaseServerEnv()) {
    return {
      message: "Job updates aren't available right now.",
      status: 'error',
    }
  }

  const operatorContext = await getActiveOperatorContext()

  if (!operatorContext) {
    return {
      message: 'Choose a workspace before updating this job.',
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
      message: "This job isn't connected to your live queue yet, so its status can't be updated.",
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

  const transitionResult = await persistJobWorkflowTransition({
    actionKind,
    currentStatus,
    eventPayload: {
      actionKind,
      intent,
      sourceContext,
      targetStatus,
    },
    jobId,
    operatorId: operatorContext.operator.id,
    scoreId: existingScore.id,
    supabase,
    targetStatus,
    userId: operatorContext.userId,
  })

  if (transitionResult.updateError) {
    return {
      message: transitionResult.updateError,
      status: 'error',
    }
  }

  await persistPreferenceSignal({
    jobId,
    operatorId: operatorContext.operator.id,
    sourceContext,
    targetStatus,
    userId: operatorContext.userId,
  })

  if (shouldEnsurePacketWorkspace(targetStatus)) {
    await getApplicationPacketReview(jobId, {
      ensurePacket: true,
      syncQuestionSnapshot: true,
      syncQuestionSnapshotIfStale: true,
    }).catch(() => null)
  }

  revalidatePath('/dashboard')
  revalidatePath(`/jobs/${jobId}`)
  refresh()

  if (transitionResult.eventError) {
    return {
      message: `${getWorkflowSuccessMessage(targetStatus)} Activity history could not be written: ${transitionResult.eventError}`,
      status: 'success',
    }
  }

  return {
    message: getWorkflowSuccessMessage(targetStatus),
    status: 'success',
  }
}

export async function applyToJob({
  jobId,
  sourceContext = 'apply-action',
}: {
  jobId: string
  sourceContext?: string
}): Promise<JobWorkflowActionState> {
  const formData = new FormData()
  formData.set('jobId', jobId)
  formData.set('actionKind', 'apply')
  formData.set('sourceContext', sourceContext)

  return updateJobWorkflow(initialJobWorkflowActionState, formData)
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
      message: "Packet saving isn't available right now.",
      status: 'error',
    }
  }

  const jobId = asTextValue(formData.get('jobId'))
  const submitIntent = asPacketSubmitIntent(asTextValue(formData.get('submitIntent')))
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
      message: 'Choose a workspace before saving application materials.',
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
      message: "This job isn't connected to your live queue yet, so application materials can't be saved.",
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
  const nextPacketStatus = getNextPacketStatus({
    currentStatus: asPacketStatus(asTextValue(formData.get('packetStatus'))),
    submitIntent,
  })
  const experienceEntries = parseJsonArray(formData.get('resumeExperienceEntriesJson'), [])
  const caseStudySelection = parseJsonArray(formData.get('caseStudySelectionJson'), [])
  const applicationAnswers = parseApplicationAnswers(formData)

  const packetSaveGuardMessage = getPacketSaveGuardMessage({
    existingPacket: (existingPacket as Record<string, unknown> | null) ?? null,
    submitIntent,
  })

  if (packetSaveGuardMessage) {
    return {
      message: packetSaveGuardMessage,
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

  const packetResult = await upsertApplicationPacketRecord(supabase, {
      application_checklist: asList(formData.get('checklistItems')),
      case_study_selection: caseStudySelection,
      cover_letter_change_summary: asOptionalText(formData.get('coverLetterChangeSummary')),
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
    })

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
  const nextWorkflowStatus = getPacketWorkflowTargetStatus({
    currentWorkflowStatus,
    submitIntent,
  })

  if (nextWorkflowStatus && nextWorkflowStatus !== currentWorkflowStatus) {
    await supabase
      .from('job_scores')
      .update({
        last_status_changed_at: now,
        workflow_status: nextWorkflowStatus,
      })
      .eq('operator_id', operatorContext.operator.id)
      .eq('job_id', jobId)

    await supabase.from('application_events').insert({
      operator_id: operatorContext.operator.id,
      user_id: operatorContext.userId,
      job_id: jobId,
      event_type: getWorkflowEventType(nextWorkflowStatus),
      from_status: currentWorkflowStatus,
      to_status: nextWorkflowStatus,
      event_payload: {
        sourceContext: 'packet-save',
        submitIntent,
        targetStatus: nextWorkflowStatus,
      },
      notes:
        submitIntent === 'mark-ready'
          ? 'Packet marked ready from the prep workspace.'
          : submitIntent === 'apply'
            ? 'Application submitted and moved into Applied from the prep workspace.'
            : 'Packet work started from the prep workspace.',
    })
  }

  if (nextWorkflowStatus) {
    await persistPreferenceSignal({
      jobId,
      operatorId: operatorContext.operator.id,
      sourceContext: 'packet-save',
      targetStatus: nextWorkflowStatus,
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
          ? 'Application materials saved and moved to Applied.'
          : `Draft saved with ${applicationAnswers.length} structured answers.`,
    status: 'success',
  }
}
