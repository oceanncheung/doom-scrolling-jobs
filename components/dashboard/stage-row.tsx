import type { ReactNode } from 'react'

import type { OperatorProfileRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import { formatDateLabel, formatWorkflowLabel } from '@/lib/jobs/presentation'

import {
  formatFitBand,
  getFreshnessLabel,
  getLocationDisplay,
  getMatchReason,
  getSalaryDisplay,
} from '@/components/dashboard/formatters'

export function StageRow({
  actions,
  children,
  detailLabel,
  job,
  profile,
}: {
  actions: ReactNode
  children: ReactNode
  detailLabel: string
  job: QualifiedJobRecord
  profile: OperatorProfileRecord
}) {
  const salary = getSalaryDisplay(job, profile)
  const fit = formatFitBand(job)

  return (
    <article className="stage-row">
      <details aria-label={detailLabel} className="stage-disclosure">
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
              <span className="stage-column-label">Status</span>
              <strong>{formatWorkflowLabel(job.workflowStatus)}</strong>
              <span className="screening-freshness">
                {job.postedAt ? `${formatDateLabel(job.postedAt)} · ${getFreshnessLabel(job)}` : ''}
              </span>
            </div>
          </div>

          <p className="screening-match">{getMatchReason(job)}</p>
        </summary>

        <div className="stage-expanded">{children}</div>
      </details>

      <div aria-label={detailLabel} className="stage-actions-bar" role="group">
        <div className="stage-actions-cluster">{actions}</div>
      </div>
    </article>
  )
}
