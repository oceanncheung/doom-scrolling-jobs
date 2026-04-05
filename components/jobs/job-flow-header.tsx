import type { OperatorProfileRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'
import { getLocationDisplay, getSalaryDisplay } from '@/lib/jobs/display'
import { formatDateLabel, formatWorkflowLabel } from '@/lib/jobs/presentation'

interface JobFlowHeaderProps {
  job: QualifiedJobRecord
  pageIntro: string
  pageLabel: string
  profile: OperatorProfileRecord
}

export function JobFlowHeader({
  job,
  pageIntro,
  pageLabel,
  profile,
}: JobFlowHeaderProps) {
  const salaryDisplay = getSalaryDisplay(job, profile)

  return (
    <section className="page-header flow-header job-flow-header detail-page-header">
      <div className="job-flow-header-stack detail-page-header-stack">
        <div className="page-heading job-flow-heading">
          <div className="job-flow-heading-main">
            <p className="panel-label">{pageLabel}</p>
            <h1>{job.title}</h1>
            <p className="job-flow-company">{job.companyName}</p>
            {pageIntro ? <p className="job-flow-intro">{pageIntro}</p> : null}
            {job.aiMatchSummary ? <p className="job-flow-intro">{job.aiMatchSummary}</p> : null}
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
  )
}
