import { ApplicationPacketForm } from '@/components/jobs/application-packet-form'
import { JobFlowHeader } from '@/components/jobs/job-flow-header'
import { JobOverviewSection } from '@/components/jobs/job-overview-section'
import type { ApplicationPacketRecord, OperatorProfileRecord, OperatorWorkspaceRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import { buildJobFlowPageViewModel } from '@/lib/jobs/job-flow-view-model'
import type { ProfileReadinessPresentation } from '@/lib/profile/readiness-presentation'

interface JobFlowPageProps {
  canSave: boolean
  issue?: string
  job: QualifiedJobRecord
  packet: ApplicationPacketRecord
  prepOpen: boolean
  profile: OperatorProfileRecord
  profileMaterialReady: boolean
  readinessPresentation?: ProfileReadinessPresentation | null
  screeningLocked?: boolean
  workspace: OperatorWorkspaceRecord
}

export function JobFlowPage({
  canSave,
  issue,
  job,
  packet,
  prepOpen,
  profile,
  profileMaterialReady,
  readinessPresentation,
  screeningLocked = false,
  workspace,
}: JobFlowPageProps) {
  const viewModel = buildJobFlowPageViewModel({
    canSave,
    issue,
    job,
    prepOpen,
    profile,
    readinessPresentation,
    screeningLocked,
  })

  return (
    <>
      <JobFlowHeader header={viewModel.header} />
      <JobOverviewSection
        canGenerate={viewModel.canGenerate}
        canSave={canSave}
        generationDisabledReason={viewModel.generationDisabledReason}
        job={job}
        packet={packet}
        prepOpen={prepOpen}
        saveDisabledReason={issue}
        screeningLocked={screeningLocked}
      />

      {prepOpen ? (
        <div className="job-prep-direct">
          <ApplicationPacketForm
            canSave={canSave}
            disabledReason={issue}
            job={job}
            packet={packet}
            profileMaterialReady={profileMaterialReady}
            readinessPresentation={readinessPresentation}
            screeningLocked={screeningLocked}
            workspace={workspace}
          />
            </div>
          ) : null}
    </>
  )
}
