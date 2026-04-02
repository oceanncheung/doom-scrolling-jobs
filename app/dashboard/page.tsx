import Link from 'next/link'

import { applicationPacketOutputs } from '@/lib/config/product'
import { getRankedJobs } from '@/lib/data/jobs'
import { getOperatorProfile } from '@/lib/data/operator-profile'
import { recommendationLevels, workflowStatuses } from '@/lib/domain/types'
import {
  formatDateLabel,
  formatRecommendationLabel,
  formatRemoteLabel,
  formatSalaryRange,
  formatScore,
  formatWorkflowLabel,
  recommendationTone,
} from '@/lib/jobs/presentation'

export const dynamic = 'force-dynamic'

interface DashboardPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function asSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function buildDashboardHref(recommendation?: string, workflow?: string) {
  const params = new URLSearchParams()

  if (recommendation) {
    params.set('recommendation', recommendation)
  }

  if (workflow) {
    params.set('workflow', workflow)
  }

  return params.size > 0 ? `/dashboard?${params.toString()}` : '/dashboard'
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const selectedRecommendation = asSingleValue(resolvedSearchParams.recommendation)
  const selectedWorkflow = asSingleValue(resolvedSearchParams.workflow)
  const [{ issue, jobs, source }, { workspace }] = await Promise.all([
    getRankedJobs(),
    getOperatorProfile(),
  ])

  const filteredJobs = jobs.filter((job) => {
    const recommendationMatches =
      !selectedRecommendation || job.recommendationLevel === selectedRecommendation
    const workflowMatches = !selectedWorkflow || job.workflowStatus === selectedWorkflow

    return recommendationMatches && workflowMatches
  })

  return (
    <main className="page-stack">
      <section className="hero-card hero-card-dashboard">
        <div className="hero-copy">
          <p className="eyebrow">Ranked jobs</p>
          <h1>Remote design roles now have a real ranked queue behind the dashboard.</h1>
          <p className="hero-lede">
            This view reads the seeded internal operator, joins persisted `jobs` and `job_scores`,
            and falls back to deterministic sample rankings when Supabase is not ready yet.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/profile">
              Update operator workspace
            </Link>
            <a className="button button-secondary" href="#job-feed">
              Review ranked jobs
            </a>
          </div>
        </div>
        <div className="hero-summary">
          <p className="panel-label">Feed status</p>
          <ul className="compact-list">
            <li>
              <strong>{filteredJobs.length} visible jobs</strong>
              <span>{jobs.length} total ranked jobs in the current source set.</span>
            </li>
            <li>
              <strong>{source}</strong>
              <span>{issue ?? 'Supabase is serving the ranked jobs feed for the seeded operator.'}</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="panel-grid panel-grid-2">
        <article className="panel">
          <p className="panel-label">Active search brief</p>
          <h2>The dashboard should start from one freeform preference field, not a long intake form.</h2>
          <p>{workspace.profile.searchBrief}</p>
        </article>

        <article className="panel">
          <p className="panel-label">Recommendation filter</p>
          <h2>Move quickly between the strongest roles and the stretch options.</h2>
          <div className="filter-row">
            <Link
              className={`filter-chip ${!selectedRecommendation ? 'filter-chip-active' : ''}`}
              href={buildDashboardHref(undefined, selectedWorkflow)}
            >
              all bands
            </Link>
            {recommendationLevels.map((level) => (
              <Link
                key={level}
                className={`filter-chip ${
                  selectedRecommendation === level ? 'filter-chip-active' : ''
                }`}
                href={buildDashboardHref(level, selectedWorkflow)}
              >
                {formatRecommendationLabel(level)}
              </Link>
            ))}
          </div>
        </article>

        <article className="panel">
          <p className="panel-label">Workflow filter</p>
          <h2>Check the queue by status without losing the ranking model.</h2>
          <div className="filter-row">
            <Link
              className={`filter-chip ${!selectedWorkflow ? 'filter-chip-active' : ''}`}
              href={buildDashboardHref(selectedRecommendation, undefined)}
            >
              all statuses
            </Link>
            {workflowStatuses.map((status) => (
              <Link
                key={status}
                className={`filter-chip ${selectedWorkflow === status ? 'filter-chip-active' : ''}`}
                href={buildDashboardHref(selectedRecommendation, status)}
              >
                {formatWorkflowLabel(status)}
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="panel-grid panel-grid-2">
        <article className="panel">
          <p className="panel-label">Packet direction</p>
          <h2>The ranked list stays tied to the manual-apply prep outputs the product is meant to create.</h2>
          <ul className="compact-list">
            {applicationPacketOutputs.map((item) => (
              <li key={item.label}>
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <p className="panel-label">What unlocks Lovable</p>
          <h2>We should move into UI refinement after the packet review screen exists.</h2>
          <p>
            Profile workspace is done. Ranked jobs and detail are landing now. Once the packet
            review route is real too, Lovable becomes worth the polish pass because the core
            journey will stop shifting under the design.
          </p>
        </article>
      </section>

      <section className="page-stack" id="job-feed">
        {filteredJobs.length > 0 ? (
          filteredJobs.map((job) => (
            <article className="job-card panel" key={job.id}>
              <div className="job-card-header">
                <div>
                  <p className="panel-label">{job.companyName}</p>
                  <h2>{job.title}</h2>
                  <p className="job-card-meta">
                    {formatRemoteLabel(job)} · {formatSalaryRange(job)} · posted{' '}
                    {formatDateLabel(job.postedAt)}
                  </p>
                </div>
                <div className="job-card-score">
                  <span className={`tone-pill ${recommendationTone(job.recommendationLevel)}`}>
                    {formatRecommendationLabel(job.recommendationLevel)}
                  </span>
                  <span className="score-badge">{formatScore(job.totalScore)}</span>
                </div>
              </div>

              <p>{job.fitSummary}</p>

              <div className="job-card-tags">
                <span>{formatWorkflowLabel(job.workflowStatus)}</span>
                <span>{job.seniorityLabel ?? 'seniority pending'}</span>
                <span>{job.portfolioRequired === 'yes' ? 'portfolio required' : 'portfolio optional'}</span>
              </div>

              <ul className="reason-list">
                {job.fitReasons.slice(0, 3).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>

              {job.redFlags.length > 0 ? (
                <div className="inline-alert">
                  <strong>Watchouts:</strong> {job.redFlags.join(' · ')}
                </div>
              ) : null}

              <div className="job-card-footer">
                <div className="metric-inline">
                  <span>Quality {formatScore(job.qualityScore)}</span>
                  <span>Salary {formatScore(job.salaryScore)}</span>
                  <span>Role fit {formatScore(job.roleRelevanceScore)}</span>
                </div>
                <Link className="button button-secondary button-small" href={`/jobs/${job.id}`}>
                  Open detail
                </Link>
              </div>
            </article>
          ))
        ) : (
          <article className="panel empty-state">
            <p className="panel-label">No matches</p>
            <h2>The current filter combination cleared the list.</h2>
            <p>
              Reset the recommendation band or workflow filter to bring the ranked jobs back into
              view.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/dashboard">
                Reset filters
              </Link>
            </div>
          </article>
        )}
      </section>
    </main>
  )
}
