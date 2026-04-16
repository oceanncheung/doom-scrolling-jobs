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

export async function signInFromEntry(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForUiSettled(page)

  const revealButton = page.locator('.operator-entry-reveal-button')
  if (await revealButton.count()) {
    await expect(revealButton).toBeVisible()
    await revealButton.click()
  }

  const operatorRow = page.locator('.operator-row-button').first()
  if (await operatorRow.count()) {
    await expect(operatorRow).toBeVisible()
    await operatorRow.click()
    await page.waitForURL(/\/dashboard(?:\?.*)?$/)
    await waitForUiSettled(page)
  }
}

export async function ensureSignedIn(page: Page) {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await waitForUiSettled(page)
  if (page.url().includes('/dashboard')) {
    return
  }

  await signInFromEntry(page)
}
