import Link from 'next/link'
import { notFound } from 'next/navigation'

import { applicationPacketOutputs } from '@/lib/config/product'
import { getRankedJob } from '@/lib/data/jobs'
import {
  formatDateLabel,
  formatRecommendationLabel,
  formatRemoteLabel,
  formatSalaryRange,
  formatScore,
  formatWorkflowLabel,
  recommendationTone,
} from '@/lib/jobs/presentation'
import { scoringWeights } from '@/lib/scoring/weights'

export const dynamic = 'force-dynamic'

interface JobDetailPageProps {
  params: Promise<{
    jobId: string
  }>
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { jobId } = await params
  const { issue, job, source } = await getRankedJob(jobId)

  if (!job) {
    notFound()
  }

  const scoreBreakdown = [
    { label: 'Quality', value: job.qualityScore },
    { label: 'Salary', value: job.salaryScore },
    { label: 'Role relevance', value: job.roleRelevanceScore },
    { label: 'Seniority fit', value: job.seniorityScore },
    { label: 'Portfolio fit', value: job.portfolioFitScore },
    { label: 'Application effort', value: job.effortScore },
    { label: 'Penalty', value: job.penaltyScore },
  ]

  return (
    <main className="page-stack">
      <section className="hero-card hero-card-dashboard">
        <div className="hero-copy">
          <p className="eyebrow">{job.companyName}</p>
          <h1>{job.title}</h1>
          <p className="hero-lede">{job.fitSummary}</p>
          <div className="status-track">
            <span>{formatRemoteLabel(job)}</span>
            <span>{formatSalaryRange(job)}</span>
            <span>{job.seniorityLabel ?? 'seniority pending'}</span>
            <span>{formatWorkflowLabel(job.workflowStatus)}</span>
          </div>
          <div className="hero-actions">
            <Link className="button button-secondary" href="/dashboard">
              Back to jobs
            </Link>
            <a
              className="button button-primary"
              href={job.applicationUrl ?? job.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open application
            </a>
            <a className="button button-secondary" href={job.sourceUrl} rel="noreferrer" target="_blank">
              Open source listing
            </a>
          </div>
        </div>
        <div className="hero-summary">
          <p className="panel-label">Ranking snapshot</p>
          <ul className="compact-list">
            <li>
              <strong className={`tone-inline ${recommendationTone(job.recommendationLevel)}`}>
                {formatRecommendationLabel(job.recommendationLevel)}
              </strong>
              <span>Total score {formatScore(job.totalScore)} with remote gate passed.</span>
            </li>
            <li>
              <strong>{source}</strong>
              <span>{issue ?? 'The detail page is reading from the same ranked jobs feed as the dashboard.'}</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="panel-grid panel-grid-2">
        <article className="panel">
          <p className="panel-label">Role snapshot</p>
          <h2>What the normalized job record currently says.</h2>
          <ul className="compact-list">
            <li>
              <strong>Posted</strong>
              <span>{formatDateLabel(job.postedAt)}</span>
            </li>
            <li>
              <strong>Portfolio requirement</strong>
              <span>{job.portfolioRequired}</span>
            </li>
            <li>
              <strong>Employment type</strong>
              <span>{job.employmentType.replaceAll('_', ' ')}</span>
            </li>
            <li>
              <strong>Work authorization</strong>
              <span>{job.workAuthNotes ?? 'Not specified in the normalized record yet.'}</span>
            </li>
          </ul>
        </article>

        <article className="panel">
          <p className="panel-label">Score breakdown</p>
          <h2>The weighted model is visible at the job level instead of hidden behind one total.</h2>
          <ul className="score-list">
            {scoreBreakdown.map((row) => (
              <li key={row.label}>
                <div>
                  <strong>{row.label}</strong>
                  <span>
                    {scoringWeights.find(
                      (weight) => weight.label.toLowerCase() === row.label.toLowerCase(),
                    )?.description ?? 'Supporting scoring signal'}
                  </span>
                </div>
                <span className="score-pill">{formatScore(row.value)}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="panel-grid panel-grid-2">
        <article className="panel">
          <p className="panel-label">Why it fits</p>
          <h2>Current reasons pulled into the ranked view.</h2>
          <ul className="reason-list">
            {job.fitReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <p className="panel-label">Risks and gaps</p>
          <h2>What would need attention before a strong manual apply.</h2>
          <div className="page-stack">
            <div>
              <p className="panel-label subtle-label">Missing requirements</p>
              {job.missingRequirements.length > 0 ? (
                <ul className="reason-list">
                  {job.missingRequirements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>No meaningful gaps are recorded yet.</p>
              )}
            </div>
            <div>
              <p className="panel-label subtle-label">Red flags</p>
              {job.redFlags.length > 0 || job.redFlagNotes.length > 0 ? (
                <ul className="reason-list">
                  {[...job.redFlags, ...job.redFlagNotes].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>No active red flags are recorded for this role.</p>
              )}
            </div>
          </div>
        </article>
      </section>

      <section className="panel-grid panel-grid-2">
        <article className="panel">
          <p className="panel-label">Role detail</p>
          <h2>The normalized record is already useful enough to review before scoring logic gets fancier.</h2>
          <p>{job.descriptionText}</p>

          <div className="detail-group">
            <strong>Requirements</strong>
            <ul className="reason-list">
              {job.requirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="detail-group">
            <strong>Preferred qualifications</strong>
            <ul className="reason-list">
              {job.preferredQualifications.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="detail-group">
            <strong>Extracted skills</strong>
            <div className="job-card-tags">
              {job.skillsKeywords.map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
            </div>
          </div>
        </article>

        <article className="panel">
          <p className="panel-label">Packet prep preview</p>
          <h2>This role is now close enough to the future packet review screen to refine visually later.</h2>
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
    </main>
  )
}
