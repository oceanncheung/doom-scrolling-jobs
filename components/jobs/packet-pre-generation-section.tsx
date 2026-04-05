import Link from 'next/link'

import {
  getPacketGenerationRemediationHint,
  getPacketGenerationUserMessage,
} from '@/lib/jobs/packet-generation-copy'

interface PacketPreGenerationSectionProps {
  generationError?: string
  isFailed: boolean
  isRunning: boolean
  screeningLocked?: boolean
}

export function PacketPreGenerationSection({
  generationError,
  isFailed,
  isRunning,
  screeningLocked = false,
}: PacketPreGenerationSectionProps) {
  const userFacingError = getPacketGenerationUserMessage(generationError)
  const remediationHint = getPacketGenerationRemediationHint(generationError)
  const idleNote =
    'Nothing is shown yet so this step stays focused. Generate the content first, then review it here.'
  const runningNote = 'Generating tailored resume, cover letter, and answers...'
  const showRemediationCallout = isFailed && Boolean(userFacingError || remediationHint)

  const note = screeningLocked
    ? 'Complete your profile in Profile before generating application materials.'
    : userFacingError || idleNote

  return (
    <section className="packet-section">
      <div className="packet-section-inner">
        <div className="settings-section-header packet-section-heading">
          <div className="settings-section-title-stack">
            <p className="panel-label">{screeningLocked ? 'Profile not ready' : 'Generate content'}</p>
            <h2>
              {screeningLocked
                ? 'Complete your profile before preparing this packet.'
                : 'Create the resume and cover letter for this role.'}
            </h2>
            <p className="settings-section-note">
              {screeningLocked
                ? 'Use Profile to upload your resume, generate the profile draft, review the extracted sections, and save once the required fields are ready. The application packet unlocks once your profile is ready.'
                : 'Resume and cover letter will appear here after generation. Application questions only show up when the ATS actually asks for them.'}
            </p>
          </div>
        </div>

        {screeningLocked ? (
          <div className="packet-remediation-callout">
            <p className="packet-remediation-callout__lead">{note}</p>
            <Link className="button button-secondary button-small packet-remediation-callout__action" href="/profile">
              Open Profile
            </Link>
          </div>
        ) : isRunning ? (
          <div className="packet-inline-note">
            <p>{runningNote}</p>
          </div>
        ) : showRemediationCallout ? (
          <div className="packet-remediation-callout">
            {userFacingError ? <p className="packet-remediation-callout__lead">{userFacingError}</p> : null}
            {remediationHint ? <p className="packet-remediation-callout__hint">{remediationHint}</p> : null}
            <Link className="button button-secondary button-small packet-remediation-callout__action" href="/profile">
              Open Profile
            </Link>
          </div>
        ) : (
          <div className="packet-inline-note">
            <p>{note}</p>
          </div>
        )}
      </div>
    </section>
  )
}
