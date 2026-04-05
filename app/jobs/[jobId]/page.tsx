import { notFound } from 'next/navigation'

import { JobFlowPage } from '@/components/jobs/job-flow-page'
import { WorkspaceSurface } from '@/components/navigation/workspace-surface'
import { WorkspaceTodayRail } from '@/components/navigation/workspace-today-rail'
import { getApplicationPacketReview } from '@/lib/data/application-packets'
import { getRankedJobs } from '@/lib/data/jobs'
import { requireActiveOperatorSelection } from '@/lib/data/operators'
import { computeProfileMaterialReady } from '@/lib/jobs/profile-material'
import { isJobPrepOpen } from '@/lib/jobs/review-navigation'
import { buildProfileReadinessPresentation } from '@/lib/profile/readiness-presentation'

export const dynamic = 'force-dynamic'

interface JobDetailPageProps {
  params: Promise<{
    jobId: string
  }>
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  await requireActiveOperatorSelection()
  const { jobId } = await params
  const [{ canSave, issue, job, packet, workspace }, { jobs, screeningLocked, source }] = await Promise.all([
    getApplicationPacketReview(jobId),
    getRankedJobs(),
  ])

  if (!job || !packet) {
    notFound()
  }

  const profileMaterialReady = computeProfileMaterialReady(packet, workspace)
  const readinessPresentation = buildProfileReadinessPresentation(workspace.status)

  return (
    <main className="page-stack workspace-surface">
      <WorkspaceSurface
        rail={
          <WorkspaceTodayRail
            actionsEnabled={source === 'database' && !screeningLocked}
            jobs={jobs}
            readinessPresentation={readinessPresentation}
            screeningLocked={screeningLocked}
          />
        }
      >
        <JobFlowPage
          canSave={canSave}
          issue={issue}
          job={job}
          packet={packet}
          prepOpen={isJobPrepOpen(job.workflowStatus)}
          profile={workspace.profile}
          profileMaterialReady={profileMaterialReady}
          readinessPresentation={readinessPresentation}
          screeningLocked={Boolean(screeningLocked)}
        />
      </WorkspaceSurface>
    </main>
  )
}
