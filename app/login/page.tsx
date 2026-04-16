import { OperatorAccessForm } from '@/components/operators/operator-access-form'
import { getOperatorSessionState } from '@/lib/data/operators'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const session = await getOperatorSessionState()

  return (
    <main className="page-stack login-page">
      <section className="login-page-content" aria-labelledby="login-page-heading">
        <div className="login-page-heading">
          <p className="panel-label">Sign in</p>
          <h1 id="login-page-heading">Choose an account</h1>
          <p className="login-page-lead">
            Pick the profile you&rsquo;d like to continue with.
          </p>
        </div>
        <OperatorAccessForm
          activeOperatorId={session.activeOperator?.id}
          operators={session.operators}
          sectionId="operator-account-list"
        />
      </section>
    </main>
  )
}
