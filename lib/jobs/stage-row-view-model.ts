import type { OperatorProfileRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import {
  formatFitBand,
  getFreshnessLabel,
  getLocationDisplay,
  getMatchReason,
  getSalaryDisplay,
} from '@/lib/jobs/display'

export interface StageRowSummary {
  fitLabel: string
  fitScore: string
  freshness: string
  location: string
  matchReason: string
  salaryLabel: string
  salaryValue: string
}

export function buildStageRowSummary(
  job: QualifiedJobRecord,
  profile: OperatorProfileRecord,
): StageRowSummary {
  const salary = getSalaryDisplay(job, profile)
  const fit = formatFitBand(job)

  return {
    fitLabel: fit.label,
    fitScore: fit.score,
    freshness: getFreshnessLabel(job),
    location: getLocationDisplay(job),
    matchReason: getMatchReason(job),
    salaryLabel: salary.label,
    salaryValue: salary.value,
  }
}
