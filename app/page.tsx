import Link from 'next/link'

import { modelRouting } from '@/lib/ai/model-routing'
import { applicationPacketOutputs, foundationTracks, productRules } from '@/lib/config/product'
import { site } from '@/lib/config/site'
import { workflowStatuses } from '@/lib/domain/types'
import { hardFilters, scoringWeights } from '@/lib/scoring/weights'

export default function HomePage() {
  return (
    <main className="page-stack">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">Phase 1 foundation</p>
          <h1>{site.heroTitle}</h1>
          <p className="hero-lede">{site.description}</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/profile">
              Edit operator profile
            </Link>
            <Link className="button button-secondary" href="/dashboard">
              Open ranked jobs
            </Link>
            <a className="button button-secondary" href="#foundation-map">
              Inspect foundation map
            </a>
          </div>
        </div>
        <div className="hero-summary">
          <p className="panel-label">Application prep hub</p>
          <ul className="compact-list">
            {applicationPacketOutputs.map((item) => (
              <li key={item.label}>
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel-grid panel-grid-3">
        {productRules.map((rule) => (
          <article key={rule.title} className="panel">
            <p className="panel-label">{rule.kicker}</p>
            <h2>{rule.title}</h2>
            <p>{rule.description}</p>
          </article>
        ))}
      </section>

      <section className="panel-grid panel-grid-2">
        <article className="panel">
          <p className="panel-label">Hard filters</p>
          <h2>Jobs must clear the remote and trust gate before they compete.</h2>
          <ul className="tag-list">
            {hardFilters.map((filter) => (
              <li key={filter}>{filter}</li>
            ))}
          </ul>
        </article>
        <article className="panel">
          <p className="panel-label">Weighted scoring</p>
          <h2>Quality leads. Salary follows. Relevance keeps the list honest.</h2>
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
      </section>

      <section className="panel-grid panel-grid-2" id="foundation-map">
        <article className="panel">
          <p className="panel-label">Foundation map</p>
          <h2>The scaffold is organized around build lanes, not random folders.</h2>
          <div className="lane-list">
            {foundationTracks.map((track) => (
              <div key={track.title} className="lane-card">
                <div>
                  <strong>{track.title}</strong>
                  <p>{track.description}</p>
                </div>
                <code>{track.paths.join(' + ')}</code>
              </div>
            ))}
          </div>
        </article>
        <article className="panel">
          <p className="panel-label">Model routing</p>
          <h2>AI tasks stay separated so the system can evolve without one giant agent.</h2>
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

      <section className="panel">
        <p className="panel-label">Pipeline baseline</p>
        <h2>The first screen is already constrained to the real workflow.</h2>
        <div className="status-track">
          {workflowStatuses.map((status) => (
            <span key={status}>{status.replaceAll('_', ' ')}</span>
          ))}
        </div>
      </section>
    </main>
  )
}
