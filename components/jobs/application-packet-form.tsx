'use client'

import { useActionState } from 'react'

import { saveApplicationPacket, type ApplicationPacketActionState } from '@/app/jobs/actions'
import {
  packetStatuses,
  type ApplicationPacketRecord,
  type PacketCaseStudyRecord,
} from '@/lib/domain/types'
import type { RankedJobRecord } from '@/lib/jobs/contracts'
import { formatDateLabel, formatWorkflowLabel } from '@/lib/jobs/presentation'

const initialState: ApplicationPacketActionState = {
  message: '',
  status: 'idle',
}

function toTextAreaValue(values: string[]) {
  return values.join('\n')
}

interface ApplicationPacketFormProps {
  canSave: boolean
  disabledReason?: string
  job: RankedJobRecord
  packet: ApplicationPacketRecord
}

function CaseStudyList({ caseStudies }: { caseStudies: PacketCaseStudyRecord[] }) {
  return (
    <div className="repeat-list">
      {caseStudies.map((caseStudy) => (
        <article className="repeat-card" key={`${caseStudy.title}-${caseStudy.displayOrder}`}>
          <div className="repeat-card-header">
            <strong>
              {caseStudy.displayOrder}. {caseStudy.title}
            </strong>
            <a className="button button-ghost button-small" href={caseStudy.url} rel="noreferrer" target="_blank">
              Open work
            </a>
          </div>
          <p>{caseStudy.reason}</p>
        </article>
      ))}
    </div>
  )
}

export function ApplicationPacketForm({
  canSave,
  disabledReason,
  job,
  packet,
}: ApplicationPacketFormProps) {
  const [state, formAction, isPending] = useActionState(saveApplicationPacket, initialState)
  const isDisabled = !canSave || isPending

  return (
    <form action={formAction} className="packet-form">
      <input name="jobId" type="hidden" value={job.id} />
      <input name="jobScoreId" type="hidden" value={packet.jobScoreId} />
      <input name="packetId" type="hidden" value={packet.id} />
      <input name="resumeVersionId" type="hidden" value={packet.resumeVersion.id} />
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

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="panel-label">Packet review</p>
            <h2>Packet draft</h2>
          </div>
          <div className="status-track">
            <span>{packet.packetStatus.replaceAll('_', ' ')}</span>
            <span>{formatWorkflowLabel(job.workflowStatus)}</span>
          </div>
        </div>

        {!canSave ? <p className="workflow-note">{disabledReason}</p> : null}

        <div className="field-grid field-grid-2">
          <label className="field">
            <span>Packet status</span>
            <select defaultValue={packet.packetStatus} disabled={isDisabled} name="packetStatus">
              {packetStatuses.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Resume version label</span>
            <input
              defaultValue={packet.resumeVersion.versionLabel}
              disabled={isDisabled}
              name="resumeVersionLabel"
              type="text"
            />
            <small>
              Updated {packet.generatedAt ? formatDateLabel(packet.generatedAt) : 'from current job data'}.
            </small>
          </label>
        </div>
      </section>

      <section className="panel-grid panel-grid-2">
        <article className="panel">
          <p className="panel-label">Professional summary</p>
          <h2>Summary</h2>
          <label className="field">
            <span>Summary</span>
            <textarea
              defaultValue={packet.professionalSummary}
              disabled={isDisabled}
              name="professionalSummary"
              rows={6}
            />
          </label>
        </article>

        <article className="panel">
          <p className="panel-label">Role anchor</p>
          <h2>Role</h2>
          <ul className="compact-list">
            <li>
              <strong>{job.companyName}</strong>
              <span>
                {job.title} · {job.locationLabel ?? 'location pending'} · posted{' '}
                {formatDateLabel(job.postedAt)}
              </span>
            </li>
            <li>
              <strong>{job.fitSummary}</strong>
              <span>{job.fitReasons.slice(0, 3).join(' · ')}</span>
            </li>
          </ul>
        </article>
      </section>

      <section className="panel-grid panel-grid-2">
        <article className="panel">
          <p className="panel-label">Tailored resume</p>
          <h2>Resume</h2>

          <label className="field">
            <span>Resume summary</span>
            <textarea
              defaultValue={packet.resumeVersion.summaryText}
              disabled={isDisabled}
              name="resumeSummaryText"
              rows={6}
            />
          </label>

          <label className="field">
            <span>Highlighted requirements</span>
            <textarea
              defaultValue={toTextAreaValue(packet.resumeVersion.highlightedRequirements)}
              disabled={isDisabled}
              name="highlightedRequirements"
              rows={5}
            />
          </label>

          <label className="field">
            <span>Skills section</span>
            <textarea
              defaultValue={toTextAreaValue(packet.resumeVersion.skillsSection)}
              disabled={isDisabled}
              name="resumeSkillsSection"
              rows={4}
            />
          </label>

          <label className="field">
            <span>Tailoring notes</span>
            <textarea
              defaultValue={packet.resumeVersion.tailoringNotes}
              disabled={isDisabled}
              name="tailoringNotes"
              rows={5}
            />
          </label>
        </article>

        <article className="panel">
          <p className="panel-label">Experience emphasis</p>
          <h2>Experience</h2>
          <div className="repeat-list">
            {packet.resumeVersion.experienceEntries.map((entry, index) => (
              <article className="repeat-card" key={`${entry.companyName}-${entry.roleTitle}-${index}`}>
                <div className="repeat-card-header">
                  <strong>
                    {entry.roleTitle} · {entry.companyName}
                  </strong>
                  <span className="score-pill">{entry.locationLabel || 'location pending'}</span>
                </div>
                <p>{entry.summary}</p>
                <ul className="reason-list">
                  {entry.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="panel-grid panel-grid-2">
        <article className="panel">
          <p className="panel-label">Portfolio recommendation</p>
          <h2>Portfolio</h2>

          <label className="field">
            <span>Primary portfolio label</span>
            <input
              defaultValue={packet.portfolioRecommendation.primaryLabel}
              disabled={isDisabled}
              name="portfolioPrimaryLabel"
              type="text"
            />
          </label>

          <label className="field">
            <span>Primary portfolio URL</span>
            <input
              defaultValue={packet.portfolioRecommendation.primaryUrl}
              disabled={isDisabled}
              name="portfolioPrimaryUrl"
              type="url"
            />
          </label>

          <label className="field">
            <span>Recommendation rationale</span>
            <textarea
              defaultValue={packet.portfolioRecommendation.rationale}
              disabled={isDisabled}
              name="portfolioRationale"
              rows={5}
            />
          </label>
        </article>

        <article className="panel">
          <p className="panel-label">Case studies</p>
          <h2>Case studies</h2>
          <CaseStudyList caseStudies={packet.caseStudySelection} />
        </article>
      </section>

      <section className="panel">
        <p className="panel-label">Cover letter draft</p>
        <h2>Cover letter</h2>
        <label className="field">
          <span>Draft</span>
          <textarea
            defaultValue={packet.coverLetterDraft}
            disabled={isDisabled}
            name="coverLetterDraft"
            rows={14}
          />
        </label>
      </section>

      <section className="panel">
        <p className="panel-label">Short answers</p>
        <h2>Answers</h2>
        <div className="repeat-list">
          {packet.answers.map((answer, index) => (
            <article className="repeat-card" key={`${answer.questionKey}-${index}`}>
              <input name="answerId" type="hidden" value={answer.id} />
              <input name="questionKey" type="hidden" value={answer.questionKey} />
              <input name="fieldType" type="hidden" value={answer.fieldType} />
              <input name="reviewStatus" type="hidden" value={answer.reviewStatus} />
              <input
                name="characterLimit"
                type="hidden"
                value={answer.characterLimit ? String(answer.characterLimit) : ''}
              />

              <label className="field">
                <span>Question</span>
                <input defaultValue={answer.questionText} disabled={isDisabled} name="questionText" type="text" />
              </label>

              <label className="field">
                <span>Answer</span>
                <textarea
                  defaultValue={answer.answerText}
                  disabled={isDisabled}
                  name="answerText"
                  rows={6}
                />
              </label>

              <label className="field">
                <span>Short variant</span>
                <input
                  defaultValue={answer.answerVariantShort}
                  disabled={isDisabled}
                  name="answerVariantShort"
                  type="text"
                />
                <small>
                  {answer.characterLimit
                    ? `Keep one version near ${answer.characterLimit} characters.`
                    : 'Use this for a shorter version.'}
                </small>
              </label>
            </article>
          ))}
        </div>
      </section>

      <section className="panel-grid panel-grid-2">
        <article className="panel">
          <p className="panel-label">Submission checklist</p>
          <h2>Checklist</h2>
          <label className="field">
            <span>Checklist items</span>
            <textarea
              defaultValue={toTextAreaValue(packet.checklistItems)}
              disabled={isDisabled}
              name="checklistItems"
              rows={8}
            />
          </label>
        </article>

        <article className="panel">
          <p className="panel-label">Manual notes</p>
          <h2>Notes</h2>
          <label className="field">
            <span>Notes</span>
            <textarea
              defaultValue={packet.manualNotes}
              disabled={isDisabled}
              name="manualNotes"
              rows={8}
            />
          </label>
        </article>
      </section>

      <div className="profile-form-footer">
        <p
          className={`form-message ${
            state.status === 'success'
              ? 'form-message-success'
              : state.status === 'error'
                ? 'form-message-error'
                : ''
          }`}
        >
          {state.message ||
            (canSave
              ? 'Save changes to this packet draft.'
              : disabledReason ?? 'Saving is disabled until the ranked job is backed by a real database row.')}
        </p>
        <button className="button button-primary" disabled={isDisabled} type="submit">
          {isPending ? 'Saving packet...' : 'Save packet'}
        </button>
      </div>
    </form>
  )
}
