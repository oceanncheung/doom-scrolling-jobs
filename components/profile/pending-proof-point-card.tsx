'use client'

import { useActionState } from 'react'

import {
  reviewEvidenceEntryAction,
  type ProfileActionState,
} from '@/app/profile/actions'
import { AutoSizeTextarea } from '@/components/ui/auto-size-textarea'
import type { EvidenceBankEntryRecord } from '@/lib/domain/evidence'

interface PendingProofPointCardProps {
  entry: EvidenceBankEntryRecord
  indexNumber: number
}

const INITIAL_ACTION_STATE: ProfileActionState = { message: '', status: 'idle' }

/**
 * Render an evidence_bank entry using the same repeat-card structure as hand-authored
 * proof points. Pending entries show Confirm + Discard; confirmed entries show Discard
 * only. The visual format (Label / Context / Supporting points) is identical to
 * hand-authored entries — pulled data just uses readOnly textareas so the operator can't
 * accidentally over-edit extracted text before confirming.
 */
export function PendingProofPointCard({ entry, indexNumber }: PendingProofPointCardProps) {
  const [state, formAction, isPending] = useActionState(
    reviewEvidenceEntryAction,
    INITIAL_ACTION_STATE,
  )
  const isConfirmed = Boolean(entry.confirmedAt)

  // Map the extracted evidence fields to the repeat-card's Label / Context / Supporting
  // points contract. The Label takes the client name; Context combines the scope and
  // industry tags with the one-line summary; Supporting points become the bullets.
  const labelText = entry.clientName || entry.summary || ''
  const contextParts: string[] = []
  if (entry.summary && entry.summary !== entry.clientName) contextParts.push(entry.summary)
  if (entry.scope.length > 0) contextParts.push(`Scope: ${entry.scope.join(', ')}`)
  if (entry.industryTags.length > 0) contextParts.push(`Industry: ${entry.industryTags.join(', ')}`)
  const contextText = contextParts.join(' · ')
  const bulletItems = entry.proofPoints.length > 0
    ? entry.proofPoints
    : entry.summary
      ? [entry.summary]
      : []

  const statusLabel = isConfirmed ? 'Confirmed · from portfolio' : 'Pending review · from portfolio'

  return (
    <article className="repeat-card repeat-card--from-source" aria-busy={isPending}>
      <div className="repeat-card-header">
        <strong>
          Proof point {indexNumber}
          <span className="repeat-card-source-tag"> · {statusLabel}</span>
        </strong>
        <div className="repeat-card-header-actions">
          {!isConfirmed ? (
            <form action={formAction}>
              <input type="hidden" name="entryId" value={entry.id} />
              <input type="hidden" name="intent" value="confirm" />
              <button
                className="button button-secondary button-small"
                disabled={isPending}
                type="submit"
              >
                {isPending ? 'Updating…' : 'Confirm'}
              </button>
            </form>
          ) : null}
          <form action={formAction}>
            <input type="hidden" name="entryId" value={entry.id} />
            <input type="hidden" name="intent" value="discard" />
            <button
              className="button button-ghost button-small"
              disabled={isPending}
              type="submit"
            >
              Discard
            </button>
          </form>
        </div>
      </div>
      <div className="repeat-card-proof-grid">
        <div className="repeat-card-proof-stack">
          <label className="field settings-field-autosize repeat-card-proof-label">
            <span>Label</span>
            <AutoSizeTextarea
              name="pendingProofPointLabel"
              onChange={() => {}}
              readOnly
              value={labelText}
            />
          </label>
          <label className="field settings-field-autosize repeat-card-proof-context">
            <span>Context</span>
            <AutoSizeTextarea
              name="pendingProofPointContext"
              onChange={() => {}}
              readOnly
              value={contextText}
            />
          </label>
        </div>
        <label className="field repeat-card-proof-bullets">
          <span>Supporting points</span>
          <AutoSizeTextarea
            className="proof-bank-bullets-textarea"
            name="pendingProofPointBullets"
            onChange={() => {}}
            readOnly
            value={bulletItems.map((item) => `• ${item}`).join('\n')}
          />
        </label>
      </div>
      {state.status === 'error' && state.message ? (
        <p className="repeat-card-source-message">{state.message}</p>
      ) : null}
    </article>
  )
}
