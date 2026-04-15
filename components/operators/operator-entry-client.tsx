'use client'

import { useState } from 'react'

import { WorkspaceRailShell } from '@/components/navigation/workspace-rail-shell'
import { WorkspaceSurface } from '@/components/navigation/workspace-surface'
import { OperatorAccessForm } from '@/components/operators/operator-access-form'
import { OperatorCreateForm } from '@/components/operators/operator-create-form'
import { LabeledHeading } from '@/components/ui/labeled-heading'
import { site } from '@/lib/config/site'
import type { OperatorRecord } from '@/lib/domain/types'

interface OperatorEntryClientProps {
  activeOperatorId?: string
  issue?: string
  operators: OperatorRecord[]
}

export function OperatorEntryClient({
  activeOperatorId,
  issue,
  operators,
}: OperatorEntryClientProps) {
  const hasOperators = operators.length > 0
  const [showSignIn, setShowSignIn] = useState(false)

  return (
    <main className="page-stack workspace-surface">
      <WorkspaceSurface
        className="operator-entry-workspace"
        rail={
          <WorkspaceRailShell
            beforeScroll={
              <section className="queue-meta today-rail-site-header settings-page-header">
                <LabeledHeading className="queue-meta-heading" title={site.name} titleLevel="h1" />
              </section>
            }
            className="today-rail today-rail--split-scroll"
          >
            <OperatorCreateForm
              hasOperators={hasOperators}
              secondaryAction={
                hasOperators ? (
                  <button
                    aria-controls="operator-account-list"
                    aria-expanded={showSignIn}
                    className="button button-secondary operator-entry-reveal-button"
                    onClick={() => setShowSignIn(true)}
                    type="button"
                  >
                    <span className="button__label">Sign In</span>
                  </button>
                ) : null
              }
            />
          </WorkspaceRailShell>
        }
      >
        {issue ? (
          <section className="panel">
            <p className="panel-label">Setup required</p>
            <p>
              {issue} Run `supabase/migrations/0005_lightweight_operators.sql` in Supabase SQL
              Editor, then reload this page.
            </p>
          </section>
        ) : null}

        {showSignIn ? (
          <OperatorAccessForm
            activeOperatorId={activeOperatorId}
            operators={operators}
            sectionId="operator-account-list"
          />
        ) : null}
      </WorkspaceSurface>
    </main>
  )
}
