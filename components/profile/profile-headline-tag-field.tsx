'use client'

import { TagInput } from '@/components/ui/tag-input'
import { useProfileApplicationTitles } from '@/components/profile/profile-save-message-root'
import { joinHeadlineTags } from '@/lib/profile/headline-tags'
import { getReviewStateFromList } from '@/lib/profile/master-assets'

interface ProfileHeadlineTagFieldProps {
  formId: string
}

export function ProfileHeadlineTagField({ formId }: ProfileHeadlineTagFieldProps) {
  const { applicationTitleTags, setApplicationTitleTags } = useProfileApplicationTitles()
  const reviewState = getReviewStateFromList(applicationTitleTags)
  const joined = joinHeadlineTags(applicationTitleTags)

  return (
    <div className="profile-fields-headline-tags">
      <TagInput
        label="Titles used on applications"
        onChange={setApplicationTitleTags}
        placeholder="e.g. Creative Director"
        preserveCase
        reviewState={reviewState}
        tags={applicationTitleTags}
      />
      <input form={formId} name="headline" onChange={() => {}} required type="hidden" value={joined} />
    </div>
  )
}
