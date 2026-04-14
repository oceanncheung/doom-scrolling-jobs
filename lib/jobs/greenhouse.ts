import 'server-only'

import { fetchWithTimeout } from '@/lib/jobs/fetch-with-timeout'
import type { JobSourceKind, RawJobIntakeRecord } from '@/lib/jobs/contracts'
import type { CompanyWatchlistEntry } from '@/lib/jobs/source-registry'

interface GreenhouseLocation {
  name?: string
}

interface GreenhouseDepartment {
  name?: string
}

interface GreenhouseJobRecord {
  absolute_url?: string
  content?: string
  departments?: GreenhouseDepartment[]
  first_published?: string
  id?: number | string
  location?: GreenhouseLocation
  title?: string
  updated_at?: string
}

interface GreenhouseJobsPayload {
  jobs?: GreenhouseJobRecord[]
  meta?: {
    total?: number
  }
}

export interface ImportedSourceBatch {
  issue?: string
  provider: string
  rawJobs: RawJobIntakeRecord[]
  rowsSeen: number
  sourceKey: string
  sourceKind: JobSourceKind
  sourceName: string
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

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function asGreenhouseJobsPayload(value: unknown) {
  const record = asRecord(value)

  if (!record) {
    return {
      jobs: [],
      meta: {
        total: 0,
      },
    } satisfies GreenhouseJobsPayload
  }

  const metaRecord = asRecord(record.meta)

  return {
    jobs: Array.isArray(record.jobs) ? (record.jobs as GreenhouseJobRecord[]) : [],
    meta: metaRecord
      ? {
          total: typeof metaRecord.total === 'number' ? metaRecord.total : 0,
        }
      : {
          total: 0,
        },
  } satisfies GreenhouseJobsPayload
}

function normalizeGreenhouseRawJob(
  company: CompanyWatchlistEntry,
  item: GreenhouseJobRecord,
  capturedAt: string,
): RawJobIntakeRecord | null {
  const sourceJobId = asString(item.id)
  const title = asString(item.title)
  const sourceUrl = asString(item.absolute_url)

  if (!sourceJobId || !title || !sourceUrl) {
    return null
  }

  const location = asString(item.location?.name)
  const departments = Array.isArray(item.departments)
    ? item.departments.map((entry) => asString(entry.name)).filter(Boolean)
    : []

  return {
    applicationUrl: sourceUrl,
    capturedAt,
    companyNameRaw: company.companyName,
    descriptionText: asString(item.content),
    metadata: {
      ats_board_token: company.atsBoardToken ?? null,
      career_page_url: company.careerPageUrl,
      departments,
      provider: 'greenhouse',
      source_key: company.sourceKey,
      watchlist_company_slug: company.companySlug,
    },
    sourceJobId,
    sourceKey: company.sourceKey,
    sourceKind: 'ats_hosted_job_page',
    sourceName: company.sourceName,
    sourceUrl,
    titleRaw: title,
    ...(location ? { locationRaw: location } : {}),
    ...(asString(item.first_published) ? { postedAtRaw: asString(item.first_published) } : {}),
  }
}

export async function fetchGreenhouseCompanyJobs(company: CompanyWatchlistEntry): Promise<ImportedSourceBatch> {
  const boardToken = company.atsBoardToken

  if (!boardToken) {
    return {
      issue: 'Missing Greenhouse board token.',
      provider: 'greenhouse',
      rawJobs: [],
      rowsSeen: 0,
      sourceKey: company.sourceKey,
      sourceKind: 'ats_hosted_job_page',
      sourceName: company.sourceName,
    }
  }

  try {
    const response = await fetchWithTimeout(`https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      return {
        issue: `Greenhouse returned ${response.status} for ${company.companyName}.`,
        provider: 'greenhouse',
        rawJobs: [],
        rowsSeen: 0,
        sourceKey: company.sourceKey,
        sourceKind: 'ats_hosted_job_page',
        sourceName: company.sourceName,
      }
    }

    const payload = asGreenhouseJobsPayload(await response.json())
    const capturedAt = new Date().toISOString()
    const rawJobs = payload.jobs
      .map((item) => normalizeGreenhouseRawJob(company, item, capturedAt))
      .filter((item): item is RawJobIntakeRecord => item !== null)

    return {
      provider: 'greenhouse',
      rawJobs,
      rowsSeen: payload.meta?.total ?? rawJobs.length,
      sourceKey: company.sourceKey,
      sourceKind: 'ats_hosted_job_page',
      sourceName: company.sourceName,
    }
  } catch (error) {
    return {
      issue: error instanceof Error ? error.message : 'Greenhouse import failed.',
      provider: 'greenhouse',
      rawJobs: [],
      rowsSeen: 0,
      sourceKey: company.sourceKey,
      sourceKind: 'ats_hosted_job_page',
      sourceName: company.sourceName,
    }
  }
}
