import type {
  CanonicalApprovalStatus,
  CanonicalConfidence,
  CoverLetterMasterRecord,
  CoverLetterProofBankEntryRecord,
  MasterSectionProvenanceRecord,
  ResumeAchievementRecord,
  ResumeEducationRecord,
  ResumeExperienceRecord,
  ResumeMasterRecord,
} from '@/lib/domain/types'

import {
  ADD_DETAILS_PLACEHOLDER,
  asObjectArray,
  asRecord,
  asString,
  cleanLine,
  normalizeListItemText,
  normalizeNarrativeTagList,
  normalizeStringList,
} from '@/lib/profile/master-assets-text'

export {
  ADD_DETAILS_PLACEHOLDER,
  cleanLine,
  combineReviewStates,
  normalizeListItemText,
  normalizeNarrativeTagList,
  normalizeStringList,
  type ReviewState,
} from '@/lib/profile/master-assets-text'

export {
  buildProfileWorkspaceStatus,
  collectCoverLetterMasterIssues,
  collectProfileDraftBlockingIssues,
  collectResumeMasterIssues,
  getProfileReadinessState,
  getProfileSourceState,
  getRankingEligibilityState,
  getReviewStateFromList,
  getReviewStateFromPresence,
  getReviewStateFromText,
  getSectionConfidence,
  hasAddDetailsPlaceholder,
} from '@/lib/profile/master-assets-review'

function normalizeTextBlock(value: unknown) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeConfidence(value: unknown): CanonicalConfidence {
  const candidate = asString(value).toLowerCase()

  if (candidate === 'low' || candidate === 'medium' || candidate === 'high') {
    return candidate
  }

  return 'high'
}

function normalizeApprovalStatus(value: unknown): CanonicalApprovalStatus {
  return asString(value).toLowerCase() === 'approved' ? 'approved' : 'draft'
}

function normalizeProvenanceRecord(value: unknown): MasterSectionProvenanceRecord {
  const record = asRecord(value)

  return {
    confidence: normalizeConfidence(record?.confidence),
    notes: normalizeStringList(record?.notes, 12),
    sourceLabels: normalizeStringList(record?.sourceLabels ?? record?.source_labels, 12),
  }
}

function normalizeProvenanceMap(
  value: unknown,
  requiredSections: string[],
): Record<string, MasterSectionProvenanceRecord> {
  const record = asRecord(value)
  const entries = Object.fromEntries(
    Object.entries(record ?? {}).map(([key, item]) => [key, normalizeProvenanceRecord(item)]),
  ) as Record<string, MasterSectionProvenanceRecord>

  for (const section of requiredSections) {
    if (!entries[section]) {
      entries[section] = {
        confidence: 'high',
        notes: [],
        sourceLabels: [],
      }
    }
  }

  return entries
}

function normalizeExperienceEntry(value: unknown): ResumeExperienceRecord {
  const record = asRecord(value)

  return {
    companyName: asString(record?.companyName ?? record?.company_name),
    roleTitle: asString(record?.roleTitle ?? record?.role_title),
    locationLabel: asString(record?.locationLabel ?? record?.location_label),
    startDate: asString(record?.startDate ?? record?.start_date),
    endDate: asString(record?.endDate ?? record?.end_date),
    summary: asString(record?.summary),
    highlights: normalizeStringList(record?.highlights, 8),
  }
}

function normalizeAchievementEntry(value: unknown): ResumeAchievementRecord {
  const record = asRecord(value)

  return {
    category: asString(record?.category),
    title: asString(record?.title),
    detail: asString(record?.detail),
  }
}

function normalizeEducationEntry(value: unknown): ResumeEducationRecord {
  const record = asRecord(value)

  return {
    schoolName: asString(record?.schoolName ?? record?.school_name),
    credential: asString(record?.credential),
    fieldOfStudy: asString(record?.fieldOfStudy ?? record?.field_of_study),
    startDate: asString(record?.startDate ?? record?.start_date),
    endDate: asString(record?.endDate ?? record?.end_date),
    notes: asString(record?.notes),
  }
}

function parseDateLabelToRange(value: string) {
  const cleaned = cleanLine(value.replace(/^\*|\*$/g, ''))
  const parts = cleaned.split('|').map((item) => cleanLine(item))
  const title = parts[0] ?? ''
  const dateLabel = parts[1] ?? ''
  const [startDate = '', endDate = ''] = dateLabel
    .split(/-|–|—/)
    .map((item) => cleanLine(item))
    .slice(0, 2)

  return {
    endDate: /present/i.test(endDate) ? '' : endDate,
    roleTitle: title,
    startDate,
  }
}

function formatDateRange(startDate: string, endDate: string) {
  const start = cleanLine(startDate)
  const end = cleanLine(endDate)

  if (start && end) {
    return `${start}-${end}`
  }

  if (start) {
    return `${start}-Present`
  }

  if (end) {
    return end
  }

  return ''
}

function splitSections(markdown: string) {
  const lines = normalizeTextBlock(markdown).split('\n')
  const sections: Array<{ body: string; title: string }> = []
  let currentTitle = ''
  let buffer: string[] = []

  for (const line of lines) {
    const titleMatch = line.match(/^##\s+(.+)$/)

    if (titleMatch) {
      if (currentTitle) {
        sections.push({
          body: buffer.join('\n').trim(),
          title: currentTitle,
        })
      }

      currentTitle = cleanLine(titleMatch[1])
      buffer = []
      continue
    }

    buffer.push(line)
  }

  if (currentTitle) {
    sections.push({
      body: buffer.join('\n').trim(),
      title: currentTitle,
    })
  }

  return sections
}

function splitSubsections(markdown: string) {
  const lines = normalizeTextBlock(markdown).split('\n')
  const sections: Array<{ body: string; title: string }> = []
  let currentTitle = ''
  let buffer: string[] = []

  for (const line of lines) {
    const titleMatch = line.match(/^###\s+(.+)$/)

    if (titleMatch) {
      if (currentTitle) {
        sections.push({
          body: buffer.join('\n').trim(),
          title: currentTitle,
        })
      }

      currentTitle = cleanLine(titleMatch[1])
      buffer = []
      continue
    }

    buffer.push(line)
  }

  if (currentTitle) {
    sections.push({
      body: buffer.join('\n').trim(),
      title: currentTitle,
    })
  }

  return sections
}

function extractBulletLines(markdown: string) {
  return normalizeTextBlock(markdown)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^- /.test(line))
    .map((line) => normalizeListItemText(line))
}

function extractParagraphText(markdown: string) {
  return normalizeTextBlock(markdown)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('- ') && !line.startsWith('### '))
    .join(' ')
    .trim()
}

function extractContactBulletValue(markdown: string, label: string) {
  const line = normalizeTextBlock(markdown)
    .split('\n')
    .find((item) => item.trim().toLowerCase().startsWith(`- ${label.toLowerCase()}:`))

  if (!line) {
    return ''
  }

  return cleanLine(line.replace(/^- [^:]+:/, ''))
}

function parseExperienceBlock(title: string, body: string): ResumeExperienceRecord {
  const lines = normalizeTextBlock(body)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const italicLine = lines.find((line) => /^\*.*\*$/.test(line)) ?? ''
  const summaryLines = lines.filter((line) => !/^\*.*\*$/.test(line) && !line.startsWith('- '))
  const roleDetails = parseDateLabelToRange(italicLine)

  return {
    companyName: cleanLine(title),
    endDate: roleDetails.endDate,
    highlights: extractBulletLines(body).slice(0, 6),
    locationLabel: '',
    roleTitle: roleDetails.roleTitle,
    startDate: roleDetails.startDate,
    summary: cleanLine(summaryLines.join(' ')),
  }
}

function parseEducationBlocks(markdown: string) {
  const blocks = normalizeTextBlock(markdown).split(/\n\s*\n/)
  const items: ResumeEducationRecord[] = []

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length === 0) {
      continue
    }

    const schoolLine = lines[0].replace(/^\*\*|\*\*$/g, '').trim()
    const credentialLine = lines[1] ?? ''
    const notes = lines.slice(2).join(' ')
    const [credentialPart = '', yearsPart = ''] = credentialLine.split('|').map((item) => cleanLine(item))
    const [startDate = '', endDate = ''] = yearsPart
      .split(/-|–|—/)
      .map((item) => cleanLine(item))
      .slice(0, 2)

    items.push({
      credential: credentialPart,
      endDate,
      fieldOfStudy: '',
      notes: cleanLine(notes),
      schoolName: schoolLine,
      startDate,
    })
  }

  return items
}

function parseProofBank(markdown: string) {
  return splitSubsections(markdown).map(
    (section): CoverLetterProofBankEntryRecord => ({
      bullets: extractBulletLines(section.body),
      context: '',
      label: section.title,
    }),
  )
}

function toAchievementHighlights(achievementBank: ResumeAchievementRecord[]) {
  return achievementBank
    .map((item) => cleanLine(item.detail || item.title))
    .filter(Boolean)
}

function toCertificationList(value: unknown) {
  if (Array.isArray(value)) {
    return normalizeStringList(value, 16)
  }

  return extractBulletLines(String(value ?? ''))
}

function defaultResumeProvenance() {
  return normalizeProvenanceMap(
    {},
    [
      'contact',
      'professionalSummary',
      'selectedImpactHighlights',
      'coreExpertise',
      'professionalExperience',
      'archivedExperience',
      'education',
      'certifications',
      'languages',
      'toolsPlatforms',
      'additionalInformation',
    ],
  )
}

function defaultCoverLetterProvenance() {
  return normalizeProvenanceMap(
    {},
    [
      'contact',
      'positioningPhilosophy',
      'proofBank',
      'capabilities',
      'toneVoice',
      'keyDifferentiators',
      'selectionRules',
      'outputConstraints',
    ],
  )
}

export function normalizeResumeMasterRecord(
  value: unknown,
  fallback?: Partial<ResumeMasterRecord>,
): ResumeMasterRecord {
  const record = asRecord(value)
  const sourceContent = asRecord(record?.source_content ?? record?.sourceContent) ?? {}
  const links = asRecord(record?.links) ?? {}
  const contactSnapshotRecord = asRecord(record?.contact_snapshot ?? record?.contactSnapshot)
  const sourceContactSnapshot = asRecord(sourceContent.contactSnapshot)
  const selectedImpactHighlights =
    normalizeStringList(record?.selected_impact_highlights ?? record?.selectedImpactHighlights, 16).length > 0
      ? normalizeStringList(record?.selected_impact_highlights ?? record?.selectedImpactHighlights, 16)
      : toAchievementHighlights(
          asObjectArray(record?.achievement_bank ?? record?.achievementBank).map(normalizeAchievementEntry),
        )
  const rawSourceText = asString(
    record?.raw_source_text ??
      record?.rawSourceText ??
      sourceContent.rawSourceText ??
      sourceContent.resumeDocumentText ??
      sourceContent.resume_document_text,
  )

  const normalized: ResumeMasterRecord = {
    additionalInformation: normalizeStringList(
      record?.additional_information ?? record?.additionalInformation,
      16,
    ),
    approvalStatus: normalizeApprovalStatus(record?.approval_status ?? record?.approvalStatus),
    approvedAt: asString(record?.approved_at ?? record?.approvedAt) || fallback?.approvedAt,
    archivedExperienceEntries: asObjectArray(
      record?.archived_experience_entries ?? record?.archivedExperienceEntries,
    ).map(normalizeExperienceEntry),
    baseCoverLetterText: asString(
      record?.base_cover_letter_text ??
        record?.baseCoverLetterText ??
        sourceContent.baseCoverLetterText ??
        sourceContent.base_cover_letter_text,
    ),
    baseTitle: asString(record?.base_title ?? record?.baseTitle ?? fallback?.baseTitle),
    contactSnapshot: {
      email: asString(
        contactSnapshotRecord?.email ?? sourceContactSnapshot?.email ?? fallback?.contactSnapshot?.email,
      ),
      linkedinUrl: asString(
        contactSnapshotRecord?.linkedinUrl ??
          contactSnapshotRecord?.linkedin_url ??
          links.linkedin ??
          fallback?.contactSnapshot?.linkedinUrl,
      ),
      location: asString(
        contactSnapshotRecord?.location ?? contactSnapshotRecord?.location_label ?? fallback?.contactSnapshot?.location,
      ),
      name: asString(
        contactSnapshotRecord?.name ?? sourceContent.displayName ?? fallback?.contactSnapshot?.name,
      ),
      phone: asString(
        contactSnapshotRecord?.phone ?? contactSnapshotRecord?.phone_number ?? fallback?.contactSnapshot?.phone,
      ),
      portfolioUrl: asString(
        contactSnapshotRecord?.portfolioUrl ??
          contactSnapshotRecord?.portfolio_url ??
          links.portfolio ??
          fallback?.contactSnapshot?.portfolioUrl,
      ),
      websiteUrl: asString(
        contactSnapshotRecord?.websiteUrl ??
          contactSnapshotRecord?.website_url ??
          links.website ??
          fallback?.contactSnapshot?.websiteUrl,
      ),
    },
    coreExpertise:
      normalizeStringList(record?.core_expertise ?? record?.coreExpertise, 16).length > 0
        ? normalizeStringList(record?.core_expertise ?? record?.coreExpertise, 16)
        : normalizeStringList(record?.skills_section ?? record?.skillsSection, 16),
    coverLetterPdfFileName: asString(
      sourceContent.coverLetterPdfFileName ??
        sourceContent.coverLetterSourceFileName ??
        sourceContent.cover_letter_pdf_file_name ??
        fallback?.coverLetterPdfFileName,
    ),
    educationEntries: asObjectArray(record?.education_entries ?? record?.educationEntries).map(
      normalizeEducationEntry,
    ),
    experienceEntries: asObjectArray(record?.experience_entries ?? record?.experienceEntries).map(
      normalizeExperienceEntry,
    ),
    achievementBank: asObjectArray(record?.achievement_bank ?? record?.achievementBank).map(
      normalizeAchievementEntry,
    ),
    generationIssues: normalizeStringList(
      record?.generation_issues ?? record?.generationIssues ?? sourceContent.generationIssues,
      16,
    ),
    hasSourceMaterial: false,
    languages: normalizeStringList(record?.languages ?? record?.language_entries, 16),
    portfolioPdfFileName: asString(
      sourceContent.portfolioPdfFileName ??
        sourceContent.portfolioFileName ??
        sourceContent.portfolio_pdf_file_name ??
        fallback?.portfolioPdfFileName,
    ),
    rawSourceText,
    renderedMarkdown: normalizeTextBlock(
      record?.rendered_markdown ??
        record?.renderedMarkdown ??
        sourceContent.renderedMarkdown ??
        sourceContent.masterResumeMarkdown,
    ),
    resumePdfFileName: asString(
      sourceContent.resumePdfFileName ??
        sourceContent.resumeSourceFileName ??
        sourceContent.resume_pdf_file_name ??
        fallback?.resumePdfFileName,
    ),
    sectionProvenance: normalizeProvenanceMap(
      record?.section_provenance ?? record?.sectionProvenance,
      Object.keys(defaultResumeProvenance()),
    ),
    selectedImpactHighlights,
    skillsSection: normalizeStringList(record?.skills_section ?? record?.skillsSection, 16),
    sourceContent,
    sourceFormat: asString(record?.source_format ?? record?.sourceFormat) || 'structured_json',
    summaryText: asString(record?.summary_text ?? record?.summaryText ?? fallback?.summaryText),
    certifications: normalizeStringList(record?.certifications, 16),
    toolsPlatforms:
      normalizeStringList(record?.tools_platforms ?? record?.toolsPlatforms, 16).length > 0
        ? normalizeStringList(record?.tools_platforms ?? record?.toolsPlatforms, 16)
        : normalizeStringList(record?.skills_section ?? record?.skillsSection, 16),
  }

  normalized.hasSourceMaterial = Boolean(
    normalized.baseTitle ||
      normalized.summaryText ||
      normalized.experienceEntries.length > 0 ||
      normalized.archivedExperienceEntries.length > 0 ||
      normalized.selectedImpactHighlights.length > 0 ||
      normalized.coreExpertise.length > 0 ||
      normalized.educationEntries.length > 0 ||
      normalized.certifications.length > 0 ||
      normalized.languages.length > 0 ||
      normalized.toolsPlatforms.length > 0 ||
      normalized.additionalInformation.length > 0 ||
      normalized.rawSourceText ||
      normalized.renderedMarkdown ||
      normalized.resumePdfFileName,
  )

  if (!normalized.renderedMarkdown && normalized.hasSourceMaterial) {
    normalized.renderedMarkdown = renderMasterResumeMarkdown(normalized)
  }

  return normalized
}

export function normalizeCoverLetterMasterRecord(
  value: unknown,
  fallback?: Partial<CoverLetterMasterRecord>,
): CoverLetterMasterRecord {
  const record = asRecord(value)
  const sourceContent = asRecord(record?.source_content ?? record?.sourceContent) ?? {}
  const contactSnapshotRecord = asRecord(record?.contact_snapshot ?? record?.contactSnapshot)
  const capabilitiesRecord = asRecord(record?.capabilities)
  const rawSourceText = asString(
    record?.raw_source_text ??
      record?.rawSourceText ??
      sourceContent.rawSourceText ??
      sourceContent.coverLetterSourceText ??
      sourceContent.coverLetterDocumentText ??
      sourceContent.cover_letter_document_text,
  )

  const normalized: CoverLetterMasterRecord = {
    approvalStatus: normalizeApprovalStatus(record?.approval_status ?? record?.approvalStatus),
    approvedAt: asString(record?.approved_at ?? record?.approvedAt) || fallback?.approvedAt,
    capabilities: {
      disciplines: normalizeStringList(
        capabilitiesRecord?.disciplines ?? record?.capability_disciplines ?? record?.capabilityDisciplines,
        16,
      ),
      productionTools: normalizeStringList(
        capabilitiesRecord?.productionTools ??
          capabilitiesRecord?.production_tools ??
          record?.capability_tools ??
          record?.capabilityTools,
        16,
      ),
    },
    contactSnapshot: {
      location: asString(
        contactSnapshotRecord?.location ?? contactSnapshotRecord?.location_label ?? fallback?.contactSnapshot?.location,
      ),
      name: asString(contactSnapshotRecord?.name ?? fallback?.contactSnapshot?.name),
      roleTargets: normalizeStringList(
        contactSnapshotRecord?.roleTargets ??
          contactSnapshotRecord?.role_targets ??
          record?.target_roles ??
          fallback?.contactSnapshot?.roleTargets,
        12,
      ),
    },
    generationIssues: normalizeStringList(
      record?.generation_issues ?? record?.generationIssues ?? sourceContent.generationIssues,
      16,
    ),
    hasSourceMaterial: false,
    keyDifferentiators: normalizeNarrativeTagList(
      record?.key_differentiators ?? record?.keyDifferentiators,
      16,
    ),
    outputConstraints: normalizeNarrativeTagList(
      record?.output_constraints ?? record?.outputConstraints,
      16,
    ),
    positioningPhilosophy: normalizeTextBlock(
      record?.positioning_philosophy ?? record?.positioningPhilosophy,
    ),
    proofBank: asObjectArray(record?.proof_bank ?? record?.proofBank).map((item) => ({
      bullets: normalizeStringList(item.bullets, 12),
      context: asString(item.context),
      label: asString(item.label),
    })),
    rawSourceText,
    renderedMarkdown: normalizeTextBlock(
      record?.rendered_markdown ??
        record?.renderedMarkdown ??
        sourceContent.renderedMarkdown ??
        sourceContent.masterCoverLetterMarkdown,
    ),
    sectionProvenance: normalizeProvenanceMap(
      record?.section_provenance ?? record?.sectionProvenance,
      Object.keys(defaultCoverLetterProvenance()),
    ),
    selectionRules: normalizeNarrativeTagList(record?.selection_rules ?? record?.selectionRules, 16),
    sourceContent,
    sourceFormat: asString(record?.source_format ?? record?.sourceFormat) || 'structured_json',
    toneVoice: normalizeNarrativeTagList(record?.tone_voice ?? record?.toneVoice, 16),
  }

  normalized.hasSourceMaterial = Boolean(
    normalized.positioningPhilosophy ||
      normalized.proofBank.length > 0 ||
      normalized.capabilities.disciplines.length > 0 ||
      normalized.capabilities.productionTools.length > 0 ||
      normalized.toneVoice.length > 0 ||
      normalized.keyDifferentiators.length > 0 ||
      normalized.outputConstraints.length > 0 ||
      normalized.rawSourceText ||
      normalized.renderedMarkdown,
  )

  if (!normalized.renderedMarkdown && normalized.hasSourceMaterial) {
    normalized.renderedMarkdown = renderMasterCoverLetterMarkdown(normalized)
  }

  return normalized
}

function renderContactLines(contactSnapshot: ResumeMasterRecord['contactSnapshot']) {
  const lines = [
    ['Location', contactSnapshot.location],
    ['Email', contactSnapshot.email],
    ['Phone', contactSnapshot.phone],
    ['Portfolio / Website', contactSnapshot.portfolioUrl || contactSnapshot.websiteUrl],
    ['LinkedIn', contactSnapshot.linkedinUrl],
  ]

  return lines
    .filter(([, value]) => cleanLine(value).length > 0)
    .map(([label, value]) => `- ${label}: ${value}`)
}

export function renderMasterResumeMarkdown(record: ResumeMasterRecord) {
  const sections: string[] = []
  const name = cleanLine(record.contactSnapshot.name) || ADD_DETAILS_PLACEHOLDER
  sections.push(`# ${name}`)

  if (cleanLine(record.baseTitle)) {
    sections.push(`*${cleanLine(record.baseTitle)}*`)
  }

  sections.push('## Contact')
  sections.push(
    renderContactLines(record.contactSnapshot).join('\n') || `- Name: ${ADD_DETAILS_PLACEHOLDER}`,
  )
  sections.push('')
  sections.push('## Professional Summary')
  sections.push(record.summaryText || ADD_DETAILS_PLACEHOLDER)
  sections.push('')
  sections.push('## Selected Impact Highlights')
  sections.push(
    record.selectedImpactHighlights.length > 0
      ? record.selectedImpactHighlights.map((item) => `- ${item}`).join('\n')
      : `- ${ADD_DETAILS_PLACEHOLDER}`,
  )
  sections.push('')
  sections.push('## Core Expertise')
  sections.push(
    record.coreExpertise.length > 0
      ? record.coreExpertise.map((item) => `- ${item}`).join('\n')
      : `- ${ADD_DETAILS_PLACEHOLDER}`,
  )
  sections.push('')
  sections.push('## Professional Experience')
  if (record.experienceEntries.length > 0) {
    for (const item of record.experienceEntries) {
      sections.push(`### ${item.companyName || ADD_DETAILS_PLACEHOLDER}`)
      const roleLine = [item.roleTitle || ADD_DETAILS_PLACEHOLDER, formatDateRange(item.startDate, item.endDate)]
        .filter(Boolean)
        .join(' | ')
      sections.push(`*${roleLine}*`)
      if (item.summary) {
        sections.push('')
        sections.push(item.summary)
      }
      if (item.highlights.length > 0) {
        sections.push('')
        sections.push(item.highlights.map((highlight) => `- ${highlight}`).join('\n'))
      }
      sections.push('')
    }
  } else {
    sections.push(ADD_DETAILS_PLACEHOLDER)
    sections.push('')
  }

  sections.push('## Earlier / Archived Experience')
  if (record.archivedExperienceEntries.length > 0) {
    for (const item of record.archivedExperienceEntries) {
      sections.push(`### ${item.companyName || ADD_DETAILS_PLACEHOLDER}`)
      const roleLine = [item.roleTitle || ADD_DETAILS_PLACEHOLDER, formatDateRange(item.startDate, item.endDate)]
        .filter(Boolean)
        .join(' | ')
      sections.push(`*${roleLine}*`)
      if (item.highlights.length > 0) {
        sections.push(item.highlights.map((highlight) => `- ${highlight}`).join('\n'))
      } else if (item.summary) {
        sections.push(`- ${item.summary}`)
      } else {
        sections.push(`- ${ADD_DETAILS_PLACEHOLDER}`)
      }
      sections.push('')
    }
  } else {
    sections.push(`- ${ADD_DETAILS_PLACEHOLDER}`)
    sections.push('')
  }

  sections.push('## Education')
  if (record.educationEntries.length > 0) {
    for (const item of record.educationEntries) {
      sections.push(`**${item.schoolName || ADD_DETAILS_PLACEHOLDER}**`)
      const credentialLine = [
        [item.credential, item.fieldOfStudy].filter(Boolean).join(', '),
        formatDateRange(item.startDate, item.endDate),
      ]
        .filter(Boolean)
        .join(' | ')
      sections.push(credentialLine || ADD_DETAILS_PLACEHOLDER)
      if (item.notes) {
        sections.push(item.notes)
      }
      sections.push('')
    }
  } else {
    sections.push(ADD_DETAILS_PLACEHOLDER)
    sections.push('')
  }

  sections.push('## Certifications')
  sections.push(
    record.certifications.length > 0
      ? record.certifications.map((item) => `- ${item}`).join('\n')
      : `- ${ADD_DETAILS_PLACEHOLDER}`,
  )
  sections.push('')
  sections.push('## Languages')
  sections.push(
    record.languages.length > 0
      ? record.languages.map((item) => `- ${item}`).join('\n')
      : `- ${ADD_DETAILS_PLACEHOLDER}`,
  )
  sections.push('')
  sections.push('## Tools & Platforms')
  sections.push(
    record.toolsPlatforms.length > 0
      ? record.toolsPlatforms.map((item) => `- ${item}`).join('\n')
      : `- ${ADD_DETAILS_PLACEHOLDER}`,
  )
  sections.push('')
  sections.push('## Additional Information')
  sections.push(
    record.additionalInformation.length > 0
      ? record.additionalInformation.map((item) => `- ${item}`).join('\n')
      : `- ${ADD_DETAILS_PLACEHOLDER}`,
  )

  return sections.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function renderMasterCoverLetterMarkdown(record: CoverLetterMasterRecord) {
  const sections: string[] = []
  sections.push('# Cover Letter Source')
  sections.push('')
  sections.push('## Contact / Target Roles')
  sections.push(`- Name: ${record.contactSnapshot.name || ADD_DETAILS_PLACEHOLDER}`)
  sections.push(`- Location: ${record.contactSnapshot.location || ADD_DETAILS_PLACEHOLDER}`)
  sections.push(
    `- Role Target: ${
      record.contactSnapshot.roleTargets.length > 0
        ? record.contactSnapshot.roleTargets.join(', ')
        : ADD_DETAILS_PLACEHOLDER
    }`,
  )
  sections.push('')
  sections.push('## Positioning / Design Philosophy')
  sections.push(record.positioningPhilosophy || ADD_DETAILS_PLACEHOLDER)
  sections.push('')
  sections.push('## Proof Bank')
  if (record.proofBank.length > 0) {
    for (const item of record.proofBank) {
      sections.push(`### ${item.label || ADD_DETAILS_PLACEHOLDER}`)
      if (item.context) {
        sections.push(item.context)
        sections.push('')
      }
      sections.push(
        item.bullets.length > 0
          ? item.bullets.map((bullet) => `- ${bullet}`).join('\n')
          : `- ${ADD_DETAILS_PLACEHOLDER}`,
      )
      sections.push('')
    }
  } else {
    sections.push(`- ${ADD_DETAILS_PLACEHOLDER}`)
    sections.push('')
  }
  sections.push('## Capabilities')
  sections.push('')
  sections.push('### Disciplines')
  sections.push(
    record.capabilities.disciplines.length > 0
      ? record.capabilities.disciplines.map((item) => `- ${item}`).join('\n')
      : `- ${ADD_DETAILS_PLACEHOLDER}`,
  )
  sections.push('')
  sections.push('### Production / Tools / Execution Strengths')
  sections.push(
    record.capabilities.productionTools.length > 0
      ? record.capabilities.productionTools.map((item) => `- ${item}`).join('\n')
      : `- ${ADD_DETAILS_PLACEHOLDER}`,
  )
  sections.push('')
  sections.push('## Tone and Voice')
  sections.push(
    record.toneVoice.length > 0
      ? record.toneVoice.map((item) => `- ${item}`).join('\n')
      : `- ${ADD_DETAILS_PLACEHOLDER}`,
  )
  sections.push('')
  sections.push('## Key Differentiators')
  sections.push(
    record.keyDifferentiators.length > 0
      ? record.keyDifferentiators.map((item) => `- ${item}`).join('\n')
      : `- ${ADD_DETAILS_PLACEHOLDER}`,
  )
  sections.push('')
  sections.push('## Selection Rules')
  sections.push(
    record.selectionRules.length > 0
      ? record.selectionRules.map((item) => `- ${item}`).join('\n')
      : `- ${ADD_DETAILS_PLACEHOLDER}`,
  )
  sections.push('')
  sections.push('## Output Constraints')
  sections.push(
    record.outputConstraints.length > 0
      ? record.outputConstraints.map((item) => `- ${item}`).join('\n')
      : `- ${ADD_DETAILS_PLACEHOLDER}`,
  )

  return sections.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function extractFirstHeading(markdown: string) {
  const match = normalizeTextBlock(markdown).match(/^#\s+(.+)$/m)
  return cleanLine(match?.[1] ?? '')
}

function extractResumeSubtitle(markdown: string) {
  const lines = normalizeTextBlock(markdown)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const headingIndex = lines.findIndex((line) => /^#\s+/.test(line))

  if (headingIndex < 0) {
    return ''
  }

  const nextLine = lines[headingIndex + 1] ?? ''
  return /^\*.*\*$/.test(nextLine) ? cleanLine(nextLine.replace(/^\*|\*$/g, '')) : ''
}

export function parseMasterResumeMarkdown(markdown: string) {
  const normalizedMarkdown = normalizeTextBlock(markdown)
  const sections = splitSections(normalizedMarkdown)
  const sectionMap = new Map(sections.map((section) => [section.title.toLowerCase(), section.body]))
  const contactBody = sectionMap.get('contact') ?? ''
  const professionalExperience = splitSubsections(sectionMap.get('professional experience') ?? '').map(
    (section) => parseExperienceBlock(section.title, section.body),
  )
  const archivedExperience = splitSubsections(sectionMap.get('earlier / archived experience') ?? '').map(
    (section) => parseExperienceBlock(section.title, section.body),
  )

  const parsed = normalizeResumeMasterRecord({
    achievement_bank: extractBulletLines(sectionMap.get('selected impact highlights') ?? '').map((detail) => ({
      category: 'highlight',
      detail,
      title: detail,
    })),
    additional_information: extractBulletLines(sectionMap.get('additional information') ?? ''),
    approved_at: null,
    approval_status: 'draft',
    archived_experience_entries: archivedExperience,
    base_title: extractResumeSubtitle(normalizedMarkdown).split('|')[0] ?? '',
    certifications: toCertificationList(sectionMap.get('certifications') ?? ''),
    contact_snapshot: {
      email: extractContactBulletValue(contactBody, 'Email'),
      linkedin_url: extractContactBulletValue(contactBody, 'LinkedIn'),
      location: extractContactBulletValue(contactBody, 'Location'),
      name: extractFirstHeading(normalizedMarkdown),
      phone: extractContactBulletValue(contactBody, 'Phone'),
      portfolio_url: extractContactBulletValue(contactBody, 'Portfolio / Website'),
      website_url: extractContactBulletValue(contactBody, 'Portfolio / Website'),
    },
    core_expertise: extractBulletLines(sectionMap.get('core expertise') ?? ''),
    education_entries: parseEducationBlocks(sectionMap.get('education') ?? ''),
    experience_entries: professionalExperience,
    languages: extractBulletLines(sectionMap.get('languages') ?? ''),
    raw_source_text: normalizedMarkdown,
    rendered_markdown: normalizedMarkdown,
    section_provenance: defaultResumeProvenance(),
    selected_impact_highlights: extractBulletLines(sectionMap.get('selected impact highlights') ?? ''),
    skills_section: extractBulletLines(sectionMap.get('core expertise') ?? ''),
    source_content: {
      parsedFrom: 'prepared-master-resume',
    },
    source_format: 'markdown_master',
    summary_text: extractParagraphText(sectionMap.get('professional summary') ?? ''),
    tools_platforms: extractBulletLines(sectionMap.get('tools & platforms') ?? ''),
  })

  parsed.sectionProvenance = Object.fromEntries(
    Object.entries(parsed.sectionProvenance).map(([section]) => [
      section,
      {
        confidence: 'high',
        notes: ['Parsed from prepared master resume markdown.'],
        sourceLabels: ['master_resume.md'],
      },
    ]),
  )

  return parsed
}

export function parseMasterCoverLetterMarkdown(markdown: string) {
  const normalizedMarkdown = normalizeTextBlock(markdown)
  const sections = splitSections(normalizedMarkdown)
  const sectionMap = new Map(sections.map((section) => [section.title.toLowerCase(), section.body]))
  const contactBody = sectionMap.get('contact / target roles') ?? sectionMap.get('contact') ?? ''
  const proofBank = parseProofBank(sectionMap.get('proof bank') ?? '')
  const capabilitiesSubsections = splitSubsections(sectionMap.get('capabilities') ?? '')
  const disciplines = capabilitiesSubsections.find((section) =>
    cleanLine(section.title).toLowerCase().includes('discipline'),
  )
  const tools = capabilitiesSubsections.find((section) => {
    const normalizedTitle = cleanLine(section.title).toLowerCase()
    return normalizedTitle.includes('production') || normalizedTitle.includes('tool')
  })

  const parsed = normalizeCoverLetterMasterRecord({
    approval_status: 'draft',
    capabilities: {
      disciplines: extractBulletLines(disciplines?.body ?? ''),
      productionTools: extractBulletLines(tools?.body ?? ''),
    },
    contact_snapshot: {
      location: extractContactBulletValue(contactBody, 'Location'),
      name: extractContactBulletValue(contactBody, 'Name') || extractFirstHeading(normalizedMarkdown),
      role_targets: extractContactBulletValue(contactBody, 'Role Target')
        .split(',')
        .map((item) => cleanLine(item))
        .filter(Boolean),
    },
    key_differentiators: extractBulletLines(sectionMap.get('key differentiators') ?? ''),
    output_constraints: extractBulletLines(sectionMap.get('output constraints') ?? ''),
    positioning_philosophy: extractParagraphText(
      sectionMap.get('positioning / design philosophy') ?? sectionMap.get('design philosophy') ?? '',
    ),
    proof_bank: proofBank,
    raw_source_text: normalizedMarkdown,
    rendered_markdown: normalizedMarkdown,
    section_provenance: defaultCoverLetterProvenance(),
    selection_rules: extractBulletLines(sectionMap.get('selection rules') ?? ''),
    source_content: {
      parsedFrom: 'prepared-master-cover-letter',
    },
    source_format: 'markdown_master',
    tone_voice: extractBulletLines(sectionMap.get('tone and voice') ?? ''),
  })

  parsed.sectionProvenance = Object.fromEntries(
    Object.entries(parsed.sectionProvenance).map(([section]) => [
      section,
      {
        confidence: 'high',
        notes: ['Parsed from prepared master cover-letter markdown.'],
        sourceLabels: ['master_cover_letter.md'],
      },
    ]),
  )

  return parsed
}
