import 'server-only'

import type { FetchMarkdownResult } from '@/lib/scraping/fetch-markdown'
import { fetchMarkdown } from '@/lib/scraping/fetch-markdown'

/**
 * Portfolio source — fetches the candidate's portfolio index URL as markdown, then walks
 * up to N same-origin subpage links so each featured client gets its full case-study copy
 * included in the combined snapshot (the earlier index-only fetch returned one-line
 * summaries per client; that wasn't enough for the extractor to pull rich proof points).
 *
 * Shape:
 *   1. Fetch the root URL.
 *   2. Parse same-origin links out of the resulting markdown.
 *   3. Deduplicate and cap at MAX_SUBPAGES.
 *   4. Fetch each subpage sequentially (small serial batch to avoid flooding the fetch
 *      service). Prepend the URL as a header so the LLM can distinguish sections.
 *   5. Concatenate into one markdown blob, capped at PORTFOLIO_MAX_LENGTH overall.
 *
 * Personal sites share the same traversal — typically they have fewer subpages, so the
 * cap + same-origin filter naturally keeps the fetch small.
 */

const PORTFOLIO_MAX_LENGTH = 120_000 // up from 80k to accommodate multi-page concatenation
const PER_PAGE_MAX_LENGTH = 30_000
const MAX_SUBPAGES = 12
const SUBPAGE_FETCH_DELAY_MS = 250

export interface PortfolioSnapshot {
  url: string
  markdown: string
  fetchedAt: string
  contentLength: number
  truncated: boolean
  /** URLs that were actually fetched (root + subpages). Useful for provenance + debugging. */
  fetchedUrls: string[]
  /** Count of subpage fetches that failed (non-fatal; the root fetch is all that matters). */
  subpageFetchErrors: number
}

export interface PortfolioSnapshotError {
  url: string
  error: string
  fetchedAt: string
}

export type PortfolioFetchResult =
  | { success: true; snapshot: PortfolioSnapshot }
  | { success: false; error: PortfolioSnapshotError }

function canonicalizeForDedup(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    // Strip trailing slash to treat /works/foo and /works/foo/ as the same.
    const pathname = parsed.pathname.replace(/\/$/, '') || '/'
    return `${parsed.protocol}//${parsed.host}${pathname}${parsed.search}`
  } catch {
    return url.replace(/#.*$/, '').replace(/\/$/, '')
  }
}

function extractSameOriginLinks(markdown: string, rootUrl: string): string[] {
  let rootOrigin = ''
  let rootPath = ''
  try {
    const parsed = new URL(rootUrl)
    rootOrigin = parsed.origin
    rootPath = parsed.pathname.replace(/\/$/, '') || '/'
  } catch {
    return []
  }

  // Find ALL http(s) URLs in the markdown. Simpler and more robust than parsing markdown
  // link syntax — Jina Reader sometimes nests `[image](url)` inside outer `[text](url)`
  // blocks, which breaks non-balanced bracket regexes. We just grab every URL and filter
  // to same-origin, non-asset, non-root paths below.
  //
  // Hosting domains serving the SAME ORIGIN content from a separate CDN (common for
  // Framer sites — `framerusercontent.com`, `framercanvas.com`) are filtered out by the
  // origin check since they're different hosts.
  const urlRe = /https?:\/\/[^\s)"'<>\]]+/g
  const found = new Set<string>()

  for (const raw of markdown.match(urlRe) ?? []) {
    // Strip trailing punctuation that often comes from markdown syntax (commas, periods,
    // closing parens from the outer link wrapper).
    const cleaned = raw.replace(/[),.;!?]+$/, '')
    let absolute: string
    try {
      absolute = new URL(cleaned, rootUrl).toString()
    } catch {
      continue
    }
    let parsed: URL
    try {
      parsed = new URL(absolute)
    } catch {
      continue
    }
    if (parsed.origin !== rootOrigin) continue
    // Skip assets — we want narrative subpages only.
    if (/\.(png|jpe?g|gif|webp|svg|ico|pdf|zip|mp4|mov|avi|mp3|wav|ogg|woff2?|ttf|otf)(\?|$)/i.test(parsed.pathname)) {
      continue
    }
    const canonical = canonicalizeForDedup(absolute)
    if (canonical === canonicalizeForDedup(rootUrl)) continue
    // Prefer pages deeper than the root.
    if (parsed.pathname === rootPath) continue
    found.add(canonical)
  }

  return Array.from(found)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toFailure(result: FetchMarkdownResult, fallbackUrl: string): PortfolioSnapshotError {
  if (result.success) {
    return { url: fallbackUrl, error: 'Unexpected success result treated as failure.', fetchedAt: new Date().toISOString() }
  }
  return { url: result.sourceUrl || fallbackUrl, error: result.error, fetchedAt: result.fetchedAt }
}

async function fetchPageAndSubpages(rootUrl: string): Promise<PortfolioFetchResult> {
  const rootResult = await fetchMarkdown(rootUrl, { maxLength: PER_PAGE_MAX_LENGTH })
  if (!rootResult.success) {
    return { success: false, error: toFailure(rootResult, rootUrl) }
  }

  const sections: string[] = [`# SOURCE: ${rootResult.sourceUrl}\n\n${rootResult.markdown}`]
  const fetchedUrls: string[] = [rootResult.sourceUrl]
  let subpageFetchErrors = 0
  let combinedLength = sections[0].length

  const subpageCandidates = extractSameOriginLinks(rootResult.markdown, rootUrl).slice(0, MAX_SUBPAGES)
  for (const candidate of subpageCandidates) {
    if (combinedLength >= PORTFOLIO_MAX_LENGTH) break
    // Polite: small gap between subpage fetches so we don't hammer the reader service.
    await sleep(SUBPAGE_FETCH_DELAY_MS)
    const pageResult = await fetchMarkdown(candidate, { maxLength: PER_PAGE_MAX_LENGTH })
    if (!pageResult.success) {
      subpageFetchErrors += 1
      continue
    }
    const block = `# SOURCE: ${pageResult.sourceUrl}\n\n${pageResult.markdown}`
    if (combinedLength + block.length + 2 > PORTFOLIO_MAX_LENGTH) {
      // Truncate the tail of this subpage to fit rather than drop it entirely.
      const room = PORTFOLIO_MAX_LENGTH - combinedLength - `# SOURCE: ${pageResult.sourceUrl}\n\n`.length - 32
      if (room > 1_000) {
        sections.push(`# SOURCE: ${pageResult.sourceUrl}\n\n${pageResult.markdown.slice(0, room)}`)
        fetchedUrls.push(pageResult.sourceUrl)
      }
      break
    }
    sections.push(block)
    fetchedUrls.push(pageResult.sourceUrl)
    combinedLength += block.length + 2
  }

  const combined = sections.join('\n\n')
  const truncated = combined.length > PORTFOLIO_MAX_LENGTH
  const markdown = truncated ? combined.slice(0, PORTFOLIO_MAX_LENGTH) : combined

  return {
    success: true,
    snapshot: {
      url: rootUrl,
      markdown,
      fetchedAt: rootResult.fetchedAt,
      contentLength: markdown.length,
      truncated,
      fetchedUrls,
      subpageFetchErrors,
    },
  }
}

export async function fetchPortfolioSnapshot(portfolioUrl: string): Promise<PortfolioFetchResult> {
  return fetchPageAndSubpages(portfolioUrl)
}

export async function fetchPersonalSiteSnapshot(siteUrl: string): Promise<PortfolioFetchResult> {
  // Same traversal — personal sites typically have fewer subpages, but if one exists with
  // "/about" or "/projects" subpages, we want those too.
  return fetchPageAndSubpages(siteUrl)
}
