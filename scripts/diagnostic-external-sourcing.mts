import fsp from 'node:fs/promises'
import path from 'node:path'

import { fetchGreenhouseCompanyJobs } from '@/lib/jobs/greenhouse'
import { prepareImportedJobsForPersistence } from '@/lib/jobs/real-feed'
import {
  getCompanyWatchlist,
  getSourceRegistry,
  getSourceRegistryBySlug,
} from '@/lib/jobs/source-registry'

type DiagnosticStatus = 'degraded' | 'fail' | 'pass'

interface SourceDiagnosticResult {
  connected: boolean
  failureReason: string | null
  fetchedCount: number
  latencyMs: number | null
  normalizedCount: number
  resolved: boolean
  sourceKey: string
  status: DiagnosticStatus
  warning: string | null
}

interface ExternalSourcingDiagnosticReport {
  affectsEval: false
  allowedSources: string[]
  command: string
  diagnosticsRoot: string
  nonGating: true
  note: string
  sampleLimitPerSource: number
  sources: SourceDiagnosticResult[]
  status: DiagnosticStatus
  summary: string
  timeoutMsPerSource: number
  timestamp: string
}

const reportRoot = path.join(
  process.cwd(),
  '.codex-artifacts',
  'diagnostics',
  'external-sourcing',
  'latest',
)
const reportJsonPath = path.join(reportRoot, 'report.json')
const reportMdPath = path.join(reportRoot, 'report.md')
const allowedSourceKeys = ['greenhouse:figma'] as const
const fetchTimeoutMs = 10_000
const sampleLimitPerSource = 2
const healthyLatencyThresholdMs = 8_000
const nonGatingNote = 'This diagnostic is non-gating and does not affect npm run eval.'

function toReportRelative(targetPath: string) {
  const relativePath = path.relative(reportRoot, targetPath).replaceAll(path.sep, '/')
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
}

async function mkdirp(targetPath: string) {
  await fsp.mkdir(targetPath, { recursive: true })
}

function summarizeStatus(results: SourceDiagnosticResult[]) {
  if (results.some((result) => result.status === 'fail')) {
    return 'fail' as const
  }

  if (results.some((result) => result.status === 'degraded')) {
    return 'degraded' as const
  }

  return 'pass' as const
}

function buildSummary(results: SourceDiagnosticResult[]) {
  const counts = {
    degraded: results.filter((result) => result.status === 'degraded').length,
    fail: results.filter((result) => result.status === 'fail').length,
    pass: results.filter((result) => result.status === 'pass').length,
  }

  if (counts.fail > 0) {
    return `${counts.fail}/${results.length} sources failed. ${nonGatingNote}`
  }

  if (counts.degraded > 0) {
    return `${counts.degraded}/${results.length} sources are degraded. ${nonGatingNote}`
  }

  return `${counts.pass}/${results.length} sources passed. ${nonGatingNote}`
}

async function runGreenhouseSourceDiagnostic(sourceKey: string): Promise<SourceDiagnosticResult> {
  const [registry, watchlist] = await Promise.all([getSourceRegistry(), getCompanyWatchlist()])
  const watchlistEntry = watchlist.find((entry) => entry.sourceKey === sourceKey)

  if (!watchlistEntry) {
    return {
      connected: false,
      failureReason: 'Allowlisted source key is not available in the current company watchlist.',
      fetchedCount: 0,
      latencyMs: null,
      normalizedCount: 0,
      resolved: false,
      sourceKey,
      status: 'fail',
      warning: null,
    }
  }

  const registryEntry = getSourceRegistryBySlug(registry).get(watchlistEntry.sourceRegistrySlug)

  if (!registryEntry) {
    return {
      connected: false,
      failureReason: `Source registry slug ${watchlistEntry.sourceRegistrySlug} could not be resolved.`,
      fetchedCount: 0,
      latencyMs: null,
      normalizedCount: 0,
      resolved: false,
      sourceKey,
      status: 'fail',
      warning: null,
    }
  }

  const startedAt = Date.now()
  const batch = await fetchGreenhouseCompanyJobs(watchlistEntry, {
    jobLimit: sampleLimitPerSource,
    timeoutMs: fetchTimeoutMs,
  })
  const latencyMs = Date.now() - startedAt

  if (batch.issue) {
    return {
      connected: false,
      failureReason: batch.issue,
      fetchedCount: batch.rawJobs.length,
      latencyMs,
      normalizedCount: 0,
      resolved: true,
      sourceKey,
      status: 'fail',
      warning: null,
    }
  }

  try {
    const { normalizedJobs } = prepareImportedJobsForPersistence([batch])
    const normalizedCount = normalizedJobs.length
    const fetchedCount = batch.rawJobs.length
    const warningParts: string[] = []

    if (batch.rowsSeen > fetchedCount) {
      warningParts.push(`Sampled ${fetchedCount} jobs from ${batch.rowsSeen} live listings.`)
    }

    if (fetchedCount === 0) {
      warningParts.push('Source responded successfully but returned no jobs for the diagnostic sample.')
    }

    if (fetchedCount > 0 && normalizedCount === 0) {
      warningParts.push(
        'Source responded successfully, but no sampled jobs survived the current normalization and acceptance path.',
      )
    }

    if (latencyMs >= healthyLatencyThresholdMs) {
      warningParts.push(`Source latency ${latencyMs}ms exceeded the healthy threshold of ${healthyLatencyThresholdMs}ms.`)
    }

    const warning = warningParts.length > 0 ? warningParts.join(' ') : null
    const status: DiagnosticStatus =
      fetchedCount === 0 || normalizedCount === 0 || latencyMs >= healthyLatencyThresholdMs
        ? 'degraded'
        : 'pass'

    return {
      connected: true,
      failureReason: null,
      fetchedCount,
      latencyMs,
      normalizedCount,
      resolved: true,
      sourceKey,
      status,
      warning,
    }
  } catch (error) {
    return {
      connected: true,
      failureReason:
        error instanceof Error
          ? `Normalization failed after a successful fetch: ${error.message}`
          : 'Normalization failed after a successful fetch.',
      fetchedCount: batch.rawJobs.length,
      latencyMs,
      normalizedCount: 0,
      resolved: true,
      sourceKey,
      status: 'fail',
      warning: null,
    }
  }
}

function renderMarkdownReport(report: ExternalSourcingDiagnosticReport) {
  const lines = [
    '# External Sourcing Diagnostic',
    '',
    `- Generated: ${report.timestamp}`,
    `- Status: ${report.status.toUpperCase()}`,
    `- Command: \`${report.command}\``,
    `- Allowed sources: ${report.allowedSources.join(', ')}`,
    `- Timeout per source: ${report.timeoutMsPerSource}ms`,
    `- Sample limit per source: ${report.sampleLimitPerSource}`,
    `- Note: ${report.note}`,
    '',
    '## Summary',
    '',
    report.summary,
    '',
    '## Sources',
    '',
  ]

  for (const source of report.sources) {
    lines.push(`### ${source.sourceKey}`)
    lines.push('')
    lines.push(`- Status: ${source.status}`)
    lines.push(`- Resolved: ${source.resolved ? 'yes' : 'no'}`)
    lines.push(`- Connected: ${source.connected ? 'yes' : 'no'}`)
    lines.push(`- Latency: ${typeof source.latencyMs === 'number' ? `${source.latencyMs}ms` : 'n/a'}`)
    lines.push(`- Fetched count: ${source.fetchedCount}`)
    lines.push(`- Normalized count: ${source.normalizedCount}`)

    if (source.warning) {
      lines.push(`- Warning: ${source.warning}`)
    }

    if (source.failureReason) {
      lines.push(`- Failure reason: ${source.failureReason}`)
    }

    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

async function main() {
  await mkdirp(reportRoot)

  const sources = await Promise.all(allowedSourceKeys.map((sourceKey) => runGreenhouseSourceDiagnostic(sourceKey)))
  const status = summarizeStatus(sources)
  const report: ExternalSourcingDiagnosticReport = {
    affectsEval: false,
    allowedSources: [...allowedSourceKeys],
    command: 'npm run diagnostic:external-sourcing',
    diagnosticsRoot: toReportRelative(reportRoot),
    nonGating: true,
    note: nonGatingNote,
    sampleLimitPerSource,
    sources,
    status,
    summary: buildSummary(sources),
    timeoutMsPerSource: fetchTimeoutMs,
    timestamp: new Date().toISOString(),
  }

  await fsp.writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await fsp.writeFile(reportMdPath, renderMarkdownReport(report), 'utf8')

  console.log(JSON.stringify(report, null, 2))

  if (status === 'fail') {
    process.exitCode = 1
  }
}

await main()
