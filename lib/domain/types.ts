import type { EvidenceBankEntryRecord } from './evidence'

export const workflowStatuses = [
  'new',
  'ranked',
  'shortlisted',
  'preparing',
  'ready_to_apply',
  'applied',
  'follow_up_due',
  'interview',
  'rejected',
  'archived',
] as const

export type WorkflowStatus = (typeof workflowStatuses)[number]

export const packetStatuses = ['draft', 'ready', 'applied', 'archived'] as const

export type PacketStatus = (typeof packetStatuses)[number]

export const packetGenerationStatuses = ['not_started', 'running', 'generated', 'failed'] as const

export type PacketGenerationStatus = (typeof packetGenerationStatuses)[number]

export const packetQuestionSnapshotStatuses = [
  'not_started',
  'extracted',
  'none',
  'failed',
  'unsupported',
] as const

export type PacketQuestionSnapshotStatus = (typeof packetQuestionSnapshotStatuses)[number]

export const jobReviewSummaryStatuses = ['not_started', 'generated', 'failed'] as const

export type JobReviewSummaryStatus = (typeof jobReviewSummaryStatuses)[number]

export const answerReviewStatuses = ['draft', 'edited', 'approved'] as const

export type AnswerReviewStatus = (typeof answerReviewStatuses)[number]

export const resumeExportStatuses = ['draft', 'ready', 'exported'] as const

export type ResumeExportStatus = (typeof resumeExportStatuses)[number]

export const canonicalApprovalStatuses = ['draft', 'approved'] as const

export type CanonicalApprovalStatus = (typeof canonicalApprovalStatuses)[number]

export const profileSourceStates = ['blank', 'sources_uploaded', 'draft_generated'] as const

export type ProfileSourceState = (typeof profileSourceStates)[number]

export const profileReadinessStates = ['needs_review', 'approved'] as const

export type ProfileReadinessState = (typeof profileReadinessStates)[number]

export const rankingEligibilityStates = ['locked', 'ready'] as const

export type RankingEligibilityState = (typeof rankingEligibilityStates)[number]

export const recommendationLevels = [
  'strong_apply',
  'apply_if_interested',
  'consider_carefully',
  'skip',
] as const

export type RecommendationLevel = (typeof recommendationLevels)[number]

export const matchingRoleBreadths = ['tight', 'balanced', 'broad'] as const

export type MatchingRoleBreadth = (typeof matchingRoleBreadths)[number]

export const matchingMarketStrictnessLevels = ['strict', 'balanced', 'flexible'] as const

export type MatchingMarketStrictness = (typeof matchingMarketStrictnessLevels)[number]

export const matchingSourceMixes = ['ats_first', 'balanced', 'discovery'] as const

export type MatchingSourceMix = (typeof matchingSourceMixes)[number]

export interface MatchingPreferencesRecord {
  marketStrictness: MatchingMarketStrictness
  roleBreadth: MatchingRoleBreadth
  sourceMix: MatchingSourceMix
}

export type RemoteType = 'remote' | 'hybrid' | 'onsite' | 'unknown'

export type CanonicalConfidence = 'high' | 'medium' | 'low'

export interface OperatorRecord {
  createdAt?: string
  displayName: string
  email: string
  id: string
  slug: string
  userId: string
}

export interface JobScore {
  aiDescriptionExcerpt?: string
  aiMatchSummary?: string
  aiSummaryError?: string
  aiSummaryGeneratedAt?: string
  aiSummaryModel?: string
  aiSummaryStatus: JobReviewSummaryStatus
  id: string
  jobId: string
  totalScore: number
  qualityScore: number
  salaryScore: number
  roleRelevanceScore: number
  seniorityScore: number
  portfolioFitScore: number
  effortScore: number
  penaltyScore: number
  remoteGatePassed: boolean
  recommendationLevel: RecommendationLevel
  workflowStatus: WorkflowStatus
  fitSummary: string
  redFlags: string[]
}

export interface ResumeVersionPacketRecord {
  changeSummaryText: string
  id: string
  headlineText: string
  versionLabel: string
  summaryText: string
  experienceEntries: ResumeExperienceRecord[]
  highlightedRequirements: string[]
  skillsSection: string[]
  tailoringNotes: string
  exportStatus: ResumeExportStatus
}

export interface PacketPortfolioRecommendationRecord {
  primaryLabel: string
  primaryUrl: string
  rationale: string
}

export interface PacketCaseStudyRecord {
  displayOrder: number
  portfolioItemId: string
  reason: string
  title: string
  url: string
}

export interface ApplicationAnswerRecord {
  id: string
  answerText: string
  answerVariantShort: string
  characterLimit?: number
  fieldType: string
  questionKey: string
  questionText: string
  reviewStatus: AnswerReviewStatus
}

export interface ApplicationPacketRecord {
  answers: ApplicationAnswerRecord[]
  caseStudySelection: PacketCaseStudyRecord[]
  checklistItems: string[]
  coverLetterChangeSummary: string
  coverLetterDraft: string
  coverLetterSummary: string
  generationError?: string
  generationModel?: string
  generationPromptVersion?: string
  generationProvider?: string
  generationStatus: PacketGenerationStatus
  generatedAt?: string
  id: string
  jobId: string
  jobScoreId: string
  jobFocusSummary: string
  jobSummary: string
  lastReviewedAt?: string
  manualNotes: string
  packetStatus: PacketStatus
  portfolioRecommendation: PacketPortfolioRecommendationRecord
  professionalSummary: string
  questionSnapshotError?: string
  questionSnapshotRefreshedAt?: string
  questionSnapshotStatus: PacketQuestionSnapshotStatus
  resumeVersion: ResumeVersionPacketRecord
}

export interface OperatorProfileRecord {
  userId: string
  profileId: string
  updatedAt?: string
  displayName: string
  email: string
  phoneNumber: string
  searchBrief: string
  headline: string
  locationLabel: string
  timezone: string
  remoteRequired: boolean
  primaryMarket: string
  secondaryMarkets: string[]
  allowedRemoteRegions: string[]
  timezoneToleranceHours: string
  relocationOpen: boolean
  salaryFloorCurrency: string
  salaryFloorAmount: string
  salaryTargetMin: string
  salaryTargetMax: string
  seniorityLevel: string
  targetSeniorityLevels: string[]
  targetRoles: string[]
  allowedAdjacentRoles: string[]
  industriesPreferred: string[]
  industriesAvoid: string[]
  skills: string[]
  tools: string[]
  languages: string[]
  workAuthorizationNotes: string
  portfolioPrimaryUrl: string
  linkedinUrl: string
  personalSiteUrl: string
  bioSummary: string
  preferencesNotes: string
  matchingPreferences: MatchingPreferencesRecord
  canonicalProfileReviewedAt?: string
}

export interface ResumeExperienceRecord {
  companyName: string
  roleTitle: string
  locationLabel: string
  startDate: string
  endDate: string
  summary: string
  highlights: string[]
}

export interface ResumeAchievementRecord {
  category: string
  title: string
  detail: string
}

export interface ResumeEducationRecord {
  schoolName: string
  credential: string
  fieldOfStudy: string
  startDate: string
  endDate: string
  notes: string
}

export interface MasterSectionProvenanceRecord {
  confidence: CanonicalConfidence
  notes: string[]
  sourceLabels: string[]
}

export interface ResumeContactSnapshotRecord {
  email: string
  linkedinUrl: string
  location: string
  name: string
  phone: string
  portfolioUrl: string
  websiteUrl: string
}

export interface ResumeMasterRecord {
  additionalInformation: string[]
  approvalStatus: CanonicalApprovalStatus
  approvedAt?: string
  archivedExperienceEntries: ResumeExperienceRecord[]
  baseTitle: string
  baseCoverLetterText: string
  contactSnapshot: ResumeContactSnapshotRecord
  coreExpertise: string[]
  hasSourceMaterial: boolean
  generationIssues: string[]
  languages: string[]
  rawSourceText: string
  renderedMarkdown: string
  sectionProvenance: Record<string, MasterSectionProvenanceRecord>
  selectedImpactHighlights: string[]
  sourceContent: Record<string, unknown>
  sourceFormat: string
  summaryText: string
  experienceEntries: ResumeExperienceRecord[]
  achievementBank: ResumeAchievementRecord[]
  skillsSection: string[]
  educationEntries: ResumeEducationRecord[]
  certifications: string[]
  toolsPlatforms: string[]
  resumePdfFileName: string
  coverLetterPdfFileName: string
  portfolioPdfFileName: string
}

export interface CoverLetterContactSnapshotRecord {
  location: string
  name: string
  roleTargets: string[]
}

export interface CoverLetterProofBankEntryRecord {
  bullets: string[]
  context: string
  label: string
}

export interface CoverLetterMasterRecord {
  approvalStatus: CanonicalApprovalStatus
  approvedAt?: string
  capabilities: {
    disciplines: string[]
    productionTools: string[]
  }
  contactSnapshot: CoverLetterContactSnapshotRecord
  generationIssues: string[]
  hasSourceMaterial: boolean
  keyDifferentiators: string[]
  outputConstraints: string[]
  positioningPhilosophy: string
  proofBank: CoverLetterProofBankEntryRecord[]
  rawSourceText: string
  renderedMarkdown: string
  sectionProvenance: Record<string, MasterSectionProvenanceRecord>
  selectionRules: string[]
  sourceContent: Record<string, unknown>
  sourceFormat: string
  toneVoice: string[]
}

export interface OperatorPortfolioItemRecord {
  id: string
  title: string
  url: string
  projectType: string
  roleLabel: string
  summary: string
  skillsTags: string[]
  industryTags: string[]
  outcomeMetrics: string[]
  visualStrengthRating: string
  isPrimary: boolean
  isActive: boolean
}

export interface ProfileWorkspaceStatusRecord {
  blockingIssues: string[]
  coverLetterIssues: string[]
  profileIssues: string[]
  rankingEligibilityState: RankingEligibilityState
  readinessState: ProfileReadinessState
  resumeIssues: string[]
  sourceState: ProfileSourceState
}

export interface OperatorWorkspaceRecord {
  coverLetterMaster: CoverLetterMasterRecord
  portfolioItems: OperatorPortfolioItemRecord[]
  profile: OperatorProfileRecord
  resumeMaster: ResumeMasterRecord
  status: ProfileWorkspaceStatusRecord
  /**
   * Confirmed evidence_bank entries — fed into generation prompts because the operator
   * has already reviewed them. Empty array when the operator hasn't run enrichment yet
   * or has nothing confirmed.
   */
  confirmedEvidenceEntries: EvidenceBankEntryRecord[]
  /**
   * Evidence entries that have been extracted from a source but not yet confirmed or
   * discarded. Surfaced in the /profile Proof points tab so the operator can review and
   * act on them inline. Never fed into resume/cover-letter generation until confirmed.
   */
  pendingEvidenceEntries: EvidenceBankEntryRecord[]
}
