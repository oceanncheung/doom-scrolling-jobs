import Link from 'next/link'

import { JobStageActionButton } from '@/components/jobs/job-stage-action-button'
import type { OperatorProfileRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'

import {
  formatFitBand,
  getDescriptionExcerpt,
  getFreshnessLabel,
  getLocationDisplay,
  getMatchReason,
  getRiskReason,
  getSalaryDisplay,
} from '@/components/dashboard/formatters'
import { formatDateLabel } from '@/lib/jobs/presentation'

export function PotentialRow({
  actionsEnabled,
  job,
  profile,
}: {
  actionsEnabled: boolean
  job: QualifiedJobRecord
  profile: OperatorProfileRecord
}) {
  const salary = getSalaryDisplay(job, profile)
  const fit = formatFitBand(job)

  return (
    <article className="screening-row">
      <details className="screening-disclosure">
        <summary className="screening-summary">
          <div className="screening-summary-grid">
            <div className="screening-cell screening-title-cell">
              <strong>{job.title}</strong>
              <span>{job.companyName}</span>
            </div>

            <div className="screening-cell">
              <span className="stage-column-label">Remote / location</span>
              <strong>{getLocationDisplay(job)}</strong>
            </div>

            <div className="screening-cell">
              <span className="stage-column-label">{salary.label}</span>
              <strong>{salary.value}</strong>
            </div>

            <div className="screening-cell">
              <span className="stage-column-label">Fit</span>
              <strong>{fit.label}</strong>
              <span className="screening-fit-meta">{fit.score}</span>
            </div>

            <div className="screening-cell">
              <span className="stage-column-label">Posted</span>
              <strong>{formatDateLabel(job.postedAt)}</strong>
              <span className="screening-freshness">{getFreshnessLabel(job)}</span>
            </div>
          </div>

          <p className="screening-match">{getMatchReason(job)}</p>
        </summary>

        <div className="screening-expanded">
          <div className="detail-pair-grid">
            <div>
              <p className="panel-label">Why it matches</p>
              <p>{job.fitSummary}</p>
            </div>
            <div>
              <p className="panel-label">Risks / gaps</p>
              <p>{getRiskReason(job)}</p>
            </div>
          </div>

          <div className="screening-description">
            <p className="panel-label">Description excerpt</p>
            <p>{getDescriptionExcerpt(job)}</p>
          </div>

          <div className="inline-link-row">
            <Link href={`/jobs/${job.id}`}>More details</Link>
            <a href={job.sourceUrl} rel="noreferrer" target="_blank">
              Source
            </a>
          </div>
        </div>
      </details>

      <div aria-label="Screening actions" className="screening-actions-bar" role="group">
        <div className="screening-actions-cluster">
          <div className="screening-action-slot">
            <JobStageActionButton
              canEdit={actionsEnabled}
              disabledReason="Switch back to the database-backed queue to save jobs."
              intent="shortlist"
              jobId={job.id}
              label="Save"
              sourceContext="potential-jobs"
              variant="primary"
            />
          </div>
          <div className="screening-action-slot">
            <JobStageActionButton
              canEdit={actionsEnabled}
              disabledReason="Switch back to the database-backed queue to skip jobs."
              intent="dismiss"
              jobId={job.id}
              label="Skip"
              sourceContext="potential-jobs"
              variant="secondary"
            />
          </div>
        </div>
      </div>
    </article>
  )
}
