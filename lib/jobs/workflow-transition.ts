import type { SupabaseClient } from '@supabase/supabase-js'

import type { WorkflowStatus } from '@/lib/domain/types'
import {
  getWorkflowEventType,
  getWorkflowTransitionNote,
  type JobWorkflowQuickActionKind,
} from '@/lib/jobs/workflow-actions'

interface PersistJobWorkflowTransitionParams {
  actionKind: JobWorkflowQuickActionKind | null
  changedAt?: string
  currentStatus: WorkflowStatus | null
  eventPayload: Record<string, unknown>
  jobId: string
  operatorId: string
  scoreId: string
  supabase: SupabaseClient
  targetStatus: WorkflowStatus
  userId: string
}

interface PersistJobWorkflowTransitionResult {
  changedAt: string
  eventError: string | null
  updateError: string | null
}

export async function persistJobWorkflowTransition({
  actionKind,
  changedAt,
  currentStatus,
  eventPayload,
  jobId,
  operatorId,
  scoreId,
  supabase,
  targetStatus,
  userId,
}: PersistJobWorkflowTransitionParams): Promise<PersistJobWorkflowTransitionResult> {
  const transitionTime = changedAt ?? new Date().toISOString()
  const updateResult = await supabase
    .from('job_scores')
    .update({
      last_status_changed_at: transitionTime,
      workflow_status: targetStatus,
    })
    .eq('id', scoreId)
    .eq('operator_id', operatorId)

  if (updateResult.error) {
    return {
      changedAt: transitionTime,
      eventError: null,
      updateError: updateResult.error.message,
    }
  }

  const eventResult = await supabase.from('application_events').insert({
    operator_id: operatorId,
    user_id: userId,
    job_id: jobId,
    event_type: getWorkflowEventType(targetStatus),
    from_status: currentStatus,
    to_status: targetStatus,
    event_payload: eventPayload,
    notes: getWorkflowTransitionNote({
      actionKind,
      targetStatus,
    }),
  })

  return {
    changedAt: transitionTime,
    eventError: eventResult.error?.message ?? null,
    updateError: null,
  }
}
