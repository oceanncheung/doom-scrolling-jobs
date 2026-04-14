'use client'

import { useActionState } from 'react'

import { PacketHiddenFields } from '@/components/jobs/packet-hidden-fields'
import { saveApplicationPacket, type ApplicationPacketActionState } from '@/app/jobs/actions'
import { PacketFormFooterMessage } from '@/components/jobs/packet-form-footer-message'
import { PacketMaterialsSection } from '@/components/jobs/packet-materials-section'
import { PacketPreGenerationSection } from '@/components/jobs/packet-pre-generation-section'
import { PacketQuestionsSection } from '@/components/jobs/packet-questions-section'
import { type ApplicationPacketRecord, type OperatorWorkspaceRecord } from '@/lib/domain/types'
import type { RankedJobRecord } from '@/lib/jobs/contracts'
import { getPacketLifecycle } from '@/lib/jobs/packet-lifecycle'
import { buildPacketMaterialsViewModel } from '@/lib/jobs/packet-view-model'
import type { ProfileReadinessPresentation } from '@/lib/profile/readiness-presentation'

const initialState: ApplicationPacketActionState = {
  message: '',
  status: 'idle',
}

interface ApplicationPacketFormProps {
  canSave: boolean
  disabledReason?: string
  job: RankedJobRecord
  packet: ApplicationPacketRecord
  profileMaterialReady: boolean
  readinessPresentation?: ProfileReadinessPresentation | null
  screeningLocked?: boolean
  workspace: OperatorWorkspaceRecord
}

export function ApplicationPacketForm({
  job,
  packet,
  profileMaterialReady,
  readinessPresentation,
  screeningLocked = false,
  workspace,
}: ApplicationPacketFormProps) {
  const [state, formAction] = useActionState(saveApplicationPacket, initialState)
  const lifecycle = getPacketLifecycle(packet)
  const viewModel = buildPacketMaterialsViewModel(packet)

  return (
    <form action={formAction} className="packet-form" id="packet-form">
      <PacketHiddenFields job={job} packet={packet} />

      {lifecycle.hasGeneratedContent ? (
        <>
          <PacketMaterialsSection
            companyName={job.companyName}
            coverLetterChangeSummary={viewModel.coverLetterChangeSummary}
            coverLetterReady={viewModel.coverLetterReady}
            coverLetterSummary={viewModel.coverLetterSummary}
            jobId={job.id}
            jobTitle={job.title}
            packet={packet}
            resumeChangeSummary={viewModel.resumeChangeSummary}
            resumeReady={viewModel.resumeReady}
            resumeSummary={viewModel.resumeSummary}
            workspace={workspace}
          />
          {viewModel.showQuestionSection ? (
            <PacketQuestionsSection answers={packet.answers} readyAnswerCount={viewModel.readyAnswerCount} />
          ) : null}
        </>
      ) : (
        <PacketPreGenerationSection
          packet={packet}
          profileMaterialReady={profileMaterialReady}
          readinessPresentation={readinessPresentation}
          screeningLocked={screeningLocked}
        />
      )}

      <PacketFormFooterMessage message={state.message} status={state.status} />
    </form>
  )
}
