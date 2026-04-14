'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import { ProfileSettingsIcon } from '@/components/navigation/profile-settings-icon'
import {
  getQueueView,
  getQueueViewHref,
  queueViews,
  type QueueView,
} from '@/lib/jobs/dashboard-queue'
import { getQueueViewLabel } from '@/lib/jobs/workflow-state'

const MENU_CLOSE_MS = 280
export function WorkspaceHeader({ counts }: { counts?: Partial<Record<QueueView, number>> }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentRouteKey = `${pathname}?${searchParams.toString()}`
  const [mobileMenuState, setMobileMenuState] = useState({
    open: false,
    routeKey: currentRouteKey,
  })
  const [isMenuClosing, setIsMenuClosing] = useState(false)
  const menuCloseTimerRef = useRef<number | null>(null)

  const activeView =
    pathname === '/dashboard' ? getQueueView(searchParams.get('view') ?? undefined) : null
  const profileActive = pathname === '/profile'

  const routeMatches = mobileMenuState.routeKey === currentRouteKey
  const menuExpanded = (mobileMenuState.open && routeMatches) || isMenuClosing
  const mobileMenuOpen = mobileMenuState.open && routeMatches && !isMenuClosing
  const menuToggleShowsCross =
    Boolean(mobileMenuState.open && routeMatches) && !isMenuClosing

  const clearMenuCloseTimer = () => {
    if (menuCloseTimerRef.current !== null) {
      window.clearTimeout(menuCloseTimerRef.current)
      menuCloseTimerRef.current = null
    }
  }

  const beginCloseMenu = () => {
    if (!mobileMenuState.open || !routeMatches || isMenuClosing) {
      return
    }

    clearMenuCloseTimer()
    setIsMenuClosing(true)
    menuCloseTimerRef.current = window.setTimeout(() => {
      setMobileMenuState({ open: false, routeKey: currentRouteKey })
      setIsMenuClosing(false)
      menuCloseTimerRef.current = null
    }, MENU_CLOSE_MS)
  }

  const toggleMobileMenu = () => {
    clearMenuCloseTimer()

    if (mobileMenuState.open && routeMatches && !isMenuClosing) {
      beginCloseMenu()
      return
    }

    setIsMenuClosing(false)
    setMobileMenuState({ open: true, routeKey: currentRouteKey })
  }

  useEffect(
    () => () => {
      if (menuCloseTimerRef.current !== null) {
        window.clearTimeout(menuCloseTimerRef.current)
        menuCloseTimerRef.current = null
      }
    },
    [],
  )

  useEffect(() => {
    if (!mobileMenuOpen) {
      return undefined
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      if (menuCloseTimerRef.current !== null) {
        return
      }

      setIsMenuClosing(true)
      menuCloseTimerRef.current = window.setTimeout(() => {
        setMobileMenuState({ open: false, routeKey: currentRouteKey })
        setIsMenuClosing(false)
        menuCloseTimerRef.current = null
      }, MENU_CLOSE_MS)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileMenuOpen, currentRouteKey])

  const navigateMobileMenu = (href: string) => () => {
    clearMenuCloseTimer()
    setIsMenuClosing(false)
    setMobileMenuState({ open: false, routeKey: currentRouteKey })
    window.location.assign(href)
  }

  return (
    <>
    <header className="site-header">
      <div className="site-brand">
        <Link href="/dashboard">
          <strong>Doom Scrolling Jobs</strong>
        </Link>
        <button
          aria-controls="site-mobile-menu"
          aria-expanded={menuToggleShowsCross}
          aria-label={menuToggleShowsCross ? 'Close navigation menu' : 'Open navigation menu'}
          className="site-mobile-menu-toggle"
          data-menu-toggle={menuToggleShowsCross ? 'cross' : 'hamburger'}
          onClick={toggleMobileMenu}
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
        className={`site-mobile-menu${menuExpanded ? ' is-open' : ''}${isMenuClosing ? ' is-closing' : ''}`}
        id="site-mobile-menu"
      >
        {queueViews.map((view) => (
          <button
            aria-current={activeView === view ? 'page' : undefined}
            className="site-mobile-menu-link"
            key={view}
            onClick={navigateMobileMenu(getQueueViewHref(view))}
            type="button"
          >
            <span>{getQueueViewLabel(view)}</span>
            {typeof counts?.[view] === 'number' ? (
              <span className="site-mobile-menu-item-meta site-workflow-count">{counts[view]}</span>
            ) : null}
          </button>
        ))}
        <button
          aria-current={profileActive ? 'page' : undefined}
          className="site-mobile-menu-link site-mobile-menu-link--settings"
          onClick={navigateMobileMenu('/profile')}
          type="button"
        >
          <span>Profile Settings</span>
          <span className="site-mobile-menu-item-meta site-mobile-menu-settings-mark">
            <ProfileSettingsIcon className="site-profile-icon" />
          </span>
        </button>
      </div>
    </header>
    <div
      aria-hidden
      className={`site-mobile-menu-backdrop${menuExpanded ? ' is-lit' : ''}`}
    />
    </>
  )
}
