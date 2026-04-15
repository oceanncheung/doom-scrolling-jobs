import type { ReactNode } from 'react'

interface LabeledHeadingProps {
  children?: ReactNode
  className?: string
  /** Omitted or empty: no eyebrow line (title only). */
  label?: string
  stackClassName?: string
  title: string
  titleLevel?: 'h1' | 'h2' | 'h3'
}

export function LabeledHeading({
  children,
  className,
  label,
  stackClassName,
  title,
  titleLevel = 'h2',
}: LabeledHeadingProps) {
  const TitleTag = titleLevel

  return (
    <div className={className}>
      <div className={stackClassName}>
        {label ? <p className="panel-label">{label}</p> : null}
        <TitleTag>{title}</TitleTag>
      </div>
      {children}
    </div>
  )
}
