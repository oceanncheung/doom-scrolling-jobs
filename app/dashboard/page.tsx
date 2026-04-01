import { modelRouting } from '@/lib/ai/model-routing'
import { applicationPacketOutputs } from '@/lib/config/product'
import { recommendationLevels, workflowStatuses } from '@/lib/domain/types'
import { scoringWeights } from '@/lib/scoring/weights'

export default function DashboardPage() {
  return (
    <main className="page-stack">
      <section className="hero-card hero-card-dashboard">
        <div className="hero-copy">
          <p className="eyebrow">Dashboard shell</p>
          <h1>One profile in. Ranked remote jobs and prep-ready packets out.</h1>
          <p className="hero-lede">
            This route is the foundation workspace for the current single-user
            internal product. It already reflects the actual scoring priorities,
            packet outputs, and status pipeline described in the docs.
          </p>
        </div>
        <div className="hero-summary">
          <p className="panel-label">Recommendation bands</p>
          <ul className="compact-list">
            {recommendationLevels.map((level) => (
              <li key={level}>
                <strong>{level.replaceAll('_', ' ')}</strong>
                <span>Stored as structured ranking output, not loose copy.</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel-grid panel-grid-2">
        <article className="panel">
          <p className="panel-label">Scoring board</p>
          <h2>Current weight distribution</h2>
          <ul className="score-list">
            {scoringWeights.map((weight) => (
              <li key={weight.factor}>
                <div>
                  <strong>{weight.label}</strong>
                  <span>{weight.description}</span>
                </div>
                <span className="score-pill">{weight.points}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <p className="panel-label">Packet outputs</p>
          <h2>Every shortlisted job should become a complete manual-apply kit.</h2>
          <ul className="compact-list">
            {applicationPacketOutputs.map((item) => (
              <li key={item.label}>
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="panel-grid panel-grid-2">
        <article className="panel">
          <p className="panel-label">Workflow status model</p>
          <h2>The pipeline is explicit enough to power filters, reminders, and history.</h2>
          <div className="status-track">
            {workflowStatuses.map((status) => (
              <span key={status}>{status.replaceAll('_', ' ')}</span>
            ))}
          </div>
        </article>

        <article className="panel">
          <p className="panel-label">AI routing board</p>
          <h2>Task-specific model ownership stays visible at the code level.</h2>
          <ul className="routing-list">
            {modelRouting.map((route) => (
              <li key={route.task}>
                <div>
                  <strong>{route.label}</strong>
                  <span>{route.reason}</span>
                </div>
                <code>{route.provider}</code>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  )
}
