import { clearActiveOperatorSelection } from '@/app/operators/actions'
import { WorkspaceRailShell } from '@/components/navigation/workspace-rail-shell'
import { ProfileHeadlineTagField } from '@/components/profile/profile-headline-tag-field'
import { ProfilePublicLinks } from '@/components/profile/profile-public-links'
import { ProfileSaveButton } from '@/components/profile/profile-save-button'
import { FieldLabelRow } from '@/components/ui/field-label-row'
import { OverlayOptionField } from '@/components/ui/overlay-option-field'
import { TodayBlockHeading } from '@/components/ui/today-block-heading'
import type { OperatorWorkspaceRecord } from '@/lib/domain/types'
import { LOCATION_SUGGESTIONS } from '@/lib/profile/autocomplete-options'
import { getReviewStateFromText } from '@/lib/profile/master-assets'

interface ProfileSettingsRailProps {
  formId: string
  workspace: OperatorWorkspaceRecord
}

function formatRailUpdatedAt(value: string | undefined, timeZone: string) {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  const formatParts = (resolvedTimeZone?: string) => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
        minute: '2-digit',
        month: 'short',
        timeZone: resolvedTimeZone,
        year: 'numeric',
      }).formatToParts(date)
    } catch {
      return null
    }
  }

  const parts = formatParts(timeZone) ?? formatParts('America/Toronto') ?? formatParts(undefined)

  if (!parts) {
    return null
  }

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  const year = get('year')
  const month = get('month')
  const day = get('day')
  const hour = get('hour')
  const minute = get('minute')

  if (!year || !month || !day || !hour || !minute) {
    return null
  }

  return `${year}-${month}-${day} ${hour}:${minute}`
}

export function ProfileSettingsRail({ formId, workspace }: ProfileSettingsRailProps) {
  const locationReviewState = getReviewStateFromText(workspace.profile.locationLabel)
  const updatedAtLabel = formatRailUpdatedAt(
    workspace.profile.updatedAt,
    workspace.profile.timezone || 'America/Toronto',
  )
  const identityPreview =
    workspace.profile.displayName.trim() || workspace.profile.email.trim() || 'Profile info'

  return (
    <WorkspaceRailShell
      ariaLabel="Profile setup"
      className="today-rail settings-profile-rail"
      collapseAction={<ProfileSaveButton formId={formId} />}
      collapsedLabel="Identity"
      collapsedPreview={identityPreview}
      footer={
        <div className="settings-profile-rail-footer">
          <section className="today-block settings-rail-actions-block">
            <div className="settings-rail-heading-with-status">
              <TodayBlockHeading
                className="settings-rail-actions-heading"
                label="Actions"
                title="Account"
              />
              {updatedAtLabel ? (
                <p className="settings-rail-updated-at">
                  <span className="settings-rail-updated-at-label">Last updated</span>
                  <span className="settings-rail-updated-at-value">{updatedAtLabel}</span>
                </p>
              ) : null}
            </div>

            <div className="settings-rail-actions">
              <ProfileSaveButton formId={formId} />

              <form action={clearActiveOperatorSelection}>
                <button className="button button-secondary" type="submit">
                  Log out
                </button>
              </form>
            </div>
          </section>
        </div>
      }
      scrollClassName="settings-profile-rail-scroll"
    >
        <section className="today-block">
          <div className="settings-profile-rail-heading-stack">
            <TodayBlockHeading label="About you" title="Identity" />
            <p className="profile-note column-reading-copy">
              This is the information the workspace uses in applications, packet drafts, and saved materials.
            </p>
          </div>

          <div className="profile-fields">
            <label className="field">
              <span>Name used on applications</span>
              <input
                defaultValue={workspace.profile.displayName}
                form={formId}
                name="displayName"
                placeholder="Ocean Cheung"
                type="text"
              />
            </label>
            <label className="field">
              <span>Email</span>
              <input defaultValue={workspace.profile.email} disabled readOnly type="email" />
            </label>
            <label className="field">
              <span>Phone number</span>
              <input
                defaultValue={workspace.profile.phoneNumber}
                form={formId}
                name="phoneNumber"
                placeholder="(647) 807-4263"
                type="tel"
              />
            </label>
            <label className={`field field--${locationReviewState}`}>
              <FieldLabelRow reviewState={locationReviewState}>Current location</FieldLabelRow>
              <OverlayOptionField
                ariaLabel="Current location"
                defaultValue={workspace.profile.locationLabel}
                form={formId}
                name="locationLabel"
                openBehavior="type"
                options={LOCATION_SUGGESTIONS.map((suggestion) => ({
                  label: suggestion,
                  value: suggestion,
                }))}
                placeholder="Start typing a city or country"
                triggerVariant="underline-search"
              />
            </label>
            <ProfileHeadlineTagField formId={formId} />
          </div>
        </section>

        <section className="today-block">
          <TodayBlockHeading label="Links" title="Public links" />

          <ProfilePublicLinks
            formId={formId}
            initialPortfolioUrl={workspace.profile.portfolioPrimaryUrl}
            initialPersonalSiteUrl={workspace.profile.personalSiteUrl}
            initialLinkedinUrl={workspace.profile.linkedinUrl}
          />
        </section>
    </WorkspaceRailShell>
  )
}
