'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { WorkspaceRailShell } from '@/components/navigation/workspace-rail-shell'
import { WorkspaceSurface } from '@/components/navigation/workspace-surface'
import { OperatorAccessForm } from '@/components/operators/operator-access-form'
import { OperatorCreateForm } from '@/components/operators/operator-create-form'
import { site } from '@/lib/config/site'
import type { OperatorRecord } from '@/lib/domain/types'

const SIGNIN_CLOSE_MS = 320

interface OperatorEntryClientProps {
  activeOperatorId?: string
  issue?: string
  operators: OperatorRecord[]
}

export function OperatorEntryClient({
  activeOperatorId,
  issue,
  operators,
}: OperatorEntryClientProps) {
  const hasOperators = operators.length > 0
  const [showSignIn, setShowSignIn] = useState(false)
  const [isSigninClosing, setIsSigninClosing] = useState(false)
  const closeTimerRef = useRef<number | null>(null)

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const openSignIn = () => {
    clearCloseTimer()
    setIsSigninClosing(false)
    setShowSignIn(true)
  }

  const beginCloseSignIn = () => {
    if (!showSignIn || isSigninClosing) {
      return
    }
    clearCloseTimer()
    setIsSigninClosing(true)
    closeTimerRef.current = window.setTimeout(() => {
      setShowSignIn(false)
      setIsSigninClosing(false)
      closeTimerRef.current = null
    }, SIGNIN_CLOSE_MS)
  }

  useEffect(() => clearCloseTimer, [])

  // Lock body scroll while the panel overlays the viewport (mobile/tablet). Mirrors the
  // today-rail collapse pattern so the sub-page feels like a modal sheet, not a scrolled region.
  useEffect(() => {
    if ((!showSignIn && !isSigninClosing) || typeof window === 'undefined') {
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
  }, [showSignIn, isSigninClosing])

  const panelMounted = showSignIn || isSigninClosing

  return (
    <main className="page-stack workspace-surface">
      <WorkspaceSurface
        className={`operator-entry-workspace${panelMounted ? ' operator-entry-workspace--signin' : ''}`}
        rail={
          <WorkspaceRailShell
            beforeScroll={
              <section className="today-rail-site-header site-brand site-brand--rail">
                <Link href="/">
                  <strong>{site.name}</strong>
                </Link>
              </section>
            }
            className="today-rail today-rail--split-scroll"
          >
            <OperatorCreateForm
              hasOperators={hasOperators}
              secondaryAction={
                hasOperators ? (
                  <button
                    aria-controls="operator-account-list"
                    aria-expanded={showSignIn && !isSigninClosing}
                    className="button button-secondary operator-entry-reveal-button"
                    onClick={openSignIn}
                    type="button"
                  >
                    <span className="button__label">Sign In</span>
                  </button>
                ) : null
              }
            />
          </WorkspaceRailShell>
        }
      >
        {issue ? (
          <section className="panel">
            <p className="panel-label">Setup required</p>
            <p>
              {issue} Run `supabase/migrations/0005_lightweight_operators.sql` in Supabase SQL
              Editor, then reload this page.
            </p>
          </section>
        ) : null}

        {panelMounted ? (
          <section
            className={`operator-signin-panel${isSigninClosing ? ' is-signin-closing' : ''}`}
            aria-labelledby="operator-signin-heading"
          >
            <header className="operator-signin-heading">
              <button
                aria-label="Back to create account"
                className="operator-signin-close"
                onClick={beginCloseSignIn}
                type="button"
              >
                <span aria-hidden="true">×</span>
              </button>
              <p className="panel-label">Sign in</p>
              <h1 id="operator-signin-heading">Choose an account</h1>
            </header>
            <p className="operator-signin-lead">
              Pick the profile you&rsquo;d like to continue with.
            </p>
            <OperatorAccessForm
              activeOperatorId={activeOperatorId}
              operators={operators}
              sectionId="operator-account-list"
            />
          </section>
        ) : null}
      </WorkspaceSurface>
    </main>
  )
}
