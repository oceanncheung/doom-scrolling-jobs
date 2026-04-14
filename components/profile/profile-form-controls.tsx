'use client'

import type { ReactNode } from 'react'

import { ReviewStateIndicator } from '@/components/profile/review-state-indicator'
import { ChevronDownIcon } from '@/components/ui/icons/chevron-down-icon'
import { LabeledHeading } from '@/components/ui/labeled-heading'
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
        <ChevronDownIcon />
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
      <LabeledHeading className="disclosure-summary" label={label} title={title} />
      {unwrapBody ? children : <div className="disclosure-body">{children}</div>}
    </section>
  )
}

export function SettingsTabShell({
  ariaLabel,
  children,
  hasSelection,
  toolbar,
}: {
  ariaLabel: string
  children?: ReactNode
  hasSelection: boolean
  toolbar: ReactNode
}) {
  return (
    <div className={`settings-tab-shell${hasSelection ? ' has-selection' : ''}`}>
      <div className="settings-tab-toolbar-shell">
        <div className="settings-tab-toolbar-track">
          <div aria-label={ariaLabel} className="settings-tab-toolbar" role="tablist">
            {toolbar}
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}

export function SettingsTabPanel({
  children,
  label,
  title,
}: {
  children?: ReactNode
  label: string
  title: string
}) {
  return (
    <section className="settings-tab-panel">
      <LabeledHeading
        className="settings-tab-panel-header"
        label={label}
        title={title}
        titleLevel="h3"
      />
      {children}
    </section>
  )
}
