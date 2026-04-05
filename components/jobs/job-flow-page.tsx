import { ApplicationPacketForm } from '@/components/jobs/application-packet-form'
import { getDetailIntro, getPrepIntro } from '@/components/jobs/job-flow-copy'
import { JobFlowHeader } from '@/components/jobs/job-flow-header'
import { JobOverviewSection } from '@/components/jobs/job-overview-section'
import type { ApplicationPacketRecord, OperatorProfileRecord } from '@/lib/domain/types'
import { hasOpenAIEnv } from '@/lib/env'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'

interface JobFlowPageProps {
  canSave: boolean
  issue?: string
  job: QualifiedJobRecord
  packet: ApplicationPacketRecord
  prepOpen: boolean
  profile: OperatorProfileRecord
  profileMaterialReady: boolean
  screeningLocked?: boolean
}

export function JobFlowPage({
  canSave,
  issue,
  job,
  packet,
  prepOpen,
  profile,
  profileMaterialReady,
  screeningLocked = false,
}: JobFlowPageProps) {
  const draftReady = packet.generationStatus === 'generated'
  const canGenerate = canSave && !screeningLocked && hasOpenAIEnv()
  const generationDisabledReason = !canSave
    ? issue
    : screeningLocked
      ? 'Complete your profile draft in Settings before preparing applications.'
    : !canGenerate
      ? 'Add the OpenAI server environment before generating application materials.'
      : issue
  const pageLabel = prepOpen ? 'Application packet' : 'Job review'
  const pageIntro = prepOpen ? getPrepIntro(job) : getDetailIntro(job)

  return (
    <>
      <JobFlowHeader job={job} pageIntro={pageIntro} pageLabel={pageLabel} profile={profile} />
      <JobOverviewSection
        canGenerate={canGenerate}
        canSave={canSave}
        generationDisabledReason={generationDisabledReason}
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
            screeningLocked={screeningLocked}
            showGeneratedContent={draftReady}
          />
        </div>
      ) : null}
    </>
  )
}
