import Link from 'next/link'
import { notFound } from 'next/navigation'

import { JobStageActionButton } from '@/components/jobs/job-stage-action-button'
import { ApplicationPacketForm } from '@/components/jobs/application-packet-form'
import { WorkspaceTodayRail } from '@/components/navigation/workspace-today-rail'
import { getApplicationPacketReview } from '@/lib/data/application-packets'
import { getRankedJobs } from '@/lib/data/jobs'
import { requireActiveOperatorSelection } from '@/lib/data/operators'
import { getOperatorProfile } from '@/lib/data/operator-profile'
import {
  formatDateLabel,
  formatRemoteLabel,
  formatWorkflowLabel,
} from '@/lib/jobs/presentation'
import { getEffectiveSalaryInsight } from '@/lib/jobs/salary-estimation'

export const dynamic = 'force-dynamic'

interface PacketReviewPageProps {
  params: Promise<{
    jobId: string
  }>
}

function PacketActions({
  canEdit,
  jobId,
  sourceUrl,
  workflowStatus,
}: {
  canEdit: boolean
  jobId: string
  sourceUrl: string
  workflowStatus: string
}) {
  if (workflowStatus === 'ready_to_apply') {
    return (
      <div className="stage-actions">
        <a className="button button-primary button-small" href={sourceUrl} rel="noreferrer" target="_blank">
          Apply
        </a>
        <JobStageActionButton
          canEdit={canEdit}
          disabledReason="Switch back to the database-backed queue to mark jobs applied."
          jobId={jobId}
          label="Mark Applied"
          sourceContext="packet-review"
          variant="secondary"
          workflowStatus="applied"
        />
        <Link className="button button-ghost button-small" href={`/jobs/${jobId}`}>
          View Job
        </Link>
      </div>
    )
  }

  return (
    <div className="stage-actions">
      <JobStageActionButton
        canEdit={canEdit}
        disabledReason="Switch back to the database-backed queue to mark packets ready."
        jobId={jobId}
        label="Mark Ready to Apply"
        sourceContext="packet-review"
        variant="primary"
        workflowStatus="ready_to_apply"
      />
      <a className="button button-secondary button-small" href={sourceUrl} rel="noreferrer" target="_blank">
        Source
      </a>
      <Link className="button button-ghost button-small" href={`/jobs/${jobId}`}>
        View Job
      </Link>
    </div>
  )
}

export default async function PacketReviewPage({ params }: PacketReviewPageProps) {
  await requireActiveOperatorSelection()
  const { jobId } = await params
  const [{ canSave, issue, job, packet }, { jobs, source }, { workspace }] = await Promise.all([
    getApplicationPacketReview(jobId),
    getRankedJobs(),
    getOperatorProfile(),
  ])

  if (!job || !packet) {
    notFound()
  }

  return (
    <main className="page-stack workspace-surface">
      <div className="dashboard-workspace">
        <WorkspaceTodayRail
          actionsEnabled={source === 'database'}
          jobs={jobs}
        />
        <div className="queue-column">
      <section className="page-header flow-header">
        <div className="page-heading">
          <p className="panel-label">Application prep</p>
          <h1>{job.title}</h1>
          <p>{job.companyName}</p>
        </div>
        <div className="flow-snapshot">
          <div>
            <span className="panel-label">Remote / location</span>
            <strong>{job.locationLabel ? `${formatRemoteLabel(job)} · ${job.locationLabel}` : formatRemoteLabel(job)}</strong>
          </div>
          <div>
            <span className="panel-label">Salary</span>
            <strong>{getEffectiveSalaryInsight(job, workspace.profile).value}</strong>
          </div>
          <div>
            <span className="panel-label">Workflow</span>
            <strong>{formatWorkflowLabel(job.workflowStatus)}</strong>
          </div>
        </div>
      </section>

      <section className="stage-shell">
        <div className="stage-summary-row">
          <div className="stage-summary-item">
            <span className="panel-label">Packet status</span>
            <strong>{packet.packetStatus.replaceAll('_', ' ')}</strong>
          </div>
          <div className="stage-summary-item">
            <span className="panel-label">Last draft</span>
            <strong>{packet.generatedAt ? formatDateLabel(packet.generatedAt) : 'Current draft'}</strong>
          </div>
          <div className="stage-summary-item">
            <span className="panel-label">Mode</span>
            <strong>{canSave ? 'Editable' : 'Read only'}</strong>
          </div>
        </div>

        <PacketActions
          canEdit={canSave}
          jobId={job.id}
          sourceUrl={job.applicationUrl ?? job.sourceUrl}
          workflowStatus={job.workflowStatus}
        />

        {issue ? <p className="stage-helper-text">{issue}</p> : null}
      </section>

      <ApplicationPacketForm canSave={canSave} disabledReason={issue} job={job} packet={packet} />

      <div className="inline-link-row">
        <Link href="/dashboard">Back to jobs</Link>
        <Link href={`/jobs/${job.id}`}>Back to detail</Link>
      </div>
        </div>
      </div>
    </main>
  )
}
