import Link from 'next/link'

import {
  StageDetailGrid,
  StageDetailItem,
} from '@/components/dashboard/stage-primitives'
import { StageRow } from '@/components/dashboard/stage-row'
import { formatSourceLinkLabel, getMatchReason, getRiskReason } from '@/lib/jobs/display'
import type { OperatorProfileRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import { getJobReviewHref } from '@/lib/jobs/review-navigation'
import { formatWorkflowLabel } from '@/lib/jobs/presentation'

export function AppliedRow({
  job,
  profile,
  showActions = true,
}: {
  job: QualifiedJobRecord
  profile: OperatorProfileRecord
  showActions?: boolean
}) {
  return (
    <StageRow
      actions={
        <div className="stage-actions stage-actions--applied">
          <div className="stage-action-slot stage-action-slot--remote-salary">
            <Link className="button button-primary button-small" href={getJobReviewHref(job.id)}>
              Review
            </Link>
          </div>
          <div className="stage-action-slot stage-action-slot--fit">
            <a
              className="button button-ghost button-small"
              href={job.applicationUrl ?? job.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              {formatSourceLinkLabel(job)}
            </a>
          </div>
        </div>
      }
      detailLabel="Application context"
      job={job}
      profile={profile}
      showActions={showActions}
    >
      <StageDetailGrid stack>
        <StageDetailItem label="Status">
          <p>{formatWorkflowLabel(job.workflowStatus)}</p>
        </StageDetailItem>
        <StageDetailItem label="Why it made the cut">
          <p>{getMatchReason(job)}</p>
        </StageDetailItem>
        <StageDetailItem label="Watchout">
          <p>{getRiskReason(job)}</p>
        </StageDetailItem>
      </StageDetailGrid>
    </StageRow>
  )
}
