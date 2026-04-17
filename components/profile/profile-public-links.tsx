'use client'

import { useActionState, useRef, useState } from 'react'

import {
  refreshProfileSourceAction,
  saveAndRefreshProfileSourceAction,
  type ProfileActionState,
} from '@/app/profile/actions'
import {
  FieldSourceActions,
  type FieldSourceFetchStatus,
} from '@/components/profile/field-source-actions'

interface ProfilePublicLinksProps {
  formId: string
  initialPortfolioUrl: string
  initialPersonalSiteUrl: string
  /** Kept on the profile as a reference link only — no scraping runs against LinkedIn. */
  initialLinkedinUrl: string
}

const INITIAL_ACTION_STATE: ProfileActionState = { message: '', status: 'idle' }

/**
 * Derive the FieldSourceActions display status from the two action states and pending flags.
 * Pending wins (either save-or-refresh in flight → spinning). Otherwise the most recent
 * non-idle result drives the display: error persists until the next action fires; success
 * reads as "refreshed" until the next action fires. Keeping derivation inline (not via
 * useEffect) avoids React 19's set-state-in-effect lint error and keeps the component a
 * straight render.
 */
function deriveStatus(
  saveAction: ProfileActionState,
  refreshAction: ProfileActionState,
  savePending: boolean,
  refreshPending: boolean,
): FieldSourceFetchStatus {
  if (savePending || refreshPending) return 'fetching'
  if (refreshAction.status === 'error' || saveAction.status === 'error') return 'error'
  if (refreshAction.status === 'success' || saveAction.status === 'success') return 'refreshed'
  return 'idle'
}

type SourceKind = 'portfolio_url' | 'personal_site'

interface SourceFieldProps {
  formId: string
  label: string
  name: 'portfolioPrimaryUrl' | 'personalSiteUrl'
  sourceKind: SourceKind
  sourceLabel: string
  placeholder: string
  initialUrl: string
}

function SourceField({
  formId,
  label,
  name,
  sourceKind,
  sourceLabel,
  placeholder,
  initialUrl,
}: SourceFieldProps) {
  // Intrinsic local state — the canonical URL for this field as the operator last entered
  // it, and whether the input is currently unlocked for editing. The post-action derived
  // state (status/message) is computed inline below rather than mirrored via useEffect.
  const [savedUrl, setSavedUrl] = useState<string>(initialUrl)
  const [isEditing, setIsEditing] = useState<boolean>(!initialUrl)

  // Two separate actions: one triggered when the user types and hits Enter ("save + pull"),
  // one triggered by the refresh icon on an already-saved URL ("re-pull"). The refresh
  // path is zero-arg (the URL is already stored); the save+pull path submits the URL.
  const [saveActionState, saveFormAction, savePending] = useActionState(
    saveAndRefreshProfileSourceAction,
    INITIAL_ACTION_STATE,
  )
  const [refreshActionState, refreshFormAction, refreshPending] = useActionState(
    refreshProfileSourceAction,
    INITIAL_ACTION_STATE,
  )

  const status = deriveStatus(saveActionState, refreshActionState, savePending, refreshPending)
  const locked = Boolean(savedUrl) && !isEditing && !savePending
  const errorMessage =
    status === 'error'
      ? refreshActionState.message || saveActionState.message || undefined
      : undefined

  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <label className="field">
      <span>{label}</span>
      <FieldSourceActions
        locked={locked}
        status={status}
        sourceLabel={sourceLabel}
        errorMessage={errorMessage}
        onRefresh={() => {
          const formData = new FormData()
          formData.set('sourceKind', sourceKind)
          refreshFormAction(formData)
        }}
        onEdit={() => {
          setIsEditing(true)
          requestAnimationFrame(() => inputRef.current?.focus())
        }}
      >
        <input
          defaultValue={savedUrl}
          disabled={locked}
          form={formId}
          name={name}
          placeholder={placeholder}
          readOnly={locked}
          ref={inputRef}
          type="url"
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || locked) return
            event.preventDefault()
            const value = event.currentTarget.value.trim()
            // Lock the field optimistically so the refresh icon appears and starts
            // spinning immediately. If the action fails, derived status will read
            // 'error' and the tooltip will surface the cause — the field stays locked
            // with the attempted URL until the operator clicks edit.
            setSavedUrl(value)
            setIsEditing(false)
            const formData = new FormData()
            formData.set('sourceKind', sourceKind)
            formData.set('url', value)
            saveFormAction(formData)
          }}
        />
      </FieldSourceActions>
    </label>
  )
}

export function ProfilePublicLinks({
  formId,
  initialPortfolioUrl,
  initialPersonalSiteUrl,
  initialLinkedinUrl,
}: ProfilePublicLinksProps) {
  return (
    <div className="profile-fields">
      <SourceField
        formId={formId}
        initialUrl={initialPortfolioUrl}
        label="Main portfolio link"
        name="portfolioPrimaryUrl"
        placeholder="https://portfolio.site/project"
        sourceKind="portfolio_url"
        sourceLabel="portfolio"
      />
      <SourceField
        formId={formId}
        initialUrl={initialPersonalSiteUrl}
        label="Personal website"
        name="personalSiteUrl"
        placeholder="https://your-site.com"
        sourceKind="personal_site"
        sourceLabel="personal website"
      />
      <label className="field">
        <span>LinkedIn profile</span>
        <input
          defaultValue={initialLinkedinUrl}
          form={formId}
          name="linkedinUrl"
          placeholder="https://linkedin.com/in/your-name"
          type="url"
        />
      </label>
    </div>
  )
}
