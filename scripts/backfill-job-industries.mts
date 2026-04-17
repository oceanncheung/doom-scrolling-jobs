/**
 * Backfill public.jobs primary_industry / adjacent_industries / industry_evidence via
 * the Phase C classifier (see lib/ai/tasks/classify-job-industry.ts).
 *
 * Usage: `npm run backfill:job-industries [-- --limit=N] [--force] [--job-id=UUID]`
 *
 * Requires a fetched description for the classifier to work well. Run
 * `npm run backfill:job-descriptions` first to populate description_text_fetched, then
 * this script will see the richer text.
 */

import fs from 'node:fs'
import path from 'node:path'

import { hasOpenAIEnv, hasSupabaseServerEnv } from '@/lib/env'
import { classifyAndStoreJobIndustry } from '@/lib/jobs/industry-classification'
import { createClient } from '@/lib/supabase/server'

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
  limit?: number
  force: boolean
  jobId?: string
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { force: false }
  for (const arg of argv) {
    if (arg === '--force') {
      args.force = true
    } else if (arg.startsWith('--limit=')) {
      const value = Number.parseInt(arg.slice('--limit='.length), 10)
      if (Number.isFinite(value) && value > 0) args.limit = value
    } else if (arg.startsWith('--job-id=')) {
      args.jobId = arg.slice('--job-id='.length).trim()
    }
  }
  return args
}

async function listJobs(limit: number | undefined, force: boolean, jobId: string | undefined) {
  const supabase = createClient()
  let query = supabase
    .from('jobs')
    .select('id, title, company_name, industry_classified_at')
    .order('ingested_at', { ascending: false })

  if (jobId) {
    query = query.eq('id', jobId)
  } else if (!force) {
    query = query.is('industry_classified_at', null)
  }
  if (typeof limit === 'number') {
    query = query.limit(limit)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to list jobs: ${error.message}`)
  return data ?? []
}

async function main() {
  if (!hasSupabaseServerEnv()) {
    console.error('Supabase service-role env vars missing; cannot backfill.')
    process.exit(1)
  }
  if (!hasOpenAIEnv()) {
    console.error('OpenAI env missing; cannot classify.')
    process.exit(1)
  }

  const args = parseArgs(process.argv.slice(2))
  const jobs = await listJobs(args.limit, args.force, args.jobId)

  if (jobs.length === 0) {
    console.info('Nothing to classify — all jobs already have industry tags or query returned empty.')
    return
  }

  console.info(`Classifying ${jobs.length} job(s)…`)

  const counts = { classified: 0, skippedAlready: 0, skippedThin: 0, failed: 0 }
  for (const job of jobs as Array<{ id: string; company_name?: string; title?: string }>) {
    const label = `${job.company_name ?? '?'} — ${job.title ?? '?'} (${job.id})`
    const result = await classifyAndStoreJobIndustry(job.id, {
      skipIfClassified: args.force ? false : true,
    })
    switch (result.action) {
      case 'classified': {
        counts.classified += 1
        const c = result.classification!
        console.info(
          `  \u2713 ${label} \u2192 ${c.primaryIndustry}` +
            (c.adjacentIndustries.length > 0 ? ` · adjacent: ${c.adjacentIndustries.join(', ')}` : ''),
        )
        break
      }
      case 'skipped-already-classified':
        counts.skippedAlready += 1
        console.info(`  \u2212 ${label} \u2192 already classified`)
        break
      case 'skipped-thin-description':
        counts.skippedThin += 1
        console.warn(`  ! ${label} \u2192 description too thin; run backfill:job-descriptions first`)
        break
      case 'failed':
        counts.failed += 1
        console.error(`  \u2717 ${label} \u2192 ${result.errorMessage}`)
        break
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  console.info('')
  console.info(
    `Done. Classified: ${counts.classified} · skipped-already: ${counts.skippedAlready} · skipped-thin: ${counts.skippedThin} · failed: ${counts.failed}`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
