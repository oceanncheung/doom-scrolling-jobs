'use client'

import { useActionState } from 'react'

import { updateJobWorkflow, type JobWorkflowActionState } from '@/app/jobs/actions'
import {
  ActionFormMessage,
  getPendingActionLabel,
  initialActionFormState,
} from '@/components/jobs/action-form-primitives'
import { workflowStatuses, type WorkflowStatus } from '@/lib/domain/types'
import { formatWorkflowLabel } from '@/lib/jobs/presentation'
import {
  getJobWorkflowQuickAction,
  isJobWorkflowQuickActionDisabled,
  workflowEditingUnavailableReason,
} from '@/lib/jobs/workflow-actions'

const initialState: JobWorkflowActionState = initialActionFormState

interface JobWorkflowControlsProps {
  canEdit: boolean
  compact?: boolean
  currentStatus: WorkflowStatus
  disabledReason?: string
  jobId: string
  showDisabledNote?: boolean
  sourceContext: string
}

export function JobWorkflowControls({
  canEdit,
  compact = false,
  currentStatus,
  disabledReason,
  jobId,
  showDisabledNote = true,
  sourceContext,
}: JobWorkflowControlsProps) {
  const [state, formAction, isPending] = useActionState(updateJobWorkflow, initialState)
  const saveAction = getJobWorkflowQuickAction('save')
  const archiveAction = getJobWorkflowQuickAction('archive')

  return (
    <form
      action={formAction}
      className={`workflow-control ${compact ? 'workflow-control-compact' : ''}`}
    >
      <input name="jobId" type="hidden" value={jobId} />
      <input name="sourceContext" type="hidden" value={sourceContext} />

      <div className="workflow-control-meta">
        {!compact ? <p className="panel-label">Workflow actions</p> : null}
        <p className="workflow-current-status">
          {compact ? 'Status' : 'Current status:'} <strong>{formatWorkflowLabel(currentStatus)}</strong>
        </p>
      </div>

      <div className="workflow-quick-actions">
        <button
          className="button button-secondary button-small"
          disabled={!canEdit || isPending || isJobWorkflowQuickActionDisabled(currentStatus, saveAction.kind)}
          name="actionKind"
          type="submit"
          value={saveAction.kind}
        >
          {getPendingActionLabel({
            defaultLabel: saveAction.defaultLabel,
            isPending,
          })}
        </button>
        <button
          className="button button-ghost button-small"
          disabled={!canEdit || isPending || isJobWorkflowQuickActionDisabled(currentStatus, archiveAction.kind)}
          name="actionKind"
          type="submit"
          value={archiveAction.kind}
        >
          {getPendingActionLabel({
            defaultLabel: 'Dismiss',
            isPending,
          })}
        </button>
      </div>

      <div className="workflow-select-row">
        <label className="workflow-select-label" htmlFor={`workflow-status-${jobId}`}>
          <span>{compact ? 'Move' : 'Move to any status'}</span>
          <select
            defaultValue={currentStatus}
            disabled={!canEdit || isPending}
            id={`workflow-status-${jobId}`}
            name="workflowStatus"
          >
            {workflowStatuses.map((status) => (
              <option key={status} value={status}>
                {formatWorkflowLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button button-primary button-small"
          disabled={!canEdit || isPending}
          name="intent"
          type="submit"
          value="save"
        >
          {getPendingActionLabel({
            defaultLabel: compact ? 'Save' : 'Save status',
            isPending,
          })}
        </button>
      </div>

      {!canEdit && showDisabledNote ? (
        <p className="workflow-note">
          {disabledReason ?? workflowEditingUnavailableReason}
        </p>
      ) : null
      }

      {state.status !== 'idle' ? (
        <ActionFormMessage
          className="workflow-message"
          message={state.message}
          status={state.status}
          tone="form-message"
        />
      ) : null}
    </form>
  )
}
