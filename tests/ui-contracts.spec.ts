import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { ensureSignedIn, waitForUiSettled } from '@/tests/helpers/auth'

function round(value: number | null | undefined) {
  return value == null ? null : Math.round(value)
}

async function expectHorizontalHairlineFlush(locator: Locator, pseudo: '::before' | '::after') {
  const metrics = await locator.evaluate(
    (node, pseudoSelector) => {
      const queueColumn = node.closest<HTMLElement>('.queue-column')
      const targetRect = node.getBoundingClientRect()
      const containerRect = queueColumn?.getBoundingClientRect()
      const styles = getComputedStyle(node, pseudoSelector)
      const left = Number.parseFloat(styles.left || '0')
      const queuePad = Number.parseFloat(
        getComputedStyle(queueColumn ?? document.documentElement).getPropertyValue('--queue-column-pad') || '0',
      )
      let width = Number.parseFloat(styles.width || '0')

      if (Number.isNaN(width) && styles.width.includes('calc(')) {
        const multiplier = styles.width.includes('2 *') ? 2 : 1
        width = targetRect.width + (queuePad * multiplier)
      }

      const start = targetRect.left + left
      const end = start + width

      return {
        containerEnd: Math.round(containerRect?.right ?? 0),
        containerStart: Math.round(containerRect?.left ?? 0),
        end: Math.round(end),
        start: Math.round(start),
      }
    },
    pseudo,
  )

  expect(metrics.start).toBe(metrics.containerStart)
  expect(Math.abs(metrics.end - metrics.containerEnd)).toBeLessThanOrEqual(1)
}

async function waitForScrollPosition(page: Page, target: 'top' | 'bottom') {
  if (target === 'top') {
    await page.waitForFunction(() => Math.abs(window.scrollY) <= 1, undefined, { timeout: 1500 })
    return
  }

  await page.waitForFunction(
    () => {
      const scrollingElement = document.scrollingElement ?? document.documentElement
      const maxScrollY = Math.max(0, scrollingElement.scrollHeight - window.innerHeight)
      return Math.abs(window.scrollY - maxScrollY) <= 2
    },
    undefined,
    { timeout: 1500 },
  )
}

test.describe('UI contracts', () => {
  test('operator list stays hidden until sign in is requested', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })

    const revealButton = page.locator('.operator-entry-reveal-button')
    await expect(revealButton).toBeVisible()
    await expect(page.locator('.operator-row-button')).toHaveCount(0)

    await revealButton.click()

    await expect(page.locator('.operator-row-button').first()).toBeVisible()
  })

  test('site header stays fixed across scroll extremes', async ({ page }) => {
    await ensureSignedIn(page)

    for (const route of ['/profile', '/dashboard']) {
      await page.goto(route, { waitUntil: 'networkidle' })

      const header = page.locator('.site-header')
      await expect(header).toBeVisible()

      const position = await header.evaluate((node) => getComputedStyle(node).position)
      expect(position).toBe('fixed')

      const topPositions: number[] = []

      topPositions.push(
        await header.evaluate((node) => Math.round(node.getBoundingClientRect().top)),
      )

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await waitForScrollPosition(page, 'bottom')
      topPositions.push(
        await header.evaluate((node) => Math.round(node.getBoundingClientRect().top)),
      )

      await page.evaluate(() => window.scrollTo(0, 0))
      await waitForScrollPosition(page, 'top')
      topPositions.push(
        await header.evaluate((node) => Math.round(node.getBoundingClientRect().top)),
      )

      expect(new Set(topPositions).size).toBe(1)
      expect(topPositions[0]).toBe(0)
    }
  })

  test('profile source upload row keeps the frozen seam and edge contract', async ({ page }) => {
    await ensureSignedIn(page)
    await page.goto('/profile', { waitUntil: 'networkidle' })

    const row = page.locator('.settings-source-uploads-row--materials')
    await expect(row).toBeVisible()

    const boxes = await Promise.all(
      [0, 1, 2].map(async (index) => {
        const box = await row.locator(':scope > *').nth(index).boundingBox()
        expect(box).not.toBeNull()
        return box!
      }),
    )

    const rowBox = await row.boundingBox()
    expect(rowBox).not.toBeNull()

    const widths = boxes.map((box) => round(box.width) ?? 0)
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1)

    const seamOneDelta = (round(boxes[1].x) ?? 0) - (round(boxes[0].x + boxes[0].width) ?? 0)
    const seamTwoDelta = (round(boxes[2].x) ?? 0) - (round(boxes[1].x + boxes[1].width) ?? 0)
    expect(seamOneDelta).toBeGreaterThanOrEqual(-1)
    expect(seamOneDelta).toBeLessThanOrEqual(0)
    expect(seamTwoDelta).toBeGreaterThanOrEqual(-1)
    expect(seamTwoDelta).toBeLessThanOrEqual(0)

    const rowRightDelta = (round(rowBox!.x + rowBox!.width) ?? 0) - (round(boxes[2].x + boxes[2].width) ?? 0)
    expect(rowRightDelta).toBeGreaterThanOrEqual(0)
    expect(rowRightDelta).toBeLessThanOrEqual(1)
  })

  test('additional filters chip keeps a stable label position on open', async ({ page }) => {
    await ensureSignedIn(page)
    await page.goto('/profile', { waitUntil: 'networkidle' })

    const summary = page.locator('.settings-action-disclosure summary').first()
    await expect(summary).toBeVisible()

    const toggle = summary.locator('.settings-action-toggle')
    const label = toggle.locator('span').first()

    const before = await summary.evaluate((node) => {
      const toggleNode = node.querySelector<HTMLElement>('.settings-action-toggle')
      const labelNode = toggleNode?.querySelector<HTMLElement>('span')
      if (!toggleNode || !labelNode) return null

      const toggleRect = toggleNode.getBoundingClientRect()
      const labelRect = labelNode.getBoundingClientRect()

      return {
        labelOffsetTop: Math.round(labelRect.top - toggleRect.top),
        labelOffsetBottom: Math.round(toggleRect.bottom - labelRect.bottom),
        labelHeight: Math.round(labelRect.height),
      }
    })
    expect(before).not.toBeNull()

    await summary.click()
    await expect(page.locator('.settings-action-disclosure').first()).toHaveAttribute('open', '')
    await waitForUiSettled(page)

    const after = await summary.evaluate((node) => {
      const toggleNode = node.querySelector<HTMLElement>('.settings-action-toggle')
      const labelNode = toggleNode?.querySelector<HTMLElement>('span')
      if (!toggleNode || !labelNode) return null

      const toggleRect = toggleNode.getBoundingClientRect()
      const labelRect = labelNode.getBoundingClientRect()

      return {
        labelOffsetTop: Math.round(labelRect.top - toggleRect.top),
        labelOffsetBottom: Math.round(toggleRect.bottom - labelRect.bottom),
        labelHeight: Math.round(labelRect.height),
      }
    })
    expect(after).not.toBeNull()

    expect(Math.abs(after!.labelOffsetTop - before!.labelOffsetTop)).toBeLessThanOrEqual(1)
    expect(Math.abs(after!.labelOffsetBottom - before!.labelOffsetBottom)).toBeLessThanOrEqual(1)
    expect(Math.abs(after!.labelHeight - before!.labelHeight)).toBeLessThanOrEqual(1)

    const transitionProperty = await toggle.evaluate((node) => getComputedStyle(node).transitionProperty)
    expect(transitionProperty).not.toContain('background-color')

    await expect(label).toBeVisible()
  })

  test('experience tabs keep a single closed seam and mask the open seam under the active tab', async ({
    page,
  }) => {
    await ensureSignedIn(page)
    await page.goto('/profile', { waitUntil: 'networkidle' })

    const shell = page.locator('.disclosure-experience .settings-tab-shell').first()
    const toolbarShell = shell.locator('.settings-tab-toolbar-shell').first()
    const toolbar = shell.locator('.settings-tab-toolbar').first()
    await expect(toolbar).toBeVisible()
    const closedButtonBox = await shell.locator('.settings-tab-button').first().boundingBox()
    expect(closedButtonBox).not.toBeNull()

    const closedAfter = await toolbarShell.evaluate((node) => ({
      background: getComputedStyle(node, '::after').backgroundColor,
      content: getComputedStyle(node, '::after').content,
      display: getComputedStyle(node, '::after').display,
    }))
    expect(closedAfter.content).toBe('""')
    expect(closedAfter.display).toBe('block')
    expect(closedAfter.background).toBe('rgb(0, 0, 0)')

    const nextDisclosureLine = await page
      .locator('.disclosure-experience + .disclosure-cover-letter')
      .evaluate((node) => getComputedStyle(node, '::before').display)
    expect(nextDisclosureLine).toBe('none')

    const firstTabButton = shell.locator('.settings-tab-button').first()
    await firstTabButton.click()
    await expect(firstTabButton).toHaveClass(/is-active/)
    await expect(shell).toHaveClass(/has-selection/)
    await waitForUiSettled(page)

    const openAfter = await toolbarShell.evaluate((node) => ({
      background: getComputedStyle(node, '::after').backgroundColor,
      content: getComputedStyle(node, '::after').content,
      display: getComputedStyle(node, '::after').display,
    }))
    expect(openAfter.content).toBe('""')
    expect(openAfter.display).toBe('block')
    expect(openAfter.background).toBe('rgb(0, 0, 0)')

    const shellBox = await shell.boundingBox()
    const toolbarShellBox = await shell.locator('.settings-tab-toolbar-shell').boundingBox()
    const activeBox = await shell.locator('.settings-tab-button.is-active').boundingBox()

    expect(shellBox).not.toBeNull()
    expect(toolbarShellBox).not.toBeNull()
    expect(activeBox).not.toBeNull()
    expect(Math.abs(activeBox!.height - closedButtonBox!.height)).toBeLessThanOrEqual(1)

    const seamY = Math.round(toolbarShellBox!.y + toolbarShellBox!.height - shellBox!.y - 1)
    const activeX = Math.round(activeBox!.x + (activeBox!.width / 2) - shellBox!.x)

    const screenshot = await shell.screenshot()
    const sharp = (await import('sharp')).default
    const { data, info } = await sharp(screenshot).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

    function readPixel(x: number, y: number) {
      const index = ((y * info.width) + x) * info.channels
      return [data[index], data[index + 1], data[index + 2]]
    }

    const activePixel = readPixel(activeX, seamY)
    expect(Math.min(...activePixel)).toBeGreaterThan(180)
  })

  test('skip action label stays centered within its button', async ({ page }) => {
    await ensureSignedIn(page)
    await page.goto('/dashboard', { waitUntil: 'networkidle' })

    const skipButton = page.locator('.screening-actions-bar .button', { hasText: 'Skip' }).first()
    await expect(skipButton).toBeVisible()

    const alignment = await skipButton.evaluate((node) => {
      const label = node.querySelector<HTMLElement>('.button__label')
      if (!label) {
        return null
      }

      const buttonRect = node.getBoundingClientRect()
      const labelRect = label.getBoundingClientRect()

      return {
        deltaX: Math.round((labelRect.left + labelRect.width / 2) - (buttonRect.left + buttonRect.width / 2)),
        deltaY: Math.round((labelRect.top + labelRect.height / 2) - (buttonRect.top + buttonRect.height / 2)),
      }
    })

    expect(alignment).not.toBeNull()
    expect(Math.abs(alignment!.deltaX)).toBeLessThanOrEqual(1)
    expect(Math.abs(alignment!.deltaY)).toBeLessThanOrEqual(1)
  })

  test('dashboard, profile, and job detail hairlines stay flush to the queue edge', async ({ page }) => {
    await ensureSignedIn(page)

    await page.goto('/dashboard', { waitUntil: 'networkidle' })
    await expectHorizontalHairlineFlush(page.locator('.dashboard-workspace .queue-column > .queue-meta').first(), '::after')

    await page.goto('/profile', { waitUntil: 'networkidle' })
    await expectHorizontalHairlineFlush(page.locator('.settings-main > section.panel.settings-section').first(), '::before')

    await page.goto('/dashboard', { waitUntil: 'networkidle' })
    const firstSummary = page.locator('.screening-summary').first()
    await expect(firstSummary).toBeVisible()
    await firstSummary.click()

    const firstJobLink = page.getByRole('link', { name: 'More details' }).first()
    await expect(firstJobLink).toBeVisible()
    await firstJobLink.click()
    await page.waitForURL(/\/jobs\/.+$/)

    await expectHorizontalHairlineFlush(page.locator('.job-flow-prep-overview-wrap > .job-flow-section.detail-review-section').first(), '::after')
  })
})
