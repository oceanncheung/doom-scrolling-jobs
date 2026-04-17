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

/*
 * Workflow statuses that mean "the job is back in the potential pool" — when transitioning to
 * one of these, any previously generated packet content (resume version, cover letter draft,
 * AI summaries, generation metadata) should be reset so the user starts from a clean slate
 * if they later promote the job back to saved/ready and regenerate.
 */
const POTENTIAL_REGRESSION_STATUSES: ReadonlySet<WorkflowStatus> = new Set(['new', 'ranked'])

/*
 * Best-effort packet cleanup. Called after a successful status update when the target is
 * a potential bucket. We delete the resume_versions linked to the packet (the actual generated
 * resume content lives there), then null out the packet's generated text + metadata so the
 * next visit reads as "not_started" via inferPacketGenerationStatus(). Errors are logged but
 * not propagated — the transition itself already succeeded and the user shouldn't be blocked
 * from moving the job back if the cleanup hits a transient issue.
 */
async function resetGeneratedPacketContent({
  jobId,
  operatorId,
  supabase,
}: {
  jobId: string
  operatorId: string
  supabase: SupabaseClient
}): Promise<void> {
  const { data: packets, error: lookupError } = await supabase
    .from('application_packets')
    .select('id')
    .eq('job_id', jobId)
    .eq('operator_id', operatorId)

  if (lookupError) {
    console.error('Packet reset: failed to look up packets:', lookupError.message)
    return
  }

  const packetIds = (packets ?? []).map((row) => row.id)

  if (packetIds.length === 0) {
    return
  }

  // Detach + delete generated resume versions (they hold the tailored content separately).
  // Null the FK first so the packet update below doesn't trip on a stale resume_version_id.
  await supabase
    .from('application_packets')
    .update({ resume_version_id: null })
    .in('id', packetIds)

  const { error: resumeDeleteError } = await supabase
    .from('resume_versions')
    .delete()
    .in('application_packet_id', packetIds)

  if (resumeDeleteError) {
    console.error('Packet reset: failed to delete resume versions:', resumeDeleteError.message)
  }

  const { error: packetResetError } = await supabase
    .from('application_packets')
    .update({
      cover_letter_change_summary: null,
      cover_letter_draft: null,
      cover_letter_summary: null,
      generated_at: null,
      generation_error: null,
      generation_model: null,
      generation_prompt_version: null,
      generation_provider: null,
      generation_status: 'not_started',
      job_focus_summary: null,
      job_summary: null,
      last_reviewed_at: null,
      packet_status: 'draft',
      professional_summary: null,
      question_snapshot_error: null,
      question_snapshot_refreshed_at: null,
      question_snapshot_status: 'not_started',
    })
    .in('id', packetIds)

  if (packetResetError) {
    console.error('Packet reset: failed to clear packet fields:', packetResetError.message)
  }
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

  if (POTENTIAL_REGRESSION_STATUSES.has(targetStatus)) {
    await resetGeneratedPacketContent({ jobId, operatorId, supabase })
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
