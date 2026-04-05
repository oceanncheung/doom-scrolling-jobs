import type { ReactNode } from 'react'

import type { OperatorProfileRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import { buildStageRowSummary } from '@/lib/jobs/stage-row-view-model'
import { formatDateLabel, formatWorkflowLabel } from '@/lib/jobs/presentation'

export function StageRow({
  actions,
  children,
  detailLabel,
  job,
  profile,
  showActions = true,
}: {
  actions: ReactNode
  children: ReactNode
  detailLabel: string
  job: QualifiedJobRecord
  profile: OperatorProfileRecord
  showActions?: boolean
}) {
  const summary = buildStageRowSummary(job, profile)

  return (
    <article className="stage-row">
      <details aria-label={detailLabel} className="stage-disclosure">
        <summary className="screening-summary">
          <div className="screening-summary-grid">
            <div className="screening-cell screening-title-cell">
              <strong>{job.title}</strong>
              <span>{job.companyName}</span>
              <p className="screening-match">{summary.matchReason}</p>
            </div>

            <div className="screening-cell">
              <span className="stage-column-label">Remote / location</span>
              <strong>{summary.location}</strong>
            </div>

            <div className="screening-cell">
              <span className="stage-column-label">{summary.salaryLabel}</span>
              <strong>{summary.salaryValue}</strong>
            </div>

            <div className="screening-cell">
              <span className="stage-column-label">Fit</span>
              <strong>{summary.fitLabel}</strong>
              <span className="screening-fit-meta">{summary.fitScore}</span>
            </div>

            <div className="screening-cell">
              <span className="stage-column-label">Status</span>
              <strong>{formatWorkflowLabel(job.workflowStatus)}</strong>
              <span className="screening-freshness">
                {job.postedAt ? `${formatDateLabel(job.postedAt)} · ${summary.freshness}` : ''}
              </span>
            </div>
          </div>
        </summary>

        <div className="stage-expanded">{children}</div>
      </details>

      {showActions ? (
        <div aria-label={detailLabel} className="stage-actions-bar" role="group">
          <div className="stage-actions-cluster">{actions}</div>
        </div>
      ) : null}
    </article>
  )
}
