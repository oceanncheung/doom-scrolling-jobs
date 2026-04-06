'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { ProfileSettingsIcon } from '@/components/navigation/profile-settings-icon'
import {
  getQueueView,
  getQueueViewHref,
  queueViews,
  type QueueView,
} from '@/lib/jobs/dashboard-queue'
import { getQueueViewLabel } from '@/lib/jobs/workflow-state'

export function WorkspaceHeader({ counts }: { counts?: Partial<Record<QueueView, number>> }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentRouteKey = `${pathname}?${searchParams.toString()}`
  const [mobileMenuState, setMobileMenuState] = useState({
    open: false,
    routeKey: currentRouteKey,
  })
  const activeView =
    pathname === '/dashboard' ? getQueueView(searchParams.get('view') ?? undefined) : null
  const profileActive = pathname === '/profile'
  const mobileMenuOpen =
    mobileMenuState.open && mobileMenuState.routeKey === currentRouteKey

  useEffect(() => {
    if (!mobileMenuOpen) {
      return undefined
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuState({
          open: false,
          routeKey: currentRouteKey,
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentRouteKey, mobileMenuOpen])

  const closeMobileMenu = () =>
    setMobileMenuState({
      open: false,
      routeKey: currentRouteKey,
    })

  return (
    <header className="site-header">
      <div className="site-brand">
        <Link href="/dashboard">
          <strong>Doom Scrolling Jobs</strong>
        </Link>
        <button
          aria-controls="site-mobile-menu"
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="site-mobile-menu-toggle"
          onClick={() =>
            setMobileMenuState((state) => ({
              open: !(state.open && state.routeKey === currentRouteKey),
              routeKey: currentRouteKey,
            }))
          }
          type="button"
        >
          <span className="site-mobile-menu-toggle-line" />
          <span className="site-mobile-menu-toggle-line" />
          <span className="site-mobile-menu-toggle-line" />
        </button>
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
            <span>{getQueueViewLabel(view)}</span>
            {typeof counts?.[view] === 'number' ? (
              <span className="site-workflow-count">{counts[view]}</span>
            ) : null}
          </Link>
        ))}
      </nav>

      <div
        aria-label="Mobile queue views"
        className={`site-mobile-menu${mobileMenuOpen ? ' is-open' : ''}`}
        id="site-mobile-menu"
      >
        {queueViews.map((view) => (
          <Link
            aria-current={activeView === view ? 'page' : undefined}
            className="site-mobile-menu-link"
            href={getQueueViewHref(view)}
            key={view}
            onClick={closeMobileMenu}
          >
            <span>{getQueueViewLabel(view)}</span>
            {typeof counts?.[view] === 'number' ? (
              <span className="site-workflow-count">{counts[view]}</span>
            ) : null}
          </Link>
        ))}
        <Link
          aria-current={profileActive ? 'page' : undefined}
          className="site-mobile-menu-link"
          href="/profile"
          onClick={closeMobileMenu}
        >
          <span>Profile Settings</span>
        </Link>
      </div>
    </header>
  )
}
