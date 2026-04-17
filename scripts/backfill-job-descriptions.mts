/**
 * Backfill job.description_text_fetched for every row that doesn't have it yet.
 *
 * Why: many job feeds (Remotive, Jobspresso, etc.) return a summary stub. The real JD
 * paragraphs live on the source page and are only available via a markdown fetch.
 * Having the full text materially improves both ranking heuristics and LLM-driven
 * resume / cover-letter generation.
 *
 * Usage: `npm run backfill:job-descriptions [-- --limit=N] [--force]`
 *   --limit=N       Only process N jobs (default: all).
 *   --force         Re-fetch even if description_text_fetched is already populated
 *                   (normally skipped unless the last fetch was > 7 days old).
 *   --job-id=UUID   Only process a specific job.
 *
 * Safe to run anytime — the enrichment helper is idempotent and never throws.
 */

import { hasSupabaseServerEnv } from '@/lib/env'
import { enrichJobDescriptionById } from '@/lib/jobs/description-enrichment'
import { createClient } from '@/lib/supabase/server'

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

async function listJobsNeedingEnrichment(limit: number | undefined, force: boolean, jobId: string | undefined) {
  const supabase = createClient()
  let query = supabase
    .from('jobs')
    .select('id, company_name, title, source_url, description_fetched_at, description_text_fetched')
    .order('ingested_at', { ascending: false })

  if (jobId) {
    query = query.eq('id', jobId)
  } else if (!force) {
    query = query.is('description_text_fetched', null)
  }

  if (typeof limit === 'number') {
    query = query.limit(limit)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to list jobs: ${error.message}`)
  }
  return data ?? []
}

async function main() {
  if (!hasSupabaseServerEnv()) {
    console.error('Supabase service-role env vars missing; cannot backfill.')
    process.exit(1)
  }

  const args = parseArgs(process.argv.slice(2))
  const jobs = await listJobsNeedingEnrichment(args.limit, args.force, args.jobId)

  if (jobs.length === 0) {
    console.info('Nothing to backfill — all jobs already have description_text_fetched or query returned empty.')
    return
  }

  console.info(`Backfilling ${jobs.length} job(s)…`)

  const results = {
    fetched: 0,
    skippedRecent: 0,
    skippedNoUrl: 0,
    tooShort: 0,
    failed: 0,
  }

  // Run sequentially with a 500ms pacing delay between requests. External fetchers
  // (Jina Reader free tier, etc.) rate-limit per-IP; sequential is slower but far more
  // reliable than parallelized bursts that get throttled and fail silently.
  for (const job of jobs as Array<{ id: string; company_name?: string; title?: string }>) {
    const label = `${job.company_name ?? '?'} — ${job.title ?? '?'} (${job.id})`
    const result = await enrichJobDescriptionById(job.id, {
      skipIfRecentWithinMs: args.force ? 0 : undefined,
    })
    switch (result.action) {
      case 'fetched':
        results.fetched += 1
        console.info(`  \u2713 ${label} \u2192 fetched ${result.contentLength} chars`)
        break
      case 'skipped-recent':
        results.skippedRecent += 1
        console.info(`  \u2212 ${label} \u2192 skipped (already fetched at ${result.fetchedAt})`)
        break
      case 'skipped-no-url':
        results.skippedNoUrl += 1
        console.warn(`  ! ${label} \u2192 skipped (no source_url)`)
        break
      case 'too-short':
        results.tooShort += 1
        console.warn(`  ! ${label} \u2192 fetched but too short (${result.contentLength} chars)`)
        break
      case 'failed':
        results.failed += 1
        console.error(`  \u2717 ${label} \u2192 ${result.errorMessage}`)
        break
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  console.info('')
  console.info(`Done. Fetched: ${results.fetched} · skipped-recent: ${results.skippedRecent} · skipped-no-url: ${results.skippedNoUrl} · too-short: ${results.tooShort} · failed: ${results.failed}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
