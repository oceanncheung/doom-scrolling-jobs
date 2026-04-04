import Link from 'next/link'

import { StageRow } from '@/components/dashboard/stage-row'
import { getRiskReason } from '@/components/dashboard/formatters'
import type { OperatorProfileRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import { formatWorkflowLabel } from '@/lib/jobs/presentation'

export function AppliedRow({
  job,
  profile,
}: {
  job: QualifiedJobRecord
  profile: OperatorProfileRecord
}) {
  return (
    <StageRow
      actions={
        <div className="stage-actions">
          <div className="stage-action-slot stage-action-slot--remote">
            <Link className="button button-primary button-small" href={`/jobs/${job.id}/packet`}>
              View packet
            </Link>
          </div>
          <div className="stage-action-slot stage-action-slot--salary">
            <a
              className="button button-ghost button-small"
              href={job.applicationUrl ?? job.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              Source
            </a>
          </div>
        </div>
      }
      detailLabel="Application context"
      job={job}
      profile={profile}
    >
      <div className="detail-pair-grid detail-pair-grid-stack">
        <div>
          <p className="panel-label">Status</p>
          <p>{formatWorkflowLabel(job.workflowStatus)}</p>
        </div>
        <div>
          <p className="panel-label">Why it made the cut</p>
          <p>{job.fitSummary}</p>
        </div>
        <div>
          <p className="panel-label">Watchout</p>
          <p>{getRiskReason(job)}</p>
        </div>
      </div>
    </StageRow>
  )
}
