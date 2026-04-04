'use client'

import type { Dispatch, SetStateAction } from 'react'

import { DisclosureSection } from '@/components/profile/profile-form-controls'
import { TagInput } from '@/components/ui/tag-input'

interface AdvancedFiltersSectionProps {
  timezoneTags: string[]
  setTimezoneTags: Dispatch<SetStateAction<string[]>>
  allowedRemoteRegionTags: string[]
  setAllowedRemoteRegionTags: Dispatch<SetStateAction<string[]>>
  industriesPreferredTags: string[]
  setIndustriesPreferredTags: Dispatch<SetStateAction<string[]>>
}

export function AdvancedFiltersSection({
  timezoneTags,
  setTimezoneTags,
  allowedRemoteRegionTags,
  setAllowedRemoteRegionTags,
  industriesPreferredTags,
  setIndustriesPreferredTags,
}: AdvancedFiltersSectionProps) {
  return (
    <DisclosureSection label="Advanced filters" title="Add constraints only if they help.">
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
  )
}
