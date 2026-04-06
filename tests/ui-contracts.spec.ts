import { expect, test } from '@playwright/test'

function round(value: number | null | undefined) {
  return value == null ? null : Math.round(value)
}

test.describe('UI contracts', () => {
  test('site header stays fixed across scroll extremes', async ({ page }) => {
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
      await page.waitForTimeout(150)
      topPositions.push(
        await header.evaluate((node) => Math.round(node.getBoundingClientRect().top)),
      )

      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(150)
      topPositions.push(
        await header.evaluate((node) => Math.round(node.getBoundingClientRect().top)),
      )

      expect(new Set(topPositions).size).toBe(1)
      expect(topPositions[0]).toBe(0)
    }
  })

  test('profile source upload row keeps the frozen seam and edge contract', async ({ page }) => {
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
})
