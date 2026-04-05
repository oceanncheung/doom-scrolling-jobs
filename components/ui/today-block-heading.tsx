interface TodayBlockHeadingProps {
  className?: string
  label?: string
  title?: string
}

export function TodayBlockHeading({ className, label, title }: TodayBlockHeadingProps) {
  return (
    <div className={['today-block-heading', className].filter(Boolean).join(' ')}>
      {label ? <p className="panel-label">{label}</p> : null}
      {title ? <h2>{title}</h2> : null}
    </div>
  )
}
