import 'server-only'

import type { FetchMarkdownResult } from '@/lib/scraping/fetch-markdown'
import { fetchMarkdown } from '@/lib/scraping/fetch-markdown'

/**
 * Portfolio source — fetches the candidate's public portfolio URL as markdown so the
 * evidence-extraction pass has something structured-ish to work with. Uses the same
 * underlying `fetchMarkdown` as the job-description enrichment, configured slightly
 * differently: portfolios are often long case-study compilations, so we allow a larger
 * cap.
 *
 * Not a scraper per se — relies on the shared fetcher (Jina Reader). For portfolios built
 * on heavily-animated JS-only surfaces (Framer sites with no SSR fallback, for example),
 * we may get thin markdown back; the extraction pass will note low confidence.
 *
 * Personal sites share the same fetch path; we just tag the resulting source_kind
 * differently when persisting.
 */

const PORTFOLIO_MAX_LENGTH = 80_000 // Larger than JD cap — case study compilations run long.

export interface PortfolioSnapshot {
  url: string
  markdown: string
  fetchedAt: string
  contentLength: number
  truncated: boolean
}

export interface PortfolioSnapshotError {
  url: string
  error: string
  fetchedAt: string
}

export type PortfolioFetchResult =
  | { success: true; snapshot: PortfolioSnapshot }
  | { success: false; error: PortfolioSnapshotError }

function toPortfolioResult(result: FetchMarkdownResult): PortfolioFetchResult {
  if (result.success) {
    return {
      success: true,
      snapshot: {
        url: result.sourceUrl,
        markdown: result.markdown,
        fetchedAt: result.fetchedAt,
        contentLength: result.contentLength,
        truncated: result.truncated,
      },
    }
  }
  return {
    success: false,
    error: {
      url: result.sourceUrl,
      error: result.error,
      fetchedAt: result.fetchedAt,
    },
  }
}

export async function fetchPortfolioSnapshot(portfolioUrl: string): Promise<PortfolioFetchResult> {
  const result = await fetchMarkdown(portfolioUrl, { maxLength: PORTFOLIO_MAX_LENGTH })
  return toPortfolioResult(result)
}

export async function fetchPersonalSiteSnapshot(siteUrl: string): Promise<PortfolioFetchResult> {
  // Same underlying fetch; caller labels the source_kind as 'personal_site' when persisting.
  const result = await fetchMarkdown(siteUrl, { maxLength: PORTFOLIO_MAX_LENGTH })
  return toPortfolioResult(result)
}
