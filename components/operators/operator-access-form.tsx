'use client'

import { selectOperator } from '@/app/operators/actions'
import type { OperatorRecord } from '@/lib/domain/types'

interface OperatorAccessFormProps {
  activeOperatorId?: string
  operators: OperatorRecord[]
}

export function OperatorAccessForm({
  activeOperatorId,
  operators,
}: OperatorAccessFormProps) {
  return (
    <div className="operator-access-shell">
      {operators.length > 0 ? (
        <section className="operator-list" aria-label="Available operators">
          {operators.map((operator) => {
            const isActive = operator.id === activeOperatorId

            return (
              <form action={selectOperator} className="operator-row" key={operator.id}>
                <input name="operatorId" type="hidden" value={operator.id} />
                <button className="operator-row-button" type="submit">
                  <span className="operator-row-main">
                    <strong>{operator.displayName}</strong>
                    <span>{operator.email}</span>
                  </span>
                  <span className="operator-row-meta">{isActive ? 'Signed in' : 'Sign in'}</span>
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
