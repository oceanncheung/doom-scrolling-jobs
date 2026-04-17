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

  const label = getInternalJobReviewLabel(job.workflowStatus)
  // "Generate Materials" / "Continue generation" should kick off generation as soon as the
  // user lands on the packet page — they already chose the action, no reason to make them
  // click again. The query param is consumed by GeneratePacketButton on mount.
  const wantsAutoGenerate = label === 'Generate Materials' || label === 'Continue generation'
  const baseHref = getJobReviewHref(job.id)
  const href = wantsAutoGenerate ? `${baseHref}?generate=1` : baseHref

  return {
    external: false as const,
    href,
    label,
  }
}
