'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

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
  const searchParams = useSearchParams()
  const formRef = useRef<HTMLFormElement>(null)
  const autoFiredRef = useRef(false)

  /*
   * Auto-trigger when the user landed here from Apply Next's "Generate Materials" /
   * "Continue generation" button — the href carries `?generate=1` (set by getApplyNextAction
   * in lib/jobs/review-navigation.ts) so they don't have to click again. Only fires for the
   * first-generation labels, never for "Regenerate", and only once per mount.
   */
  const isAutoTriggerVariant = defaultLabel === 'Generate Materials' || defaultLabel === 'Continue generation'

  useEffect(() => {
    if (autoFiredRef.current) return
    if (searchParams?.get('generate') !== '1') return
    if (!isAutoTriggerVariant) return
    if (!canEdit || isPending) return
    autoFiredRef.current = true
    formRef.current?.requestSubmit()
  }, [searchParams, canEdit, isPending, isAutoTriggerVariant])

  return (
    <form action={formAction} className="stage-action-form" ref={formRef}>
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
