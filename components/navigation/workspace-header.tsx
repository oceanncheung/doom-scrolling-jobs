'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

import { ProfileSettingsIcon } from '@/components/navigation/profile-settings-icon'
import {
  getQueueView,
  getQueueViewHref,
  queueViews,
  type QueueView,
} from '@/lib/jobs/dashboard-queue'

const labels: Record<QueueView, string> = {
  applied: 'Applied',
  archive: 'Archived',
  potential: 'Potential',
  prepared: 'Ready',
  saved: 'Saved',
}

export function WorkspaceHeader({ counts }: { counts?: Partial<Record<QueueView, number>> }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeView =
    pathname === '/dashboard' ? getQueueView(searchParams.get('view') ?? undefined) : null
  const profileActive = pathname === '/profile'

  return (
    <header className="site-header">
      <div className="site-brand">
        <Link href="/dashboard">
          <strong>Doom Scrolling Jobs</strong>
        </Link>
        <Link
          aria-current={profileActive ? 'page' : undefined}
          aria-label="Profile settings"
          className="site-profile-avatar-link"
          href="/profile"
        >
          <span className="site-profile-mark">
            <ProfileSettingsIcon className="site-profile-icon" />
          </span>
        </Link>
      </div>

      <nav className="site-workflow-nav" aria-label="Queue views">
        {queueViews.map((view) => (
          <Link
            aria-current={activeView === view ? 'page' : undefined}
            className="site-workflow-link"
            href={getQueueViewHref(view)}
            key={view}
          >
            <span>{labels[view]}</span>
            {typeof counts?.[view] === 'number' ? (
              <span className="site-workflow-count">{counts[view]}</span>
            ) : null}
          </Link>
        ))}
      </nav>
    </header>
  )
}
