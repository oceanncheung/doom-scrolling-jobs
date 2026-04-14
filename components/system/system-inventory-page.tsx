'use client'

import { useEffect, useState } from 'react'

import {
  AddRowButton,
  SettingsTabButton,
} from '@/components/profile/profile-form-controls'
import { useProfileReviewIndicators } from '@/components/profile/profile-save-message-root'
import { FileUploadSlot } from '@/components/settings/file-upload-slot'
import { BulletTextarea } from '@/components/ui/bullet-textarea'
import { OverlayOptionField } from '@/components/ui/overlay-option-field'
import { StatusDot, StatusIndicator } from '@/components/ui/status-indicator'
import { TagInput } from '@/components/ui/tag-input'
import { TagToggleGroup } from '@/components/ui/tag-toggle-group'
import {
  INDUSTRY_SUGGESTIONS,
  LOCATION_SUGGESTIONS,
  REGION_SUGGESTIONS,
  TIMEZONE_SUGGESTIONS,
} from '@/lib/profile/autocomplete-options'
import { SALARY_CURRENCY_OPTIONS } from '@/lib/profile/salary-currency'
import { SENIORITY_LEVEL_OPTIONS } from '@/lib/profile/seniority-level'

type InventoryTab = 'fields' | 'inputs' | 'supporting'

export function SystemInventoryPage() {
  const { setReviewIndicatorsVisible } = useProfileReviewIndicators()
  const [activeTab, setActiveTab] = useState<InventoryTab>('fields')
  const [roleTags, setRoleTags] = useState(['Creative Director', 'Brand Strategy'])
  const [marketTags, setMarketTags] = useState(['Canada'])
  const [industryTags, setIndustryTags] = useState(['Consulting'])
  const [timezoneTags, setTimezoneTags] = useState(['America/Toronto'])
  const [toolTags, setToolTags] = useState(['Figma'])
  const [seniorityTags, setSeniorityTags] = useState(['director'])
  const [proofPoints, setProofPoints] = useState([
    'Built reusable story angles for portfolio-heavy applications.',
    'Maintained canonical source materials that stayed stable through packet generation.',
  ])
  const [resumeFileName, setResumeFileName] = useState<string | null>('Ocean_Cheung_Refined.pdf')
  const [coverLetterFileName, setCoverLetterFileName] = useState<string | null>(null)

  useEffect(() => {
    setReviewIndicatorsVisible(true)
  }, [setReviewIndicatorsVisible])

  return (
    <div className="system-inventory-main">
      <section className="panel system-inventory-panel">
        <div className="system-inventory-heading">
          <p className="panel-label">Phase B inventory</p>
          <h2>Shared field and interaction primitives</h2>
        </div>
        <p className="system-inventory-note">
          This page is internal only. It exercises the live shared primitives so we can tighten the
          UI system without changing the visual output on product routes. The source upload row and
          active disclosure/tab chips are protected contracts and should be validated here before
          they are touched elsewhere.
        </p>
      </section>

      <section className="panel system-inventory-panel">
        <div className="settings-tab-shell has-selection">
          <div className="settings-tab-toolbar-shell">
            <div className="settings-tab-toolbar-track">
              <div aria-label="Inventory views" className="settings-tab-toolbar" role="tablist">
                <SettingsTabButton
                  active={activeTab === 'fields'}
                  label="Underline fields"
                  onClick={() => setActiveTab('fields')}
                  reviewState="ready"
                />
                <SettingsTabButton
                  active={activeTab === 'inputs'}
                  label="Tag inputs"
                  onClick={() => setActiveTab('inputs')}
                  reviewState="review"
                />
                <SettingsTabButton
                  active={activeTab === 'supporting'}
                  label="Uploads and bullets"
                  onClick={() => setActiveTab('supporting')}
                  reviewState="ready"
                />
              </div>
            </div>
          </div>

          <section className="settings-tab-panel system-inventory-tab-panel">
            {activeTab === 'fields' ? (
              <div className="system-inventory-grid">
                <label className="field">
                  <span>Current location</span>
                  <OverlayOptionField
                    ariaLabel="Current location"
                    defaultValue="Toronto, Canada"
                    name="inventoryLocation"
                    openBehavior="type"
                    options={LOCATION_SUGGESTIONS.map((suggestion) => ({
                      label: suggestion,
                      value: suggestion,
                    }))}
                    placeholder="Start typing a city or country"
                    triggerVariant="underline-search"
                  />
                </label>
                <label className="field">
                  <span>Salary currency</span>
                  <OverlayOptionField
                    ariaLabel="Salary currency"
                    defaultValue="CAD"
                    name="inventoryCurrency"
                    openBehavior="click"
                    options={SALARY_CURRENCY_OPTIONS}
                    placeholder="Select currency"
                    triggerVariant="underline-button"
                  />
                </label>
              </div>
            ) : null}

            {activeTab === 'inputs' ? (
              <div className="system-inventory-grid">
                <div className="system-inventory-stack">
                  <TagInput
                    label="Prioritize these roles"
                    onChange={setRoleTags}
                    preserveCase
                    reviewState="ready"
                    tags={roleTags}
                  />
                  <TagInput
                    label="Hiring markets"
                    onChange={setMarketTags}
                    placeholder="e.g. Canada"
                    preserveCase
                    suggestions={REGION_SUGGESTIONS}
                    tags={marketTags}
                  />
                  <TagToggleGroup
                    label="Target seniority"
                    onChange={setSeniorityTags}
                    options={SENIORITY_LEVEL_OPTIONS.filter((option) => option.value.length > 0)}
                    reviewState="review"
                    values={seniorityTags}
                  />
                </div>
                <div className="system-inventory-stack">
                  <TagInput
                    label="Preferred industries"
                    onChange={setIndustryTags}
                    placeholder="e.g. Consulting"
                    preserveCase
                    reviewState="review"
                    suggestions={INDUSTRY_SUGGESTIONS}
                    tags={industryTags}
                  />
                  <TagInput
                    label="Timezone"
                    onChange={setTimezoneTags}
                    placeholder="e.g. America/Toronto"
                    preserveCase
                    suggestions={TIMEZONE_SUGGESTIONS}
                    tags={timezoneTags}
                  />
                  <TagInput
                    label="Tools and platforms"
                    onChange={setToolTags}
                    placeholder="Type and press Enter"
                    reviewState="ready"
                    tags={toolTags}
                  />
                </div>
              </div>
            ) : null}

            {activeTab === 'supporting' ? (
              <div className="system-inventory-grid">
                <div className="system-inventory-stack">
                  <div className="field">
                    <span>Source upload chips</span>
                    <div className="system-inventory-upload-row">
                      <FileUploadSlot
                        compactMaxLength={30}
                        fileName={resumeFileName}
                        label="Resume"
                        onRemove={() => setResumeFileName(null)}
                        onUpload={(file) => setResumeFileName(file.name)}
                        showUploadIcon
                      />
                      <FileUploadSlot
                        compactMaxLength={30}
                        fileName={coverLetterFileName}
                        label="Cover letter (optional)"
                        onRemove={() => setCoverLetterFileName(null)}
                        onUpload={(file) => setCoverLetterFileName(file.name)}
                        showUploadIcon
                      />
                    </div>
                  </div>
                  <div className="section-header">
                    <AddRowButton
                      label="Add proof point"
                      onClick={() =>
                        setProofPoints((current) => [...current, ''])
                      }
                    />
                  </div>
                  <div className="field">
                    <span>Status primitives</span>
                    <div className="system-inventory-status-row">
                      <StatusIndicator label="Ready" tone="ready" />
                      <StatusIndicator label="Pending" tone="attention" />
                      <StatusDot ariaLabel="Needs attention" tone="attention" />
                      <StatusDot ariaLabel="Ready" tone="ready" />
                    </div>
                  </div>
                </div>
                <label className="field">
                  <span>Proof points</span>
                  <BulletTextarea
                    items={proofPoints}
                    name="inventoryProofPoints"
                    onItemsChange={setProofPoints}
                    placeholder="Add a proof point"
                  />
                </label>
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </div>
  )
}
