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
  requestSaveButtonFlash: () => void
  reviewIndicatorsVisible: boolean
  saveButtonFlashToken: number
  setApplicationTitleTags: Dispatch<SetStateAction<string[]>>
  setReviewIndicatorsVisible: (value: boolean) => void
}

const ProfileSaveMessageRootContext = createContext<ProfileSaveMessageRootContextValue | null>(
  null,
)
const noop = () => undefined
const noopSetTags: Dispatch<SetStateAction<string[]>> = () => undefined
const noopSetVisible: (value: boolean) => void = noop

export function ProfileSaveMessageRootProvider({
  children,
  initialApplicationTitleTags = [],
}: {
  children: ReactNode
  initialApplicationTitleTags?: string[]
}) {
  const [applicationTitleTags, setApplicationTitleTags] = useState(initialApplicationTitleTags)
  const [reviewIndicatorsVisible, setReviewIndicatorsVisible] = useState(false)
  const [saveButtonFlashToken, setSaveButtonFlashToken] = useState(0)
  const requestSaveButtonFlash = useCallback(() => {
    setSaveButtonFlashToken((current) => current + 1)
  }, [])

  const value = useMemo(
    () => ({
      applicationTitleTags,
      requestSaveButtonFlash,
      reviewIndicatorsVisible,
      saveButtonFlashToken,
      setApplicationTitleTags,
      setReviewIndicatorsVisible,
    }),
    [
      applicationTitleTags,
      requestSaveButtonFlash,
      reviewIndicatorsVisible,
      saveButtonFlashToken,
      setApplicationTitleTags,
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
    requestSaveButtonFlash: context?.requestSaveButtonFlash ?? noop,
    saveButtonFlashToken: context?.saveButtonFlashToken ?? 0,
  }
}

export function useProfileApplicationTitles() {
  const context = useContext(ProfileSaveMessageRootContext)

  return {
    applicationTitleTags: context?.applicationTitleTags ?? [],
    setApplicationTitleTags: context?.setApplicationTitleTags ?? noopSetTags,
  }
}
