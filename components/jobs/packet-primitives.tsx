import Link from 'next/link'
import type { ReactNode } from 'react'

import { ChevronDownIcon } from '@/components/ui/icons/chevron-down-icon'
import { StatusIndicator } from '@/components/ui/status-indicator'

interface PacketStatusProps {
  ready: boolean
}

export function PacketStatus({ ready }: PacketStatusProps) {
  return (
    <StatusIndicator
      className="packet-material-status"
      dotClassName={`packet-material-status-dot ${
        ready ? 'packet-material-status-dot--ready' : 'packet-material-status-dot--pending'
      }`}
      label={ready ? 'Ready' : 'Pending'}
      tone={ready ? 'ready' : 'attention'}
    />
  )
}

export function PacketInlineNote({ children }: { children: ReactNode }) {
  return <div className="packet-inline-note">{children}</div>
}

interface PacketRemediationCalloutProps {
  actionHref?: string
  actionLabel?: string
  hint?: ReactNode
  lead?: ReactNode
}

export function PacketRemediationCallout({
  actionHref,
  actionLabel,
  hint,
  lead,
}: PacketRemediationCalloutProps) {
  return (
    <div className="packet-remediation-callout">
      {lead ? <p className="packet-remediation-callout__lead">{lead}</p> : null}
      {hint ? <p className="packet-remediation-callout__hint">{hint}</p> : null}
      {actionHref && actionLabel ? (
        <Link
          className="button button-secondary button-small packet-remediation-callout__action"
          href={actionHref}
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  )
}

export function PacketDisclosureCaret() {
  return (
    <span className="disclosure-caret" aria-hidden="true">
      <ChevronDownIcon />
    </span>
  )
}

interface PacketQuestionSummaryProps {
  answerReady: boolean
  index: number
  questionText: string
}

export function PacketQuestionSummary({
  answerReady,
  index,
  questionText,
}: PacketQuestionSummaryProps) {
  return (
    <summary className="disclosure-summary packet-question-summary">
      <div className="packet-question-main">
        <p className="upload-slot-label">Question {index + 1}</p>
        <h3>{questionText}</h3>
      </div>
      <div className="packet-question-status-slot">
        <PacketStatus ready={answerReady} />
      </div>
      <div className="disclosure-controls packet-question-controls">
        <PacketDisclosureCaret />
      </div>
    </summary>
  )
}
