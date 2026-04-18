'use client'

import { useProfileSaveButtonAttention } from '@/components/profile/profile-save-message-root'

export function ProfileSaveButton({ formId }: { formId: string }) {
  const { hasUnsavedChanges, isSavePending, saveButtonFlashToken } = useProfileSaveButtonAttention()
  const flashClassName =
    saveButtonFlashToken === 0
      ? ''
      : saveButtonFlashToken % 2 === 0
        ? ' is-attention-flash-b'
        : ' is-attention-flash-a'

  // While the save action is in flight, swap the label to "Saving…" and force
  // disabled so the user can't double-submit and immediately sees the click
  // registered. Disabled also engages the .button-primary:disabled treatment
  // so the button goes visually grey — matches the user's ask for "button
  // should immediately turn to grey" on click.
  const label = isSavePending ? 'Saving…' : 'Save Profile'
  const disabled = isSavePending || !hasUnsavedChanges

  return (
    <button
      className={`button button-primary settings-save-button${flashClassName}`}
      disabled={disabled}
      form={formId}
      type="submit"
    >
      {label}
    </button>
  )
}
