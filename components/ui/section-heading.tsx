import type { ReactNode } from 'react'

interface SectionHeadingProps {
  children?: ReactNode
  className?: string
  label: string
  note?: ReactNode
  title: string
  titleLevel?: 'h1' | 'h2' | 'h3'
}

/**
 * Eyebrow, title, and optional note live in one `.settings-section-title-stack` so vertical gaps match
 * (same flex `gap` as other panel-label stacks). Avoids grid-between-rows spacing that looked uneven vs label→title.
 */
export function SectionHeading({
  children,
  className,
  label,
  note,
  title,
  titleLevel = 'h2',
}: SectionHeadingProps) {
  const TitleTag = titleLevel

  return (
    <div className={['settings-section-header', className].filter(Boolean).join(' ')}>
      <div className="settings-section-title-stack">
        <p className="panel-label">{label}</p>
        <TitleTag>{title}</TitleTag>
        {note ? <p className="settings-section-note">{note}</p> : null}
      </div>
      {children}
    </div>
  )
}
