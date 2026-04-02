import type { RankedJobRecord } from '@/lib/jobs/contracts'

export function formatRecommendationLabel(value: RankedJobRecord['recommendationLevel']) {
  return value.replaceAll('_', ' ')
}

export function formatWorkflowLabel(value: RankedJobRecord['workflowStatus']) {
  return value.replaceAll('_', ' ')
}

export function formatRemoteLabel(job: RankedJobRecord) {
  if (job.remoteType !== 'remote') {
    return job.remoteType
  }

  if (job.remoteRegions.length === 0) {
    return 'remote'
  }

  return `remote · ${job.remoteRegions.join(', ')}`
}

export function formatSalaryRange(job: RankedJobRecord) {
  if (!job.salaryCurrency || (!job.salaryMin && !job.salaryMax)) {
    return 'Salary not listed'
  }

  const formatter = new Intl.NumberFormat('en-US', {
    currency: job.salaryCurrency,
    maximumFractionDigits: 0,
    style: 'currency',
  })

  if (job.salaryMin && job.salaryMax) {
    return `${formatter.format(job.salaryMin)} - ${formatter.format(job.salaryMax)}`
  }

  if (job.salaryMin) {
    return `${formatter.format(job.salaryMin)}+`
  }

  return `Up to ${formatter.format(job.salaryMax ?? 0)}`
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
