import type { ProfileWorkspaceStatusRecord } from '@/lib/domain/types'

export interface ProfileReadinessPresentation {
  actionHref: string
  actionLabel: string
  generationDisabledReason: string
  jobsIssue: string
  packetLabel: string
  packetLines: string[]
  packetNote: string
  packetTitle: string
  queueEmptyMessage: string
  todayRailLines: string[]
}

function buildLockedPresentation(options: {
  generationDisabledReason: string
  jobsIssue: string
  packetLines: string[]
  packetTitle: string
  queueEmptyMessage: string
  todayRailLines: string[]
}): ProfileReadinessPresentation {
  return {
    actionHref: '/profile',
    actionLabel: 'Open Profile',
    generationDisabledReason: options.generationDisabledReason,
    jobsIssue: options.jobsIssue,
    packetLabel: 'Profile not ready',
    packetLines: options.packetLines,
    packetNote:
      'Use Profile to upload your resume, generate the profile draft, review the extracted sections, and save once the required fields are ready. The queue and packet tools unlock once your profile is ready.',
    packetTitle: options.packetTitle,
    queueEmptyMessage: options.queueEmptyMessage,
    todayRailLines: options.todayRailLines,
  }
}

export function buildProfileReadinessPresentation(
  status: ProfileWorkspaceStatusRecord,
): ProfileReadinessPresentation | null {
  if (status.rankingEligibilityState === 'ready') {
    return null
  }

  if (status.sourceState === 'blank') {
    return buildLockedPresentation({
      generationDisabledReason:
        'Upload your resume in Profile, generate the draft, review the extracted sections, and save before generating application materials.',
      jobsIssue: 'Upload your resume in Profile to unlock the Potential queue.',
      packetLines: ['Upload your resume in Profile before generating application materials.'],
      packetTitle: 'Upload your resume before generating application materials.',
      queueEmptyMessage: 'Upload your resume in Profile to unlock Potential.',
      todayRailLines: [
        'Upload your resume to unlock the queue.',
        'Open Profile, upload your resume, generate the draft, then save once the required fields are ready.',
      ],
    })
  }

  if (status.sourceState === 'sources_uploaded') {
    return buildLockedPresentation({
      generationDisabledReason:
        'Generate your profile in Profile, review the extracted sections, and save before generating application materials.',
      jobsIssue: 'Generate your profile in Profile to unlock the Potential queue.',
      packetLines: ['Generate the profile draft in Profile before creating application materials.'],
      packetTitle: 'Generate your profile before generating application materials.',
      queueEmptyMessage: 'Generate your profile in Profile to unlock Potential.',
      todayRailLines: [
        'Generate your profile to unlock the queue.',
        'Open Profile, generate the draft from your uploaded resume, review the extracted sections, then save.',
      ],
    })
  }

  return buildLockedPresentation({
    generationDisabledReason:
      'Review the extracted sections in Profile, then save once the required fields are ready before generating application materials.',
    jobsIssue: 'Review and save your profile in Profile to unlock the Potential queue.',
    packetLines: ['Review the extracted sections in Profile, then save to unlock application materials.'],
    packetTitle: 'Review and save your profile before generating application materials.',
    queueEmptyMessage: 'Review and save your profile in Profile to unlock Potential.',
    todayRailLines: [
      'Review and save your profile to unlock the queue.',
      'Open Profile, review the extracted sections, then save once the required fields are ready.',
    ],
  })
}
