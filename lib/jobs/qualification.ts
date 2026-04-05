import type { OperatorProfileRecord } from '@/lib/domain/types'
import type {
  QualificationDimension,
  QualifiedJobRecord,
  QueueSegment,
  RankedJobRecord,
} from '@/lib/jobs/contracts'
import { getEffectiveSalaryBounds } from '@/lib/jobs/salary-estimation'
import {
  isArchivedWorkflowStatus,
  isReadyWorkflowStatus,
  isSavedWorkflowStatus,
} from '@/lib/jobs/workflow-state'

interface MarketDefinition {
  key: string
  label: string
  patterns: string[]
  representativeUtcOffset?: number
}

interface OperatorScope {
  allowedMarketKeys: Set<string>
  hasMarketPreferences: boolean
  portfolioReady: boolean
  primaryMarketKeys: Set<string>
  primaryMarketLabel: string
  relocationOpen: boolean
  salaryFloor?: number
  salaryTargetMax?: number
  salaryTargetMin?: number
  secondaryMarketKeys: Set<string>
  timeZoneOffset?: number
  timezoneToleranceHours: number
}

const applyNowThreshold = 82
const monitorThreshold = 50
const staleThresholdDays = 35
const worthReviewingThreshold = 66

const marketHierarchy: Record<string, string[]> = {
  apac: ['apac'],
  australia: ['australia', 'apac'],
  canada: ['canada', 'north_america'],
  europe: ['europe'],
  global: ['global'],
  india: ['india', 'apac'],
  latin_america: ['latin_america'],
  mexico: ['mexico', 'latin_america', 'north_america'],
  north_america: ['north_america'],
  portugal: ['portugal', 'europe'],
  singapore: ['singapore', 'apac'],
  united_kingdom: ['united_kingdom', 'europe'],
  united_states: ['united_states', 'north_america'],
}

const marketDefinitions: MarketDefinition[] = [
  {
    key: 'global',
    label: 'Global',
    patterns: ['anywhere', 'global', 'remote anywhere', 'worldwide'],
  },
  {
    key: 'north_america',
    label: 'North America',
    patterns: ['north america', 'north american'],
    representativeUtcOffset: -5,
  },
  {
    key: 'canada',
    label: 'Canada',
    patterns: ['canada', 'toronto', 'montreal', 'vancouver', 'ontario', 'alberta'],
    representativeUtcOffset: -4,
  },
  {
    key: 'united_states',
    label: 'United States',
    patterns: ['united states', ' usa ', ' us ', 'america'],
    representativeUtcOffset: -5,
  },
  {
    key: 'mexico',
    label: 'Mexico',
    patterns: ['mexico'],
    representativeUtcOffset: -6,
  },
  {
    key: 'latin_america',
    label: 'Latin America',
    patterns: ['latam', 'latin america', 'south america'],
    representativeUtcOffset: -4,
  },
  {
    key: 'europe',
    label: 'Europe',
    patterns: [
      'europe',
      'european union',
      'eu ',
      'emea',
      'germany',
      'france',
      'spain',
      'italy',
      'netherlands',
      'poland',
      'sweden',
      'norway',
      'denmark',
      'finland',
    ],
    representativeUtcOffset: 1,
  },
  {
    key: 'portugal',
    label: 'Portugal',
    patterns: ['portugal', 'lisbon'],
    representativeUtcOffset: 1,
  },
  {
    key: 'united_kingdom',
    label: 'United Kingdom',
    patterns: ['uk ', 'u k', 'united kingdom', 'england', 'scotland', 'wales'],
    representativeUtcOffset: 1,
  },
  {
    key: 'apac',
    label: 'APAC',
    patterns: ['apac', 'asia pacific'],
    representativeUtcOffset: 8,
  },
  {
    key: 'australia',
    label: 'Australia',
    patterns: ['australia', 'sydney', 'melbourne'],
    representativeUtcOffset: 10,
  },
  {
    key: 'singapore',
    label: 'Singapore',
    patterns: ['singapore'],
    representativeUtcOffset: 8,
  },
  {
    key: 'india',
    label: 'India',
    patterns: ['india', 'bangalore', 'delhi', 'mumbai'],
    representativeUtcOffset: 5.5,
  },
]

const segmentOrder: Record<QueueSegment, number> = {
  apply_now: 0,
  worth_reviewing: 1,
  monitor: 2,
  hidden: 3,
}

function roundScore(value: number) {
  return Math.round(value * 10) / 10
}

function parseIntegerString(value: string) {
  if (!value.trim()) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function toPaddedText(values: string[]) {
  const text = values.map((value) => normalizeText(value)).filter(Boolean).join(' ')
  return ` ${text} `
}

function pluralizeDays(days: number) {
  return days === 1 ? 'day' : 'days'
}

function lowerFirst(value: string) {
  if (!value) {
    return value
  }

  return value.charAt(0).toLowerCase() + value.slice(1)
}

function createDimension(
  band: QualificationDimension['band'],
  score: number,
  label: string,
): QualificationDimension {
  return {
    band,
    label,
    score: roundScore(score),
  }
}

function getIntersection(left: Set<string>, right: Set<string>) {
  return [...left].filter((value) => right.has(value))
}

function expandMarketKeys(keys: Set<string>) {
  const expanded = new Set<string>()

  for (const key of keys) {
    const hierarchy = marketHierarchy[key] ?? [key]

    for (const item of hierarchy) {
      expanded.add(item)
    }
  }

  return expanded
}

function getMarketDefinition(key: string) {
  return marketDefinitions.find((item) => item.key === key)
}

function formatMarketKeys(keys: Set<string>) {
  const labels = [...keys]
    .map((key) => getMarketDefinition(key)?.label ?? key.replaceAll('_', ' '))
    .filter(Boolean)

  return labels.length > 0 ? labels.join(', ') : 'global remote coverage'
}

function detectMarketKeys(values: string[]) {
  const text = toPaddedText(values)
  const keys = new Set<string>()

  for (const definition of marketDefinitions) {
    const matched = definition.patterns.some((pattern) =>
      text.includes(` ${normalizeText(pattern)} `),
    )

    if (matched) {
      keys.add(definition.key)
    }
  }

  if (
    keys.size === 0 &&
    text.includes(' remote ') &&
    !text.includes(' onsite ') &&
    !text.includes(' hybrid ')
  ) {
    keys.add('global')
  }

  return keys
}

function getTimeZoneOffsetHours(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date())
    const rawOffset = parts.find((part) => part.type === 'timeZoneName')?.value ?? ''

    if (rawOffset === 'GMT' || rawOffset === 'UTC') {
      return 0
    }

    const match = rawOffset.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/)

    if (!match) {
      return undefined
    }

    const hours = Number.parseInt(match[1] ?? '0', 10)
    const minutes = Number.parseInt(match[2] ?? '0', 10)
    const minuteOffset = minutes / 60

    return hours >= 0 ? hours + minuteOffset : hours - minuteOffset
  } catch {
    return undefined
  }
}

function getMinimumOffsetDifference(left?: number, right: number[] = []) {
  if (left == null || right.length === 0) {
    return undefined
  }

  return right.reduce<number | undefined>((closest, candidate) => {
    const difference = Math.abs(left - candidate)

    if (closest == null || difference < closest) {
      return difference
    }

    return closest
  }, undefined)
}

function getDaysSincePosted(postedAt?: string) {
  if (!postedAt) {
    return undefined
  }

  const timestamp = new Date(postedAt).getTime()

  if (Number.isNaN(timestamp)) {
    return undefined
  }

  const difference = Date.now() - timestamp

  if (!Number.isFinite(difference) || difference < 0) {
    return 0
  }

  return Math.floor(difference / (1000 * 60 * 60 * 24))
}

function buildOperatorScope(profile: OperatorProfileRecord): OperatorScope {
  const primaryMarketLabel = profile.primaryMarket.trim() || profile.locationLabel.trim()
  const primaryMarketKeys = detectMarketKeys([primaryMarketLabel])
  const secondaryMarketKeys = detectMarketKeys(profile.secondaryMarkets)
  const explicitAllowedKeys = detectMarketKeys(profile.allowedRemoteRegions)
  const allowedMarketKeys = new Set<string>([
    ...primaryMarketKeys,
    ...secondaryMarketKeys,
    ...explicitAllowedKeys,
  ])

  return {
    allowedMarketKeys,
    hasMarketPreferences: allowedMarketKeys.size > 0,
    portfolioReady: Boolean(profile.portfolioPrimaryUrl),
    primaryMarketKeys,
    primaryMarketLabel,
    relocationOpen: profile.relocationOpen,
    salaryFloor: parseIntegerString(profile.salaryFloorAmount),
    salaryTargetMax: parseIntegerString(profile.salaryTargetMax),
    salaryTargetMin: parseIntegerString(profile.salaryTargetMin),
    secondaryMarketKeys,
    timeZoneOffset: getTimeZoneOffsetHours(profile.timezone),
    timezoneToleranceHours: parseIntegerString(profile.timezoneToleranceHours) ?? 4,
  }
}

function assessEligibility(job: RankedJobRecord) {
  if (isArchivedWorkflowStatus(job.workflowStatus)) {
    return createDimension('blocked', -18, 'Already hidden by your workflow status.')
  }

  if (job.listingStatus === 'closed') {
    return createDimension('blocked', -18, 'The listing appears closed.')
  }

  if (job.remoteType !== 'remote' || !job.remoteGatePassed) {
    return createDimension('blocked', -24, 'Remote-only eligibility does not pass.')
  }

  return createDimension('strong', 8, 'Remote-only eligibility passes.')
}

function assessRoleFit(job: RankedJobRecord) {
  const topReason = job.fitReasons[0] ?? `Role title still aligns with ${job.title}.`

  if (job.roleRelevanceScore >= 16) {
    return createDimension('strong', 8, topReason)
  }

  if (job.roleRelevanceScore >= 13) {
    return createDimension('good', 5, topReason)
  }

  if (job.roleRelevanceScore >= 10) {
    return createDimension('mixed', 2, topReason)
  }

  return createDimension('weak', -5, 'Role fit is looser than your current target roles.')
}

function assessPortfolioFit(job: RankedJobRecord, scope: OperatorScope) {
  if (job.portfolioRequired === 'yes' && !scope.portfolioReady) {
    return createDimension('blocked', -8, 'Portfolio is required but no primary portfolio link is set.')
  }

  if (job.portfolioFitScore >= 4.3) {
    return createDimension('strong', 6, 'Current portfolio evidence looks strong for this role.')
  }

  if (job.portfolioFitScore >= 3.5) {
    return createDimension('good', 3, 'Portfolio fit is credible for this role.')
  }

  if (job.portfolioFitScore >= 2.7) {
    return createDimension('mixed', 0, 'Portfolio fit is plausible but not especially strong yet.')
  }

  return createDimension('weak', -4, 'Portfolio fit looks thin for the current requirement level.')
}

function assessFreshness(job: RankedJobRecord) {
  const daysSincePosted = getDaysSincePosted(job.postedAt)
  const stale = job.listingStatus === 'stale' || (daysSincePosted != null && daysSincePosted > staleThresholdDays)

  if (job.listingStatus === 'stale') {
    return {
      daysSincePosted,
      dimension: createDimension('weak', -12, 'The source has already marked this listing stale.'),
      stale: true,
    }
  }

  if (daysSincePosted == null) {
    return {
      daysSincePosted,
      dimension: createDimension('mixed', -1, 'Posted date is unavailable, so freshness is harder to trust.'),
      stale,
    }
  }

  if (daysSincePosted <= 3) {
    return {
      daysSincePosted,
      dimension: createDimension(
        'strong',
        12,
        `Posted ${daysSincePosted === 0 ? 'today' : `${daysSincePosted} ${pluralizeDays(daysSincePosted)} ago`}.`,
      ),
      stale,
    }
  }

  if (daysSincePosted <= 7) {
    return {
      daysSincePosted,
      dimension: createDimension('strong', 10, `Posted ${daysSincePosted} days ago.`),
      stale,
    }
  }

  if (daysSincePosted <= 14) {
    return {
      daysSincePosted,
      dimension: createDimension('good', 7, `Posted ${daysSincePosted} days ago.`),
      stale,
    }
  }

  if (daysSincePosted <= 21) {
    return {
      daysSincePosted,
      dimension: createDimension('good', 4, `Posted ${daysSincePosted} days ago.`),
      stale,
    }
  }

  if (daysSincePosted <= staleThresholdDays) {
    return {
      daysSincePosted,
      dimension: createDimension('weak', -4, `Posted ${daysSincePosted} days ago and already aging.`),
      stale,
    }
  }

  return {
    daysSincePosted,
    dimension: createDimension('weak', -10, `Posted ${daysSincePosted} days ago and now looks stale.`),
    stale: true,
  }
}

function assessMarketFit(job: RankedJobRecord, scope: OperatorScope) {
  const jobMarketKeys = detectMarketKeys([
    job.locationLabel ?? '',
    ...job.remoteRegions,
    job.workAuthNotes ?? '',
  ])
  const expandedJobKeys = expandMarketKeys(jobMarketKeys)
  const expandedPrimaryKeys = expandMarketKeys(scope.primaryMarketKeys)
  const expandedSecondaryKeys = expandMarketKeys(scope.secondaryMarketKeys)
  const expandedAllowedKeys = expandMarketKeys(scope.allowedMarketKeys)
  const matchedPrimary = getIntersection(expandedJobKeys, expandedPrimaryKeys)
  const matchedSecondary = getIntersection(expandedJobKeys, expandedSecondaryKeys)
  const matchedAllowed = getIntersection(expandedJobKeys, expandedAllowedKeys)
  const representativeOffsets = [...jobMarketKeys]
    .map((key) => getMarketDefinition(key)?.representativeUtcOffset)
    .filter((value): value is number => value != null)
  const closestTimeDifference = getMinimumOffsetDifference(
    scope.timeZoneOffset,
    representativeOffsets,
  )

  if (!scope.hasMarketPreferences) {
    return createDimension('mixed', 2, 'Market scope is not configured yet, so this remains broadly eligible.')
  }

  if (jobMarketKeys.size === 0 || (jobMarketKeys.size === 1 && jobMarketKeys.has('global'))) {
    return createDimension('good', 6, 'Remote region is broad enough for your current market scope.')
  }

  if (matchedPrimary.length > 0) {
    return createDimension(
      'strong',
      10,
      `Remote region includes your primary market (${formatMarketKeys(new Set(matchedPrimary))}).`,
    )
  }

  if (matchedAllowed.length > 0 || matchedSecondary.length > 0) {
    return createDimension(
      'good',
      6,
      `Remote region is acceptable for your current market scope (${formatMarketKeys(
        new Set(matchedAllowed.length > 0 ? matchedAllowed : matchedSecondary),
      )}).`,
    )
  }

  if (closestTimeDifference != null && closestTimeDifference <= scope.timezoneToleranceHours) {
    return createDimension(
      'mixed',
      1,
      `Region is outside your main markets, but the timezone gap stays within ${scope.timezoneToleranceHours} hours.`,
    )
  }

  if (scope.relocationOpen) {
    return createDimension(
      'weak',
      -3,
      `Region is outside ${scope.primaryMarketLabel || 'your current markets'}, but relocation openness keeps it in view.`,
    )
  }

  return createDimension(
    'blocked',
    -12,
    `Remote region does not include ${scope.primaryMarketLabel || 'your current markets'}.`,
  )
}

function assessCompensationSignal(job: RankedJobRecord, scope: OperatorScope) {
  const compensation = getEffectiveSalaryBounds(job)
  const effectiveMin = compensation.min ?? compensation.max
  const effectiveMax = compensation.max ?? compensation.min

  if (effectiveMin == null && effectiveMax == null) {
    return createDimension('mixed', -2, 'No salary is listed yet.')
  }

  if (scope.salaryFloor != null && effectiveMax != null && effectiveMax < scope.salaryFloor) {
    return createDimension(
      'weak',
      compensation.estimated ? -6 : -8,
      compensation.estimated
        ? 'Estimated market range falls below your salary floor.'
        : 'Listed compensation falls below your salary floor.',
    )
  }

  if (
    scope.salaryTargetMin != null &&
    effectiveMax != null &&
    effectiveMax >= scope.salaryTargetMin &&
    (scope.salaryTargetMax == null || effectiveMin == null || effectiveMin <= scope.salaryTargetMax)
  ) {
    return createDimension(
      compensation.estimated ? 'good' : 'strong',
      compensation.estimated ? 5 : 8,
      compensation.estimated
        ? 'Estimated market range lands near your current target range.'
        : 'Compensation lands in your current target range.',
    )
  }

  if (scope.salaryFloor != null && effectiveMin != null && effectiveMin >= scope.salaryFloor) {
    return createDimension(
      'good',
      compensation.estimated ? 4 : 5,
      compensation.estimated
        ? 'Estimated market range clears your current floor.'
        : 'Compensation clears your current floor.',
    )
  }

  if (scope.salaryFloor != null && effectiveMax != null && effectiveMax >= scope.salaryFloor) {
    return createDimension(
      'mixed',
      compensation.estimated ? 1 : 2,
      compensation.estimated
        ? 'Estimated market range might clear your floor, but confidence is still limited.'
        : 'Compensation might clear your floor, but the range is still loose.',
    )
  }

  return createDimension(
    'good',
    compensation.estimated ? 2 : 3,
    compensation.estimated
      ? 'Estimated market range is available and still worth considering.'
      : 'Compensation is listed and still worth considering.',
  )
}

function assessApplicationFriction(job: RankedJobRecord, scope: OperatorScope) {
  if (!job.applicationUrl && !job.sourceUrl) {
    return createDimension('blocked', -8, 'Application link is missing.')
  }

  let score = 4
  const gapCount = job.missingRequirements.length
  const redFlagCount = job.redFlags.length + job.redFlagNotes.length
  let label = 'Application path looks straightforward.'

  if (gapCount === 0) {
    score += 4
    label = 'Application path looks straightforward and the current gaps are limited.'
  } else if (gapCount <= 2) {
    score += 1
    label = 'Application path is manageable, but there are still a couple of gaps to review.'
  } else {
    score -= 4
    label = 'Application still has several gaps to close before it feels ready.'
  }

  if (job.portfolioRequired === 'yes' && !scope.portfolioReady) {
    score -= 5
    label = 'Portfolio is required, but the primary portfolio setup is incomplete.'
  }

  if (redFlagCount > 0) {
    score -= Math.min(3, redFlagCount)
  }

  if (isReadyWorkflowStatus(job.workflowStatus)) {
    score += 2
    label = 'Workflow already shows this role as close to application-ready.'
  } else if (isSavedWorkflowStatus(job.workflowStatus)) {
    score += 1
  }

  if (score >= 7) {
    return createDimension('strong', score, label)
  }

  if (score >= 4) {
    return createDimension('good', score, label)
  }

  if (score >= 1) {
    return createDimension('mixed', score, label)
  }

  return createDimension('weak', score, label)
}

function buildQueueSegment(
  job: RankedJobRecord,
  queueScore: number,
  dimensions: {
    applicationFriction: QualificationDimension
    compensationSignal: QualificationDimension
    eligibility: QualificationDimension
    freshness: QualificationDimension
    marketFit: QualificationDimension
    roleFit: QualificationDimension
  },
  stale: boolean,
): QueueSegment {
  if (isArchivedWorkflowStatus(job.workflowStatus)) {
    return 'hidden'
  }

  if (
    dimensions.eligibility.band === 'blocked' ||
    dimensions.marketFit.band === 'blocked' ||
    job.listingStatus === 'closed'
  ) {
    return 'hidden'
  }

  if (
    !stale &&
    queueScore >= applyNowThreshold &&
    (dimensions.roleFit.band === 'strong' || dimensions.roleFit.band === 'good') &&
    (dimensions.marketFit.band === 'strong' || dimensions.marketFit.band === 'good') &&
    (dimensions.freshness.band === 'strong' || dimensions.freshness.band === 'good') &&
    dimensions.compensationSignal.band !== 'weak' &&
    dimensions.applicationFriction.band !== 'weak' &&
    dimensions.applicationFriction.band !== 'blocked'
  ) {
    return 'apply_now'
  }

  if (
    !stale &&
    queueScore >= worthReviewingThreshold &&
    dimensions.roleFit.band !== 'weak' &&
    dimensions.roleFit.band !== 'blocked'
  ) {
    return 'worth_reviewing'
  }

  if (queueScore >= monitorThreshold || stale) {
    return 'monitor'
  }

  return 'hidden'
}

function buildReasonBuckets(
  job: RankedJobRecord,
  dimensions: {
    applicationFriction: QualificationDimension
    compensationSignal: QualificationDimension
    eligibility: QualificationDimension
    freshness: QualificationDimension
    marketFit: QualificationDimension
    portfolioFitSignal: QualificationDimension
    roleFit: QualificationDimension
  },
) {
  const strongReasons: string[] = []
  const weakReasons: string[] = []
  const dimensionEntries: QualificationDimension[] = [
    dimensions.eligibility,
    dimensions.roleFit,
    dimensions.marketFit,
    dimensions.freshness,
    dimensions.portfolioFitSignal,
    dimensions.compensationSignal,
    dimensions.applicationFriction,
  ]

  for (const dimension of dimensionEntries) {
    if (dimension.band === 'strong' || dimension.band === 'good') {
      strongReasons.push(dimension.label)
      continue
    }

    if (
      dimension.band === 'weak' ||
      dimension.band === 'blocked' ||
      dimension.label.includes('No salary') ||
      dimension.label.includes('Posted date is unavailable')
    ) {
      weakReasons.push(dimension.label)
    }
  }

  if (job.feedbackReasons && job.feedbackReasons.length > 0) {
    if ((job.feedbackScoreDelta ?? 0) >= 0.6) {
      strongReasons.push(job.feedbackReasons[0] ?? '')
    } else if ((job.feedbackScoreDelta ?? 0) <= -0.6) {
      weakReasons.push(job.feedbackReasons[0] ?? '')
    }
  }

  return {
    strongReasons: strongReasons.filter(Boolean).slice(0, 3),
    weakReasons: weakReasons.filter(Boolean).slice(0, 3),
  }
}

function buildQueueReason(segment: QueueSegment, weakReasons: string[]) {
  const primaryWeakness = weakReasons[0]

  switch (segment) {
    case 'apply_now':
      return 'Recent fit with clear market coverage and enough signal to act now.'
    case 'worth_reviewing':
      return primaryWeakness
        ? `Strong enough to keep active, but ${lowerFirst(primaryWeakness)}`
        : 'Strong enough to stay active, but it still needs one closer review.'
    case 'monitor':
      return primaryWeakness
        ? `Keep this in view, but ${lowerFirst(primaryWeakness)}`
        : 'Keep this in view, but it is not ready for action today.'
    default:
      return primaryWeakness
        ? `Hidden because ${lowerFirst(primaryWeakness)}`
        : 'Hidden because a hard gate failed or the role is too weak for the active queue.'
  }
}

export function applyQualificationEngine(
  jobs: RankedJobRecord[],
  profile: OperatorProfileRecord,
): QualifiedJobRecord[] {
  const scope = buildOperatorScope(profile)

  return jobs
    .map((job) => {
      const eligibility = assessEligibility(job)
      const roleFit = assessRoleFit(job)
      const marketFit = assessMarketFit(job, scope)
      const freshnessAssessment = assessFreshness(job)
      const portfolioFitSignal = assessPortfolioFit(job, scope)
      const compensationSignal = assessCompensationSignal(job, scope)
      const applicationFriction = assessApplicationFriction(job, scope)
      const baseScore = job.personalizedScore ?? job.totalScore
      const queueScore = roundScore(
        baseScore +
          freshnessAssessment.dimension.score +
          marketFit.score +
          eligibility.score +
          applicationFriction.score +
          compensationSignal.score * 0.35,
      )
      const queueSegment = buildQueueSegment(
        job,
        queueScore,
        {
          applicationFriction,
          compensationSignal,
          eligibility,
          freshness: freshnessAssessment.dimension,
          marketFit,
          roleFit,
        },
        freshnessAssessment.stale,
      )
      const { strongReasons, weakReasons } = buildReasonBuckets(job, {
        applicationFriction,
        compensationSignal,
        eligibility,
        freshness: freshnessAssessment.dimension,
        marketFit,
        portfolioFitSignal,
        roleFit,
      })

      return {
        ...job,
        applicationFriction,
        compensationSignal,
        daysSincePosted: freshnessAssessment.daysSincePosted,
        eligibility,
        freshness: freshnessAssessment.dimension,
        marketFit,
        portfolioFitSignal,
        queueReason: buildQueueReason(queueSegment, weakReasons),
        queueScore,
        queueSegment,
        roleFit,
        stale: freshnessAssessment.stale,
        strongReasons,
        weakReasons,
      }
    })
    .sort((left, right) => {
      if (left.queueSegment !== right.queueSegment) {
        return segmentOrder[left.queueSegment] - segmentOrder[right.queueSegment]
      }

      if (left.queueScore !== right.queueScore) {
        return right.queueScore - left.queueScore
      }

      if ((left.daysSincePosted ?? Number.MAX_SAFE_INTEGER) !== (right.daysSincePosted ?? Number.MAX_SAFE_INTEGER)) {
        return (left.daysSincePosted ?? Number.MAX_SAFE_INTEGER) - (right.daysSincePosted ?? Number.MAX_SAFE_INTEGER)
      }

      const leftBase = left.personalizedScore ?? left.totalScore
      const rightBase = right.personalizedScore ?? right.totalScore

      return rightBase - leftBase
    })
}
