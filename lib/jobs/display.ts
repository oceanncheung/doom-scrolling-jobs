import type { OperatorProfileRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import { getMatchReason } from '@/lib/jobs/dashboard-queue'
import {
  formatRemoteLabel,
  formatScore,
} from '@/lib/jobs/presentation'
import { getEffectiveSalaryInsight } from '@/lib/jobs/salary-estimation'

export interface SalaryDisplay {
  label: string
  note?: string
  value: string
}

export function getSalaryDisplay(
  job: QualifiedJobRecord,
  profile: OperatorProfileRecord,
): SalaryDisplay {
  const insight = getEffectiveSalaryInsight(job, profile)

  return {
    label: insight.label,
    note: insight.note,
    value: insight.value,
  }
}

export function getLocationDisplay(job: QualifiedJobRecord) {
  const remoteLabel = formatRemoteLabel(job)
  const locationLabel = job.locationLabel?.trim()

  if (!locationLabel) {
    return remoteLabel
  }

  if (
    job.remoteType === 'remote' &&
    (locationLabel.toLowerCase() === 'remote' || remoteLabel.toLowerCase().startsWith('remote ·'))
  ) {
    return remoteLabel
  }

  if (
    remoteLabel.toLowerCase() === locationLabel.toLowerCase() ||
    remoteLabel.toLowerCase().includes(locationLabel.toLowerCase())
  ) {
    return remoteLabel
  }

  return `${remoteLabel} · ${locationLabel}`
}

export function getRiskReason(job: QualifiedJobRecord) {
  return job.weakReasons[0] ?? 'No major gaps noted yet.'
}

export function getFreshnessLabel(job: QualifiedJobRecord) {
  if (job.stale || job.freshness.band === 'blocked') {
    return 'stale'
  }

  if (typeof job.daysSincePosted === 'number' && job.daysSincePosted <= 10) {
    return 'fresh'
  }

  return 'aging'
}

export function formatFitBand(job: QualifiedJobRecord) {
  switch (job.roleFit.band) {
    case 'strong':
      return {
        label: 'Strong fit',
        score: formatScore(job.personalizedScore ?? job.totalScore),
      }
    case 'good':
      return {
        label: 'Good fit',
        score: formatScore(job.personalizedScore ?? job.totalScore),
      }
    default:
      return {
        label: 'Stretch',
        score: formatScore(job.personalizedScore ?? job.totalScore),
      }
  }
}

export function toPlainDescription(value: string) {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getDescriptionExcerpt(job: QualifiedJobRecord) {
  if (job.aiDescriptionExcerpt?.trim()) {
    return job.aiDescriptionExcerpt.trim()
  }

  const text = toPlainDescription(job.descriptionText)

  if (!text) {
    return 'Description excerpt unavailable.'
  }

  if (text.length <= 280) {
    return text
  }

  return `${text.slice(0, 277).trimEnd()}...`
}

export function formatSourceLinkLabel(job: { sourceName: string }) {
  const name = job.sourceName?.trim()
  return name ? `Source: ${name}` : 'Source'
}

export { getMatchReason }
