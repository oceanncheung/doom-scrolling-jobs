import type {
  CanonicalConfidence,
  CoverLetterMasterRecord,
  MasterSectionProvenanceRecord,
  OperatorProfileRecord,
  ProfileReadinessState,
  ProfileSourceState,
  ProfileWorkspaceStatusRecord,
  RankingEligibilityState,
  ResumeMasterRecord,
} from '@/lib/domain/types'

import {
  ADD_DETAILS_PLACEHOLDER,
  cleanLine,
  type ReviewState,
} from '@/lib/profile/master-assets-text'

export function hasAddDetailsPlaceholder(value: string) {
  return value.toLowerCase().includes(ADD_DETAILS_PLACEHOLDER.toLowerCase())
}

export function getSectionConfidence(
  sectionProvenance: Record<string, MasterSectionProvenanceRecord>,
  section: string,
): CanonicalConfidence {
  return sectionProvenance[section]?.confidence ?? 'high'
}

export function getReviewStateFromPresence(
  hasValue: boolean,
  confidence: CanonicalConfidence = 'high',
): ReviewState {
  if (!hasValue) {
    return 'needs-input'
  }

  if (confidence === 'low') {
    return 'review'
  }

  return 'ready'
}

export function getReviewStateFromText(
  value: string,
  confidence: CanonicalConfidence = 'high',
): ReviewState {
  const normalized = cleanLine(value)
  return getReviewStateFromPresence(
    Boolean(normalized) && !hasAddDetailsPlaceholder(normalized),
    confidence,
  )
}

export function getReviewStateFromList(
  values: string[],
  confidence: CanonicalConfidence = 'high',
): ReviewState {
  const hasMeaningfulValues = values.some(
    (value) => cleanLine(value).length > 0 && !hasAddDetailsPlaceholder(value),
  )

  return getReviewStateFromPresence(hasMeaningfulValues, confidence)
}

function hasLowConfidenceSection(
  sectionProvenance: Record<string, MasterSectionProvenanceRecord>,
  sections: string[],
) {
  return sections.some((section) => sectionProvenance[section]?.confidence === 'low')
}

export function collectResumeMasterIssues(record: ResumeMasterRecord) {
  const issues = [...record.generationIssues]

  if (!record.contactSnapshot.name || hasAddDetailsPlaceholder(record.contactSnapshot.name)) {
    issues.push('Master resume still needs the application name.')
  }

  if (!record.summaryText || hasAddDetailsPlaceholder(record.summaryText)) {
    issues.push('Master resume still needs a professional summary.')
  }

  if (record.experienceEntries.length === 0) {
    issues.push('Master resume still needs at least one professional experience entry.')
  }

  if (record.coreExpertise.length === 0) {
    issues.push('Master resume still needs core expertise tags.')
  }

  if (
    hasLowConfidenceSection(record.sectionProvenance, [
      'professionalSummary',
      'professionalExperience',
      'coreExpertise',
    ])
  ) {
    issues.push('Master resume includes low-confidence sections that should be reviewed.')
  }

  return Array.from(new Set(issues)).filter(Boolean)
}

export function collectCoverLetterMasterIssues(record: CoverLetterMasterRecord) {
  const issues = [...record.generationIssues]

  if (!record.hasSourceMaterial) {
    return issues
  }

  if (!record.positioningPhilosophy || hasAddDetailsPlaceholder(record.positioningPhilosophy)) {
    issues.push('Cover-letter master still needs positioning language.')
  }

  if (record.proofBank.length === 0) {
    issues.push('Cover-letter master still needs a proof bank.')
  }

  if (hasLowConfidenceSection(record.sectionProvenance, ['positioningPhilosophy', 'proofBank'])) {
    issues.push('Cover-letter master includes low-confidence sections that should be reviewed.')
  }

  return Array.from(new Set(issues)).filter(Boolean)
}

export function collectProfileDraftBlockingIssues(
  profile: Pick<
    OperatorProfileRecord,
    'headline' | 'locationLabel' | 'searchBrief' | 'skills' | 'targetRoles'
  >,
) {
  const issues: string[] = []

  if (!cleanLine(profile.headline) || hasAddDetailsPlaceholder(profile.headline)) {
    issues.push('Profile headline still needs review.')
  }

  if (!cleanLine(profile.locationLabel) || hasAddDetailsPlaceholder(profile.locationLabel)) {
    issues.push('Profile location still needs review.')
  }

  if (!cleanLine(profile.searchBrief) || hasAddDetailsPlaceholder(profile.searchBrief)) {
    issues.push('Search brief still needs review.')
  }

  if (profile.targetRoles.length === 0) {
    issues.push('At least one target role is required before ranking can unlock.')
  }

  if (profile.skills.length === 0) {
    issues.push('At least one core skill is required before ranking can unlock.')
  }

  return issues
}

export function getProfileSourceState(
  profile: Pick<OperatorProfileRecord, 'canonicalProfileReviewedAt'>,
  resumeMaster: Pick<
    ResumeMasterRecord,
    'approvalStatus' | 'coverLetterPdfFileName' | 'hasSourceMaterial' | 'resumePdfFileName'
  >,
  coverLetterMaster?: Pick<CoverLetterMasterRecord, 'hasSourceMaterial'>,
): ProfileSourceState {
  if (resumeMaster.hasSourceMaterial) {
    return 'draft_generated'
  }

  const hasUploadedSourceDocuments = Boolean(
    resumeMaster.resumePdfFileName ||
      resumeMaster.coverLetterPdfFileName ||
      profile.canonicalProfileReviewedAt ||
      coverLetterMaster?.hasSourceMaterial,
  )

  return hasUploadedSourceDocuments ? 'sources_uploaded' : 'blank'
}

export function getProfileReadinessState(options: {
  blockingIssues: string[]
  profile: Pick<OperatorProfileRecord, 'canonicalProfileReviewedAt'>
  resumeMaster: Pick<ResumeMasterRecord, 'approvalStatus'>
}): ProfileReadinessState {
  const { blockingIssues, profile, resumeMaster } = options

  return resumeMaster.approvalStatus === 'approved' &&
    Boolean(profile.canonicalProfileReviewedAt) &&
    blockingIssues.length === 0
    ? 'approved'
    : 'needs_review'
}

export function getRankingEligibilityState(options: {
  readinessState: ProfileReadinessState
  sourceState: ProfileSourceState
}): RankingEligibilityState {
  const { readinessState, sourceState } = options

  return sourceState === 'draft_generated' && readinessState === 'approved'
    ? 'ready'
    : 'locked'
}

export function buildProfileWorkspaceStatus(options: {
  coverLetterMaster: CoverLetterMasterRecord
  profile: Pick<
    OperatorProfileRecord,
    'canonicalProfileReviewedAt' | 'headline' | 'locationLabel' | 'searchBrief' | 'skills' | 'targetRoles'
  >
  resumeMaster: ResumeMasterRecord
}): ProfileWorkspaceStatusRecord {
  const { coverLetterMaster, profile, resumeMaster } = options
  const profileIssues = collectProfileDraftBlockingIssues(profile)
  const resumeIssues = collectResumeMasterIssues(resumeMaster)
  const coverLetterIssues = collectCoverLetterMasterIssues(coverLetterMaster)
  const blockingIssues = Array.from(new Set([...profileIssues, ...resumeIssues]))
  const sourceState = getProfileSourceState(profile, resumeMaster, coverLetterMaster)
  const readinessState = getProfileReadinessState({
    blockingIssues,
    profile,
    resumeMaster,
  })

  return {
    blockingIssues,
    coverLetterIssues,
    profileIssues,
    rankingEligibilityState: getRankingEligibilityState({
      readinessState,
      sourceState,
    }),
    readinessState,
    resumeIssues,
    sourceState,
  }
}
