'use client'

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type ProfileSaveMessageRootContextValue = {
  root: HTMLDivElement | null
  register: (el: HTMLDivElement | null) => void
}

const ProfileSaveMessageRootContext = createContext<ProfileSaveMessageRootContextValue | null>(
  null,
)

export function ProfileSaveMessageRootProvider({ children }: { children: ReactNode }) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null)
  const register = useCallback((el: HTMLDivElement | null) => {
    setRoot(el)
  }, [])

  const value = useMemo(() => ({ root, register }), [root, register])

  return (
    <ProfileSaveMessageRootContext.Provider value={value}>
      {children}
    </ProfileSaveMessageRootContext.Provider>
  )
}

export function useProfileSaveMessageRoot() {
  return useContext(ProfileSaveMessageRootContext)?.root ?? null
}

export function ProfileSaveMessageSlot() {
  const register = useContext(ProfileSaveMessageRootContext)?.register
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!register) {
      return
    }
    register(ref.current)
    return () => register(null)
  }, [register])

  return <div className="profile-rail-message-host" id="profile-save-message-root" ref={ref} />
}
