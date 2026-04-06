import { OperatorAccessForm } from '@/components/operators/operator-access-form'
import { OperatorCreateForm } from '@/components/operators/operator-create-form'
import { WorkspaceRailShell } from '@/components/navigation/workspace-rail-shell'
import { WorkspaceSurface } from '@/components/navigation/workspace-surface'
import { PageIntroHeader } from '@/components/ui/page-intro-header'
import { getOperatorSessionState } from '@/lib/data/operators'

export const dynamic = 'force-dynamic'

export default async function OperatorsPage() {
  const session = await getOperatorSessionState()
  const hasOperators = session.operators.length > 0

  return (
    <main className="page-stack workspace-surface">
      <WorkspaceSurface
        rail={
          <WorkspaceRailShell className="today-rail">
            <OperatorCreateForm hasOperators={hasOperators} />
          </WorkspaceRailShell>
        }
      >
          <PageIntroHeader
            className="operator-page-header"
            label="Accounts"
            note="Select the active workspace for this browser session."
            title="Choose an account"
          />

          {session.issue ? (
            <section className="panel">
              <p className="panel-label">Setup required</p>
              <p>
                {session.issue} Run `supabase/migrations/0005_lightweight_operators.sql` in Supabase SQL
                Editor, then reload this page.
              </p>
            </section>
          ) : null}

          <OperatorAccessForm
            activeOperatorId={session.activeOperator?.id}
            operators={session.operators}
          />
      </WorkspaceSurface>
    </main>
  )
}
