'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'

type ProfileSaveMessageRootContextValue = {
  applicationTitleTags: string[]
  hasUnsavedChanges: boolean
  isSavePending: boolean
  requestSaveButtonFlash: () => void
  reviewIndicatorsVisible: boolean
  saveButtonFlashToken: number
  setApplicationTitleTags: Dispatch<SetStateAction<string[]>>
  setHasUnsavedChanges: (value: boolean) => void
  setIsSavePending: (value: boolean) => void
  setReviewIndicatorsVisible: (value: boolean) => void
}

const ProfileSaveMessageRootContext = createContext<ProfileSaveMessageRootContextValue | null>(
  null,
)
const noop = () => undefined
const noopSetTags: Dispatch<SetStateAction<string[]>> = () => undefined
const noopSetDirty: (value: boolean) => void = noop
const noopSetVisible: (value: boolean) => void = noop
const noopSetPending: (value: boolean) => void = noop

export function ProfileSaveMessageRootProvider({
  children,
  initialApplicationTitleTags = [],
}: {
  children: ReactNode
  initialApplicationTitleTags?: string[]
}) {
  const [applicationTitleTags, setApplicationTitleTags] = useState(initialApplicationTitleTags)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [reviewIndicatorsVisible, setReviewIndicatorsVisible] = useState(false)
  const [saveButtonFlashToken, setSaveButtonFlashToken] = useState(0)
  // isSavePending mirrors the save action's in-flight state so the Save Profile
  // button (rendered in a separate subtree via ProfileSettingsRail) can show
  // "Saving…" while the server action runs. The ProfileForm pushes this value
  // whenever `useActionState`'s `isPending` flips for a non-generate intent.
  const [isSavePending, setIsSavePending] = useState(false)
  const requestSaveButtonFlash = useCallback(() => {
    setSaveButtonFlashToken((current) => current + 1)
  }, [])

  const value = useMemo(
    () => ({
      applicationTitleTags,
      hasUnsavedChanges,
      isSavePending,
      requestSaveButtonFlash,
      reviewIndicatorsVisible,
      saveButtonFlashToken,
      setApplicationTitleTags,
      setHasUnsavedChanges,
      setIsSavePending,
      setReviewIndicatorsVisible,
    }),
    [
      applicationTitleTags,
      hasUnsavedChanges,
      isSavePending,
      requestSaveButtonFlash,
      reviewIndicatorsVisible,
      saveButtonFlashToken,
      setApplicationTitleTags,
      setHasUnsavedChanges,
      setReviewIndicatorsVisible,
    ],
  )

  return (
    <ProfileSaveMessageRootContext.Provider value={value}>
      {children}
    </ProfileSaveMessageRootContext.Provider>
  )
}

export function useProfileReviewIndicators() {
  const context = useContext(ProfileSaveMessageRootContext)

  return {
    reviewIndicatorsVisible: context?.reviewIndicatorsVisible ?? true,
    setReviewIndicatorsVisible: context?.setReviewIndicatorsVisible ?? noopSetVisible,
  }
}

export function useProfileSaveButtonAttention() {
  const context = useContext(ProfileSaveMessageRootContext)

  return {
    hasUnsavedChanges: context?.hasUnsavedChanges ?? false,
    isSavePending: context?.isSavePending ?? false,
    requestSaveButtonFlash: context?.requestSaveButtonFlash ?? noop,
    saveButtonFlashToken: context?.saveButtonFlashToken ?? 0,
    setHasUnsavedChanges: context?.setHasUnsavedChanges ?? noopSetDirty,
    setIsSavePending: context?.setIsSavePending ?? noopSetPending,
  }
}

export function useProfileApplicationTitles() {
  const context = useContext(ProfileSaveMessageRootContext)

  return {
    applicationTitleTags: context?.applicationTitleTags ?? [],
    setApplicationTitleTags: context?.setApplicationTitleTags ?? noopSetTags,
  }
}
