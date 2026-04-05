import 'server-only'

import { cache } from 'react'

import { getActiveOperatorContext } from '@/lib/data/operators'
import { getOperatorProfile } from '@/lib/data/operator-profile'
import { jobReviewSummaryStatuses } from '@/lib/domain/types'
import { hasSupabaseServerEnv } from '@/lib/env'
import type { QualifiedJobRecord, RankedJobRecord } from '@/lib/jobs/contracts'
import { getDashboardQueues } from '@/lib/jobs/dashboard-queue'
import { applyWorkflowLearning } from '@/lib/jobs/learning'
import { applyQualificationEngine } from '@/lib/jobs/qualification'
import { ensurePrimaryImportedJobs } from '@/lib/jobs/real-feed'
import { buildRemoteSourceJobUrl } from '@/lib/jobs/remote-source'
import { normalizeStoredSalaryPeriod } from '@/lib/jobs/source-parsing'
import {
  isImportedSourceName,
  saveSourceQueueCoverage,
  summarizeSourceDiagnostics,
} from '@/lib/jobs/source-registry'
import { createClient } from '@/lib/supabase/server'

type JobsSource = 'seed' | 'database' | 'database-fallback'

export interface RankedJobsResult {
  candidatePoolCount: number
  issue?: string
  jobs: QualifiedJobRecord[]
  screeningLocked?: boolean
  source: JobsSource
}

function hasRankingSourceMaterial(workspace: Awaited<ReturnType<typeof getOperatorProfile>>['workspace']) {
  return workspace.status.rankingEligibilityState === 'ready'
}

function applyScreeningLock(
  jobs: QualifiedJobRecord[],
  workspace: Awaited<ReturnType<typeof getOperatorProfile>>['workspace'],
) {
  if (hasRankingSourceMaterial(workspace)) {
    return {
      jobs,
      screeningLocked: false,
    }
  }

  return {
    jobs: jobs.filter((job) => job.workflowStatus !== 'new' && job.workflowStatus !== 'ranked'),
    screeningLocked: true,
  }
}

const seededJobs: RankedJobRecord[] = [
  {
    id: '66666666-6666-4666-8666-666666666666',
    jobScoreId: 'aaaa1111-1111-4111-8111-111111111111',
    sourceName: 'Remote Design Board',
    sourceJobId: 'arc-foundry-senior-brand-designer',
    sourceUrl: 'https://jobs.example.com/arc-foundry-senior-brand-designer',
    applicationUrl: 'https://careers.example.com/arc-foundry/senior-brand-designer',
    companyName: 'Arc & Foundry',
    companyDomain: 'arcandfoundry.example.com',
    title: 'Senior Brand Designer',
    department: 'Brand',
    employmentType: 'full_time',
    locationLabel: 'Remote (Canada / United States)',
    remoteType: 'remote',
    remoteRegions: ['Canada', 'United States'],
    salaryCurrency: 'USD',
    salaryMin: 145000,
    salaryMax: 165000,
    salaryPeriod: 'annual',
    postedAt: '2026-03-28T14:00:00.000Z',
    descriptionText:
      'Lead brand system work across launches, web, lifecycle, and executive storytelling for a remote product company with a strong design culture.',
    requirements: [
      '7+ years in brand, visual, or marketing design',
      'Strong portfolio of identity systems and campaign work',
      'Comfort partnering with marketing and executive stakeholders',
    ],
    preferredQualifications: [
      'Experience in SaaS or high-growth technology',
      'Presentation design experience for leadership teams',
    ],
    skillsKeywords: [
      'brand design',
      'visual systems',
      'campaign design',
      'presentation design',
      'art direction',
    ],
    seniorityLabel: 'Senior',
    portfolioRequired: 'yes',
    workAuthNotes: 'Open to candidates based in Canada or the United States.',
    duplicateGroupKey: 'arc-foundry-senior-brand-designer-2026-03',
    listingStatus: 'active',
    redFlagNotes: [],
    fitReasons: [
      'Direct brand-system overlap with the current operator profile',
      'Remote region matches the seeded operator geography',
      'Salary band lands above the target floor',
    ],
    effortScore: 4,
    fitSummary:
      'High-quality remote brand role with direct alignment to presentation and campaign strengths.',
    missingRequirements: ['No explicit packaging or environmental branding examples listed yet'],
    penaltyScore: 2,
    portfolioFitScore: 4.5,
    qualityScore: 33,
    recommendationLevel: 'strong_apply',
    redFlags: [],
    remoteGatePassed: true,
    roleRelevanceScore: 18.5,
    salaryScore: 24,
    scamRiskLevel: 'low',
    scoredAt: '2026-04-01T10:30:00.000Z',
    seniorityScore: 9.5,
    totalScore: 89,
    workflowStatus: 'shortlisted',
    aiSummaryStatus: 'not_started',
  },
  {
    id: '77777777-7777-4777-8777-777777777777',
    jobScoreId: 'bbbb2222-2222-4222-8222-222222222222',
    sourceName: 'Company Careers',
    sourceJobId: 'northline-presentation-designer',
    sourceUrl: 'https://careers.example.com/northline/presentation-designer',
    applicationUrl: 'https://careers.example.com/northline/presentation-designer/apply',
    companyName: 'Northline Capital',
    companyDomain: 'northlinecapital.example.com',
    title: 'Presentation Designer',
    department: 'Marketing',
    employmentType: 'full_time',
    locationLabel: 'Remote (North America)',
    remoteType: 'remote',
    remoteRegions: ['Canada', 'United States'],
    salaryCurrency: 'USD',
    salaryMin: 112000,
    salaryMax: 132000,
    salaryPeriod: 'annual',
    postedAt: '2026-03-30T16:00:00.000Z',
    descriptionText:
      'Own executive and client-facing presentation design across fundraising, sales enablement, and high-stakes internal communication.',
    requirements: [
      'Strong presentation design portfolio',
      'Advanced typography and information hierarchy',
      'Experience collaborating with senior stakeholders',
    ],
    preferredQualifications: [
      'Financial services or consulting storytelling experience',
      'Ability to translate complex ideas into clear slides',
    ],
    skillsKeywords: [
      'presentation design',
      'storytelling',
      'editorial systems',
      'information hierarchy',
    ],
    seniorityLabel: 'Mid-Senior',
    portfolioRequired: 'yes',
    workAuthNotes: 'Must be located in North America.',
    duplicateGroupKey: 'northline-presentation-designer-2026-03',
    listingStatus: 'active',
    redFlagNotes: [],
    fitReasons: [
      'Direct overlap with one of the strongest portfolio categories in the seeded workspace',
      'Clear executive storytelling need fits the application-prep emphasis',
      'Healthy compensation for a specialized design role',
    ],
    effortScore: 4,
    fitSummary:
      'Specialized remote presentation role with strong portfolio alignment and clean application signal.',
    missingRequirements: ['No clear finance-sector case study in the current portfolio'],
    penaltyScore: 3,
    portfolioFitScore: 4.8,
    qualityScore: 31,
    recommendationLevel: 'strong_apply',
    redFlags: [],
    remoteGatePassed: true,
    roleRelevanceScore: 17.5,
    salaryScore: 20,
    scamRiskLevel: 'low',
    scoredAt: '2026-04-01T10:30:00.000Z',
    seniorityScore: 9,
    totalScore: 84.3,
    workflowStatus: 'ranked',
    aiSummaryStatus: 'not_started',
  },
  {
    id: '88888888-8888-4888-8888-888888888888',
    jobScoreId: 'cccc3333-3333-4333-8333-333333333333',
    sourceName: 'Remote Design Board',
    sourceJobId: 'lattice-road-growth-visual-designer',
    sourceUrl: 'https://jobs.example.com/lattice-road-growth-visual-designer',
    applicationUrl: 'https://careers.example.com/lattice-road/growth-visual-designer',
    companyName: 'Lattice Road',
    companyDomain: 'latticeroad.example.com',
    title: 'Visual Designer, Growth',
    department: 'Growth Marketing',
    employmentType: 'full_time',
    locationLabel: 'Remote (Canada)',
    remoteType: 'remote',
    remoteRegions: ['Canada'],
    salaryCurrency: 'USD',
    salaryMin: 98000,
    salaryMax: 118000,
    salaryPeriod: 'annual',
    postedAt: '2026-03-26T13:30:00.000Z',
    descriptionText:
      'Create campaign visuals, paid social creative, and landing page design for an ambitious growth team shipping quickly.',
    requirements: [
      'Performance marketing design experience',
      'Fast iteration across static and motion assets',
      'Comfort using experiment results to inform creative direction',
    ],
    preferredQualifications: [
      'Experience in early-stage B2B SaaS',
      'Basic motion or lightweight video editing',
    ],
    skillsKeywords: ['growth design', 'campaign design', 'landing pages', 'paid social'],
    seniorityLabel: 'Mid-Senior',
    portfolioRequired: 'yes',
    workAuthNotes: 'Canada-based candidates preferred.',
    duplicateGroupKey: 'lattice-road-growth-visual-designer-2026-03',
    listingStatus: 'active',
    redFlagNotes: ['Fast-turnaround growth role may create heavier weekly volume'],
    fitReasons: [
      'Campaign and launch work overlap is real',
      'Remote region and salary floor still pass',
      'Adjacent growth emphasis could diversify the opportunity set',
    ],
    effortScore: 3.5,
    fitSummary:
      'Credible adjacent fit with stronger campaign overlap than product overlap, but slightly more execution-heavy than the top roles.',
    missingRequirements: ['No dedicated motion samples yet', 'Less explicit growth experimentation proof'],
    penaltyScore: 6,
    portfolioFitScore: 3.8,
    qualityScore: 26,
    recommendationLevel: 'apply_if_interested',
    redFlags: ['Creative volume may be high relative to team size'],
    remoteGatePassed: true,
    roleRelevanceScore: 15.5,
    salaryScore: 16,
    scamRiskLevel: 'low',
    scoredAt: '2026-04-01T10:30:00.000Z',
    seniorityScore: 8.5,
    totalScore: 73.8,
    workflowStatus: 'new',
    aiSummaryStatus: 'not_started',
  },
  {
    id: '99999999-9999-4999-8999-999999999999',
    jobScoreId: 'dddd4444-4444-4444-8444-444444444444',
    sourceName: 'Company Careers',
    sourceJobId: 'tidal-health-creative-lead',
    sourceUrl: 'https://careers.example.com/tidal-health/creative-lead',
    applicationUrl: 'https://careers.example.com/tidal-health/creative-lead/apply',
    companyName: 'Tidal Health',
    companyDomain: 'tidalhealth.example.com',
    title: 'Creative Lead',
    department: 'Brand Marketing',
    employmentType: 'full_time',
    locationLabel: 'Remote (United States / Canada)',
    remoteType: 'remote',
    remoteRegions: ['Canada', 'United States'],
    salaryCurrency: 'USD',
    salaryMin: 155000,
    salaryMax: 180000,
    salaryPeriod: 'annual',
    postedAt: '2026-03-24T12:15:00.000Z',
    descriptionText:
      'Guide brand and campaign creative across a remote healthcare team while mentoring designers and partnering with marketing leadership.',
    requirements: [
      'Leadership experience for brand and campaign work',
      'Strong portfolio with team direction examples',
      'Comfort in regulated or trust-sensitive industries',
    ],
    preferredQualifications: [
      'Healthcare, education, or mission-driven brand experience',
      'Experience presenting to executive stakeholders',
    ],
    skillsKeywords: ['creative leadership', 'brand systems', 'campaign direction', 'team mentorship'],
    seniorityLabel: 'Lead',
    portfolioRequired: 'yes',
    workAuthNotes: 'North America only.',
    duplicateGroupKey: 'tidal-health-creative-lead-2026-03',
    listingStatus: 'active',
    redFlagNotes: ['Leadership expectation is slightly above current seeded seniority label'],
    fitReasons: [
      'Salary and quality are excellent',
      'Portfolio direction is credible for brand and campaign leadership',
      'Mission-driven industry preference is a plus',
    ],
    effortScore: 3,
    fitSummary:
      'High-upside adjacent leadership role that could be worth pursuing if the operator wants to stretch into lead-level scope.',
    missingRequirements: ['Team management examples should be made more explicit'],
    penaltyScore: 7,
    portfolioFitScore: 4,
    qualityScore: 30,
    recommendationLevel: 'consider_carefully',
    redFlags: ['Lead-level management expectations may require stronger people-lead proof'],
    remoteGatePassed: true,
    roleRelevanceScore: 13.5,
    salaryScore: 25,
    scamRiskLevel: 'low',
    scoredAt: '2026-04-01T10:30:00.000Z',
    seniorityScore: 6,
    totalScore: 71.5,
    workflowStatus: 'ranked',
    aiSummaryStatus: 'not_started',
  },
]

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown) {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function asOptionalNumber(value: unknown) {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

function dedupeRankedJobs(jobs: RankedJobRecord[]) {
  const seenKeys = new Set<string>()

  return jobs.filter((job) => {
    const dedupeKey = job.duplicateGroupKey || job.sourceUrl

    if (!dedupeKey || !isImportedSourceName(job.sourceName)) {
      return true
    }

    if (seenKeys.has(dedupeKey)) {
      return false
    }

    seenKeys.add(dedupeKey)
    return true
  })
}

function normalizeRankedJob(value: unknown): RankedJobRecord | null {
  const score = asRecord(value)
  const job = asRecord(score?.jobs)

  if (!score || !job) {
    return null
  }

  const sourceName = asString(job.source_name)
  const sourceJobId = asString(job.source_job_id) || undefined
  const sourceUrl =
    sourceName === 'Remote Source'
      ? buildRemoteSourceJobUrl({
          sourceJobId,
          sourceUrl: asString(job.source_url),
        })
      : asString(job.source_url)

  return {
    aiDescriptionExcerpt: asString(score.ai_description_excerpt) || undefined,
    aiMatchSummary: asString(score.ai_match_summary) || undefined,
    aiSummaryError: asString(score.ai_summary_error) || undefined,
    aiSummaryGeneratedAt: asString(score.ai_summary_generated_at) || undefined,
    aiSummaryModel: asString(score.ai_summary_model) || undefined,
    aiSummaryStatus: jobReviewSummaryStatuses.includes(
      asString(score.ai_summary_status) as (typeof jobReviewSummaryStatuses)[number],
    )
      ? (asString(score.ai_summary_status) as RankedJobRecord['aiSummaryStatus'])
      : 'not_started',
    id: asString(job.id),
    jobScoreId: asString(score.id),
    sourceName,
    sourceJobId,
    sourceUrl,
    applicationUrl: asString(job.application_url) || undefined,
    companyName: asString(job.company_name),
    companyDomain: asString(job.company_domain) || undefined,
    title: asString(job.title),
    department: asString(job.department) || undefined,
    employmentType: asString(job.employment_type) as RankedJobRecord['employmentType'],
    locationLabel: asString(job.location_label) || undefined,
    remoteType: asString(job.remote_type) as RankedJobRecord['remoteType'],
    remoteRegions: asStringArray(job.remote_regions),
    salaryCurrency: asString(job.salary_currency) || undefined,
    salaryMin: asOptionalNumber(job.salary_min),
    salaryMax: asOptionalNumber(job.salary_max),
    salaryPeriod: normalizeStoredSalaryPeriod({
      descriptionText: asString(job.description_text),
      salaryMax: asOptionalNumber(job.salary_max),
      salaryMin: asOptionalNumber(job.salary_min),
      storedPeriod: asString(job.salary_period),
    }),
    postedAt: asString(job.posted_at) || undefined,
    descriptionText: asString(job.description_text),
    requirements: asStringArray(job.requirements),
    preferredQualifications: asStringArray(job.preferred_qualifications),
    skillsKeywords: asStringArray(job.skills_keywords),
    seniorityLabel: asString(job.seniority_label) || undefined,
    portfolioRequired: asString(job.portfolio_required) as RankedJobRecord['portfolioRequired'],
    workAuthNotes: asString(job.work_auth_notes) || undefined,
    duplicateGroupKey: asString(job.duplicate_group_key) || undefined,
    listingStatus: asString(job.listing_status) as RankedJobRecord['listingStatus'],
    redFlagNotes: asStringArray(job.red_flag_notes),
    fitReasons: asStringArray(score.fit_reasons),
    fitSummary: asString(score.fit_summary),
    effortScore: asNumber(score.effort_score),
    missingRequirements: asStringArray(score.missing_requirements),
    penaltyScore: asNumber(score.penalty_score),
    portfolioFitScore: asNumber(score.portfolio_fit_score),
    qualityScore: asNumber(score.quality_score),
    recommendationLevel: asString(score.recommendation_level) as RankedJobRecord['recommendationLevel'],
    redFlags: asStringArray(score.red_flags),
    remoteGatePassed: asBoolean(score.remote_gate_passed),
    roleRelevanceScore: asNumber(score.role_relevance_score),
    salaryScore: asNumber(score.salary_score),
    scamRiskLevel: asString(score.scam_risk_level) as RankedJobRecord['scamRiskLevel'],
    scoredAt: asString(score.scored_at) || undefined,
    seniorityScore: asNumber(score.seniority_score),
    totalScore: asNumber(score.total_score),
    workflowStatus: asString(score.workflow_status) as RankedJobRecord['workflowStatus'],
  }
}

export const getRankedJobs = cache(async function getRankedJobs(): Promise<RankedJobsResult> {
  const { workspace } = await getOperatorProfile()

  if (!hasSupabaseServerEnv()) {
    const learnedJobs = await applyWorkflowLearning(seededJobs)
    const qualificationResult = applyScreeningLock(
      applyQualificationEngine(dedupeRankedJobs(learnedJobs), workspace.profile),
      workspace,
    )

    return {
      candidatePoolCount: learnedJobs.length,
      issue:
        'Supabase server environment variables are not configured yet, so the jobs dashboard is showing seeded fallback listings.',
      jobs: qualificationResult.jobs,
      screeningLocked: qualificationResult.screeningLocked,
      source: 'seed',
    }
  }

  const operatorContext = await getActiveOperatorContext()

  if (!operatorContext) {
    const learnedJobs = await applyWorkflowLearning(seededJobs)
    const qualificationResult = applyScreeningLock(
      applyQualificationEngine(dedupeRankedJobs(learnedJobs), workspace.profile),
      workspace,
    )

    return {
      candidatePoolCount: learnedJobs.length,
      issue: 'Choose an operator before loading the ranked jobs queue.',
      jobs: qualificationResult.jobs,
      screeningLocked: qualificationResult.screeningLocked,
      source: 'database-fallback',
    }
  }

  const importResult = await ensurePrimaryImportedJobs()
  const supabase = createClient()
  const { data, error } = await supabase
    .from('job_scores')
    .select(
      `
        id,
        total_score,
        quality_score,
        salary_score,
        role_relevance_score,
        seniority_score,
        portfolio_fit_score,
        effort_score,
        penalty_score,
        remote_gate_passed,
        recommendation_level,
        workflow_status,
        ai_match_summary,
        ai_description_excerpt,
        ai_summary_status,
        ai_summary_model,
        ai_summary_generated_at,
        ai_summary_error,
        fit_summary,
        fit_reasons,
        missing_requirements,
        red_flags,
        scam_risk_level,
        scored_at,
        jobs!inner (
          id,
          source_name,
          source_job_id,
          source_url,
          application_url,
          company_name,
          company_domain,
          title,
          department,
          employment_type,
          location_label,
          remote_type,
          remote_regions,
          salary_currency,
          salary_min,
          salary_max,
          salary_period,
          posted_at,
          description_text,
          requirements,
          preferred_qualifications,
          skills_keywords,
          seniority_label,
          portfolio_required,
          work_auth_notes,
          duplicate_group_key,
          listing_status,
          red_flag_notes
        )
      `,
    )
    .eq('operator_id', operatorContext.operator.id)
    .eq('remote_gate_passed', true)
    .neq('jobs.listing_status', 'stale')
    .order('total_score', { ascending: false })

  if (error || !data || data.length === 0) {
    const learnedJobs = await applyWorkflowLearning(seededJobs, operatorContext.operator.id)
    const qualificationResult = applyScreeningLock(
      applyQualificationEngine(dedupeRankedJobs(learnedJobs), workspace.profile),
      workspace,
    )

    return {
      candidatePoolCount: learnedJobs.length,
      issue:
        importResult.issue ??
        'No persisted job scores were found yet, so the dashboard is using the seeded ranked-job fallback set.',
      jobs: qualificationResult.jobs,
      screeningLocked: qualificationResult.screeningLocked,
      source: 'database-fallback',
    }
  }

  const jobs = dedupeRankedJobs(
    data
    .map((item) => normalizeRankedJob(item))
    .filter((item): item is RankedJobRecord => item !== null),
  )

  if (jobs.length === 0) {
    const learnedJobs = await applyWorkflowLearning(seededJobs, operatorContext.operator.id)
    const qualificationResult = applyScreeningLock(
      applyQualificationEngine(dedupeRankedJobs(learnedJobs), workspace.profile),
      workspace,
    )

    return {
      candidatePoolCount: learnedJobs.length,
      issue:
        importResult.issue ??
        'Job scores were loaded, but the joined job records were incomplete. The dashboard is falling back to the seeded ranked set.',
      jobs: qualificationResult.jobs,
      screeningLocked: qualificationResult.screeningLocked,
      source: 'database-fallback',
    }
  }

  const importedJobs = jobs.filter((job) => isImportedSourceName(job.sourceName))

  if (importedJobs.length > 0) {
    const learnedJobs = await applyWorkflowLearning(importedJobs, operatorContext.operator.id)
    const qualificationResult = applyScreeningLock(
      applyQualificationEngine(dedupeRankedJobs(learnedJobs), workspace.profile),
      workspace,
    )
    const qualifiedJobs = qualificationResult.jobs
    const queues = getDashboardQueues(qualifiedJobs)
    const qualifiedCounts = new Map<string, number>()
    const visibleCounts = new Map<string, number>()

    for (const job of qualifiedJobs.filter((item) => item.queueSegment !== 'hidden')) {
      qualifiedCounts.set(job.sourceName, (qualifiedCounts.get(job.sourceName) ?? 0) + 1)
    }

    for (const job of queues.potentialJobs) {
      visibleCounts.set(job.sourceName, (visibleCounts.get(job.sourceName) ?? 0) + 1)
    }

    await saveSourceQueueCoverage(qualifiedCounts, visibleCounts)
    const diagnosticsSummary = summarizeSourceDiagnostics(importResult.sourceDiagnostics ?? [])

    return {
      candidatePoolCount: learnedJobs.length,
      issue:
        qualificationResult.screeningLocked
          ? 'Complete your profile draft in Settings to unlock the Potential queue.'
          : importResult.importedCount > 0
            ? `Imported ${importResult.importedCount} jobs into the primary ranked feed.${diagnosticsSummary ? ` ${diagnosticsSummary}.` : ''}`
            : undefined,
      jobs: qualifiedJobs,
      screeningLocked: qualificationResult.screeningLocked,
      source: 'database',
    }
  }

  const learnedJobs = await applyWorkflowLearning(jobs, operatorContext.operator.id)
  const qualificationResult = applyScreeningLock(
    applyQualificationEngine(dedupeRankedJobs(learnedJobs), workspace.profile),
    workspace,
  )

  return {
    candidatePoolCount: learnedJobs.length,
    issue:
      importResult.issue ??
      'Imported-source jobs are not available yet, so the database-backed feed is still showing the existing seeded demo records.',
    jobs: qualificationResult.jobs,
    screeningLocked: qualificationResult.screeningLocked,
    source: 'database-fallback',
  }
})

export async function getRankedJob(jobId: string) {
  const { issue, jobs, source } = await getRankedJobs()

  return {
    issue,
    job: jobs.find((job) => job.id === jobId),
    source,
  }
}
