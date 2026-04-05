'use client'

import type { Dispatch, SetStateAction } from 'react'

import type { CoverLetterProofBankEntryRecord } from '@/lib/domain/types'

import {
  AddRowButton,
  DisclosureSection,
  SectionLockFrame,
  SettingsTabButton,
} from '@/components/profile/profile-form-controls'
import { AutoSizeTextarea } from '@/components/ui/auto-size-textarea'
import { BulletTextarea } from '@/components/ui/bullet-textarea'
import { FieldLabelRow } from '@/components/ui/field-label-row'
import { TagInput } from '@/components/ui/tag-input'
import type { ReviewState } from '@/lib/profile/master-assets'

export type CoverLetterStrategyTab = 'positioning' | 'proofBank' | 'voice'

interface CoverLetterStrategySectionProps {
  activeTab: CoverLetterStrategyTab | null
  capabilityDisciplineTags: string[]
  capabilityToolsTags: string[]
  createProofBankEntry: () => CoverLetterProofBankEntryRecord
  keyDifferentiatorTags: string[]
  lockedMessage?: string | null
  positioningPhilosophy: string
  positioningReviewState: ReviewState
  proofBankEntries: CoverLetterProofBankEntryRecord[]
  proofBankReviewState: ReviewState
  setActiveTab: Dispatch<SetStateAction<CoverLetterStrategyTab | null>>
  setCapabilityDisciplineTags: Dispatch<SetStateAction<string[]>>
  setCapabilityToolsTags: Dispatch<SetStateAction<string[]>>
  setKeyDifferentiatorTags: Dispatch<SetStateAction<string[]>>
  setPositioningPhilosophy: Dispatch<SetStateAction<string>>
  setProofBankEntries: Dispatch<SetStateAction<CoverLetterProofBankEntryRecord[]>>
  setToneVoiceTags: Dispatch<SetStateAction<string[]>>
  toneVoiceTags: string[]
  voiceReviewState: ReviewState
}

export function CoverLetterStrategySection({
  activeTab,
  capabilityDisciplineTags,
  capabilityToolsTags,
  createProofBankEntry,
  keyDifferentiatorTags,
  lockedMessage,
  positioningPhilosophy,
  positioningReviewState,
  proofBankEntries,
  proofBankReviewState,
  setActiveTab,
  setCapabilityDisciplineTags,
  setCapabilityToolsTags,
  setKeyDifferentiatorTags,
  setPositioningPhilosophy,
  setProofBankEntries,
  setToneVoiceTags,
  toneVoiceTags,
  voiceReviewState,
}: CoverLetterStrategySectionProps) {
  return (
    <DisclosureSection
      className="disclosure-cover-letter"
      label="Cover letter strategy"
      title="Review and refine the material used in tailored cover letters."
      unwrapBody
    >
      <SectionLockFrame lockedMessage={lockedMessage}>
        <div className={`settings-tab-shell${activeTab ? ' has-selection' : ''}`}>
          <div aria-label="Cover-letter sections" className="settings-tab-toolbar" role="tablist">
            <SettingsTabButton
              active={activeTab === 'positioning'}
              label="Positioning"
              onClick={() =>
                setActiveTab((current) => (current === 'positioning' ? null : 'positioning'))
              }
              reviewState={positioningReviewState}
            />
            <SettingsTabButton
              active={activeTab === 'proofBank'}
              label="Proof points"
              onClick={() =>
                setActiveTab((current) => (current === 'proofBank' ? null : 'proofBank'))
              }
              reviewState={proofBankReviewState}
            />
            <SettingsTabButton
              active={activeTab === 'voice'}
              label="Voice"
              onClick={() => setActiveTab((current) => (current === 'voice' ? null : 'voice'))}
              reviewState={voiceReviewState}
            />
          </div>

          {activeTab === 'positioning' ? (
            <section className="settings-tab-panel">
              <div className="settings-tab-panel-header">
                <div>
                  <p className="panel-label">Positioning</p>
                  <h3>Role target, positioning, and capabilities</h3>
                </div>
              </div>
              <label className={`field settings-field-autosize field--${positioningReviewState}`}>
                <FieldLabelRow reviewState={positioningReviewState}>
                  Positioning / design philosophy
                </FieldLabelRow>
                <AutoSizeTextarea
                  name="coverLetterPositioningPhilosophy"
                  onChange={(event) => setPositioningPhilosophy(event.target.value)}
                  value={positioningPhilosophy}
                />
                <small>Keep this reusable. It should explain how you frame your work across roles.</small>
              </label>
              <div className="settings-tag-row field-grid field-grid-2">
                <TagInput
                  label="Disciplines"
                  onChange={setCapabilityDisciplineTags}
                  placeholder="e.g. Brand identity"
                  preserveCase
                  reviewState={positioningReviewState}
                  tags={capabilityDisciplineTags}
                  variant="square"
                />
                <TagInput
                  label="Production / tools / execution strengths"
                  onChange={setCapabilityToolsTags}
                  placeholder="e.g. Executive storytelling"
                  preserveCase
                  reviewState={positioningReviewState}
                  tags={capabilityToolsTags}
                  variant="square"
                />
              </div>
            </section>
          ) : null}

          {activeTab === 'proofBank' ? (
            <section className="settings-tab-panel">
              <div className="settings-tab-panel-header">
                <div>
                  <p className="panel-label">Proof points</p>
                  <h3>Reusable evidence for strong tailored letters</h3>
                </div>
              </div>
              <div className="section-header">
                <AddRowButton
                  label="Add proof point"
                  onClick={() => {
                    setProofBankEntries((current) => [...current, createProofBankEntry()])
                  }}
                />
              </div>
              <div className="repeat-list">
                {proofBankEntries.map((entry, index) => (
                  <article className="repeat-card" key={`${entry.label}-${index}`}>
                    <div className="repeat-card-header">
                      <strong>Proof point {index + 1}</strong>
                      {proofBankEntries.length > 1 ? (
                        <button
                          className="button button-ghost button-small"
                          onClick={() => {
                            setProofBankEntries((current) =>
                              current.filter((_, itemIndex) => itemIndex !== index),
                            )
                          }}
                          type="button"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <div className="repeat-card-proof-grid">
                      <div className="repeat-card-proof-stack">
                        <label className={`field field--${proofBankReviewState} field--fixed-scroll`}>
                          <span>Label</span>
                          <textarea
                            name="coverLetterProofLabel"
                            onChange={(event) => {
                              const label = event.target.value.replace(/\r?\n/g, '')
                              setProofBankEntries((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, label } : item,
                                ),
                              )
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                              }
                            }}
                            rows={1}
                            value={entry.label}
                          />
                        </label>
                        <label
                          className={`field settings-field-autosize field--${proofBankReviewState}`}
                        >
                          <span>Context</span>
                          <AutoSizeTextarea
                            name="coverLetterProofContext"
                            onChange={(event) => {
                              setProofBankEntries((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, context: event.target.value } : item,
                                ),
                              )
                            }}
                            value={entry.context}
                          />
                        </label>
                      </div>
                      <label
                        className={`field repeat-card-proof-bullets field--${proofBankReviewState}`}
                      >
                        <span>Supporting points</span>
                        <BulletTextarea
                          className="proof-bank-bullets-textarea"
                          items={entry.bullets}
                          name="coverLetterProofBullets"
                          onItemsChange={(nextBullets) => {
                            setProofBankEntries((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, bullets: nextBullets }
                                  : item,
                              ),
                            )
                          }}
                          rows={5}
                        />
                      </label>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {activeTab === 'voice' ? (
            <section className="settings-tab-panel">
              <div className="settings-tab-panel-header">
                <div>
                  <p className="panel-label">Voice</p>
                  <h3>Tone and differentiators</h3>
                </div>
              </div>
              <div className="settings-tag-row field-grid field-grid-2">
                <TagInput
                  label="Tone and voice"
                  onChange={setToneVoiceTags}
                  placeholder="e.g. Clear and direct"
                  preserveCase
                  reviewState={voiceReviewState}
                  tags={toneVoiceTags}
                  variant="square"
                />
                <TagInput
                  label="Key differentiators"
                  onChange={setKeyDifferentiatorTags}
                  placeholder="e.g. Strong executive presentation work"
                  preserveCase
                  reviewState={voiceReviewState}
                  tags={keyDifferentiatorTags}
                  variant="square"
                />
              </div>
            </section>
          ) : null}

        </div>
      </SectionLockFrame>
    </DisclosureSection>
  )
}
