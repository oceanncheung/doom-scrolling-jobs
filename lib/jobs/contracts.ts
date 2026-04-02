import type { RecommendationLevel, RemoteType, WorkflowStatus } from '@/lib/domain/types'

export type EmploymentType =
  | 'full_time'
  | 'contract'
  | 'freelance'
  | 'part_time'
  | 'internship'
  | 'temporary'
  | 'unknown'

export type CompensationPeriod =
  | 'annual'
  | 'monthly'
  | 'weekly'
  | 'daily'
  | 'hourly'
  | 'contract'
  | 'unknown'

export type ListingStatus = 'active' | 'stale' | 'closed' | 'unknown'

export type PortfolioRequirement = 'yes' | 'no' | 'unknown'

export interface RawJobIntakeRecord {
  sourceName: string
  sourceJobId?: string
  sourceUrl: string
  applicationUrl?: string
  capturedAt: string
  companyNameRaw: string
  titleRaw: string
  locationRaw?: string
  compensationRaw?: string
  descriptionText: string
  metadata?: Record<string, unknown>
}

export interface NormalizedJobRecord {
  sourceName: string
  sourceJobId?: string
  sourceUrl: string
  applicationUrl?: string
  companyName: string
  companyDomain?: string
  title: string
  department?: string
  employmentType: EmploymentType
  locationLabel?: string
  remoteType: RemoteType
  remoteRegions: string[]
  salaryCurrency?: string
  salaryMin?: number
  salaryMax?: number
  salaryPeriod: CompensationPeriod
  postedAt?: string
  descriptionText: string
  requirements: string[]
  preferredQualifications: string[]
  skillsKeywords: string[]
  seniorityLabel?: string
  portfolioRequired: PortfolioRequirement
  workAuthNotes?: string
  duplicateGroupKey?: string
  listingStatus: ListingStatus
  redFlagNotes: string[]
}

export interface JobDeduplicationFingerprint {
  canonicalCompanyKey: string
  canonicalTitleKey: string
  canonicalLocationKey: string
  duplicateGroupKey: string
  remoteType: RemoteType
}

export interface RankedJobRecord extends NormalizedJobRecord {
  effortScore: number
  fitReasons: string[]
  fitSummary: string
  id: string
  jobScoreId: string
  missingRequirements: string[]
  penaltyScore: number
  portfolioFitScore: number
  qualityScore: number
  recommendationLevel: RecommendationLevel
  redFlags: string[]
  remoteGatePassed: boolean
  roleRelevanceScore: number
  salaryScore: number
  scamRiskLevel: 'low' | 'medium' | 'high'
  scoredAt?: string
  seniorityScore: number
  totalScore: number
  workflowStatus: WorkflowStatus
}
