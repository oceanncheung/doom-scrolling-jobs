'use client'

import type { ReactNode } from 'react'

import { PencilIcon } from '@/components/ui/icons/pencil-icon'
import { RefreshCwIcon } from '@/components/ui/icons/refresh-cw-icon'

export type FieldSourceFetchStatus = 'idle' | 'fetching' | 'error' | 'refreshed'

interface FieldSourceActionsProps {
  /** Rendered input/overlay element. Wrapped in a flex row with the refresh/edit buttons. */
  children: ReactNode
  /** True when the current value has been saved and a pull has already run — locks the input
   *  and reveals the refresh + edit controls. When false, the input is editable and the
   *  controls are hidden. */
  locked: boolean
  /** Fetch lifecycle state for the refresh button. */
  status: FieldSourceFetchStatus
  /** Operator-friendly source label, e.g. "portfolio" or "personal website". Used in
   *  aria-labels and tooltips so both buttons are distinguishable when a screen reader
   *  enumerates them. */
  sourceLabel: string
  /** Fires when the user clicks refresh. Parent handles the fetch + status transitions. */
  onRefresh: () => void
  /** Fires when the user clicks edit. Parent is responsible for unlocking the field
   *  (e.g. toggling a `locked` state back to false). */
  onEdit: () => void
  /** Optional error message to surface via the refresh button's title when status=error. */
  errorMessage?: string
}

function refreshTitle(status: FieldSourceFetchStatus, sourceLabel: string, errorMessage?: string) {
  switch (status) {
    case 'fetching':
      return `Refreshing from ${sourceLabel}…`
    case 'refreshed':
      return `Refreshed from ${sourceLabel}`
    case 'error':
      return errorMessage ? `Couldn't reach ${sourceLabel}. ${errorMessage} Try again.` : `Couldn't reach ${sourceLabel}. Try again.`
    case 'idle':
    default:
      return `Refresh from ${sourceLabel}`
  }
}

export function FieldSourceActions({
  children,
  locked,
  status,
  sourceLabel,
  onRefresh,
  onEdit,
  errorMessage,
}: FieldSourceActionsProps) {
  if (!locked) {
    return <>{children}</>
  }

  const refreshLabel = refreshTitle(status, sourceLabel, errorMessage)
  const editLabel = `Change ${sourceLabel} URL`
  const isFetching = status === 'fetching'

  return (
    <span className="field-source-actions-row">
      {children}
      <span className="field-source-actions" aria-live="polite">
        <button
          aria-busy={isFetching}
          aria-label={refreshLabel}
          className={`field-source-action${isFetching ? ' field-source-action--pending' : ''}${
            status === 'error' ? ' field-source-action--error' : ''
          }`}
          disabled={isFetching}
          onClick={onRefresh}
          title={refreshLabel}
          type="button"
        >
          <RefreshCwIcon className="field-source-action__icon" height={14} width={14} />
        </button>
        <button
          aria-label={editLabel}
          className="field-source-action"
          disabled={isFetching}
          onClick={onEdit}
          title="Change URL"
          type="button"
        >
          <PencilIcon className="field-source-action__icon" height={14} width={14} />
        </button>
      </span>
    </span>
  )
}
