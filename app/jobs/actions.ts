'use server'

import { refresh, revalidatePath } from 'next/cache'

import { defaultOperator } from '@/lib/config/runtime'
import {
  packetStatuses,
  workflowStatuses,
  type PacketStatus,
  type WorkflowStatus,
} from '@/lib/domain/types'
import { hasSupabaseServerEnv } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export interface JobWorkflowActionState {
  message: string
  status: 'error' | 'idle' | 'success'
}

export interface ApplicationPacketActionState {
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
    case 'shortlisted':
      return 'Job shortlisted and saved to the workflow queue.'
    case 'archived':
      return 'Job dismissed from the active queue.'
    case 'preparing':
      return 'Job moved into packet preparation.'
    case 'ready_to_apply':
      return 'Job marked ready to apply.'
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
    .eq('user_id', defaultOperator.userId)
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
    .eq('user_id', defaultOperator.userId)

  if (updateResult.error) {
    return {
      message: updateResult.error.message,
      status: 'error',
    }
  }

  const eventResult = await supabase.from('application_events').insert({
    user_id: defaultOperator.userId,
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
  const packetId = asPersistedId(formData.get('packetId')) ?? crypto.randomUUID()
  const resumeVersionId = asPersistedId(formData.get('resumeVersionId')) ?? crypto.randomUUID()
  const suppliedJobScoreId = asPersistedId(formData.get('jobScoreId'))

  if (!jobId) {
    return {
      message: 'The packet save is missing its job reference.',
      status: 'error',
    }
  }

  const supabase = createClient()
  const { data: jobScore, error: jobScoreError } = await supabase
    .from('job_scores')
    .select('id')
    .eq('user_id', defaultOperator.userId)
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
    .select('id, resume_version_id, generated_at')
    .eq('user_id', defaultOperator.userId)
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
  const now = new Date().toISOString()
  const experienceEntries = parseJsonArray(formData.get('resumeExperienceEntriesJson'), [])
  const caseStudySelection = parseJsonArray(formData.get('caseStudySelectionJson'), [])
  const applicationAnswers = parseApplicationAnswers(formData)

  if (!existingPacket) {
    const scaffoldResult = await supabase.from('application_packets').insert({
      id: persistedPacketId,
      generated_at: now,
      job_id: jobId,
      job_score_id: jobScoreId,
      packet_status: asPacketStatus(asTextValue(formData.get('packetStatus'))),
      user_id: defaultOperator.userId,
    })

    if (scaffoldResult.error) {
      return {
        message: scaffoldResult.error.message,
        status: 'error',
      }
    }
  }

  const resumeVersionResult = await supabase.from('resume_versions').upsert(
    {
      application_packet_id: persistedPacketId,
      experience_entries: experienceEntries,
      export_status: 'draft',
      highlighted_requirements: asList(formData.get('highlightedRequirements')),
      id: persistedResumeVersionId,
      job_id: jobId,
      resume_master_id: defaultOperator.resumeMasterId,
      skills_section: asList(formData.get('resumeSkillsSection')),
      summary_text: asOptionalText(formData.get('resumeSummaryText')),
      tailoring_notes: asOptionalText(formData.get('tailoringNotes')),
      user_id: defaultOperator.userId,
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
      generated_at: existingPacket?.generated_at ?? now,
      id: persistedPacketId,
      job_id: jobId,
      job_score_id: jobScoreId,
      last_reviewed_at: now,
      manual_notes: asOptionalText(formData.get('manualNotes')),
      packet_status: asPacketStatus(asTextValue(formData.get('packetStatus'))),
      portfolio_recommendation: {
        primaryLabel: asTextValue(formData.get('portfolioPrimaryLabel')),
        primaryUrl: asTextValue(formData.get('portfolioPrimaryUrl')),
        rationale: asTextValue(formData.get('portfolioRationale')),
      },
      professional_summary: asOptionalText(formData.get('professionalSummary')),
      resume_version_id: persistedResumeVersionId,
      user_id: defaultOperator.userId,
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
        user_id: defaultOperator.userId,
      })),
    )

    if (insertAnswersResult.error) {
      return {
        message: insertAnswersResult.error.message,
        status: 'error',
      }
    }
  }

  revalidatePath('/dashboard')
  revalidatePath(`/jobs/${jobId}`)
  revalidatePath(`/jobs/${jobId}/packet`)
  refresh()

  return {
    message: `Packet review saved with ${applicationAnswers.length} structured answers and ${asList(formData.get('checklistItems')).length} checklist items.`,
    status: 'success',
  }
}
