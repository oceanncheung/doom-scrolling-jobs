'use client'

import { useActionState } from 'react'

import { updateJobWorkflow, type JobWorkflowActionState } from '@/app/jobs/actions'
import { workflowStatuses, type WorkflowStatus } from '@/lib/domain/types'
import { formatWorkflowLabel } from '@/lib/jobs/presentation'

const initialState: JobWorkflowActionState = {
  message: '',
  status: 'idle',
}

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
          disabled={!canEdit || isPending || currentStatus === 'shortlisted'}
          name="intent"
          type="submit"
          value="shortlist"
        >
          {isPending ? 'Saving...' : 'Shortlist'}
        </button>
        <button
          className="button button-ghost button-small"
          disabled={!canEdit || isPending || currentStatus === 'archived'}
          name="intent"
          type="submit"
          value="dismiss"
        >
          {isPending ? 'Saving...' : 'Dismiss'}
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
          {isPending ? 'Saving...' : compact ? 'Save' : 'Save status'}
        </button>
      </div>

      {!canEdit && showDisabledNote ? (
        <p className="workflow-note">
          {disabledReason ?? 'Connect Supabase persistence before saving workflow feedback.'}
        </p>
      ) : null
      }

      {state.status !== 'idle' ? (
        <p
          className={`form-message workflow-message ${
            state.status === 'success' ? 'form-message-success' : 'form-message-error'
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
