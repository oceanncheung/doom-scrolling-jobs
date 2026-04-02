import { ProfileForm } from '@/components/profile/profile-form'
import { appMode } from '@/lib/config/runtime'
import { getOperatorProfile } from '@/lib/data/operator-profile'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const { issue, source, workspace } = await getOperatorProfile()
  const { portfolioItems, profile, resumeMaster } = workspace

  return (
    <main className="page-stack">
      <section className="hero-card hero-card-dashboard">
        <div className="hero-copy">
          <p className="eyebrow">Profile settings</p>
          <h1>One seeded operator profile that drives scoring, prep, and workflow decisions.</h1>
          <p className="hero-lede">
            This screen is the single-user control room for the real profile behind job ranking,
            resume tailoring, and packet generation.
          </p>
        </div>
        <div className="hero-summary">
          <p className="panel-label">Runtime mode</p>
          <ul className="compact-list">
            <li>
              <strong>{appMode}</strong>
              <span>The app is running without login and writes to one deterministic operator record.</span>
            </li>
            <li>
              <strong>{source}</strong>
              <span>
                {issue ??
                  'Supabase is connected and the page is reading from the seeded internal operator rows.'}
              </span>
            </li>
          </ul>
        </div>
      </section>

      <section className="panel-grid panel-grid-2">
        <article className="panel">
          <p className="panel-label">Profile identity</p>
          <h2>{profile.headline}</h2>
          <div className="status-track">
            <span>{profile.remoteRequired ? 'remote required' : 'remote optional'}</span>
            <span>{profile.timezone}</span>
            <span>{profile.locationLabel || 'location pending'}</span>
          </div>
        </article>
        <article className="panel">
          <p className="panel-label">Workspace coverage</p>
          <h2>The page now owns profile preferences, resume source content, and the portfolio library.</h2>
          <ul className="compact-list">
            <li>
              <strong>{resumeMaster.experienceEntries.length} experience entries</strong>
              <span>Canonical work history for truthful resume tailoring.</span>
            </li>
            <li>
              <strong>{portfolioItems.length} portfolio items</strong>
              <span>Structured project inventory for role-specific recommendations.</span>
            </li>
          </ul>
        </article>
      </section>

      <ProfileForm workspace={workspace} />
    </main>
  )
}
