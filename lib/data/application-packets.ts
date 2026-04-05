import 'server-only'

import { getActiveOperatorContext } from '@/lib/data/operators'
import { hasSupabaseServerEnv } from '@/lib/env'
import {
  type ApplicationAnswerRecord,
  type ApplicationPacketRecord,
  type OperatorWorkspaceRecord,
} from '@/lib/domain/types'
import type { QualifiedJobRecord, RankedJobRecord } from '@/lib/jobs/contracts'
import { fetchGreenhouseApplicationQuestions } from '@/lib/jobs/greenhouse-application-questions'
import { createClient } from '@/lib/supabase/server'

import {
  asString,
  asStringArray,
  buildGeneratedPacket,
  inferLegacyGenerationStatus,
  normalizeAnswer,
  normalizeCaseStudySelection,
  normalizePacketStatus,
  normalizePortfolioRecommendation,
  normalizeQuestionSnapshotStatus,
  normalizeResumeVersion,
  shouldRefreshQuestionSnapshot,
} from './application-packet-review-helpers'
import { getRankedJob } from './jobs'
import { getOperatorProfile } from './operator-profile'

type PacketSource = 'seed' | 'database' | 'database-fallback'

export interface ApplicationPacketReviewResult {
  canSave: boolean
  issue?: string
  job?: QualifiedJobRecord
  packet?: ApplicationPacketRecord
  source: PacketSource
  workspace: OperatorWorkspaceRecord
}

interface ApplicationPacketReviewOptions {
  ensurePacket?: boolean
  syncQuestionSnapshot?: boolean
  syncQuestionSnapshotIfStale?: boolean
}

async function syncPacketQuestionSnapshot({
  job,
  operatorId,
  packetId,
  userId,
}: {
  job: RankedJobRecord
  operatorId: string
  packetId: string
  userId: string
}) {
  const supabase = createClient()
  const snapshot = await fetchGreenhouseApplicationQuestions(job)
  const now = new Date().toISOString()
  const persistFailedSnapshot = async (message: string) => {
    await supabase
      .from('application_packets')
      .update({
        question_snapshot_error: message,
        question_snapshot_refreshed_at: now,
        question_snapshot_status: 'failed',
      })
      .eq('id', packetId)
  }

  const { data: existingAnswers, error: existingAnswersError } = await supabase
    .from('application_answers')
    .select(
      `
        id,
        question_key,
        question_text,
        field_type,
        answer_text,
        answer_variant_short,
        character_limit,
        review_status
      `,
    )
    .eq('application_packet_id', packetId)

  if (existingAnswersError) {
    await persistFailedSnapshot(existingAnswersError.message)
    return {
      error: existingAnswersError.message,
      status: 'failed' as const,
    }
  }

  const existingAnswerByKey = new Map(
    (existingAnswers ?? [])
      .map((answer) => normalizeAnswer(answer))
      .filter((answer): answer is ApplicationAnswerRecord => answer !== null)
      .map((answer) => [answer.questionKey, answer] as const),
  )

  const deleteAnswersResult = await supabase
    .from('application_answers')
    .delete()
    .eq('application_packet_id', packetId)

  if (deleteAnswersResult.error) {
    await persistFailedSnapshot(deleteAnswersResult.error.message)
    return {
      error: deleteAnswersResult.error.message,
      status: 'failed' as const,
    }
  }

  if (snapshot.status === 'extracted' && snapshot.questions.length > 0) {
    const insertAnswersResult = await supabase.from('application_answers').insert(
      snapshot.questions.map((question) => {
        const existingAnswer = existingAnswerByKey.get(question.questionKey)

        return {
          answer_text: existingAnswer?.answerText || null,
          answer_variant_short: existingAnswer?.answerVariantShort || null,
          application_packet_id: packetId,
          character_limit: question.characterLimit ?? existingAnswer?.characterLimit ?? null,
          field_type: question.fieldType,
          id: existingAnswer?.id || crypto.randomUUID(),
          job_id: job.id,
          operator_id: operatorId,
          question_key: question.questionKey,
          question_text: question.questionText,
          review_status: existingAnswer?.reviewStatus ?? 'draft',
          source_context: question.sourceContext,
          user_id: userId,
        }
      }),
    )

    if (insertAnswersResult.error) {
      await persistFailedSnapshot(insertAnswersResult.error.message)
      return {
        error: insertAnswersResult.error.message,
        status: 'failed' as const,
      }
    }
  }

  const updateResult = await supabase
    .from('application_packets')
    .update({
      question_snapshot_error: snapshot.error ?? null,
      question_snapshot_refreshed_at: now,
      question_snapshot_status: snapshot.status,
    })
    .eq('id', packetId)

  if (updateResult.error) {
    return {
      error: updateResult.error.message,
      status: 'failed' as const,
    }
  }

  return {
    status: snapshot.status,
  }
}

export async function getApplicationPacketReview(
  jobId: string,
  options: ApplicationPacketReviewOptions = {},
): Promise<ApplicationPacketReviewResult> {
  const {
    ensurePacket = false,
    syncQuestionSnapshot = false,
    syncQuestionSnapshotIfStale = false,
  } = options
  const [{ job, source: jobSource }, { workspace }] = await Promise.all([
    getRankedJob(jobId),
    getOperatorProfile(),
  ])

  if (!job) {
    return {
      canSave: false,
      issue: 'The requested job could not be found.',
      source: 'seed',
      workspace,
    }
  }

  const generatedPacket = buildGeneratedPacket(workspace, job)
  const canSave = hasSupabaseServerEnv() && jobSource === 'database'

  if (!canSave) {
    return {
      canSave: false,
      issue:
        "This packet is available as a preview right now, but changes can't be saved from this view.",
      job,
      packet: generatedPacket,
      source: 'seed',
      workspace,
    }
  }

  const operatorContext = await getActiveOperatorContext()

  if (!operatorContext) {
    return {
      canSave: false,
      issue: 'Choose a workspace before loading saved application materials.',
      job,
      packet: generatedPacket,
      source: 'database-fallback',
      workspace,
    }
  }

  const supabase = createClient()
  const { data: existingPacketRow, error: packetError } = await supabase
    .from('application_packets')
    .select('*')
    .eq('operator_id', operatorContext.operator.id)
    .eq('job_id', jobId)
    .maybeSingle()

  if (packetError) {
    return {
      canSave: true,
      issue:
        "We couldn't load the saved application materials, so this screen is showing a fresh draft built from your current profile and this job.",
      job,
      packet: generatedPacket,
      source: 'database-fallback',
      workspace,
    }
  }

  let packetRow = existingPacketRow

  if (!packetRow && (syncQuestionSnapshot || ensurePacket)) {
    const { data: createdPacket, error: createPacketError } = await supabase
      .from('application_packets')
      .upsert(
        {
          application_checklist: generatedPacket.checklistItems,
          case_study_selection: generatedPacket.caseStudySelection,
          generation_status: 'not_started',
          id: crypto.randomUUID(),
          job_id: generatedPacket.jobId,
          job_score_id: generatedPacket.jobScoreId,
          job_focus_summary: generatedPacket.jobFocusSummary,
          job_summary: generatedPacket.jobSummary,
          operator_id: operatorContext.operator.id,
          packet_status: generatedPacket.packetStatus,
          portfolio_recommendation: generatedPacket.portfolioRecommendation,
          question_snapshot_status: 'not_started',
          user_id: operatorContext.userId,
        },
        { onConflict: 'id' },
      )
      .select('*')
      .single()

    if (createPacketError) {
      return {
        canSave: true,
        issue:
          "We couldn't create saved application materials for this role yet, so this screen is showing a fresh draft built from your current profile and this job.",
        job,
        packet: generatedPacket,
        source: 'database-fallback',
        workspace,
      }
    }

    packetRow = createdPacket
  }

  if (!packetRow) {
    return {
      canSave: true,
      issue:
        'No saved application materials exist for this role yet, so this screen is showing a fresh draft built from your current profile and this job.',
      job,
      packet: generatedPacket,
      source: 'database-fallback',
      workspace,
    }
  }

  if (
    packetRow &&
    shouldRefreshQuestionSnapshot(packetRow as Record<string, unknown>, {
      syncQuestionSnapshot,
      syncQuestionSnapshotIfStale,
    })
  ) {
    await syncPacketQuestionSnapshot({
      job,
      operatorId: operatorContext.operator.id,
      packetId: asString(packetRow.id),
      userId: operatorContext.userId,
    })

    const { data: refreshedPacketRow, error: refreshedPacketRowError } = await supabase
      .from('application_packets')
      .select('*')
      .eq('id', packetRow.id)
      .maybeSingle()

    if (!refreshedPacketRowError && refreshedPacketRow) {
      packetRow = refreshedPacketRow
    }
  }

  const [resumeVersionResult, answersResult] = await Promise.all([
    packetRow.resume_version_id
      ? supabase
          .from('resume_versions')
          .select('*')
          .eq('id', packetRow.resume_version_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('application_answers')
      .select(
        `
          id,
          question_key,
          question_text,
          field_type,
          answer_text,
          answer_variant_short,
          character_limit,
          review_status
        `,
      )
      .eq('application_packet_id', packetRow.id)
      .order('created_at', { ascending: true }),
  ])

  const answers =
    answersResult.data
      ?.map((item) => normalizeAnswer(item))
      .filter((item): item is ApplicationAnswerRecord => item !== null) ?? []
  const questionSnapshotStatus = normalizeQuestionSnapshotStatus(
    packetRow.question_snapshot_status,
    'not_started',
  )

  return {
    canSave: true,
    job,
    packet: {
      answers: questionSnapshotStatus === 'extracted' ? answers : [],
      caseStudySelection: normalizeCaseStudySelection(
        packetRow.case_study_selection,
        generatedPacket.caseStudySelection,
      ),
      checklistItems:
        asStringArray(packetRow.application_checklist).length > 0
          ? asStringArray(packetRow.application_checklist)
          : generatedPacket.checklistItems,
      coverLetterDraft: asString(packetRow.cover_letter_draft) || generatedPacket.coverLetterDraft,
      coverLetterSummary: asString(packetRow.cover_letter_summary) || generatedPacket.coverLetterSummary,
      generationError: asString(packetRow.generation_error) || undefined,
      generationModel: asString(packetRow.generation_model) || undefined,
      generationPromptVersion: asString(packetRow.generation_prompt_version) || undefined,
      generationProvider: asString(packetRow.generation_provider) || undefined,
      generationStatus: inferLegacyGenerationStatus(packetRow),
      generatedAt: asString(packetRow.generated_at) || generatedPacket.generatedAt,
      id: asString(packetRow.id),
      jobId: asString(packetRow.job_id) || generatedPacket.jobId,
      jobScoreId: asString(packetRow.job_score_id) || generatedPacket.jobScoreId,
      jobFocusSummary: asString(packetRow.job_focus_summary) || generatedPacket.jobFocusSummary,
      jobSummary: asString(packetRow.job_summary) || generatedPacket.jobSummary,
      lastReviewedAt: asString(packetRow.last_reviewed_at) || undefined,
      manualNotes: asString(packetRow.manual_notes),
      packetStatus: normalizePacketStatus(packetRow.packet_status, generatedPacket.packetStatus),
      portfolioRecommendation: normalizePortfolioRecommendation(
        packetRow.portfolio_recommendation,
        generatedPacket.portfolioRecommendation,
      ),
      professionalSummary: asString(packetRow.professional_summary) || generatedPacket.professionalSummary,
      questionSnapshotError: asString(packetRow.question_snapshot_error) || undefined,
      questionSnapshotRefreshedAt: asString(packetRow.question_snapshot_refreshed_at) || undefined,
      questionSnapshotStatus,
      resumeVersion: normalizeResumeVersion(
        resumeVersionResult.data,
        generatedPacket.resumeVersion,
      ),
    },
    source: 'database',
    workspace,
  }
}
