'use client'

import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useLayoutEffect, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'doom-jobs-marquee-dismissed'
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

function notifyDismissedChange() {
  for (const listener of listeners) {
    listener()
  }
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function setMarqueeOpen(open: boolean) {
  document.documentElement.classList.toggle('jobs-marquee-open', open)
}

/** Inline so no stylesheet or ancestor can shrink the fixed layer to a column width. */
const TICKER_ROOT_STYLE: CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  top: 'auto',
  /* Omit width: let left+right define span (avoids %/vw quirks vs narrow containing blocks). */
  zIndex: 2147483647,
  margin: 0,
  padding: 0,
  boxSizing: 'border-box',
  pointerEvents: 'none',
}

function subscribeMounted() {
  return () => {}
}

export function JobsMarqueeBanner() {
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => false)
  const mounted = useSyncExternalStore(subscribeMounted, () => true, () => false)

  useLayoutEffect(() => {
    return () => {
      setMarqueeOpen(false)
    }
  }, [])

  useLayoutEffect(() => {
    setMarqueeOpen(!dismissed && mounted)
  }, [dismissed, mounted])

  const close = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    notifyDismissedChange()
  }

  if (dismissed || !mounted) {
    return null
  }

  return createPortal(
    <div aria-live="polite" className="ticker-stripe-root" style={TICKER_ROOT_STYLE}>
      <div className="ticker-stripe">
        <div className="ticker-rail">
          <div className="ticker-content-infinite">
            <span>{`${'scfgc gayau! :3   ·   '.repeat(16)}`}</span>
            <span aria-hidden>{`${'scfgc gayau! :3   ·   '.repeat(16)}`}</span>
          </div>
        </div>
        <button aria-label="Dismiss ticker" className="ticker-close" onClick={close} type="button">
          ×
        </button>
      </div>
    </div>,
    document.body,
  )
}
