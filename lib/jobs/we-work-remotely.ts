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

const weWorkRemotelySourceKey = 'we-work-remotely'
const weWorkRemotelySourceName = 'We Work Remotely'
const browserUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'

const weWorkRemotelyFeeds = [
  {
    categoryLabel: 'design',
    url: 'https://weworkremotely.com/categories/remote-design-jobs.rss',
  },
  {
    categoryLabel: 'sales-and-marketing',
    url: 'https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss',
  },
  {
    categoryLabel: 'product',
    url: 'https://weworkremotely.com/categories/remote-product-jobs.rss',
  },
] as const

function asString(value: unknown) {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return ''
}

function splitCompanyAndTitle(rawTitle: string) {
  const separatorIndex = rawTitle.indexOf(':')

  if (separatorIndex <= 0) {
    return {
      companyNameRaw: '',
      titleRaw: normalizeWhitespace(rawTitle),
    }
  }

  return {
    companyNameRaw: normalizeWhitespace(rawTitle.slice(0, separatorIndex)),
    titleRaw: normalizeWhitespace(rawTitle.slice(separatorIndex + 1)),
  }
}

function buildSourceJobId(sourceUrl: string) {
  const match = sourceUrl.match(/\/remote-jobs\/([^/?#]+)/i)
  return asString(match?.[1] ?? '')
}

function normalizeSkills(value: string) {
  return value
    .split(',')
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean)
}

function normalizeWeWorkRemotelyItem(
  item: string,
  capturedAt: string,
  feedCategory: string,
): RawJobIntakeRecord | null {
  const sourceUrl = extractXmlTagValue(item, 'link')
  const sourceJobId = buildSourceJobId(sourceUrl)
  const splitTitle = splitCompanyAndTitle(extractXmlTagValue(item, 'title'))
  const companyNameRaw = splitTitle.companyNameRaw
  const titleRaw = splitTitle.titleRaw

  if (!sourceUrl || !sourceJobId || !companyNameRaw || !titleRaw) {
    return null
  }

  const descriptionHtml = extractXmlTagValue(item, 'description')
  const descriptionText = stripHtml(descriptionHtml)
  const skills = normalizeSkills(extractXmlTagValue(item, 'skills'))
  const category = normalizeWhitespace(extractXmlTagValue(item, 'category'))
  const type = normalizeWhitespace(extractXmlTagValue(item, 'type'))
  const locationRaw = normalizeWhitespace(extractXmlTagValue(item, 'region'))

  return {
    applicationUrl: sourceUrl,
    capturedAt,
    companyNameRaw,
    descriptionText,
    locationRaw: locationRaw || undefined,
    metadata: {
      ...extractSalaryMetadata(descriptionText),
      category: category || undefined,
      feed_category: feedCategory,
      job_type: type || undefined,
      source_key: weWorkRemotelySourceKey,
      tags: skills,
    },
    postedAtRaw: extractXmlTagValue(item, 'pubDate') || undefined,
    sourceJobId,
    sourceKey: weWorkRemotelySourceKey,
    sourceKind: 'remote_board',
    sourceName: weWorkRemotelySourceName,
    sourceUrl,
    titleRaw,
  }
}

export async function fetchWeWorkRemotelyJobs(): Promise<ImportedSourceBatch> {
  try {
    const feedResults = await Promise.allSettled(
      weWorkRemotelyFeeds.map(async (feed) => {
        const response = await fetchWithTimeout(feed.url, {
          cache: 'no-store',
          headers: {
            Accept: 'application/rss+xml,application/xml,text/xml',
            'User-Agent': browserUserAgent,
          },
        })

        if (!response.ok) {
          throw new Error(`${feed.categoryLabel}: We Work Remotely returned ${response.status}.`)
        }

        const xml = await response.text()
        return {
          categoryLabel: feed.categoryLabel,
          items: extractXmlItems(xml),
        }
      }),
    )

    const issues = feedResults.flatMap((result) =>
      result.status === 'rejected' ? [result.reason instanceof Error ? result.reason.message : 'request failed'] : [],
    )
    const capturedAt = new Date().toISOString()
    const rawJobsById = new Map<string, RawJobIntakeRecord>()
    let rowsSeen = 0

    for (const result of feedResults) {
      if (result.status !== 'fulfilled') {
        continue
      }

      rowsSeen += result.value.items.length

      for (const item of result.value.items) {
        const normalized = normalizeWeWorkRemotelyItem(item, capturedAt, result.value.categoryLabel)

        if (!normalized) {
          continue
        }

        rawJobsById.set(normalized.sourceJobId ?? normalized.sourceUrl, normalized)
      }
    }

    if (rawJobsById.size === 0) {
      return {
        issue: issues.join(' · ') || undefined,
        provider: 'weworkremotely',
        rawJobs: [],
        rowsSeen,
        sourceKey: weWorkRemotelySourceKey,
        sourceKind: 'remote_board',
        sourceName: weWorkRemotelySourceName,
      }
    }

    return {
      issue: issues.length > 0 ? issues.join(' · ') : undefined,
      provider: 'weworkremotely',
      rawJobs: [...rawJobsById.values()],
      rowsSeen: Math.max(rowsSeen, rawJobsById.size),
      sourceKey: weWorkRemotelySourceKey,
      sourceKind: 'remote_board',
      sourceName: weWorkRemotelySourceName,
    }
  } catch (error) {
    return {
      issue: error instanceof Error ? error.message : 'We Work Remotely import failed.',
      provider: 'weworkremotely',
      rawJobs: [],
      rowsSeen: 0,
      sourceKey: weWorkRemotelySourceKey,
      sourceKind: 'remote_board',
      sourceName: weWorkRemotelySourceName,
    }
  }
}
