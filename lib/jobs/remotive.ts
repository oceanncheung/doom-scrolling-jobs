import 'server-only'

import type { RawJobIntakeRecord } from '@/lib/jobs/contracts'
import { fetchWithTimeout } from '@/lib/jobs/fetch-with-timeout'

import type { ImportedSourceBatch } from './greenhouse'

const remotiveSourceKey = 'remotive'
const remotiveSourceName = 'Remotive'
const remotiveBaseUrl = 'https://remotive.com/api/remote-jobs'

const remotiveQueries = [
  {
    label: 'design category',
    params: new URLSearchParams({
      category: 'design',
      limit: '120',
    }),
  },
  {
    label: 'designer search',
    params: new URLSearchParams({
      limit: '120',
      search: 'designer',
    }),
  },
  {
    label: 'graphic designer search',
    params: new URLSearchParams({
      limit: '120',
      search: 'graphic designer',
    }),
  },
  {
    label: 'brand designer search',
    params: new URLSearchParams({
      limit: '120',
      search: 'brand designer',
    }),
  },
  {
    label: 'visual designer search',
    params: new URLSearchParams({
      limit: '120',
      search: 'visual designer',
    }),
  },
  {
    label: 'web designer search',
    params: new URLSearchParams({
      limit: '120',
      search: 'web designer',
    }),
  },
  {
    label: 'creative designer search',
    params: new URLSearchParams({
      limit: '120',
      search: 'creative designer',
    }),
  },
  {
    label: 'marketing designer search',
    params: new URLSearchParams({
      limit: '120',
      search: 'marketing designer',
    }),
  },
  {
    label: 'campaign designer search',
    params: new URLSearchParams({
      limit: '120',
      search: 'campaign designer',
    }),
  },
  {
    label: 'presentation designer search',
    params: new URLSearchParams({
      limit: '120',
      search: 'presentation designer',
    }),
  },
  {
    label: 'communication designer search',
    params: new URLSearchParams({
      limit: '120',
      search: 'communication designer',
    }),
  },
  {
    label: 'product designer search',
    params: new URLSearchParams({
      limit: '120',
      search: 'product designer',
    }),
  },
  {
    label: 'motion designer search',
    params: new URLSearchParams({
      limit: '120',
      search: 'motion designer',
    }),
  },
]

interface RemotiveJobRecord {
  candidate_required_location?: string
  category?: string
  company_name?: string
  description?: string
  id?: number | string
  job_type?: string
  publication_date?: string
  salary?: string
  tags?: string[]
  title?: string
  url?: string
}

interface RemotiveJobsPayload {
  jobs?: RemotiveJobRecord[]
  'job-count'?: number
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

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function parseSalaryAmount(raw: string) {
  const normalized = raw.replace(/,/g, '').trim()
  const match = normalized.match(/^(\d+(?:\.\d+)?)([kK])?$/)

  if (!match) {
    return undefined
  }

  const numeric = Number.parseFloat(match[1] ?? '')

  if (!Number.isFinite(numeric)) {
    return undefined
  }

  return match[2] ? numeric * 1000 : numeric
}

function detectSalaryPeriod(raw: string) {
  const lowered = raw.toLowerCase()

  if (lowered.includes('per month') || lowered.includes('monthly') || lowered.includes('/month') || lowered.includes('/mo')) {
    return 'monthly' as const
  }

  if (lowered.includes('per hour') || lowered.includes('hourly') || lowered.includes('/hour') || lowered.includes('/hr')) {
    return 'hourly' as const
  }

  if (lowered.includes('per week') || lowered.includes('weekly') || lowered.includes('/week') || lowered.includes('/wk')) {
    return 'weekly' as const
  }

  if (lowered.includes('per day') || lowered.includes('daily') || lowered.includes('/day')) {
    return 'daily' as const
  }

  return 'annual' as const
}

function parseSalaryRange(raw: string) {
  const matches = [...raw.matchAll(/(\d[\d,.]*(?:\.\d+)?)\s*([kK])?/g)]
    .map((match) => parseSalaryAmount(`${match[1] ?? ''}${match[2] ?? ''}`))
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  if (matches.length === 0) {
    return {}
  }

  const [first, second] = matches
  const ordered = [first, second ?? first].sort((left, right) => left - right)
  const salaryPeriod = detectSalaryPeriod(raw)
  const min = Math.round(ordered[0] ?? 0)
  const max = Math.round(ordered[1] ?? ordered[0] ?? 0)

  if (salaryPeriod === 'annual' && max > 0 && max < 10_000) {
    return {}
  }

  return {
    salary_max: max,
    salary_min: min,
    salary_period: salaryPeriod,
  }
}

function normalizePayload(value: unknown): RemotiveJobsPayload {
  const record = asRecord(value)

  if (!record) {
    return {
      jobs: [],
      'job-count': 0,
    }
  }

  return {
    jobs: Array.isArray(record.jobs) ? (record.jobs as RemotiveJobRecord[]) : [],
    'job-count': typeof record['job-count'] === 'number' ? record['job-count'] : 0,
  }
}

function normalizeRemotiveRawJob(item: RemotiveJobRecord, capturedAt: string): RawJobIntakeRecord | null {
  const sourceJobId = asString(item.id)
  const sourceUrl = asString(item.url)
  const titleRaw = asString(item.title)
  const companyNameRaw = asString(item.company_name)

  if (!sourceJobId || !sourceUrl || !titleRaw || !companyNameRaw) {
    return null
  }

  const salaryRaw = asString(item.salary)

  return {
    applicationUrl: sourceUrl,
    capturedAt,
    companyNameRaw,
    compensationRaw: salaryRaw || undefined,
    descriptionText: asString(item.description),
    locationRaw: asString(item.candidate_required_location) || undefined,
    metadata: {
      ...parseSalaryRange(salaryRaw),
      category: asString(item.category) || undefined,
      job_type: asString(item.job_type) || undefined,
      source_key: remotiveSourceKey,
      tags: asStringArray(item.tags),
    },
    postedAtRaw: asString(item.publication_date) || undefined,
    sourceJobId,
    sourceKey: remotiveSourceKey,
    sourceKind: 'remote_board',
    sourceName: remotiveSourceName,
    sourceUrl,
    titleRaw,
  }
}

async function fetchRemotivePayload(query: URLSearchParams) {
  const response = await fetchWithTimeout(`${remotiveBaseUrl}?${query.toString()}`, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Remotive returned ${response.status}.`)
  }

  return normalizePayload(await response.json())
}

export async function fetchRemotiveJobs(): Promise<ImportedSourceBatch> {
  try {
    const payloads = await Promise.allSettled(remotiveQueries.map((query) => fetchRemotivePayload(query.params)))
    const issues = payloads
      .flatMap((result, index) =>
        result.status === 'rejected'
          ? [`${remotiveQueries[index]?.label ?? 'query'}: ${result.reason instanceof Error ? result.reason.message : 'request failed'}`]
          : [],
      )
    const capturedAt = new Date().toISOString()
    const rawJobsById = new Map<string, RawJobIntakeRecord>()
    let rowsSeen = 0

    for (const result of payloads) {
      if (result.status !== 'fulfilled') {
        continue
      }

      rowsSeen += result.value['job-count'] ?? result.value.jobs?.length ?? 0

      for (const item of result.value.jobs ?? []) {
        const normalized = normalizeRemotiveRawJob(item, capturedAt)

        if (!normalized) {
          continue
        }

        rawJobsById.set(normalized.sourceJobId ?? normalized.sourceUrl, normalized)
      }
    }

    if (rawJobsById.size === 0) {
      return {
        issue: issues.join(' · ') || undefined,
        provider: 'remotive',
        rawJobs: [],
        rowsSeen,
        sourceKey: remotiveSourceKey,
        sourceKind: 'remote_board',
        sourceName: remotiveSourceName,
      }
    }

    return {
      issue: issues.length > 0 ? issues.join(' · ') : undefined,
      provider: 'remotive',
      rawJobs: [...rawJobsById.values()],
      rowsSeen: Math.max(rowsSeen, rawJobsById.size),
      sourceKey: remotiveSourceKey,
      sourceKind: 'remote_board',
      sourceName: remotiveSourceName,
    }
  } catch (error) {
    return {
      issue: error instanceof Error ? error.message : 'Remotive import failed.',
      provider: 'remotive',
      rawJobs: [],
      rowsSeen: 0,
      sourceKey: remotiveSourceKey,
      sourceKind: 'remote_board',
      sourceName: remotiveSourceName,
    }
  }
}
