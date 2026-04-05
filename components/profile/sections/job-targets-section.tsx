'use client'

import type { Dispatch, SetStateAction } from 'react'

import { SectionLockFrame } from '@/components/profile/profile-form-controls'
import { AutoSizeTextarea } from '@/components/ui/auto-size-textarea'
import { FieldLabelRow } from '@/components/ui/field-label-row'
import { ChevronDownIcon } from '@/components/ui/icons/chevron-down-icon'
import { OverlayOptionField } from '@/components/ui/overlay-option-field'
import { TagToggleGroup } from '@/components/ui/tag-toggle-group'
import { TagInput } from '@/components/ui/tag-input'
import { REGION_SUGGESTIONS } from '@/lib/profile/autocomplete-options'
import type { ReviewState } from '@/lib/profile/master-assets'
import { SALARY_CURRENCY_OPTIONS } from '@/lib/profile/salary-currency'
import { SENIORITY_LEVEL_OPTIONS } from '@/lib/profile/seniority-level'

interface JobTargetsSectionProps {
  adjacentRolesReviewState: ReviewState
  searchBrief: string
  hiringMarketTags: string[]
  lockedMessage?: string | null
  searchBriefReviewState: ReviewState
  salaryFloorCurrency: string
  salaryTargetMin: string
  salaryTargetMax: string
  remoteRequired: boolean
  relocationOpen: boolean
  seniorityReviewState: ReviewState
  targetSeniorityLevels: string[]
  targetRolesReviewState: ReviewState
  setHiringMarketTags: Dispatch<SetStateAction<string[]>>
  setSearchBrief: Dispatch<SetStateAction<string>>
  setTargetSeniorityLevels: Dispatch<SetStateAction<string[]>>
  targetRoleTags: string[]
  setTargetRoleTags: Dispatch<SetStateAction<string[]>>
  adjacentRoleTags: string[]
  setAdjacentRoleTags: Dispatch<SetStateAction<string[]>>
}

export function JobTargetsSection({
  adjacentRolesReviewState,
  searchBrief,
  hiringMarketTags,
  lockedMessage,
  searchBriefReviewState,
  salaryFloorCurrency,
  salaryTargetMin,
  salaryTargetMax,
  remoteRequired,
  relocationOpen,
  seniorityReviewState,
  targetSeniorityLevels,
  targetRolesReviewState,
  setHiringMarketTags,
  setSearchBrief,
  setTargetSeniorityLevels,
  targetRoleTags,
  setTargetRoleTags,
  adjacentRoleTags,
  setAdjacentRoleTags,
}: JobTargetsSectionProps) {
  return (
    <section className="panel settings-section">
      <div className="settings-section-header">
        <div className="settings-section-title-stack">
          <p className="panel-label">Job targets</p>
          <h2>Refine the roles this workspace should prioritize.</h2>
        </div>
      </div>

      <SectionLockFrame lockedMessage={lockedMessage}>
        <div className="settings-core-grid">
          <label className={`field settings-field-wide settings-search-brief field--${searchBriefReviewState}`}>
            <FieldLabelRow reviewState={searchBriefReviewState}>Good roles to prioritize</FieldLabelRow>
            <AutoSizeTextarea
              name="searchBrief"
              onChange={(event) => setSearchBrief(event.target.value)}
              placeholder="Generated from your resume. Edit to refine."
              value={searchBrief}
            />
            <small>Roles matching this get prioritized.</small>
          </label>
        </div>

        <details className="settings-action-disclosure">
          <summary className="settings-action-summary">
            <span className="settings-action-toggle">
              Additional filters
              <span aria-hidden="true" className="settings-action-toggle-icon">
                <ChevronDownIcon />
              </span>
            </span>
          </summary>
          <div className="settings-action-body">
            <div className="settings-core-grid">
              <div className="settings-job-targets-row">
                <div className="settings-job-targets-col-left">
                  <TagInput
                    label="Hiring markets"
                    onChange={setHiringMarketTags}
                    placeholder="e.g. Canada"
                    preserveCase
                    suggestions={REGION_SUGGESTIONS}
                    tags={hiringMarketTags}
                    variant="square"
                  />
                  <TagToggleGroup
                    label="Target seniority (Multi-select)"
                    onChange={setTargetSeniorityLevels}
                    options={SENIORITY_LEVEL_OPTIONS.filter((option) => option.value.length > 0)}
                    reviewState={seniorityReviewState}
                    values={targetSeniorityLevels}
                  />
                  <TagInput
                    label="Prioritize these roles"
                    onChange={setTargetRoleTags}
                    placeholder="e.g. Brand designer"
                    reviewState={targetRolesReviewState}
                    tags={targetRoleTags}
                    variant="square"
                  />
                  <TagInput
                    label="Also consider"
                    onChange={setAdjacentRoleTags}
                    placeholder="e.g. Art director"
                    reviewState={adjacentRolesReviewState}
                    tags={adjacentRoleTags}
                    variant="square"
                  />
                </div>
                <div className="settings-job-targets-col-right">
                  <label className="field settings-salary-currency-field">
                    <span>Salary currency</span>
                    <OverlayOptionField
                      ariaLabel="Salary currency"
                      defaultValue={salaryFloorCurrency}
                      name="salaryFloorCurrency"
                      openBehavior="click"
                      options={SALARY_CURRENCY_OPTIONS}
                      placeholder="Select currency"
                      triggerVariant="underline-button"
                    />
                  </label>
                  <div className="settings-job-targets-salary-range">
                    <label className="field">
                      <span>Ideal salary from</span>
                      <input
                        defaultValue={salaryTargetMin}
                        name="salaryTargetMin"
                        placeholder="90000"
                        type="number"
                      />
                    </label>
                    <label className="field">
                      <span>Ideal salary to</span>
                      <input
                        defaultValue={salaryTargetMax}
                        name="salaryTargetMax"
                        placeholder="140000"
                        type="number"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-toggle-row checkbox-row">
              <label className="checkbox-field">
                <input defaultChecked={remoteRequired} name="remoteRequired" type="checkbox" />
                <span>Only show remote roles</span>
              </label>
              <label className="checkbox-field">
                <input defaultChecked={relocationOpen} name="relocationOpen" type="checkbox" />
                <span>Open to relocation if fit is strong</span>
              </label>
            </div>
          </div>
        </details>
      </SectionLockFrame>
    </section>
  )
}
