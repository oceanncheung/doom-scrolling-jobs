'use client'

import { selectOperator } from '@/app/operators/actions'
import type { OperatorRecord } from '@/lib/domain/types'

interface OperatorAccessFormProps {
  activeOperatorId?: string
  operators: OperatorRecord[]
  sectionId?: string
}

export function OperatorAccessForm({
  activeOperatorId,
  operators,
  sectionId,
}: OperatorAccessFormProps) {
  return (
    <div className="operator-access-shell">
      {operators.length > 0 ? (
        <section className="operator-list" id={sectionId} aria-label="Available operators">
          {operators.map((operator) => {
            const isActive = operator.id === activeOperatorId

            return (
              <form action={selectOperator} className="operator-row" key={operator.id}>
                <input name="operatorId" type="hidden" value={operator.id} />
                {/*
                 * .u-grid-cell contract (see app/styles/utilities/grid.css, Commits 3/4b):
                 * first cell (name + email stack) gets u-grid-cell--first, second cell
                 * (status label) gets u-grid-cell. Breathing between cells is owned by
                 * .operator-row-button's `gap: 16px` (operators.css:229).
                 * Pure annotation; computed styles unchanged vs pre-4f.
                 */}
                <button className="operator-row-button" type="submit">
                  <span className="operator-row-main u-grid-cell--first">
                    <strong>{operator.displayName}</strong>
                    <span>{operator.email}</span>
                  </span>
                  <span className="operator-row-meta u-grid-cell">{isActive ? 'Signed in' : 'Sign in'}</span>
                </button>
              </form>
            )
          })}
        </section>
      ) : (
        <section className="empty-state operator-empty-state">
          <p className="panel-label">Accounts</p>
          <p>No accounts are available yet. Create one to start using the app.</p>
        </section>
      )}
    </div>
  )
}
