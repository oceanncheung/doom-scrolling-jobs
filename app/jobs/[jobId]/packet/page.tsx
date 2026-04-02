import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ApplicationPacketForm } from '@/components/jobs/application-packet-form'
import { getApplicationPacketReview } from '@/lib/data/application-packets'
import {
  formatDateLabel,
  formatQueueSegmentLabel,
  formatRemoteLabel,
  formatSalaryRange,
  formatWorkflowLabel,
} from '@/lib/jobs/presentation'

export const dynamic = 'force-dynamic'

interface PacketReviewPageProps {
  params: Promise<{
    jobId: string
  }>
}

export default async function PacketReviewPage({ params }: PacketReviewPageProps) {
  const { jobId } = await params
  const { canSave, issue, job, packet } = await getApplicationPacketReview(jobId)

  if (!job || !packet) {
    notFound()
  }

  return (
    <main className="page-stack">
      <section className="page-header page-header-split">
        <div className="page-heading">
          <p className="panel-label">Packet</p>
          <h1>{job.title}</h1>
          <div className="status-track">
            <span>{job.companyName}</span>
            <span>{formatRemoteLabel(job)}</span>
            <span>{formatSalaryRange(job)}</span>
            <span>{formatWorkflowLabel(job.workflowStatus)}</span>
          </div>
        </div>
        <div className="header-meta-grid">
          <article className="header-meta">
            <p className="panel-label">Status</p>
            <p>{packet.packetStatus}</p>
            <p>{canSave ? 'Editable' : 'Read only'}</p>
          </article>
          <article className="header-meta">
            <p className="panel-label">Queue</p>
            <p>{formatQueueSegmentLabel(job.queueSegment)}</p>
            <p>{packet.generatedAt ? formatDateLabel(packet.generatedAt) : 'Current draft'}</p>
          </article>
        </div>
      </section>

      <div className="job-row-links">
        <Link className="button button-secondary" href={`/jobs/${job.id}`}>
          Back to detail
        </Link>
        <Link className="button button-secondary" href="/dashboard">
          Back to jobs
        </Link>
        <a
          className="button button-primary"
          href={job.applicationUrl ?? job.sourceUrl}
          rel="noreferrer"
          target="_blank"
        >
          Apply
        </a>
      </div>

      <ApplicationPacketForm
        canSave={canSave}
        disabledReason={issue}
        job={job}
        packet={packet}
      />
    </main>
  )
}
