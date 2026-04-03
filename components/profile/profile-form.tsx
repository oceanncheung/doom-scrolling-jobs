'use client'

import type { ReactNode } from 'react'
import { useActionState, useState } from 'react'
import { createPortal } from 'react-dom'

import type {
  OperatorPortfolioItemRecord,
  OperatorWorkspaceRecord,
  ResumeAchievementRecord,
  ResumeEducationRecord,
  ResumeExperienceRecord,
} from '@/lib/domain/types'

import { saveOperatorProfile, type ProfileActionState } from '@/app/profile/actions'
import { useProfileSaveMessageRoot } from '@/components/profile/profile-save-message-root'
import { highlightLinesFromMultiline } from '@/lib/profile/highlight-lines'
import {
  SALARY_CURRENCY_OPTIONS,
  normalizeSalaryFloorCurrency,
} from '@/lib/profile/salary-currency'
import {
  SENIORITY_LEVEL_OPTIONS,
  seniorityLevelToSelectValue,
} from '@/lib/profile/seniority-level'
import { FileUploadSlot } from '@/components/settings/file-upload-slot'
import { TagInput } from '@/components/ui/tag-input'

const initialState: ProfileActionState = {
  message: '',
  status: 'idle',
}

interface ProfileFormProps {
  workspace: OperatorWorkspaceRecord
}

type StrengthsTab = 'certifications' | 'education' | 'highlights' | 'history' | 'skillsTools'

function toTextAreaValue(values: string[]) {
  return values.join('\n')
}

function tagsFromDelimitedString(value: string) {
  return value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
}

function createUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replaceAll(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16)
    const value = character === 'x' ? random : (random & 0x3) | 0x8

    return value.toString(16)
  })
}

function createExperienceEntry(): ResumeExperienceRecord {
  return {
    companyName: '',
    roleTitle: '',
    locationLabel: '',
    startDate: '',
    endDate: '',
    summary: '',
    highlights: [],
  }
}

function createAchievementEntry(): ResumeAchievementRecord {
  return {
    category: '',
    title: '',
    detail: '',
  }
}

function createEducationEntry(): ResumeEducationRecord {
  return {
    schoolName: '',
    credential: '',
    fieldOfStudy: '',
    startDate: '',
    endDate: '',
    notes: '',
  }
}

function createPortfolioItem(): OperatorPortfolioItemRecord {
  return {
    id: createUuid(),
    title: '',
    url: '',
    projectType: '',
    roleLabel: '',
    summary: '',
    skillsTags: [],
    industryTags: [],
    outcomeMetrics: [],
    visualStrengthRating: '',
    isPrimary: false,
    isActive: true,
  }
}

function AddRowButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button className="button button-secondary button-small" onClick={onClick} type="button">
      {label}
    </button>
  )
}

function SettingsTabButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean
  count: number
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-pressed={active}
      className={`settings-tab-button${active ? ' is-active' : ''}`}
      onClick={onClick}
      type="button"
    >
      <span className="settings-tab-button-label">{label}</span>
      <span className="settings-tab-button-count">{count}</span>
      <span aria-hidden="true" className="settings-tab-button-icon">
        <svg fill="none" height="12" viewBox="0 0 12 12" width="12">
          <path
            d="M3.25 4.5 6 7.25 8.75 4.5"
            stroke="currentColor"
            strokeLinecap="square"
            strokeWidth="1.2"
          />
        </svg>
      </span>
    </button>
  )
}

function DisclosureSection({
  children,
  className,
  label,
  title,
  unwrapBody,
}: {
  children: ReactNode
  className?: string
  label: string
  title: string
  /** Omit the disclosure-body wrapper (e.g. experience: section children stay direct for layout) */
  unwrapBody?: boolean
}) {
  return (
    <section className={['panel', 'disclosure', className].filter(Boolean).join(' ')}>
      <div className="disclosure-summary">
        <div>
          <p className="panel-label">{label}</p>
          <h2>{title}</h2>
        </div>
      </div>
      {unwrapBody ? children : <div className="disclosure-body">{children}</div>}
    </section>
  )
}

function targetSenioritySelectDefaults(seniorityLevel: string) {
  const raw = seniorityLevel.trim()
  const mapped = seniorityLevelToSelectValue(seniorityLevel)
  if (raw.length > 0 && mapped === '') {
    return { defaultValue: raw, legacyOption: raw }
  }
  return { defaultValue: mapped, legacyOption: null }
}

export function ProfileForm({ workspace }: ProfileFormProps) {
  const [state, formAction] = useActionState(saveOperatorProfile, initialState)
  const saveMessageRoot = useProfileSaveMessageRoot()
  const [activeStrengthsTab, setActiveStrengthsTab] = useState<StrengthsTab | null>(null)
  const [targetRoleTags, setTargetRoleTags] = useState(() => [...workspace.profile.targetRoles])
  const [adjacentRoleTags, setAdjacentRoleTags] = useState(() => [
    ...workspace.profile.allowedAdjacentRoles,
  ])
  const [coverLetterPdfName, setCoverLetterPdfName] = useState<string | null>(
    workspace.resumeMaster.coverLetterPdfFileName || null,
  )
  const [portfolioPdfName, setPortfolioPdfName] = useState<string | null>(
    workspace.resumeMaster.portfolioPdfFileName || null,
  )
  const [resumePdfName, setResumePdfName] = useState<string | null>(
    workspace.resumeMaster.resumePdfFileName || null,
  )
  const [experienceEntries, setExperienceEntries] = useState(
    workspace.resumeMaster.experienceEntries.length > 0
      ? workspace.resumeMaster.experienceEntries
      : [createExperienceEntry()],
  )
  const [achievementBank, setAchievementBank] = useState(
    workspace.resumeMaster.achievementBank.length > 0
      ? workspace.resumeMaster.achievementBank
      : [createAchievementEntry()],
  )
  const [educationEntries, setEducationEntries] = useState(
    workspace.resumeMaster.educationEntries.length > 0
      ? workspace.resumeMaster.educationEntries
      : [createEducationEntry()],
  )
  const [portfolioItems, setPortfolioItems] = useState(workspace.portfolioItems)
  const [skillsTags, setSkillsTags] = useState(() => [...workspace.profile.skills])
  const [toolsTags, setToolsTags] = useState(() => [...workspace.profile.tools])
  const [certificationTags, setCertificationTags] = useState(() => [
    ...workspace.resumeMaster.certifications,
  ])
  const senioritySelect = targetSenioritySelectDefaults(workspace.profile.seniorityLevel)
  const [timezoneTags, setTimezoneTags] = useState(() =>
    tagsFromDelimitedString(workspace.profile.timezone),
  )
  const [allowedRemoteRegionTags, setAllowedRemoteRegionTags] = useState(() => [
    ...workspace.profile.allowedRemoteRegions,
  ])
  const [industriesPreferredTags, setIndustriesPreferredTags] = useState(() => [
    ...workspace.profile.industriesPreferred,
  ])

  return (
    <form action={formAction} className="profile-form settings-main" id="profile-workspace-form">
      <input name="targetRoles" type="hidden" value={targetRoleTags.join('\n')} />
      <input name="allowedAdjacentRoles" type="hidden" value={adjacentRoleTags.join('\n')} />
      <input name="skills" type="hidden" value={skillsTags.join('\n')} />
      <input name="tools" type="hidden" value={toolsTags.join('\n')} />
      <input name="certifications" type="hidden" value={certificationTags.join('\n')} />
      <input name="resumeSkillsSection" type="hidden" value={skillsTags.join('\n')} />
      <input name="resumePdfFileName" type="hidden" value={resumePdfName ?? ''} />
      <input name="coverLetterPdfFileName" type="hidden" value={coverLetterPdfName ?? ''} />
      <input name="portfolioPdfFileName" type="hidden" value={portfolioPdfName ?? ''} />
      <input name="timezone" type="hidden" value={timezoneTags.join(', ')} />
      <input name="allowedRemoteRegions" type="hidden" value={allowedRemoteRegionTags.join('\n')} />
      <input name="industriesPreferred" type="hidden" value={industriesPreferredTags.join('\n')} />
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
            defaultValue={workspace.resumeMaster.summaryText}
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

      <section className="panel settings-section">
        <div className="settings-section-header">
          <div className="settings-section-title-stack">
            <p className="panel-label">Job targets</p>
            <h2>Tell us what a good role looks like.</h2>
          </div>
        </div>

        <div className="settings-core-grid">
          <label className="field settings-field-wide settings-search-brief">
            <span>Ideal roles</span>
            <textarea
              defaultValue={workspace.profile.searchBrief}
              name="searchBrief"
              placeholder="Generated from your resume. Edit to refine."
              rows={8}
            />
            <small>Roles matching this get prioritized.</small>
          </label>

        </div>

        <details className="settings-action-disclosure">
          <summary className="settings-action-summary">
            <span className="settings-action-toggle">
              Additional filters
              <span aria-hidden="true" className="settings-action-toggle-icon">
                <svg fill="none" height="12" viewBox="0 0 12 12" width="12">
                  <path
                    d="M3.25 4.5 6 7.25 8.75 4.5"
                    stroke="currentColor"
                    strokeLinecap="square"
                    strokeWidth="1.2"
                  />
                </svg>
              </span>
            </span>
          </summary>
          <div className="settings-action-body">
            <div className="settings-core-grid">
            <div className="settings-job-targets-row">
              <div className="settings-job-targets-col-market">
                <label className="field">
                  <span>Main hiring market</span>
                  <input
                    defaultValue={workspace.profile.primaryMarket}
                    name="primaryMarket"
                    placeholder="Canada"
                    type="text"
                  />
                </label>
                <label className="field">
                  <span>Target seniority</span>
                  <select defaultValue={senioritySelect.defaultValue} name="seniorityLevel">
                    {senioritySelect.legacyOption ? (
                      <option value={senioritySelect.legacyOption}>
                        Saved: {senioritySelect.legacyOption}
                      </option>
                    ) : null}
                    {SENIORITY_LEVEL_OPTIONS.map((option) => (
                      <option key={option.value || 'none'} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="settings-job-targets-col-salary">
                <label className="field settings-salary-currency-field">
                  <span>Salary currency</span>
                  <select
                    defaultValue={normalizeSalaryFloorCurrency(workspace.profile.salaryFloorCurrency)}
                    name="salaryFloorCurrency"
                  >
                    {SALARY_CURRENCY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="settings-job-targets-salary-range">
                  <label className="field">
                    <span>Ideal salary from</span>
                    <input
                      defaultValue={workspace.profile.salaryTargetMin}
                      name="salaryTargetMin"
                      placeholder="90000"
                      type="number"
                    />
                  </label>
                  <label className="field">
                    <span>Ideal salary to</span>
                    <input
                      defaultValue={workspace.profile.salaryTargetMax}
                      name="salaryTargetMax"
                      placeholder="140000"
                      type="number"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="settings-tag-row field-grid field-grid-2">
              <TagInput
                helper="Press Enter after each role."
                label="Prioritize these roles"
                onChange={setTargetRoleTags}
                placeholder="e.g. Brand designer"
                tags={targetRoleTags}
              />
              <TagInput
                helper="Roles that are still worth seeing when the fit is strong."
                label="Also consider"
                onChange={setAdjacentRoleTags}
                placeholder="e.g. Art director"
                tags={adjacentRoleTags}
              />
            </div>
            </div>

            <div className="settings-toggle-row checkbox-row">
              <label className="checkbox-field">
                <input
                  defaultChecked={workspace.profile.remoteRequired}
                  name="remoteRequired"
                  type="checkbox"
                />
                <span>Only show remote roles</span>
              </label>
              <label className="checkbox-field">
                <input
                  defaultChecked={workspace.profile.relocationOpen}
                  name="relocationOpen"
                  type="checkbox"
                />
                <span>Open to relocation if fit is strong</span>
              </label>
            </div>
          </div>
        </details>
      </section>

      <DisclosureSection
        className="disclosure-experience"
        label="Experience and strengths"
        title="Review what was pulled from your resume."
        unwrapBody
      >
        <div className="strengths-experience-grid">
          <div className="upload-slot strengths-pro-summary-slot">
            <span className="upload-slot-label">Professional summary</span>
            <textarea
              defaultValue={workspace.profile.bioSummary}
              name="bioSummary"
              placeholder="A short summary of the kind of designer you are and the work you do best."
              rows={8}
            />
            <small>
              This reads like your positioning line — keep it specific enough that the workspace can echo
              it in tailored drafts.
            </small>
          </div>
        </div>

        <div
          className={`settings-tab-shell${activeStrengthsTab ? ' has-selection' : ''}`}
        >
          <div aria-label="Background sections" className="settings-tab-toolbar" role="tablist">
            <SettingsTabButton
              active={activeStrengthsTab === 'history'}
              count={experienceEntries.length}
              label="Roles and responsibilities"
              onClick={() =>
                setActiveStrengthsTab((current) => (current === 'history' ? null : 'history'))
              }
            />
            <SettingsTabButton
              active={activeStrengthsTab === 'education'}
              count={educationEntries.length}
              label="Schools and credentials"
              onClick={() =>
                setActiveStrengthsTab((current) => (current === 'education' ? null : 'education'))
              }
            />
            <SettingsTabButton
              active={activeStrengthsTab === 'highlights'}
              count={achievementBank.length}
              label="Wins and proof points"
              onClick={() =>
                setActiveStrengthsTab((current) =>
                  current === 'highlights' ? null : 'highlights',
                )
              }
            />
            <SettingsTabButton
              active={activeStrengthsTab === 'skillsTools'}
              count={skillsTags.length + toolsTags.length}
              label="Skills and tools"
              onClick={() =>
                setActiveStrengthsTab((current) =>
                  current === 'skillsTools' ? null : 'skillsTools',
                )
              }
            />
            <SettingsTabButton
              active={activeStrengthsTab === 'certifications'}
              count={certificationTags.length}
              label="Certifications"
              onClick={() =>
                setActiveStrengthsTab((current) =>
                  current === 'certifications' ? null : 'certifications',
                )
              }
            />
          </div>

          {activeStrengthsTab === 'history' ? (
            <section className="settings-tab-panel">
              <div className="settings-tab-panel-header">
                <div>
                  <p className="panel-label">Work history</p>
                  <h3>Roles and responsibilities</h3>
                </div>
                <span className="settings-tab-meta">{experienceEntries.length} roles</span>
              </div>
          <div className="section-header">
            <AddRowButton
              label="Add role"
              onClick={() => {
                setExperienceEntries((current) => [...current, createExperienceEntry()])
              }}
            />
          </div>
          <div className="repeat-list">
            {experienceEntries.map((entry, index) => (
              <article
                className="repeat-card"
                key={`${entry.companyName}-${entry.roleTitle}-${index}`}
              >
                <div className="repeat-card-header">
                  <strong>Experience {index + 1}</strong>
                  {experienceEntries.length > 1 ? (
                    <button
                      className="button button-ghost button-small"
                      onClick={() => {
                        setExperienceEntries((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }}
                      type="button"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="field-grid field-grid-2">
                  <label className="field">
                    <span>Job title</span>
                    <input
                    name="experienceRoleTitle"
                    onChange={(event) => {
                      setExperienceEntries((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, roleTitle: event.target.value } : item,
                        ),
                      )
                    }}
                    type="text"
                    value={entry.roleTitle}
                  />
                </label>
                <label className="field">
                  <span>Company</span>
                  <input
                    name="experienceCompanyName"
                    onChange={(event) => {
                      setExperienceEntries((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, companyName: event.target.value }
                            : item,
                        ),
                      )
                    }}
                    type="text"
                    value={entry.companyName}
                  />
                </label>
                <label className="field">
                  <span>Location</span>
                  <input
                    name="experienceLocationLabel"
                    onChange={(event) => {
                      setExperienceEntries((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, locationLabel: event.target.value }
                            : item,
                        ),
                      )
                    }}
                    type="text"
                    value={entry.locationLabel}
                  />
                </label>
                <div className="field-grid-dates-row">
                  <label className="field">
                    <span>Start</span>
                    <input
                      name="experienceStartDate"
                      onChange={(event) => {
                        setExperienceEntries((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, startDate: event.target.value }
                              : item,
                          ),
                        )
                      }}
                      placeholder="2024-01"
                      type="text"
                      value={entry.startDate}
                    />
                  </label>
                  <label className="field">
                    <span>End</span>
                    <input
                      name="experienceEndDate"
                      onChange={(event) => {
                        setExperienceEntries((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, endDate: event.target.value } : item,
                          ),
                        )
                      }}
                      placeholder="Leave blank if current"
                      type="text"
                      value={entry.endDate}
                    />
                  </label>
                </div>
              </div>
              <div className="field-grid field-grid-2">
                <label className="field">
                  <span>What you did</span>
                  <textarea
                    name="experienceSummary"
                    onChange={(event) => {
                      setExperienceEntries((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, summary: event.target.value } : item,
                        ),
                      )
                    }}
                    rows={5}
                    value={entry.summary}
                  />
                </label>
                <label className="field">
                  <span>Key results · bullets</span>
                  <textarea
                    name="experienceHighlights"
                    onChange={(event) => {
                      setExperienceEntries((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, highlights: highlightLinesFromMultiline(event.target.value) }
                            : item,
                        ),
                      )
                    }}
                    placeholder={'• Launched the rebrand\n• Cut review cycles by half'}
                    rows={5}
                    value={toTextAreaValue(entry.highlights)}
                  />
                </label>
              </div>
              </article>
            ))}
          </div>
            </section>
          ) : null}

          {activeStrengthsTab === 'education' ? (
            <section className="settings-tab-panel">
              <div className="settings-tab-panel-header">
                <div>
                  <p className="panel-label">Education</p>
                  <h3>Schools and credentials</h3>
                </div>
                <span className="settings-tab-meta">{educationEntries.length} schools</span>
              </div>
          <div className="section-header">
            <AddRowButton
              label="Add school"
              onClick={() => {
                setEducationEntries((current) => [...current, createEducationEntry()])
              }}
            />
          </div>
          <div className="repeat-list">
            {educationEntries.map((entry, index) => (
              <article
                className="repeat-card"
                key={`${entry.schoolName}-${entry.credential}-${index}`}
              >
                <div className="repeat-card-header">
                  <strong>Education {index + 1}</strong>
                  {educationEntries.length > 1 ? (
                    <button
                      className="button button-ghost button-small"
                      onClick={() => {
                        setEducationEntries((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }}
                      type="button"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="field-grid field-grid-2">
                  <label className="field">
                    <span>School</span>
                    <input
                    name="educationSchoolName"
                    onChange={(event) => {
                      setEducationEntries((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, schoolName: event.target.value } : item,
                        ),
                      )
                    }}
                    type="text"
                    value={entry.schoolName}
                  />
                </label>
                <label className="field">
                  <span>Degree or credential</span>
                  <input
                    name="educationCredential"
                    onChange={(event) => {
                      setEducationEntries((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, credential: event.target.value } : item,
                        ),
                      )
                    }}
                    type="text"
                    value={entry.credential}
                  />
                </label>
                <label className="field">
                  <span>Field of study</span>
                  <input
                    name="educationFieldOfStudy"
                    onChange={(event) => {
                      setEducationEntries((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, fieldOfStudy: event.target.value }
                            : item,
                        ),
                      )
                    }}
                    type="text"
                    value={entry.fieldOfStudy}
                  />
                </label>
                <div className="field-grid-dates-row">
                  <label className="field">
                    <span>Start year</span>
                    <input
                      name="educationStartDate"
                      onChange={(event) => {
                        setEducationEntries((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, startDate: event.target.value } : item,
                          ),
                        )
                      }}
                      type="text"
                      value={entry.startDate}
                    />
                  </label>
                  <label className="field">
                    <span>End year</span>
                    <input
                      name="educationEndDate"
                      onChange={(event) => {
                        setEducationEntries((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, endDate: event.target.value } : item,
                          ),
                        )
                      }}
                      type="text"
                      value={entry.endDate}
                    />
                  </label>
                </div>
              </div>
              <input name="educationNotes" type="hidden" value={entry.notes} />
              </article>
            ))}
          </div>
            </section>
          ) : null}

          {activeStrengthsTab === 'highlights' ? (
            <section className="settings-tab-panel">
              <div className="settings-tab-panel-header">
                <div>
                  <p className="panel-label">Highlights</p>
                  <h3>Wins and proof points</h3>
                </div>
                <span className="settings-tab-meta">{achievementBank.length} items</span>
              </div>
              <div className="section-header">
                <AddRowButton
                  label="Add highlight"
                  onClick={() => {
                    setAchievementBank((current) => [...current, createAchievementEntry()])
                  }}
                />
              </div>
              <div className="repeat-list">
                {achievementBank.map((achievement, index) => (
                  <article className="repeat-card" key={`${achievement.title}-${index}`}>
                    <div className="repeat-card-header">
                      <strong>Achievement {index + 1}</strong>
                      {achievementBank.length > 1 ? (
                        <button
                          className="button button-ghost button-small"
                          onClick={() => {
                            setAchievementBank((current) =>
                              current.filter((_, itemIndex) => itemIndex !== index),
                            )
                          }}
                          type="button"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <div className="field-grid field-grid-2">
                      <label className="field">
                        <span>Type</span>
                        <input
                          name="achievementCategory"
                          onChange={(event) => {
                            setAchievementBank((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, category: event.target.value }
                                  : item,
                              ),
                            )
                          }}
                          type="text"
                          value={achievement.category}
                        />
                      </label>
                      <label className="field">
                        <span>Headline</span>
                        <input
                          name="achievementTitle"
                          onChange={(event) => {
                            setAchievementBank((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, title: event.target.value } : item,
                              ),
                            )
                          }}
                          type="text"
                          value={achievement.title}
                        />
                      </label>
                    </div>
                    <label className="field">
                      <span>Details</span>
                      <textarea
                        name="achievementDetail"
                        onChange={(event) => {
                          setAchievementBank((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, detail: event.target.value } : item,
                            ),
                          )
                        }}
                        rows={4}
                        value={achievement.detail}
                      />
                    </label>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {activeStrengthsTab === 'skillsTools' ? (
            <section className="settings-tab-panel">
              <div className="settings-tab-panel-header">
                <div>
                  <p className="panel-label">Capabilities</p>
                  <h3>Skills and tools</h3>
                </div>
                <span className="settings-tab-meta">
                  {skillsTags.length} skills · {toolsTags.length} tools
                </span>
              </div>
              <div className="settings-tag-row field-grid field-grid-2">
                <TagInput
                  helper="Press Enter after each skill."
                  label="Core skills"
                  onChange={setSkillsTags}
                  placeholder="e.g. Brand systems"
                  preserveCase
                  tags={skillsTags}
                />
                <TagInput
                  helper="Press Enter after each tool."
                  label="Tools I use"
                  onChange={setToolsTags}
                  placeholder="e.g. Figma"
                  preserveCase
                  tags={toolsTags}
                />
              </div>
            </section>
          ) : null}

          {activeStrengthsTab === 'certifications' ? (
            <section className="settings-tab-panel">
              <div className="settings-tab-panel-header">
                <div>
                  <p className="panel-label">Credentials</p>
                  <h3>Certifications</h3>
                </div>
                <span className="settings-tab-meta">{certificationTags.length} listed</span>
              </div>
              <div className="settings-tag-row field-grid">
                <TagInput
                  helper="Press Enter after each certification."
                  label="Certifications"
                  onChange={setCertificationTags}
                  placeholder="e.g. AWS Certified"
                  preserveCase
                  tags={certificationTags}
                />
              </div>
            </section>
          ) : null}
        </div>

        <div aria-hidden="true" className="profile-form-portfolio-preserve">
          <div className="section-header">
            <AddRowButton
              label="Add project"
              onClick={() => {
                setPortfolioItems((current) => [...current, createPortfolioItem()])
              }}
            />
          </div>
          <div className="repeat-list">
            {portfolioItems.map((item, index) => (
              <article className="repeat-card" key={item.id}>
                <input name="portfolioItemId" type="hidden" value={item.id} />
                <div className="repeat-card-header">
                  <strong>Portfolio item {index + 1}</strong>
                  {portfolioItems.length > 1 ? (
                    <button
                      className="button button-ghost button-small"
                      onClick={() => {
                        setPortfolioItems((current) =>
                          current.filter((portfolioItem) => portfolioItem.id !== item.id),
                        )
                      }}
                      type="button"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="field-grid field-grid-2">
                  <label className="field">
                    <span>Title</span>
                    <input
                      name="portfolioTitle"
                      onChange={(event) => {
                        setPortfolioItems((current) =>
                          current.map((portfolioItem) =>
                            portfolioItem.id === item.id
                              ? { ...portfolioItem, title: event.target.value }
                              : portfolioItem,
                          ),
                        )
                      }}
                      type="text"
                      value={item.title}
                    />
                  </label>
                  <label className="field">
                    <span>URL</span>
                    <input
                      name="portfolioUrl"
                      onChange={(event) => {
                        setPortfolioItems((current) =>
                          current.map((portfolioItem) =>
                            portfolioItem.id === item.id
                              ? { ...portfolioItem, url: event.target.value }
                              : portfolioItem,
                          ),
                        )
                      }}
                      type="url"
                      value={item.url}
                    />
                  </label>
                  <label className="field">
                    <span>Project type</span>
                    <input
                      name="portfolioProjectType"
                      onChange={(event) => {
                        setPortfolioItems((current) =>
                          current.map((portfolioItem) =>
                            portfolioItem.id === item.id
                              ? { ...portfolioItem, projectType: event.target.value }
                              : portfolioItem,
                          ),
                        )
                      }}
                      type="text"
                      value={item.projectType}
                    />
                  </label>
                  <label className="field">
                    <span>Role label</span>
                    <input
                      name="portfolioRoleLabel"
                      onChange={(event) => {
                        setPortfolioItems((current) =>
                          current.map((portfolioItem) =>
                            portfolioItem.id === item.id
                              ? { ...portfolioItem, roleLabel: event.target.value }
                              : portfolioItem,
                          ),
                        )
                      }}
                      type="text"
                      value={item.roleLabel}
                    />
                  </label>
                  <label className="field">
                    <span>Visual strength (1-5)</span>
                    <input
                      max={5}
                      min={1}
                      name="portfolioVisualStrengthRating"
                      onChange={(event) => {
                        setPortfolioItems((current) =>
                          current.map((portfolioItem) =>
                            portfolioItem.id === item.id
                              ? { ...portfolioItem, visualStrengthRating: event.target.value }
                              : portfolioItem,
                          ),
                        )
                      }}
                      type="number"
                      value={item.visualStrengthRating}
                    />
                  </label>
                  <label className="field">
                    <span>Default showcase item</span>
                    <select
                      name="portfolioIsPrimary"
                      onChange={(event) => {
                        setPortfolioItems((current) =>
                          current.map((portfolioItem) =>
                            portfolioItem.id === item.id
                              ? {
                                  ...portfolioItem,
                                  isPrimary: event.target.value === 'true',
                                }
                              : portfolioItem,
                          ),
                        )
                      }}
                      value={item.isPrimary ? 'true' : 'false'}
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Status</span>
                    <select
                      name="portfolioIsActive"
                      onChange={(event) => {
                        setPortfolioItems((current) =>
                          current.map((portfolioItem) =>
                            portfolioItem.id === item.id
                              ? {
                                  ...portfolioItem,
                                  isActive: event.target.value === 'true',
                                }
                              : portfolioItem,
                          ),
                        )
                      }}
                      value={item.isActive ? 'true' : 'false'}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>Summary</span>
                  <textarea
                    name="portfolioSummary"
                    onChange={(event) => {
                      setPortfolioItems((current) =>
                        current.map((portfolioItem) =>
                          portfolioItem.id === item.id
                            ? { ...portfolioItem, summary: event.target.value }
                            : portfolioItem,
                        ),
                      )
                    }}
                    rows={4}
                    value={item.summary}
                  />
                </label>
                <div className="field-grid field-grid-2">
                  <label className="field">
                    <span>Skills tags</span>
                    <textarea
                      name="portfolioSkillsTags"
                      onChange={(event) => {
                        setPortfolioItems((current) =>
                          current.map((portfolioItem) =>
                            portfolioItem.id === item.id
                              ? {
                                  ...portfolioItem,
                                  skillsTags: event.target.value
                                    .split('\n')
                                    .map((line) => line.trim())
                                    .filter(Boolean),
                                }
                              : portfolioItem,
                          ),
                        )
                      }}
                      rows={4}
                      value={toTextAreaValue(item.skillsTags)}
                    />
                  </label>
                  <label className="field">
                    <span>Industry tags</span>
                    <textarea
                      name="portfolioIndustryTags"
                      onChange={(event) => {
                        setPortfolioItems((current) =>
                          current.map((portfolioItem) =>
                            portfolioItem.id === item.id
                              ? {
                                  ...portfolioItem,
                                  industryTags: event.target.value
                                    .split('\n')
                                    .map((line) => line.trim())
                                    .filter(Boolean),
                                }
                              : portfolioItem,
                          ),
                        )
                      }}
                      rows={4}
                      value={toTextAreaValue(item.industryTags)}
                    />
                  </label>
                </div>
                <label className="field">
                  <span>Outcome metrics</span>
                  <textarea
                    name="portfolioOutcomeMetrics"
                    onChange={(event) => {
                      setPortfolioItems((current) =>
                        current.map((portfolioItem) =>
                          portfolioItem.id === item.id
                            ? {
                                ...portfolioItem,
                                outcomeMetrics: event.target.value
                                  .split('\n')
                                  .map((line) => line.trim())
                                  .filter(Boolean),
                              }
                            : portfolioItem,
                        ),
                      )
                    }}
                    rows={4}
                    value={toTextAreaValue(item.outcomeMetrics)}
                  />
                </label>
              </article>
            ))}
          </div>
        </div>
      </DisclosureSection>

      <DisclosureSection
        label="Advanced filters"
        title="Add constraints only if they help."
      >
        <div className="settings-advanced-tags-row">
          <TagInput
            helper="Press Enter after each value. Stored as a comma-separated preference."
            label="Timezone"
            onChange={setTimezoneTags}
            placeholder="e.g. America/Toronto"
            preserveCase
            tags={timezoneTags}
          />
          <TagInput
            helper="Press Enter after each region."
            label="Allowed remote regions"
            onChange={setAllowedRemoteRegionTags}
            placeholder="e.g. Canada"
            preserveCase
            tags={allowedRemoteRegionTags}
          />
          <TagInput
            helper="Press Enter after each industry."
            label="Preferred industries"
            onChange={setIndustriesPreferredTags}
            placeholder="e.g. Fintech"
            preserveCase
            tags={industriesPreferredTags}
          />
        </div>
      </DisclosureSection>

      {saveMessageRoot
        ? createPortal(
            <div className="profile-rail-save-message">
              <div
                className={`form-message ${
                  state.status === 'success'
                    ? 'form-message-success'
                    : state.status === 'error'
                      ? 'form-message-error'
                      : ''
                }`}
              >
                {state.message ||
                  'Saved changes update job recommendations, packet drafts, and portfolio picks.'}
              </div>
            </div>,
            saveMessageRoot,
          )
        : null}
    </form>
  )
}
