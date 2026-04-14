import { OperatorAccessForm } from '@/components/operators/operator-access-form'
import { OperatorCreateForm } from '@/components/operators/operator-create-form'
import { WorkspaceRailShell } from '@/components/navigation/workspace-rail-shell'
import { WorkspaceSurface } from '@/components/navigation/workspace-surface'
import { PageIntroHeader } from '@/components/ui/page-intro-header'
import { getOperatorSessionState } from '@/lib/data/operators'

export async function OperatorEntryScreen() {
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
          label="Welcome"
          note="Choose an account to enter the app."
          title="Sign in"
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
