import Link from 'next/link'

import {
  StageDetailGrid,
  StageDetailItem,
  StageInlineLinks,
} from '@/components/dashboard/stage-primitives'
import { StageRow } from '@/components/dashboard/stage-row'
import { formatSourceLinkLabel, getMatchReason, getRiskReason } from '@/lib/jobs/display'
import { JobStageActionButton } from '@/components/jobs/job-stage-action-button'
import type { OperatorProfileRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import { getInternalJobReviewLabel, getJobReviewHref } from '@/lib/jobs/review-navigation'
import { getWorkflowActionDisabledReason } from '@/lib/jobs/workflow-actions'

export function SavedRow({
  actionsEnabled,
  job,
  profile,
  showActions = true,
}: {
  actionsEnabled: boolean
  job: QualifiedJobRecord
  profile: OperatorProfileRecord
  showActions?: boolean
}) {
  const reviewLabel = getInternalJobReviewLabel(job.workflowStatus)

  return (
    <StageRow
      actions={
        <div className="stage-actions stage-actions--saved">
          <div className="stage-action-slot stage-action-slot--remote-salary">
            <Link className="button button-primary button-small" href={getJobReviewHref(job.id)}>
              {reviewLabel}
            </Link>
          </div>
          <div className="stage-action-slot stage-action-slot--fit">
            <JobStageActionButton
              actionKind="restore"
              canEdit={actionsEnabled}
              disabledReason={getWorkflowActionDisabledReason('restore')}
              jobId={job.id}
              sourceContext="saved-review"
              variant="secondary"
            />
          </div>
        </div>
      }
      detailLabel="Review fit"
      job={job}
      profile={profile}
      showActions={showActions}
    >
      <StageDetailGrid stack>
        <StageDetailItem label="Fit summary">
          <p>{job.fitSummary}</p>
        </StageDetailItem>
        <StageDetailItem label="Why it matches">
          <p>{getMatchReason(job)}</p>
        </StageDetailItem>
        <StageDetailItem label="Risks / gaps">
          <p>{getRiskReason(job)}</p>
        </StageDetailItem>
      </StageDetailGrid>

      <StageInlineLinks>
        <Link href={getJobReviewHref(job.id)}>Details</Link>
        <a href={job.sourceUrl} rel="noreferrer" target="_blank">
          {formatSourceLinkLabel(job)}
        </a>
      </StageInlineLinks>
    </StageRow>
  )
}
