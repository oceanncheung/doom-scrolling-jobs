'use client'

import type { Dispatch, SetStateAction } from 'react'

import type {
  OperatorPortfolioItemRecord,
  ResumeEducationRecord,
  ResumeExperienceRecord,
} from '@/lib/domain/types'

import {
  AddRowButton,
  DisclosureSection,
  SectionLockFrame,
  SettingsTabButton,
  SettingsTabPanel,
  SettingsTabShell,
} from '@/components/profile/profile-form-controls'
import { AutoSizeTextarea } from '@/components/ui/auto-size-textarea'
import { BulletTextarea } from '@/components/ui/bullet-textarea'
import { FieldLabelRow } from '@/components/ui/field-label-row'
import { TagInput } from '@/components/ui/tag-input'
import type { ReviewState } from '@/lib/profile/master-assets'

export type StrengthsTab =
  | 'certifications'
  | 'education'
  | 'history'
  | 'skillsTools'

function toTextAreaValue(values: string[]) {
  return values.join('\n')
}

interface ExperienceStrengthsSectionProps {
  bioSummary: string
  activeStrengthsTab: StrengthsTab | null
  certificationsReviewState: ReviewState
  setActiveStrengthsTab: Dispatch<SetStateAction<StrengthsTab | null>>
  setBioSummary: Dispatch<SetStateAction<string>>
  experienceEntries: ResumeExperienceRecord[]
  setExperienceEntries: Dispatch<SetStateAction<ResumeExperienceRecord[]>>
  educationEntries: ResumeEducationRecord[]
  setEducationEntries: Dispatch<SetStateAction<ResumeEducationRecord[]>>
  educationReviewState: ReviewState
  portfolioItems: OperatorPortfolioItemRecord[]
  setPortfolioItems: Dispatch<SetStateAction<OperatorPortfolioItemRecord[]>>
  historyReviewState: ReviewState
  skillsTags: string[]
  setSkillsTags: Dispatch<SetStateAction<string[]>>
  toolsTags: string[]
  setToolsTags: Dispatch<SetStateAction<string[]>>
  languageTags: string[]
  setLanguageTags: Dispatch<SetStateAction<string[]>>
  lockedMessage?: string | null
  certificationTags: string[]
  setCertificationTags: Dispatch<SetStateAction<string[]>>
  skillsToolsReviewState: ReviewState
  summaryReviewState: ReviewState
  createExperienceEntry: () => ResumeExperienceRecord
  createEducationEntry: () => ResumeEducationRecord
  createPortfolioItem: () => OperatorPortfolioItemRecord
}

export function ExperienceStrengthsSection({
  bioSummary,
  activeStrengthsTab,
  certificationsReviewState,
  setActiveStrengthsTab,
  setBioSummary,
  experienceEntries,
  setExperienceEntries,
  educationEntries,
  setEducationEntries,
  educationReviewState,
  portfolioItems,
  setPortfolioItems,
  historyReviewState,
  skillsTags,
  setSkillsTags,
  toolsTags,
  setToolsTags,
  languageTags,
  setLanguageTags,
  lockedMessage,
  certificationTags,
  setCertificationTags,
  skillsToolsReviewState,
  summaryReviewState,
  createExperienceEntry,
  createEducationEntry,
  createPortfolioItem,
}: ExperienceStrengthsSectionProps) {
  return (
    <DisclosureSection
      className="disclosure-experience"
      label="Experience and strengths"
      title="Review and refine the experience pulled from your resume."
      unwrapBody
    >
      <SectionLockFrame lockedMessage={lockedMessage}>
        <div className="strengths-experience-grid">
          <label className={`upload-slot strengths-pro-summary-slot field--${summaryReviewState}`}>
            <FieldLabelRow labelClassName="upload-slot-label" reviewState={summaryReviewState}>
              Professional summary
            </FieldLabelRow>
            <AutoSizeTextarea
              name="bioSummary"
              onChange={(event) => setBioSummary(event.target.value)}
              placeholder="A short summary of the kind of designer you are and the work you do best."
              value={bioSummary}
            />
            <small>
              This reads like your positioning line. Keep it specific enough that the workspace can
              echo it in tailored drafts.
            </small>
          </label>
        </div>

        <SettingsTabShell
          ariaLabel="Background sections"
          hasSelection={Boolean(activeStrengthsTab)}
          toolbar={
            <>
              <SettingsTabButton
                active={activeStrengthsTab === 'history'}
                label="Roles and responsibilities"
                onClick={() => setActiveStrengthsTab((current) => (current === 'history' ? null : 'history'))}
                reviewState={historyReviewState}
              />
              <SettingsTabButton
                active={activeStrengthsTab === 'education'}
                label="Schools and credentials"
                onClick={() => setActiveStrengthsTab((current) => (current === 'education' ? null : 'education'))}
                reviewState={educationReviewState}
              />
              <SettingsTabButton
                active={activeStrengthsTab === 'skillsTools'}
                label="Skills and tools"
                onClick={() =>
                  setActiveStrengthsTab((current) => (current === 'skillsTools' ? null : 'skillsTools'))
                }
                reviewState={skillsToolsReviewState}
              />
              <SettingsTabButton
                active={activeStrengthsTab === 'certifications'}
                label="Certifications"
                onClick={() =>
                  setActiveStrengthsTab((current) =>
                    current === 'certifications' ? null : 'certifications',
                  )
                }
                reviewState={certificationsReviewState}
              />
            </>
          }
        >

          {activeStrengthsTab === 'history' || activeStrengthsTab === 'education' ? (
            <SettingsTabPanel
              label={activeStrengthsTab === 'history' ? 'Work history' : 'Education'}
              title={
                activeStrengthsTab === 'history'
                  ? 'Roles and responsibilities'
                  : 'Schools and credentials'
              }
            >
            <div className="section-header">
              <AddRowButton
                label={activeStrengthsTab === 'history' ? 'Add role' : 'Add school'}
                onClick={() => {
                  if (activeStrengthsTab === 'history') {
                    setExperienceEntries((current) => [...current, createExperienceEntry()])
                  } else {
                    setEducationEntries((current) => [...current, createEducationEntry()])
                  }
                }}
              />
            </div>
            <div className="repeat-list">
              {activeStrengthsTab === 'history'
                ? experienceEntries.map((entry, index) => (
                <article className="repeat-card" key={`${entry.companyName}-${entry.roleTitle}-${index}`}>
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
                              itemIndex === index ? { ...item, companyName: event.target.value } : item,
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
                              itemIndex === index ? { ...item, locationLabel: event.target.value } : item,
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
                                itemIndex === index ? { ...item, startDate: event.target.value } : item,
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
                    <label className="field field--fixed-scroll">
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
                      <span>Key results</span>
                      <BulletTextarea
                        className="experience-results-textarea"
                        items={entry.highlights}
                        name="experienceHighlights"
                        onItemsChange={(nextHighlights) => {
                          setExperienceEntries((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, highlights: nextHighlights }
                                : item,
                            ),
                          )
                        }}
                        rows={5}
                      />
                    </label>
                  </div>
                </article>
              ))
                : educationEntries.map((entry, index) => (
                <article className="repeat-card" key={`${entry.schoolName}-${entry.credential}-${index}`}>
                  <div className="repeat-card-header">
                    <strong>Education {index + 1}</strong>
                    <button
                      className="button button-ghost button-small"
                      onClick={() => {
                        setEducationEntries((current) => {
                          if (current.length <= 1) {
                            return [createEducationEntry()]
                          }
                          return current.filter((_, itemIndex) => itemIndex !== index)
                        })
                      }}
                      type="button"
                    >
                      Remove
                    </button>
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
                              itemIndex === index ? { ...item, fieldOfStudy: event.target.value } : item,
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
          </SettingsTabPanel>
          ) : null}

          {activeStrengthsTab === 'skillsTools' ? (
            <SettingsTabPanel label="Capabilities" title="Skills and tools">
            <div className="settings-tag-row field-grid field-grid-2">
              <TagInput
                label="Core skills"
                onChange={setSkillsTags}
                placeholder="e.g. Brand systems"
                preserveCase
                reviewState={skillsToolsReviewState}
                tags={skillsTags}
              />
              <TagInput
                label="Tools I use"
                onChange={setToolsTags}
                placeholder="e.g. Figma"
                preserveCase
                reviewState={skillsToolsReviewState}
                tags={toolsTags}
              />
              <TagInput
                label="Languages"
                onChange={setLanguageTags}
                placeholder="e.g. English"
                preserveCase
                reviewState={skillsToolsReviewState}
                tags={languageTags}
              />
            </div>
            </SettingsTabPanel>
          ) : null}

          {activeStrengthsTab === 'certifications' ? (
            <SettingsTabPanel label="Credentials" title="Certifications">
            <div className="settings-tag-row field-grid">
              <TagInput
                label="Certifications"
                onChange={setCertificationTags}
                placeholder="e.g. AWS Certified"
                preserveCase
                reviewState={certificationsReviewState}
                tags={certificationTags}
              />
            </div>
            </SettingsTabPanel>
          ) : null}
        </SettingsTabShell>
      </SectionLockFrame>

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
                            ? { ...portfolioItem, isPrimary: event.target.value === 'true' }
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
                            ? { ...portfolioItem, isActive: event.target.value === 'true' }
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
  )
}
