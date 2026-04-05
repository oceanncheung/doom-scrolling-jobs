import type { ReactNode } from 'react'

import { JobsMarqueeBanner } from '@/components/jobs/jobs-marquee-banner'
import { AppliedRow } from '@/components/dashboard/applied-row'
import { ArchiveRow } from '@/components/dashboard/archive-row'
import { PotentialRow } from '@/components/dashboard/potential-row'
import { PreparedRow } from '@/components/dashboard/prepared-row'
import { QueueMeta } from '@/components/dashboard/queue-meta'
import { SavedRow } from '@/components/dashboard/saved-row'
import { StageEmpty } from '@/components/dashboard/stage-empty'
import { WorkspaceSurface } from '@/components/navigation/workspace-surface'
import { WorkspaceTodayRail } from '@/components/navigation/workspace-today-rail'
import { getRankedJobs } from '@/lib/data/jobs'
import { requireActiveOperatorSelection } from '@/lib/data/operators'
import { getOperatorProfile } from '@/lib/data/operator-profile'
import {
  getDashboardQueues,
  getQueueView,
  type QueueView,
} from '@/lib/jobs/dashboard-queue'

export const dynamic = 'force-dynamic'

interface DashboardPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await requireActiveOperatorSelection()
  const resolvedSearchParams = (await searchParams) ?? {}
  const activeView = getQueueView(resolvedSearchParams.view)
  const [{ jobs, screeningLocked, source }, { workspace }] = await Promise.all([
    getRankedJobs(),
    getOperatorProfile(),
  ])
  const actionsEnabled = source === 'database' && !screeningLocked

  const { appliedJobs, archivedJobs, counts, potentialJobs, preparedJobs, savedJobs, screeningPool } =
    getDashboardQueues(jobs)

  const activeContent: Record<QueueView, ReactNode> = {
    applied:
      appliedJobs.length > 0 ? (
        appliedJobs.map((job) => (
          <AppliedRow
            job={job}
            key={job.id}
            profile={workspace.profile}
            showActions={!screeningLocked}
          />
        ))
      ) : (
        <StageEmpty message="Applied jobs will collect here once you mark them sent." title="Applied" />
      ),
    archive:
      archivedJobs.length > 0 ? (
        archivedJobs.map((job) => (
          <ArchiveRow
            actionsEnabled={actionsEnabled}
            job={job}
            key={job.id}
            profile={workspace.profile}
            showActions={!screeningLocked}
          />
        ))
      ) : (
        <StageEmpty message="Skipped and archived jobs will show up here." title="Archived" />
      ),
    potential:
      potentialJobs.length > 0 ? (
        potentialJobs.map((job) => (
          <PotentialRow
            actionsEnabled={actionsEnabled}
            job={job}
            key={job.id}
            profile={workspace.profile}
          />
        ))
      ) : (
        <StageEmpty
          message={
            screeningLocked
              ? 'Complete your profile draft in Settings to unlock Potential.'
              : 'No active screening jobs are available right now.'
          }
          title="Potential"
        />
      ),
    prepared:
      preparedJobs.length > 0 ? (
        preparedJobs.map((job) => (
          <PreparedRow
            actionsEnabled={actionsEnabled}
            job={job}
            key={job.id}
            profile={workspace.profile}
            showActions={!screeningLocked}
          />
        ))
      ) : (
        <StageEmpty message="Mark a packet ready and it will show up here." title="Ready" />
      ),
    saved:
      savedJobs.length > 0 ? (
        savedJobs.map((job) => (
          <SavedRow
            actionsEnabled={actionsEnabled}
            job={job}
            key={job.id}
            profile={workspace.profile}
            showActions={!screeningLocked}
          />
        ))
      ) : (
        <StageEmpty message="Saved jobs will appear here after you shortlist them." title="Saved" />
      ),
  }

  return (
    <main className="page-stack jobs-index">
      <WorkspaceSurface
        rail={
          <WorkspaceTodayRail
            actionsEnabled={actionsEnabled}
            jobs={jobs}
            screeningLocked={screeningLocked}
          />
        }
      >
        <QueueMeta
          activeView={activeView}
          potentialTotalCount={screeningPool.length}
          potentialVisibleCount={potentialJobs.length}
          totalCount={counts[activeView]}
        />
        <section className="queue-list" aria-live="polite">
          {activeContent[activeView]}
        </section>
      </WorkspaceSurface>
      <JobsMarqueeBanner />
    </main>
  )
}
