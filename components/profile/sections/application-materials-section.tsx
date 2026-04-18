'use client'

import { FileUploadSlot } from '@/components/settings/file-upload-slot'
import { SectionHeading } from '@/components/ui/section-heading'

interface ApplicationMaterialsSectionProps {
  isGenerateProfilePending: boolean
  isProfileGeneratedCurrent: boolean
  standalone: boolean
  setSourceCoverLetterFileName: (value: string | null) => void
  setSourceResumeFileName: (value: string | null) => void
  sourceCoverLetterFileName: string | null
  sourceResumeFileName: string | null
}

export function ApplicationMaterialsSection({
  isGenerateProfilePending,
  isProfileGeneratedCurrent,
  standalone,
  setSourceCoverLetterFileName,
  setSourceResumeFileName,
  sourceCoverLetterFileName,
  sourceResumeFileName,
}: ApplicationMaterialsSectionProps) {
  const hasResumeInput = Boolean(sourceResumeFileName)
  // Disable the button while the generate action is in flight — prevents double-submit
  // spam and avoids the "click does nothing" confusion that had Alvis giving up after
  // 60s of silent OpenAI processing. Also remain disabled when no resume is uploaded
  // and after the profile has been generated (pre-existing conditions).
  const isGenerateDisabled =
    isGenerateProfilePending || !hasResumeInput || isProfileGeneratedCurrent
  // While the generate action is in flight, the label is rendered below as a
  // fragment so we can append animated dots (.button-loading-dots in
  // controls.css). The non-pending branches stay as plain strings so they
  // don't allocate a fragment when there's nothing to animate.
  const generateButtonLabel = isGenerateProfilePending ? null : isProfileGeneratedCurrent
    ? 'Profile generated'
    : 'Generate profile'

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
          disabled={isGenerateDisabled}
          formNoValidate
          name="intent"
          title={
            !hasResumeInput
              ? 'Upload your resume first.'
              : isProfileGeneratedCurrent
                ? 'Upload a new resume or cover letter to regenerate.'
                : undefined
          }
          type="submit"
          value="generate-profile"
        >
          <span>
            {isGenerateProfilePending ? (
              <>
                Generating profile<span className="button-loading-dots" aria-hidden="true" />
              </>
            ) : (
              generateButtonLabel
            )}
          </span>
        </button>
      </div>
    </section>
  )
}
