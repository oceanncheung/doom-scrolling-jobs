import 'server-only'

import type { RawJobIntakeRecord } from '@/lib/jobs/contracts'
import { fetchWithTimeout } from '@/lib/jobs/fetch-with-timeout'
import type { CompanyWatchlistEntry } from '@/lib/jobs/source-registry'

import type { ImportedSourceBatch } from './greenhouse'

interface AshbyLocationRecord {
  address?: {
    postalAddress?: {
      addressCountry?: string
    }
  }
  locationExternalName?: string | null
  locationId?: string
  locationName?: string
}

interface AshbyCompensationSummaryRecord {
  summary?: string
}

interface AshbyJobPostingRecord {
  compensationTierSummary?: AshbyCompensationSummaryRecord | null
  departmentName?: string | null
  employmentType?: string | null
  id?: string
  isListed?: boolean
  locationExternalName?: string | null
  locationName?: string | null
  publishedDate?: string | null
  secondaryLocations?: AshbyLocationRecord[]
  teamName?: string | null
  title?: string | null
  updatedAt?: string | null
  workplaceType?: string | null
}

interface AshbyAppData {
  jobBoard?: {
    jobPostings?: AshbyJobPostingRecord[]
  }
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function extractAshbyAppData(html: string) {
  const match = html.match(/window\.__appData\s*=\s*(\{[\s\S]*?\});/)

  if (!match?.[1]) {
    return null
  }

  try {
    return JSON.parse(match[1]) as AshbyAppData
  } catch {
    return null
  }
}

function buildAshbyJobUrl(careerPageUrl: string, jobPostingId: string) {
  return `${careerPageUrl.replace(/\/+$/, '')}/${jobPostingId}`
}

function normalizeAshbyRawJob(
  company: CompanyWatchlistEntry,
  item: AshbyJobPostingRecord,
  capturedAt: string,
): RawJobIntakeRecord | null {
  const sourceJobId = asString(item.id)
  const titleRaw = normalizeWhitespace(asString(item.title))

  if (!sourceJobId || !titleRaw || item.isListed === false) {
    return null
  }

  const sourceUrl = buildAshbyJobUrl(company.careerPageUrl, sourceJobId)
  const secondaryLocations = Array.isArray(item.secondaryLocations)
    ? item.secondaryLocations
        .map((location) =>
          normalizeWhitespace(
            [
              asString(location.locationName),
              asString(location.locationExternalName),
              asString(location.address?.postalAddress?.addressCountry),
            ]
              .filter(Boolean)
              .join(' '),
          ),
        )
        .filter(Boolean)
    : []
  const locationRaw = normalizeWhitespace(
    [
      asString(item.locationName),
      asString(item.locationExternalName),
      ...secondaryLocations,
    ]
      .filter(Boolean)
      .join(' | '),
  )
  const descriptionText = normalizeWhitespace(
    [
      titleRaw,
      asString(item.departmentName),
      asString(item.teamName),
      asString(item.locationName),
      asString(item.workplaceType),
      asString(item.employmentType),
      asString(item.compensationTierSummary?.summary),
    ]
      .filter(Boolean)
      .join('. '),
  )

  return {
    applicationUrl: sourceUrl,
    capturedAt,
    companyNameRaw: company.companyName,
    descriptionText,
    locationRaw: locationRaw || undefined,
    metadata: {
      career_page_url: company.careerPageUrl,
      compensation_summary: asString(item.compensationTierSummary?.summary) || undefined,
      department: asString(item.departmentName) || undefined,
      provider: 'ashby',
      secondary_locations: secondaryLocations,
      source_key: company.sourceKey,
      team: asString(item.teamName) || undefined,
      watchlist_company_slug: company.companySlug,
      workplace_type: asString(item.workplaceType) || undefined,
    },
    postedAtRaw: asString(item.publishedDate || item.updatedAt) || undefined,
    sourceJobId,
    sourceKey: company.sourceKey,
    sourceKind: 'ats_hosted_job_page',
    sourceName: company.sourceName,
    sourceUrl,
    titleRaw,
  }
}

export async function fetchAshbyCompanyJobs(company: CompanyWatchlistEntry): Promise<ImportedSourceBatch> {
  try {
    const response = await fetchWithTimeout(company.careerPageUrl, {
      cache: 'no-store',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
    })

    if (!response.ok) {
      return {
        issue: `Ashby returned ${response.status} for ${company.companyName}.`,
        provider: 'ashby',
        rawJobs: [],
        rowsSeen: 0,
        sourceKey: company.sourceKey,
        sourceKind: 'ats_hosted_job_page',
        sourceName: company.sourceName,
      }
    }

    const html = await response.text()
    const appData = extractAshbyAppData(html)
    const postings = appData?.jobBoard?.jobPostings ?? []
    const capturedAt = new Date().toISOString()
    const rawJobs = postings
      .map((item) => normalizeAshbyRawJob(company, item, capturedAt))
      .filter((item): item is RawJobIntakeRecord => item !== null)

    return {
      provider: 'ashby',
      rawJobs,
      rowsSeen: postings.length,
      sourceKey: company.sourceKey,
      sourceKind: 'ats_hosted_job_page',
      sourceName: company.sourceName,
    }
  } catch (error) {
    return {
      issue: error instanceof Error ? error.message : 'Ashby import failed.',
      provider: 'ashby',
      rawJobs: [],
      rowsSeen: 0,
      sourceKey: company.sourceKey,
      sourceKind: 'ats_hosted_job_page',
      sourceName: company.sourceName,
    }
  }
}
