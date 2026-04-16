import type { JobFlowHeaderViewModel } from '@/lib/jobs/job-flow-view-model'

interface JobFlowHeaderProps {
  header: JobFlowHeaderViewModel
}

export function JobFlowHeader({ header }: JobFlowHeaderProps) {
  const [salaryItem, stageItem, postedItem, freshnessItem] = header.metaItems

  return (
    <section className="page-header flow-header job-flow-header detail-page-header">
      <div className="job-flow-header-stack detail-page-header-stack">
        <div className="page-heading job-flow-heading">
          <div className="job-flow-heading-main">
            <p className="panel-label">{header.pageLabel}</p>
            <h1>{header.title}</h1>
            <p className="job-flow-company">{header.companyName}</p>
            {header.introLines.map((line) => (
              <p className="job-flow-intro column-reading-copy" key={line}>
                {line}
              </p>
            ))}
          </div>
        </div>
        <div className="job-flow-meta-band">
          <div className="job-flow-meta-item job-flow-meta-item--location">
            <span className="panel-label">{header.locationLabel}</span>
            <strong>{header.locationValue}</strong>
          </div>
          {salaryItem ? (
            <div className="job-flow-meta-item job-flow-meta-item--salary">
              <span className="panel-label">{salaryItem.label}</span>
              <strong>{salaryItem.value}</strong>
            </div>
          ) : null}
          {stageItem ? (
            <div className="job-flow-meta-item job-flow-meta-item--stage">
              <span className="panel-label">{stageItem.label}</span>
              <strong>{stageItem.value}</strong>
            </div>
          ) : null}
          {postedItem ? (
            <div className="job-flow-meta-item job-flow-meta-item--posted">
              <span className="panel-label">{postedItem.label}</span>
              <strong>{postedItem.value}</strong>
            </div>
          ) : null}
          {freshnessItem ? (
            <div className="job-flow-meta-item job-flow-meta-item--freshness">
              <span className="panel-label">{freshnessItem.label}</span>
              <strong>{freshnessItem.value}</strong>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
