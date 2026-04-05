'use client'

import { useEffect } from 'react'

import { getReviewStateFromText } from '@/lib/profile/master-assets'

function isAttentionState(state: string) {
  return state !== 'ready'
}

interface UseProfileNavigationGuardProps {
  hasGeneratedDraft: boolean
  historyReviewState: string
  requestSaveButtonFlash: () => void
  searchBriefReviewState: string
  setReviewIndicatorsVisible: (value: boolean) => void
  skillsToolsReviewState: string
  summaryReviewState: string
  targetRolesReviewState: string
}

export function useProfileNavigationGuard({
  hasGeneratedDraft,
  historyReviewState,
  requestSaveButtonFlash,
  searchBriefReviewState,
  setReviewIndicatorsVisible,
  skillsToolsReviewState,
  summaryReviewState,
  targetRolesReviewState,
}: UseProfileNavigationGuardProps) {
  useEffect(() => {
    function hasBlockingAttention() {
      if (!hasGeneratedDraft) {
        return false
      }

      const headlineInput = document.querySelector<HTMLInputElement>(
        'input[form="profile-workspace-form"][name="headline"]',
      )
      const locationInput = document.querySelector<HTMLInputElement | HTMLSelectElement>(
        'input[form="profile-workspace-form"][name="locationLabel"], select[form="profile-workspace-form"][name="locationLabel"]',
      )
      const headlineReviewState = getReviewStateFromText(headlineInput?.value ?? '')
      const locationReviewState = getReviewStateFromText(locationInput?.value ?? '')

      return [
        headlineReviewState,
        locationReviewState,
        searchBriefReviewState,
        targetRolesReviewState,
        skillsToolsReviewState,
        summaryReviewState,
        historyReviewState,
      ].some(isAttentionState)
    }

    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const target = event.target
      if (!(target instanceof Element)) {
        return
      }

      const link = target.closest('a[href]')
      if (!(link instanceof HTMLAnchorElement)) {
        return
      }

      if (link.target === '_blank' || link.hasAttribute('download')) {
        return
      }

      const href = link.getAttribute('href')
      if (!href || href.startsWith('#')) {
        return
      }

      const destination = new URL(link.href, window.location.href)
      const current = new URL(window.location.href)

      if (
        destination.origin !== current.origin ||
        (destination.pathname === current.pathname &&
          destination.search === current.search &&
          destination.hash === current.hash) ||
        !hasBlockingAttention()
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      setReviewIndicatorsVisible(true)
      requestSaveButtonFlash()
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasBlockingAttention()) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    }

    document.addEventListener('click', handleDocumentClick, true)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('click', handleDocumentClick, true)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [
    hasGeneratedDraft,
    historyReviewState,
    requestSaveButtonFlash,
    searchBriefReviewState,
    setReviewIndicatorsVisible,
    skillsToolsReviewState,
    summaryReviewState,
    targetRolesReviewState,
  ])
}
