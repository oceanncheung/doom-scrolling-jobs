import Link from 'next/link'
import { notFound } from 'next/navigation'

import { JobWorkflowControls } from '@/components/jobs/job-workflow-controls'
import { getRankedJob } from '@/lib/data/jobs'
import {
  formatDateLabel,
  formatQueueSegmentLabel,
  formatRecommendationLabel,
  formatRemoteLabel,
  formatSalaryRange,
  formatScore,
  formatWorkflowLabel,
  recommendationTone,
} from '@/lib/jobs/presentation'

export const dynamic = 'force-dynamic'

interface JobDetailPageProps {
  params: Promise<{
    jobId: string
  }>
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { jobId } = await params
  const { job, source } = await getRankedJob(jobId)

  if (!job) {
    notFound()
  }

  const actionsEnabled = source === 'database'
  const strongReasons = job.strongReasons.length > 0 ? job.strongReasons : job.fitReasons.slice(0, 3)
  const weakReasons =
    job.weakReasons.length > 0
      ? job.weakReasons
      : [...job.missingRequirements, ...job.redFlags, ...job.redFlagNotes].slice(0, 3)

  return (
    <main className="page-stack">
      <section className="page-header page-header-split">
        <div className="page-heading">
          <p className="panel-label">{job.companyName}</p>
          <h1>{job.title}</h1>
          <div className="status-track">
            <span>{formatRemoteLabel(job)}</span>
            <span>{formatSalaryRange(job)}</span>
            <span>{job.seniorityLabel ?? 'seniority pending'}</span>
            <span>{formatWorkflowLabel(job.workflowStatus)}</span>
          </div>
        </div>
        <div className="header-meta-grid">
          <article className="header-meta">
            <p className="panel-label">Queue</p>
            <p className={`row-tone ${recommendationTone(job.recommendationLevel)}`}>
              {formatQueueSegmentLabel(job.queueSegment)}
            </p>
            <p>Score {formatScore(job.queueScore)}</p>
          </article>
          <article className="header-meta">
            <p className="panel-label">Freshness</p>
            <p>{job.freshness.label}</p>
            <p>{formatRecommendationLabel(job.recommendationLevel)}</p>
          </article>
        </div>
      </section>

      <div className="job-row-links">
        <Link className="button button-secondary" href="/dashboard">
          Back to jobs
        </Link>
        <Link className="button button-secondary" href={`/jobs/${job.id}/packet`}>
          Packet
        </Link>
        <a
          className="button button-primary"
          href={job.applicationUrl ?? job.sourceUrl}
          rel="noreferrer"
          target="_blank"
        >
          Apply
        </a>
        <a className="button button-secondary" href={job.sourceUrl} rel="noreferrer" target="_blank">
          Source
        </a>
      </div>

      <section className="panel">
        <p className="panel-label">Status</p>
        <h2>Workflow</h2>
        <JobWorkflowControls
          canEdit={actionsEnabled}
          currentStatus={job.workflowStatus}
          disabledReason="This job is read-only in the fallback feed."
          jobId={job.id}
          sourceContext="job-detail"
        />
      </section>

      <section className="panel-grid panel-grid-2">
        <article className="panel">
          <p className="panel-label">Decision</p>
          <h2>Record</h2>
          <ul className="compact-list">
            <li>
              <strong>Queue</strong>
              <span>{formatQueueSegmentLabel(job.queueSegment)}</span>
            </li>
            <li>
              <strong>Posted</strong>
              <span>{formatDateLabel(job.postedAt)}</span>
            </li>
            <li>
              <strong>Eligibility</strong>
              <span>{job.eligibility.label}</span>
            </li>
            <li>
              <strong>Market fit</strong>
              <span>{job.marketFit.label}</span>
            </li>
            <li>
              <strong>Compensation</strong>
              <span>{job.compensationSignal.label}</span>
            </li>
            <li>
              <strong>Application friction</strong>
              <span>{job.applicationFriction.label}</span>
            </li>
          </ul>
        </article>

        <article className="panel">
          <p className="panel-label">Why this queue</p>
          <h2>Strengths</h2>
          <p>{job.queueReason}</p>
          <ul className="reason-list">
            {strongReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <p className="panel-label">What weakens it</p>
          <h2>Weaknesses</h2>
          <div className="page-stack">
            <div>
              <p className="panel-label subtle-label">Current tradeoffs</p>
              {weakReasons.length > 0 ? (
                <ul className="reason-list">
                  {weakReasons.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>No major blockers noted.</p>
              )}
            </div>
            <div>
              <p className="panel-label subtle-label">Open gaps</p>
              {job.missingRequirements.length > 0 || job.redFlags.length > 0 || job.redFlagNotes.length > 0 ? (
                <ul className="reason-list">
                  {[...job.missingRequirements, ...job.redFlags, ...job.redFlagNotes].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>No open gaps noted.</p>
              )}
            </div>
          </div>
        </article>
      </section>

      <section className="panel">
        <p className="panel-label">Role detail</p>
        <h2>Description</h2>
        <p>{job.descriptionText}</p>

        {job.requirements.length > 0 ? (
          <div className="detail-group">
            <strong>Requirements</strong>
            <ul className="reason-list">
              {job.requirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {job.preferredQualifications.length > 0 ? (
          <div className="detail-group">
            <strong>Preferred qualifications</strong>
            <ul className="reason-list">
              {job.preferredQualifications.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {job.skillsKeywords.length > 0 ? (
          <div className="detail-group">
            <strong>Skills</strong>
            <div className="job-card-tags">
              {job.skillsKeywords.map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}
