import 'server-only'

import { fetchMarkdown } from '@/lib/scraping/fetch-markdown'
import { createClient } from '@/lib/supabase/server'

/**
 * Fetches the full description from a job's source_url and persists it to
 * `jobs.description_text_fetched`. Called after insert during normal import, and on
 * demand by the backfill script.
 *
 * Semantics:
 * - Idempotent by design: safe to call multiple times on the same job.
 * - Never throws. Failures are logged to `description_fetch_error` so the job still
 *   participates in ranking using the feed-provided `description_text`.
 * - Respects `skipIfRecent`: when true, skips the fetch if a successful fetch already
 *   happened within the lookback window. Prevents hammering source servers on
 *   re-imports of the same listing.
 */

const DEFAULT_RECENT_WINDOW_MS = 1000 * 60 * 60 * 24 * 7 // 7 days
// Minimum content-length bar for a fetched description to count as "better" than the
// feed stub. Under this, we assume the fetch got a cookie wall / login screen / error
// page rather than actual JD text, and we don't overwrite the feed description.
const MIN_FETCHED_CONTENT_LENGTH = 400

export interface EnrichJobDescriptionOptions {
  skipIfRecentWithinMs?: number
}

export interface EnrichJobDescriptionResult {
  jobId: string
  sourceUrl: string
  action: 'skipped-no-url' | 'skipped-recent' | 'fetched' | 'too-short' | 'failed'
  fetchedAt?: string
  contentLength?: number
  errorMessage?: string
}

interface EnrichableJobRow {
  id: string
  source_url: string | null
  description_fetched_at: string | null
}

async function loadJobRow(jobId: string): Promise<EnrichableJobRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('jobs')
    .select('id, source_url, description_fetched_at')
    .eq('id', jobId)
    .maybeSingle()
  if (error || !data) return null
  return data as EnrichableJobRow
}

export async function enrichJobDescriptionById(
  jobId: string,
  options: EnrichJobDescriptionOptions = {},
): Promise<EnrichJobDescriptionResult> {
  const row = await loadJobRow(jobId)
  if (!row) {
    return {
      jobId,
      sourceUrl: '',
      action: 'failed',
      errorMessage: 'Job row not found.',
    }
  }
  const sourceUrl = row.source_url ?? ''

  if (!sourceUrl) {
    return { jobId, sourceUrl: '', action: 'skipped-no-url' }
  }

  const windowMs = options.skipIfRecentWithinMs ?? DEFAULT_RECENT_WINDOW_MS
  if (row.description_fetched_at) {
    const lastFetchMs = new Date(row.description_fetched_at).getTime()
    if (Number.isFinite(lastFetchMs) && Date.now() - lastFetchMs < windowMs) {
      return {
        jobId,
        sourceUrl,
        action: 'skipped-recent',
        fetchedAt: row.description_fetched_at,
      }
    }
  }

  const result = await fetchMarkdown(sourceUrl)
  const supabase = createClient()

  if (!result.success) {
    await supabase
      .from('jobs')
      .update({
        description_fetched_at: result.fetchedAt,
        description_fetch_error: result.error.slice(0, 500),
      })
      .eq('id', jobId)
    return {
      jobId,
      sourceUrl,
      action: 'failed',
      fetchedAt: result.fetchedAt,
      errorMessage: result.error,
    }
  }

  if (result.markdown.length < MIN_FETCHED_CONTENT_LENGTH) {
    await supabase
      .from('jobs')
      .update({
        description_fetched_at: result.fetchedAt,
        description_fetch_error:
          `Fetched content was too short (${result.markdown.length} chars) — likely a gate or empty page.`,
      })
      .eq('id', jobId)
    return {
      jobId,
      sourceUrl,
      action: 'too-short',
      fetchedAt: result.fetchedAt,
      contentLength: result.markdown.length,
    }
  }

  const { error: updateError } = await supabase
    .from('jobs')
    .update({
      description_text_fetched: result.markdown,
      description_fetched_at: result.fetchedAt,
      description_fetch_error: null,
    })
    .eq('id', jobId)

  if (updateError) {
    return {
      jobId,
      sourceUrl,
      action: 'failed',
      fetchedAt: result.fetchedAt,
      errorMessage: updateError.message,
    }
  }

  return {
    jobId,
    sourceUrl,
    action: 'fetched',
    fetchedAt: result.fetchedAt,
    contentLength: result.markdown.length,
  }
}
