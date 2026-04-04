import Link from 'next/link'
import type { ReactNode } from 'react'

import type { OperatorProfileRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import { formatWorkflowLabel } from '@/lib/jobs/presentation'

import {
  formatFitBand,
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
      <div className="stage-row-grid">
        <div className="stage-column stage-column-title">
          <Link className="stage-title-link" href={`/jobs/${job.id}`}>
            {job.title}
          </Link>
          <span>{job.companyName}</span>
        </div>

        <div className="stage-column">
          <span className="stage-column-label">Remote / location</span>
          <strong>{getLocationDisplay(job)}</strong>
        </div>

        <div className="stage-column">
          <span className="stage-column-label">{salary.label}</span>
          <strong>{salary.value}</strong>
        </div>

        <div className="stage-column">
          <span className="stage-column-label">Fit</span>
          <strong>{fit.label}</strong>
          <span className="stage-fit-meta">{fit.score}</span>
        </div>

        <div className="stage-column">
          <span className="stage-column-label">Status</span>
          <strong>{formatWorkflowLabel(job.workflowStatus)}</strong>
        </div>

        <div className="stage-column stage-column-actions">{actions}</div>
      </div>

      <p className="stage-row-reason">{getMatchReason(job)}</p>

      <details className="inline-disclosure">
        <summary>{detailLabel}</summary>
        <div className="inline-disclosure-body">{children}</div>
      </details>
    </article>
  )
}
