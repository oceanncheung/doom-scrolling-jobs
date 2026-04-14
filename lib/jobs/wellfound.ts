import 'server-only'

import { fetchWithTimeout } from '@/lib/jobs/fetch-with-timeout'
import type { ImportedSourceBatch } from './greenhouse'

const wellfoundSourceKey = 'wellfound'
const wellfoundSourceName = 'Wellfound'
const wellfoundRemoteDesignUrl = 'https://wellfound.com/role/r/designer?location=remote'
const browserUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'

export async function fetchWellfoundJobs(): Promise<ImportedSourceBatch> {
  try {
    const response = await fetchWithTimeout(wellfoundRemoteDesignUrl, {
      cache: 'no-store',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': browserUserAgent,
      },
    })

    if (!response.ok) {
      return {
        issue: `Wellfound returned ${response.status}.`,
        provider: 'wellfound',
        rawJobs: [],
        rowsSeen: 0,
        sourceKey: wellfoundSourceKey,
        sourceKind: 'remote_board',
        sourceName: wellfoundSourceName,
      }
    }

    const html = await response.text()

    if (/please enable js and disable any ad blocker/i.test(html)) {
      return {
        issue: 'Wellfound blocks automated server access with an anti-bot challenge.',
        provider: 'wellfound',
        rawJobs: [],
        rowsSeen: 0,
        sourceKey: wellfoundSourceKey,
        sourceKind: 'remote_board',
        sourceName: wellfoundSourceName,
      }
    }

    return {
      issue: 'Wellfound returned HTML but no stable server-side listing format has been verified yet.',
      provider: 'wellfound',
      rawJobs: [],
      rowsSeen: 0,
      sourceKey: wellfoundSourceKey,
      sourceKind: 'remote_board',
      sourceName: wellfoundSourceName,
    }
  } catch (error) {
    return {
      issue: error instanceof Error ? error.message : 'Wellfound import failed.',
      provider: 'wellfound',
      rawJobs: [],
      rowsSeen: 0,
      sourceKey: wellfoundSourceKey,
      sourceKind: 'remote_board',
      sourceName: wellfoundSourceName,
    }
  }
}
