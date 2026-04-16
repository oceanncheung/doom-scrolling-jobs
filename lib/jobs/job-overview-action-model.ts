import type { ApplicationPacketRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import { getPacketLifecycle } from '@/lib/jobs/packet-lifecycle'
import {
  isReadyWorkflowStatus,
  isScreeningWorkflowStatus,
} from '@/lib/jobs/workflow-state'

export type JobOverviewActionModel =
  | {
      kind: 'packet'
      generateLabel: string
      hasGeneratedContent: boolean
      layoutClass:
        | 'job-overview-actions--pair-right'
        | 'job-overview-actions--single-right'
        | 'job-overview-actions--triple-right'
      showArchive: boolean
      showRestore: boolean
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
    const packetLifecycle = getPacketLifecycle(packet)
    const hasGeneratedContent = packetLifecycle.hasGeneratedContent
    const showArchive = hasGeneratedContent && isReadyWorkflowStatus(job.workflowStatus)
    const showRestore = !hasGeneratedContent
    const slotCount =
      1 +
      (hasGeneratedContent ? 1 : 0) +
      (showArchive ? 1 : 0) +
      (showRestore ? 1 : 0)

    return {
      generateLabel:
        job.workflowStatus === 'preparing' && !hasGeneratedContent
          ? 'Continue generation'
          : 'Generate Materials',
      hasGeneratedContent,
      kind: 'packet',
      layoutClass:
        slotCount >= 3
          ? 'job-overview-actions--triple-right'
          : slotCount >= 2
            ? 'job-overview-actions--pair-right'
            : 'job-overview-actions--single-right',
      showArchive,
      showRestore,
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
