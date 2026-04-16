import assert from 'node:assert/strict'

import type { RawJobIntakeRecord } from '@/lib/jobs/contracts'
import type { ImportedSourceBatch } from '@/lib/jobs/greenhouse'
import {
  prepareImportedJobsForPersistence,
  primaryImportedSourceName,
} from '@/lib/jobs/real-feed'
import {
  buildSourceDescriptorBySourceName,
  getImportedSourceNames,
  getSourceRegistryBySlug,
  sourcePreferenceWeight,
  type CompanyWatchlistEntry,
  type SourceRegistryEntry,
} from '@/lib/jobs/source-registry'
import { fetchSmoke, getSmokeBaseUrl } from './smoke-helpers.mts'

interface CheckResult {
  details?: Record<string, unknown>
  name: string
  passed: boolean
  summary: string
}

function createRegistryFixtures() {
  const registry: SourceRegistryEntry[] = [
    {
      baseUrl: 'https://remoteok.com/api',
      displayName: primaryImportedSourceName,
      metadata: {},
      provider: 'remoteok',
      slug: 'remote-ok',
      sourceKind: 'remote_board',
    },
    {
      baseUrl: 'https://boards-api.greenhouse.io/v1/boards',
      displayName: 'Greenhouse ATS',
      metadata: {},
      provider: 'greenhouse',
      slug: 'greenhouse-ats',
      sourceKind: 'ats_hosted_job_page',
    },
    {
      baseUrl: 'https://careers.curated-example.com',
      displayName: 'Curated Company Jobs',
      metadata: {},
      provider: 'custom',
      slug: 'curated-company',
      sourceKind: 'company_career_page',
    },
  ]

  const watchlist: CompanyWatchlistEntry[] = [
    {
      atsBoardToken: 'designco',
      careerPageUrl: 'https://job-boards.greenhouse.io/designco',
      companyName: 'DesignCo',
      companySlug: 'designco',
      metadata: {},
      priority: 10,
      sourceKey: 'greenhouse:designco',
      sourceName: 'DesignCo Careers',
      sourceRegistrySlug: 'greenhouse-ats',
    },
  ]

  return {
    registry,
    watchlist,
  }
}

function createRawJob(options: {
  applicationUrl?: string
  companyNameRaw: string
  compensationRaw?: string
  descriptionText: string
  locationRaw?: string
  metadata?: Record<string, unknown>
  postedAtRaw?: string
  sourceJobId: string
  sourceKey: string
  sourceKind: ImportedSourceBatch['sourceKind']
  sourceName: string
  sourceUrl: string
  titleRaw: string
}) {
  return {
    applicationUrl: options.applicationUrl,
    capturedAt: '2026-04-15T00:00:00.000Z',
    companyNameRaw: options.companyNameRaw,
    compensationRaw: options.compensationRaw,
    descriptionText: options.descriptionText,
    locationRaw: options.locationRaw,
    metadata: options.metadata,
    postedAtRaw: options.postedAtRaw,
    sourceJobId: options.sourceJobId,
    sourceKey: options.sourceKey,
    sourceKind: options.sourceKind,
    sourceName: options.sourceName,
    sourceUrl: options.sourceUrl,
    titleRaw: options.titleRaw,
  } satisfies RawJobIntakeRecord
}

function createImportedSourceBatches() {
  const remoteBatch: ImportedSourceBatch = {
    provider: 'remoteok',
    rawJobs: [
      createRawJob({
        applicationUrl: 'https://remoteok.example/apply/designco-remote',
        companyNameRaw: 'DesignCo',
        descriptionText:
          'Remote brand design role for campaign systems, visual storytelling, and Figma collaboration.',
        locationRaw: 'Remote',
        metadata: {
          salary_currency: 'USD',
          salary_max: 180000,
          salary_min: 160000,
          salary_period: 'annual',
          tags: ['brand design', 'figma'],
        },
        postedAtRaw: '2026-04-10T12:00:00.000Z',
        sourceJobId: 'remote-designco-1',
        sourceKey: 'remote-ok',
        sourceKind: 'remote_board',
        sourceName: primaryImportedSourceName,
        sourceUrl: 'https://remoteok.example/jobs/designco-remote',
        titleRaw: 'Senior Brand Designer (Remote)',
      }),
      createRawJob({
        applicationUrl: 'https://remoteok.example/apply/engineer-1',
        companyNameRaw: 'InfraCo',
        descriptionText: 'Remote backend engineering role for distributed systems.',
        locationRaw: 'Remote',
        metadata: {
          tags: ['typescript'],
        },
        sourceJobId: 'remote-engineer-1',
        sourceKey: 'remote-ok',
        sourceKind: 'remote_board',
        sourceName: primaryImportedSourceName,
        sourceUrl: 'https://remoteok.example/jobs/engineer-1',
        titleRaw: 'Software Engineer (Remote)',
      }),
    ],
    rowsSeen: 2,
    sourceKey: 'remote-ok',
    sourceKind: 'remote_board',
    sourceName: primaryImportedSourceName,
  }

  const atsBatch: ImportedSourceBatch = {
    provider: 'greenhouse',
    rawJobs: [
      createRawJob({
        applicationUrl: 'https://job-boards.greenhouse.io/designco/jobs/designco-1/apply',
        companyNameRaw: 'DesignCo',
        descriptionText:
          'Remote brand design role for campaign systems, visual storytelling, and Figma collaboration.',
        locationRaw: 'Remote',
        metadata: {
          departments: ['Brand'],
          salary_currency: 'USD',
          salary_max: 185000,
          salary_min: 165000,
          salary_period: 'annual',
          tags: ['brand design', 'figma'],
        },
        postedAtRaw: '2026-04-12T12:00:00.000Z',
        sourceJobId: 'designco-1',
        sourceKey: 'greenhouse:designco',
        sourceKind: 'ats_hosted_job_page',
        sourceName: 'DesignCo Careers',
        sourceUrl: 'https://job-boards.greenhouse.io/designco/jobs/designco-1',
        titleRaw: 'Senior Brand Designer (Remote)',
      }),
      createRawJob({
        applicationUrl: 'https://job-boards.greenhouse.io/designco/jobs/designco-onsite/apply',
        companyNameRaw: 'DesignCo',
        descriptionText: 'Onsite visual design role for studio production.',
        locationRaw: 'San Francisco, CA',
        metadata: {
          departments: ['Brand'],
        },
        sourceJobId: 'designco-onsite',
        sourceKey: 'greenhouse:designco',
        sourceKind: 'ats_hosted_job_page',
        sourceName: 'DesignCo Careers',
        sourceUrl: 'https://job-boards.greenhouse.io/designco/jobs/designco-onsite',
        titleRaw: 'Visual Designer (Onsite)',
      }),
    ],
    rowsSeen: 2,
    sourceKey: 'greenhouse:designco',
    sourceKind: 'ats_hosted_job_page',
    sourceName: 'DesignCo Careers',
  }

  return [remoteBatch, atsBatch]
}

async function assertImportRouteContract() {
  const baseUrl = getSmokeBaseUrl()
  const getResponse = await fetchSmoke('/api/jobs/import')
  const getPayload = (await getResponse.json()) as Record<string, unknown>

  assert.equal(getResponse.status, 200, 'Import route GET should respond successfully through the managed app server.')
  assert.equal(getPayload.primarySource, primaryImportedSourceName, 'Import route GET should report the primary imported source.')
  assert.equal(getPayload.source, 'source-expansion-v1', 'Import route GET should expose the import contract version.')
  assert.equal(
    typeof getPayload.envReady,
    'boolean',
    'Import route GET should report whether the server environment is ready.',
  )
  assert(
    getPayload.status === 'ready' || getPayload.status === 'missing-env',
    'Import route GET should return a recognized readiness status.',
  )
  assert.equal(typeof getPayload.timestamp, 'string', 'Import route GET should report a response timestamp.')

  return {
    baseUrl,
    envReady: getPayload.envReady,
    status: getPayload.status,
  }
}

function assertSourceRegistryContract() {
  const { registry, watchlist } = createRegistryFixtures()
  const registryBySlug = getSourceRegistryBySlug(registry)
  const importedSourceNames = [...getImportedSourceNames(registry, watchlist)].sort()
  const descriptors = buildSourceDescriptorBySourceName(registry, watchlist)
  const designCoDescriptor = descriptors.get('DesignCo Careers')

  assert.equal(registryBySlug.get('greenhouse-ats')?.provider, 'greenhouse', 'Registry lookups should resolve ATS providers by slug.')
  assert(importedSourceNames.includes(primaryImportedSourceName), 'Remote board sources should contribute imported source names.')
  assert(importedSourceNames.includes('Curated Company Jobs'), 'Company career page sources should contribute imported source names.')
  assert(importedSourceNames.includes('DesignCo Careers'), 'Watchlist source names should contribute imported source names.')
  assert(!importedSourceNames.includes('Greenhouse ATS'), 'ATS registry labels should not appear as direct imported source names.')
  assert.deepEqual(
    designCoDescriptor,
    {
      provider: 'greenhouse',
      sourceKey: 'greenhouse:designco',
      sourceKind: 'ats_hosted_job_page',
      sourceName: 'DesignCo Careers',
    },
    'Watchlist descriptors should inherit ATS provider and source-kind metadata from the registry.',
  )
  assert(
    sourcePreferenceWeight('ats_hosted_job_page', 'balanced') >
      sourcePreferenceWeight('remote_board', 'balanced'),
    'Balanced source preference should favor ATS-hosted jobs over remote-board duplicates.',
  )

  return {
    descriptor: designCoDescriptor,
    importedSourceNames,
  }
}

function assertImportNormalizationAndAcceptance() {
  const prepared = prepareImportedJobsForPersistence(createImportedSourceBatches())
  const keptJob = prepared.normalizedJobs[0]
  const remoteDiagnostics = prepared.diagnosticsBySourceKey.get('remote-ok')
  const atsDiagnostics = prepared.diagnosticsBySourceKey.get('greenhouse:designco')

  assert.equal(prepared.normalizedJobs.length, 1, 'Deterministic import batches should dedupe to one accepted job.')
  assert(keptJob, 'One imported job should survive normalization and deduping.')
  assert.equal(keptJob.sourceName, 'DesignCo Careers', 'The ATS duplicate should win over the remote-board copy.')
  assert.equal(keptJob.sourceKind, 'ats_hosted_job_page', 'The kept imported job should preserve its ATS source kind.')
  assert.equal(keptJob.title, 'Senior Brand Designer', 'Imported titles should be cleaned before persistence.')
  assert.equal(keptJob.remoteType, 'remote', 'Accepted imported jobs should preserve remote classification.')
  assert.equal(keptJob.salaryCurrency, 'USD', 'Salary metadata should survive normalization.')
  assert.equal(remoteDiagnostics?.rowsExcluded, 1, 'Remote-board diagnostics should record excluded non-design rows.')
  assert.equal(remoteDiagnostics?.rowsDeduped, 1, 'Remote-board diagnostics should record the duplicate removed by dedupe.')
  assert.equal(remoteDiagnostics?.rowsImported, 0, 'The losing duplicate source should not report imported rows.')
  assert.equal(atsDiagnostics?.rowsExcluded, 1, 'ATS diagnostics should record excluded onsite rows.')
  assert.equal(atsDiagnostics?.rowsImported, 1, 'The winning ATS source should report one imported row.')
  assert.deepEqual(
    prepared.currentSourceJobIdsBySourceName.get('DesignCo Careers'),
    ['designco-1'],
    'Accepted imported jobs should retain source-job identities for stale marking.',
  )

  return {
    acceptedJob: {
      sourceKind: keptJob.sourceKind,
      sourceName: keptJob.sourceName,
      title: keptJob.title,
    },
    diagnostics: {
      ats: atsDiagnostics,
      remoteBoard: remoteDiagnostics,
    },
  }
}

async function main() {
  const results: CheckResult[] = []

  const checks = [
    {
      name: 'import-route-contract',
      run: assertImportRouteContract,
      summary:
        'The import route exposes a stable deterministic GET contract through the managed app server without triggering live sourcing.',
    },
    {
      name: 'source-registry-resolution',
      run: async () => assertSourceRegistryContract(),
      summary:
        'Imported source names and source descriptors resolve deterministically from registry and watchlist fixtures.',
    },
    {
      name: 'import-normalization-dedupe',
      run: async () => assertImportNormalizationAndAcceptance(),
      summary:
        'Imported job batches normalize, filter, and dedupe deterministically, keeping the preferred ATS record for persistence.',
    },
  ] as const

  for (const check of checks) {
    try {
      const details = await check.run()
      results.push({
        details,
        name: check.name,
        passed: true,
        summary: check.summary,
      })
    } catch (error) {
      results.push({
        details: {
          message: error instanceof Error ? error.message : String(error),
        },
        name: check.name,
        passed: false,
        summary: check.summary,
      })
    }
  }

  return {
    passed: results.every((result) => result.passed),
    results,
  }
}

try {
  const output = await main()
  console.log(JSON.stringify(output, null, 2))

  if (!output.passed) {
    process.exit(1)
  }
} catch (error) {
  console.log(
    JSON.stringify(
      {
        passed: false,
        results: [
          {
            details: {
              message: error instanceof Error ? error.message : String(error),
            },
            name: 'import-contract',
            passed: false,
            summary: 'The harness could not complete the deterministic sourcing/import contract smoke.',
          },
        ],
      },
      null,
      2,
    ),
  )
  process.exit(1)
}
