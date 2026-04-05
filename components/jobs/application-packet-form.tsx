'use client'

import { useActionState } from 'react'

import { PacketHiddenFields } from '@/components/jobs/packet-hidden-fields'
import { saveApplicationPacket, type ApplicationPacketActionState } from '@/app/jobs/actions'
import { PacketFormFooterMessage } from '@/components/jobs/packet-form-footer-message'
import { PacketMaterialsSection } from '@/components/jobs/packet-materials-section'
import { PacketPreGenerationSection } from '@/components/jobs/packet-pre-generation-section'
import { PacketQuestionsSection } from '@/components/jobs/packet-questions-section'
import { type ApplicationPacketRecord } from '@/lib/domain/types'
import type { RankedJobRecord } from '@/lib/jobs/contracts'

const initialState: ApplicationPacketActionState = {
  message: '',
  status: 'idle',
}

function getFirstFilledText(...values: Array<string | null | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? ''
}

function getPreviewText(value: string, fallback: string, maxLength = 220) {
  const trimmed = value.trim()

  if (!trimmed) {
    return fallback
  }

  if (trimmed.length <= maxLength) {
    return trimmed
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}...`
}

interface ApplicationPacketFormProps {
  canSave: boolean
  disabledReason?: string
  job: RankedJobRecord
  packet: ApplicationPacketRecord
  profileMaterialReady: boolean
  screeningLocked?: boolean
  showGeneratedContent: boolean
}

export function ApplicationPacketForm({
  job,
  packet,
  profileMaterialReady,
  screeningLocked = false,
  showGeneratedContent,
}: ApplicationPacketFormProps) {
  const [state, formAction] = useActionState(saveApplicationPacket, initialState)

  const resumeSource = getFirstFilledText(packet.resumeVersion.summaryText, packet.professionalSummary)
  const coverLetterSource = packet.coverLetterDraft.trim()
  const readyAnswerCount = packet.answers.filter(
    (answer) => answer.answerText.trim() || answer.answerVariantShort.trim(),
  ).length

  const resumeReady = Boolean(
    resumeSource ||
      packet.resumeVersion.highlightedRequirements.length > 0 ||
      packet.resumeVersion.skillsSection.length > 0,
  )
  const coverLetterReady = Boolean(coverLetterSource)

  const resumeSummary = getPreviewText(
    resumeSource,
    'A tailored resume summary will appear here once the application materials are generated.',
  )
  const coverLetterSummary = getPreviewText(
    packet.coverLetterSummary || coverLetterSource,
    'A role-specific cover letter will appear here once the application materials are generated.',
  )
  const resumeChangeSummary = getPreviewText(
    packet.resumeVersion.changeSummaryText,
    'A short explanation of how the resume changed will appear here once the application materials are generated.',
  )
  const isRunning = packet.generationStatus === 'running'
  const isFailed = packet.generationStatus === 'failed'
  const showQuestionSection =
    packet.questionSnapshotStatus === 'extracted' && packet.answers.length > 0

  return (
    <form action={formAction} className="packet-form" id="packet-form">
      <PacketHiddenFields job={job} packet={packet} />

      {showGeneratedContent ? (
        <>
          <PacketMaterialsSection
            coverLetterReady={coverLetterReady}
            coverLetterSummary={coverLetterSummary}
            resumeChangeSummary={resumeChangeSummary}
            resumeReady={resumeReady}
            resumeSummary={resumeSummary}
          />
          {showQuestionSection ? (
            <PacketQuestionsSection answers={packet.answers} readyAnswerCount={readyAnswerCount} />
          ) : null}
        </>
      ) : (
        <PacketPreGenerationSection
          generationError={packet.generationError}
          isFailed={isFailed}
          isRunning={isRunning}
          profileMaterialReady={profileMaterialReady}
          screeningLocked={screeningLocked}
        />
      )}

      <PacketFormFooterMessage message={state.message} status={state.status} />
    </form>
  )
}
