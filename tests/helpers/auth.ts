import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export async function waitForUiSettled(page: Page) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(
    () => document.readyState === 'interactive' || document.readyState === 'complete',
    undefined,
    { timeout: 5000 },
  )

  await page.evaluate(async () => {
    if ('fonts' in document) {
      await document.fonts.ready
    }

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve())
      })
    })
  })

  for (const selector of ['[aria-busy="true"]', '.skeleton', '.loading-state', '[data-loading="true"]']) {
    const locator = page.locator(selector).first()
    if (await locator.count()) {
      await locator.waitFor({ state: 'hidden', timeout: 1500 }).catch(() => {})
    }
  }

  await page
    .waitForFunction(
      () => {
        if (typeof document.getAnimations !== 'function') {
          return true
        }

        return document
          .getAnimations()
          .filter((animation) => animation.playState === 'running')
          .length === 0
      },
      undefined,
      { timeout: 1500 },
    )
    .catch(() => {})
}

// Paths the app may land on after a successful operator sign-in. Complete profiles route to
// `/dashboard`; incomplete profiles are routed to `/profile` by the sign-in server action
// (see commit 805d0e5). Either destination means sign-in succeeded — tests then navigate to
// their target route explicitly.
const SIGNED_IN_URL_PATTERN = /\/(dashboard|profile)(?:\?.*)?$/

// The Phase 1 single-user internal tool has at most a handful of operators; tests want the
// one whose canonical profile has been reviewed so the dashboard renders populated state.
// Configurable via env for other environments; defaults to the canonical primary operator.
// See DECISIONS.md ADR-009 — this phase runs with one seeded primary operator.
const TARGET_OPERATOR_NAME = process.env.PLAYWRIGHT_OPERATOR_NAME ?? 'Ocean Cheung'

async function pickOperatorRow(page: Page) {
  // Prefer the row whose visible name matches the target operator. Fall back to first()
  // when nothing matches (e.g. a fresh DB with only one seeded operator of a different
  // name) so the helper still functions on alternative fixtures.
  const preferred = page
    .locator('.operator-row-button')
    .filter({ has: page.locator('strong', { hasText: TARGET_OPERATOR_NAME }) })
    .first()
  if (await preferred.count()) {
    return preferred
  }
  return page.locator('.operator-row-button').first()
}

export async function signInFromEntry(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForUiSettled(page)

  const revealButton = page.locator('.operator-entry-reveal-button')
  if (await revealButton.count()) {
    await expect(revealButton).toBeVisible()
    await revealButton.click()
  }

  const operatorRow = await pickOperatorRow(page)
  if (await operatorRow.count()) {
    await expect(operatorRow).toBeVisible()
    await operatorRow.click()
    await page.waitForURL(SIGNED_IN_URL_PATTERN)
    await waitForUiSettled(page)
  }
}

export async function ensureSignedIn(page: Page) {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await waitForUiSettled(page)
  // If the app kept us anywhere except the operator-entry root, we're already signed in.
  // This also covers the "incomplete profile → /profile" redirect without special-casing.
  const pathname = new URL(page.url()).pathname
  if (pathname !== '/') {
    return
  }

  await signInFromEntry(page)
}
