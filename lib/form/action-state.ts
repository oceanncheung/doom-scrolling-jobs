/**
 * Shared shape for `useActionState` server-action results across the app. Every server
 * action (profile save, operator setup, job workflow mutation, packet generation, etc.)
 * returns this same envelope so form components can display a unified status + message.
 *
 * Individual action modules type-alias this (e.g. `export type ProfileActionState = ActionState`)
 * so their public exports stay named — React form code imports those named types for clarity,
 * and the underlying shape stays consistent.
 */
export type ActionStatus = 'error' | 'idle' | 'success'

export interface ActionState {
  message: string
  status: ActionStatus
}
