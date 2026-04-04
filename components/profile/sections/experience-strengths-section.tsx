'use client'

import type { Dispatch, SetStateAction } from 'react'

import type {
  OperatorPortfolioItemRecord,
  ResumeAchievementRecord,
  ResumeEducationRecord,
  ResumeExperienceRecord,
} from '@/lib/domain/types'

import { AddRowButton, DisclosureSection, SettingsTabButton } from '@/components/profile/profile-form-controls'
import { TagInput } from '@/components/ui/tag-input'
import { highlightLinesFromMultiline } from '@/lib/profile/highlight-lines'

export type StrengthsTab =
  | 'certifications'
  | 'education'
  | 'highlights'
  | 'history'
  | 'skillsTools'

function toTextAreaValue(values: string[]) {
  return values.join('\n')
}

interface ExperienceStrengthsSectionProps {
  bioSummary: string
  activeStrengthsTab: StrengthsTab | null
  setActiveStrengthsTab: Dispatch<SetStateAction<StrengthsTab | null>>
  experienceEntries: ResumeExperienceRecord[]
  setExperienceEntries: Dispatch<SetStateAction<ResumeExperienceRecord[]>>
  achievementBank: ResumeAchievementRecord[]
  setAchievementBank: Dispatch<SetStateAction<ResumeAchievementRecord[]>>
  educationEntries: ResumeEducationRecord[]
  setEducationEntries: Dispatch<SetStateAction<ResumeEducationRecord[]>>
  portfolioItems: OperatorPortfolioItemRecord[]
  setPortfolioItems: Dispatch<SetStateAction<OperatorPortfolioItemRecord[]>>
  skillsTags: string[]
  setSkillsTags: Dispatch<SetStateAction<string[]>>
  toolsTags: string[]
  setToolsTags: Dispatch<SetStateAction<string[]>>
  certificationTags: string[]
  setCertificationTags: Dispatch<SetStateAction<string[]>>
  createExperienceEntry: () => ResumeExperienceRecord
  createAchievementEntry: () => ResumeAchievementRecord
  createEducationEntry: () => ResumeEducationRecord
  createPortfolioItem: () => OperatorPortfolioItemRecord
}

export function ExperienceStrengthsSection({
  bioSummary,
  activeStrengthsTab,
  setActiveStrengthsTab,
  experienceEntries,
  setExperienceEntries,
  achievementBank,
  setAchievementBank,
  educationEntries,
  setEducationEntries,
  portfolioItems,
  setPortfolioItems,
  skillsTags,
  setSkillsTags,
  toolsTags,
  setToolsTags,
  certificationTags,
  setCertificationTags,
  createExperienceEntry,
  createAchievementEntry,
  createEducationEntry,
  createPortfolioItem,
}: ExperienceStrengthsSectionProps) {
  return (
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
            defaultValue={bioSummary}
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

      <div className={`settings-tab-shell${activeStrengthsTab ? ' has-selection' : ''}`}>
        <div aria-label="Background sections" className="settings-tab-toolbar" role="tablist">
          <SettingsTabButton
            active={activeStrengthsTab === 'history'}
            count={experienceEntries.length}
            label="Roles and responsibilities"
            onClick={() => setActiveStrengthsTab((current) => (current === 'history' ? null : 'history'))}
          />
          <SettingsTabButton
            active={activeStrengthsTab === 'education'}
            count={educationEntries.length}
            label="Schools and credentials"
            onClick={() => setActiveStrengthsTab((current) => (current === 'education' ? null : 'education'))}
          />
          <SettingsTabButton
            active={activeStrengthsTab === 'highlights'}
            count={achievementBank.length}
            label="Wins and proof points"
            onClick={() =>
              setActiveStrengthsTab((current) => (current === 'highlights' ? null : 'highlights'))
            }
          />
          <SettingsTabButton
            active={activeStrengthsTab === 'skillsTools'}
            count={skillsTags.length + toolsTags.length}
            label="Skills and tools"
            onClick={() =>
              setActiveStrengthsTab((current) => (current === 'skillsTools' ? null : 'skillsTools'))
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
                <article className="repeat-card" key={`${entry.schoolName}-${entry.credential}-${index}`}>
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
                              itemIndex === index ? { ...item, category: event.target.value } : item,
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
