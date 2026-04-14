import 'server-only'

import type { RawJobIntakeRecord } from '@/lib/jobs/contracts'
import { fetchWithTimeout } from '@/lib/jobs/fetch-with-timeout'
import {
  extractSalaryMetadata,
  extractXmlItems,
  extractXmlTagValue,
  normalizeWhitespace,
  stripHtml,
} from '@/lib/jobs/source-parsing'

import type { ImportedSourceBatch } from './greenhouse'

const authenticJobsSourceKey = 'authentic-jobs'
const authenticJobsSourceName = 'Authentic Jobs'
const authenticJobsSourceUrl = 'https://authenticjobs.com/?feed=job_feed'
const browserUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'

function asString(value: unknown) {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return ''
}

function buildSourceJobId(sourceUrl: string) {
  const match = sourceUrl.match(/\/job\/(\d+)\//)
  return asString(match?.[1] ?? '')
}

function normalizeAuthenticJobsItem(item: string, capturedAt: string): RawJobIntakeRecord | null {
  const sourceUrl = extractXmlTagValue(item, 'link')
  const sourceJobId = buildSourceJobId(sourceUrl)
  const titleRaw = normalizeWhitespace(extractXmlTagValue(item, 'title'))
  const companyNameRaw = normalizeWhitespace(extractXmlTagValue(item, 'job_listing:company'))

  if (!sourceUrl || !sourceJobId || !titleRaw || !companyNameRaw) {
    return null
  }

  const descriptionHtml =
    extractXmlTagValue(item, 'content:encoded') || extractXmlTagValue(item, 'description')
  const descriptionText = stripHtml(descriptionHtml)

  return {
    applicationUrl: sourceUrl,
    capturedAt,
    companyNameRaw,
    descriptionText,
    locationRaw: normalizeWhitespace(extractXmlTagValue(item, 'job_listing:location')) || undefined,
    metadata: {
      ...extractSalaryMetadata(descriptionText),
      job_type: normalizeWhitespace(extractXmlTagValue(item, 'job_listing:job_type')) || undefined,
      source_key: authenticJobsSourceKey,
    },
    postedAtRaw: extractXmlTagValue(item, 'pubDate') || undefined,
    sourceJobId,
    sourceKey: authenticJobsSourceKey,
    sourceKind: 'remote_board',
    sourceName: authenticJobsSourceName,
    sourceUrl,
    titleRaw,
  }
}

export async function fetchAuthenticJobs(): Promise<ImportedSourceBatch> {
  try {
    const response = await fetchWithTimeout(authenticJobsSourceUrl, {
      cache: 'no-store',
      headers: {
        Accept: 'application/rss+xml,application/xml,text/xml',
        'User-Agent': browserUserAgent,
      },
    })

    if (!response.ok) {
      return {
        issue: `Authentic Jobs returned ${response.status}.`,
        provider: 'authenticjobs',
        rawJobs: [],
        rowsSeen: 0,
        sourceKey: authenticJobsSourceKey,
        sourceKind: 'remote_board',
        sourceName: authenticJobsSourceName,
      }
    }

    const xml = await response.text()
    const items = extractXmlItems(xml)
    const capturedAt = new Date().toISOString()
    const rawJobs = items
      .map((item) => normalizeAuthenticJobsItem(item, capturedAt))
      .filter((item): item is RawJobIntakeRecord => item !== null)

    return {
      provider: 'authenticjobs',
      rawJobs,
      rowsSeen: items.length,
      sourceKey: authenticJobsSourceKey,
      sourceKind: 'remote_board',
      sourceName: authenticJobsSourceName,
    }
  } catch (error) {
    return {
      issue: error instanceof Error ? error.message : 'Authentic Jobs import failed.',
      provider: 'authenticjobs',
      rawJobs: [],
      rowsSeen: 0,
      sourceKey: authenticJobsSourceKey,
      sourceKind: 'remote_board',
      sourceName: authenticJobsSourceName,
    }
  }
}
