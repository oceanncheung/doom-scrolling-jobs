'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

const RAIL_CLOSE_MS = 320

interface WorkspaceRailShellProps {
  ariaLabel?: string
  children: ReactNode
  className?: string
  collapseAction?: ReactNode
  collapsedLabel?: string
  collapsedPreview?: string | null
  footer?: ReactNode
  scrollClassName?: string
}

export function WorkspaceRailShell({
  ariaLabel,
  children,
  className = 'today-rail',
  collapseAction,
  collapsedLabel,
  collapsedPreview,
  footer,
  scrollClassName = 'today-rail-scroll',
}: WorkspaceRailShellProps) {
  const hasRailCollapse = Boolean(collapsedLabel)
  const [isRailCollapsed, setIsRailCollapsed] = useState(hasRailCollapse)
  const [isRailClosing, setIsRailClosing] = useState(false)
  const railCloseTimerRef = useRef<number | null>(null)

  const clearRailCloseTimer = () => {
    if (railCloseTimerRef.current !== null) {
      window.clearTimeout(railCloseTimerRef.current)
      railCloseTimerRef.current = null
    }
  }

  const toggleRailCollapsed = () => {
    clearRailCloseTimer()

    if (isRailCollapsed) {
      setIsRailClosing(false)
      setIsRailCollapsed(false)
      return
    }

    setIsRailClosing(true)
    railCloseTimerRef.current = window.setTimeout(() => {
      setIsRailCollapsed(true)
      setIsRailClosing(false)
      railCloseTimerRef.current = null
    }, RAIL_CLOSE_MS)
  }

  useEffect(
    () => () => {
      if (railCloseTimerRef.current !== null) {
        window.clearTimeout(railCloseTimerRef.current)
        railCloseTimerRef.current = null
      }
    },
    [],
  )

  useEffect(() => {
    if (!hasRailCollapse || isRailCollapsed || typeof window === 'undefined') {
      return undefined
    }

    const mediaQuery = window.matchMedia('(max-width: 900px)')

    if (!mediaQuery.matches) {
      return undefined
    }

    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [hasRailCollapse, isRailCollapsed])

  return (
    <div className="dashboard-rail-column">
      <div aria-hidden="true" className="dashboard-rail-spacer" />
      <aside
        aria-label={ariaLabel}
        className={[
          className,
          hasRailCollapse ? 'has-rail-collapse' : null,
          hasRailCollapse && isRailCollapsed ? 'is-rail-collapsed' : null,
          hasRailCollapse && isRailClosing ? 'is-rail-closing' : null,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {hasRailCollapse ? (
          <div className={`rail-collapse-handle${collapseAction ? ' has-action' : ''}`}>
            <button
              aria-expanded={!isRailCollapsed}
              className="rail-collapse-toggle"
              onClick={toggleRailCollapsed}
              type="button"
            >
              <span className="rail-collapse-copy">
                <span className="rail-collapse-label">{collapsedLabel}</span>
                {collapsedPreview ? (
                  <span className="rail-collapse-preview">{collapsedPreview}</span>
                ) : null}
              </span>
            </button>
            {collapseAction ? <div className="rail-collapse-action">{collapseAction}</div> : null}
            <button
              aria-expanded={!isRailCollapsed}
              aria-label={`${isRailCollapsed ? 'Expand' : 'Collapse'} ${collapsedLabel}`}
              className={`rail-collapse-icon-toggle${isRailCollapsed ? ' is-collapsed' : ''}`}
              onClick={toggleRailCollapsed}
              type="button"
            >
              <span aria-hidden="true" className="rail-collapse-indicator">
                <span className="rail-collapse-indicator__arm" />
                <span className="rail-collapse-indicator__arm rail-collapse-indicator__arm--v" />
              </span>
            </button>
          </div>
        ) : null}
        <div className={scrollClassName}>{children}</div>
        {footer}
      </aside>
    </div>
  )
}
