import type { ReactNode } from 'react'

interface WorkspaceRailShellProps {
  ariaLabel?: string
  children: ReactNode
  className?: string
  footer?: ReactNode
  scrollClassName?: string
}

export function WorkspaceRailShell({
  ariaLabel,
  children,
  className = 'today-rail',
  footer,
  scrollClassName = 'today-rail-scroll',
}: WorkspaceRailShellProps) {
  return (
    <div className="dashboard-rail-column">
      <div aria-hidden="true" className="dashboard-rail-spacer" />
      <aside aria-label={ariaLabel} className={className}>
        <div className={scrollClassName}>{children}</div>
        {footer}
      </aside>
    </div>
  )
}
