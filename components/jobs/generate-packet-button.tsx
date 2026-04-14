'use client'

import { useActionState } from 'react'

import { generateApplicationPacket, type PacketGenerationActionState } from '@/app/jobs/actions'

const initialState: PacketGenerationActionState = {
  message: '',
  status: 'idle',
}

interface GeneratePacketButtonProps {
  canEdit: boolean
  disabledReason?: string
  jobId: string
}

export function GeneratePacketButton({
  canEdit,
  disabledReason,
  jobId,
}: GeneratePacketButtonProps) {
  const [state, formAction, isPending] = useActionState(generateApplicationPacket, initialState)

  return (
    <form action={formAction} className="stage-action-form">
      <input name="jobId" type="hidden" value={jobId} />
      <button
        className="button button-primary button-small"
        disabled={!canEdit || isPending}
        title={!canEdit ? disabledReason : undefined}
        type="submit"
      >
        {isPending ? 'Generating...' : 'Generate Content'}
      </button>
      {state.message ? (
        <p
          className={`action-note ${
            state.status === 'error' ? 'action-note-error' : 'action-note-success'
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
