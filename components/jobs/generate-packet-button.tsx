'use client'

import { useActionState } from 'react'

import { generateApplicationPacket, type PacketGenerationActionState } from '@/app/jobs/actions'
import {
  ActionFormMessage,
  getPendingActionLabel,
  initialActionFormState,
} from '@/components/jobs/action-form-primitives'

const initialState: PacketGenerationActionState = initialActionFormState

interface GeneratePacketButtonProps {
  canEdit: boolean
  defaultLabel?: string
  disabledReason?: string
  jobId: string
  pendingLabel?: string
  showMessage?: boolean
  variant?: 'primary' | 'secondary'
}

export function GeneratePacketButton({
  canEdit,
  defaultLabel = 'Generate Materials',
  disabledReason,
  jobId,
  pendingLabel = 'Generating...',
  showMessage = false,
  variant = 'primary',
}: GeneratePacketButtonProps) {
  const [state, formAction, isPending] = useActionState(generateApplicationPacket, initialState)

  return (
    <form action={formAction} className="stage-action-form">
      <input name="jobId" type="hidden" value={jobId} />
      <button
        className={`button button-${variant} button-small`}
        disabled={!canEdit || isPending}
        title={!canEdit ? disabledReason : undefined}
        type="submit"
      >
        {getPendingActionLabel({
          defaultLabel,
          isPending,
          pendingLabel,
        })}
      </button>
      {showMessage ? (
        <ActionFormMessage message={state.message} status={state.status} tone="action-note" />
      ) : null}
    </form>
  )
}
