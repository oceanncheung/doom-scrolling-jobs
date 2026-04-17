'use server'

import { extractUploadedDocumentText } from '@/lib/files/extract-uploaded-document-text'
import { joinHeadlineTags } from '@/lib/profile/headline-tags'
import { highlightLinesFromMultiline } from '@/lib/profile/highlight-lines'
import { ensureLocationCountryFirst } from '@/lib/profile/location-market'
import { normalizeSalaryFloorCurrency } from '@/lib/profile/salary-currency'
import { refresh, revalidatePath } from 'next/cache'

import { generateCanonicalSources } from '@/lib/ai/tasks/generate-canonical-sources'
import { generateProfileWorkspace } from '@/lib/ai/tasks/generate-profile-workspace'
import { getActiveOperatorContext } from '@/lib/data/operators'
import type {
  CoverLetterProofBankEntryRecord,
  OperatorPortfolioItemRecord,
  ResumeAchievementRecord,
  ResumeEducationRecord,
  ResumeExperienceRecord,
} from '@/lib/domain/types'
import { hasOpenAIEnv, hasSupabaseServerEnv } from '@/lib/env'
import type { ActionState } from '@/lib/form/action-state'
import {
  asList,
  asOptionalInteger,
  asOptionalText,
  asOptionalUnknownText,
  asTextValue,
} from '@/lib/form/parse-helpers'
import { rescorePersistedImportedJobs } from '@/lib/jobs/real-feed'
import {
  collectCoverLetterMasterIssues,
  collectProfileDraftBlockingIssues,
  collectResumeMasterIssues,
  normalizeCoverLetterMasterRecord,
  normalizeResumeMasterRecord,
  renderMasterCoverLetterMarkdown,
  renderMasterResumeMarkdown,
} from '@/lib/profile/master-assets'
import { normalizeMatchingPreferences } from '@/lib/profile/matching-preferences'
import { createClient } from '@/lib/supabase/server'

export type ProfileActionState = ActionState

interface ParseResult<T> {
  error?: string
  items: T[]
}

interface UploadedSourceDocument {
  fileName: string | null
  parsedText: string | null
}

function asUploadedFile(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size <= 0 || !value.name) {
    return null
  }

  return value
}

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

async function resolveUploadedSourceDocument(options: {
  existingParsedText: string | null
  file: File | null
  fileName: string | null
  label: string
}): Promise<UploadedSourceDocument> {
  const { existingParsedText, file, fileName, label } = options

  if (file) {
    const parsedText = await extractUploadedDocumentText(file)

    if (!parsedText) {
      throw new Error(`${label} could not be parsed into readable text. Try another PDF, DOC, or DOCX file.`)
    }

    return {
      fileName: file.name,
      parsedText,
    }
  }

  if (!fileName) {
    return {
      fileName: null,
      parsedText: null,
    }
  }

  return {
    fileName,
    parsedText: existingParsedText,
  }
}

function asFieldArray(formData: FormData, name: string) {
  return formData.getAll(name).map((value) => String(value ?? '').trim())
}

function hasMeaningfulRow(values: Array<string | string[]>) {
  return values.some((value) =>
    Array.isArray(value) ? value.some((item) => item.length > 0) : value.length > 0,
  )
}

function asBooleanChoice(value: string, fallback = false) {
  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  return fallback
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function asRating(value: string) {
  if (!value) {
    return null
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed)) {
    return null
  }

  return Math.min(5, Math.max(1, parsed))
}

function fillBlankText(currentValue: string | null, fallbackValue: string) {
  const current = currentValue?.trim() ?? ''
  return current || fallbackValue.trim()
}

function fillBlankList(currentValues: string[], fallbackValues: string[]) {
  return currentValues.length > 0 ? currentValues : fallbackValues
}

function dedupeList(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function buildAchievementBankFromHighlights(highlights: string[]) {
  return highlights.map((detail, index) => ({
    category: 'highlight',
    detail,
    title: `Impact highlight ${index + 1}`,
  }))
}

function toPostgresInList(values: string[]) {
  return `(${values.map((value) => `"${value}"`).join(',')})`
}

function parseExperienceEntries(formData: FormData): ParseResult<ResumeExperienceRecord> {
  const roleTitles = asFieldArray(formData, 'experienceRoleTitle')
  const companyNames = asFieldArray(formData, 'experienceCompanyName')
  const locationLabels = asFieldArray(formData, 'experienceLocationLabel')
  const startDates = asFieldArray(formData, 'experienceStartDate')
  const endDates = asFieldArray(formData, 'experienceEndDate')
  const summaries = asFieldArray(formData, 'experienceSummary')
  const highlights = asFieldArray(formData, 'experienceHighlights').map((value) =>
    highlightLinesFromMultiline(value),
  )

  const count = Math.max(
    roleTitles.length,
    companyNames.length,
    locationLabels.length,
    startDates.length,
    endDates.length,
    summaries.length,
    highlights.length,
  )

  const items: ResumeExperienceRecord[] = []

  for (let index = 0; index < count; index += 1) {
    const item: ResumeExperienceRecord = {
      companyName: companyNames[index] ?? '',
      roleTitle: roleTitles[index] ?? '',
      locationLabel: locationLabels[index] ?? '',
      startDate: startDates[index] ?? '',
      endDate: endDates[index] ?? '',
      summary: summaries[index] ?? '',
      highlights: highlights[index] ?? [],
    }

    if (!hasMeaningfulRow([item.companyName, item.roleTitle, item.summary, item.highlights])) {
      continue
    }

    if (!item.companyName || !item.roleTitle) {
      return {
        error: `Experience entry ${index + 1} needs both a company name and a role title.`,
        items: [],
      }
    }

    items.push(item)
  }

  return { items }
}

function parseAchievementBank(formData: FormData): ParseResult<ResumeAchievementRecord> {
  const categories = asFieldArray(formData, 'achievementCategory')
  const titles = asFieldArray(formData, 'achievementTitle')
  const details = asFieldArray(formData, 'achievementDetail')
  const count = Math.max(categories.length, titles.length, details.length)
  const items: ResumeAchievementRecord[] = []

  for (let index = 0; index < count; index += 1) {
    const item: ResumeAchievementRecord = {
      category: categories[index] ?? '',
      title: titles[index] ?? '',
      detail: details[index] ?? '',
    }

    if (!hasMeaningfulRow([item.category, item.title, item.detail])) {
      continue
    }

    if (!item.title || !item.detail) {
      return {
        error: `Achievement entry ${index + 1} needs both a title and a detail.`,
        items: [],
      }
    }

    items.push(item)
  }

  return { items }
}

function parseEducationEntries(formData: FormData): ParseResult<ResumeEducationRecord> {
  const schoolNames = asFieldArray(formData, 'educationSchoolName')
  const credentials = asFieldArray(formData, 'educationCredential')
  const fieldsOfStudy = asFieldArray(formData, 'educationFieldOfStudy')
  const startDates = asFieldArray(formData, 'educationStartDate')
  const endDates = asFieldArray(formData, 'educationEndDate')
  const notes = asFieldArray(formData, 'educationNotes')
  const count = Math.max(
    schoolNames.length,
    credentials.length,
    fieldsOfStudy.length,
    startDates.length,
    endDates.length,
    notes.length,
  )

  const items: ResumeEducationRecord[] = []

  for (let index = 0; index < count; index += 1) {
    const item: ResumeEducationRecord = {
      schoolName: schoolNames[index] ?? '',
      credential: credentials[index] ?? '',
      fieldOfStudy: fieldsOfStudy[index] ?? '',
      startDate: startDates[index] ?? '',
      endDate: endDates[index] ?? '',
      notes: notes[index] ?? '',
    }

    if (!hasMeaningfulRow([item.schoolName, item.credential, item.fieldOfStudy, item.notes])) {
      continue
    }

    if (!item.schoolName || !item.credential) {
      return {
        error: `Education entry ${index + 1} needs both a school name and a credential.`,
        items: [],
      }
    }

    items.push(item)
  }

  return { items }
}

function parseCoverLetterProofBank(formData: FormData): ParseResult<CoverLetterProofBankEntryRecord> {
  const labels = asFieldArray(formData, 'coverLetterProofLabel')
  const contexts = asFieldArray(formData, 'coverLetterProofContext')
  const bullets = asFieldArray(formData, 'coverLetterProofBullets').map((value) =>
    highlightLinesFromMultiline(value),
  )
  const count = Math.max(labels.length, contexts.length, bullets.length)
  const items: CoverLetterProofBankEntryRecord[] = []

  for (let index = 0; index < count; index += 1) {
    const item: CoverLetterProofBankEntryRecord = {
      bullets: bullets[index] ?? [],
      context: contexts[index] ?? '',
      label: labels[index] ?? '',
    }

    if (!hasMeaningfulRow([item.label, item.context, item.bullets])) {
      continue
    }

    if (!item.label || item.bullets.length === 0) {
      return {
        error: `Proof bank entry ${index + 1} needs both a label and at least one bullet.`,
        items: [],
      }
    }

    items.push(item)
  }

  return { items }
}

function parsePortfolioItems(formData: FormData): ParseResult<OperatorPortfolioItemRecord> {
  const ids = asFieldArray(formData, 'portfolioItemId')
  const titles = asFieldArray(formData, 'portfolioTitle')
  const urls = asFieldArray(formData, 'portfolioUrl')
  const projectTypes = asFieldArray(formData, 'portfolioProjectType')
  const roleLabels = asFieldArray(formData, 'portfolioRoleLabel')
  const summaries = asFieldArray(formData, 'portfolioSummary')
  const skillsTags = asFieldArray(formData, 'portfolioSkillsTags').map((value) => asList(value))
  const industryTags = asFieldArray(formData, 'portfolioIndustryTags').map((value) => asList(value))
  const outcomeMetrics = asFieldArray(formData, 'portfolioOutcomeMetrics').map((value) =>
    asList(value),
  )
  const visualStrengthRatings = asFieldArray(formData, 'portfolioVisualStrengthRating')
  const primaryChoices = asFieldArray(formData, 'portfolioIsPrimary')
  const activeChoices = asFieldArray(formData, 'portfolioIsActive')

  const count = Math.max(
    ids.length,
    titles.length,
    urls.length,
    projectTypes.length,
    roleLabels.length,
    summaries.length,
    skillsTags.length,
    industryTags.length,
    outcomeMetrics.length,
    visualStrengthRatings.length,
    primaryChoices.length,
    activeChoices.length,
  )

  const items: OperatorPortfolioItemRecord[] = []

  for (let index = 0; index < count; index += 1) {
    const item: OperatorPortfolioItemRecord = {
      id: ids[index] ?? '',
      title: titles[index] ?? '',
      url: urls[index] ?? '',
      projectType: projectTypes[index] ?? '',
      roleLabel: roleLabels[index] ?? '',
      summary: summaries[index] ?? '',
      skillsTags: skillsTags[index] ?? [],
      industryTags: industryTags[index] ?? [],
      outcomeMetrics: outcomeMetrics[index] ?? [],
      visualStrengthRating: visualStrengthRatings[index] ?? '',
      isPrimary: asBooleanChoice(primaryChoices[index] ?? 'false'),
      isActive: asBooleanChoice(activeChoices[index] ?? 'true', true),
    }

    if (
      !hasMeaningfulRow([
        item.title,
        item.url,
        item.projectType,
        item.roleLabel,
        item.summary,
        item.skillsTags,
        item.industryTags,
        item.outcomeMetrics,
      ])
    ) {
      continue
    }

    if (!item.id) {
      return {
        error: `Portfolio item ${index + 1} is missing its internal ID. Refresh the page and try again.`,
        items: [],
      }
    }

    if (!item.title || !item.url) {
      return {
        error: `Portfolio item ${index + 1} needs both a title and a URL.`,
        items: [],
      }
    }

    items.push(item)
  }

  return { items }
}

export async function saveOperatorProfile(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  if (!hasSupabaseServerEnv()) {
    return {
      message: "Profile saving isn't available right now.",
      status: 'error',
    }
  }

  const intent = asTextValue(formData.get('intent')) || 'save'
  const isGenerateProfileIntent = intent === 'generate-profile'

  const experienceResult = parseExperienceEntries(formData)
  const achievementResult = parseAchievementBank(formData)
  const educationResult = parseEducationEntries(formData)
  const proofBankResult = parseCoverLetterProofBank(formData)
  const portfolioResult = parsePortfolioItems(formData)

  const parseError =
    experienceResult.error ??
    achievementResult.error ??
    educationResult.error ??
    proofBankResult.error ??
    portfolioResult.error

  if (parseError) {
    return {
      message: parseError,
      status: 'error',
    }
  }

  let experienceEntries = experienceResult.items
  let achievementBank = achievementResult.items
  let educationEntries = educationResult.items
  const proofBankEntries = proofBankResult.items
  const portfolioItems = portfolioResult.items
  let bioSummary = asOptionalText(formData.get('bioSummary')) ?? ''
  const sourceCoverLetterFileName = asOptionalText(formData.get('sourceCoverLetterFileName'))
  const sourceResumeFileName = asOptionalText(formData.get('sourceResumeFileName'))
  let headline = asTextValue(formData.get('headline'))
  let locationLabel = asOptionalText(formData.get('locationLabel')) ?? ''
  const phoneNumber = asOptionalText(formData.get('phoneNumber')) ?? ''
  let searchBrief = asOptionalText(formData.get('searchBrief')) ?? ''
  let targetRoles = asList(formData.get('targetRoles'))
  let allowedAdjacentRoles = asList(formData.get('allowedAdjacentRoles'))
  const matchingPreferences = normalizeMatchingPreferences({
    marketStrictness: asTextValue(formData.get('matchingMarketStrictness')),
    roleBreadth: asTextValue(formData.get('matchingRoleBreadth')),
    sourceMix: asTextValue(formData.get('matchingSourceMix')),
  })
  let targetSeniorityLevels = asList(formData.get('targetSeniorityLevels'))
  let skills = asList(formData.get('skills'))
  let tools = asList(formData.get('tools'))
  let languages = asList(formData.get('languages'))
  let resumeSkillsSection = asList(formData.get('resumeSkillsSection'))
  let certifications = asList(formData.get('certifications'))
  const coverLetterCapabilityDisciplines = asList(formData.get('coverLetterCapabilityDisciplines'))
  const coverLetterCapabilityTools = asList(formData.get('coverLetterCapabilityTools'))
  const coverLetterToneVoice = asList(formData.get('coverLetterToneVoice'))
  const coverLetterKeyDifferentiators = asList(formData.get('coverLetterKeyDifferentiators'))
  const coverLetterSelectionRules = asList(formData.get('coverLetterSelectionRules'))
  const coverLetterOutputConstraints = asList(formData.get('coverLetterOutputConstraints'))
  const coverLetterPositioningPhilosophy =
    asOptionalText(formData.get('coverLetterPositioningPhilosophy')) ?? ''
  const derivedPortfolioPrimaryUrl =
    asOptionalText(formData.get('portfolioPrimaryUrl')) ??
    portfolioItems.find((item) => item.isPrimary && item.isActive)?.url ??
    portfolioItems.find((item) => item.isActive)?.url ??
    null
  const portfolioPdfFileName = asOptionalText(formData.get('portfolioPdfFileName'))
  let hiringMarkets = asList(formData.get('hiringMarkets'))

  const supabase = createClient()
  const displayName = asOptionalText(formData.get('displayName'))
  const operatorContext = await getActiveOperatorContext()

  if (!operatorContext || !operatorContext.profileId || !operatorContext.resumeMasterId) {
    return {
      message: 'Choose a workspace before saving profile changes.',
      status: 'error',
    }
  }

  const [{ data: existingResumeMasterRow, error: existingResumeMasterError }, { data: existingCoverLetterMasterRow, error: existingCoverLetterMasterError }] = await Promise.all([
    supabase.from('resume_master').select('*').eq('id', operatorContext.resumeMasterId).maybeSingle(),
    operatorContext.coverLetterMasterId
      ? supabase.from('cover_letter_master').select('*').eq('id', operatorContext.coverLetterMasterId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (existingResumeMasterError || existingCoverLetterMasterError) {
    return {
      message:
        existingResumeMasterError?.message ??
        existingCoverLetterMasterError?.message ??
        'Profile materials could not be loaded.',
      status: 'error',
    }
  }

  const existingResumeMaster = normalizeResumeMasterRecord(existingResumeMasterRow ?? {})
  const existingCoverLetterMaster = normalizeCoverLetterMasterRecord(existingCoverLetterMasterRow ?? {})
  const existingResumeSourceContent = asRecord(existingResumeMaster.sourceContent)

  let parsedRawResumeDocument: UploadedSourceDocument
  let parsedRawCoverLetterDocument: UploadedSourceDocument
  let parsedPortfolioDocument: UploadedSourceDocument

  try {
    ;[
      parsedRawResumeDocument,
      parsedRawCoverLetterDocument,
      parsedPortfolioDocument,
    ] = await Promise.all([
      resolveUploadedSourceDocument({
        existingParsedText:
          asOptionalUnknownText(existingResumeSourceContent?.resumeSourceText) ??
          asOptionalUnknownText(existingResumeSourceContent?.resumeDocumentText) ??
          existingResumeMaster.rawSourceText,
        file: asUploadedFile(formData.get('resumeSourceUpload')),
        fileName: sourceResumeFileName ?? existingResumeMaster.resumePdfFileName,
        label: 'Source resume',
      }),
      resolveUploadedSourceDocument({
        existingParsedText:
          asOptionalUnknownText(existingResumeSourceContent?.coverLetterSourceText) ??
          asOptionalUnknownText(existingResumeSourceContent?.coverLetterDocumentText) ??
          existingCoverLetterMaster.rawSourceText,
        file: asUploadedFile(formData.get('coverLetterSourceUpload')),
        fileName: sourceCoverLetterFileName ?? existingResumeMaster.coverLetterPdfFileName,
        label: 'Source cover letter',
      }),
      resolveUploadedSourceDocument({
        existingParsedText: asOptionalUnknownText(existingResumeSourceContent?.portfolioDocumentText),
        file: asUploadedFile(formData.get('portfolioPdfUpload')),
        fileName: portfolioPdfFileName,
        label: 'Portfolio file',
      }),
    ])
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : 'One of the uploaded documents could not be parsed.',
      status: 'error',
    }
  }

  let generatedResumeMaster = existingResumeMaster
  let generatedCoverLetterMaster = existingCoverLetterMaster

  if (isGenerateProfileIntent) {
    if (!hasOpenAIEnv()) {
      return {
        message: "Profile generation isn't available right now.",
        status: 'error',
      }
    }

    try {
      if (!parsedRawResumeDocument.parsedText?.trim()) {
        return {
          message: 'Upload a resume before generating a profile draft.',
          status: 'error',
        }
      }

      if (parsedRawResumeDocument.parsedText?.trim()) {
        const canonical = await generateCanonicalSources({
          sourceCoverLetterText: parsedRawCoverLetterDocument.parsedText ?? undefined,
          sourceResumeText: parsedRawResumeDocument.parsedText,
        })

        generatedResumeMaster = normalizeResumeMasterRecord({
          achievement_bank: buildAchievementBankFromHighlights(
            canonical.resumeMaster.selectedImpactHighlights,
          ),
          additional_information: canonical.resumeMaster.additionalInformation,
          approval_status: 'draft',
          archived_experience_entries: canonical.resumeMaster.archivedExperienceEntries,
          base_title: canonical.resumeMaster.baseTitle,
          contact_snapshot: canonical.resumeMaster.contactSnapshot,
          core_expertise: canonical.resumeMaster.coreExpertise,
          education_entries: canonical.resumeMaster.educationEntries,
          experience_entries: canonical.resumeMaster.experienceEntries,
          generation_issues: [],
          languages: canonical.resumeMaster.languages,
          raw_source_text: parsedRawResumeDocument.parsedText,
          section_provenance: canonical.resumeMaster.sectionProvenance,
          selected_impact_highlights: canonical.resumeMaster.selectedImpactHighlights,
          skills_section: canonical.resumeMaster.skillsSection,
          source_content: {
            generatedFrom: 'raw-source-upload',
          },
          source_format: 'structured_json',
          summary_text: canonical.resumeMaster.summaryText,
          tools_platforms: canonical.resumeMaster.toolsPlatforms,
        })

        generatedCoverLetterMaster = normalizeCoverLetterMasterRecord({
          approval_status: 'draft',
          capabilities: canonical.coverLetterMaster.capabilities,
          contact_snapshot: canonical.coverLetterMaster.contactSnapshot,
          generation_issues: [],
          key_differentiators: canonical.coverLetterMaster.keyDifferentiators,
          output_constraints: canonical.coverLetterMaster.outputConstraints,
          positioning_philosophy: canonical.coverLetterMaster.positioningPhilosophy,
          proof_bank: canonical.coverLetterMaster.proofBank,
          raw_source_text: parsedRawCoverLetterDocument.parsedText ?? parsedRawResumeDocument.parsedText,
          section_provenance: canonical.coverLetterMaster.sectionProvenance,
          selection_rules: canonical.coverLetterMaster.selectionRules,
          source_content: {
            generatedFrom: 'raw-source-upload',
          },
          source_format: 'structured_json',
          tone_voice: canonical.coverLetterMaster.toneVoice,
        })
      }

      generatedResumeMaster = normalizeResumeMasterRecord({
        ...generatedResumeMaster,
        approval_status: 'draft',
        approved_at: null,
      })
      generatedCoverLetterMaster = normalizeCoverLetterMasterRecord({
        ...generatedCoverLetterMaster,
        approval_status: 'draft',
        approved_at: null,
      })

      generatedResumeMaster.renderedMarkdown = renderMasterResumeMarkdown(generatedResumeMaster)
      generatedCoverLetterMaster.renderedMarkdown = generatedCoverLetterMaster.hasSourceMaterial
        ? renderMasterCoverLetterMarkdown(generatedCoverLetterMaster)
        : ''

      const generatedProfile = await generateProfileWorkspace({
        masterCoverLetterMarkdown: generatedCoverLetterMaster.renderedMarkdown || undefined,
        masterResumeMarkdown: generatedResumeMaster.renderedMarkdown,
      })

      headline = fillBlankText(headline, generatedProfile.headline)
      bioSummary = fillBlankText(bioSummary, generatedProfile.bioSummary)
      locationLabel = fillBlankText(locationLabel, generatedProfile.locationLabel)
      searchBrief = fillBlankText(searchBrief, generatedProfile.searchBrief)
      targetRoles = fillBlankList(targetRoles, generatedProfile.targetRoles)
      allowedAdjacentRoles = fillBlankList(allowedAdjacentRoles, generatedProfile.allowedAdjacentRoles)
      targetSeniorityLevels = fillBlankList(targetSeniorityLevels, generatedProfile.targetSeniorityLevels)
      skills = fillBlankList(skills, generatedProfile.skills)
      tools = fillBlankList(tools, generatedProfile.tools)
      resumeSkillsSection = fillBlankList(
        resumeSkillsSection,
        generatedResumeMaster.skillsSection.length > 0
          ? generatedResumeMaster.skillsSection
          : generatedProfile.skills,
      )
      experienceEntries = experienceEntries.length > 0 ? experienceEntries : generatedResumeMaster.experienceEntries
      educationEntries = educationEntries.length > 0 ? educationEntries : generatedResumeMaster.educationEntries
      achievementBank =
        achievementBank.length > 0
          ? achievementBank
          : generatedResumeMaster.achievementBank.length > 0
            ? generatedResumeMaster.achievementBank
            : buildAchievementBankFromHighlights(generatedResumeMaster.selectedImpactHighlights)
      certifications = certifications.length > 0 ? certifications : generatedResumeMaster.certifications
      languages = fillBlankList(languages, generatedResumeMaster.languages)
    } catch (error) {
      return {
        message:
          error instanceof Error
            ? error.message
            : 'Canonical source generation could not finish from the current materials.',
        status: 'error',
      }
    }
  }

  if (!headline) {
    headline = joinHeadlineTags(dedupeList(targetRoles))
  }

  if (!headline) {
    return {
      message: 'Headline is required so scoring and packet generation have a stable role anchor.',
      status: 'error',
    }
  }

  hiringMarkets = ensureLocationCountryFirst(
    hiringMarkets.length > 0
      ? hiringMarkets
      : [asOptionalText(formData.get('primaryMarket')) ?? ''].filter(Boolean),
    locationLabel,
  )

  const primaryMarket = hiringMarkets[0] ?? ''
  const secondaryMarkets = hiringMarkets.slice(1)

  const primarySeniorityLevel =
    targetSeniorityLevels[0] ?? asOptionalText(formData.get('seniorityLevel')) ?? ''
  const resolvedDisplayName = displayName ?? operatorContext.operator.displayName
  const now = new Date().toISOString()

  const baseResumeMaster = normalizeResumeMasterRecord({
    ...existingResumeMaster,
    ...generatedResumeMaster,
    achievement_bank:
      achievementBank.length > 0
        ? achievementBank
        : generatedResumeMaster.achievementBank.length > 0
          ? generatedResumeMaster.achievementBank
          : existingResumeMaster.achievementBank,
    additional_information:
      generatedResumeMaster.additionalInformation.length > 0
        ? generatedResumeMaster.additionalInformation
        : existingResumeMaster.additionalInformation,
    approval_status: isGenerateProfileIntent
      ? 'draft'
      : existingResumeMaster.approvalStatus,
    approved_at: isGenerateProfileIntent ? null : existingResumeMaster.approvedAt ?? null,
    base_title: headline || generatedResumeMaster.baseTitle || existingResumeMaster.baseTitle,
    contact_snapshot: {
      email: operatorContext.operator.email,
      linkedinUrl: asOptionalText(formData.get('linkedinUrl')) ?? existingResumeMaster.contactSnapshot.linkedinUrl,
      location: locationLabel || existingResumeMaster.contactSnapshot.location,
      name: resolvedDisplayName,
      phone: phoneNumber || existingResumeMaster.contactSnapshot.phone,
      portfolioUrl:
        derivedPortfolioPrimaryUrl ??
        existingResumeMaster.contactSnapshot.portfolioUrl,
      websiteUrl:
        asOptionalText(formData.get('personalSiteUrl')) ??
        existingResumeMaster.contactSnapshot.websiteUrl,
    },
    core_expertise:
      skills.length > 0 ? dedupeList(skills) : generatedResumeMaster.coreExpertise,
    certifications:
      certifications.length > 0
        ? dedupeList(certifications)
        : generatedResumeMaster.certifications,
    cover_letter_pdf_file_name:
      parsedRawCoverLetterDocument.fileName ?? existingResumeMaster.coverLetterPdfFileName,
    education_entries:
      educationEntries.length > 0 ? educationEntries : generatedResumeMaster.educationEntries,
    experience_entries:
      experienceEntries.length > 0 ? experienceEntries : generatedResumeMaster.experienceEntries,
    languages: languages.length > 0 ? dedupeList(languages) : generatedResumeMaster.languages,
    portfolio_pdf_file_name:
      parsedPortfolioDocument.fileName ?? existingResumeMaster.portfolioPdfFileName,
    raw_source_text:
      generatedResumeMaster.rawSourceText ||
      parsedRawResumeDocument.parsedText ||
      existingResumeMaster.rawSourceText,
    resume_pdf_file_name:
      parsedRawResumeDocument.fileName ?? existingResumeMaster.resumePdfFileName,
    section_provenance:
      generatedResumeMaster.sectionProvenance,
    selected_impact_highlights:
      generatedResumeMaster.selectedImpactHighlights.length > 0
        ? generatedResumeMaster.selectedImpactHighlights
        : dedupeList(achievementBank.map((item) => item.detail || item.title)),
    skills_section:
      resumeSkillsSection.length > 0
        ? dedupeList(resumeSkillsSection)
        : generatedResumeMaster.skillsSection,
    source_content: {
      ...existingResumeMaster.sourceContent,
      achievementCount: achievementBank.length,
      coverLetterSourceFileName: parsedRawCoverLetterDocument.fileName,
      coverLetterSourceText: parsedRawCoverLetterDocument.parsedText,
      generatedCoverLetterSourceFileName: isGenerateProfileIntent
        ? parsedRawCoverLetterDocument.fileName
        : asOptionalUnknownText(existingResumeSourceContent?.generatedCoverLetterSourceFileName),
      generatedResumeSourceFileName: isGenerateProfileIntent
        ? parsedRawResumeDocument.fileName
        : asOptionalUnknownText(existingResumeSourceContent?.generatedResumeSourceFileName),
      educationCount: educationEntries.length,
      experienceCount: experienceEntries.length,
      portfolioDocumentText:
        parsedPortfolioDocument.parsedText ??
        asOptionalUnknownText(existingResumeSourceContent?.portfolioDocumentText) ??
        null,
      portfolioFileName:
        parsedPortfolioDocument.fileName ??
        asOptionalUnknownText(existingResumeSourceContent?.portfolioFileName) ??
        null,
      portfolioItemCount: portfolioItems.length,
      rawResumeGeneratedAt: isGenerateProfileIntent ? now : existingResumeSourceContent?.rawResumeGeneratedAt,
      resumeSourceFileName: parsedRawResumeDocument.fileName,
      resumeSourceText: parsedRawResumeDocument.parsedText,
      reviewRequired: isGenerateProfileIntent,
      searchBrief,
      updatedFrom: 'profile-workspace',
    },
    source_format: generatedResumeMaster.sourceFormat || existingResumeMaster.sourceFormat,
    summary_text:
      bioSummary || generatedResumeMaster.summaryText || existingResumeMaster.summaryText,
    tools_platforms:
      tools.length > 0 ? dedupeList(tools) : generatedResumeMaster.toolsPlatforms,
  })

  baseResumeMaster.renderedMarkdown = renderMasterResumeMarkdown(baseResumeMaster)
  const resumeIssues = collectResumeMasterIssues(baseResumeMaster)

  const baseCoverLetterMaster = normalizeCoverLetterMasterRecord({
    ...existingCoverLetterMaster,
    ...generatedCoverLetterMaster,
    approval_status: isGenerateProfileIntent
      ? 'draft'
      : existingCoverLetterMaster.approvalStatus,
    approved_at: isGenerateProfileIntent ? null : existingCoverLetterMaster.approvedAt ?? null,
    capabilities: {
      disciplines:
        coverLetterCapabilityDisciplines.length > 0
          ? dedupeList(coverLetterCapabilityDisciplines)
          : generatedCoverLetterMaster.capabilities.disciplines.length > 0
            ? generatedCoverLetterMaster.capabilities.disciplines
            : existingCoverLetterMaster.capabilities.disciplines,
      productionTools:
        coverLetterCapabilityTools.length > 0
          ? dedupeList(coverLetterCapabilityTools)
          : generatedCoverLetterMaster.capabilities.productionTools.length > 0
            ? generatedCoverLetterMaster.capabilities.productionTools
            : existingCoverLetterMaster.capabilities.productionTools,
    },
    contact_snapshot: {
      location: locationLabel || existingCoverLetterMaster.contactSnapshot.location,
      name: resolvedDisplayName,
      roleTargets:
        targetRoles.length > 0
          ? dedupeList(targetRoles)
          : generatedCoverLetterMaster.contactSnapshot.roleTargets,
    },
    key_differentiators:
      coverLetterKeyDifferentiators.length > 0
        ? dedupeList(coverLetterKeyDifferentiators)
        : generatedCoverLetterMaster.keyDifferentiators.length > 0
          ? generatedCoverLetterMaster.keyDifferentiators
          : existingCoverLetterMaster.keyDifferentiators,
    output_constraints:
      coverLetterOutputConstraints.length > 0
        ? dedupeList(coverLetterOutputConstraints)
        : generatedCoverLetterMaster.outputConstraints.length > 0
          ? generatedCoverLetterMaster.outputConstraints
          : existingCoverLetterMaster.outputConstraints,
    positioning_philosophy:
      coverLetterPositioningPhilosophy ||
      generatedCoverLetterMaster.positioningPhilosophy ||
      existingCoverLetterMaster.positioningPhilosophy,
    proof_bank:
      proofBankEntries.length > 0
        ? proofBankEntries
        : generatedCoverLetterMaster.proofBank.length > 0
          ? generatedCoverLetterMaster.proofBank
          : existingCoverLetterMaster.proofBank,
    raw_source_text:
      generatedCoverLetterMaster.rawSourceText ||
      parsedRawCoverLetterDocument.parsedText ||
      existingCoverLetterMaster.rawSourceText,
    section_provenance:
      generatedCoverLetterMaster.sectionProvenance,
    selection_rules:
      coverLetterSelectionRules.length > 0
        ? dedupeList(coverLetterSelectionRules)
        : generatedCoverLetterMaster.selectionRules.length > 0
          ? generatedCoverLetterMaster.selectionRules
          : existingCoverLetterMaster.selectionRules,
    source_content: {
      ...existingCoverLetterMaster.sourceContent,
      coverLetterSourceFileName: parsedRawCoverLetterDocument.fileName,
      coverLetterSourceText: parsedRawCoverLetterDocument.parsedText,
      generatedCoverLetterSourceFileName: isGenerateProfileIntent
        ? parsedRawCoverLetterDocument.fileName
        : asOptionalUnknownText(existingCoverLetterMaster.sourceContent.generatedCoverLetterSourceFileName),
      generatedResumeSourceFileName: isGenerateProfileIntent
        ? parsedRawResumeDocument.fileName
        : asOptionalUnknownText(existingCoverLetterMaster.sourceContent.generatedResumeSourceFileName),
      proofBankCount: proofBankEntries.length,
      updatedFrom: 'profile-workspace',
    },
    source_format: generatedCoverLetterMaster.sourceFormat || existingCoverLetterMaster.sourceFormat,
    tone_voice:
      coverLetterToneVoice.length > 0
        ? dedupeList(coverLetterToneVoice)
        : generatedCoverLetterMaster.toneVoice.length > 0
          ? generatedCoverLetterMaster.toneVoice
          : existingCoverLetterMaster.toneVoice,
  })

  baseCoverLetterMaster.renderedMarkdown = baseCoverLetterMaster.hasSourceMaterial
    ? renderMasterCoverLetterMarkdown(baseCoverLetterMaster)
    : ''
  const coverLetterIssues = collectCoverLetterMasterIssues(baseCoverLetterMaster)

  const draftProfileForValidation = {
    headline,
    locationLabel,
    searchBrief,
    skills: dedupeList(skills),
    targetRoles: dedupeList(targetRoles),
  }
  const profileBlockingIssues = collectProfileDraftBlockingIssues(draftProfileForValidation)
  const approvalBlockingIssues = [...resumeIssues, ...profileBlockingIssues]
  const approvalSucceeded =
    !isGenerateProfileIntent &&
    baseResumeMaster.hasSourceMaterial &&
    approvalBlockingIssues.length === 0
  const coverLetterApprovalSucceeded =
    !isGenerateProfileIntent &&
    baseCoverLetterMaster.hasSourceMaterial &&
    coverLetterIssues.length === 0
  const canonicalReviewedAt = isGenerateProfileIntent
    ? null
    : approvalSucceeded
      ? now
      : null

  const userPayload = {
    account_status: 'active',
    auth_provider: 'internal',
    display_name: resolvedDisplayName,
    email: operatorContext.operator.email,
    id: operatorContext.userId,
    is_internal: true,
  }

  const operatorPayload = {
    display_name: resolvedDisplayName,
    email: operatorContext.operator.email,
    id: operatorContext.operator.id,
    slug: operatorContext.operator.slug,
  }

  const profilePayload = {
    id: operatorContext.profileId,
    operator_id: operatorContext.operator.id,
    user_id: operatorContext.userId,
    canonical_profile_reviewed_at: canonicalReviewedAt,
    search_brief: searchBrief,
    headline,
    location_label: locationLabel,
    timezone: asOptionalText(formData.get('timezone')) ?? 'America/Toronto',
    remote_required: formData.get('remoteRequired') === 'on',
    primary_market: primaryMarket,
    secondary_markets: secondaryMarkets,
    allowed_remote_regions: asList(formData.get('allowedRemoteRegions')),
    timezone_tolerance_hours: null,
    relocation_open: formData.get('relocationOpen') === 'on',
    salary_floor_currency: normalizeSalaryFloorCurrency(asTextValue(formData.get('salaryFloorCurrency'))),
    salary_floor_amount: null,
    salary_target_min: asOptionalInteger(formData.get('salaryTargetMin')),
    salary_target_max: asOptionalInteger(formData.get('salaryTargetMax')),
    seniority_level: primarySeniorityLevel,
    target_seniority_levels: dedupeList(targetSeniorityLevels),
    target_roles: dedupeList(targetRoles),
    allowed_adjacent_roles: dedupeList(allowedAdjacentRoles),
    industries_preferred: asList(formData.get('industriesPreferred')),
    industries_avoid: [],
    skills: dedupeList(skills),
    tools: dedupeList(tools),
    languages: dedupeList(languages),
    work_authorization_notes: '',
    portfolio_primary_url: derivedPortfolioPrimaryUrl,
    linkedin_url: asOptionalText(formData.get('linkedinUrl')),
    phone_number: phoneNumber,
    personal_site_url: asOptionalText(formData.get('personalSiteUrl')),
    bio_summary: bioSummary || null,
    experience_summary: baseResumeMaster.experienceEntries,
    education_summary: baseResumeMaster.educationEntries,
    preferences_notes: '',
    matching_preferences: matchingPreferences,
  }

  const resumePayload = {
    id: operatorContext.resumeMasterId,
    operator_id: operatorContext.operator.id,
    user_id: operatorContext.userId,
    additional_information: baseResumeMaster.additionalInformation,
    approval_status: approvalSucceeded ? 'approved' : 'draft',
    approved_at: approvalSucceeded ? now : null,
    archived_experience_entries: baseResumeMaster.archivedExperienceEntries,
    base_title: baseResumeMaster.baseTitle,
    base_cover_letter_text: baseResumeMaster.baseCoverLetterText || null,
    contact_snapshot: baseResumeMaster.contactSnapshot,
    core_expertise: baseResumeMaster.coreExpertise,
    summary_text: baseResumeMaster.summaryText || null,
    experience_entries: baseResumeMaster.experienceEntries,
    achievement_bank: baseResumeMaster.achievementBank,
    skills_section: baseResumeMaster.skillsSection,
    education_entries: baseResumeMaster.educationEntries,
    certifications: baseResumeMaster.certifications,
    languages: baseResumeMaster.languages,
    links: {
      linkedin: asOptionalText(formData.get('linkedinUrl')),
      portfolio: derivedPortfolioPrimaryUrl,
      website: asOptionalText(formData.get('personalSiteUrl')),
    },
    raw_source_text: baseResumeMaster.rawSourceText || null,
    rendered_markdown: baseResumeMaster.renderedMarkdown || null,
    section_provenance: baseResumeMaster.sectionProvenance,
    generation_issues: resumeIssues,
    selected_impact_highlights: baseResumeMaster.selectedImpactHighlights,
    source_format: baseResumeMaster.sourceFormat,
    source_content: baseResumeMaster.sourceContent,
    tools_platforms: baseResumeMaster.toolsPlatforms,
  }

  const coverLetterPayload = {
    approval_status: coverLetterApprovalSucceeded ? 'approved' : 'draft',
    approved_at:
      coverLetterApprovalSucceeded
        ? now
        : null,
    capability_disciplines: baseCoverLetterMaster.capabilities.disciplines,
    capability_tools: baseCoverLetterMaster.capabilities.productionTools,
    contact_snapshot: baseCoverLetterMaster.contactSnapshot,
    generation_issues: coverLetterIssues,
    id: operatorContext.coverLetterMasterId || crypto.randomUUID(),
    key_differentiators: baseCoverLetterMaster.keyDifferentiators,
    operator_id: operatorContext.operator.id,
    output_constraints: baseCoverLetterMaster.outputConstraints,
    positioning_philosophy: baseCoverLetterMaster.positioningPhilosophy || null,
    proof_bank: baseCoverLetterMaster.proofBank,
    raw_source_text: baseCoverLetterMaster.rawSourceText || null,
    rendered_markdown: baseCoverLetterMaster.renderedMarkdown || null,
    section_provenance: baseCoverLetterMaster.sectionProvenance,
    selection_rules: baseCoverLetterMaster.selectionRules,
    source_content: baseCoverLetterMaster.sourceContent,
    source_format: baseCoverLetterMaster.sourceFormat,
    tone_voice: baseCoverLetterMaster.toneVoice,
    user_id: operatorContext.userId,
  }

  const [userResult, operatorResult, profileResult, resumeResult, coverLetterResult] = await Promise.all([
    supabase.from('users').upsert(userPayload, { onConflict: 'id' }),
    supabase.from('operators').upsert(operatorPayload, { onConflict: 'id' }),
    supabase.from('user_profiles').upsert(profilePayload, { onConflict: 'id' }),
    supabase.from('resume_master').upsert(resumePayload, { onConflict: 'id' }),
    supabase.from('cover_letter_master').upsert(coverLetterPayload, { onConflict: 'id' }),
  ])

  if (userResult.error || operatorResult.error || profileResult.error || resumeResult.error || coverLetterResult.error) {
    return {
      message:
        userResult.error?.message ??
        operatorResult.error?.message ??
        profileResult.error?.message ??
        resumeResult.error?.message ??
        coverLetterResult.error?.message ??
        'Supabase rejected the profile update.',
      status: 'error',
    }
  }

  const portfolioPayload = portfolioItems.map((item) => ({
    id: item.id,
    operator_id: operatorContext.operator.id,
    user_id: operatorContext.userId,
    title: item.title,
    slug: toSlug(item.title),
    url: item.url,
    project_type: item.projectType || 'general design',
    role_label: item.roleLabel || 'designer',
    summary: item.summary || null,
    skills_tags: item.skillsTags,
    industry_tags: item.industryTags,
    outcome_metrics: item.outcomeMetrics,
    visual_strength_rating: asRating(item.visualStrengthRating),
    is_primary: item.isPrimary,
    is_active: item.isActive,
  }))

  if (portfolioPayload.length > 0) {
    const upsertResult = await supabase.from('portfolio_items').upsert(portfolioPayload, {
      onConflict: 'id',
    })

    if (upsertResult.error) {
      return {
        message: upsertResult.error.message,
        status: 'error',
      }
    }

    const deleteResult = await supabase
      .from('portfolio_items')
      .delete()
      .eq('operator_id', operatorContext.operator.id)
      .not('id', 'in', toPostgresInList(portfolioPayload.map((item) => item.id)))

    if (deleteResult.error) {
      return {
        message: deleteResult.error.message,
        status: 'error',
      }
    }
  } else {
    const deleteResult = await supabase
      .from('portfolio_items')
      .delete()
      .eq('operator_id', operatorContext.operator.id)

    if (deleteResult.error) {
      return {
        message: deleteResult.error.message,
        status: 'error',
      }
    }
  }

  let rankingRefreshNote = ''

  try {
    const rankingRefresh = await rescorePersistedImportedJobs()

    if (rankingRefresh.issue) {
      rankingRefreshNote = ` Queue refresh note: ${rankingRefresh.issue}`
    }
  } catch (error) {
    rankingRefreshNote = ` Queue refresh note: ${
      error instanceof Error ? error.message : 'ranking refresh could not complete'
    }`
  }

  revalidatePath('/')
  revalidatePath('/dashboard')
  revalidatePath('/profile')

  if (isGenerateProfileIntent) {
    refresh()
  }

  const unresolvedDraftNote =
    approvalBlockingIssues.length > 0
      ? ' Finish any sections marked with a red dot, then save again to unlock ranking.'
      : ''
  const approvalNote =
    approvalSucceeded ? ' Profile is now approved for ranking.' : ''
  const coverLetterDraftNote =
    !coverLetterApprovalSucceeded && baseCoverLetterMaster.hasSourceMaterial && coverLetterIssues.length > 0
      ? ' Cover-letter strategy was saved as a draft so you can refine it later.'
      : ''

  return {
    message: isGenerateProfileIntent
      ? `${operatorPayload.display_name} profile draft refreshed from the uploaded documents. Review the editable sections, then save profile when ready.${unresolvedDraftNote}${rankingRefreshNote}`
      : `${operatorPayload.display_name} workspace saved with ${experienceEntries.length} experience entries and ${portfolioItems.length} portfolio items.${approvalNote}${unresolvedDraftNote}${coverLetterDraftNote}${rankingRefreshNote}`,
    status: 'success',
  }
}

