import Link from 'next/link'

import { StageRow } from '@/components/dashboard/stage-row'
import { getRiskReason } from '@/components/dashboard/formatters'
import { JobStageActionButton } from '@/components/jobs/job-stage-action-button'
import type { OperatorProfileRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'

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
            <Link className="button button-ghost button-small" href={`/jobs/${job.id}/packet`}>
              Packet
            </Link>
          </div>
        </div>
      }
      detailLabel="Ready materials"
      job={job}
      profile={profile}
      showActions={showActions}
    >
      <div className="detail-pair-grid detail-pair-grid-stack">
        <div>
          <p className="panel-label">Ready now</p>
          <ul className="readiness-list">
            <li>Resume prepared</li>
            <li>Cover letter prepared</li>
            <li>Answers recognized</li>
          </ul>
        </div>
        <div>
          <p className="panel-label">Next step</p>
          <p>Open the packet if you want one last review, or apply directly from here.</p>
        </div>
        <div>
          <p className="panel-label">Before applying</p>
          <p>{getRiskReason(job)}</p>
        </div>
      </div>
    </StageRow>
  )
}
