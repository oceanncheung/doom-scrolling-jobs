'use client'

import { useActionState } from 'react'

import type { OperatorProfileRecord } from '@/lib/domain/types'

import { saveOperatorProfile, type ProfileActionState } from '@/app/profile/actions'

const initialState: ProfileActionState = {
  message: '',
  status: 'idle',
}

interface ProfileFormProps {
  profile: OperatorProfileRecord
}

function toTextAreaValue(values: string[]) {
  return values.join('\n')
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState(saveOperatorProfile, initialState)

  return (
    <form action={formAction} className="profile-form">
      <section className="panel">
        <p className="panel-label">Operator identity</p>
        <h2>Canonical profile anchor</h2>
        <div className="field-grid field-grid-2">
          <label className="field">
            <span>Display name</span>
            <input defaultValue={profile.displayName} name="displayName" type="text" />
          </label>
          <label className="field">
            <span>Internal account</span>
            <input defaultValue={profile.email} disabled readOnly type="email" />
          </label>
          <label className="field">
            <span>Headline</span>
            <input defaultValue={profile.headline} name="headline" required type="text" />
          </label>
          <label className="field">
            <span>Seniority level</span>
            <input defaultValue={profile.seniorityLevel} name="seniorityLevel" type="text" />
          </label>
          <label className="field">
            <span>Location label</span>
            <input defaultValue={profile.locationLabel} name="locationLabel" type="text" />
          </label>
          <label className="field">
            <span>Timezone</span>
            <input defaultValue={profile.timezone} name="timezone" type="text" />
          </label>
        </div>
      </section>

      <section className="panel">
        <p className="panel-label">Ranking preferences</p>
        <h2>Keep the scoring engine aligned to the real operator.</h2>
        <div className="field-grid field-grid-2">
          <label className="field checkbox-field">
            <span>Remote required</span>
            <input defaultChecked={profile.remoteRequired} name="remoteRequired" type="checkbox" />
          </label>
          <label className="field">
            <span>Salary currency</span>
            <input defaultValue={profile.salaryFloorCurrency} name="salaryFloorCurrency" type="text" />
          </label>
          <label className="field">
            <span>Salary floor</span>
            <input defaultValue={profile.salaryFloorAmount} name="salaryFloorAmount" type="number" />
          </label>
          <label className="field">
            <span>Salary target min</span>
            <input defaultValue={profile.salaryTargetMin} name="salaryTargetMin" type="number" />
          </label>
          <label className="field">
            <span>Salary target max</span>
            <input defaultValue={profile.salaryTargetMax} name="salaryTargetMax" type="number" />
          </label>
        </div>
        <div className="field-grid field-grid-2">
          <label className="field">
            <span>Target roles</span>
            <textarea
              defaultValue={toTextAreaValue(profile.targetRoles)}
              name="targetRoles"
              rows={6}
            />
            <small>One role per line or comma-separated.</small>
          </label>
          <label className="field">
            <span>Allowed adjacent roles</span>
            <textarea
              defaultValue={toTextAreaValue(profile.allowedAdjacentRoles)}
              name="allowedAdjacentRoles"
              rows={6}
            />
            <small>These roles can pass if the fit is genuinely strong.</small>
          </label>
        </div>
      </section>

      <section className="panel">
        <p className="panel-label">Skills and links</p>
        <h2>Give the prep system a truthful source to work from.</h2>
        <div className="field-grid field-grid-2">
          <label className="field">
            <span>Skills</span>
            <textarea defaultValue={toTextAreaValue(profile.skills)} name="skills" rows={6} />
          </label>
          <label className="field">
            <span>Tools</span>
            <textarea defaultValue={toTextAreaValue(profile.tools)} name="tools" rows={6} />
          </label>
          <label className="field">
            <span>Portfolio primary URL</span>
            <input
              defaultValue={profile.portfolioPrimaryUrl}
              name="portfolioPrimaryUrl"
              type="url"
            />
          </label>
          <label className="field">
            <span>LinkedIn URL</span>
            <input defaultValue={profile.linkedinUrl} name="linkedinUrl" type="url" />
          </label>
          <label className="field">
            <span>Personal site URL</span>
            <input defaultValue={profile.personalSiteUrl} name="personalSiteUrl" type="url" />
          </label>
        </div>
        <label className="field">
          <span>Professional summary</span>
          <textarea defaultValue={profile.bioSummary} name="bioSummary" rows={6} />
        </label>
        <label className="field">
          <span>Preferences notes</span>
          <textarea defaultValue={profile.preferencesNotes} name="preferencesNotes" rows={5} />
        </label>
      </section>

      <div className="profile-form-footer">
        <div
          className={`form-message ${
            state.status === 'success'
              ? 'form-message-success'
              : state.status === 'error'
                ? 'form-message-error'
                : ''
          }`}
        >
          {state.message || 'This screen writes to the seeded single-user profile when Supabase is configured.'}
        </div>
        <button className="button button-primary" disabled={isPending} type="submit">
          {isPending ? 'Saving profile...' : 'Save profile'}
        </button>
      </div>
    </form>
  )
}
