import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Suspense } from 'react'

import { WorkspaceChrome } from '@/components/navigation/workspace-chrome'
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

// Behave like a native app surface on mobile: disable pinch-to-zoom / double-tap-zoom that
// otherwise rescales the Swiss-grid layout and breaks measured tokens. `maximum-scale: 1`
// is the broadly-honored lever (iOS Safari ignores `user-scalable: no`). Horizontal overflow
// is further guarded at the CSS layer (`html, body { overflow-x: hidden }` at mobile) so a
// single misbehaving input or badge can't drag the whole page sideways.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

function HeaderFallback({ counts }: { counts?: Partial<Record<QueueView, number>> }) {
  return (
    <header className="site-header">
      <div className="site-brand">
        <Link href="/dashboard">
          <strong>Doom Scrolling Jobs</strong>
        </Link>
        <button
          aria-controls="site-mobile-menu-fallback"
          aria-expanded="false"
          aria-label="Open navigation menu"
          className="site-mobile-menu-toggle"
          type="button"
        >
          <span className="site-mobile-menu-toggle-line" />
          <span className="site-mobile-menu-toggle-line" />
          <span className="site-mobile-menu-toggle-line" />
        </button>
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
              <span className="site-workflow-count">{(counts[view] as number) >= 100 ? '99+' : counts[view]}</span>
            ) : null}
          </Link>
        ))}
      </nav>

      <div
        aria-label="Mobile queue views"
        className="site-mobile-menu"
        id="site-mobile-menu-fallback"
      >
        {queueViews.map((view) => (
          <Link className="site-mobile-menu-link" href={getQueueViewHref(view)} key={view}>
            <span>{getQueueViewLabel(view)}</span>
            {typeof counts?.[view] === 'number' ? (
              <span className="site-mobile-menu-item-meta site-workflow-count">{(counts[view] as number) >= 100 ? '99+' : counts[view]}</span>
            ) : null}
          </Link>
        ))}
        <Link className="site-mobile-menu-link site-mobile-menu-link--settings" href="/profile">
          <span>Profile Settings</span>
          <span className="site-mobile-menu-item-meta site-mobile-menu-settings-mark">
            <ProfileSettingsIcon className="site-profile-icon" />
          </span>
        </Link>
      </div>
    </header>
  )
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getOperatorSessionState()
  const showWhenAuthenticated = Boolean(session.activeOperator)
  const counts = showWhenAuthenticated
    ? getDashboardQueues((await getRankedJobs()).jobs).counts
    : undefined

  return (
    <html lang="en">
      <body>
        <WorkspaceChrome
          header={
            <Suspense fallback={<HeaderFallback counts={counts} />}>
              <WorkspaceHeader counts={counts} />
            </Suspense>
          }
          showWhenAuthenticated={showWhenAuthenticated}
        >
          {children}
        </WorkspaceChrome>
      </body>
    </html>
  )
}
