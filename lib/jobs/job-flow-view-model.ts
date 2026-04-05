import type {
  OperatorProfileRecord,
} from '@/lib/domain/types'
import { hasOpenAIEnv } from '@/lib/env'
import type { ProfileReadinessPresentation } from '@/lib/profile/readiness-presentation'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import { getLocationDisplay, getSalaryDisplay } from '@/lib/jobs/display'
import { formatDateLabel, formatWorkflowLabel } from '@/lib/jobs/presentation'
import { isReadyWorkflowStatus } from '@/lib/jobs/workflow-state'

export interface JobFlowHeaderSnapshotItem {
  label: string
  value: string
}

export interface JobFlowHeaderViewModel {
  companyName: string
  introLines: string[]
  pageLabel: string
  snapshotItems: JobFlowHeaderSnapshotItem[]
  title: string
}

export interface JobFlowPageViewModel {
  canGenerate: boolean
  generationDisabledReason?: string
  header: JobFlowHeaderViewModel
  pageIntro: string
  pageLabel: string
}

function getDetailIntro(job: QualifiedJobRecord) {
  if (isReadyWorkflowStatus(job.workflowStatus)) {
    return 'Everything is lined up. Review the role, then apply when you want to move.'
  }

  if (job.workflowStatus === 'preparing') {
    return 'The application packet is already in progress. Review the role, then continue when you want.'
  }

  return ''
}

function getPrepIntro(job: QualifiedJobRecord) {
  if (isReadyWorkflowStatus(job.workflowStatus)) {
    return 'Your packet is ready. Review the materials, then apply when you want to submit.'
  }

  return ''
}

export function buildJobFlowHeaderViewModel({
  job,
  pageIntro,
  pageLabel,
  profile,
}: {
  job: QualifiedJobRecord
  pageIntro: string
  pageLabel: string
  profile: OperatorProfileRecord
}): JobFlowHeaderViewModel {
  const salaryDisplay = getSalaryDisplay(job, profile)

  return {
    companyName: job.companyName,
    introLines: [pageIntro, job.aiMatchSummary?.trim() ?? ''].filter(Boolean),
    pageLabel,
    snapshotItems: [
      {
        label: 'Remote / location',
        value: getLocationDisplay(job),
      },
      {
        label: 'Salary',
        value: salaryDisplay.value,
      },
      {
        label: 'Stage',
        value: formatWorkflowLabel(job.workflowStatus),
      },
      {
        label: 'Posted',
        value: formatDateLabel(job.postedAt),
      },
      {
        label: 'Freshness',
        value: job.freshness.label,
      },
    ],
    title: job.title,
  }
}

export function buildJobFlowPageViewModel({
  canSave,
  issue,
  job,
  prepOpen,
  profile,
  readinessPresentation,
  screeningLocked,
}: {
  canSave: boolean
  issue?: string
  job: QualifiedJobRecord
  prepOpen: boolean
  profile: OperatorProfileRecord
  readinessPresentation?: ProfileReadinessPresentation | null
  screeningLocked: boolean
}): JobFlowPageViewModel {
  const canGenerate = canSave && !screeningLocked && hasOpenAIEnv()
  const generationDisabledReason = !canSave
    ? issue
    : screeningLocked
      ? readinessPresentation?.generationDisabledReason ??
        'Complete your profile draft in Settings before preparing applications.'
      : !canGenerate
        ? 'Add the OpenAI server environment before generating application materials.'
        : issue
  const pageLabel = prepOpen ? 'Application packet' : 'Job review'
  const pageIntro = prepOpen ? getPrepIntro(job) : getDetailIntro(job)

  return {
    canGenerate,
    generationDisabledReason,
    header: buildJobFlowHeaderViewModel({
      job,
      pageIntro,
      pageLabel,
      profile,
    }),
    pageIntro,
    pageLabel,
  }
}
