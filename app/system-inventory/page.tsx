import { WorkspaceRailShell } from '@/components/navigation/workspace-rail-shell'
import { WorkspaceSurface } from '@/components/navigation/workspace-surface'
import { ProfileSaveMessageRootProvider } from '@/components/profile/profile-save-message-root'
import { SystemInventoryPage } from '@/components/system/system-inventory-page'
import { PageIntroHeader } from '@/components/ui/page-intro-header'
import { TodayBlockHeading } from '@/components/ui/today-block-heading'

export const dynamic = 'force-dynamic'

function SystemInventoryRail() {
  return (
    <WorkspaceRailShell ariaLabel="System inventory" className="today-rail settings-profile-rail">
      <section className="today-block">
        <TodayBlockHeading label="System" title="Inventory" />
        <p className="profile-note">
          Hidden internal route for validating shared primitives and interaction contracts.
        </p>
      </section>

      <section className="today-block">
        <TodayBlockHeading label="Coverage" title="Phase B" />
        <dl className="today-stats">
          <div>
            <dt>Overlay fields</dt>
            <dd>2</dd>
          </div>
          <div>
            <dt>Tag inputs</dt>
            <dd>4</dd>
          </div>
          <div>
            <dt>Support modules</dt>
            <dd>3</dd>
          </div>
        </dl>
      </section>
    </WorkspaceRailShell>
  )
}

export default function SystemInventoryRoute() {
  return (
    <main className="page-stack workspace-surface settings-page">
      <ProfileSaveMessageRootProvider initialApplicationTitleTags={[]}>
        <WorkspaceSurface rail={<SystemInventoryRail />}>
          <PageIntroHeader
            className="settings-page-header"
            label="Internal"
            note="Use this page to inspect shared UI primitives without changing the live product surfaces."
            title="System inventory"
          />

          <SystemInventoryPage />
        </WorkspaceSurface>
      </ProfileSaveMessageRootProvider>
    </main>
  )
}
