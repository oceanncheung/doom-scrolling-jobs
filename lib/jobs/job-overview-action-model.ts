import type { ApplicationPacketRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import {
  isReadyWorkflowStatus,
  isScreeningWorkflowStatus,
} from '@/lib/jobs/workflow-state'

export type JobOverviewActionModel =
  | {
      kind: 'prep'
      layoutClass:
        | 'job-overview-actions--pair-right'
        | 'job-overview-actions--single-right'
        | 'job-overview-actions--triple-right'
      hasGeneratedContent: boolean
      showReviewAnchor: boolean
      showShortlistArchive: boolean
    }
  | {
      kind: 'ready-to-apply'
      layoutClass: 'job-overview-actions--pair-right'
    }
  | {
      kind: 'screening'
      layoutClass: 'job-overview-actions--pair-right'
    }

export function getJobOverviewActionModel({
  job,
  packet,
  prepOpen,
  screeningLocked,
}: {
  job: QualifiedJobRecord
  packet: ApplicationPacketRecord
  prepOpen: boolean
  screeningLocked: boolean
}): JobOverviewActionModel | null {
  if (screeningLocked) {
    return null
  }

  if (prepOpen) {
    if (isReadyWorkflowStatus(job.workflowStatus)) {
      return {
        kind: 'ready-to-apply',
        layoutClass: 'job-overview-actions--pair-right',
      }
    }

    const hasGeneratedContent = packet.generationStatus === 'generated'
    const showShortlistArchive = job.workflowStatus === 'shortlisted'
    const slotCount = 1 + (hasGeneratedContent ? 1 : 0) + (showShortlistArchive ? 1 : 0)

    return {
      hasGeneratedContent,
      kind: 'prep',
      layoutClass:
        slotCount >= 3
          ? 'job-overview-actions--triple-right'
          : slotCount >= 2
            ? 'job-overview-actions--pair-right'
            : 'job-overview-actions--single-right',
      showReviewAnchor: hasGeneratedContent,
      showShortlistArchive,
    }
  }

  if (isScreeningWorkflowStatus(job.workflowStatus)) {
    return {
      kind: 'screening',
      layoutClass: 'job-overview-actions--pair-right',
    }
  }

  return null
}
