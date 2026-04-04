import { OperatorAccessForm } from '@/components/operators/operator-access-form'
import { WorkspaceRailShell } from '@/components/navigation/workspace-rail-shell'
import { WorkspaceSurface } from '@/components/navigation/workspace-surface'
import { getOperatorSessionState } from '@/lib/data/operators'

export const dynamic = 'force-dynamic'

export default async function OperatorsPage() {
  const session = await getOperatorSessionState()

  return (
    <main className="page-stack">
      <WorkspaceSurface
        rail={
          <WorkspaceRailShell className="today-rail">
            <section className="today-block">
              <div className="today-block-heading">
                <p className="panel-label">Accounts</p>
                <h2>Workspace</h2>
              </div>
              <p className="profile-note">Pick who is operating this browser session.</p>
            </section>
          </WorkspaceRailShell>
        }
      >
          <section className="page-header">
            <div className="page-heading">
              <p className="panel-label">Accounts</p>
              <h1>Choose An Account</h1>
              <p>Select the active workspace, or create a new internal account for this device.</p>
            </div>
          </section>

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
