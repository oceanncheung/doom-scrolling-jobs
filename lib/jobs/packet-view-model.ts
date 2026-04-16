import type { ApplicationPacketRecord } from '@/lib/domain/types'
import {
  getPacketGenerationRemediationHint,
  getPacketGenerationUserMessage,
  isIncompleteAtsGenerationError,
} from '@/lib/jobs/packet-generation-copy'
import { getPacketLifecycle } from '@/lib/jobs/packet-lifecycle'
import type { ProfileReadinessPresentation } from '@/lib/profile/readiness-presentation'

function getFirstFilledText(...values: Array<string | null | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? ''
}

function getPreviewText(value: string, fallback: string, maxLength = 220) {
  const trimmed = value.trim()

  if (!trimmed) {
    return fallback
  }

  if (trimmed.length <= maxLength) {
    return trimmed
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}...`
}

export interface PacketMaterialsViewModel {
  coverLetterChangeSummary: string
  coverLetterReady: boolean
  coverLetterSummary: string
  readyAnswerCount: number
  resumeChangeSummary: string
  resumeReady: boolean
  resumeSummary: string
  showQuestionSection: boolean
}

export interface PacketPreGenerationViewModel {
  actionHref?: string
  actionLabel?: string
  label: string
  lines: string[]
  mode: 'failed' | 'idle' | 'locked' | 'profile-remediation' | 'running'
  note: string
  title: string
}

export function buildPacketMaterialsViewModel(packet: ApplicationPacketRecord): PacketMaterialsViewModel {
  const lifecycle = getPacketLifecycle(packet)
  const resumeSource = getFirstFilledText(packet.resumeVersion.summaryText, packet.professionalSummary)
  const coverLetterSource = packet.coverLetterDraft.trim()
  const coverLetterChangeDedicated = getFirstFilledText(packet.coverLetterChangeSummary)
  /* Same pipeline as resume change summary: AI `changeSummaryForUser` → DB. If missing (legacy row), reuse the one-line cover letter summary so this cell isn’t stuck on the pre-gen placeholder. */
  const coverLetterChangeDisplay =
    coverLetterChangeDedicated ||
    (coverLetterSource ? getFirstFilledText(packet.coverLetterSummary) : '')
  const coverLetterChangeFallback =
    coverLetterSource && !coverLetterChangeDisplay
      ? 'Regenerate application materials to capture the cover-letter change summary for this packet.'
      : 'A short explanation of how the cover letter was tailored will appear here once the application materials are generated.'

  return {
    coverLetterChangeSummary: getPreviewText(coverLetterChangeDisplay, coverLetterChangeFallback),
    coverLetterReady: Boolean(coverLetterSource),
    coverLetterSummary: getPreviewText(
      packet.coverLetterSummary || coverLetterSource,
      'A role-specific cover letter will appear here once the application materials are generated.',
    ),
    readyAnswerCount: lifecycle.readyAnswerCount,
    resumeChangeSummary: getPreviewText(
      packet.resumeVersion.changeSummaryText,
      'A short explanation of how the resume changed will appear here once the application materials are generated.',
    ),
    resumeReady: Boolean(
      resumeSource ||
        packet.resumeVersion.highlightedRequirements.length > 0 ||
        packet.resumeVersion.skillsSection.length > 0,
    ),
    resumeSummary: getPreviewText(
      resumeSource,
      'A tailored resume summary will appear here once the application materials are generated.',
    ),
    showQuestionSection: lifecycle.showQuestionSection,
  }
}

export function buildPacketPreGenerationViewModel({
  packet,
  profileMaterialReady,
  readinessPresentation,
  screeningLocked,
}: {
  packet: Pick<ApplicationPacketRecord, 'answers' | 'generationError' | 'generationStatus' | 'packetStatus' | 'questionSnapshotStatus'>
  profileMaterialReady: boolean
  readinessPresentation?: ProfileReadinessPresentation | null
  screeningLocked: boolean
}): PacketPreGenerationViewModel {
  const lifecycle = getPacketLifecycle(packet)
  const generationError = packet.generationError
  const userFacingError = getPacketGenerationUserMessage(generationError)
  const remediationHint = getPacketGenerationRemediationHint(generationError)
  const incompleteAts = isIncompleteAtsGenerationError(generationError)

  if (screeningLocked) {
    return {
      actionHref: readinessPresentation?.actionHref ?? '/profile',
      actionLabel: readinessPresentation?.actionLabel ?? 'Open Profile',
      label: readinessPresentation?.packetLabel ?? 'Profile not ready',
      lines: readinessPresentation?.packetLines ?? ['Complete your profile in Profile before generating application materials.'],
      mode: 'locked',
      note: readinessPresentation?.packetNote ?? 'Use Profile to upload your resume, generate the profile draft, review the extracted sections, and save once the required fields are ready. The application packet unlocks once your profile is ready.',
      title: readinessPresentation?.packetTitle ?? 'Complete your profile before generating application materials.',
    }
  }

  if (lifecycle.isRunning) {
    return {
      label: 'Generate content',
      lines: ['Generating tailored resume, cover letter, and answers...'],
      mode: 'running',
      note: 'Resume and cover letter will appear here after generation. Application questions only show up when the ATS actually asks for them.',
      title: 'Create the resume and cover letter for this role.',
    }
  }

  if (lifecycle.isFailed && incompleteAts && !profileMaterialReady && Boolean(userFacingError || remediationHint)) {
    return {
      actionHref: '/profile',
      actionLabel: 'Open Profile',
      label: 'Generate content',
      lines: [userFacingError, remediationHint].filter(Boolean),
      mode: 'profile-remediation',
      note: 'Resume and cover letter will appear here after generation. Application questions only show up when the ATS actually asks for them.',
      title: 'Create the resume and cover letter for this role.',
    }
  }

  if (lifecycle.isFailed) {
    const lines = incompleteAts && profileMaterialReady
      ? ['The application materials could not be generated yet.', 'Try generating again.']
      : [userFacingError, remediationHint].filter(Boolean)

    return {
      label: 'Generate content',
      lines: lines.length > 0 ? lines : ['The application materials could not be generated yet.'],
      mode: 'failed',
      note: 'Resume and cover letter will appear here after generation. Application questions only show up when the ATS actually asks for them.',
      title: 'Create the resume and cover letter for this role.',
    }
  }

  return {
    label: 'Generate content',
    lines: ['Nothing is shown yet so this step stays focused. Generate the content first, then review it here.'],
    mode: 'idle',
    note: 'Resume and cover letter will appear here after generation. Application questions only show up when the ATS actually asks for them.',
    title: 'Create the resume and cover letter for this role.',
  }
}
