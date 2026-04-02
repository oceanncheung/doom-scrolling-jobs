import Link from 'next/link'

import { JobWorkflowControls } from '@/components/jobs/job-workflow-controls'
import { getRankedJobs } from '@/lib/data/jobs'
import { recommendationLevels, workflowStatuses } from '@/lib/domain/types'
import type { QualifiedJobRecord, QueueSegment } from '@/lib/jobs/contracts'
import {
  formatQueueSegmentLabel,
  formatRecommendationLabel,
  formatRemoteLabel,
  formatSalaryRange,
  formatScore,
  formatWorkflowLabel,
} from '@/lib/jobs/presentation'

export const dynamic = 'force-dynamic'

interface DashboardPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const activeQueueSegments: Array<Exclude<QueueSegment, 'hidden'>> = [
  'apply_now',
  'worth_reviewing',
  'monitor',
]

const queueSectionCopy: Record<
  (typeof activeQueueSegments)[number],
  { note: string; title: string }
> = {
  apply_now: {
    note: 'Best current jobs to act on.',
    title: 'Apply Now',
  },
  monitor: {
    note: 'Keep visible, but do not act yet.',
    title: 'Monitor',
  },
  worth_reviewing: {
    note: 'Real candidates that still need a closer look.',
    title: 'Worth Reviewing',
  },
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

function getQueueReason(job: QualifiedJobRecord) {
  return job.queueReason
}

function JobIndex({
  actionsEnabled,
  jobs,
}: {
  actionsEnabled: boolean
  jobs: QualifiedJobRecord[]
}) {
  return (
    <section className="job-index">
      <header className="job-index-head">
        <span>Role / company</span>
        <span>Location</span>
        <span>Salary</span>
        <span>Score</span>
        <span>Status</span>
      </header>
      {jobs.map((job) => (
        <article className="job-row" key={job.id}>
          <div className="job-row-primary">
            <div className="job-row-title">
              <Link className="job-row-title-link" href={`/jobs/${job.id}`}>
                {job.title}
              </Link>
              <span>{job.companyName}</span>
            </div>
            <div className="job-row-cell">
              <strong>{formatRemoteLabel(job)}</strong>
            </div>
            <div className="job-row-cell">
              <strong>{formatSalaryRange(job)}</strong>
            </div>
            <div className="job-row-cell job-row-score">
              <strong>{formatScore(job.queueScore)}</strong>
              <span>{formatRecommendationLabel(job.recommendationLevel)}</span>
            </div>
            <div className="job-row-cell">
              <strong>{formatWorkflowLabel(job.workflowStatus)}</strong>
            </div>
          </div>

          <div className="job-row-secondary">
            <div className="job-row-summary">
              <p className="job-row-note">{getQueueReason(job)}</p>
            </div>

            <div className="job-row-tools">
              <div className="job-row-links">
                <Link className="button button-secondary button-small" href={`/jobs/${job.id}`}>
                  Detail
                </Link>
                <Link className="button button-secondary button-small" href={`/jobs/${job.id}/packet`}>
                  Packet
                </Link>
                <a
                  className="button button-secondary button-small"
                  href={job.applicationUrl ?? job.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Apply
                </a>
              </div>

              <JobWorkflowControls
                canEdit={actionsEnabled}
                compact
                currentStatus={job.workflowStatus}
                disabledReason="Switch the dashboard back to the database-backed feed to save workflow feedback."
                jobId={job.id}
                showDisabledNote={false}
                sourceContext="dashboard-row"
              />
            </div>
          </div>
        </article>
      ))}
    </section>
  )
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const selectedRecommendation = asSingleValue(resolvedSearchParams.recommendation)
  const selectedWorkflow = asSingleValue(resolvedSearchParams.workflow)
  const { jobs, source } = await getRankedJobs()
  const actionsEnabled = source === 'database'

  const filteredJobs = jobs.filter((job) => {
    const recommendationMatches =
      !selectedRecommendation || job.recommendationLevel === selectedRecommendation
    const workflowMatches = !selectedWorkflow || job.workflowStatus === selectedWorkflow

    return recommendationMatches && workflowMatches
  })

  const activeJobs = filteredJobs.filter((job) => job.queueSegment !== 'hidden')
  const hiddenJobs = filteredJobs.filter((job) => job.queueSegment === 'hidden')

  return (
    <main className="page-stack">
      <section className="page-header page-header-split">
        <div className="page-heading">
          <p className="panel-label">Jobs</p>
          <h1>Queue</h1>
        </div>
        <div className="header-meta-grid">
          <article className="header-meta">
            <p className="panel-label">Active</p>
            <p>
              {activeJobs.length} visible / {jobs.length} total
            </p>
          </article>
          <article className="header-meta">
            <p className="panel-label">Hidden</p>
            <p>{hiddenJobs.length} filtered out</p>
            <p>
              {selectedWorkflow
                ? formatWorkflowLabel(selectedWorkflow as (typeof workflowStatuses)[number])
                : selectedRecommendation
                  ? formatRecommendationLabel(
                      selectedRecommendation as (typeof recommendationLevels)[number],
                    )
                  : 'Current decision rules applied'}
            </p>
          </article>
        </div>
      </section>

      <section className="toolbar-grid">
        <article className="toolbar-block">
          <p className="panel-label">Recommendation</p>
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

        <article className="toolbar-block">
          <p className="panel-label">Workflow</p>
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

      {activeJobs.length > 0 ? (
        activeQueueSegments.map((segment) => {
          const segmentJobs = activeJobs.filter((job) => job.queueSegment === segment)

          if (segmentJobs.length === 0) {
            return null
          }

          return (
            <section className="queue-section" key={segment}>
              <div className="queue-section-header">
                <div>
                  <p className="panel-label">{formatQueueSegmentLabel(segment)}</p>
                  <h2>{queueSectionCopy[segment].title}</h2>
                </div>
                <p className="queue-section-meta">
                  {segmentJobs.length} jobs · {queueSectionCopy[segment].note}
                </p>
              </div>
              <JobIndex actionsEnabled={actionsEnabled} jobs={segmentJobs} />
            </section>
          )
        })
      ) : (
        <article className="empty-state">
          <p className="panel-label">No matches</p>
          <h2>No active jobs in this view.</h2>
          <div className="job-row-links">
            <Link className="button button-primary" href="/dashboard">
              Reset filters
            </Link>
          </div>
        </article>
      )}

      {hiddenJobs.length > 0 ? (
        <details className="panel disclosure" open={Boolean(selectedWorkflow)}>
          <summary className="disclosure-summary">
            <div>
              <p className="panel-label">Hidden</p>
              <h2>Filtered out</h2>
            </div>
            <span className="disclosure-meta">{hiddenJobs.length} jobs</span>
          </summary>
          <div className="disclosure-body">
            <JobIndex actionsEnabled={actionsEnabled} jobs={hiddenJobs} />
          </div>
        </details>
      ) : null}
    </main>
  )
}
