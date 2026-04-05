import Link from 'next/link'

import { JobStageActionButton } from '@/components/jobs/job-stage-action-button'
import { WorkspaceRailShell } from '@/components/navigation/workspace-rail-shell'
import { TodayBlockHeading } from '@/components/ui/today-block-heading'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import { getApplyNextJob, getDashboardQueues, getMatchReason } from '@/lib/jobs/dashboard-queue'
import { getApplyNextAction, getJobReviewHref } from '@/lib/jobs/review-navigation'
import type { ProfileReadinessPresentation } from '@/lib/profile/readiness-presentation'

interface WorkspaceTodayRailProps {
  actionsEnabled: boolean
  jobs: QualifiedJobRecord[]
  readinessPresentation?: ProfileReadinessPresentation | null
  screeningLocked?: boolean
}

function getNewTodayCount(jobs: QualifiedJobRecord[]) {
  return jobs.filter((job) => job.daysSincePosted === 0).length
}

export function WorkspaceTodayRail({
  actionsEnabled,
  jobs,
  readinessPresentation,
  screeningLocked = false,
}: WorkspaceTodayRailProps) {
  const { preparedJobs, savedJobs } = getDashboardQueues(jobs)
  const applyNextJob = getApplyNextJob({ preparedJobs, savedJobs })
  const applyNextAction = applyNextJob ? getApplyNextAction(applyNextJob) : null
  const newTodayCount = getNewTodayCount(jobs)

  return (
    <WorkspaceRailShell ariaLabel="Today">
      <section className="today-block">
        <TodayBlockHeading label="Apply next" title="" className="today-block-heading--label-only" />

        {screeningLocked ? (
          <div className="today-empty">
            <p>{readinessPresentation?.todayRailLines[0] ?? 'Complete your profile draft to unlock the queue.'}</p>
            <p>{readinessPresentation?.todayRailLines[1] ?? 'Upload your resume in Settings, generate the draft, review the extracted sections, then save.'}</p>
          </div>
        ) : applyNextJob ? (
          <div className="today-apply-next">
            <div className="today-apply-copy">
              <Link className="today-job-link" href={getJobReviewHref(applyNextJob.id)}>
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
                <Link
                  className="button button-primary"
                  href={applyNextAction?.href ?? getJobReviewHref(applyNextJob.id)}
                >
                  {applyNextAction?.label ?? 'Review'}
                </Link>
              )}

              <JobStageActionButton
                actionKind="skip"
                canEdit={actionsEnabled}
                disabledReason="Switch back to the database-backed queue to skip jobs."
                jobId={applyNextJob.id}
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
        <TodayBlockHeading label="" title="Snapshot" className="today-block-heading--title-only" />
        <dl className="today-stats">
          <div>
            <dt>New today</dt>
            <dd>{screeningLocked ? 0 : newTodayCount}</dd>
          </div>
          <div>
            <dt>Ready</dt>
            <dd>{preparedJobs.length}</dd>
          </div>
          <div>
            <dt>Saved</dt>
            <dd>{savedJobs.length}</dd>
          </div>
        </dl>
      </section>
    </WorkspaceRailShell>
  )
}
