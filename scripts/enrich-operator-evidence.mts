/**
 * Runs Phase A portfolio/web enrichment for the currently-active operator.
 *
 * What it does: fetches the operator's portfolio + personal-site URLs (when set on their
 * profile), converts each to markdown via Jina Reader, runs the extract-evidence LLM
 * task, and persists the extracted entries to evidence_bank with confirmed_at = null.
 *
 * Output entries are NOT consumed by the resume generator yet — they wait in the bank
 * until the operator confirms them via the Phase B UI (forthcoming). This script is
 * meant to be run manually or on a cron to keep the bank warm.
 *
 * Usage: `npm run enrich:operator-evidence`
 */

import fs from 'node:fs'
import path from 'node:path'

import { enrichActiveOperatorEvidence } from '@/lib/jobs/enrich-operator-evidence'

function loadEnvFile(filename: string) {
  const filepath = path.join(process.cwd(), filename)
  if (!fs.existsSync(filepath)) return
  for (const line of fs.readFileSync(filepath, 'utf8').split(/\n+/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) continue
    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()
    const value = rawValue.replace(/^['"]|['"]$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

async function main() {
  const result = await enrichActiveOperatorEvidence()
  console.info(`Enrichment for operator ${result.operatorId}:`)
  for (const source of result.sources) {
    const tag = `${source.sourceKind} @ ${source.sourceUrl || '(no url)'}`
    switch (source.status) {
      case 'fetched':
        console.info(`  \u2713 ${tag} \u2192 ${source.contentLength} chars, inserted ${source.inserted} entries`)
        break
      case 'fetch-failed':
        console.error(`  \u2717 ${tag} \u2192 fetch failed: ${source.error}`)
        break
      case 'skipped-no-url':
        console.info(`  \u2212 ${tag} \u2192 skipped (no URL on profile)`)
        break
      case 'no-entries-extracted':
        console.warn(`  ! ${tag} \u2192 ${source.contentLength} chars fetched but no entries extracted (thin content?)`)
        break
    }
  }
  console.info('')
  console.info(`Total inserted: ${result.insertedEntries.length} evidence entries (unconfirmed)`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
