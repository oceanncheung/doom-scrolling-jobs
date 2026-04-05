import { GeneratePacketButton } from '@/components/jobs/generate-packet-button'
import { JobStageActionButton } from '@/components/jobs/job-stage-action-button'
import type { ApplicationPacketRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'

function PrepSubmitButton({
  canSave,
  disabledReason,
  hasDraft,
}: {
  canSave: boolean
  disabledReason?: string
  hasDraft: boolean
}) {
  return (
    <button
      className="button button-primary button-small"
      disabled={!canSave}
      form="packet-form"
      name="submitIntent"
      title={!canSave ? disabledReason : undefined}
      type="submit"
      value={hasDraft ? 'mark-ready' : 'save-review'}
    >
      {hasDraft ? 'Mark Ready' : 'Save Review'}
    </button>
  )
}

interface JobOverviewActionsProps {
  canGenerate: boolean
  canSave: boolean
  generationDisabledReason?: string
  job: QualifiedJobRecord
  packet: ApplicationPacketRecord
  prepOpen: boolean
  saveDisabledReason?: string
  screeningLocked?: boolean
}

export function JobOverviewActions({
  canGenerate,
  canSave,
  generationDisabledReason,
  job,
  packet,
  prepOpen,
  saveDisabledReason,
  screeningLocked = false,
}: JobOverviewActionsProps) {
  const hasGeneratedContent = packet.generationStatus === 'generated'

  if (screeningLocked) {
    return null
  }

  if (prepOpen) {
    if (job.workflowStatus === 'ready_to_apply') {
      return (
        <div
          aria-label="Job overview actions"
          className="screening-actions-bar job-overview-actions job-overview-actions--pair-right"
          role="group"
        >
          <div className="screening-actions-cluster">
            <div className="screening-action-slot">
              <a
                className="button button-primary button-small"
                href={job.applicationUrl ?? job.sourceUrl}
                rel="noreferrer"
                target="_blank"
              >
                Apply
              </a>
            </div>
            <div className="screening-action-slot">
              <JobStageActionButton
                canEdit={canSave}
                disabledReason={saveDisabledReason || 'Switch back to the database-backed queue to mark jobs applied.'}
                jobId={job.id}
                label="Mark Applied"
                sourceContext="job-flow"
                variant="secondary"
                workflowStatus="applied"
              />
            </div>
          </div>
        </div>
      )
    }

    const showShortlistArchive = job.workflowStatus === 'shortlisted'
    const slotCount = 1 + (hasGeneratedContent ? 1 : 0) + (showShortlistArchive ? 1 : 0)
    const layoutClass =
      slotCount >= 3
        ? 'job-overview-actions--triple-right'
        : slotCount >= 2
          ? 'job-overview-actions--pair-right'
          : 'job-overview-actions--single-right'

    return (
      <div
        aria-label="Job overview actions"
        className={`screening-actions-bar job-overview-actions ${layoutClass}`}
        role="group"
      >
        <div className="screening-actions-cluster">
          <div className="screening-action-slot">
            {hasGeneratedContent ? (
              <PrepSubmitButton canSave={canSave} disabledReason={saveDisabledReason} hasDraft />
            ) : (
              <GeneratePacketButton canEdit={canGenerate} disabledReason={generationDisabledReason} jobId={job.id} />
            )}
          </div>
          {hasGeneratedContent ? (
            <div className="screening-action-slot">
              <a className="button button-ghost button-small" href="#packet-materials-section">
                Review Materials
              </a>
            </div>
          ) : null}
          {showShortlistArchive ? (
            <div className="screening-action-slot">
              <JobStageActionButton
                canEdit={canSave}
                disabledReason={saveDisabledReason || 'Switch back to the database-backed queue to archive saved jobs.'}
                intent="dismiss"
                jobId={job.id}
                label="Archive"
                sourceContext="job-flow"
                variant="secondary"
              />
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  if (job.workflowStatus !== 'new' && job.workflowStatus !== 'ranked') {
    return null
  }

  return (
    <div
      aria-label="Job overview actions"
      className="screening-actions-bar job-overview-actions job-overview-actions--pair-right"
      role="group"
    >
      <div className="screening-actions-cluster">
        <div className="screening-action-slot">
          <JobStageActionButton
            canEdit={canSave}
            disabledReason={saveDisabledReason || 'Switch back to the database-backed queue to save jobs.'}
            intent="shortlist"
            jobId={job.id}
            label="Save"
            sourceContext="job-flow"
            variant="primary"
          />
        </div>
        <div className="screening-action-slot">
          <JobStageActionButton
            canEdit={canSave}
            disabledReason={saveDisabledReason || 'Switch back to the database-backed queue to skip jobs.'}
            intent="dismiss"
            jobId={job.id}
            label="Skip"
            sourceContext="job-flow"
            variant="secondary"
          />
        </div>
      </div>
    </div>
  )
}
