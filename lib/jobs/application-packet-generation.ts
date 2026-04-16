import 'server-only'

import { generateApplicationPacketArtifacts } from '@/lib/ai/tasks/generate-application-packet'
import { getApplicationPacketReview } from '@/lib/data/application-packets'
import { getActiveOperatorContext } from '@/lib/data/operators'
import { type WorkflowStatus } from '@/lib/domain/types'
import { getOpenAIEnv, hasOpenAIEnv, hasSupabaseServerEnv } from '@/lib/env'
import { getPacketGenerationUserMessage } from '@/lib/jobs/packet-generation-copy'
import { persistPreferenceSignal } from '@/lib/jobs/learning'
import { isReadyWorkflowStatus, shouldBeginPacketPrep } from '@/lib/jobs/workflow-state'
import { createClient } from '@/lib/supabase/server'

const MISSING_COVER_LETTER_CHANGE_SUMMARY_COLUMN =
  "Could not find the 'cover_letter_change_summary' column of 'application_packets' in the schema cache"

function asTextValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asPersistedId(value: unknown) {
  const text = asTextValue(value)

  if (!text || text.startsWith('seed-')) {
    return null
  }

  return text
}

function getPacketGenerationMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Application content generation failed.'
}

function getUserFacingPacketGenerationMessage(error: unknown) {
  return getPacketGenerationUserMessage(getPacketGenerationMessage(error))
}

function isMissingCoverLetterChangeSummaryColumnError(error: unknown) {
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return false
  }

  return String(error.message).includes(MISSING_COVER_LETTER_CHANGE_SUMMARY_COLUMN)
}

async function upsertApplicationPacketRecord(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
) {
  const result = await supabase.from('application_packets').upsert(payload, {
    onConflict: 'id',
  })

  if (!result.error || !isMissingCoverLetterChangeSummaryColumnError(result.error)) {
    return result
  }

  const legacyPayload = { ...payload }
  delete legacyPayload.cover_letter_change_summary

  return supabase.from('application_packets').upsert(legacyPayload, {
    onConflict: 'id',
  })
}

export interface GenerateAndPersistApplicationPacketResult {
  answerCount: number
  jobId: string
  message: string
  packetId?: string
  resumeVersionId?: string
  status: 'error' | 'success'
  workflowStatus: WorkflowStatus | null
}

export async function generateAndPersistApplicationPacket(
  jobId: string,
): Promise<GenerateAndPersistApplicationPacketResult> {
  if (!hasSupabaseServerEnv()) {
    return {
      answerCount: 0,
      jobId,
      message: "Application generation isn't available right now.",
      status: 'error',
      workflowStatus: null,
    }
  }

  if (!hasOpenAIEnv()) {
    return {
      answerCount: 0,
      jobId,
      message: "Application generation isn't available right now.",
      status: 'error',
      workflowStatus: null,
    }
  }

  if (!jobId) {
    return {
      answerCount: 0,
      jobId,
      message: 'This generation request is missing its job reference.',
      status: 'error',
      workflowStatus: null,
    }
  }

  const operatorContext = await getActiveOperatorContext()

  if (!operatorContext || !operatorContext.resumeMasterId) {
    return {
      answerCount: 0,
      jobId,
      message: 'Choose a workspace before generating application materials.',
      status: 'error',
      workflowStatus: null,
    }
  }

  const review = await getApplicationPacketReview(jobId, {
    ensurePacket: true,
    syncQuestionSnapshot: true,
    syncQuestionSnapshotIfStale: true,
  })

  if (!review.canSave || !review.job || !review.packet) {
    return {
      answerCount: 0,
      jobId,
      message: review.issue || 'The application packet could not be prepared for generation.',
      status: 'error',
      workflowStatus: review.job?.workflowStatus ?? null,
    }
  }

  const supabase = createClient()
  const { packetModel } = getOpenAIEnv()
  const { data: existingPacket, error: existingPacketError } = await supabase
    .from('application_packets')
    .select('*')
    .eq('operator_id', operatorContext.operator.id)
    .eq('job_id', jobId)
    .maybeSingle()

  if (existingPacketError) {
    return {
      answerCount: 0,
      jobId,
      message: existingPacketError.message,
      status: 'error',
      workflowStatus: review.job.workflowStatus,
    }
  }

  const packetId = asPersistedId(existingPacket?.id ?? null) ?? crypto.randomUUID()
  const resumeVersionId =
    asPersistedId(existingPacket?.resume_version_id ?? null) ?? crypto.randomUUID()
  const now = new Date().toISOString()

  const runningPacketResult = await upsertApplicationPacketRecord(supabase, {
      generated_at: existingPacket ? review.packet.generatedAt ?? now : null,
      generation_error: null,
      generation_model: packetModel,
      generation_prompt_version: 'packet-v1',
      generation_provider: 'openai',
      generation_status: 'running',
      id: packetId,
      job_id: review.packet.jobId,
      job_score_id: review.packet.jobScoreId,
      operator_id: operatorContext.operator.id,
      packet_status: review.packet.packetStatus,
      question_snapshot_error: review.packet.questionSnapshotError ?? null,
      question_snapshot_refreshed_at: review.packet.questionSnapshotRefreshedAt ?? null,
      question_snapshot_status: review.packet.questionSnapshotStatus,
      user_id: operatorContext.userId,
    })

  if (runningPacketResult.error) {
    return {
      answerCount: 0,
      jobId,
      message: runningPacketResult.error.message,
      packetId,
      resumeVersionId,
      status: 'error',
      workflowStatus: review.job.workflowStatus,
    }
  }

  try {
    const generated = await generateApplicationPacketArtifacts({
      job: review.job,
      packet: review.packet,
      workspace: review.workspace,
    })

    const resumeVersionResult = await supabase.from('resume_versions').upsert(
      {
        application_packet_id: packetId,
        change_summary_text: generated.resumeVariant.changeSummaryForUser,
        experience_entries: generated.resumeVariant.experienceEntries,
        export_status: 'draft',
        headline_text: generated.resumeVariant.headline,
        highlighted_requirements: generated.resumeVariant.highlightedRequirements,
        id: resumeVersionId,
        job_id: jobId,
        operator_id: operatorContext.operator.id,
        resume_master_id: operatorContext.resumeMasterId,
        skills_section: generated.resumeVariant.skillsSection,
        summary_text: generated.resumeVariant.summary,
        tailoring_notes: generated.resumeVariant.tailoringRationale,
        user_id: operatorContext.userId,
        version_label: `${review.job.companyName} packet resume`,
      },
      { onConflict: 'id' },
    )

    if (resumeVersionResult.error) {
      throw new Error(resumeVersionResult.error.message)
    }

    const packetResult = await upsertApplicationPacketRecord(supabase, {
        application_checklist: review.packet.checklistItems,
        case_study_selection: review.packet.caseStudySelection,
        cover_letter_change_summary: generated.coverLetter.changeSummaryForUser,
        cover_letter_draft: generated.coverLetter.draft,
        cover_letter_summary: generated.coverLetter.summary,
        generated_at: now,
        generation_error: null,
        generation_model: packetModel,
        generation_prompt_version: 'packet-v1',
        generation_provider: 'openai',
        generation_status: 'generated',
        id: packetId,
        job_id: review.packet.jobId,
        job_score_id: review.packet.jobScoreId,
        last_reviewed_at: review.packet.lastReviewedAt ?? null,
        manual_notes: review.packet.manualNotes,
        operator_id: operatorContext.operator.id,
        packet_status: 'ready',
        portfolio_recommendation: review.packet.portfolioRecommendation,
        professional_summary: generated.resumeVariant.summary,
        question_snapshot_error: review.packet.questionSnapshotError ?? null,
        question_snapshot_refreshed_at: review.packet.questionSnapshotRefreshedAt ?? null,
        question_snapshot_status: review.packet.questionSnapshotStatus,
        resume_version_id: resumeVersionId,
        user_id: operatorContext.userId,
      })

    if (packetResult.error) {
      throw new Error(packetResult.error.message)
    }

    const deleteAnswersResult = await supabase
      .from('application_answers')
      .delete()
      .eq('application_packet_id', packetId)

    if (deleteAnswersResult.error) {
      throw new Error(deleteAnswersResult.error.message)
    }

    if (review.packet.answers.length > 0) {
      const generatedAnswersByKey = new Map(
        generated.answers.map((answer) => [answer.questionKey, answer] as const),
      )
      const insertAnswersResult = await supabase.from('application_answers').insert(
        review.packet.answers.map((answer) => {
          const generatedAnswer = generatedAnswersByKey.get(answer.questionKey)

          return {
            answer_text: generatedAnswer?.answerText || answer.answerText || null,
            answer_variant_short:
              generatedAnswer?.answerVariantShort || answer.answerVariantShort || null,
            application_packet_id: packetId,
            character_limit: answer.characterLimit ?? null,
            field_type: answer.fieldType,
            id: asPersistedId(answer.id) ?? crypto.randomUUID(),
            job_id: jobId,
            operator_id: operatorContext.operator.id,
            question_key: answer.questionKey,
            question_text: answer.questionText,
            review_status: answer.reviewStatus,
            source_context: {},
            user_id: operatorContext.userId,
          }
        }),
      )

      if (insertAnswersResult.error) {
        throw new Error(insertAnswersResult.error.message)
      }
    }

    let workflowStatus: WorkflowStatus = review.job.workflowStatus

    if (shouldBeginPacketPrep(review.job.workflowStatus) || review.job.workflowStatus === 'preparing') {
      workflowStatus = 'ready_to_apply'

      await supabase
        .from('job_scores')
        .update({
          last_status_changed_at: now,
          workflow_status: workflowStatus,
        })
        .eq('operator_id', operatorContext.operator.id)
        .eq('job_id', jobId)

      await supabase.from('application_events').insert({
        operator_id: operatorContext.operator.id,
        user_id: operatorContext.userId,
        job_id: jobId,
        event_type: 'status_changed',
        from_status: review.job.workflowStatus,
        to_status: workflowStatus,
        event_payload: {
          generationProvider: 'openai',
          sourceContext: 'packet-generate',
          targetStatus: workflowStatus,
        },
        notes: 'Application materials generated and moved into the Ready queue.',
      })

      await persistPreferenceSignal({
        jobId,
        operatorId: operatorContext.operator.id,
        sourceContext: 'packet-generate',
        targetStatus: workflowStatus,
        userId: operatorContext.userId,
      })
    }

    if (isReadyWorkflowStatus(review.job.workflowStatus)) {
      workflowStatus = review.job.workflowStatus
    }

    return {
      answerCount: review.packet.answers.length,
      jobId,
      message: 'Application materials generated. Review the resume, cover letter, and answers below, then apply when you are ready.',
      packetId,
      resumeVersionId,
      status: 'success',
      workflowStatus,
    }
  } catch (error) {
    await supabase
      .from('application_packets')
      .update({
        generation_error: getPacketGenerationMessage(error),
        generation_model: packetModel,
        generation_prompt_version: 'packet-v1',
        generation_provider: 'openai',
        generation_status: 'failed',
      })
      .eq('id', packetId)

    return {
      answerCount: 0,
      jobId,
      message: getUserFacingPacketGenerationMessage(error),
      packetId,
      resumeVersionId,
      status: 'error',
      workflowStatus: review.job.workflowStatus,
    }
  }
}
