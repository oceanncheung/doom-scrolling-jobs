import 'server-only'

import { defaultOperator } from '@/lib/config/runtime'
import type { JobSourceKind, SourceDiagnostics } from '@/lib/jobs/contracts'
import { createClient } from '@/lib/supabase/server'

export interface SourceRegistryEntry {
  baseUrl: string
  displayName: string
  metadata: Record<string, unknown>
  provider: string
  slug: string
  sourceKind: JobSourceKind
}

export interface CompanyWatchlistEntry {
  atsBoardToken?: string
  careerPageUrl: string
  companyName: string
  companySlug: string
  metadata: Record<string, unknown>
  priority: number
  sourceKey: string
  sourceName: string
  sourceRegistrySlug: string
}

const defaultSourceRegistry: SourceRegistryEntry[] = [
  {
    baseUrl: 'https://remoteok.com/api',
    displayName: 'Remote OK',
    metadata: {},
    provider: 'remoteok',
    slug: 'remote-ok',
    sourceKind: 'remote_board',
  },
  {
    baseUrl: 'https://boards-api.greenhouse.io/v1/boards',
    displayName: 'Greenhouse ATS',
    metadata: {
      canonicalHostPattern: 'job-boards.greenhouse.io',
    },
    provider: 'greenhouse',
    slug: 'greenhouse-ats',
    sourceKind: 'ats_hosted_job_page',
  },
]

const defaultCompanyWatchlist: CompanyWatchlistEntry[] = [
  {
    atsBoardToken: 'fluxon',
    careerPageUrl: 'https://job-boards.greenhouse.io/fluxon',
    companyName: 'Fluxon',
    companySlug: 'fluxon',
    metadata: {
      regionHint: 'Europe',
    },
    priority: 5,
    sourceKey: 'greenhouse:fluxon',
    sourceName: 'Fluxon Careers',
    sourceRegistrySlug: 'greenhouse-ats',
  },
  {
    atsBoardToken: 'metalab',
    careerPageUrl: 'https://job-boards.greenhouse.io/metalab',
    companyName: 'Metalab',
    companySlug: 'metalab',
    metadata: {
      regionHint: 'Americas',
    },
    priority: 10,
    sourceKey: 'greenhouse:metalab',
    sourceName: 'Metalab Careers',
    sourceRegistrySlug: 'greenhouse-ats',
  },
  {
    atsBoardToken: 'ninjatrader',
    careerPageUrl: 'https://job-boards.greenhouse.io/ninjatrader',
    companyName: 'NinjaTrader',
    companySlug: 'ninjatrader',
    metadata: {
      regionHint: 'United States',
    },
    priority: 20,
    sourceKey: 'greenhouse:ninjatrader',
    sourceName: 'NinjaTrader Careers',
    sourceRegistrySlug: 'greenhouse-ats',
  },
  {
    atsBoardToken: 'universalaudio',
    careerPageUrl: 'https://job-boards.greenhouse.io/universalaudio',
    companyName: 'Universal Audio',
    companySlug: 'universalaudio',
    metadata: {
      regionHint: 'United States',
    },
    priority: 30,
    sourceKey: 'greenhouse:universalaudio',
    sourceName: 'Universal Audio Careers',
    sourceRegistrySlug: 'greenhouse-ats',
  },
  {
    atsBoardToken: 'flohealth',
    careerPageUrl: 'https://job-boards.greenhouse.io/flohealth',
    companyName: 'Flo Health',
    companySlug: 'flohealth',
    metadata: {
      regionHint: 'Europe',
    },
    priority: 40,
    sourceKey: 'greenhouse:flohealth',
    sourceName: 'Flo Health Careers',
    sourceRegistrySlug: 'greenhouse-ats',
  },
  {
    atsBoardToken: 'appspace',
    careerPageUrl: 'https://job-boards.greenhouse.io/appspace',
    companyName: 'Appspace',
    companySlug: 'appspace',
    metadata: {
      regionHint: 'Europe',
    },
    priority: 50,
    sourceKey: 'greenhouse:appspace',
    sourceName: 'Appspace Careers',
    sourceRegistrySlug: 'greenhouse-ats',
  },
]

const seededDemoSourceNames = new Set(['Company Careers', 'Remote Design Board'])

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeRegistryRows(rows: unknown[]) {
  return rows
    .map((row) => {
      const record = asRecord(row)

      if (!record) {
        return null
      }

      const slug = asString(record.slug)
      const displayName = asString(record.display_name)
      const sourceKind = asString(record.source_kind) as JobSourceKind

      if (!slug || !displayName || !sourceKind) {
        return null
      }

      return {
        baseUrl: asString(record.base_url),
        displayName,
        metadata: asRecord(record.metadata) ?? {},
        provider: asString(record.provider),
        slug,
        sourceKind,
      } satisfies SourceRegistryEntry
    })
    .filter((row): row is SourceRegistryEntry => row !== null)
}

function normalizeWatchlistRows(rows: unknown[]) {
  const normalized: CompanyWatchlistEntry[] = []

  for (const row of rows) {
    const record = asRecord(row)

    if (!record) {
      continue
    }

    const companyName = asString(record.company_name)
    const companySlug = asString(record.company_slug)
    const sourceKey = asString(record.source_key)
    const sourceName = asString(record.source_name)
    const sourceRegistrySlug = asString(record.source_registry_slug)

    if (!companyName || !companySlug || !sourceKey || !sourceName || !sourceRegistrySlug) {
      continue
    }

    const atsBoardToken = asString(record.ats_board_token)
    const normalizedEntry: CompanyWatchlistEntry = {
      careerPageUrl: asString(record.career_page_url),
      companyName,
      companySlug,
      metadata: asRecord(record.metadata) ?? {},
      priority: asNumber(record.priority, 100),
      sourceKey,
      sourceName,
      sourceRegistrySlug,
      ...(atsBoardToken ? { atsBoardToken } : {}),
    }

    normalized.push(normalizedEntry)
  }

  return normalized
}

function mergeRegistryEntries(entries: SourceRegistryEntry[]) {
  const merged = new Map(defaultSourceRegistry.map((entry) => [entry.slug, entry] as const))

  for (const entry of entries) {
    merged.set(entry.slug, entry)
  }

  return [...merged.values()]
}

function mergeWatchlistEntries(entries: CompanyWatchlistEntry[]) {
  const merged = new Map(defaultCompanyWatchlist.map((entry) => [entry.sourceKey, entry] as const))

  for (const entry of entries) {
    merged.set(entry.sourceKey, entry)
  }

  return [...merged.values()].sort((left, right) => left.priority - right.priority)
}

export async function getSourceRegistry() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('source_registry')
      .select('slug, display_name, source_kind, provider, base_url, metadata, is_active')
      .eq('is_active', true)
      .order('display_name', { ascending: true })

    if (error || !data || data.length === 0) {
      return defaultSourceRegistry
    }

    const rows = normalizeRegistryRows(data).filter((row) => row.provider.length > 0)
    return rows.length > 0 ? mergeRegistryEntries(rows) : defaultSourceRegistry
  } catch {
    return defaultSourceRegistry
  }
}

export async function getCompanyWatchlist() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('company_watchlist')
      .select(
        `
          company_name,
          company_slug,
          career_page_url,
          ats_board_token,
          priority,
          metadata,
          source_key,
          source_name,
          source_registry:source_registry_id (
            slug
          )
        `,
      )
      .eq('user_id', defaultOperator.userId)
      .eq('is_active', true)
      .order('priority', { ascending: true })

    if (error || !data || data.length === 0) {
      return defaultCompanyWatchlist
    }

    const rows = normalizeWatchlistRows(
      data.map((row) => {
        const record = asRecord(row)
        const sourceRegistry = asRecord(record?.source_registry)

        return {
          ...record,
          source_registry_slug: asString(sourceRegistry?.slug),
        }
      }),
    )

    return rows.length > 0 ? mergeWatchlistEntries(rows) : defaultCompanyWatchlist
  } catch {
    return defaultCompanyWatchlist
  }
}

export function getSourceRegistryBySlug(registry: SourceRegistryEntry[]) {
  return new Map(registry.map((entry) => [entry.slug, entry] as const))
}

export function isImportedSourceName(sourceName: string) {
  return !seededDemoSourceNames.has(sourceName)
}

export function getImportedSourceNames(watchlist: CompanyWatchlistEntry[]) {
  return new Set(['Remote OK', ...watchlist.map((entry) => entry.sourceName)])
}

export async function saveSourceDiagnostics(diagnostics: SourceDiagnostics[]) {
  if (diagnostics.length === 0) {
    return
  }

  try {
    const supabase = createClient()
    await supabase.from('source_sync_diagnostics').upsert(
      diagnostics.map((entry) => ({
        issue: entry.issue ?? null,
        provider: entry.provider,
        rows_candidate: entry.rowsCandidate,
        rows_deduped: entry.rowsDeduped,
        rows_excluded: entry.rowsExcluded,
        rows_imported: entry.rowsImported,
        rows_seen: entry.rowsSeen,
        rows_stale: entry.rowsStale,
        source_key: entry.sourceKey,
        source_kind: entry.sourceKind,
        source_name: entry.sourceName,
        sync_metadata: {
          provider: entry.provider,
        },
        synced_at: new Date().toISOString(),
      })),
      {
        onConflict: 'source_key',
      },
    )
  } catch {
    // Diagnostics persistence is optional until the new migration is applied.
  }
}

export function summarizeSourceDiagnostics(diagnostics: SourceDiagnostics[]) {
  const successfulSources = diagnostics.filter((entry) => entry.rowsImported > 0)

  if (successfulSources.length === 0) {
    return ''
  }

  return successfulSources
    .map((entry) => `${entry.sourceName}: ${entry.rowsImported}`)
    .join(' · ')
}

export function sourcePreferenceWeight(sourceKind: JobSourceKind) {
  switch (sourceKind) {
    case 'company_career_page':
      return 3
    case 'ats_hosted_job_page':
      return 2
    default:
      return 1
  }
}

export function isRemoteBoardSource(entry: SourceRegistryEntry) {
  return entry.sourceKind === 'remote_board'
}

export function isActiveRegistryEntry(entry: SourceRegistryEntry | null | undefined) {
  return Boolean(entry && entry.slug && entry.displayName && entry.provider)
}

export function hasActiveWatchlist(entries: CompanyWatchlistEntry[]) {
  return entries.some((entry) => entry.priority >= 0)
}
