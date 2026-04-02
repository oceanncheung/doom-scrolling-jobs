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

export const recommendationLevels = [
  'strong_apply',
  'apply_if_interested',
  'consider_carefully',
  'skip',
] as const

export type RecommendationLevel = (typeof recommendationLevels)[number]

export type RemoteType = 'remote' | 'hybrid' | 'onsite' | 'unknown'

export interface UserProfileSnapshot {
  id: string
  headline: string
  remoteRequired: boolean
  seniorityLevel: string
  targetRoles: string[]
  allowedAdjacentRoles: string[]
  salaryFloorAmount?: number
  salaryTargetMin?: number
  salaryTargetMax?: number
  portfolioPrimaryUrl?: string
}

export interface PortfolioItemSummary {
  id: string
  title: string
  url: string
  projectType: string
  roleLabel: string
  skillsTags: string[]
  industryTags: string[]
  isPrimary: boolean
}

export interface JobListing {
  id: string
  sourceName: string
  companyName: string
  title: string
  department?: string
  remoteType: RemoteType
  remoteRegions: string[]
  salaryMin?: number
  salaryMax?: number
  salaryCurrency?: string
  seniorityLabel?: string
  portfolioRequired: 'yes' | 'no' | 'unknown'
}

export interface JobScore {
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

export interface ApplicationPacketSummary {
  id: string
  jobId: string
  packetStatus: 'draft' | 'ready' | 'applied' | 'archived'
  professionalSummary?: string
  coverLetterDraft?: string
  portfolioRecommendation?: string
  checklistItems: string[]
}

export interface OperatorProfileRecord {
  userId: string
  profileId: string
  displayName: string
  email: string
  headline: string
  locationLabel: string
  timezone: string
  remoteRequired: boolean
  salaryFloorCurrency: string
  salaryFloorAmount: string
  salaryTargetMin: string
  salaryTargetMax: string
  seniorityLevel: string
  targetRoles: string[]
  allowedAdjacentRoles: string[]
  industriesPreferred: string[]
  industriesAvoid: string[]
  skills: string[]
  tools: string[]
  workAuthorizationNotes: string
  portfolioPrimaryUrl: string
  linkedinUrl: string
  personalSiteUrl: string
  bioSummary: string
  preferencesNotes: string
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

export interface ResumeMasterRecord {
  baseTitle: string
  summaryText: string
  experienceEntries: ResumeExperienceRecord[]
  achievementBank: ResumeAchievementRecord[]
  skillsSection: string[]
  educationEntries: ResumeEducationRecord[]
  certifications: string[]
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

export interface OperatorWorkspaceRecord {
  portfolioItems: OperatorPortfolioItemRecord[]
  profile: OperatorProfileRecord
  resumeMaster: ResumeMasterRecord
}
