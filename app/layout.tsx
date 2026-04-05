import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Suspense } from 'react'

import { ProfileTestingResetButton } from '@/components/profile/profile-testing-reset-button'
import { ProfileSettingsIcon } from '@/components/navigation/profile-settings-icon'
import { WorkspaceHeader } from '@/components/navigation/workspace-header'
import { site } from '@/lib/config/site'
import { getRankedJobs } from '@/lib/data/jobs'
import { getOperatorSessionState } from '@/lib/data/operators'
import { getDashboardQueues, getQueueViewHref, queueViews, type QueueView } from '@/lib/jobs/dashboard-queue'
import { getQueueViewLabel } from '@/lib/jobs/workflow-state'

import './globals.css'

export const metadata: Metadata = {
  title: {
    default: site.name,
    template: `%s | ${site.name}`,
  },
  description: site.description,
}

function HeaderFallback({ counts }: { counts?: Partial<Record<QueueView, number>> }) {
  return (
    <header className="site-header">
      <div className="site-brand">
        <Link href="/dashboard">
          <strong>Doom Scrolling Jobs</strong>
        </Link>
        <Link aria-label="Profile settings" className="site-profile-avatar-link" href="/profile">
          <span className="site-profile-mark">
            <ProfileSettingsIcon className="site-profile-icon" />
          </span>
        </Link>
      </div>

      <nav className="site-workflow-nav" aria-label="Queue views">
        {queueViews.map((view) => (
          <Link className="site-workflow-link" href={getQueueViewHref(view)} key={view}>
            <span>{getQueueViewLabel(view)}</span>
            {typeof counts?.[view] === 'number' ? (
              <span className="site-workflow-count">{counts[view]}</span>
            ) : null}
          </Link>
        ))}
      </nav>
    </header>
  )
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getOperatorSessionState()
  const counts = session.activeOperator
    ? getDashboardQueues((await getRankedJobs()).jobs).counts
    : undefined

  return (
    <html lang="en">
      <body>
        <div className="workspace-shell">
          <Suspense fallback={<HeaderFallback counts={counts} />}>
            <WorkspaceHeader counts={counts} />
          </Suspense>

          <div className="workspace-main">{children}</div>
          <ProfileTestingResetButton />
        </div>
      </body>
    </html>
  )
}
