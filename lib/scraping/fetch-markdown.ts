import 'server-only'

/**
 * Shared URL → markdown fetcher.
 *
 * Used by:
 * - Job description enrichment (fetch full listing text from a job's source_url)
 * - Phase A portfolio enrichment (fetch a candidate's portfolio HTML)
 * - Any future "read a public page" workflow
 *
 * Backed by Jina Reader by default (https://r.jina.ai/<url> — free, no auth, server-side
 * HTML → markdown conversion that handles JS-rendered pages better than a plain fetch).
 * Configurable via the JINA_READER_BASE_URL env var so this can be pointed at Firecrawl
 * or a self-hosted equivalent without code changes.
 *
 * Design contract:
 * - NEVER throws. Failures return `{ success: false, error }` so callers can decide
 *   whether to fall back to shorter source material rather than blocking the whole
 *   ingest or generation pipeline.
 * - 30-second timeout — enough for slow/JS-heavy pages, short enough not to stall
 *   background workers.
 * - Caller is responsible for caching. This module does not cache internally so test
 *   runs stay deterministic.
 */

const DEFAULT_FETCH_BASE = 'https://r.jina.ai/'
const DEFAULT_TIMEOUT_MS = 30_000
// Jina Reader may return very long markdown for heavy pages (case studies with embedded
// transcripts, etc.). Cap at ~40k chars so downstream LLM prompts don't blow past token
// budgets. Callers can request a smaller cap per call.
const DEFAULT_MAX_LENGTH = 40_000
// Retry envelope for transient upstream failures (Jina rate limits on free tier; self-hosted
// deployments may briefly 503 under load). Keep the total retry window short so a single bad
// URL can't stall a portfolio walk — at 500/1000/2000 ms backoff we spend at most ~3.5s
// before giving up and letting the caller move to the next subpage.
const RETRY_STATUSES = new Set([429, 503])
const MAX_RETRY_ATTEMPTS = 3
const RETRY_BASE_DELAY_MS = 500
const RETRY_MAX_DELAY_MS = 5_000

export interface FetchMarkdownOptions {
  /** Override the base fetch service. Useful for tests (stub) and Firecrawl users. */
  fetchBaseUrl?: string
  /** Hard timeout in milliseconds. Default 30_000. */
  timeoutMs?: number
  /** Clip output to this many chars. Default 40_000. */
  maxLength?: number
  /** Optional API key — sent as `Authorization: Bearer <key>`. Jina Reader free tier
   *  doesn't require one; Firecrawl does. */
  apiKey?: string
}

export interface FetchMarkdownSuccess {
  success: true
  markdown: string
  sourceUrl: string
  contentLength: number
  fetchedAt: string
  truncated: boolean
}

export interface FetchMarkdownFailure {
  success: false
  sourceUrl: string
  error: string
  errorKind: 'invalid-url' | 'timeout' | 'http-error' | 'empty' | 'network' | 'unknown'
  status?: number
  fetchedAt: string
}

export type FetchMarkdownResult = FetchMarkdownSuccess | FetchMarkdownFailure

function isLikelyUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function readerEndpoint(base: string, targetUrl: string) {
  // Jina Reader expects the target appended to the base — it does URL-encoding internally,
  // but encoding the path once defensively avoids surprises on URLs that already include
  // query strings or fragments.
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return `${normalizedBase}${targetUrl}`
}

export async function fetchMarkdown(
  targetUrl: string,
  options: FetchMarkdownOptions = {},
): Promise<FetchMarkdownResult> {
  const fetchedAt = new Date().toISOString()

  if (!targetUrl || typeof targetUrl !== 'string' || !isLikelyUrl(targetUrl)) {
    return {
      success: false,
      sourceUrl: targetUrl ?? '',
      error: 'Target URL is missing or malformed.',
      errorKind: 'invalid-url',
      fetchedAt,
    }
  }

  const base = options.fetchBaseUrl ?? process.env.JINA_READER_BASE_URL ?? DEFAULT_FETCH_BASE
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH
  const apiKey = options.apiKey ?? process.env.JINA_READER_API_KEY

  const headers: Record<string, string> = {
    'X-Return-Format': 'markdown',
    Accept: 'text/plain',
  }
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  let lastStatus: number | undefined
  let lastStatusText = ''
  for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    const controller = new AbortController()
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(readerEndpoint(base, targetUrl), {
        headers,
        signal: controller.signal,
      })

      if (!response.ok) {
        lastStatus = response.status
        lastStatusText = response.statusText
        if (RETRY_STATUSES.has(response.status) && attempt < MAX_RETRY_ATTEMPTS) {
          // Honor Retry-After when present (capped at RETRY_MAX_DELAY_MS so a misbehaving
          // upstream can't stall the whole walk) and otherwise fall back to exponential
          // backoff. Both parsed forms of Retry-After are accepted — seconds and HTTP-date —
          // though Jina/Firecrawl only ever send the seconds form in practice.
          const retryAfter = response.headers.get('retry-after')
          const backoffMs = parseRetryAfter(retryAfter) ?? Math.min(
            RETRY_BASE_DELAY_MS * 2 ** attempt,
            RETRY_MAX_DELAY_MS,
          )
          clearTimeout(timeoutHandle)
          await delay(backoffMs)
          continue
        }
        clearTimeout(timeoutHandle)
        return {
          success: false,
          sourceUrl: targetUrl,
          error: `Fetch service returned HTTP ${response.status} ${response.statusText}.`,
          errorKind: 'http-error',
          status: response.status,
          fetchedAt,
        }
      }

      const rawText = await response.text()
      clearTimeout(timeoutHandle)
      const trimmed = rawText.trim()
      if (!trimmed) {
        return {
          success: false,
          sourceUrl: targetUrl,
          error: 'Fetch service returned an empty body.',
          errorKind: 'empty',
          fetchedAt,
        }
      }

      const truncated = trimmed.length > maxLength
      const markdown = truncated ? trimmed.slice(0, maxLength) : trimmed

      return {
        success: true,
        sourceUrl: targetUrl,
        markdown,
        contentLength: trimmed.length,
        fetchedAt,
        truncated,
      }
    } catch (error) {
      clearTimeout(timeoutHandle)
      const message = error instanceof Error ? error.message : String(error)
      const errorKind: FetchMarkdownFailure['errorKind'] =
        error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'network'
      return {
        success: false,
        sourceUrl: targetUrl,
        error: message || 'Network fetch failed.',
        errorKind,
        fetchedAt,
      }
    }
  }

  return {
    success: false,
    sourceUrl: targetUrl,
    error: `Fetch service returned HTTP ${lastStatus ?? ''} ${lastStatusText} after ${MAX_RETRY_ATTEMPTS} retries.`.trim(),
    errorKind: 'http-error',
    status: lastStatus,
    fetchedAt,
  }
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null
  const trimmed = header.trim()
  if (!trimmed) return null
  const seconds = Number(trimmed)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.round(seconds * 1000), RETRY_MAX_DELAY_MS)
  }
  const dateMs = Date.parse(trimmed)
  if (Number.isFinite(dateMs)) {
    const diff = dateMs - Date.now()
    if (diff > 0) return Math.min(diff, RETRY_MAX_DELAY_MS)
  }
  return null
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
