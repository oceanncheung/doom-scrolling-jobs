import type { WorkflowStatus } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import {
  getWorkflowQueueView,
  isPrepOpenWorkflowStatus,
  isReadyWorkflowStatus,
} from '@/lib/jobs/workflow-state'

export function getJobReviewHref(jobId: string) {
  return `/jobs/${jobId}`
}

export function isJobPrepOpen(workflowStatus: WorkflowStatus) {
  return isPrepOpenWorkflowStatus(workflowStatus)
}

export function getInternalJobReviewLabel(workflowStatus: WorkflowStatus) {
  switch (getWorkflowQueueView(workflowStatus)) {
    case 'saved':
      if (workflowStatus === 'preparing') {
        return 'Continue generation'
      }

      return 'Generate Materials'
    case 'prepared':
    case 'applied':
      return 'Review'
    default:
      return 'Review'
  }
}

export function getApplyNextAction(job: Pick<QualifiedJobRecord, 'applicationUrl' | 'id' | 'sourceUrl' | 'workflowStatus'>) {
  if (isReadyWorkflowStatus(job.workflowStatus)) {
    return {
      external: true as const,
      href: job.applicationUrl ?? job.sourceUrl,
      label: 'Apply',
    }
  }

  return {
    external: false as const,
    href: getJobReviewHref(job.id),
    label: getInternalJobReviewLabel(job.workflowStatus),
  }
}
