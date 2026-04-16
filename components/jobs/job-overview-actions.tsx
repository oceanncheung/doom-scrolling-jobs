import type { ReactNode } from 'react'

import { ApplyJobButton } from '@/components/jobs/apply-job-button'
import { GeneratePacketButton } from '@/components/jobs/generate-packet-button'
import { JobStageActionButton } from '@/components/jobs/job-stage-action-button'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import type { JobOverviewActionModel } from '@/lib/jobs/job-overview-action-model'
import { getWorkflowActionDisabledReason } from '@/lib/jobs/workflow-actions'

interface JobOverviewActionsProps {
  actionModel: JobOverviewActionModel
  canGenerate: boolean
  canSave: boolean
  generationDisabledReason?: string
  job: QualifiedJobRecord
  saveDisabledReason?: string
}

function createActionSlot(key: string, content: ReactNode) {
  return (
    <div key={key} className="screening-action-slot">
      {content}
    </div>
  )
}

export function JobOverviewActions({
  actionModel,
  canGenerate,
  canSave,
  generationDisabledReason,
  job,
  saveDisabledReason,
}: JobOverviewActionsProps) {
  let actionSlots: ReactNode[] = []

  switch (actionModel.kind) {
    case 'packet':
      if (actionModel.hasGeneratedContent) {
        actionSlots.push(
          createActionSlot(
            'apply',
            <ApplyJobButton
              canEdit={canSave}
              disabledReason={saveDisabledReason || getWorkflowActionDisabledReason('apply')}
              href={job.applicationUrl ?? job.sourceUrl}
              jobId={job.id}
              sourceContext="job-flow"
              variant="primary"
            />,
          ),
        )
        actionSlots.push(
          createActionSlot(
            'regenerate-materials',
            <GeneratePacketButton
              canEdit={canGenerate}
              defaultLabel="Regenerate"
              disabledReason={generationDisabledReason}
              jobId={job.id}
              pendingLabel="Regenerating..."
              variant="secondary"
            />,
          ),
        )
      } else {
        actionSlots.push(
          createActionSlot(
            'generate-content',
            <GeneratePacketButton
              canEdit={canGenerate}
              defaultLabel={actionModel.generateLabel}
              disabledReason={generationDisabledReason}
              jobId={job.id}
            />,
          ),
        )
      }

      if (actionModel.showRestore) {
        actionSlots.push(
          createActionSlot(
            'potential',
            <JobStageActionButton
              actionKind="restore"
              canEdit={canSave}
              disabledReason={saveDisabledReason || getWorkflowActionDisabledReason('restore')}
              jobId={job.id}
              sourceContext="job-flow"
              variant="secondary"
            />,
          ),
        )
      }

      if (actionModel.showArchive) {
        actionSlots.push(
          createActionSlot(
            'archive',
            <JobStageActionButton
              actionKind="archive"
              canEdit={canSave}
              disabledReason={saveDisabledReason || getWorkflowActionDisabledReason('archive')}
              jobId={job.id}
              sourceContext="job-flow"
              variant="secondary"
            />,
          ),
        )
      }
      break

    case 'screening':
      actionSlots = [
        createActionSlot(
          'save',
          <JobStageActionButton
            actionKind="save"
            canEdit={canSave}
            disabledReason={saveDisabledReason || getWorkflowActionDisabledReason('save')}
            jobId={job.id}
            sourceContext="job-flow"
            variant="primary"
          />,
        ),
        createActionSlot(
          'skip',
          <JobStageActionButton
            actionKind="skip"
            canEdit={canSave}
            disabledReason={saveDisabledReason || getWorkflowActionDisabledReason('skip')}
            jobId={job.id}
            sourceContext="job-flow"
            variant="secondary"
          />,
        ),
      ]
      break
  }

  return (
    <div
      aria-label="Job overview actions"
      className={`screening-actions-bar job-overview-actions job-overview-actions--${actionModel.kind} ${actionModel.layoutClass}`}
      role="group"
    >
      <div className="screening-actions-cluster">{actionSlots}</div>
    </div>
  )
}
