'use client'

import type { ReactNode } from 'react'

import { ReviewStateIndicator } from '@/components/profile/review-state-indicator'
import type { ReviewState } from '@/lib/profile/master-assets'

export function AddRowButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button className="button button-secondary button-small" onClick={onClick} type="button">
      {label}
    </button>
  )
}

export function SettingsTabButton({
  active,
  label,
  onClick,
  reviewState,
}: {
  active: boolean
  label: string
  onClick: () => void
  reviewState?: ReviewState
}) {
  return (
    <button
      aria-pressed={active}
      className={`settings-tab-button${active ? ' is-active' : ''}`}
      onClick={onClick}
      type="button"
    >
      <span className="settings-tab-button-label">{label}</span>
      {reviewState ? (
        <ReviewStateIndicator className="settings-tab-button-state" state={reviewState} />
      ) : null}
      <span aria-hidden="true" className="settings-tab-button-icon">
        <svg fill="none" height="12" viewBox="0 0 12 12" width="12">
          <path
            d="M3.25 4.5 6 7.25 8.75 4.5"
            stroke="currentColor"
            strokeLinecap="square"
            strokeWidth="1.2"
          />
        </svg>
      </span>
    </button>
  )
}

export function SectionLockFrame({
  children,
  lockedMessage,
}: {
  children: ReactNode
  lockedMessage?: string | null
}) {
  const isLocked = Boolean(lockedMessage)

  return (
    <div
      aria-disabled={isLocked}
      className={`settings-section-state-shell${isLocked ? ' is-locked' : ''}`}
    >
      {lockedMessage ? <p className="settings-section-lock-note">{lockedMessage}</p> : null}
      <div className="settings-section-state-content">{children}</div>
    </div>
  )
}

export function DisclosureSection({
  children,
  className,
  label,
  title,
  unwrapBody,
}: {
  children: ReactNode
  className?: string
  label: string
  title: string
  unwrapBody?: boolean
}) {
  return (
    <section className={['panel', 'disclosure', className].filter(Boolean).join(' ')}>
      <div className="disclosure-summary">
        <div>
          <p className="panel-label">{label}</p>
          <h2>{title}</h2>
        </div>
      </div>
      {unwrapBody ? children : <div className="disclosure-body">{children}</div>}
    </section>
  )
}
