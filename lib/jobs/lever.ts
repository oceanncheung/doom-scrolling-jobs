import 'server-only'

import type { RawJobIntakeRecord } from '@/lib/jobs/contracts'
import { fetchWithTimeout } from '@/lib/jobs/fetch-with-timeout'
import type { CompanyWatchlistEntry } from '@/lib/jobs/source-registry'

import type { ImportedSourceBatch } from './greenhouse'

interface LeverJobRecord {
  additionalPlain?: string
  applyUrl?: string
  categories?: {
    allLocations?: string[]
    commitment?: string
    location?: string
    team?: string
  }
  createdAt?: number
  descriptionBodyPlain?: string
  descriptionPlain?: string
  hostedUrl?: string
  id?: string
  openingPlain?: string
  text?: string
  workplaceType?: string
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeLeverRawJob(
  company: CompanyWatchlistEntry,
  item: LeverJobRecord,
  capturedAt: string,
): RawJobIntakeRecord | null {
  const sourceJobId = asString(item.id)
  const titleRaw = normalizeWhitespace(asString(item.text))
  const sourceUrl = asString(item.hostedUrl || item.applyUrl)

  if (!sourceJobId || !titleRaw || !sourceUrl) {
    return null
  }

  const locationValues = asStringArray(item.categories?.allLocations)
  const locationRaw = normalizeWhitespace(
    [asString(item.categories?.location), ...locationValues].filter(Boolean).join(' | '),
  )
  const descriptionText = normalizeWhitespace(
    [
      asString(item.openingPlain),
      asString(item.descriptionPlain),
      asString(item.descriptionBodyPlain),
      asString(item.additionalPlain),
    ]
      .filter(Boolean)
      .join('\n\n'),
  )
  const createdAt =
    typeof item.createdAt === 'number' && Number.isFinite(item.createdAt)
      ? new Date(item.createdAt).toISOString()
      : undefined

  return {
    applicationUrl: asString(item.applyUrl) || sourceUrl,
    capturedAt,
    companyNameRaw: company.companyName,
    descriptionText,
    locationRaw: locationRaw || undefined,
    metadata: {
      all_locations: locationValues,
      career_page_url: company.careerPageUrl,
      commitment: asString(item.categories?.commitment) || undefined,
      provider: 'lever',
      source_key: company.sourceKey,
      team: asString(item.categories?.team) || undefined,
      watchlist_company_slug: company.companySlug,
      workplace_type: asString(item.workplaceType) || undefined,
    },
    postedAtRaw: createdAt,
    sourceJobId,
    sourceKey: company.sourceKey,
    sourceKind: 'ats_hosted_job_page',
    sourceName: company.sourceName,
    sourceUrl,
    titleRaw,
  }
}

export async function fetchLeverCompanyJobs(company: CompanyWatchlistEntry): Promise<ImportedSourceBatch> {
  const boardToken = company.atsBoardToken

  if (!boardToken) {
    return {
      issue: 'Missing Lever board token.',
      provider: 'lever',
      rawJobs: [],
      rowsSeen: 0,
      sourceKey: company.sourceKey,
      sourceKind: 'ats_hosted_job_page',
      sourceName: company.sourceName,
    }
  }

  try {
    const response = await fetchWithTimeout(`https://api.lever.co/v0/postings/${boardToken}?mode=json`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      return {
        issue: `Lever returned ${response.status} for ${company.companyName}.`,
        provider: 'lever',
        rawJobs: [],
        rowsSeen: 0,
        sourceKey: company.sourceKey,
        sourceKind: 'ats_hosted_job_page',
        sourceName: company.sourceName,
      }
    }

    const payload = (await response.json()) as LeverJobRecord[]
    const capturedAt = new Date().toISOString()
    const rawJobs = payload
      .map((item) => normalizeLeverRawJob(company, item, capturedAt))
      .filter((item): item is RawJobIntakeRecord => item !== null)

    return {
      provider: 'lever',
      rawJobs,
      rowsSeen: payload.length,
      sourceKey: company.sourceKey,
      sourceKind: 'ats_hosted_job_page',
      sourceName: company.sourceName,
    }
  } catch (error) {
    return {
      issue: error instanceof Error ? error.message : 'Lever import failed.',
      provider: 'lever',
      rawJobs: [],
      rowsSeen: 0,
      sourceKey: company.sourceKey,
      sourceKind: 'ats_hosted_job_page',
      sourceName: company.sourceName,
    }
  }
}
