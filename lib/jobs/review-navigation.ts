import type { WorkflowStatus } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'

const prepOpenWorkflowStatuses = new Set<WorkflowStatus>([
  'shortlisted',
  'preparing',
  'ready_to_apply',
])

export function getJobReviewHref(jobId: string) {
  return `/jobs/${jobId}`
}

export function isJobPrepOpen(workflowStatus: WorkflowStatus) {
  return prepOpenWorkflowStatuses.has(workflowStatus)
}

export function getInternalJobReviewLabel(workflowStatus: WorkflowStatus) {
  switch (workflowStatus) {
    case 'shortlisted':
      return 'Prepare'
    case 'preparing':
      return 'Continue prep'
    case 'ready_to_apply':
    case 'applied':
    case 'follow_up_due':
    case 'interview':
      return 'Review'
    default:
      return 'Review'
  }
}

export function getApplyNextAction(job: Pick<QualifiedJobRecord, 'applicationUrl' | 'id' | 'sourceUrl' | 'workflowStatus'>) {
  if (job.workflowStatus === 'ready_to_apply') {
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
