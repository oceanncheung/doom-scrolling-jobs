'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useId } from 'react'

import { SectionLockFrame } from '@/components/profile/profile-form-controls'
import { AutoSizeTextarea } from '@/components/ui/auto-size-textarea'
import { FieldLabelRow } from '@/components/ui/field-label-row'
import { ChevronDownIcon } from '@/components/ui/icons/chevron-down-icon'
import { OverlayOptionField } from '@/components/ui/overlay-option-field'
import { SectionHeading } from '@/components/ui/section-heading'
import { SingleSelectChipGroup } from '@/components/ui/single-select-chip-group'
import { TagToggleGroup } from '@/components/ui/tag-toggle-group'
import { TagInput } from '@/components/ui/tag-input'
import type {
  MatchingMarketStrictness,
  MatchingRoleBreadth,
  MatchingSourceMix,
} from '@/lib/domain/types'
import {
  matchingMarketStrictnessOptions,
  matchingRoleBreadthOptions,
  matchingSourceMixOptions,
} from '@/lib/profile/matching-preferences'
import { REGION_SUGGESTIONS } from '@/lib/profile/autocomplete-options'
import type { ReviewState } from '@/lib/profile/master-assets'
import { SALARY_CURRENCY_OPTIONS } from '@/lib/profile/salary-currency'
import { SENIORITY_LEVEL_OPTIONS } from '@/lib/profile/seniority-level'

interface JobTargetsSectionProps {
  adjacentRolesReviewState: ReviewState
  searchBrief: string
  hiringMarketTags: string[]
  lockedMessage?: string | null
  matchingMarketStrictness: MatchingMarketStrictness
  matchingRoleBreadth: MatchingRoleBreadth
  matchingSourceMix: MatchingSourceMix
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
  setMatchingMarketStrictness: Dispatch<SetStateAction<MatchingMarketStrictness>>
  setMatchingRoleBreadth: Dispatch<SetStateAction<MatchingRoleBreadth>>
  setMatchingSourceMix: Dispatch<SetStateAction<MatchingSourceMix>>
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
  matchingMarketStrictness,
  matchingRoleBreadth,
  matchingSourceMix,
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
  setMatchingMarketStrictness,
  setMatchingRoleBreadth,
  setMatchingSourceMix,
  setSearchBrief,
  setTargetSeniorityLevels,
  targetRoleTags,
  setTargetRoleTags,
  adjacentRoleTags,
  setAdjacentRoleTags,
}: JobTargetsSectionProps) {
  const salaryTargetMinId = useId()
  const salaryTargetMaxId = useId()

  return (
    <section className="panel settings-section">
      <SectionHeading
        label="Job targets"
        title="Refine the roles this workspace should prioritize."
      />

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
              <div className="settings-job-targets-grid">
                <div className="settings-job-targets-pair">
                  <div className="settings-job-targets-stack-sm">
                    <FieldLabelRow labelClassName="settings-job-targets-eyebrow">Hiring markets</FieldLabelRow>
                    <div className="settings-job-targets-stack-sm-content">
                      <TagInput
                        hideLabel
                        label="Hiring markets"
                        onChange={setHiringMarketTags}
                        placeholder="e.g. Canada"
                        preserveCase
                        suggestions={REGION_SUGGESTIONS}
                        tags={hiringMarketTags}
                      />
                    </div>
                  </div>
                  <div className="settings-job-targets-stack-sm">
                    <FieldLabelRow labelClassName="settings-job-targets-eyebrow">Salary currency</FieldLabelRow>
                    <div className="settings-job-targets-stack-sm-content">
                      <label className="field settings-job-targets-control-field">
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
                    </div>
                  </div>
                </div>

                <div className="settings-job-targets-pair">
                  <div className="settings-job-targets-stack-sm">
                    <FieldLabelRow labelClassName="settings-job-targets-eyebrow" reviewState={seniorityReviewState}>
                      Target seniority (Multi-select)
                    </FieldLabelRow>
                    <div className="settings-job-targets-stack-sm-content">
                      <TagToggleGroup
                        hideLabel
                        label="Target seniority (Multi-select)"
                        onChange={setTargetSeniorityLevels}
                        options={SENIORITY_LEVEL_OPTIONS.filter((option) => option.value.length > 0)}
                        reviewState={seniorityReviewState}
                        values={targetSeniorityLevels}
                      />
                    </div>
                  </div>
                  <div className="settings-job-targets-stack-sm">
                    <div className="settings-job-targets-salary-eyebrow-band">
                      <label
                        className="field-label-row settings-job-targets-salary-eyebrow-label"
                        htmlFor={salaryTargetMinId}
                      >
                        <span className="settings-job-targets-eyebrow">Ideal salary from</span>
                      </label>
                      <label
                        className="field-label-row settings-job-targets-salary-eyebrow-label"
                        htmlFor={salaryTargetMaxId}
                      >
                        <span className="settings-job-targets-eyebrow">Ideal salary to</span>
                      </label>
                    </div>
                    <div className="settings-job-targets-stack-sm-content">
                      <div className="settings-job-targets-salary-inputs-row">
                        <label className="field">
                          <input
                            defaultValue={salaryTargetMin}
                            id={salaryTargetMinId}
                            name="salaryTargetMin"
                            placeholder="90000"
                            type="number"
                          />
                        </label>
                        <label className="field">
                          <input
                            defaultValue={salaryTargetMax}
                            id={salaryTargetMaxId}
                            name="salaryTargetMax"
                            placeholder="140000"
                            type="number"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="settings-job-targets-pair">
                  <div className="settings-job-targets-stack-sm">
                    <FieldLabelRow labelClassName="settings-job-targets-eyebrow" reviewState={targetRolesReviewState}>
                      Prioritize these roles
                    </FieldLabelRow>
                    <div className="settings-job-targets-stack-sm-content">
                      <TagInput
                        hideLabel
                        label="Prioritize these roles"
                        onChange={setTargetRoleTags}
                        placeholder="e.g. Brand designer"
                        reviewState={targetRolesReviewState}
                        tags={targetRoleTags}
                      />
                    </div>
                  </div>
                  <div className="settings-job-targets-stack-sm">
                    <FieldLabelRow labelClassName="settings-job-targets-eyebrow">Remote & relocation</FieldLabelRow>
                    <div className="settings-job-targets-stack-sm-content">
                      <div className="settings-toggle-row checkbox-row settings-job-targets-flex-toggles">
                        <label className="checkbox-field">
                          <input defaultChecked={remoteRequired} name="remoteRequired" type="checkbox" />
                          <span>Only show remote roles</span>
                        </label>
                        <label className="checkbox-field">
                          <input defaultChecked={relocationOpen} name="relocationOpen" type="checkbox" />
                          <span>Open to relocation</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="settings-job-targets-pair">
                  <div className="settings-job-targets-stack-sm">
                    <FieldLabelRow labelClassName="settings-job-targets-eyebrow" reviewState={adjacentRolesReviewState}>
                      Also consider
                    </FieldLabelRow>
                    <div className="settings-job-targets-stack-sm-content">
                      <TagInput
                        hideLabel
                        label="Also consider"
                        onChange={setAdjacentRoleTags}
                        placeholder="e.g. Art director"
                        reviewState={adjacentRolesReviewState}
                        tags={adjacentRoleTags}
                      />
                    </div>
                  </div>
                  <div
                    aria-hidden="true"
                    className="settings-job-targets-stack-sm settings-job-targets-stack-sm--spacer"
                  >
                    <span className="field-label-row">
                      <span className="settings-job-targets-eyebrow">&nbsp;</span>
                    </span>
                    <div className="settings-job-targets-stack-sm-content" />
                  </div>
                </div>

                <div className="settings-matching-controls">
                  <div className="settings-matching-controls-heading">
                    <FieldLabelRow labelClassName="settings-job-targets-eyebrow">
                      Matching controls
                    </FieldLabelRow>
                    <small>Slightly tune how this workspace surfaces roles, markets, and source types.</small>
                  </div>

                  <div className="settings-matching-controls-grid">
                    <div className="settings-job-targets-stack-sm">
                      <FieldLabelRow labelClassName="settings-job-targets-eyebrow">Role breadth</FieldLabelRow>
                      <div className="settings-job-targets-stack-sm-content">
                        <SingleSelectChipGroup
                          hideLabel
                          label="Role breadth"
                          onChange={(value) =>
                            setMatchingRoleBreadth(value as MatchingRoleBreadth)
                          }
                          options={matchingRoleBreadthOptions}
                          value={matchingRoleBreadth}
                        />
                      </div>
                    </div>

                    <div className="settings-job-targets-stack-sm">
                      <FieldLabelRow labelClassName="settings-job-targets-eyebrow">Market strictness</FieldLabelRow>
                      <div className="settings-job-targets-stack-sm-content">
                        <SingleSelectChipGroup
                          hideLabel
                          label="Market strictness"
                          onChange={(value) =>
                            setMatchingMarketStrictness(value as MatchingMarketStrictness)
                          }
                          options={matchingMarketStrictnessOptions}
                          value={matchingMarketStrictness}
                        />
                      </div>
                    </div>

                    <div className="settings-job-targets-stack-sm">
                      <FieldLabelRow labelClassName="settings-job-targets-eyebrow">Source mix</FieldLabelRow>
                      <div className="settings-job-targets-stack-sm-content">
                        <SingleSelectChipGroup
                          hideLabel
                          label="Source mix"
                          onChange={(value) => setMatchingSourceMix(value as MatchingSourceMix)}
                          options={matchingSourceMixOptions}
                          value={matchingSourceMix}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </details>
      </SectionLockFrame>
    </section>
  )
}
