'use client'

import type { Dispatch, SetStateAction } from 'react'

import { DisclosureSection, SectionLockFrame } from '@/components/profile/profile-form-controls'
import { TagInput } from '@/components/ui/tag-input'
import {
  INDUSTRY_SUGGESTIONS,
  REGION_SUGGESTIONS,
  TIMEZONE_SUGGESTIONS,
} from '@/lib/profile/autocomplete-options'

interface AdvancedFiltersSectionProps {
  lockedMessage?: string | null
  timezoneTags: string[]
  setTimezoneTags: Dispatch<SetStateAction<string[]>>
  allowedRemoteRegionTags: string[]
  setAllowedRemoteRegionTags: Dispatch<SetStateAction<string[]>>
  industriesPreferredTags: string[]
  setIndustriesPreferredTags: Dispatch<SetStateAction<string[]>>
}

export function AdvancedFiltersSection({
  lockedMessage,
  timezoneTags,
  setTimezoneTags,
  allowedRemoteRegionTags,
  setAllowedRemoteRegionTags,
  industriesPreferredTags,
  setIndustriesPreferredTags,
}: AdvancedFiltersSectionProps) {
  return (
    <DisclosureSection label="Advanced filters" title="Add constraints only if they help.">
      <SectionLockFrame lockedMessage={lockedMessage}>
        <div className="settings-advanced-tags-row">
          <TagInput
            label="Timezone"
            onChange={setTimezoneTags}
            placeholder="e.g. America/Toronto"
            preserveCase
            suggestions={TIMEZONE_SUGGESTIONS}
            tags={timezoneTags}
          />
          <TagInput
            label="Allowed remote regions"
            onChange={setAllowedRemoteRegionTags}
            placeholder="e.g. Canada"
            preserveCase
            suggestions={REGION_SUGGESTIONS}
            tags={allowedRemoteRegionTags}
          />
          <TagInput
            label="Preferred industries"
            onChange={setIndustriesPreferredTags}
            placeholder="e.g. Fintech"
            preserveCase
            suggestions={INDUSTRY_SUGGESTIONS}
            tags={industriesPreferredTags}
          />
        </div>
      </SectionLockFrame>
    </DisclosureSection>
  )
}
