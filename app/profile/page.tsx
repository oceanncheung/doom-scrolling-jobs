import { ProfileForm } from '@/components/profile/profile-form'
import { ProfileSaveMessageRootProvider } from '@/components/profile/profile-save-message-root'
import { ProfileSettingsRail } from '@/components/profile/profile-settings-rail'
import { requireActiveOperatorSelection } from '@/lib/data/operators'
import { getOperatorProfile } from '@/lib/data/operator-profile'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  await requireActiveOperatorSelection()
  const { workspace } = await getOperatorProfile()

  return (
    <main className="page-stack workspace-surface settings-page">
      <ProfileSaveMessageRootProvider>
        <section className="dashboard-workspace">
          <ProfileSettingsRail formId="profile-workspace-form" workspace={workspace} />

          <div className="queue-column">
            <div className="queue-meta settings-page-header">
              <div className="queue-meta-heading">
                <div>
                  <p className="panel-label">Workspace settings</p>
                  <h1>Profile</h1>
                </div>
              </div>
              <p>Manage the materials and preferences this workspace uses.</p>
            </div>

            <ProfileForm workspace={workspace} />
          </div>
        </section>
      </ProfileSaveMessageRootProvider>
    </main>
  )
}
