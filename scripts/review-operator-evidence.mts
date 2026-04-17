/**
 * Operator-run CLI to review the evidence_bank entries produced by Phase A enrichment.
 * Placeholder until the /profile confirmation UI ships — lets the operator get value out
 * of enrichment today without needing a browser-based review surface.
 *
 * Usage:
 *   npm run review:evidence                  — list all unconfirmed entries
 *   npm run review:evidence -- --confirm-all — confirm every unconfirmed entry
 *   npm run review:evidence -- --confirm-high — confirm only high-confidence entries
 *   npm run review:evidence -- --discard-all — discard every unconfirmed entry
 *   npm run review:evidence -- --confirm=ID[,ID...] — confirm specific entries
 *   npm run review:evidence -- --discard=ID[,ID...] — discard specific entries
 *
 * Safe: never touches entries that were previously confirmed or discarded.
 * Actions are logged to stdout so the operator has a record of what was applied.
 */

import fs from 'node:fs'
import path from 'node:path'

import { getActiveOperatorContext } from '@/lib/data/operators'
import {
  confirmEvidenceEntry,
  discardEvidenceEntry,
  listEvidenceForOperator,
} from '@/lib/data/evidence-bank'
import { hasSupabaseServerEnv } from '@/lib/env'

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

interface Args {
  confirmAll: boolean
  confirmHigh: boolean
  discardAll: boolean
  confirmIds: string[]
  discardIds: string[]
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { confirmAll: false, confirmHigh: false, discardAll: false, confirmIds: [], discardIds: [] }
  for (const arg of argv) {
    if (arg === '--confirm-all') args.confirmAll = true
    else if (arg === '--confirm-high') args.confirmHigh = true
    else if (arg === '--discard-all') args.discardAll = true
    else if (arg.startsWith('--confirm=')) {
      args.confirmIds = arg.slice('--confirm='.length).split(',').map((s) => s.trim()).filter(Boolean)
    } else if (arg.startsWith('--discard=')) {
      args.discardIds = arg.slice('--discard='.length).split(',').map((s) => s.trim()).filter(Boolean)
    }
  }
  return args
}

async function main() {
  if (!hasSupabaseServerEnv()) {
    console.error('Supabase service-role env vars missing; cannot review.')
    process.exit(1)
  }

  const operatorContext = await getActiveOperatorContext()
  if (!operatorContext?.operator?.id) {
    console.error('No active operator selected.')
    process.exit(1)
  }

  const args = parseArgs(process.argv.slice(2))
  const allEntries = await listEvidenceForOperator(operatorContext.operator.id)
  const unconfirmed = allEntries.filter((entry) => !entry.confirmedAt && !entry.discardedAt)

  // Default: list unconfirmed entries when no action flags are given.
  const hasAction =
    args.confirmAll ||
    args.confirmHigh ||
    args.discardAll ||
    args.confirmIds.length > 0 ||
    args.discardIds.length > 0

  if (!hasAction) {
    console.info(`Operator: ${operatorContext.operator.displayName}`)
    console.info(`Total entries: ${allEntries.length}  ·  unconfirmed: ${unconfirmed.length}  ·  confirmed: ${allEntries.filter((e) => e.confirmedAt).length}  ·  discarded: ${allEntries.filter((e) => e.discardedAt).length}`)
    console.info('')
    if (unconfirmed.length === 0) {
      console.info('Nothing unconfirmed. Run `npm run enrich:operator-evidence` to populate.')
      return
    }
    console.info(`Unconfirmed entries (${unconfirmed.length}):`)
    for (const entry of unconfirmed) {
      console.info('')
      console.info(`  id: ${entry.id}`)
      console.info(`  kind: ${entry.kind}  ·  confidence: ${entry.confidence}  ·  source: ${entry.sourceKind} @ ${entry.sourceUrl ?? '(no url)'}`)
      if (entry.clientName) console.info(`  client: ${entry.clientName}`)
      if (entry.industryTags.length > 0) console.info(`  industries: ${entry.industryTags.join(', ')}`)
      if (entry.scope.length > 0) console.info(`  scope: ${entry.scope.join(', ')}`)
      if (entry.tools.length > 0) console.info(`  tools: ${entry.tools.join(', ')}`)
      console.info(`  summary: ${entry.summary}`)
      if (entry.sourceSnapshotExcerpt) {
        console.info(`  source snippet: "${entry.sourceSnapshotExcerpt.slice(0, 200)}${entry.sourceSnapshotExcerpt.length > 200 ? '…' : ''}"`)
      }
    }
    console.info('')
    console.info('To act: --confirm-high, --confirm-all, --discard-all, --confirm=ID1,ID2, --discard=ID1,ID2')
    return
  }

  const toConfirm: string[] = [...args.confirmIds]
  const toDiscard: string[] = [...args.discardIds]

  if (args.confirmAll) {
    toConfirm.push(...unconfirmed.map((entry) => entry.id))
  }
  if (args.confirmHigh) {
    toConfirm.push(...unconfirmed.filter((entry) => entry.confidence === 'high').map((entry) => entry.id))
  }
  if (args.discardAll) {
    toDiscard.push(...unconfirmed.map((entry) => entry.id))
  }

  // De-dupe and resolve conflicts (discard wins when an id is in both).
  const confirmSet = new Set(toConfirm)
  for (const id of toDiscard) confirmSet.delete(id)
  const discardSet = new Set(toDiscard)

  let confirmed = 0
  let discarded = 0
  for (const id of confirmSet) {
    try {
      await confirmEvidenceEntry(id, 'Confirmed via CLI review')
      console.info(`  \u2713 confirmed ${id}`)
      confirmed += 1
    } catch (err) {
      console.error(`  \u2717 confirm ${id}: ${err instanceof Error ? err.message : err}`)
    }
  }
  for (const id of discardSet) {
    try {
      await discardEvidenceEntry(id, 'Discarded via CLI review')
      console.info(`  - discarded ${id}`)
      discarded += 1
    } catch (err) {
      console.error(`  \u2717 discard ${id}: ${err instanceof Error ? err.message : err}`)
    }
  }
  console.info('')
  console.info(`Done. Confirmed: ${confirmed}  ·  discarded: ${discarded}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
