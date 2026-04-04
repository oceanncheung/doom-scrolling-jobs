import type { ReactNode } from 'react'

interface WorkspaceSurfaceProps {
  children: ReactNode
  className?: string
  rail: ReactNode
}

export function WorkspaceSurface({
  children,
  className,
  rail,
}: WorkspaceSurfaceProps) {
  return (
    <section className={['dashboard-workspace', className].filter(Boolean).join(' ')}>
      {rail}
      <div className="queue-column">{children}</div>
    </section>
  )
}
