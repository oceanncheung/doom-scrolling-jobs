'use client'

import { useActionState } from 'react'

import { createOperator, type OperatorSetupActionState } from '@/app/operators/actions'
import { TodayBlockHeading } from '@/components/ui/today-block-heading'

const initialState: OperatorSetupActionState = {
  message: '',
  status: 'idle',
}

export function OperatorCreateForm({ hasOperators }: { hasOperators: boolean }) {
  const [state, formAction, isPending] = useActionState(createOperator, initialState)

  return (
    <section className="today-block operator-create-rail-block">
      <TodayBlockHeading
        label={hasOperators ? 'First time using DSJ?' : 'First account'}
        title={hasOperators ? 'Create account' : 'Create the first account'}
      />

      <p className="profile-note">
        Add another internal workspace profile for this browser session.
      </p>

      <form action={formAction} className="operator-setup-form operator-setup-form--rail">
        <div className="profile-fields">
          <label className="field">
            <span>Display name</span>
            <input name="displayName" placeholder="Ocean" required type="text" />
          </label>

          <label className="field">
            <span>Email</span>
            <input name="email" placeholder="ocean@example.com" required type="email" />
          </label>
        </div>

        <button className="button button-primary" disabled={isPending} type="submit">
          {isPending ? 'Saving...' : 'Create Account'}
        </button>

        {state.message ? (
          <p className={`form-message ${state.status === 'error' ? 'form-message-error' : ''}`}>
            {state.message}
          </p>
        ) : null}
      </form>
    </section>
  )
}
