import Link from 'next/link'

import {
  StageDetailGrid,
  StageDetailItem,
} from '@/components/dashboard/stage-primitives'
import { StageRow } from '@/components/dashboard/stage-row'
import { getMatchReason } from '@/lib/jobs/display'
import { JobStageActionButton } from '@/components/jobs/job-stage-action-button'
import type { OperatorProfileRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import { getJobReviewHref } from '@/lib/jobs/review-navigation'
import { formatWorkflowLabel } from '@/lib/jobs/presentation'

export function ArchiveRow({
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
          <div className="stage-action-slot stage-action-slot--fit">
            <JobStageActionButton
              canEdit={actionsEnabled}
              disabledReason="Switch back to the database-backed queue to return jobs to Potential."
              jobId={job.id}
              label="Back to Potential"
              sourceContext="archive-restore"
              variant="secondary"
              workflowStatus="ranked"
            />
          </div>
          <div className="stage-action-slot stage-action-slot--status">
            <Link className="button button-ghost button-small" href={getJobReviewHref(job.id)}>
              Details
            </Link>
          </div>
        </div>
      }
      detailLabel="Why it left the queue"
      job={job}
      profile={profile}
      showActions={showActions}
    >
      <StageDetailGrid stack>
        <StageDetailItem label="Status">
          <p>{formatWorkflowLabel(job.workflowStatus)}</p>
        </StageDetailItem>
        <StageDetailItem label="Why it matched">
          <p>{getMatchReason(job)}</p>
        </StageDetailItem>
        <StageDetailItem label="Why it fell out">
          <p>{job.queueReason}</p>
        </StageDetailItem>
      </StageDetailGrid>
    </StageRow>
  )
}
