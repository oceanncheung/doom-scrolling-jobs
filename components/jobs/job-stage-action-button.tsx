'use client'

import { useActionState } from 'react'

import { updateJobWorkflow, type JobWorkflowActionState } from '@/app/jobs/actions'
import {
  createStageActionFormChildren,
  getActionFormMessage,
  getPendingActionLabel,
  initialActionFormState,
} from '@/components/jobs/action-form-primitives'
import type { WorkflowStatus } from '@/lib/domain/types'
import {
  getJobWorkflowQuickAction,
  type JobWorkflowQuickActionKind,
} from '@/lib/jobs/workflow-actions'

const initialState: JobWorkflowActionState = initialActionFormState

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
  const message = getActionFormMessage({ canEdit, disabledReason, state })
  const action = actionKind ? getJobWorkflowQuickAction(actionKind) : null
  const resolvedLabel = labelProp ?? action?.defaultLabel ?? 'Save'

  /*
   * Build children as an array so the DOM has no whitespace-only text nodes between the hidden
   * inputs and submit button. A flex row `form` treats those nodes as extra flex items and breaks
   * vertical centering inside the button (especially visible on Skip / secondary).
   */
  const hiddenFields = [
    { name: 'jobId', value: jobId },
    { name: 'sourceContext', value: sourceContext },
    ...(actionKind ? [{ name: 'actionKind', value: actionKind }] : []),
    ...(intent ? [{ name: 'intent', value: intent }] : []),
    ...(workflowStatus ? [{ name: 'workflowStatus', value: workflowStatus }] : []),
  ]
  const formChildren = createStageActionFormChildren({
    buttonClassName: `button button-${variant}`,
    buttonLabel: getPendingActionLabel({ defaultLabel: resolvedLabel, isPending }),
    hiddenFields,
    isDisabled,
    message,
    messageStatus: state.status,
    showMessage,
  })

  return <form action={formAction} className="stage-action-form">{formChildren}</form>
}
