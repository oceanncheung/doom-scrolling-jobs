'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { applyToJob } from '@/app/jobs/actions'

interface ApplyJobButtonProps {
  canEdit: boolean
  disabledReason?: string
  href?: string | null
  jobId: string
  label?: string
  pendingLabel?: string
  sourceContext: string
  variant?: 'ghost' | 'primary' | 'secondary'
}

export function ApplyJobButton({
  canEdit,
  disabledReason,
  href,
  jobId,
  label = 'Apply',
  pendingLabel = 'Applying...',
  sourceContext,
  variant = 'primary',
}: ApplyJobButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const resolvedHref = href?.trim() || null
  const resolvedDisabledReason =
    !resolvedHref
      ? 'This job does not have an application link yet.'
      : disabledReason
  const isDisabled = !canEdit || isPending || !resolvedHref

  const handleClick = () => {
    if (isDisabled || !resolvedHref) {
      return
    }

    window.open(resolvedHref, '_blank', 'noopener,noreferrer')

    startTransition(async () => {
      const result = await applyToJob({
        jobId,
        sourceContext,
      })

      if (result.status === 'success') {
        router.refresh()
      }
    })
  }

  return (
    <button
      className={`button button-${variant}`}
      disabled={isDisabled}
      onClick={handleClick}
      title={isDisabled ? resolvedDisabledReason : undefined}
      type="button"
    >
      <span className="button__label">{isPending ? pendingLabel : label}</span>
    </button>
  )
}
