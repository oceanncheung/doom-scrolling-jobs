'use client'

import { useActionState } from 'react'
import type { ReactNode } from 'react'

import { updateJobWorkflow, type JobWorkflowActionState } from '@/app/jobs/actions'
import type { WorkflowStatus } from '@/lib/domain/types'
import {
  getJobWorkflowQuickAction,
  type JobWorkflowQuickActionKind,
} from '@/lib/jobs/workflow-actions'

const initialState: JobWorkflowActionState = {
  message: '',
  status: 'idle',
}

interface JobStageActionButtonProps {
  actionKind?: JobWorkflowQuickActionKind
  canEdit: boolean
  disabledReason?: string
  intent?: 'dismiss' | 'save' | 'shortlist'
  jobId: string
  label?: string
  showMessage?: boolean
  sourceContext: string
  variant?: 'ghost' | 'primary' | 'secondary'
  workflowStatus?: WorkflowStatus
}

export function JobStageActionButton({
  actionKind,
  canEdit,
  disabledReason,
  intent,
  jobId,
  label: labelProp,
  showMessage = false,
  sourceContext,
  variant = 'secondary',
  workflowStatus,
}: JobStageActionButtonProps) {
  const [state, formAction, isPending] = useActionState(updateJobWorkflow, initialState)
  const isDisabled = !canEdit || isPending
  const message = !canEdit ? disabledReason : state.message
  const action = actionKind ? getJobWorkflowQuickAction(actionKind) : null
  const resolvedLabel = labelProp ?? action?.defaultLabel ?? 'Save'
  const submitLabel = isPending ? 'Saving...' : resolvedLabel

  /*
   * Build children as an array so the DOM has no whitespace-only text nodes between <input> and
   * <button>. A flex row `form` treats those nodes as extra flex items and breaks vertical centering
   * inside the button (especially visible on Skip / secondary).
   */
  const formChildren: ReactNode[] = [
    <input key="jobId" name="jobId" type="hidden" value={jobId} />,
    <input key="sourceContext" name="sourceContext" type="hidden" value={sourceContext} />,
  ]
  if (actionKind) {
    formChildren.push(<input key="actionKind" name="actionKind" type="hidden" value={actionKind} />)
  }
  if (intent) {
    formChildren.push(<input key="intent" name="intent" type="hidden" value={intent} />)
  }
  if (workflowStatus) {
    formChildren.push(<input key="workflowStatus" name="workflowStatus" type="hidden" value={workflowStatus} />)
  }
  formChildren.push(
    <button key="submit" className={`button button-${variant}`} disabled={isDisabled} type="submit">
      <span className="button__label">{submitLabel}</span>
    </button>,
  )
  if (showMessage && message) {
    formChildren.push(
      <p
        key="message"
        className={`action-note ${
          state.status === 'error' ? 'action-note-error' : 'action-note-success'
        }`}
      >
        {message}
      </p>,
    )
  }

  return <form action={formAction} className="stage-action-form">{formChildren}</form>
}
