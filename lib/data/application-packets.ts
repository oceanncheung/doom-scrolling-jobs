import 'server-only'

import { defaultOperator } from '@/lib/config/runtime'
import { hasSupabaseServerEnv } from '@/lib/env'
import type {
  ApplicationAnswerRecord,
  ApplicationPacketRecord,
  OperatorPortfolioItemRecord,
  OperatorWorkspaceRecord,
  PacketCaseStudyRecord,
  PacketPortfolioRecommendationRecord,
  PacketStatus,
  ResumeExperienceRecord,
  ResumeVersionPacketRecord,
} from '@/lib/domain/types'
import type { QualifiedJobRecord, RankedJobRecord } from '@/lib/jobs/contracts'
import { createClient } from '@/lib/supabase/server'

import { getRankedJob } from './jobs'
import { getOperatorProfile } from './operator-profile'

type PacketSource = 'seed' | 'database' | 'database-fallback'

export interface ApplicationPacketReviewResult {
  canSave: boolean
  issue?: string
  job?: QualifiedJobRecord
  packet?: ApplicationPacketRecord
  source: PacketSource
  workspace: OperatorWorkspaceRecord
}

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

  if (typeof value === 'string' && value.trim().length > 0) {
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

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function getWordSet(values: string[]) {
  return new Set(
    values
      .flatMap((value) => normalizeToken(value).split(/\s+/))
      .filter((value) => value.length > 1),
  )
}

function countOverlap(left: string[], right: string[]) {
  const rightWords = getWordSet(right)

  return left.reduce((count, value) => {
    const words = normalizeToken(value).split(/\s+/)
    return count + (words.some((word) => rightWords.has(word)) ? 1 : 0)
  }, 0)
}

function rankExperienceEntry(entry: ResumeExperienceRecord, job: RankedJobRecord) {
  return (
    countOverlap(
      [entry.roleTitle, entry.summary, ...entry.highlights],
      [job.title, job.department ?? '', ...job.skillsKeywords, ...job.requirements],
    ) + (entry.locationLabel.toLowerCase().includes('remote') ? 1 : 0)
  )
}

function selectExperienceEntries(workspace: OperatorWorkspaceRecord, job: RankedJobRecord) {
  return [...workspace.resumeMaster.experienceEntries]
    .sort((left, right) => rankExperienceEntry(right, job) - rankExperienceEntry(left, job))
    .slice(0, 2)
}

function rankPortfolioItem(item: OperatorPortfolioItemRecord, job: RankedJobRecord) {
  return (
    countOverlap(
      [item.title, item.projectType, item.roleLabel, item.summary, ...item.skillsTags, ...item.industryTags],
      [job.title, job.department ?? '', ...job.skillsKeywords, ...job.requirements],
    ) +
    (item.isPrimary ? 2 : 0) +
    asNumber(item.visualStrengthRating)
  )
}

function selectCaseStudies(workspace: OperatorWorkspaceRecord, job: RankedJobRecord): PacketCaseStudyRecord[] {
  return workspace.portfolioItems
    .filter((item) => item.isActive)
    .sort((left, right) => rankPortfolioItem(right, job) - rankPortfolioItem(left, job))
    .slice(0, 3)
    .map((item, index) => ({
      displayOrder: index + 1,
      portfolioItemId: item.id,
      reason:
        index === 0
          ? `Best overlap with ${job.title} based on ${item.projectType} and portfolio signal.`
          : `Supports the packet with adjacent proof in ${item.projectType}.`,
      title: item.title,
      url: item.url,
    }))
}

function selectSkills(workspace: OperatorWorkspaceRecord, job: RankedJobRecord) {
  const preferredSkills = [
    ...workspace.resumeMaster.skillsSection,
    ...workspace.profile.skills,
    ...job.skillsKeywords,
  ]

  const ranked = preferredSkills
    .map((skill) => ({
      score: countOverlap([skill], [job.title, ...job.skillsKeywords, ...job.requirements]),
      skill,
    }))
    .sort((left, right) => right.score - left.score)
    .map((item) => item.skill)

  return Array.from(new Set(ranked)).slice(0, 6)
}

function describeJobSkillFocus(job: RankedJobRecord, count = 3) {
  return job.skillsKeywords.length > 0
    ? job.skillsKeywords.slice(0, count).join(', ')
    : 'thoughtful brand, presentation, and campaign work'
}

function buildPortfolioRecommendation(
  workspace: OperatorWorkspaceRecord,
  caseStudies: PacketCaseStudyRecord[],
): PacketPortfolioRecommendationRecord {
  const primaryItem =
    workspace.portfolioItems.find((item) => item.url === workspace.profile.portfolioPrimaryUrl) ??
    workspace.portfolioItems.find((item) => item.isPrimary && item.isActive) ??
    workspace.portfolioItems.find((item) => item.isActive)

  return {
    primaryLabel: primaryItem?.title ?? 'Primary portfolio',
    primaryUrl: primaryItem?.url ?? workspace.profile.portfolioPrimaryUrl,
    rationale:
      caseStudies.length > 1
        ? `Lead with ${caseStudies[0].title}, then support it with ${caseStudies
            .slice(1)
            .map((item) => item.title)
            .join(' and ')} to show both range and direct fit.`
        : caseStudies.length === 1
          ? `Lead with ${caseStudies[0].title} because it provides the clearest direct-fit proof for this role.`
        : 'Lead with the strongest primary portfolio link until role-specific case studies are refined.',
  }
}

function buildProfessionalSummary(
  workspace: OperatorWorkspaceRecord,
  job: RankedJobRecord,
  selectedSkills: string[],
) {
  const highlightedSkills =
    selectedSkills.length > 0 ? selectedSkills.slice(0, 3).join(', ') : 'brand, presentation, and campaign work'
  const fitReason =
    job.fitReasons.length > 0
      ? job.fitReasons.slice(0, 2).join(' and ')
      : 'the direct overlap between the role requirements and the current profile'

  return `${workspace.profile.headline} with strong overlap in ${highlightedSkills}, positioned for ${job.companyName}'s ${job.title} opening. The strongest fit comes from ${fitReason}, with remote eligibility already aligned to the role.`
}

function buildCoverLetterDraft(
  workspace: OperatorWorkspaceRecord,
  job: RankedJobRecord,
  caseStudies: PacketCaseStudyRecord[],
) {
  const leadCaseStudy = caseStudies[0]?.title ?? 'my portfolio work'
  const highlightedSkills = describeJobSkillFocus(job)

  return `Dear ${job.companyName} team,

I am excited to apply for the ${job.title} role. My background in ${workspace.profile.headline.toLowerCase()} work has consistently focused on thoughtful brand, presentation, and campaign execution for distributed teams, which is why this role stands out immediately.

Most recently, I have led work that aligns closely with what you are asking for, especially in areas like ${highlightedSkills}. I would lead with ${leadCaseStudy} in this application because it shows the kind of high-clarity, high-craft execution that this role seems to value.

What draws me most is the chance to contribute strong visual thinking without losing strategic context. I would be glad to bring that combination of craft, storytelling, and cross-functional collaboration to ${job.companyName}.

Thank you for your time and consideration.`
}

function buildAnswers(
  workspace: OperatorWorkspaceRecord,
  job: RankedJobRecord,
  caseStudies: PacketCaseStudyRecord[],
): ApplicationAnswerRecord[] {
  const leadCaseStudy = caseStudies[0]
  const relevantExperience = workspace.resumeMaster.experienceEntries[0]
  const highlightedSkills = describeJobSkillFocus(job)

  return [
    {
      id: `seed-answer-${job.id}-interest`,
      answerText: `I am interested in this role because it sits directly at the intersection of ${highlightedSkills} work, which matches the kind of design problems I want to keep solving. ${job.companyName}'s ${job.title} role also looks like a strong fit for how I like to work: high-quality output, thoughtful collaboration, and a clear need for visual storytelling.`,
      answerVariantShort: `Direct fit across ${describeJobSkillFocus(job, 2)} with strong motivation for the role's craft and collaboration mix.`,
      fieldType: 'textarea',
      questionKey: 'why_this_role',
      questionText: 'Why are you interested in this role?',
      reviewStatus: 'draft',
    },
    {
      id: `seed-answer-${job.id}-relevant-work`,
      answerText: `My most relevant recent work comes from ${relevantExperience?.companyName ?? 'recent portfolio projects'}, where I focused on ${relevantExperience?.summary.toLowerCase() ?? 'brand and campaign design work'}. I would pair that experience with ${leadCaseStudy?.title ?? 'my strongest case study'} to show both the strategic context and the finished execution.`,
      answerVariantShort: `Recent brand and campaign work paired with ${leadCaseStudy?.title ?? 'a strong case study'} is the clearest fit proof.`,
      fieldType: 'textarea',
      questionKey: 'relevant_work',
      questionText: 'Tell us about the work most relevant to this role.',
      reviewStatus: 'draft',
    },
    {
      id: `seed-answer-${job.id}-portfolio`,
      answerText: leadCaseStudy?.url ?? workspace.profile.portfolioPrimaryUrl,
      answerVariantShort: leadCaseStudy?.url ?? workspace.profile.portfolioPrimaryUrl,
      fieldType: 'portfolio_field',
      questionKey: 'portfolio_link',
      questionText: 'What portfolio link should be used for this application?',
      reviewStatus: 'draft',
    },
    {
      id: `seed-answer-${job.id}-work-auth`,
      answerText: workspace.profile.workAuthorizationNotes,
      answerVariantShort: workspace.profile.workAuthorizationNotes,
      fieldType: 'short_answer',
      questionKey: 'work_authorization',
      questionText: 'What should we say for work authorization or remote eligibility?',
      reviewStatus: 'draft',
    },
  ]
}

function buildChecklist(job: RankedJobRecord, caseStudies: PacketCaseStudyRecord[]) {
  return [
    'Review the source listing once more before applying to confirm scope, salary, and location still match.',
    'Export the tailored resume after the summary, skills, and requirements emphasis are final.',
    `Lead with ${caseStudies[0]?.title ?? 'the primary portfolio link'} in the portfolio field.`,
    'Trim the cover letter tone to better match the company voice before submission.',
    'Paste the prepared short answers into the ATS and then update the dashboard workflow manually.',
    ...job.missingRequirements.slice(0, 2).map((item) => `Address this gap before submitting: ${item}`),
  ]
}

function buildGeneratedResumeVersion(
  workspace: OperatorWorkspaceRecord,
  job: RankedJobRecord,
  experienceEntries: ResumeExperienceRecord[],
  selectedSkills: string[],
): ResumeVersionPacketRecord {
  const highlightedSkills = describeJobSkillFocus(job)

  return {
    id: `seed-resume-${job.id}`,
    exportStatus: 'draft',
    experienceEntries,
    highlightedRequirements: job.requirements.slice(0, 4),
    skillsSection: selectedSkills,
    summaryText: `${workspace.resumeMaster.summaryText} Best aligned here for ${job.title} work that emphasizes ${highlightedSkills}.`,
    tailoringNotes: `Prioritize ${experienceEntries
      .map((entry) => `${entry.companyName} (${entry.roleTitle})`)
      .join(' and ')} because those entries best support this role's required mix of ${highlightedSkills}.`,
    versionLabel: `${job.companyName} packet resume`,
  }
}

function buildGeneratedPacket(
  workspace: OperatorWorkspaceRecord,
  job: RankedJobRecord,
): ApplicationPacketRecord {
  const experienceEntries = selectExperienceEntries(workspace, job)
  const caseStudySelection = selectCaseStudies(workspace, job)
  const selectedSkills = selectSkills(workspace, job)
  const portfolioRecommendation = buildPortfolioRecommendation(workspace, caseStudySelection)

  return {
    answers: buildAnswers(workspace, job, caseStudySelection),
    caseStudySelection,
    checklistItems: buildChecklist(job, caseStudySelection),
    coverLetterDraft: buildCoverLetterDraft(workspace, job, caseStudySelection),
    generatedAt: job.scoredAt,
    id: `seed-packet-${job.id}`,
    jobId: job.id,
    jobScoreId: job.jobScoreId,
    manualNotes: '',
    packetStatus: 'draft',
    portfolioRecommendation,
    professionalSummary: buildProfessionalSummary(workspace, job, selectedSkills),
    resumeVersion: buildGeneratedResumeVersion(workspace, job, experienceEntries, selectedSkills),
  }
}

function normalizeExperienceEntry(value: unknown): ResumeExperienceRecord {
  const record = asRecord(value)

  return {
    companyName: asString(record?.companyName ?? record?.company_name),
    endDate: asString(record?.endDate ?? record?.end_date),
    highlights: asStringArray(record?.highlights),
    locationLabel: asString(record?.locationLabel ?? record?.location_label),
    roleTitle: asString(record?.roleTitle ?? record?.role_title),
    startDate: asString(record?.startDate ?? record?.start_date),
    summary: asString(record?.summary),
  }
}

function normalizeResumeVersion(
  value: unknown,
  fallback: ResumeVersionPacketRecord,
): ResumeVersionPacketRecord {
  const record = asRecord(value)

  if (!record) {
    return fallback
  }

  return {
    id: asString(record.id) || fallback.id,
    exportStatus: (asString(record.export_status) || fallback.exportStatus) as ResumeVersionPacketRecord['exportStatus'],
    experienceEntries: Array.isArray(record.experience_entries)
      ? (record.experience_entries as unknown[]).map((item) => normalizeExperienceEntry(item))
      : fallback.experienceEntries,
    highlightedRequirements: asStringArray(record.highlighted_requirements).length > 0
      ? asStringArray(record.highlighted_requirements)
      : fallback.highlightedRequirements,
    skillsSection: asStringArray(record.skills_section).length > 0
      ? asStringArray(record.skills_section)
      : fallback.skillsSection,
    summaryText: asString(record.summary_text) || fallback.summaryText,
    tailoringNotes: asString(record.tailoring_notes) || fallback.tailoringNotes,
    versionLabel: asString(record.version_label) || fallback.versionLabel,
  }
}

function normalizePortfolioRecommendation(
  value: unknown,
  fallback: PacketPortfolioRecommendationRecord,
): PacketPortfolioRecommendationRecord {
  const record = asRecord(value)

  if (!record) {
    return fallback
  }

  return {
    primaryLabel: asString(record.primaryLabel ?? record.primary_label) || fallback.primaryLabel,
    primaryUrl: asString(record.primaryUrl ?? record.primary_url) || fallback.primaryUrl,
    rationale: asString(record.rationale) || fallback.rationale,
  }
}

function normalizeCaseStudySelection(
  value: unknown,
  fallback: PacketCaseStudyRecord[],
): PacketCaseStudyRecord[] {
  if (!Array.isArray(value)) {
    return fallback
  }

  const items = value
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item, index) => ({
      displayOrder: asNumber(item.displayOrder ?? item.display_order) || index + 1,
      portfolioItemId: asString(item.portfolioItemId ?? item.portfolio_item_id),
      reason: asString(item.reason),
      title: asString(item.title),
      url: asString(item.url),
    }))
    .filter((item) => item.title.length > 0 || item.url.length > 0)

  return items.length > 0 ? items : fallback
}

function normalizePacketStatus(value: unknown, fallback: PacketStatus): PacketStatus {
  const text = asString(value)

  return text === 'ready' || text === 'applied' || text === 'archived' ? text : fallback
}

function normalizeAnswer(value: unknown): ApplicationAnswerRecord | null {
  const record = asRecord(value)

  if (!record) {
    return null
  }

  const questionKey = asString(record.question_key ?? record.questionKey)
  const questionText = asString(record.question_text ?? record.questionText)

  if (!questionKey && !questionText) {
    return null
  }

  const reviewStatus = asString(record.review_status)

  return {
    id: asString(record.id),
    answerText: asString(record.answer_text ?? record.answerText),
    answerVariantShort: asString(record.answer_variant_short ?? record.answerVariantShort),
    characterLimit: asOptionalNumber(record.character_limit ?? record.characterLimit),
    fieldType: asString(record.field_type ?? record.fieldType) || 'textarea',
    questionKey: questionKey || normalizeToken(questionText).replaceAll(' ', '_'),
    questionText,
    reviewStatus:
      reviewStatus === 'edited' || reviewStatus === 'approved' ? reviewStatus : 'draft',
  }
}

export async function getApplicationPacketReview(
  jobId: string,
): Promise<ApplicationPacketReviewResult> {
  const [{ job, source: jobSource }, { workspace }] = await Promise.all([
    getRankedJob(jobId),
    getOperatorProfile(),
  ])

  if (!job) {
    return {
      canSave: false,
      issue: 'The requested job could not be found.',
      source: 'seed',
      workspace,
    }
  }

  const generatedPacket = buildGeneratedPacket(workspace, job)
  const canSave = hasSupabaseServerEnv() && jobSource === 'database'

  if (!canSave) {
    return {
      canSave: false,
      issue:
        'The packet review screen is available, but saving requires the database-backed ranked jobs feed so the packet can tie back to a real job score row.',
      job,
      packet: generatedPacket,
      source: 'seed',
      workspace,
    }
  }

  const supabase = createClient()
  const { data: packetRow, error: packetError } = await supabase
    .from('application_packets')
    .select(
      `
        id,
        job_id,
        job_score_id,
        resume_version_id,
        packet_status,
        professional_summary,
        cover_letter_draft,
        portfolio_recommendation,
        case_study_selection,
        application_checklist,
        manual_notes,
        generated_at,
        last_reviewed_at
      `,
    )
    .eq('user_id', defaultOperator.userId)
    .eq('job_id', jobId)
    .maybeSingle()

  if (packetError) {
    return {
      canSave: true,
      issue: `${packetError.message} Showing a generated draft packet from the current profile and job data instead.`,
      job,
      packet: generatedPacket,
      source: 'database-fallback',
      workspace,
    }
  }

  if (!packetRow) {
    return {
      canSave: true,
      issue:
        'No saved packet exists for this role yet, so this screen is showing a generated draft assembled from the current workspace and ranked job record.',
      job,
      packet: generatedPacket,
      source: 'database-fallback',
      workspace,
    }
  }

  const [resumeVersionResult, answersResult] = await Promise.all([
    packetRow.resume_version_id
      ? supabase
          .from('resume_versions')
          .select(
            `
              id,
              version_label,
              summary_text,
              experience_entries,
              skills_section,
              highlighted_requirements,
              tailoring_notes,
              export_status
            `,
          )
          .eq('id', packetRow.resume_version_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('application_answers')
      .select(
        `
          id,
          question_key,
          question_text,
          field_type,
          answer_text,
          answer_variant_short,
          character_limit,
          review_status
        `,
      )
      .eq('application_packet_id', packetRow.id)
      .order('created_at', { ascending: true }),
  ])

  const answers =
    answersResult.data
      ?.map((item) => normalizeAnswer(item))
      .filter((item): item is ApplicationAnswerRecord => item !== null) ?? []

  return {
    canSave: true,
    job,
    packet: {
      answers: answers.length > 0 ? answers : generatedPacket.answers,
      caseStudySelection: normalizeCaseStudySelection(
        packetRow.case_study_selection,
        generatedPacket.caseStudySelection,
      ),
      checklistItems:
        asStringArray(packetRow.application_checklist).length > 0
          ? asStringArray(packetRow.application_checklist)
          : generatedPacket.checklistItems,
      coverLetterDraft: asString(packetRow.cover_letter_draft) || generatedPacket.coverLetterDraft,
      generatedAt: asString(packetRow.generated_at) || generatedPacket.generatedAt,
      id: asString(packetRow.id),
      jobId: asString(packetRow.job_id) || generatedPacket.jobId,
      jobScoreId: asString(packetRow.job_score_id) || generatedPacket.jobScoreId,
      lastReviewedAt: asString(packetRow.last_reviewed_at) || undefined,
      manualNotes: asString(packetRow.manual_notes),
      packetStatus: normalizePacketStatus(packetRow.packet_status, generatedPacket.packetStatus),
      portfolioRecommendation: normalizePortfolioRecommendation(
        packetRow.portfolio_recommendation,
        generatedPacket.portfolioRecommendation,
      ),
      professionalSummary: asString(packetRow.professional_summary) || generatedPacket.professionalSummary,
      resumeVersion: normalizeResumeVersion(
        resumeVersionResult.data,
        generatedPacket.resumeVersion,
      ),
    },
    source: 'database',
    workspace,
  }
}
