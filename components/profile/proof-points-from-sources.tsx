'use client'

import { useActionState } from 'react'

import {
  reviewEvidenceEntryAction,
  type ProfileActionState,
} from '@/app/profile/actions'
import type { EvidenceBankEntryRecord } from '@/lib/domain/evidence'

interface ProofPointsFromSourcesProps {
  /** Confirmed entries already in use by generation. Surfaced read-only with a
   *  "discard" affordance so the operator can retire one if it's no longer accurate. */
  confirmedEntries: EvidenceBankEntryRecord[]
  /** Entries that have been extracted but not yet reviewed. Require a confirm or
   *  discard before they feed generation. */
  pendingEntries: EvidenceBankEntryRecord[]
}

const INITIAL_ACTION_STATE: ProfileActionState = { message: '', status: 'idle' }

function formatPulledAt(timestamp: string | undefined): string {
  if (!timestamp) return ''
  try {
    return new Date(timestamp).toLocaleDateString('en-CA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

function EvidenceCard({ entry, state }: { entry: EvidenceBankEntryRecord; state: 'pending' | 'confirmed' }) {
  const [reviewState, reviewFormAction, reviewPending] = useActionState(
    reviewEvidenceEntryAction,
    INITIAL_ACTION_STATE,
  )
  const pulledLabel = formatPulledAt(entry.sourceFetchedAt ?? entry.createdAt)

  return (
    <article
      className={`proof-points-source-card proof-points-source-card--${state}`}
      aria-busy={reviewPending}
    >
      <header className="proof-points-source-card__header">
        <div className="proof-points-source-card__title">
          <strong>{entry.clientName || entry.summary || 'Untitled entry'}</strong>
          <span className="proof-points-source-card__meta">
            {state === 'pending' ? 'Pending review' : 'Confirmed'}
            {pulledLabel ? ` · pulled ${pulledLabel}` : ''}
            {entry.sourceKind ? ` · ${entry.sourceKind.replace(/_/g, ' ')}` : ''}
          </span>
        </div>
        <div className="proof-points-source-card__actions">
          {state === 'pending' ? (
            <form action={reviewFormAction}>
              <input type="hidden" name="entryId" value={entry.id} />
              <input type="hidden" name="intent" value="confirm" />
              <button
                className="button button-secondary button-small"
                disabled={reviewPending}
                type="submit"
              >
                {reviewPending ? 'Updating…' : 'Confirm'}
              </button>
            </form>
          ) : null}
          <form action={reviewFormAction}>
            <input type="hidden" name="entryId" value={entry.id} />
            <input type="hidden" name="intent" value="discard" />
            <button
              className="button button-ghost button-small"
              disabled={reviewPending}
              type="submit"
            >
              Discard
            </button>
          </form>
        </div>
      </header>
      <dl className="proof-points-source-card__body">
        {entry.summary && entry.summary !== entry.clientName ? (
          <div>
            <dt>Summary</dt>
            <dd>{entry.summary}</dd>
          </div>
        ) : null}
        {entry.industryTags.length > 0 ? (
          <div>
            <dt>Industry</dt>
            <dd>{entry.industryTags.join(' · ')}</dd>
          </div>
        ) : null}
        {entry.scope.length > 0 ? (
          <div>
            <dt>Scope</dt>
            <dd>{entry.scope.join(' · ')}</dd>
          </div>
        ) : null}
        {entry.tools.length > 0 ? (
          <div>
            <dt>Tools</dt>
            <dd>{entry.tools.join(' · ')}</dd>
          </div>
        ) : null}
        {entry.sourceSnapshotExcerpt ? (
          <div>
            <dt>From source</dt>
            <dd className="proof-points-source-card__excerpt">“{entry.sourceSnapshotExcerpt}”</dd>
          </div>
        ) : null}
      </dl>
      {reviewState.message ? (
        <p
          className={`proof-points-source-card__message proof-points-source-card__message--${reviewState.status}`}
        >
          {reviewState.message}
        </p>
      ) : null}
    </article>
  )
}

export function ProofPointsFromSources({ confirmedEntries, pendingEntries }: ProofPointsFromSourcesProps) {
  const hasAny = confirmedEntries.length > 0 || pendingEntries.length > 0
  if (!hasAny) {
    return (
      <aside className="proof-points-source-empty">
        <p>
          <strong>Pulled from your sources</strong>
        </p>
        <p>
          No proof points have been pulled yet. Add a portfolio link or personal website under Public links,
          then press refresh to pull them automatically.
        </p>
      </aside>
    )
  }

  return (
    <div className="proof-points-source-stack">
      <header className="proof-points-source-heading">
        <h3>Pulled from your sources</h3>
        <p>
          {pendingEntries.length > 0
            ? `${pendingEntries.length} pending review${pendingEntries.length === 1 ? '' : ''}. Confirm the ones you want referenced in tailored applications.`
            : 'All pulled entries have been reviewed. They feed both resume and cover-letter tailoring when the target job matches.'}
        </p>
      </header>
      {pendingEntries.map((entry) => (
        <EvidenceCard key={entry.id} entry={entry} state="pending" />
      ))}
      {confirmedEntries.map((entry) => (
        <EvidenceCard key={entry.id} entry={entry} state="confirmed" />
      ))}
    </div>
  )
}
