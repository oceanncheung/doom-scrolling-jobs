'use client'

import { useActionState } from 'react'

import { saveApplicationPacket, type ApplicationPacketActionState } from '@/app/jobs/actions'
import { type ApplicationPacketRecord } from '@/lib/domain/types'
import type { RankedJobRecord } from '@/lib/jobs/contracts'

const initialState: ApplicationPacketActionState = {
  message: '',
  status: 'idle',
}

function toTextAreaValue(values: string[]) {
  return values.join('\n')
}

function getFirstFilledText(...values: Array<string | null | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? ''
}

function getPreviewText(value: string, fallback: string, maxLength = 220) {
  const trimmed = value.trim()

  if (!trimmed) {
    return fallback
  }

  if (trimmed.length <= maxLength) {
    return trimmed
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}...`
}

interface ApplicationPacketFormProps {
  canSave: boolean
  disabledReason?: string
  job: RankedJobRecord
  packet: ApplicationPacketRecord
  showGeneratedContent: boolean
}

export function ApplicationPacketForm({
  job,
  packet,
  showGeneratedContent,
}: ApplicationPacketFormProps) {
  const [state, formAction] = useActionState(saveApplicationPacket, initialState)

  const resumeSource = getFirstFilledText(packet.resumeVersion.summaryText, packet.professionalSummary)
  const coverLetterSource = packet.coverLetterDraft.trim()
  const readyAnswerCount = packet.answers.filter(
    (answer) => answer.answerText.trim() || answer.answerVariantShort.trim(),
  ).length

  const resumeReady = Boolean(
    resumeSource ||
      packet.resumeVersion.highlightedRequirements.length > 0 ||
      packet.resumeVersion.skillsSection.length > 0,
  )
  const coverLetterReady = Boolean(coverLetterSource)

  const resumeSummary = getPreviewText(
    resumeSource,
    'A tailored resume summary will appear here once the application materials are generated.',
  )
  const coverLetterSummary = getPreviewText(
    coverLetterSource,
    'A role-specific cover letter will appear here once the application materials are generated.',
  )

  return (
    <form action={formAction} className="packet-form" id="packet-form">
      <input name="jobId" type="hidden" value={job.id} />
      <input name="jobScoreId" type="hidden" value={packet.jobScoreId} />
      <input name="packetId" type="hidden" value={packet.id} />
      <input name="resumeVersionId" type="hidden" value={packet.resumeVersion.id} />
      <input name="packetStatus" type="hidden" value={packet.packetStatus} />
      <input name="resumeVersionLabel" type="hidden" value={packet.resumeVersion.versionLabel} />
      <input
        name="resumeExperienceEntriesJson"
        type="hidden"
        value={JSON.stringify(packet.resumeVersion.experienceEntries)}
      />
      <input
        name="caseStudySelectionJson"
        type="hidden"
        value={JSON.stringify(packet.caseStudySelection)}
      />

      <textarea hidden name="resumeSummaryText" readOnly value={packet.resumeVersion.summaryText} />
      <textarea
        hidden
        name="highlightedRequirements"
        readOnly
        value={toTextAreaValue(packet.resumeVersion.highlightedRequirements)}
      />
      <textarea
        hidden
        name="resumeSkillsSection"
        readOnly
        value={toTextAreaValue(packet.resumeVersion.skillsSection)}
      />
      <textarea hidden name="tailoringNotes" readOnly value={packet.resumeVersion.tailoringNotes} />
      <textarea hidden name="coverLetterDraft" readOnly value={packet.coverLetterDraft} />
      <textarea hidden name="professionalSummary" readOnly value={packet.professionalSummary} />
      <input name="portfolioPrimaryLabel" type="hidden" value={packet.portfolioRecommendation.primaryLabel} />
      <input name="portfolioPrimaryUrl" type="hidden" value={packet.portfolioRecommendation.primaryUrl} />
      <textarea hidden name="portfolioRationale" readOnly value={packet.portfolioRecommendation.rationale} />
      <textarea hidden name="checklistItems" readOnly value={toTextAreaValue(packet.checklistItems)} />
      <textarea hidden name="manualNotes" readOnly value={packet.manualNotes} />

      {packet.answers.map((answer, index) => (
        <div hidden key={`${answer.questionKey}-${index}`}>
          <input name="answerId" type="hidden" value={answer.id} />
          <input name="questionText" type="hidden" value={answer.questionText} />
          <input name="questionKey" type="hidden" value={answer.questionKey} />
          <input name="fieldType" type="hidden" value={answer.fieldType} />
          <input name="reviewStatus" type="hidden" value={answer.reviewStatus} />
          <input
            name="characterLimit"
            type="hidden"
            value={answer.characterLimit ? String(answer.characterLimit) : ''}
          />
          <textarea hidden name="answerText" readOnly value={answer.answerText} />
          <input name="answerVariantShort" type="hidden" value={answer.answerVariantShort} />
        </div>
      ))}

      {showGeneratedContent ? (
        <>
          <section className="packet-section">
            <div className="packet-section-inner">
              <div className="settings-section-header packet-section-heading">
                <div className="settings-section-title-stack">
                  <p className="panel-label">Application materials</p>
                  <h2>Review what will be sent.</h2>
                  <p className="settings-section-note">
                    Short summaries of the AI-tailored resume and cover letter are below. Use the source listing on this page if you need the full job text or posting.
                  </p>
                </div>
              </div>

              <div className="packet-material-grid">
                <article className="packet-material-block">
                  <div className="packet-material-heading">
                    <p className="upload-slot-label">Resume summary</p>
                  </div>
                  <p className="packet-material-copy">{resumeSummary}</p>
                  <p className="packet-material-status" role="status">
                    <span
                      aria-hidden="true"
                      className={
                        resumeReady ? 'packet-material-status-dot packet-material-status-dot--ready' : 'packet-material-status-dot packet-material-status-dot--pending'
                      }
                    />
                    {resumeReady ? 'Ready' : 'Pending'}
                  </p>
                </article>

                <article className="packet-material-block">
                  <div className="packet-material-heading">
                    <p className="upload-slot-label">Cover letter summary</p>
                  </div>
                  <p className="packet-material-copy">{coverLetterSummary}</p>
                  <p className="packet-material-status" role="status">
                    <span
                      aria-hidden="true"
                      className={
                        coverLetterReady
                          ? 'packet-material-status-dot packet-material-status-dot--ready'
                          : 'packet-material-status-dot packet-material-status-dot--pending'
                      }
                    />
                    {coverLetterReady ? 'Ready' : 'Pending'}
                  </p>
                </article>
              </div>
            </div>
          </section>

          <section className="packet-section">
            <div className="packet-section-inner">
              <div className="settings-section-header packet-section-heading">
                <div className="settings-section-title-stack">
                  <p className="panel-label">Application questions</p>
                  <h2>Check the generated answers.</h2>
                  <p className="settings-section-note">
                    {packet.answers.length > 0
                      ? `${readyAnswerCount} of ${packet.answers.length} recognized questions already have prepared answers.`
                      : 'Questions will appear here when the application asks for them.'}
                  </p>
                </div>
              </div>

              {packet.answers.length > 0 ? (
                <div className="packet-question-list">
                  {packet.answers.map((answer, index) => {
                    const answerReady = Boolean(answer.answerText.trim() || answer.answerVariantShort.trim())

                    return (
                      <details className="disclosure packet-question-card" key={`${answer.questionKey}-${index}`}>
                        <summary className="disclosure-summary packet-question-summary">
                          <div className="packet-question-main">
                            <p className="upload-slot-label">Question {index + 1}</p>
                            <h3>{answer.questionText}</h3>
                          </div>
                          <div className="packet-question-status-slot">
                            <span className="packet-material-status" role="status">
                              <span
                                aria-hidden="true"
                                className={
                                  answerReady
                                    ? 'packet-material-status-dot packet-material-status-dot--ready'
                                    : 'packet-material-status-dot packet-material-status-dot--pending'
                                }
                              />
                              {answerReady ? 'Ready' : 'Pending'}
                            </span>
                          </div>
                          <div className="disclosure-controls packet-question-controls">
                            <span className="disclosure-caret" aria-hidden="true">
                              <svg fill="none" height="14" viewBox="0 0 16 16" width="14">
                                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
                              </svg>
                            </span>
                          </div>
                        </summary>
                        <div className="disclosure-body packet-disclosure-body">
                          <div className="packet-preview-block">
                            <p>
                              {answer.answerText.trim() ||
                                'A prepared answer will appear here once this question is generated.'}
                            </p>
                            {answer.answerVariantShort.trim() ? (
                              <p className="packet-preview-secondary">
                                <strong>Short answer.</strong> {answer.answerVariantShort}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </details>
                    )
                  })}
                </div>
              ) : (
                <div className="packet-inline-note">
                  <p>No extra questions have been detected for this application yet.</p>
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <section className="packet-section">
          <div className="packet-section-inner">
            <div className="settings-section-header packet-section-heading">
              <div className="settings-section-title-stack">
                <p className="panel-label">Generate content</p>
                <h2>Create the resume and cover letter for this role.</h2>
                <p className="settings-section-note">
                  Resume, cover letter, and any recognized application answers will appear here after you generate them.
                </p>
              </div>
            </div>

            <div className="packet-inline-note">
              <p>Nothing is shown yet so this step stays focused. Generate the content first, then review it here.</p>
            </div>
          </div>
        </section>
      )}

      {state.message ? (
        <div className="profile-form-footer packet-form-footer">
          <div className="packet-form-footer-inner">
            <p
              className={`form-message ${
                state.status === 'success'
                  ? 'form-message-success'
                  : state.status === 'error'
                    ? 'form-message-error'
                    : ''
              }`}
            >
              {state.message}
            </p>
          </div>
        </div>
      ) : null}
    </form>
  )
}
