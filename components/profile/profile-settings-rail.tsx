import { clearActiveOperatorSelection } from '@/app/operators/actions'
import { ProfileSaveMessageSlot } from '@/components/profile/profile-save-message-root'
import type { OperatorWorkspaceRecord } from '@/lib/domain/types'

interface ProfileSettingsRailProps {
  formId: string
  workspace: OperatorWorkspaceRecord
}

export function ProfileSettingsRail({ formId, workspace }: ProfileSettingsRailProps) {
  return (
    <aside aria-label="Profile setup" className="today-rail settings-profile-rail">
      <div className="settings-profile-rail-scroll">
        <section className="today-block">
          <div className="settings-profile-rail-heading-stack">
            <div className="today-block-heading">
              <p className="panel-label">About you</p>
              <h2>Identity</h2>
            </div>
            <p className="profile-note">
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
              <span>Current location</span>
              <input
                defaultValue={workspace.profile.locationLabel}
                form={formId}
                name="locationLabel"
                placeholder="Toronto, Canada"
                type="text"
              />
            </label>
            <label className="field">
              <span>Title used on applications</span>
              <input
                defaultValue={workspace.profile.headline}
                form={formId}
                name="headline"
                placeholder="Senior Graphic Designer"
                required
                type="text"
              />
            </label>
          </div>
        </section>

        <section className="today-block">
          <div className="today-block-heading">
            <p className="panel-label">Links</p>
            <h2>Public links</h2>
          </div>

          <div className="profile-fields">
            <label className="field">
              <span>Main portfolio link</span>
              <input
                defaultValue={workspace.profile.portfolioPrimaryUrl}
                form={formId}
                name="portfolioPrimaryUrl"
                placeholder="https://portfolio.site/project"
                type="url"
              />
            </label>
            <label className="field">
              <span>Personal website</span>
              <input
                defaultValue={workspace.profile.personalSiteUrl}
                form={formId}
                name="personalSiteUrl"
                placeholder="https://your-site.com"
                type="url"
              />
            </label>
            <label className="field">
              <span>LinkedIn profile</span>
              <input
                defaultValue={workspace.profile.linkedinUrl}
                form={formId}
                name="linkedinUrl"
                placeholder="https://linkedin.com/in/your-name"
                type="url"
              />
            </label>
          </div>
        </section>
      </div>

      <div className="settings-profile-rail-footer">
        <section className="today-block settings-rail-actions-block">
          <div className="settings-rail-heading-with-status">
            <div className="today-block-heading">
              <p className="panel-label">Actions</p>
              <h2>Account</h2>
            </div>
            <ProfileSaveMessageSlot />
          </div>

          <div className="settings-rail-actions">
            <button className="button button-secondary" form={formId} type="submit">
              Save settings
            </button>

            <form action={clearActiveOperatorSelection}>
              <button className="button button-secondary" type="submit">
                Log out
              </button>
            </form>
          </div>
        </section>
      </div>
    </aside>
  )
}
