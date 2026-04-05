import type {
  CoverLetterProofBankEntryRecord,
  OperatorPortfolioItemRecord,
  OperatorWorkspaceRecord,
  ResumeEducationRecord,
  ResumeExperienceRecord,
} from '@/lib/domain/types'
import { getTargetSeniorityLevels } from '@/lib/profile/seniority-level'

function tagsFromDelimitedString(value: string) {
  return value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
}

function normalizeFileName(value: string | null | undefined) {
  if (!value) {
    return null
  }

  return value.trim() || null
}

function getSourceContentString(sourceContent: Record<string, unknown>, key: string) {
  const value = sourceContent[key]
  return typeof value === 'string' ? value.trim() : ''
}

function createUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replaceAll(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16)
    const value = character === 'x' ? random : (random & 0x3) | 0x8

    return value.toString(16)
  })
}

export function createExperienceEntry(): ResumeExperienceRecord {
  return {
    companyName: '',
    roleTitle: '',
    locationLabel: '',
    startDate: '',
    endDate: '',
    summary: '',
    highlights: [],
  }
}

export function createEducationEntry(): ResumeEducationRecord {
  return {
    schoolName: '',
    credential: '',
    fieldOfStudy: '',
    startDate: '',
    endDate: '',
    notes: '',
  }
}

export function createPortfolioItem(): OperatorPortfolioItemRecord {
  return {
    id: createUuid(),
    title: '',
    url: '',
    projectType: '',
    roleLabel: '',
    summary: '',
    skillsTags: [],
    industryTags: [],
    outcomeMetrics: [],
    visualStrengthRating: '',
    isPrimary: false,
    isActive: true,
  }
}

export function createCoverLetterProofBankEntry(): CoverLetterProofBankEntryRecord {
  return {
    bullets: [],
    context: '',
    label: '',
  }
}

export function createProfileFormInitialState(workspace: OperatorWorkspaceRecord) {
  return {
    adjacentRoleTags: [...workspace.profile.allowedAdjacentRoles],
    allowedRemoteRegionTags: [...workspace.profile.allowedRemoteRegions],
    bioSummary: workspace.profile.bioSummary,
    capabilityDisciplineTags: [...workspace.coverLetterMaster.capabilities.disciplines],
    capabilityToolsTags: [...workspace.coverLetterMaster.capabilities.productionTools],
    certificationTags: [...workspace.resumeMaster.certifications],
    educationEntries:
      workspace.resumeMaster.educationEntries.length > 0
        ? workspace.resumeMaster.educationEntries
        : [createEducationEntry()],
    experienceEntries:
      workspace.resumeMaster.experienceEntries.length > 0
        ? workspace.resumeMaster.experienceEntries
        : [createExperienceEntry()],
    hiringMarketTags: [workspace.profile.primaryMarket, ...workspace.profile.secondaryMarkets].filter(
      (value, index, values) => value.trim().length > 0 && values.indexOf(value) === index,
    ),
    industriesPreferredTags: [...workspace.profile.industriesPreferred],
    keyDifferentiatorTags: [...workspace.coverLetterMaster.keyDifferentiators],
    languageTags: [...workspace.profile.languages],
    portfolioItems: workspace.portfolioItems,
    positioningPhilosophy: workspace.coverLetterMaster.positioningPhilosophy,
    proofBankEntries:
      workspace.coverLetterMaster.proofBank.length > 0
        ? workspace.coverLetterMaster.proofBank
        : [createCoverLetterProofBankEntry()],
    searchBrief: workspace.profile.searchBrief,
    skillsTags: [...workspace.profile.skills],
    sourceCoverLetterFileName: normalizeFileName(workspace.resumeMaster.coverLetterPdfFileName),
    sourceResumeFileName: normalizeFileName(workspace.resumeMaster.resumePdfFileName),
    targetSeniorityLevels: getTargetSeniorityLevels(
      workspace.profile.targetSeniorityLevels,
      workspace.profile.seniorityLevel,
    ),
    timezoneTags: tagsFromDelimitedString(workspace.profile.timezone),
    toneVoiceTags: [...workspace.coverLetterMaster.toneVoice],
    toolsTags: [...workspace.profile.tools],
  }
}

export function getProfileFormDraftState({
  sourceCoverLetterFileName,
  workspace,
}: {
  sourceCoverLetterFileName: string | null
  workspace: OperatorWorkspaceRecord
}) {
  const resumeSourceContent = workspace.resumeMaster.sourceContent
  const coverLetterSourceContent = workspace.coverLetterMaster.sourceContent
  const resumeGeneratedFrom = getSourceContentString(resumeSourceContent, 'generatedFrom')
  const resumeDraftGeneratedAt = getSourceContentString(resumeSourceContent, 'rawResumeGeneratedAt')
  const persistedCoverLetterSourceText =
    getSourceContentString(resumeSourceContent, 'coverLetterSourceText') ||
    getSourceContentString(coverLetterSourceContent, 'coverLetterSourceText')
  const persistedCoverLetterSourceFileName =
    getSourceContentString(resumeSourceContent, 'coverLetterSourceFileName') ||
    getSourceContentString(coverLetterSourceContent, 'coverLetterSourceFileName')

  return {
    hasCoverLetterSource: Boolean(
      sourceCoverLetterFileName ||
        persistedCoverLetterSourceText ||
        persistedCoverLetterSourceFileName,
    ),
    hasGeneratedDraft: Boolean(
      workspace.status.sourceState === 'draft_generated' ||
        resumeGeneratedFrom === 'raw-source-upload' ||
        resumeDraftGeneratedAt,
    ),
  }
}
