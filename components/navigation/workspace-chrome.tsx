'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

interface WorkspaceChromeProps {
  children: ReactNode
  header: ReactNode
  showWhenAuthenticated: boolean
}

const publicPaths = new Set(['/', '/operators'])

export function WorkspaceChrome({
  children,
  header,
  showWhenAuthenticated,
}: WorkspaceChromeProps) {
  const pathname = usePathname()
  const showWorkspaceChrome = showWhenAuthenticated && !publicPaths.has(pathname)

  if (!showWorkspaceChrome) {
    return <>{children}</>
  }

  return (
    <div className="workspace-shell">
      {header}
      <div className="workspace-main">{children}</div>
    </div>
  )
}
