import { ProfileForm } from '@/components/profile/profile-form'
import { ProfileSaveMessageRootProvider } from '@/components/profile/profile-save-message-root'
import { ProfileSettingsRail } from '@/components/profile/profile-settings-rail'
import { PageIntroHeader } from '@/components/ui/page-intro-header'
import { WorkspaceSurface } from '@/components/navigation/workspace-surface'
import { requireActiveOperatorSelection } from '@/lib/data/operators'
import { getOperatorProfile } from '@/lib/data/operator-profile'
import { parseHeadlineTags } from '@/lib/profile/headline-tags'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  await requireActiveOperatorSelection()
  const { workspace } = await getOperatorProfile()
  const initialApplicationTitleTags =
    workspace.profile.targetRoles.length > 0
      ? workspace.profile.targetRoles
      : parseHeadlineTags(workspace.profile.headline)

  return (
    <main className="page-stack workspace-surface settings-page">
      <ProfileSaveMessageRootProvider initialApplicationTitleTags={initialApplicationTitleTags}>
        <WorkspaceSurface
          rail={<ProfileSettingsRail formId="profile-workspace-form" workspace={workspace} />}
        >
            <PageIntroHeader
              className="settings-page-header"
              label="Settings"
              note="Manage the source documents, profile facts, and matching preferences used across the site."
              title="Profile"
            />

            <ProfileForm workspace={workspace} />
        </WorkspaceSurface>
      </ProfileSaveMessageRootProvider>
    </main>
  )
}
