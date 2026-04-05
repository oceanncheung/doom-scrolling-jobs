import Link from 'next/link'

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
            <a
              className="button button-primary button-small"
              href={job.applicationUrl ?? job.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              Apply
            </a>
          </div>
          <div className="stage-action-slot stage-action-slot--fit">
            <JobStageActionButton
              canEdit={actionsEnabled}
              disabledReason="Switch back to the database-backed queue to mark jobs as applied."
              jobId={job.id}
              label="Mark Applied"
              sourceContext="prepared-apply"
              variant="secondary"
              workflowStatus="applied"
            />
          </div>
          <div className="stage-action-slot stage-action-slot--status">
            <Link className="button button-ghost button-small" href={getJobReviewHref(job.id)}>
              Review
            </Link>
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
