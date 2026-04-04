import Link from 'next/link'

import { getDescriptionExcerpt, getLocationDisplay, getSalaryDisplay } from '@/components/dashboard/formatters'
import { ApplicationPacketForm } from '@/components/jobs/application-packet-form'
import { JobStageActionButton } from '@/components/jobs/job-stage-action-button'
import type { ApplicationPacketRecord, OperatorProfileRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import { formatDateLabel, formatWorkflowLabel } from '@/lib/jobs/presentation'

function getDetailIntro(job: QualifiedJobRecord) {
  if (job.workflowStatus === 'ready_to_apply') {
    return 'Everything is lined up. Review the role, then apply when you want to move.'
  }

  if (job.workflowStatus === 'preparing') {
    return 'Materials are already being prepared. Review the role, then continue when you want.'
  }

  if (job.workflowStatus === 'shortlisted') {
    return 'This role is saved. Review the basics, then prepare the application when it is worth pursuing.'
  }

  return 'Review the basics, then decide whether to save, skip, or open the source listing.'
}

function getPrepIntro(job: QualifiedJobRecord, hasDraft: boolean) {
  if (job.workflowStatus === 'ready_to_apply') {
    return 'Your materials are ready. Review the role, then apply when you want to submit.'
  }

  if (hasDraft) {
    return 'Review the role and the prepared materials below, then mark the application ready to apply.'
  }

  return 'Generate tailored materials for this role first. The resume, cover letter, and answers will appear after that step.'
}

function hasGeneratedPacket(job: QualifiedJobRecord) {
  return (
    job.workflowStatus === 'preparing' ||
    job.workflowStatus === 'ready_to_apply' ||
    job.workflowStatus === 'applied' ||
    job.workflowStatus === 'follow_up_due' ||
    job.workflowStatus === 'interview'
  )
}

function PrepSubmitButton({ canSave, hasDraft }: { canSave: boolean; hasDraft: boolean }) {
  return (
    <button
      className="button button-primary button-small"
      disabled={!canSave}
      form="packet-form"
      name="submitIntent"
      type="submit"
      value={hasDraft ? 'mark-ready' : 'generate-draft'}
    >
      {hasDraft ? 'Mark Ready to Apply' : 'Generate Content'}
    </button>
  )
}

function JobOverviewActions({
  canSave,
  draftReady,
  job,
  prepOpen,
}: {
  canSave: boolean
  draftReady: boolean
  job: QualifiedJobRecord
  prepOpen: boolean
}) {
  if (prepOpen) {
    if (job.workflowStatus === 'ready_to_apply') {
      return (
        <div
          aria-label="Job overview actions"
          className="screening-actions-bar job-overview-actions job-overview-actions--pair-right"
          role="group"
        >
          <div className="screening-actions-cluster">
            <div className="screening-action-slot">
              <a
                className="button button-primary button-small"
                href={job.applicationUrl ?? job.sourceUrl}
                rel="noreferrer"
                target="_blank"
              >
                Apply
              </a>
            </div>
            <div className="screening-action-slot">
              <JobStageActionButton
                canEdit={canSave}
                disabledReason="Switch back to the database-backed queue to mark jobs applied."
                jobId={job.id}
                label="Mark Applied"
                sourceContext="job-flow"
                variant="secondary"
                workflowStatus="applied"
              />
            </div>
          </div>
        </div>
      )
    }

    return (
      <div
        aria-label="Job overview actions"
        className="screening-actions-bar job-overview-actions job-overview-actions--single-right"
        role="group"
      >
        <div className="screening-actions-cluster">
          <div className="screening-action-slot">
            <PrepSubmitButton canSave={canSave} hasDraft={draftReady} />
          </div>
        </div>
      </div>
    )
  }

  if (job.workflowStatus !== 'new' && job.workflowStatus !== 'ranked') {
    if (job.workflowStatus === 'shortlisted') {
      return (
        <div
          aria-label="Job overview actions"
          className="screening-actions-bar job-overview-actions job-overview-actions--prepare-left"
          role="group"
        >
          <div className="screening-actions-cluster">
            <div className="screening-action-slot">
              <Link className="button button-primary button-small" href={`/jobs/${job.id}/packet`}>
                Prepare Application
              </Link>
            </div>
            <div className="screening-action-slot">
              <JobStageActionButton
                canEdit={canSave}
                disabledReason="Switch back to the database-backed queue to remove saved jobs."
                intent="dismiss"
                jobId={job.id}
                label="Remove"
                sourceContext="job-flow"
                variant="secondary"
              />
            </div>
          </div>
        </div>
      )
    }

    if (job.workflowStatus === 'preparing') {
      return (
        <div
          aria-label="Job overview actions"
          className="screening-actions-bar job-overview-actions job-overview-actions--single-right"
          role="group"
        >
          <div className="screening-actions-cluster">
            <div className="screening-action-slot">
              <Link className="button button-primary button-small" href={`/jobs/${job.id}/packet`}>
                Continue Preparation
              </Link>
            </div>
          </div>
        </div>
      )
    }

    if (job.workflowStatus === 'ready_to_apply') {
      return (
        <div
          aria-label="Job overview actions"
          className="screening-actions-bar job-overview-actions job-overview-actions--single-right"
          role="group"
        >
          <div className="screening-actions-cluster">
            <div className="screening-action-slot">
              <a
                className="button button-primary button-small"
                href={job.applicationUrl ?? job.sourceUrl}
                rel="noreferrer"
                target="_blank"
              >
                  Apply
                </a>
              </div>
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div
      aria-label="Job overview actions"
      className="screening-actions-bar job-overview-actions job-overview-actions--pair-right"
      role="group"
    >
      <div className="screening-actions-cluster">
        <div className="screening-action-slot">
          <JobStageActionButton
            canEdit={canSave}
            disabledReason="Switch back to the database-backed queue to save jobs."
            intent="shortlist"
            jobId={job.id}
            label="Save"
            sourceContext="job-flow"
            variant="primary"
          />
        </div>
        <div className="screening-action-slot">
          <JobStageActionButton
            canEdit={canSave}
            disabledReason="Switch back to the database-backed queue to skip jobs."
            intent="dismiss"
            jobId={job.id}
            label="Skip"
            sourceContext="job-flow"
            variant="secondary"
          />
        </div>
      </div>
    </div>
  )
}

interface JobFlowPageProps {
  canSave: boolean
  issue?: string
  job: QualifiedJobRecord
  packet: ApplicationPacketRecord
  prepOpen: boolean
  profile: OperatorProfileRecord
}

export function JobFlowPage({
  canSave,
  issue,
  job,
  packet,
  prepOpen,
  profile,
}: JobFlowPageProps) {
  const salaryDisplay = getSalaryDisplay(job, profile)
  const descriptionPreview = getDescriptionExcerpt(job)
  const draftReady = hasGeneratedPacket(job)
  const pageLabel = prepOpen ? 'Application prep' : 'Job detail'
  const pageIntro = prepOpen ? getPrepIntro(job, draftReady) : getDetailIntro(job)
  const hasOverviewActions =
    prepOpen ||
    job.workflowStatus === 'new' ||
    job.workflowStatus === 'ranked' ||
    job.workflowStatus === 'shortlisted' ||
    job.workflowStatus === 'preparing' ||
    job.workflowStatus === 'ready_to_apply'

  return (
    <>
      <section className="page-header flow-header job-flow-header detail-page-header">
        <div className="job-flow-header-stack detail-page-header-stack">
          <div className="page-heading job-flow-heading">
            <div className="job-flow-heading-main">
              <p className="panel-label">{pageLabel}</p>
              <h1>{job.title}</h1>
              <p className="job-flow-company">{job.companyName}</p>
              <p className="job-flow-intro">{pageIntro}</p>
            </div>
          </div>
          <div className="flow-snapshot job-flow-snapshot detail-page-snapshot">
            <div>
              <span className="panel-label">Remote / location</span>
              <strong>{getLocationDisplay(job)}</strong>
            </div>
            <div>
              <span className="panel-label">Salary</span>
              <strong>{salaryDisplay.value}</strong>
            </div>
            <div>
              <span className="panel-label">Stage</span>
              <strong>{formatWorkflowLabel(job.workflowStatus)}</strong>
            </div>
            <div>
              <span className="panel-label">Posted</span>
              <strong>{formatDateLabel(job.postedAt)}</strong>
            </div>
            <div>
              <span className="panel-label">Freshness</span>
              <strong>{job.freshness.label}</strong>
            </div>
          </div>
        </div>
      </section>

      <div className="job-flow-prep-overview-wrap">
        <section
          className={`job-flow-section detail-review-section detail-review-section--first${
            !prepOpen ? ' detail-review-section--terminal' : ''
          }${hasOverviewActions ? ' detail-review-section--with-actions' : ''}`}
        >
          <div className="job-flow-section-inner">
            <div className="job-review-grid">
              <div className="job-review-column">
                <p className="panel-label">Job overview</p>
                <p>{descriptionPreview}</p>
                <div className="inline-link-row">
                  <a href={job.sourceUrl} rel="noreferrer" target="_blank">
                    Source
                  </a>
                </div>
              </div>
              <div className="job-review-column">
                <p className="panel-label">Skills</p>
                {job.skillsKeywords.length > 0 ? (
                  <div className="job-card-tags">
                    {job.skillsKeywords.map((skill) => (
                      <span key={skill}>{skill}</span>
                    ))}
                  </div>
                ) : (
                  <p>No specific skills were listed on the imported job source.</p>
                )}
              </div>
            </div>
            {hasOverviewActions ? (
              <JobOverviewActions canSave={canSave} draftReady={draftReady} job={job} prepOpen={prepOpen} />
            ) : null}
          </div>
        </section>
      </div>

      {prepOpen ? (
        <div className="job-prep-direct">
          <ApplicationPacketForm
            canSave={canSave}
            disabledReason={issue}
            job={job}
            packet={packet}
            showGeneratedContent={draftReady}
          />
        </div>
      ) : null}
    </>
  )
}
