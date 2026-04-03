import Link from 'next/link'

import { JobStageActionButton } from '@/components/jobs/job-stage-action-button'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import { getDashboardQueues, getMatchReason } from '@/lib/jobs/dashboard-queue'

interface WorkspaceTodayRailProps {
  actionsEnabled: boolean
  jobs: QualifiedJobRecord[]
}

function getApplyNextJob(savedJobs: QualifiedJobRecord[], preparedJobs: QualifiedJobRecord[]) {
  return preparedJobs[0] ?? savedJobs[0] ?? null
}

function getApplyNextLink(job: QualifiedJobRecord) {
  if (job.workflowStatus === 'ready_to_apply') {
    return {
      external: true,
      href: job.applicationUrl ?? job.sourceUrl,
      label: 'Apply',
    }
  }

  return {
    external: false,
    href: `/jobs/${job.id}/packet`,
    label: 'Prepare',
  }
}

function getNewTodayCount(jobs: QualifiedJobRecord[]) {
  return jobs.filter((job) => job.daysSincePosted === 0).length
}

export function WorkspaceTodayRail({ actionsEnabled, jobs }: WorkspaceTodayRailProps) {
  const { preparedJobs, savedJobs } = getDashboardQueues(jobs)
  const applyNextJob = getApplyNextJob(savedJobs, preparedJobs)
  const applyNextAction = applyNextJob ? getApplyNextLink(applyNextJob) : null
  const newTodayCount = getNewTodayCount(jobs)

  return (
    <aside aria-label="Today" className="today-rail">
      <section className="today-block">
        <div className="today-block-heading">
          <p className="panel-label">Today</p>
          <h2>Apply next</h2>
        </div>

        {applyNextJob ? (
          <div className="today-apply-next">
            <div className="today-apply-copy">
              <Link className="today-job-link" href={`/jobs/${applyNextJob.id}`}>
                {applyNextJob.title}
              </Link>
              <p className="today-job-company">{applyNextJob.companyName}</p>
              <p className="today-job-reason">{getMatchReason(applyNextJob)}</p>
            </div>

            <div className="today-actions">
              {applyNextAction?.external ? (
                <a
                  className="button button-primary"
                  href={applyNextAction.href}
                  rel="noreferrer"
                  target="_blank"
                >
                  {applyNextAction.label}
                </a>
              ) : (
                <Link className="button button-primary" href={applyNextAction?.href ?? `/jobs/${applyNextJob.id}`}>
                  {applyNextAction?.label ?? 'Prepare'}
                </Link>
              )}

              <JobStageActionButton
                canEdit={actionsEnabled}
                disabledReason="Switch back to the database-backed queue to skip jobs."
                intent="dismiss"
                jobId={applyNextJob.id}
                label="Skip"
                sourceContext="today-rail"
                variant="secondary"
              />
            </div>
          </div>
        ) : (
          <div className="today-empty">
            <p>No job is ready for prep yet.</p>
            <p>Save something from Potential and it will move into the next-action rail.</p>
          </div>
        )}
      </section>

      <section className="today-block">
        <div className="today-block-heading">
          <h2>Snapshot</h2>
        </div>
        <dl className="today-stats">
          <div>
            <dt>New today</dt>
            <dd>{newTodayCount}</dd>
          </div>
          <div>
            <dt>Ready to apply</dt>
            <dd>{preparedJobs.length}</dd>
          </div>
          <div>
            <dt>Saved</dt>
            <dd>{savedJobs.length}</dd>
          </div>
        </dl>
      </section>
    </aside>
  )
}
