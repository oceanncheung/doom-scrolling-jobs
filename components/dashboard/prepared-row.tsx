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
}: {
  actionsEnabled: boolean
  job: QualifiedJobRecord
  profile: OperatorProfileRecord
}) {
  return (
    <StageRow
      actions={
        <div className="stage-actions">
          <a
            className="button button-primary button-small"
            href={job.applicationUrl ?? job.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            Apply
          </a>
          <JobStageActionButton
            canEdit={actionsEnabled}
            disabledReason="Switch back to the database-backed queue to mark jobs as applied."
            jobId={job.id}
            label="Mark applied"
            sourceContext="prepared-apply"
            variant="secondary"
            workflowStatus="applied"
          />
          <Link className="button button-ghost button-small" href={`/jobs/${job.id}/packet`}>
            Packet
          </Link>
        </div>
      }
      detailLabel="Application readiness"
      job={job}
      profile={profile}
    >
      <div className="detail-pair-grid detail-pair-grid-stack">
        <div>
          <p className="panel-label">Ready now</p>
          <ul className="readiness-list">
            <li>Resume ready</li>
            <li>Cover letter ready</li>
            <li>Answers ready</li>
          </ul>
        </div>
        <div>
          <p className="panel-label">Why it is still strong</p>
          <p>{job.fitSummary}</p>
        </div>
        <div>
          <p className="panel-label">Final watchout</p>
          <p>{getRiskReason(job)}</p>
        </div>
      </div>
    </StageRow>
  )
}
