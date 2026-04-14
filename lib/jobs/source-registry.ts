import 'server-only'

import { getActiveOperatorContext } from '@/lib/data/operators'
import type { MatchingSourceMix } from '@/lib/domain/types'
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
    baseUrl: 'https://remotive.com/api/remote-jobs',
    displayName: 'Remotive',
    metadata: {
      category: 'design',
    },
    provider: 'remotive',
    slug: 'remotive',
    sourceKind: 'remote_board',
  },
  {
    baseUrl: 'https://wellfound.com/role/r/designer?location=remote',
    displayName: 'Wellfound',
    metadata: {
      role: 'designer',
    },
    provider: 'wellfound',
    slug: 'wellfound',
    sourceKind: 'remote_board',
  },
  {
    baseUrl: 'https://jobspresso.co/jm-ajax/get_listings/?filter_job_type%5B%5D=designer',
    displayName: 'Jobspresso',
    metadata: {
      category: 'design',
    },
    provider: 'jobspresso',
    slug: 'jobspresso',
    sourceKind: 'remote_board',
  },
  {
    baseUrl: 'https://weworkremotely.com/categories/remote-design-jobs.rss',
    displayName: 'We Work Remotely',
    metadata: {
      format: 'rss',
    },
    provider: 'weworkremotely',
    slug: 'we-work-remotely',
    sourceKind: 'remote_board',
  },
  {
    baseUrl: 'https://authenticjobs.com/?feed=job_feed',
    displayName: 'Authentic Jobs',
    metadata: {
      format: 'rss',
    },
    provider: 'authenticjobs',
    slug: 'authentic-jobs',
    sourceKind: 'remote_board',
  },
  {
    baseUrl: 'https://www.remotesource.com/remote-jobs/design',
    displayName: 'Remote Source',
    metadata: {
      category: 'design',
    },
    provider: 'remotesource',
    slug: 'remote-source',
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
  {
    baseUrl: 'https://api.lever.co/v0/postings',
    displayName: 'Lever ATS',
    metadata: {
      canonicalHostPattern: 'jobs.lever.co',
    },
    provider: 'lever',
    slug: 'lever-ats',
    sourceKind: 'ats_hosted_job_page',
  },
  {
    baseUrl: 'https://jobs.ashbyhq.com',
    displayName: 'Ashby ATS',
    metadata: {
      canonicalHostPattern: 'jobs.ashbyhq.com',
    },
    provider: 'ashby',
    slug: 'ashby-ats',
    sourceKind: 'ats_hosted_job_page',
  },
]

function createWatchlistEntry(options: {
  atsBoardToken?: string
  careerPageUrl: string
  companyName: string
  companySlug: string
  priority: number
  sourceKey: string
  sourceName: string
  sourceRegistrySlug: string
}) {
  return {
    atsBoardToken: options.atsBoardToken,
    careerPageUrl: options.careerPageUrl,
    companyName: options.companyName,
    companySlug: options.companySlug,
    metadata: {},
    priority: options.priority,
    sourceKey: options.sourceKey,
    sourceName: options.sourceName,
    sourceRegistrySlug: options.sourceRegistrySlug,
  } satisfies CompanyWatchlistEntry
}

const defaultCompanyWatchlist: CompanyWatchlistEntry[] = [
  createWatchlistEntry({
    atsBoardToken: 'life360',
    careerPageUrl: 'https://job-boards.greenhouse.io/life360',
    companyName: 'Life360',
    companySlug: 'life360',
    priority: 5,
    sourceKey: 'greenhouse:life360',
    sourceName: 'Life360 Careers',
    sourceRegistrySlug: 'greenhouse-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'mercury',
    careerPageUrl: 'https://job-boards.greenhouse.io/mercury',
    companyName: 'Mercury',
    companySlug: 'mercury',
    priority: 10,
    sourceKey: 'greenhouse:mercury',
    sourceName: 'Mercury Careers',
    sourceRegistrySlug: 'greenhouse-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'clickhouse',
    careerPageUrl: 'https://job-boards.greenhouse.io/clickhouse',
    companyName: 'ClickHouse',
    companySlug: 'clickhouse',
    priority: 15,
    sourceKey: 'greenhouse:clickhouse',
    sourceName: 'ClickHouse Careers',
    sourceRegistrySlug: 'greenhouse-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'metalab',
    careerPageUrl: 'https://job-boards.greenhouse.io/metalab',
    companyName: 'Metalab',
    companySlug: 'metalab',
    priority: 20,
    sourceKey: 'greenhouse:metalab',
    sourceName: 'Metalab Careers',
    sourceRegistrySlug: 'greenhouse-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'designmehair',
    careerPageUrl: 'https://job-boards.greenhouse.io/designmehair',
    companyName: 'DESIGNME',
    companySlug: 'designme',
    priority: 25,
    sourceKey: 'greenhouse:designmehair',
    sourceName: 'DESIGNME Careers',
    sourceRegistrySlug: 'greenhouse-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'navtechnologies',
    careerPageUrl: 'https://job-boards.greenhouse.io/navtechnologies',
    companyName: 'Nav',
    companySlug: 'nav',
    priority: 30,
    sourceKey: 'greenhouse:navtechnologies',
    sourceName: 'Nav Careers',
    sourceRegistrySlug: 'greenhouse-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'steercrm',
    careerPageUrl: 'https://job-boards.greenhouse.io/steercrm',
    companyName: 'Steer',
    companySlug: 'steer',
    priority: 35,
    sourceKey: 'greenhouse:steercrm',
    sourceName: 'Steer Careers',
    sourceRegistrySlug: 'greenhouse-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'figma',
    careerPageUrl: 'https://job-boards.greenhouse.io/figma',
    companyName: 'Figma',
    companySlug: 'figma',
    priority: 40,
    sourceKey: 'greenhouse:figma',
    sourceName: 'Figma Careers',
    sourceRegistrySlug: 'greenhouse-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'gusto',
    careerPageUrl: 'https://job-boards.greenhouse.io/gusto',
    companyName: 'Gusto',
    companySlug: 'gusto',
    priority: 45,
    sourceKey: 'greenhouse:gusto',
    sourceName: 'Gusto Careers',
    sourceRegistrySlug: 'greenhouse-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'fluxon',
    careerPageUrl: 'https://job-boards.greenhouse.io/fluxon',
    companyName: 'Fluxon',
    companySlug: 'fluxon',
    priority: 50,
    sourceKey: 'greenhouse:fluxon',
    sourceName: 'Fluxon Careers',
    sourceRegistrySlug: 'greenhouse-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'ninjatrader',
    careerPageUrl: 'https://job-boards.greenhouse.io/ninjatrader',
    companyName: 'NinjaTrader',
    companySlug: 'ninjatrader',
    priority: 55,
    sourceKey: 'greenhouse:ninjatrader',
    sourceName: 'NinjaTrader Careers',
    sourceRegistrySlug: 'greenhouse-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'universalaudio',
    careerPageUrl: 'https://job-boards.greenhouse.io/universalaudio',
    companyName: 'Universal Audio',
    companySlug: 'universalaudio',
    priority: 60,
    sourceKey: 'greenhouse:universalaudio',
    sourceName: 'Universal Audio Careers',
    sourceRegistrySlug: 'greenhouse-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'flohealth',
    careerPageUrl: 'https://job-boards.greenhouse.io/flohealth',
    companyName: 'Flo Health',
    companySlug: 'flohealth',
    priority: 65,
    sourceKey: 'greenhouse:flohealth',
    sourceName: 'Flo Health Careers',
    sourceRegistrySlug: 'greenhouse-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'appspace',
    careerPageUrl: 'https://job-boards.greenhouse.io/appspace',
    companyName: 'Appspace',
    companySlug: 'appspace',
    priority: 70,
    sourceKey: 'greenhouse:appspace',
    sourceName: 'Appspace Careers',
    sourceRegistrySlug: 'greenhouse-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'owner',
    careerPageUrl: 'https://jobs.ashbyhq.com/owner',
    companyName: 'Owner.com',
    companySlug: 'owner-com',
    priority: 75,
    sourceKey: 'ashby:owner',
    sourceName: 'Owner.com Careers',
    sourceRegistrySlug: 'ashby-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'revenuecat',
    careerPageUrl: 'https://jobs.ashbyhq.com/revenuecat',
    companyName: 'RevenueCat',
    companySlug: 'revenuecat',
    priority: 80,
    sourceKey: 'ashby:revenuecat',
    sourceName: 'RevenueCat Careers',
    sourceRegistrySlug: 'ashby-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'runway-ml',
    careerPageUrl: 'https://jobs.ashbyhq.com/runway-ml',
    companyName: 'Runway',
    companySlug: 'runway',
    priority: 85,
    sourceKey: 'ashby:runway-ml',
    sourceName: 'Runway Careers',
    sourceRegistrySlug: 'ashby-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'jump-app',
    careerPageUrl: 'https://jobs.ashbyhq.com/jump-app',
    companyName: 'Jump',
    companySlug: 'jump',
    priority: 90,
    sourceKey: 'ashby:jump-app',
    sourceName: 'Jump Careers',
    sourceRegistrySlug: 'ashby-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'dandy',
    careerPageUrl: 'https://jobs.ashbyhq.com/dandy',
    companyName: 'Dandy',
    companySlug: 'dandy',
    priority: 95,
    sourceKey: 'ashby:dandy',
    sourceName: 'Dandy Careers',
    sourceRegistrySlug: 'ashby-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'standardbots',
    careerPageUrl: 'https://jobs.ashbyhq.com/standardbots',
    companyName: 'Standard Bots',
    companySlug: 'standard-bots',
    priority: 100,
    sourceKey: 'ashby:standardbots',
    sourceName: 'Standard Bots Careers',
    sourceRegistrySlug: 'ashby-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'Improbable',
    careerPageUrl: 'https://jobs.ashbyhq.com/Improbable',
    companyName: 'Improbable',
    companySlug: 'improbable',
    priority: 105,
    sourceKey: 'ashby:improbable',
    sourceName: 'Improbable Careers',
    sourceRegistrySlug: 'ashby-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'firecrawl',
    careerPageUrl: 'https://jobs.ashbyhq.com/firecrawl',
    companyName: 'Firecrawl',
    companySlug: 'firecrawl',
    priority: 110,
    sourceKey: 'ashby:firecrawl',
    sourceName: 'Firecrawl Careers',
    sourceRegistrySlug: 'ashby-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'tavahealth',
    careerPageUrl: 'https://jobs.ashbyhq.com/tavahealth',
    companyName: 'Tava Health',
    companySlug: 'tava-health',
    priority: 115,
    sourceKey: 'ashby:tavahealth',
    sourceName: 'Tava Health Careers',
    sourceRegistrySlug: 'ashby-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'whatnot',
    careerPageUrl: 'https://jobs.ashbyhq.com/whatnot',
    companyName: 'Whatnot',
    companySlug: 'whatnot',
    priority: 120,
    sourceKey: 'ashby:whatnot',
    sourceName: 'Whatnot Careers',
    sourceRegistrySlug: 'ashby-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'directive',
    careerPageUrl: 'https://jobs.ashbyhq.com/directive',
    companyName: 'Directive',
    companySlug: 'directive',
    priority: 125,
    sourceKey: 'ashby:directive',
    sourceName: 'Directive Careers',
    sourceRegistrySlug: 'ashby-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'Huckleberrylabs',
    careerPageUrl: 'https://jobs.lever.co/Huckleberrylabs',
    companyName: 'Huckleberry Labs',
    companySlug: 'huckleberry-labs',
    priority: 130,
    sourceKey: 'lever:Huckleberrylabs',
    sourceName: 'Huckleberry Labs Careers',
    sourceRegistrySlug: 'lever-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'Flex',
    careerPageUrl: 'https://jobs.lever.co/Flex',
    companyName: 'Flex',
    companySlug: 'flex',
    priority: 135,
    sourceKey: 'lever:Flex',
    sourceName: 'Flex Careers',
    sourceRegistrySlug: 'lever-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'greenlight',
    careerPageUrl: 'https://jobs.lever.co/greenlight',
    companyName: 'Greenlight Financial Technology',
    companySlug: 'greenlight-financial-technology',
    priority: 140,
    sourceKey: 'lever:greenlight',
    sourceName: 'Greenlight Careers',
    sourceRegistrySlug: 'lever-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'vrchat',
    careerPageUrl: 'https://jobs.lever.co/vrchat',
    companyName: 'VRChat',
    companySlug: 'vrchat',
    priority: 145,
    sourceKey: 'lever:vrchat',
    sourceName: 'VRChat Careers',
    sourceRegistrySlug: 'lever-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'protective',
    careerPageUrl: 'https://jobs.lever.co/protective',
    companyName: 'Protective',
    companySlug: 'protective',
    priority: 150,
    sourceKey: 'lever:protective',
    sourceName: 'Protective Careers',
    sourceRegistrySlug: 'lever-ats',
  }),
  createWatchlistEntry({
    atsBoardToken: 'everlywell',
    careerPageUrl: 'https://jobs.lever.co/everlywell',
    companyName: 'Everlywell',
    companySlug: 'everlywell',
    priority: 155,
    sourceKey: 'lever:everlywell',
    sourceName: 'Everlywell Careers',
    sourceRegistrySlug: 'lever-ats',
  }),
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
    const operatorContext = await getActiveOperatorContext()

    if (!operatorContext) {
      return defaultCompanyWatchlist
    }

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
      .eq('operator_id', operatorContext.operator.id)
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

export function getImportedSourceNames(
  registry: SourceRegistryEntry[],
  watchlist: CompanyWatchlistEntry[],
) {
  return new Set([
    ...registry
      .filter((entry) => entry.sourceKind === 'remote_board' || entry.sourceKind === 'company_career_page')
      .map((entry) => entry.displayName),
    ...watchlist.map((entry) => entry.sourceName),
  ])
}

export function buildSourceDescriptorBySourceName(
  registry: SourceRegistryEntry[],
  watchlist: CompanyWatchlistEntry[],
) {
  const descriptors = new Map<
    string,
    Pick<SourceDiagnostics, 'provider' | 'sourceKey' | 'sourceKind' | 'sourceName'>
  >()

  for (const entry of registry) {
    descriptors.set(entry.displayName, {
      provider: entry.provider,
      sourceKey: entry.slug,
      sourceKind: entry.sourceKind,
      sourceName: entry.displayName,
    })
  }

  for (const entry of watchlist) {
    const registryEntry = registry.find((item) => item.slug === entry.sourceRegistrySlug)

    descriptors.set(entry.sourceName, {
      provider: registryEntry?.provider ?? entry.sourceRegistrySlug,
      sourceKey: entry.sourceKey,
      sourceKind: registryEntry?.sourceKind ?? 'company_career_page',
      sourceName: entry.sourceName,
    })
  }

  return descriptors
}

export async function getSourceDescriptorBySourceName() {
  const [registry, watchlist] = await Promise.all([getSourceRegistry(), getCompanyWatchlist()])

  return buildSourceDescriptorBySourceName(registry, watchlist)
}

export async function saveSourceDiagnostics(diagnostics: SourceDiagnostics[]) {
  if (diagnostics.length === 0) {
    return undefined
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
        rows_normalized: entry.rowsNormalized,
        rows_qualified: entry.rowsQualified,
        rows_seen: entry.rowsSeen,
        rows_stale: entry.rowsStale,
        rows_visible: entry.rowsVisible,
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
    return 'Source diagnostics could not be persisted.'
  }

  return undefined
}

export async function saveSourceQueueCoverage(
  qualifiedCounts: Map<string, number>,
  visibleCounts: Map<string, number>,
) {
  const sourceNames = new Set([...qualifiedCounts.keys(), ...visibleCounts.keys()])

  if (sourceNames.size === 0) {
    return undefined
  }

  try {
    const descriptorByName = await getSourceDescriptorBySourceName()
    const supabase = createClient()
    const sourceKeys = [...sourceNames]
      .map((sourceName) => descriptorByName.get(sourceName)?.sourceKey ?? '')
      .filter(Boolean)
    const { data: existingRows } = sourceKeys.length
      ? await supabase
          .from('source_sync_diagnostics')
          .select(
            'source_key, rows_seen, rows_candidate, rows_excluded, rows_deduped, rows_imported, rows_stale, rows_normalized',
          )
          .in('source_key', sourceKeys)
      : { data: [] }
    const existingBySourceKey = new Map(
      ((existingRows as Array<Record<string, unknown>> | null) ?? []).map((row) => [asString(row.source_key), row] as const),
    )
    await supabase.from('source_sync_diagnostics').upsert(
      [...sourceNames]
        .map((sourceName) => {
          const descriptor = descriptorByName.get(sourceName)

          if (!descriptor) {
            return null
          }

          const existing = existingBySourceKey.get(descriptor.sourceKey)

          return {
            provider: descriptor.provider,
            rows_candidate: asNumber(existing?.rows_candidate),
            rows_deduped: asNumber(existing?.rows_deduped),
            rows_excluded: asNumber(existing?.rows_excluded),
            rows_imported: asNumber(existing?.rows_imported),
            rows_normalized: asNumber(existing?.rows_normalized),
            rows_qualified: qualifiedCounts.get(sourceName) ?? 0,
            rows_seen: asNumber(existing?.rows_seen),
            rows_stale: asNumber(existing?.rows_stale),
            rows_visible: visibleCounts.get(sourceName) ?? 0,
            source_key: descriptor.sourceKey,
            source_kind: descriptor.sourceKind,
            source_name: descriptor.sourceName,
            sync_metadata: {
              provider: descriptor.provider,
            },
            synced_at: new Date().toISOString(),
          }
        })
        .filter((entry) => entry !== null),
      {
        ignoreDuplicates: false,
        onConflict: 'source_key',
      },
    )
  } catch {
    return 'Source queue coverage could not be persisted.'
  }

  return undefined
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

export function sourcePreferenceWeight(
  sourceKind: JobSourceKind,
  sourceMix: MatchingSourceMix = 'balanced',
) {
  const balancedWeights: Record<JobSourceKind, number> = {
    ats_hosted_job_page: 2,
    company_career_page: 3,
    remote_board: 1,
  }

  if (sourceMix === 'ats_first') {
    return {
      ats_hosted_job_page: 2.5,
      company_career_page: 3.5,
      remote_board: 1,
    }[sourceKind]
  }

  if (sourceMix === 'discovery') {
    return {
      ats_hosted_job_page: 1.5,
      company_career_page: 2,
      remote_board: 3,
    }[sourceKind]
  }

  return balancedWeights[sourceKind]
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
