'use client'

import { useActionState, useEffect, useState } from 'react'

import {
  refreshProfileSourceAction,
  type ProfileActionState,
} from '@/app/profile/actions'
import {
  FieldSourceActions,
  type FieldSourceFetchStatus,
} from '@/components/profile/field-source-actions'

interface ProfilePublicLinksProps {
  formId: string
  /** Value persisted to user_profiles.portfolio_primary_url */
  initialPortfolioUrl: string
  /** Value persisted to user_profiles.personal_site_url */
  initialPersonalSiteUrl: string
  /** Value persisted to user_profiles.linkedin_url — kept on the profile as reference
   *  only; no scraping or enrichment runs against LinkedIn. */
  initialLinkedinUrl: string
}

const REFRESH_INITIAL_STATE: ProfileActionState = { message: '', status: 'idle' }

interface SourceState {
  /** The currently-saved URL. */
  savedUrl: string
  /** When true, the input is shown editable even if savedUrl is non-empty (user clicked the
   *  pencil to change the URL). Re-submitting the main profile form locks it again. */
  isEditing: boolean
  /** Local fetch status for the refresh icon — mirrors the action's status so the
   *  FieldSourceActions spin indicator + tooltip stay in sync. */
  status: FieldSourceFetchStatus
  /** Most recent action message for this source; surfaced via the refresh tooltip when in
   *  the 'error' state. */
  message: string
}

function deriveStatus(source: SourceState, actionState: ProfileActionState, isPending: boolean): FieldSourceFetchStatus {
  if (isPending) return 'fetching'
  if (actionState.status === 'error') return 'error'
  if (actionState.status === 'success') return 'refreshed'
  return source.status
}

export function ProfilePublicLinks({
  formId,
  initialPortfolioUrl,
  initialPersonalSiteUrl,
  initialLinkedinUrl,
}: ProfilePublicLinksProps) {
  const [portfolioState, setPortfolioState] = useState<SourceState>({
    savedUrl: initialPortfolioUrl,
    isEditing: !initialPortfolioUrl,
    status: 'idle',
    message: '',
  })
  const [personalSiteState, setPersonalSiteState] = useState<SourceState>({
    savedUrl: initialPersonalSiteUrl,
    isEditing: !initialPersonalSiteUrl,
    status: 'idle',
    message: '',
  })

  // Separate action state per source so clicks on one button don't mis-fire status on the other.
  const [portfolioActionState, portfolioFormAction, portfolioPending] = useActionState(
    refreshProfileSourceAction,
    REFRESH_INITIAL_STATE,
  )
  const [personalSiteActionState, personalSiteFormAction, personalSitePending] = useActionState(
    refreshProfileSourceAction,
    REFRESH_INITIAL_STATE,
  )

  // When the action returns success, clear the 'refreshed' tooltip back to 'idle' after 3s
  // so the next interaction reads cleanly. Errors persist until the user clicks again.
  useEffect(() => {
    if (portfolioActionState.status !== 'success') return
    const timer = window.setTimeout(() => {
      setPortfolioState((current) => ({ ...current, status: 'idle', message: '' }))
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [portfolioActionState])

  useEffect(() => {
    if (personalSiteActionState.status !== 'success') return
    const timer = window.setTimeout(() => {
      setPersonalSiteState((current) => ({ ...current, status: 'idle', message: '' }))
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [personalSiteActionState])

  const portfolioStatus = deriveStatus(portfolioState, portfolioActionState, portfolioPending)
  const personalSiteStatus = deriveStatus(personalSiteState, personalSiteActionState, personalSitePending)

  const portfolioLocked = Boolean(portfolioState.savedUrl) && !portfolioState.isEditing
  const personalSiteLocked = Boolean(personalSiteState.savedUrl) && !personalSiteState.isEditing

  return (
    <div className="profile-fields">
      <label className="field">
        <span>Main portfolio link</span>
        <form action={portfolioFormAction} hidden>
          <input type="hidden" name="sourceKind" value="portfolio_url" />
        </form>
        <FieldSourceActions
          locked={portfolioLocked}
          status={portfolioStatus}
          sourceLabel="portfolio"
          errorMessage={portfolioActionState.status === 'error' ? portfolioActionState.message : undefined}
          onRefresh={() => {
            const formData = new FormData()
            formData.set('sourceKind', 'portfolio_url')
            portfolioFormAction(formData)
          }}
          onEdit={() => setPortfolioState((current) => ({ ...current, isEditing: true }))}
        >
          <input
            defaultValue={portfolioState.savedUrl}
            disabled={portfolioLocked}
            form={formId}
            name="portfolioPrimaryUrl"
            placeholder="https://portfolio.site/project"
            readOnly={portfolioLocked}
            type="url"
          />
        </FieldSourceActions>
      </label>
      <label className="field">
        <span>Personal website</span>
        <FieldSourceActions
          locked={personalSiteLocked}
          status={personalSiteStatus}
          sourceLabel="personal website"
          errorMessage={personalSiteActionState.status === 'error' ? personalSiteActionState.message : undefined}
          onRefresh={() => {
            const formData = new FormData()
            formData.set('sourceKind', 'personal_site')
            personalSiteFormAction(formData)
          }}
          onEdit={() => setPersonalSiteState((current) => ({ ...current, isEditing: true }))}
        >
          <input
            defaultValue={personalSiteState.savedUrl}
            disabled={personalSiteLocked}
            form={formId}
            name="personalSiteUrl"
            placeholder="https://your-site.com"
            readOnly={personalSiteLocked}
            type="url"
          />
        </FieldSourceActions>
      </label>
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
