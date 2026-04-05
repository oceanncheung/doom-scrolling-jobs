import {
  packetQuestionSnapshotStatuses,
  type ApplicationAnswerRecord,
  type ApplicationPacketRecord,
  type OperatorPortfolioItemRecord,
  type OperatorWorkspaceRecord,
  type PacketGenerationStatus,
  type PacketCaseStudyRecord,
  type PacketPortfolioRecommendationRecord,
  type PacketQuestionSnapshotStatus,
  type PacketStatus,
  type ResumeExperienceRecord,
  type ResumeVersionPacketRecord,
} from '@/lib/domain/types'
import type { RankedJobRecord } from '@/lib/jobs/contracts'

export const QUESTION_SNAPSHOT_STALE_WINDOW_MS = 1000 * 60 * 60 * 12

export interface QuestionSnapshotRefreshOptions {
  syncQuestionSnapshot?: boolean
  syncQuestionSnapshotIfStale?: boolean
}

export function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

export function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function cleanLine(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function asNumber(value: unknown) {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

export function asOptionalNumber(value: unknown) {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

export function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

export function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function getWordSet(values: string[]) {
  return new Set(
    values
      .flatMap((value) => normalizeToken(value).split(/\s+/))
      .filter((value) => value.length > 1),
  )
}

export function countOverlap(left: string[], right: string[]) {
  const rightWords = getWordSet(right)

  return left.reduce((count, value) => {
    const words = normalizeToken(value).split(/\s+/)
    return count + (words.some((word) => rightWords.has(word)) ? 1 : 0)
  }, 0)
}

export function rankExperienceEntry(entry: ResumeExperienceRecord, job: RankedJobRecord) {
  return (
    countOverlap(
      [entry.roleTitle, entry.summary, ...entry.highlights],
      [job.title, job.department ?? '', ...job.skillsKeywords, ...job.requirements],
    ) + (entry.locationLabel.toLowerCase().includes('remote') ? 1 : 0)
  )
}

export function selectExperienceEntries(workspace: OperatorWorkspaceRecord, job: RankedJobRecord) {
  return [...workspace.resumeMaster.experienceEntries, ...workspace.resumeMaster.archivedExperienceEntries]
    .sort((left, right) => rankExperienceEntry(right, job) - rankExperienceEntry(left, job))
    .slice(0, 2)
}

export function rankPortfolioItem(item: OperatorPortfolioItemRecord, job: RankedJobRecord) {
  return (
    countOverlap(
      [item.title, item.projectType, item.roleLabel, item.summary, ...item.skillsTags, ...item.industryTags],
      [job.title, job.department ?? '', ...job.skillsKeywords, ...job.requirements],
    ) +
    (item.isPrimary ? 2 : 0) +
    asNumber(item.visualStrengthRating)
  )
}

export function selectCaseStudies(workspace: OperatorWorkspaceRecord, job: RankedJobRecord): PacketCaseStudyRecord[] {
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

export function selectSkills(workspace: OperatorWorkspaceRecord, job: RankedJobRecord) {
  const preferredSkills = [
    ...workspace.resumeMaster.skillsSection,
    ...workspace.resumeMaster.coreExpertise,
    ...workspace.resumeMaster.toolsPlatforms,
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

export function describeJobSkillFocus(job: RankedJobRecord, count = 3) {
  return job.skillsKeywords.length > 0
    ? job.skillsKeywords.slice(0, count).join(', ')
    : 'thoughtful brand, presentation, and campaign work'
}

export function buildPortfolioRecommendation(
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

export function buildProfessionalSummary(
  workspace: OperatorWorkspaceRecord,
  job: RankedJobRecord,
  selectedSkills: string[],
) {
  const highlightedSkills =
    selectedSkills.length > 0
      ? selectedSkills.slice(0, 3).join(', ')
      : workspace.resumeMaster.coreExpertise.slice(0, 3).join(', ') || 'brand, presentation, and campaign work'
  const fitReason =
    job.fitReasons.length > 0
      ? job.fitReasons.slice(0, 2).join(' and ')
      : 'the direct overlap between the role requirements and the current profile'

  return `${workspace.profile.headline} with strong overlap in ${highlightedSkills}, positioned for ${job.companyName}'s ${job.title} opening. The strongest fit comes from ${fitReason}, with remote eligibility already aligned to the role.`
}

export function buildCoverLetterDraft(
  workspace: OperatorWorkspaceRecord,
  job: RankedJobRecord,
  caseStudies: PacketCaseStudyRecord[],
) {
  const leadCaseStudy = caseStudies[0]?.title ?? 'my portfolio work'
  const highlightedSkills = describeJobSkillFocus(job)
  const positioning =
    cleanLine(workspace.coverLetterMaster.positioningPhilosophy) ||
    'I design things that move the business forward, not just things that look right.'
  const proofPoint =
    workspace.coverLetterMaster.proofBank[0]?.bullets[0] ??
    workspace.resumeMaster.selectedImpactHighlights[0] ??
    'led work that translated strategy into polished, market-facing design.'

  return `Dear ${job.companyName} team,

I am excited to apply for the ${job.title} role. ${positioning}

Most recently, I have led work that aligns closely with what you are asking for, especially in areas like ${highlightedSkills}. One relevant proof point is that I ${proofPoint}. I would lead with ${leadCaseStudy} in this application because it shows the kind of high-clarity, high-craft execution that this role seems to value.

What draws me most is the chance to contribute strong visual thinking without losing strategic context. I would be glad to bring that combination of craft, storytelling, and cross-functional collaboration to ${job.companyName}.

Thank you for your time and consideration.`
}

export function buildChecklist(job: RankedJobRecord, caseStudies: PacketCaseStudyRecord[]) {
  return [
    'Review the source listing once more before applying to confirm scope, salary, and location still match.',
    'Export the tailored resume after the summary, skills, and requirements emphasis are final.',
    `Lead with ${caseStudies[0]?.title ?? 'the primary portfolio link'} in the portfolio field.`,
    'Trim the cover letter tone to better match the company voice before submission.',
    'Paste the prepared short answers into the ATS and then update the dashboard workflow manually.',
    ...job.missingRequirements.slice(0, 2).map((item) => `Address this gap before submitting: ${item}`),
  ]
}

export function buildGeneratedResumeVersion(
  workspace: OperatorWorkspaceRecord,
  job: RankedJobRecord,
  experienceEntries: ResumeExperienceRecord[],
  selectedSkills: string[],
): ResumeVersionPacketRecord {
  const highlightedSkills = describeJobSkillFocus(job)

  return {
    changeSummaryText: `Re-centered the resume around ${job.title} by emphasizing the most relevant experience, requirements, and skills for this role.`,
    id: `seed-resume-${job.id}`,
    exportStatus: 'draft',
    experienceEntries,
    headlineText: workspace.resumeMaster.baseTitle || workspace.profile.headline,
    highlightedRequirements: job.requirements.slice(0, 4),
    skillsSection: selectedSkills,
    summaryText: `${workspace.resumeMaster.summaryText} Best aligned here for ${job.title} work that emphasizes ${highlightedSkills}.`,
    tailoringNotes: `Prioritize ${experienceEntries
      .map((entry) => `${entry.companyName} (${entry.roleTitle})`)
      .join(' and ')} because those entries best support this role's required mix of ${highlightedSkills}.`,
    versionLabel: `${job.companyName} packet resume`,
  }
}

export function buildSeedJobSummary(job: RankedJobRecord) {
  const description = cleanLine(job.descriptionText)

  if (!description) {
    return `${job.companyName} is hiring for ${job.title}.`
  }

  if (description.length <= 220) {
    return description
  }

  return `${description.slice(0, 217).trimEnd()}...`
}

export function buildSeedJobFocusSummary(job: RankedJobRecord) {
  if (job.requirements.length > 0) {
    return `The posting emphasizes ${job.requirements.slice(0, 2).join(' and ')}.`
  }

  return `The posting appears to center on ${job.title} work with a designer-first focus.`
}

export function buildCoverLetterSummary(draft: string) {
  const compact = cleanLine(draft)

  if (!compact) {
    return ''
  }

  return compact.length <= 180 ? compact : `${compact.slice(0, 177).trimEnd()}...`
}

export function buildGeneratedPacket(
  workspace: OperatorWorkspaceRecord,
  job: RankedJobRecord,
): ApplicationPacketRecord {
  const experienceEntries = selectExperienceEntries(workspace, job)
  const caseStudySelection = selectCaseStudies(workspace, job)
  const selectedSkills = selectSkills(workspace, job)
  const portfolioRecommendation = buildPortfolioRecommendation(workspace, caseStudySelection)

  return {
    answers: [],
    caseStudySelection,
    checklistItems: buildChecklist(job, caseStudySelection),
    coverLetterDraft: buildCoverLetterDraft(workspace, job, caseStudySelection),
    coverLetterSummary: buildCoverLetterSummary(buildCoverLetterDraft(workspace, job, caseStudySelection)),
    generationStatus: 'not_started',
    generatedAt: job.scoredAt,
    id: `seed-packet-${job.id}`,
    jobId: job.id,
    jobScoreId: job.jobScoreId,
    jobFocusSummary: buildSeedJobFocusSummary(job),
    jobSummary: buildSeedJobSummary(job),
    manualNotes: '',
    packetStatus: 'draft',
    portfolioRecommendation,
    professionalSummary: buildProfessionalSummary(workspace, job, selectedSkills),
    questionSnapshotStatus: 'not_started',
    resumeVersion: buildGeneratedResumeVersion(workspace, job, experienceEntries, selectedSkills),
  }
}

export function normalizeExperienceEntry(value: unknown): ResumeExperienceRecord {
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

export function normalizeResumeVersion(
  value: unknown,
  fallback: ResumeVersionPacketRecord,
): ResumeVersionPacketRecord {
  const record = asRecord(value)

  if (!record) {
    return fallback
  }

  return {
    changeSummaryText: asString(record.change_summary_text) || fallback.changeSummaryText,
    id: asString(record.id) || fallback.id,
    exportStatus: (asString(record.export_status) || fallback.exportStatus) as ResumeVersionPacketRecord['exportStatus'],
    experienceEntries: Array.isArray(record.experience_entries)
      ? (record.experience_entries as unknown[]).map((item) => normalizeExperienceEntry(item))
      : fallback.experienceEntries,
    headlineText: asString(record.headline_text) || fallback.headlineText,
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

export function normalizePortfolioRecommendation(
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

export function normalizeCaseStudySelection(
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

export function normalizePacketStatus(value: unknown, fallback: PacketStatus): PacketStatus {
  const text = asString(value)

  return text === 'ready' || text === 'applied' || text === 'archived' ? text : fallback
}

export function normalizeGenerationStatus(
  value: unknown,
  fallback: PacketGenerationStatus,
): PacketGenerationStatus {
  const text = asString(value)

  if (
    text === 'not_started' ||
    text === 'running' ||
    text === 'generated' ||
    text === 'failed'
  ) {
    return text
  }

  return fallback
}

export function normalizeQuestionSnapshotStatus(
  value: unknown,
  fallback: PacketQuestionSnapshotStatus,
): PacketQuestionSnapshotStatus {
  const text = asString(value)

  return packetQuestionSnapshotStatuses.includes(text as PacketQuestionSnapshotStatus)
    ? (text as PacketQuestionSnapshotStatus)
    : fallback
}

export function inferLegacyGenerationStatus(record: Record<string, unknown> | null): PacketGenerationStatus {
  if (!record) {
    return 'not_started'
  }

  if (asString(record.generation_status)) {
    return normalizeGenerationStatus(record.generation_status, 'not_started')
  }

  if (
    asString(record.generated_at) ||
    asString(record.cover_letter_draft) ||
    asString(record.professional_summary)
  ) {
    return 'generated'
  }

  return 'not_started'
}

export function shouldRefreshQuestionSnapshot(
  packetRow: Record<string, unknown>,
  options: QuestionSnapshotRefreshOptions,
) {
  if (!options.syncQuestionSnapshot) {
    return false
  }

  if (!options.syncQuestionSnapshotIfStale) {
    return true
  }

  const status = normalizeQuestionSnapshotStatus(packetRow.question_snapshot_status, 'not_started')

  if (status === 'not_started') {
    return true
  }

  const refreshedAt = asString(packetRow.question_snapshot_refreshed_at)

  if (!refreshedAt) {
    return true
  }

  const refreshedAtTime = Date.parse(refreshedAt)

  if (!Number.isFinite(refreshedAtTime)) {
    return true
  }

  return Date.now() - refreshedAtTime >= QUESTION_SNAPSHOT_STALE_WINDOW_MS
}

export function normalizeAnswer(value: unknown): ApplicationAnswerRecord | null {
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
