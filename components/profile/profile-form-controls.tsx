'use client'

import type { ReactNode } from 'react'

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
  count,
  label,
  onClick,
}: {
  active: boolean
  count: number
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-pressed={active}
      className={`settings-tab-button${active ? ' is-active' : ''}`}
      onClick={onClick}
      type="button"
    >
      <span className="settings-tab-button-label">{label}</span>
      <span className="settings-tab-button-count">{count}</span>
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
