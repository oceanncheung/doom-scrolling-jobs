import Link from 'next/link'

import { StageRow } from '@/components/dashboard/stage-row'
import { getMatchReason } from '@/components/dashboard/formatters'
import { JobStageActionButton } from '@/components/jobs/job-stage-action-button'
import type { OperatorProfileRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import { formatWorkflowLabel } from '@/lib/jobs/presentation'

export function ArchiveRow({
  actionsEnabled,
  job,
  profile,
}: {
  actionsEnabled: boolean
  job: QualifiedJobRecord
  profile: OperatorProfileRecord
}) {
  return (
    <StageRow
      actions={
        <div className="stage-actions">
          <JobStageActionButton
            canEdit={actionsEnabled}
            disabledReason="Switch back to the database-backed queue to return jobs to Potential."
            jobId={job.id}
            label="Back to Potential"
            sourceContext="archive-restore"
            variant="secondary"
            workflowStatus="ranked"
          />
          <Link className="button button-ghost button-small" href={`/jobs/${job.id}`}>
            Details
          </Link>
        </div>
      }
      detailLabel="Why it left the queue"
      job={job}
      profile={profile}
    >
      <div className="detail-pair-grid detail-pair-grid-stack">
        <div>
          <p className="panel-label">Status</p>
          <p>{formatWorkflowLabel(job.workflowStatus)}</p>
        </div>
        <div>
          <p className="panel-label">Why it matched</p>
          <p>{getMatchReason(job)}</p>
        </div>
        <div>
          <p className="panel-label">Why it fell out</p>
          <p>{job.queueReason}</p>
        </div>
      </div>
    </StageRow>
  )
}
