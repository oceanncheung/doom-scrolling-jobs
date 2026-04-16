import fs from 'node:fs/promises'
import path from 'node:path'

import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { ensureSignedIn, waitForUiSettled } from '@/tests/helpers/auth'
import { buildUiArtifactManifest } from '@/tests/helpers/ui-artifact-manifest'

const defaultJobId = process.env.SMOKE_JOB_ID || 'ec47ed58-6782-46e4-8ce7-4b3241ef345c'
const artifactRoot = path.join(
  process.cwd(),
  process.env.UI_ARTIFACTS_ROOT || '.codex-artifacts/eval/latest/ui',
)

async function clearArtifactRoot() {
  await fs.rm(artifactRoot, { force: true, recursive: true })
  await fs.mkdir(artifactRoot, { recursive: true })
}

async function prepareCapture(page: Page, route: string, requiresSignIn: boolean) {
  if (requiresSignIn) {
    await ensureSignedIn(page)
  }

  await page.goto(route, { waitUntil: 'domcontentloaded' })
  await waitForUiSettled(page)
}

async function applySetup(page: Page, setup?: string) {
  switch (setup) {
    case 'open-additional-filters': {
      const disclosure = page.locator('.settings-action-disclosure').first()
      const summary = page.locator('.settings-action-disclosure summary').first()
      await expect(summary).toBeVisible()
      await summary.click()
      await expect(disclosure).toHaveAttribute('open', '')
      await expect(disclosure.locator('.settings-action-body')).toBeVisible()
      break
    }
    case 'open-experience-tab': {
      const tabButton = page.locator('.disclosure-experience .settings-tab-button').first()
      const tabShell = page.locator('.disclosure-experience .settings-tab-shell').first()
      await expect(tabButton).toBeVisible()
      await tabButton.click()
      await expect(tabButton).toHaveClass(/is-active/)
      await expect(tabShell).toHaveClass(/has-selection/)
      break
    }
    default:
      break
  }

  await waitForUiSettled(page)
}

test.describe.configure({ mode: 'serial' })
test.setTimeout(120000)

test('capture UI review artifacts', async ({ page }) => {
  const manifest = buildUiArtifactManifest(defaultJobId)
  const capturedItems: Array<{
    filePath: string
    label: string
    outputPath: string
    route: string
  }> = []

  await clearArtifactRoot()

  try {
    for (const item of manifest) {
      await test.step(item.label, async () => {
        await page.setViewportSize(item.viewport)
        await prepareCapture(page, item.route, item.requiresSignIn)
        await applySetup(page, item.setup)

        const outputPath = path.join(artifactRoot, item.outputPath)
        await fs.mkdir(path.dirname(outputPath), { recursive: true })

        if (item.clipSelector) {
          const locator = page.locator(item.clipSelector).first()
          await expect(locator).toBeVisible()
          await locator.screenshot({ path: outputPath })
        } else {
          await page.screenshot({
            fullPage: true,
            path: outputPath,
          })
        }

        capturedItems.push({
          filePath: outputPath,
          label: item.label,
          outputPath: item.outputPath,
          route: item.route,
        })
      })
    }
  } finally {
    const manifestPath = path.join(artifactRoot, 'manifest.json')
    await fs.writeFile(
      manifestPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          items: capturedItems,
        },
        null,
        2,
      ),
      'utf8',
    )
  }
})
