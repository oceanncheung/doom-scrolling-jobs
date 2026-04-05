import type { ApplicationPacketRecord, OperatorWorkspaceRecord } from '@/lib/domain/types'

/** True when the packet snapshot has resume-like material copied from the profile workspace. */
function hasPacketResumeSignals(packet: ApplicationPacketRecord): boolean {
  const resumeSource =
    packet.resumeVersion.summaryText?.trim() ||
    packet.professionalSummary?.trim() ||
    ''
  const hasExperience = packet.resumeVersion.experienceEntries.some(
    (entry) =>
      entry.companyName?.trim() ||
      entry.roleTitle?.trim() ||
      entry.summary?.trim() ||
      entry.highlights.some((h) => h.trim()),
  )

  return Boolean(
    resumeSource ||
      packet.resumeVersion.highlightedRequirements.length > 0 ||
      packet.resumeVersion.skillsSection.length > 0 ||
      hasExperience,
  )
}

/** True when the workspace has an uploaded resume source (Settings / profile materials). */
function hasWorkspaceResumeSource(workspace: OperatorWorkspaceRecord): boolean {
  return (
    workspace.resumeMaster.hasSourceMaterial ||
    workspace.status.sourceState !== 'blank' ||
    Boolean(workspace.resumeMaster.resumePdfFileName?.trim())
  )
}

/**
 * Both profile material in the packet job snapshot and a resume source in Settings are present.
 * Used to avoid blaming the profile when generation fails for other reasons.
 */
export function computeProfileMaterialReady(
  packet: ApplicationPacketRecord,
  workspace: OperatorWorkspaceRecord,
): boolean {
  return hasPacketResumeSignals(packet) && hasWorkspaceResumeSource(workspace)
}
