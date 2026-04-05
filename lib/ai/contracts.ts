import type {
  ApplicationAnswerRecord,
  CoverLetterMasterRecord,
  MasterSectionProvenanceRecord,
  OperatorWorkspaceRecord,
  ResumeExperienceRecord,
  ResumeMasterRecord,
} from '@/lib/domain/types'
import type { NormalizedJobRecord, RankedJobRecord } from '@/lib/jobs/contracts'

export interface JobSummaryInput {
  fitReasons: string[]
  fitSummary: string
  job: Pick<
    NormalizedJobRecord,
    | 'companyName'
    | 'department'
    | 'descriptionText'
    | 'locationLabel'
    | 'preferredQualifications'
    | 'remoteType'
    | 'requirements'
    | 'salaryCurrency'
    | 'salaryMax'
    | 'salaryMin'
    | 'skillsKeywords'
    | 'title'
  >
}

export interface JobSummaryOutput {
  descriptionExcerpt: string
  matchSummary: string
  hiringSignals: string[]
}

export interface ResumeVariantInput {
  baselineAnswers: ApplicationAnswerRecord[]
  job: RankedJobRecord
  workspace: OperatorWorkspaceRecord
}

export interface ResumeVariantOutput {
  changeSummaryForUser: string
  experienceEntries: ResumeExperienceRecord[]
  headline: string
  highlightedRequirements: string[]
  skillsSection: string[]
  summary: string
  tailoringRationale: string
}

export interface CoverLetterInput {
  job: RankedJobRecord
  resumeVariant: ResumeVariantOutput
  workspace: OperatorWorkspaceRecord
}

export interface CoverLetterOutput {
  draft: string
  summary: string
}

export interface GeneratedAnswerOutput {
  answerText: string
  answerVariantShort: string
  questionKey: string
}

export interface ApplicationAnswersInput {
  answers: ApplicationAnswerRecord[]
  job: RankedJobRecord
  resumeVariant: ResumeVariantOutput
  workspace: OperatorWorkspaceRecord
}

export interface GeneratedPacketOutput {
  answers: GeneratedAnswerOutput[]
  coverLetter: CoverLetterOutput
  resumeVariant: ResumeVariantOutput
}

export interface ProfileWorkspaceGenerationInput {
  masterCoverLetterMarkdown?: string
  masterResumeMarkdown: string
}

export interface ProfileWorkspaceGenerationOutput {
  allowedAdjacentRoles: string[]
  bioSummary: string
  headline: string
  locationLabel: string
  searchBrief: string
  skills: string[]
  targetRoles: string[]
  targetSeniorityLevels: string[]
  tools: string[]
}

export interface GeneratedResumeMasterOutput {
  additionalInformation: string[]
  archivedExperienceEntries: ResumeExperienceRecord[]
  baseTitle: string
  contactSnapshot: ResumeMasterRecord['contactSnapshot']
  coreExpertise: string[]
  educationEntries: ResumeMasterRecord['educationEntries']
  experienceEntries: ResumeExperienceRecord[]
  languages: string[]
  sectionProvenance: Record<string, MasterSectionProvenanceRecord>
  selectedImpactHighlights: string[]
  skillsSection: string[]
  summaryText: string
  toolsPlatforms: string[]
}

export interface GeneratedCoverLetterMasterOutput {
  capabilities: CoverLetterMasterRecord['capabilities']
  contactSnapshot: CoverLetterMasterRecord['contactSnapshot']
  keyDifferentiators: string[]
  outputConstraints: string[]
  positioningPhilosophy: string
  proofBank: CoverLetterMasterRecord['proofBank']
  sectionProvenance: Record<string, MasterSectionProvenanceRecord>
  selectionRules: string[]
  toneVoice: string[]
}

export interface CanonicalSourceGenerationInput {
  sourceCoverLetterText?: string
  sourceResumeText: string
}

export interface CanonicalSourceGenerationOutput {
  coverLetterMaster: GeneratedCoverLetterMasterOutput
  profileDraft: ProfileWorkspaceGenerationOutput
  resumeMaster: GeneratedResumeMasterOutput
}
