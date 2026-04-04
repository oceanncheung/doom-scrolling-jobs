import Link from 'next/link'
import { notFound } from 'next/navigation'

import { JobStageActionButton } from '@/components/jobs/job-stage-action-button'
import { WorkspaceSurface } from '@/components/navigation/workspace-surface'
import { WorkspaceTodayRail } from '@/components/navigation/workspace-today-rail'
import { getRankedJob, getRankedJobs } from '@/lib/data/jobs'
import { requireActiveOperatorSelection } from '@/lib/data/operators'
import { getOperatorProfile } from '@/lib/data/operator-profile'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import {
  formatDateLabel,
  formatQueueSegmentLabel,
  formatRemoteLabel,
  formatScore,
  formatWorkflowLabel,
} from '@/lib/jobs/presentation'
import { getEffectiveSalaryInsight } from '@/lib/jobs/salary-estimation'

export const dynamic = 'force-dynamic'

interface JobDetailPageProps {
  params: Promise<{
    jobId: string
  }>
}

function getMatchReason(job: QualifiedJobRecord) {
  const candidates = [...job.fitReasons, ...job.strongReasons, job.queueReason].filter(Boolean)

  return (
    candidates.find((reason) => {
      const normalized = reason.toLowerCase()
      return !normalized.includes('remote-only eligibility') && !normalized.includes('remote region')
    }) ??
    candidates[0] ??
    job.queueReason
  )
}

function getRiskReason(job: QualifiedJobRecord) {
  return job.weakReasons[0] ?? 'No major blockers noted.'
}

function getLocationDisplay(job: QualifiedJobRecord) {
  const remoteLabel = formatRemoteLabel(job)
  const locationLabel = job.locationLabel?.trim()

  if (!locationLabel) {
    return remoteLabel
  }

  if (
    remoteLabel.toLowerCase() === locationLabel.toLowerCase() ||
    remoteLabel.toLowerCase().includes(locationLabel.toLowerCase())
  ) {
    return remoteLabel
  }

  return `${remoteLabel} · ${locationLabel}`
}

function getSalarySignal(job: QualifiedJobRecord, profile: Awaited<ReturnType<typeof getOperatorProfile>>['workspace']['profile']) {
  return getEffectiveSalaryInsight(job, profile).value
}

function toPlainDescription(value: string) {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function DetailActions({
  actionsEnabled,
  job,
}: {
  actionsEnabled: boolean
  job: QualifiedJobRecord
}) {
  switch (job.workflowStatus) {
    case 'new':
    case 'ranked':
      return (
        <div className="stage-actions">
          <JobStageActionButton
            canEdit={actionsEnabled}
            disabledReason="Switch back to the database-backed queue to save jobs."
            intent="shortlist"
            jobId={job.id}
            label="Save"
            sourceContext="job-detail"
            variant="primary"
          />
          <JobStageActionButton
            canEdit={actionsEnabled}
            disabledReason="Switch back to the database-backed queue to skip jobs."
            intent="dismiss"
            jobId={job.id}
            label="Skip"
            sourceContext="job-detail"
            variant="secondary"
          />
          <a className="button button-ghost button-small" href={job.sourceUrl} rel="noreferrer" target="_blank">
            Source
          </a>
        </div>
      )
    case 'shortlisted':
      return (
        <div className="stage-actions">
          <Link className="button button-primary button-small" href={`/jobs/${job.id}/packet`}>
            Prepare Application
          </Link>
          <JobStageActionButton
            canEdit={actionsEnabled}
            disabledReason="Switch back to the database-backed queue to remove saved jobs."
            intent="dismiss"
            jobId={job.id}
            label="Remove"
            sourceContext="job-detail"
            variant="secondary"
          />
          <a className="button button-ghost button-small" href={job.sourceUrl} rel="noreferrer" target="_blank">
            Source
          </a>
        </div>
      )
    case 'preparing':
      return (
        <div className="stage-actions">
          <Link className="button button-primary button-small" href={`/jobs/${job.id}/packet`}>
            Continue Preparation
          </Link>
          <JobStageActionButton
            canEdit={actionsEnabled}
            disabledReason="Switch back to the database-backed queue to mark jobs ready."
            jobId={job.id}
            label="Mark Ready"
            sourceContext="job-detail"
            variant="secondary"
            workflowStatus="ready_to_apply"
          />
          <a className="button button-ghost button-small" href={job.sourceUrl} rel="noreferrer" target="_blank">
            Source
          </a>
        </div>
      )
    case 'ready_to_apply':
      return (
        <div className="stage-actions">
          <a
            className="button button-primary button-small"
            href={job.applicationUrl ?? job.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            Apply
          </a>
          <JobStageActionButton
            canEdit={actionsEnabled}
            disabledReason="Switch back to the database-backed queue to mark jobs applied."
            jobId={job.id}
            label="Mark Applied"
            sourceContext="job-detail"
            variant="secondary"
            workflowStatus="applied"
          />
          <Link className="button button-ghost button-small" href={`/jobs/${job.id}/packet`}>
            Packet
          </Link>
        </div>
      )
    default:
      return (
        <div className="stage-actions">
          <Link className="button button-secondary button-small" href={`/jobs/${job.id}/packet`}>
            Packet
          </Link>
          <a className="button button-ghost button-small" href={job.sourceUrl} rel="noreferrer" target="_blank">
            Source
          </a>
          <Link className="button button-ghost button-small" href="/dashboard">
            Back to jobs
          </Link>
        </div>
      )
  }
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  await requireActiveOperatorSelection()
  const { jobId } = await params
  const [{ job, source }, { jobs, source: jobsSource }, { workspace }] = await Promise.all([
    getRankedJob(jobId),
    getRankedJobs(),
    getOperatorProfile(),
  ])

  if (!job) {
    notFound()
  }

  const actionsEnabled = source === 'database'
  const railActionsEnabled = jobsSource === 'database'

  return (
    <main className="page-stack workspace-surface">
      <WorkspaceSurface
        rail={
          <WorkspaceTodayRail
            actionsEnabled={railActionsEnabled}
            jobs={jobs}
          />
        }
      >
      <section className="page-header flow-header">
        <div className="page-heading">
          <p className="panel-label">{job.companyName}</p>
          <h1>{job.title}</h1>
          <p>{job.fitSummary}</p>
        </div>
        <div className="flow-snapshot">
          <div>
            <span className="panel-label">Queue</span>
            <strong>{formatQueueSegmentLabel(job.queueSegment)}</strong>
          </div>
          <div>
            <span className="panel-label">Fit / score</span>
            <strong>
              {job.roleFit.label} · {formatScore(job.queueScore)}
            </strong>
          </div>
          <div>
            <span className="panel-label">Status</span>
            <strong>{formatWorkflowLabel(job.workflowStatus)}</strong>
          </div>
        </div>
      </section>

      <section className="stage-shell">
        <div className="stage-summary-row">
          <div className="stage-summary-item">
            <span className="panel-label">Remote / location</span>
            <strong>{getLocationDisplay(job)}</strong>
          </div>
          <div className="stage-summary-item">
            <span className="panel-label">Salary</span>
            <strong>{getSalarySignal(job, workspace.profile)}</strong>
          </div>
          <div className="stage-summary-item">
            <span className="panel-label">Posted</span>
            <strong>{formatDateLabel(job.postedAt)}</strong>
          </div>
          <div className="stage-summary-item">
            <span className="panel-label">Freshness</span>
            <strong>{job.freshness.label}</strong>
          </div>
        </div>

        <DetailActions actionsEnabled={actionsEnabled} job={job} />
      </section>

      <section className="stage-shell">
        <div className="detail-pair-grid detail-pair-grid-stack">
          <div>
            <p className="panel-label">Why this job</p>
            <p>{getMatchReason(job)}</p>
          </div>
          <div>
            <p className="panel-label">What weakens it</p>
            <p>{getRiskReason(job)}</p>
          </div>
        </div>
      </section>

      <details className="panel disclosure" open>
        <summary className="disclosure-summary">
          <div>
            <p className="panel-label">Review</p>
            <h2>Fit reasoning</h2>
          </div>
        </summary>
        <div className="disclosure-body">
          <div className="detail-pair-grid detail-pair-grid-stack">
            <div>
              <p className="panel-label">Why it matches</p>
              <p>{job.fitSummary}</p>
              <ul className="reason-list">
                {job.strongReasons.length > 0 ? (
                  job.strongReasons.map((reason) => <li key={reason}>{reason}</li>)
                ) : (
                  <li>{getMatchReason(job)}</li>
                )}
              </ul>
            </div>
            <div>
              <p className="panel-label">Risks / gaps</p>
              <ul className="reason-list">
                {job.weakReasons.length > 0 ? (
                  job.weakReasons.map((reason) => <li key={reason}>{reason}</li>)
                ) : (
                  <li>{getRiskReason(job)}</li>
                )}
                {[...job.missingRequirements, ...job.redFlags, ...job.redFlagNotes]
                  .slice(0, 4)
                  .map((item) => (
                    <li key={item}>{item}</li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      </details>

      <details className="panel disclosure">
        <summary className="disclosure-summary">
          <div>
            <p className="panel-label">Qualification</p>
            <h2>Decision record</h2>
          </div>
        </summary>
        <div className="disclosure-body">
          <ul className="compact-list">
            <li>
              <strong>Eligibility</strong>
              <span>{job.eligibility.label}</span>
            </li>
            <li>
              <strong>Market fit</strong>
              <span>{job.marketFit.label}</span>
            </li>
            <li>
              <strong>Portfolio fit</strong>
              <span>{job.portfolioFitSignal.label}</span>
            </li>
            <li>
              <strong>Compensation</strong>
              <span>{job.compensationSignal.label}</span>
            </li>
            <li>
              <strong>Application friction</strong>
              <span>{job.applicationFriction.label}</span>
            </li>
          </ul>
        </div>
      </details>

      <details className="panel disclosure">
        <summary className="disclosure-summary">
          <div>
            <p className="panel-label">Role</p>
            <h2>Description</h2>
          </div>
        </summary>
        <div className="disclosure-body disclosure-body-stack">
          <p>{toPlainDescription(job.descriptionText)}</p>

          {job.requirements.length > 0 ? (
            <div className="detail-group">
              <strong>Requirements</strong>
              <ul className="reason-list">
                {job.requirements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {job.preferredQualifications.length > 0 ? (
            <div className="detail-group">
              <strong>Preferred qualifications</strong>
              <ul className="reason-list">
                {job.preferredQualifications.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {job.skillsKeywords.length > 0 ? (
            <div className="detail-group">
              <strong>Skills</strong>
              <div className="job-card-tags">
                {job.skillsKeywords.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </details>
      </WorkspaceSurface>
    </main>
  )
}
