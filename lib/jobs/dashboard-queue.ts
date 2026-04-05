import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import {
  getQueueView,
  getQueueViewHref,
  isScreeningWorkflowStatus,
  matchesQueueView,
  queueViews,
  type QueueView,
} from '@/lib/jobs/workflow-state'

const screeningBatchSize = 8
const minimumStrictScreeningBatch = 5
const maximumJobsPerRegion = 3
const maximumJobsPerSource = 3
const maximumJobsPerSubtype = 2

const genericMatchReasonPatterns = [
  'remote requirement still passes',
  'remote-only eligibility',
  'remote compatibility intact',
  'remote region',
]

const genericRoleTokens = new Set([
  'design',
  'designer',
  'senior',
  'junior',
  'lead',
  'staff',
  'brand',
  'visual',
  'graphic',
])

export interface DashboardQueues {
  appliedJobs: QualifiedJobRecord[]
  archivedJobs: QualifiedJobRecord[]
  counts: Record<QueueView, number>
  potentialJobs: QualifiedJobRecord[]
  preparedJobs: QualifiedJobRecord[]
  savedJobs: QualifiedJobRecord[]
  screeningPool: QualifiedJobRecord[]
}

export { getQueueView, getQueueViewHref, queueViews }
export type { QueueView }

function isGenericMatchReason(reason: string) {
  const normalized = reason.toLowerCase()
  return genericMatchReasonPatterns.some((pattern) => normalized.includes(pattern))
}

export function getMatchReason(job: QualifiedJobRecord) {
  if (job.aiMatchSummary?.trim()) {
    return job.aiMatchSummary.trim()
  }

  const candidates = [...job.fitReasons, ...job.strongReasons, job.queueReason].filter(Boolean)

  return candidates.find((reason) => !isGenericMatchReason(reason)) ?? candidates[0] ?? job.queueReason
}

function sortStageJobs(jobs: QualifiedJobRecord[]) {
  const queueOrder: Record<QualifiedJobRecord['queueSegment'], number> = {
    apply_now: 0,
    worth_reviewing: 1,
    monitor: 2,
    hidden: 3,
  }

  return [...jobs].sort((left, right) => {
    if (left.queueSegment !== right.queueSegment) {
      return queueOrder[left.queueSegment] - queueOrder[right.queueSegment]
    }

    if (left.queueScore !== right.queueScore) {
      return right.queueScore - left.queueScore
    }

    if ((left.daysSincePosted ?? Number.MAX_SAFE_INTEGER) !== (right.daysSincePosted ?? Number.MAX_SAFE_INTEGER)) {
      return (left.daysSincePosted ?? Number.MAX_SAFE_INTEGER) - (right.daysSincePosted ?? Number.MAX_SAFE_INTEGER)
    }

    return left.companyName.localeCompare(right.companyName) || left.title.localeCompare(right.title)
  })
}

function isActiveScreeningJob(job: QualifiedJobRecord) {
  return (
    isScreeningWorkflowStatus(job.workflowStatus) &&
    job.queueSegment !== 'hidden' &&
    !job.stale &&
    job.listingStatus !== 'stale'
  )
}

function isStrictScreeningCandidate(job: QualifiedJobRecord) {
  if (!isActiveScreeningJob(job)) {
    return false
  }

  if (
    job.roleFit.band === 'weak' ||
    job.roleFit.band === 'blocked' ||
    job.eligibility.band === 'blocked' ||
    job.marketFit.band === 'blocked'
  ) {
    return false
  }

  return !isGenericMatchReason(getMatchReason(job))
}

function buildScreeningPool(jobs: QualifiedJobRecord[]) {
  const strictPool = sortStageJobs(jobs.filter(isStrictScreeningCandidate))

  if (strictPool.length >= minimumStrictScreeningBatch) {
    return strictPool
  }

  const relaxedPool = sortStageJobs(jobs.filter(isActiveScreeningJob))
  const strictIds = new Set(strictPool.map((job) => job.id))
  const replenishmentPool = relaxedPool.filter((job) => !strictIds.has(job.id))

  return [...strictPool, ...replenishmentPool]
}

function buildPotentialQueue(jobs: QualifiedJobRecord[]) {
  const selected: QualifiedJobRecord[] = []
  const seenCompanies = new Set<string>()
  const sourceCounts = new Map<string, number>()
  const regionCounts = new Map<string, number>()
  const subtypeCounts = new Map<string, number>()

  const getSubtypeKey = (job: QualifiedJobRecord) => {
    const tokens = job.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2 && !genericRoleTokens.has(token))

    return tokens.slice(0, 2).join(' ') || job.title.toLowerCase()
  }

  const getRegionKey = (job: QualifiedJobRecord) =>
    job.remoteRegions[0]?.toLowerCase() || job.locationLabel?.toLowerCase() || 'remote'

  const canAddWithDiversity = (job: QualifiedJobRecord) => {
    const sourceCount = sourceCounts.get(job.sourceName) ?? 0
    const regionCount = regionCounts.get(getRegionKey(job)) ?? 0
    const subtypeCount = subtypeCounts.get(getSubtypeKey(job)) ?? 0

    return (
      sourceCount < maximumJobsPerSource &&
      regionCount < maximumJobsPerRegion &&
      subtypeCount < maximumJobsPerSubtype
    )
  }

  const rememberDiversity = (job: QualifiedJobRecord) => {
    const regionKey = getRegionKey(job)
    const subtypeKey = getSubtypeKey(job)

    sourceCounts.set(job.sourceName, (sourceCounts.get(job.sourceName) ?? 0) + 1)
    regionCounts.set(regionKey, (regionCounts.get(regionKey) ?? 0) + 1)
    subtypeCounts.set(subtypeKey, (subtypeCounts.get(subtypeKey) ?? 0) + 1)
  }

  for (const job of jobs) {
    if (selected.length >= screeningBatchSize) {
      break
    }

    const companyKey = job.companyName.toLowerCase()

    if (seenCompanies.has(companyKey) || !canAddWithDiversity(job)) {
      continue
    }

    seenCompanies.add(companyKey)
    rememberDiversity(job)
    selected.push(job)
  }

  if (selected.length < screeningBatchSize) {
    const selectedIds = new Set(selected.map((job) => job.id))

    for (const job of jobs) {
      if (selected.length >= screeningBatchSize) {
        break
      }

      if (selectedIds.has(job.id)) {
        continue
      }

      selected.push(job)
      selectedIds.add(job.id)
    }
  }

  return selected
}

export function getDashboardQueues(jobs: QualifiedJobRecord[]): DashboardQueues {
  const screeningPool = buildScreeningPool(jobs)
  const potentialJobs = buildPotentialQueue(screeningPool)
  const savedJobs = sortStageJobs(jobs.filter((job) => matchesQueueView(job.workflowStatus, 'saved')))
  const preparedJobs = sortStageJobs(jobs.filter((job) => matchesQueueView(job.workflowStatus, 'prepared')))
  const appliedJobs = sortStageJobs(jobs.filter((job) => matchesQueueView(job.workflowStatus, 'applied')))
  const archivedJobs = sortStageJobs(jobs.filter((job) => matchesQueueView(job.workflowStatus, 'archive')))

  return {
    appliedJobs,
    archivedJobs,
    counts: {
      applied: appliedJobs.length,
      archive: archivedJobs.length,
      potential: screeningPool.length,
      prepared: preparedJobs.length,
      saved: savedJobs.length,
    },
    potentialJobs,
    preparedJobs,
    savedJobs,
    screeningPool,
  }
}

export function getApplyNextJob(queues: Pick<DashboardQueues, 'preparedJobs' | 'savedJobs'>) {
  return queues.preparedJobs[0] ?? queues.savedJobs[0] ?? null
}
