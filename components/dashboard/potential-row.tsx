import Link from 'next/link'

import {
  StageDetailGrid,
  StageDetailItem,
  StageInlineLinks,
} from '@/components/dashboard/stage-primitives'
import { JobStageActionButton } from '@/components/jobs/job-stage-action-button'
import type { OperatorProfileRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'

import {
  formatFitBand,
  formatSourceLinkLabel,
  getDescriptionExcerpt,
  getFreshnessLabel,
  getLocationDisplay,
  getMatchReason,
  getRiskReason,
  getSalaryDisplay,
} from '@/lib/jobs/display'
import { getJobReviewHref } from '@/lib/jobs/review-navigation'
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
              <p className="screening-match">{getMatchReason(job)}</p>
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
        </summary>

        <div className="screening-expanded">
          <StageDetailGrid>
            <StageDetailItem className="screening-match-column" label="Why it matches">
              <p>{getMatchReason(job)}</p>
              <p className="screening-description-copy">{getDescriptionExcerpt(job)}</p>
            </StageDetailItem>
            <StageDetailItem label="Risks / gaps">
              <p>{getRiskReason(job)}</p>
            </StageDetailItem>
          </StageDetailGrid>

          <StageInlineLinks>
            <Link href={getJobReviewHref(job.id)}>More details</Link>
            <a href={job.sourceUrl} rel="noreferrer" target="_blank">
              {formatSourceLinkLabel(job)}
            </a>
          </StageInlineLinks>
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
