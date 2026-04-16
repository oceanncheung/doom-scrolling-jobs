'use client'

import type { ReactNode } from 'react'

export type ActionFormStatus = 'error' | 'idle' | 'success'

export interface ActionFormStateLike {
  message: string
  status: ActionFormStatus
}

export const initialActionFormState: ActionFormStateLike = {
  message: '',
  status: 'idle',
}

interface ActionFormMessageProps {
  className?: string
  message?: string | null
  status: ActionFormStatus
  tone: 'action-note' | 'form-message'
  wrapperClassName?: string
}

export function getActionFormMessage(options: {
  canEdit: boolean
  disabledReason?: string
  state: ActionFormStateLike
}) {
  return options.canEdit ? options.state.message : options.disabledReason ?? ''
}

export function getPendingActionLabel(options: {
  defaultLabel: string
  isPending: boolean
  pendingLabel?: string
}) {
  return options.isPending ? options.pendingLabel ?? 'Saving...' : options.defaultLabel
}

function getToneClassName(tone: 'action-note' | 'form-message', status: ActionFormStatus) {
  if (status === 'success') {
    return tone === 'action-note' ? 'action-note-success' : 'form-message-success'
  }

  if (status === 'error') {
    return tone === 'action-note' ? 'action-note-error' : 'form-message-error'
  }

  return ''
}

export function ActionFormMessage({
  className,
  message,
  status,
  tone,
  wrapperClassName,
}: ActionFormMessageProps) {
  if (!message) {
    return null
  }

  const toneClassName = getToneClassName(tone, status)
  const messageNode = (
    <p className={[tone, toneClassName, className].filter(Boolean).join(' ')}>
      {message}
    </p>
  )

  return wrapperClassName ? <div className={wrapperClassName}>{messageNode}</div> : messageNode
}

export function createStageActionFormChildren(options: {
  buttonClassName: string
  buttonLabel: ReactNode
  hiddenFields: Array<{ name: string; value: string }>
  isDisabled: boolean
  message?: string
  messageStatus: ActionFormStatus
  showMessage: boolean
}) {
  const children: ReactNode[] = options.hiddenFields.map(({ name, value }) => (
    <input key={name} name={name} type="hidden" value={value} />
  ))

  children.push(
    <button key="submit" className={options.buttonClassName} disabled={options.isDisabled} type="submit">
      <span className="button__label">{options.buttonLabel}</span>
    </button>,
  )

  if (options.showMessage) {
    children.push(
      <ActionFormMessage
        key="message"
        message={options.message}
        status={options.messageStatus}
        tone="action-note"
      />,
    )
  }

  return children
}
