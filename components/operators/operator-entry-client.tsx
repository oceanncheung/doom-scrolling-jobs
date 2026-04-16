'use client'

import Link from 'next/link'

import { WorkspaceRailShell } from '@/components/navigation/workspace-rail-shell'
import { WorkspaceSurface } from '@/components/navigation/workspace-surface'
import { OperatorCreateForm } from '@/components/operators/operator-create-form'
import { site } from '@/lib/config/site'
import type { OperatorRecord } from '@/lib/domain/types'

interface OperatorEntryClientProps {
  issue?: string
  operators: OperatorRecord[]
}

export function OperatorEntryClient({ issue, operators }: OperatorEntryClientProps) {
  const hasOperators = operators.length > 0

  return (
    <main className="page-stack workspace-surface">
      <WorkspaceSurface
        className="operator-entry-workspace"
        rail={
          <WorkspaceRailShell
            beforeScroll={
              <section className="today-rail-site-header site-brand site-brand--rail">
                <Link href="/">
                  <strong>{site.name}</strong>
                </Link>
              </section>
            }
            className="today-rail today-rail--split-scroll"
          >
            <OperatorCreateForm
              hasOperators={hasOperators}
              secondaryAction={
                hasOperators ? (
                  <Link
                    className="button button-secondary operator-entry-reveal-button"
                    href="/login"
                  >
                    <span className="button__label">Sign In</span>
                  </Link>
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
      </WorkspaceSurface>
    </main>
  )
}
