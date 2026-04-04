import { notFound } from 'next/navigation'

import { JobFlowPage } from '@/components/jobs/job-flow-page'
import { WorkspaceSurface } from '@/components/navigation/workspace-surface'
import { WorkspaceTodayRail } from '@/components/navigation/workspace-today-rail'
import { getApplicationPacketReview } from '@/lib/data/application-packets'
import { getRankedJobs } from '@/lib/data/jobs'
import { requireActiveOperatorSelection } from '@/lib/data/operators'

export const dynamic = 'force-dynamic'

interface JobDetailPageProps {
  params: Promise<{
    jobId: string
  }>
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  await requireActiveOperatorSelection()
  const { jobId } = await params
  const [{ canSave, issue, job, packet, workspace }, { jobs, source }] = await Promise.all([
    getApplicationPacketReview(jobId),
    getRankedJobs(),
  ])

  if (!job || !packet) {
    notFound()
  }

  return (
    <main className="page-stack workspace-surface">
      <WorkspaceSurface
        rail={
          <WorkspaceTodayRail
            actionsEnabled={source === 'database'}
            jobs={jobs}
          />
        }
      >
        <JobFlowPage
          canSave={canSave}
          issue={issue}
          job={job}
          packet={packet}
          prepOpen={false}
          profile={workspace.profile}
        />
      </WorkspaceSurface>
    </main>
  )
}
