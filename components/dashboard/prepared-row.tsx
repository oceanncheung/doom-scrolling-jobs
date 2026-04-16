import Link from 'next/link'

import { ApplyJobButton } from '@/components/jobs/apply-job-button'
import {
  StageDetailGrid,
  StageDetailItem,
} from '@/components/dashboard/stage-primitives'
import { StageRow } from '@/components/dashboard/stage-row'
import { getRiskReason } from '@/lib/jobs/display'
import { JobStageActionButton } from '@/components/jobs/job-stage-action-button'
import type { OperatorProfileRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import { getJobReviewHref } from '@/lib/jobs/review-navigation'
import { getWorkflowActionDisabledReason } from '@/lib/jobs/workflow-actions'

export function PreparedRow({
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
  return (
    <StageRow
      actions={
        <div className="stage-actions">
          <div className="stage-action-slot stage-action-slot--remote-salary">
            <ApplyJobButton
              canEdit={actionsEnabled}
              disabledReason={getWorkflowActionDisabledReason('apply')}
              href={job.applicationUrl ?? job.sourceUrl}
              jobId={job.id}
              sourceContext="prepared-apply"
              variant="primary"
            />
          </div>
          <div className="stage-action-slot stage-action-slot--fit">
            <Link className="button button-secondary button-small" href={getJobReviewHref(job.id)}>
              Review
            </Link>
          </div>
          <div className="stage-action-slot stage-action-slot--status">
            <JobStageActionButton
              actionKind="archive"
              canEdit={actionsEnabled}
              disabledReason={getWorkflowActionDisabledReason('archive')}
              jobId={job.id}
              sourceContext="prepared-apply"
              variant="secondary"
            />
          </div>
        </div>
      }
      detailLabel="Ready materials"
      job={job}
      profile={profile}
      showActions={showActions}
    >
      <StageDetailGrid stack>
        <StageDetailItem label="Ready now">
          <ul className="readiness-list">
            <li>Resume prepared</li>
            <li>Cover letter prepared</li>
            <li>Answers recognized</li>
          </ul>
        </StageDetailItem>
        <StageDetailItem label="Next step">
          <p>Open the packet if you want one last review, or apply directly from here.</p>
        </StageDetailItem>
        <StageDetailItem label="Before applying">
          <p>{getRiskReason(job)}</p>
        </StageDetailItem>
      </StageDetailGrid>
    </StageRow>
  )
}
