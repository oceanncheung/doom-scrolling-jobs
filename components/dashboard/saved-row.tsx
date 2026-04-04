import Link from 'next/link'

import { StageRow } from '@/components/dashboard/stage-row'
import { getMatchReason, getRiskReason } from '@/components/dashboard/formatters'
import { JobStageActionButton } from '@/components/jobs/job-stage-action-button'
import type { OperatorProfileRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'

export function SavedRow({
  actionsEnabled,
  job,
  profile,
}: {
  actionsEnabled: boolean
  job: QualifiedJobRecord
  profile: OperatorProfileRecord
}) {
  const packetLabel = job.workflowStatus === 'preparing' ? 'Continue prep' : 'Prepare application'

  return (
    <StageRow
      actions={
        <div className="stage-actions">
          <Link className="button button-primary button-small" href={`/jobs/${job.id}/packet`}>
            {packetLabel}
          </Link>
          <JobStageActionButton
            canEdit={actionsEnabled}
            disabledReason="Switch back to the database-backed queue to return jobs to Potential."
            jobId={job.id}
            label="Back to Potential"
            sourceContext="saved-review"
            variant="secondary"
            workflowStatus="ranked"
          />
          <JobStageActionButton
            canEdit={actionsEnabled}
            disabledReason="Switch back to the database-backed queue to remove saved jobs."
            intent="dismiss"
            jobId={job.id}
            label="Remove"
            sourceContext="saved-review"
            variant="secondary"
          />
          <Link className="button button-ghost button-small" href={`/jobs/${job.id}`}>
            Details
          </Link>
        </div>
      }
      detailLabel="Review fit"
      job={job}
      profile={profile}
    >
      <div className="detail-pair-grid detail-pair-grid-stack">
        <div>
          <p className="panel-label">Fit summary</p>
          <p>{job.fitSummary}</p>
        </div>
        <div>
          <p className="panel-label">Why it matches</p>
          <p>{getMatchReason(job)}</p>
        </div>
        <div>
          <p className="panel-label">Risks / gaps</p>
          <p>{getRiskReason(job)}</p>
        </div>
      </div>
    </StageRow>
  )
}
