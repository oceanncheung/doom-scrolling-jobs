import assert from 'node:assert/strict'

import { workflowStatuses, type WorkflowStatus } from '@/lib/domain/types'
import type {
  ListingStatus,
  QualifiedJobRecord,
  QualificationDimension,
} from '@/lib/jobs/contracts'
import { getDashboardQueues } from '@/lib/jobs/dashboard-queue'
import {
  getQueueView,
  getQueueViewHref,
  getWorkflowQueueView,
  matchesQueueView,
  queueViews,
  queueViewWorkflowStatuses,
  type QueueView,
} from '@/lib/jobs/workflow-state'

import { defaultSeededSmokeJobId } from './smoke-helpers.mts'

interface CheckResult {
  details?: Record<string, unknown>
  name: string
  passed: boolean
  summary: string
}

const strongDimension: QualificationDimension = {
  band: 'strong',
  label: 'Strong fit',
  score: 5,
}

function createQualifiedJob(
  id: string,
  workflowStatus: WorkflowStatus,
  overrides: Partial<QualifiedJobRecord> = {},
): QualifiedJobRecord {
  const titleToken = id.replaceAll('-', ' ')
  const companyToken = `Company ${id.slice(-3)}`

  return {
    aiSummaryStatus: 'not_started',
    applicationFriction: strongDimension,
    companyName: companyToken,
    compensationSignal: strongDimension,
    daysSincePosted: 3,
    descriptionText: `Harness fixture for ${titleToken}.`,
    eligibility: strongDimension,
    employmentType: 'full_time',
    effortScore: 2,
    fitReasons: ['Strong fixture fit'],
    fitSummary: 'Fixture role for queue derivation coverage.',
    freshness: strongDimension,
    id,
    jobScoreId: `${id}-score`,
    listingStatus: 'active',
    locationLabel: 'Remote',
    marketFit: strongDimension,
    missingRequirements: [],
    penaltyScore: 0,
    portfolioFitScore: 4,
    portfolioFitSignal: strongDimension,
    portfolioRequired: 'no',
    postedAt: '2026-04-01T12:00:00.000Z',
    preferredQualifications: [],
    qualityScore: 20,
    queueReason: 'Fixture queue reason',
    queueScore: 80,
    queueSegment: 'apply_now',
    redFlagNotes: [],
    redFlags: [],
    recommendationLevel: 'strong_apply',
    remoteGatePassed: true,
    remoteRegions: ['Canada'],
    remoteType: 'remote',
    roleFit: strongDimension,
    roleRelevanceScore: 18,
    salaryPeriod: 'annual',
    salaryScore: 14,
    scamRiskLevel: 'low',
    scoredAt: '2026-04-01T12:00:00.000Z',
    seniorityScore: 9,
    skillsKeywords: ['design'],
    sourceName: 'Harness Source',
    sourceUrl: `https://example.com/jobs/${id}`,
    stale: false,
    strongReasons: ['Stable harness fixture'],
    title: `Role ${titleToken}`,
    totalScore: 82,
    weakReasons: [],
    workflowStatus,
    requirements: [],
    ...overrides,
  }
}

function assertQueueViewCoverage() {
  const viewAssignments = new Map<WorkflowStatus, QueueView[]>()

  for (const view of queueViews) {
    for (const status of queueViewWorkflowStatuses[view]) {
      viewAssignments.set(status, [...(viewAssignments.get(status) ?? []), view])
    }
  }

  assert.deepEqual(
    [...viewAssignments.keys()].sort(),
    [...workflowStatuses].sort(),
    'Every workflow status should appear in queueViewWorkflowStatuses.',
  )

  for (const status of workflowStatuses) {
    const assignments = viewAssignments.get(status)
    assert.equal(assignments?.length, 1, `${status} should belong to exactly one queue view.`)
    assert.equal(getWorkflowQueueView(status), assignments?.[0], `${status} should map to the expected queue view.`)

    for (const view of queueViews) {
      assert.equal(
        matchesQueueView(status, view),
        assignments?.[0] === view,
        `${status} should ${assignments?.[0] === view ? '' : 'not '}match ${view}.`,
      )
    }
  }

  return {
    statusToView: Object.fromEntries(
      workflowStatuses.map((status) => [status, getWorkflowQueueView(status)]),
    ),
  }
}

function assertQueueViewSelectionContract() {
  const expectedHrefs: Record<QueueView, string> = {
    applied: '/dashboard?view=applied',
    archive: '/dashboard?view=archive',
    potential: '/dashboard',
    prepared: '/dashboard?view=ready',
    saved: '/dashboard?view=saved',
  }

  for (const view of queueViews) {
    const requestedValue = view === 'prepared' ? 'ready' : view
    assert.equal(getQueueView(requestedValue), view, `${requestedValue} should resolve to ${view}.`)
    assert.equal(getQueueViewHref(view), expectedHrefs[view], `${view} should link to the expected dashboard href.`)
  }

  assert.equal(getQueueView(undefined), 'potential', 'Undefined queue selections should fall back to potential.')
  assert.equal(getQueueView('unexpected-view'), 'potential', 'Invalid queue selections should fall back to potential.')

  return {
    hrefs: expectedHrefs,
  }
}

function assertDashboardQueueDerivation() {
  const fixtureJobs: QualifiedJobRecord[] = [
    createQualifiedJob('job-new-active', 'new', {
      companyName: 'Acme Potential',
      queueScore: 92,
      queueSegment: 'apply_now',
    }),
    createQualifiedJob('job-ranked-active', 'ranked', {
      companyName: 'Beacon Potential',
      queueScore: 84,
      queueSegment: 'worth_reviewing',
    }),
    createQualifiedJob('job-new-hidden', 'new', {
      companyName: 'Hidden Potential',
      queueScore: 70,
      queueSegment: 'hidden',
    }),
    createQualifiedJob('job-ranked-stale', 'ranked', {
      companyName: 'Stale Potential',
      listingStatus: 'stale' satisfies ListingStatus,
      queueScore: 75,
      stale: true,
    }),
    createQualifiedJob('job-shortlisted', 'shortlisted', {
      companyName: 'Saved Company A',
      queueScore: 81,
    }),
    createQualifiedJob('job-preparing', 'preparing', {
      companyName: 'Saved Company B',
      queueScore: 79,
    }),
    createQualifiedJob('job-ready', 'ready_to_apply', {
      companyName: 'Prepared Company',
      queueScore: 77,
    }),
    createQualifiedJob('job-applied', 'applied', {
      companyName: 'Applied Company A',
      queueScore: 72,
    }),
    createQualifiedJob('job-follow-up', 'follow_up_due', {
      companyName: 'Applied Company B',
      queueScore: 71,
    }),
    createQualifiedJob('job-interview', 'interview', {
      companyName: 'Applied Company C',
      queueScore: 73,
    }),
    createQualifiedJob('job-archived', 'archived', {
      companyName: 'Archived Company A',
      queueScore: 69,
    }),
    createQualifiedJob('job-rejected', 'rejected', {
      companyName: 'Archived Company B',
      queueScore: 68,
    }),
  ]

  const queues = getDashboardQueues(fixtureJobs)

  assert.deepEqual(queues.counts, {
    applied: 3,
    archive: 2,
    potential: 2,
    prepared: 1,
    saved: 2,
  })
  assert.deepEqual(queues.screeningPool.map((job) => job.id), ['job-new-active', 'job-ranked-active'])
  assert.deepEqual(queues.potentialJobs.map((job) => job.id), ['job-new-active', 'job-ranked-active'])
  assert.deepEqual(queues.savedJobs.map((job) => job.id), ['job-shortlisted', 'job-preparing'])
  assert.deepEqual(queues.preparedJobs.map((job) => job.id), ['job-ready'])
  assert.deepEqual(queues.appliedJobs.map((job) => job.id), ['job-interview', 'job-applied', 'job-follow-up'])
  assert.deepEqual(queues.archivedJobs.map((job) => job.id), ['job-archived', 'job-rejected'])

  return {
    counts: queues.counts,
    queueIds: {
      applied: queues.appliedJobs.map((job) => job.id),
      archived: queues.archivedJobs.map((job) => job.id),
      potential: queues.potentialJobs.map((job) => job.id),
      prepared: queues.preparedJobs.map((job) => job.id),
      saved: queues.savedJobs.map((job) => job.id),
      screeningPool: queues.screeningPool.map((job) => job.id),
    },
  }
}

async function assertSeededJobsFallback() {
  const envKeys = [
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SECRET_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ] as const
  const previousValues = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))

  for (const key of envKeys) {
    delete process.env[key]
  }

  try {
    const { getRankedJobs } = await import('@/lib/data/jobs')
    const result = await getRankedJobs()
    const seededJob = result.jobs.find((job) => job.id === defaultSeededSmokeJobId)

    assert.equal(result.source, 'seed', 'The seeded jobs fallback should be used when Supabase env is unavailable.')
    assert.ok(seededJob, `Seeded job fixture ${defaultSeededSmokeJobId} should resolve from getRankedJobs().`)
    assert.equal(
      getWorkflowQueueView(seededJob.workflowStatus),
      'saved',
      'The seeded smoke job should remain mapped to the saved queue family.',
    )

    return {
      candidatePoolCount: result.candidatePoolCount,
      seededSmokeJobId: defaultSeededSmokeJobId,
      source: result.source,
      workflowStatus: seededJob.workflowStatus,
    }
  } finally {
    for (const key of envKeys) {
      const value = previousValues[key]
      if (value) {
        process.env[key] = value
      } else {
        delete process.env[key]
      }
    }
  }
}

const checks: Array<{
  name: string
  run: () => Promise<Record<string, unknown>> | Record<string, unknown>
  summary: string
}> = [
  {
    name: 'workflow-status-coverage',
    run: () => assertQueueViewCoverage(),
    summary: 'Workflow statuses map exactly once into the intended queue families.',
  },
  {
    name: 'queue-view-selection',
    run: () => assertQueueViewSelectionContract(),
    summary: 'Queue view aliases and href mappings stay aligned with dashboard routing.',
  },
  {
    name: 'dashboard-queue-derivation',
    run: () => assertDashboardQueueDerivation(),
    summary: 'Queue counts and derived job groupings stay stable for a deterministic fixture.',
  },
  {
    name: 'seeded-ranked-jobs-fallback',
    run: () => assertSeededJobsFallback(),
    summary: 'The seeded ranked-jobs path still resolves predictable queue data without Supabase env.',
  },
]

const results: CheckResult[] = []

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

const passed = results.every((result) => result.passed)

console.log(
  JSON.stringify(
    {
      passed,
      results,
    },
    null,
    2,
  ),
)

if (!passed) {
  process.exit(1)
}
