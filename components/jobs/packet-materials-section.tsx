import { PacketMaterialDownloadButton } from '@/components/jobs/packet-material-download-button'
import { PacketStatus } from '@/components/jobs/packet-primitives'
import { SectionHeading } from '@/components/ui/section-heading'
import type { ApplicationPacketRecord, OperatorWorkspaceRecord } from '@/lib/domain/types'
import {
  buildCoverLetterMaterialReview,
  buildResumeMaterialReview,
} from '@/lib/jobs/packet-materials'

interface PacketMaterialsSectionProps {
  companyName: string
  coverLetterChangeSummary: string
  coverLetterReady: boolean
  coverLetterSummary: string
  jobId: string
  jobTitle: string
  packet: ApplicationPacketRecord
  resumeChangeSummary: string
  resumeReady: boolean
  resumeSummary: string
  workspace: OperatorWorkspaceRecord
}

export function PacketMaterialsSection({
  companyName,
  coverLetterChangeSummary,
  coverLetterReady,
  coverLetterSummary,
  jobId,
  jobTitle,
  packet,
  resumeChangeSummary,
  resumeReady,
  resumeSummary,
  workspace,
}: PacketMaterialsSectionProps) {
  const resumeMaterialReview = buildResumeMaterialReview({
    companyName,
    jobId,
    jobTitle,
    packet,
  })
  const coverLetterMaterialReview = buildCoverLetterMaterialReview({
    companyName,
    jobId,
    jobTitle,
    packet,
    workspace,
  })
  const resumePending = !resumeReady
  const coverLetterPending = !coverLetterReady

  return (
    <section className="packet-section" id="packet-materials-section">
      <div className="packet-section-inner">
        <SectionHeading
          className="packet-section-heading"
          label="Application materials"
          note="Summaries and full text drafts are below so you can review what will be sent before applying."
          title="Review what will be sent."
        />

        <div className="packet-material-grid">
          <article className="packet-material-block">
            <div className="packet-material-heading">
              <p className="upload-slot-label">Resume summary</p>
            </div>
            {resumePending ? null : <p className="packet-material-copy">{resumeSummary}</p>}
            <PacketStatus ready={resumeReady} />
          </article>

          {!resumePending ? (
            <article className="packet-material-block">
              <div className="packet-material-heading">
                <p className="upload-slot-label">Resume changes</p>
              </div>
              <p className="packet-material-copy">{resumeChangeSummary}</p>
            </article>
          ) : null}

          <article className="packet-material-block">
            <div className="packet-material-heading">
              <p className="upload-slot-label">Cover letter summary</p>
            </div>
            {coverLetterPending ? null : <p className="packet-material-copy">{coverLetterSummary}</p>}
            <PacketStatus ready={coverLetterReady} />
          </article>

          {!coverLetterPending ? (
            <article className="packet-material-block">
              <div className="packet-material-heading">
                <p className="upload-slot-label">Cover letter changes</p>
              </div>
              <p className="packet-material-copy">{coverLetterChangeSummary}</p>
            </article>
          ) : null}
        </div>

        <div className="packet-material-review-stack">
          <article className="packet-material-review-block job-flow-section detail-review-section detail-review-section--with-sticky-action">
            <div className="job-flow-section-inner">
              <div className="settings-section-title-stack packet-material-review-title-stack">
                <h3 className="packet-material-review-title">Resume draft</h3>
              </div>
              {resumeMaterialReview.previewText ? (
                <pre className="packet-material-draft">{resumeMaterialReview.previewText}</pre>
              ) : null}
              <div
                aria-label="Resume download"
                className="packet-material-review-sticky-action screening-actions-bar job-overview-actions job-overview-actions--single-right"
                role="group"
              >
                <div className="screening-actions-cluster">
                  <div className="screening-action-slot">
                    <PacketMaterialDownloadButton
                      disabled={resumePending}
                      href={resumePending ? undefined : resumeMaterialReview.downloadHref}
                      label="Download Resume"
                      title={
                        resumePending
                          ? 'Upload your resume source, generate content, and then download it here.'
                          : resumeMaterialReview.remediationLead
                      }
                      variant="primary"
                    />
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article className="packet-material-review-block job-flow-section detail-review-section detail-review-section--with-sticky-action">
            <div className="job-flow-section-inner">
              <div className="settings-section-title-stack packet-material-review-title-stack">
                <h3 className="packet-material-review-title">Cover letter draft</h3>
              </div>
              {coverLetterMaterialReview.previewText ? (
                <pre className="packet-material-draft">{coverLetterMaterialReview.previewText}</pre>
              ) : null}
              <div
                aria-label="Cover letter download"
                className="packet-material-review-sticky-action screening-actions-bar job-overview-actions job-overview-actions--single-right"
                role="group"
              >
                <div className="screening-actions-cluster">
                  <div className="screening-action-slot">
                    <PacketMaterialDownloadButton
                      disabled={coverLetterPending}
                      href={
                        coverLetterPending
                          ? undefined
                          : coverLetterMaterialReview.downloadHref
                      }
                      label="Download Cover Letter"
                      title={
                        coverLetterPending
                          ? 'Upload your cover letter source, generate content, and then download it here.'
                          : coverLetterMaterialReview.remediationLead
                      }
                      variant="primary"
                    />
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
