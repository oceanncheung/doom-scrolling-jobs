import type { WorkflowStatus } from '@/lib/domain/types'

export const queueViews = ['potential', 'saved', 'prepared', 'applied', 'archive'] as const

export type QueueView = (typeof queueViews)[number]

export const queueViewLabels: Record<QueueView, string> = {
  applied: 'Applied',
  archive: 'Archived',
  potential: 'Potential',
  prepared: 'Ready',
  saved: 'Saved',
}

export const queueViewWorkflowStatuses: Record<QueueView, readonly WorkflowStatus[]> = {
  applied: ['applied', 'follow_up_due', 'interview'],
  archive: ['archived', 'rejected'],
  potential: ['new', 'ranked'],
  prepared: ['ready_to_apply'],
  saved: ['shortlisted', 'preparing'],
}

const workflowQueueViewMap: Record<WorkflowStatus, QueueView> = {
  applied: 'applied',
  archived: 'archive',
  follow_up_due: 'applied',
  interview: 'applied',
  new: 'potential',
  preparing: 'saved',
  ranked: 'potential',
  ready_to_apply: 'prepared',
  rejected: 'archive',
  shortlisted: 'saved',
}

export function getQueueView(value: string | string[] | undefined): QueueView {
  const selected = Array.isArray(value) ? value[0] : value

  if (selected === 'ready') {
    return 'prepared'
  }

  return queueViews.find((view) => view === selected) ?? 'potential'
}

export function getQueueViewHref(view: QueueView) {
  if (view === 'potential') {
    return '/dashboard'
  }

  return `/dashboard?view=${view === 'prepared' ? 'ready' : view}`
}

export function getQueueViewLabel(view: QueueView) {
  return queueViewLabels[view]
}

export function getWorkflowQueueView(workflowStatus: WorkflowStatus): QueueView {
  return workflowQueueViewMap[workflowStatus]
}

export function matchesQueueView(workflowStatus: WorkflowStatus, view: QueueView) {
  return getWorkflowQueueView(workflowStatus) === view
}

export function isScreeningWorkflowStatus(workflowStatus: WorkflowStatus) {
  return matchesQueueView(workflowStatus, 'potential')
}

export function isSavedWorkflowStatus(workflowStatus: WorkflowStatus) {
  return matchesQueueView(workflowStatus, 'saved')
}

export function isReadyWorkflowStatus(workflowStatus: WorkflowStatus) {
  return matchesQueueView(workflowStatus, 'prepared')
}

export function isAppliedWorkflowStatus(workflowStatus: WorkflowStatus) {
  return matchesQueueView(workflowStatus, 'applied')
}

export function isArchivedWorkflowStatus(workflowStatus: WorkflowStatus) {
  return matchesQueueView(workflowStatus, 'archive')
}

export function isPrepOpenWorkflowStatus(workflowStatus: WorkflowStatus) {
  return isSavedWorkflowStatus(workflowStatus) || isReadyWorkflowStatus(workflowStatus)
}

export function shouldBeginPacketPrep(workflowStatus: WorkflowStatus) {
  return workflowStatus === 'new' || workflowStatus === 'ranked' || workflowStatus === 'shortlisted'
}

export function shouldEnsurePacketWorkspace(workflowStatus: WorkflowStatus) {
  return workflowStatus === 'shortlisted' || workflowStatus === 'preparing'
}
