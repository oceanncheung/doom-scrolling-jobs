import { ProfileForm } from '@/components/profile/profile-form'
import { getOperatorProfile } from '@/lib/data/operator-profile'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const { workspace } = await getOperatorProfile()
  const { portfolioItems, profile, resumeMaster } = workspace

  return (
    <main className="page-stack">
      <section className="page-header page-header-split">
        <div className="page-heading">
          <p className="panel-label">Profile</p>
          <h1>Settings</h1>
        </div>
        <div className="header-meta-grid">
          <article className="header-meta">
            <p className="panel-label">Identity</p>
            <p>{profile.headline}</p>
            <p>{profile.locationLabel || 'Location pending'}</p>
          </article>
          <article className="header-meta">
            <p className="panel-label">Coverage</p>
            <p>{resumeMaster.experienceEntries.length} experience entries</p>
            <p>{portfolioItems.length} portfolio items</p>
          </article>
        </div>
      </section>

      <ProfileForm workspace={workspace} />
    </main>
  )
}
