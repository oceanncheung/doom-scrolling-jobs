import type { RecommendationLevel, RemoteType, WorkflowStatus } from '@/lib/domain/types'

export type JobSourceKind = 'remote_board' | 'company_career_page' | 'ats_hosted_job_page'

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

export const queueSegments = ['apply_now', 'worth_reviewing', 'monitor', 'hidden'] as const

export type QueueSegment = (typeof queueSegments)[number]

export const qualificationBands = ['strong', 'good', 'mixed', 'weak', 'blocked'] as const

export type QualificationBand = (typeof qualificationBands)[number]

export interface QualificationDimension {
  band: QualificationBand
  label: string
  score: number
}

export interface RawJobIntakeRecord {
  sourceKey?: string
  sourceName: string
  sourceKind?: JobSourceKind
  sourceJobId?: string
  sourceUrl: string
  applicationUrl?: string
  capturedAt: string
  companyNameRaw: string
  titleRaw: string
  locationRaw?: string
  compensationRaw?: string
  postedAtRaw?: string
  descriptionText: string
  metadata?: Record<string, unknown>
}

export interface NormalizedJobRecord {
  sourceKey?: string
  sourceName: string
  sourceKind?: JobSourceKind
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

export interface SourceDiagnostics {
  issue?: string
  provider: string
  rowsCandidate: number
  rowsDeduped: number
  rowsExcluded: number
  rowsImported: number
  rowsSeen: number
  rowsStale: number
  sourceKey: string
  sourceKind: JobSourceKind
  sourceName: string
}

export interface JobDeduplicationFingerprint {
  canonicalCompanyKey: string
  canonicalTitleKey: string
  canonicalLocationKey: string
  duplicateGroupKey: string
  remoteType: RemoteType
}

export interface RankedJobRecord extends NormalizedJobRecord {
  feedbackReasons?: string[]
  feedbackScoreDelta?: number
  feedbackSummary?: string
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
  personalizedScore?: number
  totalScore: number
  workflowStatus: WorkflowStatus
}

export interface QualifiedJobRecord extends RankedJobRecord {
  applicationFriction: QualificationDimension
  compensationSignal: QualificationDimension
  daysSincePosted?: number
  eligibility: QualificationDimension
  freshness: QualificationDimension
  marketFit: QualificationDimension
  portfolioFitSignal: QualificationDimension
  queueReason: string
  queueScore: number
  queueSegment: QueueSegment
  roleFit: QualificationDimension
  stale: boolean
  strongReasons: string[]
  weakReasons: string[]
}
