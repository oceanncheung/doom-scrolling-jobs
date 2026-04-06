'use client'

import { FileUploadSlot } from '@/components/settings/file-upload-slot'
import { SectionHeading } from '@/components/ui/section-heading'

interface ApplicationMaterialsSectionProps {
  standalone: boolean
  setSourceCoverLetterFileName: (value: string | null) => void
  setSourceResumeFileName: (value: string | null) => void
  sourceCoverLetterFileName: string | null
  sourceResumeFileName: string | null
}

export function ApplicationMaterialsSection({
  standalone,
  setSourceCoverLetterFileName,
  setSourceResumeFileName,
  sourceCoverLetterFileName,
  sourceResumeFileName,
}: ApplicationMaterialsSectionProps) {
  const hasResumeInput = Boolean(sourceResumeFileName)

  return (
    <section
      className={`panel settings-section${standalone ? ' is-standalone' : ''}`}
      id="source-files"
    >
      <SectionHeading
        label="Source documents"
        title="Generate your profile from your resume."
      />

      <div className="settings-section-subcopy">
        <p className="profile-note">
          Upload the resume we should pull from. Add a cover letter now or later if you want
          stronger tailored letters.
        </p>
      </div>

      <div className="settings-source-uploads-row settings-source-uploads-row--materials">
        <FileUploadSlot
          accept=".pdf,.doc,.docx,.md,.markdown,.txt,text/plain,text/markdown,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          compactMaxLength={28}
          fileName={sourceResumeFileName}
          inputName="resumeSourceUpload"
          label="Resume"
          onRemove={() => setSourceResumeFileName(null)}
          onUpload={(file) => setSourceResumeFileName(file.name)}
          showUploadIcon
        />
        <FileUploadSlot
          accept=".pdf,.doc,.docx,.md,.markdown,.txt,text/plain,text/markdown,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          compactMaxLength={28}
          fileName={sourceCoverLetterFileName}
          inputName="coverLetterSourceUpload"
          label="Cover letter (optional)"
          onRemove={() => setSourceCoverLetterFileName(null)}
          onUpload={(file) => setSourceCoverLetterFileName(file.name)}
          showUploadIcon
        />
        <button
          className="upload-slot-chip-btn upload-slot-chip-btn--action settings-source-generate-button"
          disabled={!hasResumeInput}
          formNoValidate
          name="intent"
          title={!hasResumeInput ? 'Upload your resume first.' : undefined}
          type="submit"
          value="generate-profile"
        >
          <span>Generate profile</span>
        </button>
      </div>
    </section>
  )
}
