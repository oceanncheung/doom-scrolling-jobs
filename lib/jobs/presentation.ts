import type { QualifiedJobRecord, RankedJobRecord } from '@/lib/jobs/contracts'

const compactRegionMap: Array<[RegExp, string]> = [
  [/\bUnited States\b/gi, 'US'],
  [/\bUSA\b/gi, 'US'],
  [/\bUnited Kingdom\b/gi, 'UK'],
  [/\bNorth America\b/gi, 'N. America'],
  [/\bLatin America\b/gi, 'LatAm'],
  [/\bAsia Pacific\b/gi, 'APAC'],
  [/\bSoutheast Asia\b/gi, 'SEA'],
]

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function compactLocationPhrase(value: string) {
  let compact = value.trim()

  for (const [pattern, replacement] of compactRegionMap) {
    compact = compact.replace(pattern, replacement)
  }

  compact = compact
    .replace(/\bremote\b/gi, '')
    .replace(/\bonly\b/gi, '')
    .replace(/\bpreferred\b/gi, '')
    .replace(/\bcandidates?\b/gi, '')
    .replace(/\bbased\b/gi, '')
    .replace(/\s*[\(\)]\s*/g, ' ')
    .replace(/\s*[|/]\s*/g, ' / ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,./\s-]+|[,./\s-]+$/g, '')

  const segments = compact
    .split(/\s*\/\s*|\s*,\s*/)
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (segments.length > 2) {
    return `${segments.slice(0, 2).join(' / ')} +${segments.length - 2}`
  }

  return segments.join(' / ') || compact
}

export function formatRecommendationLabel(value: RankedJobRecord['recommendationLevel']) {
  return value.replaceAll('_', ' ')
}

export function formatWorkflowLabel(value: RankedJobRecord['workflowStatus']) {
  switch (value) {
    case 'shortlisted':
      return 'Saved'
    case 'preparing':
      return 'Preparing packet'
    case 'ready_to_apply':
      return 'Ready'
    case 'follow_up_due':
      return 'Follow-up due'
    default:
      return value.replaceAll('_', ' ')
  }
}

export function formatQueueSegmentLabel(value: QualifiedJobRecord['queueSegment']) {
  return value.replaceAll('_', ' ')
}

export function formatRemoteLabel(job: RankedJobRecord) {
  if (job.remoteType !== 'remote') {
    return toTitleCase(job.remoteType.replaceAll('_', ' '))
  }

  const compactRegions = job.remoteRegions
    .map((region) => compactLocationPhrase(region))
    .filter(Boolean)

  if (compactRegions.length === 0) {
    return 'Remote'
  }

  const uniqueRegions = compactRegions.filter((region, index, values) => values.indexOf(region) === index)

  return `Remote · ${uniqueRegions.join(' / ')}`
}

export function formatSalaryRange(
  job: RankedJobRecord,
  options?: {
    period?: RankedJobRecord['salaryPeriod']
  },
) {
  if (!job.salaryCurrency || (!job.salaryMin && !job.salaryMax)) {
    return 'Salary not listed'
  }

  const formatter = new Intl.NumberFormat('en-US', {
    currency: job.salaryCurrency,
    maximumFractionDigits: 0,
    style: 'currency',
  })
  const period = options?.period ?? job.salaryPeriod
  const suffix =
    period === 'hourly'
      ? ' / hr'
      : period === 'daily'
        ? ' / day'
        : period === 'weekly'
          ? ' / wk'
          : period === 'monthly'
            ? ' / mo'
            : ''

  if (job.salaryMin && job.salaryMax) {
    return `${formatter.format(job.salaryMin)} - ${formatter.format(job.salaryMax)}${suffix}`
  }

  if (job.salaryMin) {
    return `${formatter.format(job.salaryMin)}+${suffix}`
  }

  return `Up to ${formatter.format(job.salaryMax ?? 0)}${suffix}`
}

export function formatDateLabel(value?: string) {
  if (!value) {
    return 'Date unavailable'
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function formatSignedScore(value: number) {
  if (value === 0) {
    return '0'
  }

  return `${value > 0 ? '+' : '-'}${formatScore(Math.abs(value))}`
}

export function recommendationTone(value: RankedJobRecord['recommendationLevel']) {
  switch (value) {
    case 'strong_apply':
      return 'tone-strong'
    case 'apply_if_interested':
      return 'tone-apply'
    case 'consider_carefully':
      return 'tone-careful'
    default:
      return 'tone-skip'
  }
}

export function learningTone(value: number) {
  if (value > 0.4) {
    return 'tone-strong'
  }

  if (value < -0.4) {
    return 'tone-careful'
  }

  return 'tone-skip'
}
