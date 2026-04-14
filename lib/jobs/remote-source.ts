import 'server-only'

import type { CompensationPeriod, RawJobIntakeRecord } from '@/lib/jobs/contracts'
import { fetchWithTimeout } from '@/lib/jobs/fetch-with-timeout'
import { normalizeWhitespace } from '@/lib/jobs/source-parsing'

import type { ImportedSourceBatch } from './greenhouse'

const remoteSourceKey = 'remote-source'
const remoteSourceName = 'Remote Source'
const remoteSourceListingsUrl = 'https://www.remotesource.com/remote-jobs/design'
const remoteSourceApiUrl = 'https://www.remotesource.com/api/jobs'
const browserUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
const remoteSourceJobBaseUrl = 'https://www.remotesource.com/jobs'
const remoteSourcePageSize = 100
const remoteSourceMaxPages = 4

interface RemoteSourceCompanyRecord {
  atsName?: string
  atsToken?: string
  description?: string
  industry?: string
  isRemoteFirst?: boolean
  name?: string
  size?: string
  websiteUrl?: string
}

interface RemoteSourceJobRecord {
  company?: RemoteSourceCompanyRecord
  experienceLevel?: string
  id?: number | string
  isInternship?: boolean
  isLeadership?: boolean
  jobCategory?: string
  jobType?: string
  location?: string
  postedAt?: string
  salaryCurrency?: string
  salaryMax?: number
  salaryMin?: number
  salaryPeriod?: string
  slug?: string
  title?: string
  uuid?: string
}

interface RemoteSourceJobsPayload {
  jobs?: RemoteSourceJobRecord[]
  totalCount?: number
}

function asString(value: unknown) {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return ''
}

function asOptionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function cleanSerializedDate(value: string) {
  return value.replace(/^\$D/, '').trim()
}

function normalizeJobsPayload(value: unknown): RemoteSourceJobsPayload {
  const record = asRecord(value)

  if (!record) {
    return {
      jobs: [],
      totalCount: 0,
    }
  }

  return {
    jobs: Array.isArray(record.jobs) ? (record.jobs as RemoteSourceJobRecord[]) : [],
    totalCount:
      typeof record.totalCount === 'number' && Number.isFinite(record.totalCount)
        ? record.totalCount
        : typeof record.totalCount === 'string'
          ? Number.parseInt(record.totalCount, 10) || 0
          : 0,
  }
}

function normalizeSalaryPeriod(value: string): CompensationPeriod {
  const normalized = value.toLowerCase()

  if (normalized.includes('hour')) {
    return 'hourly'
  }

  if (normalized.includes('month')) {
    return 'monthly'
  }

  if (normalized.includes('week')) {
    return 'weekly'
  }

  if (normalized.includes('day')) {
    return 'daily'
  }

  if (normalized.includes('contract')) {
    return 'contract'
  }

  if (normalized.includes('year')) {
    return 'annual'
  }

  return 'unknown'
}

function looksLikeRemoteSourceToken(value: string) {
  return value.length >= 8 && /^[A-Za-z0-9_-]+$/.test(value) && !/^\d+$/.test(value)
}

function extractRemoteSourceSlugFromUrl(value: string) {
  try {
    const url = new URL(value)

    if (!url.hostname.includes('remotesource.com')) {
      return ''
    }

    const pathParts = url.pathname.split('/').filter(Boolean)

    if (pathParts[0] !== 'jobs') {
      return ''
    }

    return pathParts[1] ?? ''
  } catch {
    return ''
  }
}

export function buildRemoteSourceJobUrl(options: {
  slug?: string
  sourceJobId?: string
  sourceUrl?: string
}) {
  const explicitSlug = asString(options.slug)
  const fallbackSlug = extractRemoteSourceSlugFromUrl(asString(options.sourceUrl))
  const slug = explicitSlug || fallbackSlug

  if (!slug) {
    return asString(options.sourceUrl)
  }

  const sourceJobId = asString(options.sourceJobId)

  if (looksLikeRemoteSourceToken(sourceJobId) && !slug.startsWith(`${sourceJobId}-`)) {
    return `${remoteSourceJobBaseUrl}/${sourceJobId}-${slug}`
  }

  return `${remoteSourceJobBaseUrl}/${slug}`
}

function extractInitialJobsPayload(html: string) {
  const startMarkers = ['initialJobs\\":[', 'initialJobs":[']
  const endMarkers = ['],\\"initialTotalCount', '],"initialTotalCount']

  for (const startMarker of startMarkers) {
    const start = html.indexOf(startMarker)

    if (start < 0) {
      continue
    }

    const arrayStart = start + startMarker.length - 1
    const endIndex = endMarkers
      .map((marker) => html.indexOf(marker, arrayStart))
      .filter((index) => index >= 0)
      .sort((left, right) => left - right)[0]

    if (typeof endIndex !== 'number') {
      continue
    }

    const rawArray = html.slice(arrayStart, endIndex + 1)
    const rowsSeenMatch = html
      .slice(endIndex + 1)
      .match(/initialTotalCount\\?":\\?"?([0-9]+)\\?"?/)

    try {
      return {
        jobs: JSON.parse(rawArray.replace(/\\"/g, '"')) as RemoteSourceJobRecord[],
        rowsSeen: Number.parseInt(rowsSeenMatch?.[1] ?? '', 10) || 0,
      }
    } catch {
      continue
    }
  }

  return {
    jobs: [] as RemoteSourceJobRecord[],
    rowsSeen: 0,
  }
}

function normalizeRemoteSourceJob(item: RemoteSourceJobRecord, capturedAt: string): RawJobIntakeRecord | null {
  const slug = asString(item.slug)
  const sourceJobId = asString(item.uuid) || asString(item.id) || slug
  const titleRaw = normalizeWhitespace(asString(item.title))
  const companyNameRaw = normalizeWhitespace(asString(item.company?.name))
  const sourceUrl = buildRemoteSourceJobUrl({
    slug,
    sourceJobId: asString(item.uuid) || asString(item.id),
  })

  if (!sourceJobId || !titleRaw || !companyNameRaw || !sourceUrl) {
    return null
  }

  const companyDescription = normalizeWhitespace(asString(item.company?.description))
  const jobCategory = normalizeWhitespace(asString(item.jobCategory))
  const jobType = normalizeWhitespace(asString(item.jobType))
  const experienceLevel = normalizeWhitespace(asString(item.experienceLevel))
  const locationRaw = normalizeWhitespace(asString(item.location))
  const descriptionText = normalizeWhitespace(
    [titleRaw, companyDescription, jobCategory, experienceLevel, locationRaw].filter(Boolean).join('. '),
  )

  return {
    applicationUrl: sourceUrl,
    capturedAt,
    companyNameRaw,
    compensationRaw:
      item.salaryMin || item.salaryMax
        ? [item.salaryMin ? String(item.salaryMin) : '', item.salaryMax ? String(item.salaryMax) : '']
            .filter(Boolean)
            .join('-')
        : undefined,
    descriptionText,
    locationRaw: locationRaw || undefined,
    metadata: {
      ats_name: asString(item.company?.atsName) || undefined,
      ats_token: asString(item.company?.atsToken) || undefined,
      category: jobCategory || undefined,
      company_industry: normalizeWhitespace(asString(item.company?.industry)) || undefined,
      company_remote_first: item.company?.isRemoteFirst ?? undefined,
      company_size: normalizeWhitespace(asString(item.company?.size)) || undefined,
      company_website_url: asString(item.company?.websiteUrl) || undefined,
      experience_level: experienceLevel || undefined,
      job_type: jobType || undefined,
      salary_currency: asString(item.salaryCurrency) || undefined,
      salary_max: asOptionalNumber(item.salaryMax),
      salary_min: asOptionalNumber(item.salaryMin),
      salary_period: normalizeSalaryPeriod(asString(item.salaryPeriod)),
      source_key: remoteSourceKey,
      tags: [jobCategory, experienceLevel].filter(Boolean),
    },
    postedAtRaw: cleanSerializedDate(asString(item.postedAt)) || undefined,
    sourceJobId,
    sourceKey: remoteSourceKey,
    sourceKind: 'remote_board',
    sourceName: remoteSourceName,
    sourceUrl,
    titleRaw,
  }
}

export async function fetchRemoteSourceJobs(): Promise<ImportedSourceBatch> {
  try {
    const initialQuery = new URLSearchParams({
      jobCategory: 'Design & UX',
      limit: String(remoteSourcePageSize),
      offset: '0',
      sortBy: 'recent',
    })
    const initialResponse = await fetchWithTimeout(`${remoteSourceApiUrl}?${initialQuery.toString()}`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'User-Agent': browserUserAgent,
      },
    })

    if (!initialResponse.ok) {
      throw new Error(`Remote Source returned ${initialResponse.status}.`)
    }

    const initialPayload = normalizeJobsPayload(await initialResponse.json())
    const totalCount = initialPayload.totalCount ?? initialPayload.jobs?.length ?? 0
    const pageCount = Math.min(
      remoteSourceMaxPages,
      Math.max(1, Math.ceil(totalCount / remoteSourcePageSize)),
    )
    const additionalPayloads = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, index) => {
        const offset = (index + 1) * remoteSourcePageSize
        const query = new URLSearchParams({
          jobCategory: 'Design & UX',
          limit: String(remoteSourcePageSize),
          offset: String(offset),
          sortBy: 'recent',
        })

        return fetchWithTimeout(`${remoteSourceApiUrl}?${query.toString()}`, {
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            'User-Agent': browserUserAgent,
          },
        }).then(async (response) => {
          if (!response.ok) {
            throw new Error(`Remote Source returned ${response.status} for offset ${offset}.`)
          }

          return normalizeJobsPayload(await response.json())
        })
      }),
    )

    const capturedAt = new Date().toISOString()
    const rawJobsById = new Map<string, RawJobIntakeRecord>()

    for (const payload of [initialPayload, ...additionalPayloads]) {
      for (const item of payload.jobs ?? []) {
        const normalized = normalizeRemoteSourceJob(item, capturedAt)

        if (!normalized) {
          continue
        }

        rawJobsById.set(normalized.sourceJobId ?? normalized.sourceUrl, normalized)
      }
    }

    const rawJobs = [...rawJobsById.values()]
    const rowsSeen = Math.max(totalCount, rawJobs.length)

    if (rowsSeen > 0 && rawJobs.length === 0) {
      return {
        issue: 'Remote Source category page loaded, but its job payload could not be normalized.',
        provider: 'remotesource',
        rawJobs: [],
        rowsSeen,
        sourceKey: remoteSourceKey,
        sourceKind: 'remote_board',
        sourceName: remoteSourceName,
      }
    }

    return {
      provider: 'remotesource',
      rawJobs,
      rowsSeen: Math.max(rowsSeen, rawJobs.length),
      sourceKey: remoteSourceKey,
      sourceKind: 'remote_board',
      sourceName: remoteSourceName,
    }
  } catch (error) {
    try {
      const response = await fetchWithTimeout(remoteSourceListingsUrl, {
        cache: 'no-store',
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': browserUserAgent,
        },
      })

      if (!response.ok) {
        throw new Error(`Remote Source returned ${response.status}.`)
      }

      const html = await response.text()
      const payload = extractInitialJobsPayload(html)
      const capturedAt = new Date().toISOString()
      const rawJobs = payload.jobs
        .map((item) => normalizeRemoteSourceJob(item, capturedAt))
        .filter((item): item is RawJobIntakeRecord => item !== null)

      return {
        issue: error instanceof Error ? error.message : 'Remote Source import fell back to HTML parsing.',
        provider: 'remotesource',
        rawJobs,
        rowsSeen: payload.rowsSeen || rawJobs.length,
        sourceKey: remoteSourceKey,
        sourceKind: 'remote_board',
        sourceName: remoteSourceName,
      }
    } catch (fallbackError) {
      return {
        issue:
          [error instanceof Error ? error.message : 'Remote Source import failed.', fallbackError instanceof Error ? fallbackError.message : 'Remote Source HTML fallback failed.']
            .filter(Boolean)
            .join(' · '),
        provider: 'remotesource',
        rawJobs: [],
        rowsSeen: 0,
        sourceKey: remoteSourceKey,
        sourceKind: 'remote_board',
        sourceName: remoteSourceName,
      }
    }
  }
}
