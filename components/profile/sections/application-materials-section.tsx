'use client'

import { FileUploadSlot } from '@/components/settings/file-upload-slot'

interface ApplicationMaterialsSectionProps {
  resumeSummaryText: string
  resumePdfName: string | null
  coverLetterPdfName: string | null
  portfolioPdfName: string | null
  setResumePdfName: (value: string | null) => void
  setCoverLetterPdfName: (value: string | null) => void
  setPortfolioPdfName: (value: string | null) => void
}

export function ApplicationMaterialsSection({
  resumeSummaryText,
  resumePdfName,
  coverLetterPdfName,
  portfolioPdfName,
  setResumePdfName,
  setCoverLetterPdfName,
  setPortfolioPdfName,
}: ApplicationMaterialsSectionProps) {
  return (
    <section className="panel settings-section" id="source-files">
      <div className="settings-section-header">
        <div className="settings-section-title-stack">
          <p className="panel-label">Application materials</p>
          <h2>Start from the documents you actually use.</h2>
        </div>
      </div>

      <div className="settings-source-primary upload-slot settings-source-resume-text">
        <span className="upload-slot-label">Base resume</span>
        <textarea
          defaultValue={resumeSummaryText}
          name="resumeSummaryText"
          placeholder="Paste your full resume or core body text here."
          rows={8}
        />
        <small>Use the text you want every role-specific resume draft to build from.</small>
      </div>

      <div className="settings-source-uploads-row">
        <FileUploadSlot
          accept=".pdf,.doc,.docx"
          fileName={resumePdfName}
          label="Resume file"
          onRemove={() => setResumePdfName(null)}
          onUpload={(file) => setResumePdfName(file.name)}
          presentation="chip"
        />
        <FileUploadSlot
          accept=".pdf,.doc,.docx"
          fileName={coverLetterPdfName}
          label="Cover letter file"
          onRemove={() => setCoverLetterPdfName(null)}
          onUpload={(file) => setCoverLetterPdfName(file.name)}
          presentation="chip"
        />
        <FileUploadSlot
          accept=".pdf"
          fileName={portfolioPdfName}
          label="Portfolio file"
          onRemove={() => setPortfolioPdfName(null)}
          onUpload={(file) => setPortfolioPdfName(file.name)}
          presentation="chip"
        />
      </div>
    </section>
  )
}
