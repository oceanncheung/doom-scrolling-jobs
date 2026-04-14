import { JobOverviewActions } from '@/components/jobs/job-overview-actions'
import type { ApplicationPacketRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import { formatSourceLinkLabel, getDescriptionExcerpt } from '@/lib/jobs/display'
import { getJobOverviewActionModel } from '@/lib/jobs/job-overview-action-model'

interface JobOverviewSectionProps {
  canGenerate: boolean
  canSave: boolean
  generationDisabledReason?: string
  saveDisabledReason?: string
  job: QualifiedJobRecord
  packet: ApplicationPacketRecord
  prepOpen: boolean
  screeningLocked?: boolean
}

export function JobOverviewSection({
  canGenerate,
  canSave,
  generationDisabledReason,
  saveDisabledReason,
  job,
  packet,
  prepOpen,
  screeningLocked = false,
}: JobOverviewSectionProps) {
  const actionModel = getJobOverviewActionModel({
    job,
    packet,
    prepOpen,
    screeningLocked,
  })
  const hasOverviewActions = actionModel !== null
  const overviewText = getDescriptionExcerpt(job)

  return (
    <div className="job-flow-prep-overview-wrap">
      <section
        className={`job-flow-section detail-review-section detail-review-section--first${
          !prepOpen ? ' detail-review-section--terminal' : ''
        }${hasOverviewActions ? ' detail-review-section--with-actions' : ''}`}
      >
        <div
          className={`job-flow-section-inner${hasOverviewActions ? ' job-overview-section-inner' : ''}`}
        >
          <div className="job-review-grid">
            <div className="job-review-column">
              <p className="panel-label">Job overview</p>
              <p>{overviewText}</p>
              <div className="inline-link-row">
                <a href={job.sourceUrl} rel="noreferrer" target="_blank">
                  {formatSourceLinkLabel(job)}
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
            <JobOverviewActions
              actionModel={actionModel}
              canGenerate={canGenerate}
              canSave={canSave}
              generationDisabledReason={generationDisabledReason}
              job={job}
              saveDisabledReason={saveDisabledReason}
            />
          ) : null}
        </div>
      </section>
    </div>
  )
}
