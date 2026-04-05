'use client'

import { useProfileSaveButtonAttention } from '@/components/profile/profile-save-message-root'

export function ProfileSaveButton({ formId }: { formId: string }) {
  const { saveButtonFlashToken } = useProfileSaveButtonAttention()
  const flashClassName =
    saveButtonFlashToken === 0
      ? ''
      : saveButtonFlashToken % 2 === 0
        ? ' is-attention-flash-b'
        : ' is-attention-flash-a'

  return (
    <button
      className={`button button-primary settings-save-button${flashClassName}`}
      form={formId}
      type="submit"
    >
      Save settings
    </button>
  )
}
