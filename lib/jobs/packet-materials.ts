import type { ApplicationPacketRecord, OperatorWorkspaceRecord } from '@/lib/domain/types'

function normalizeBlockText(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .trim()
}

function normalizeInlineText(value: string | null | undefined) {
  return normalizeBlockText(value).replace(/\s+/g, ' ').trim()
}

function hasPlaceholderText(value: string | null | undefined) {
  const normalized = normalizeBlockText(value)

  if (!normalized) {
    return false
  }

  return /\[[^\]]*add[^\]]*\]/i.test(normalized)
}

function isMeaningfulText(value: string | null | undefined) {
  const normalized = normalizeBlockText(value)
  return Boolean(normalized) && !hasPlaceholderText(normalized)
}

function dedupe(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function formatResumeDateRange(startDate: string, endDate: string) {
  const start = normalizeInlineText(startDate)
  const end = normalizeInlineText(endDate)

  if (start && end) {
    return `${start} - ${end}`
  }

  return start || end
}

function formatMaterialFileStem(companyName: string, jobTitle: string) {
  return [companyName.trim(), jobTitle.trim()]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildResumePreviewText(packet: ApplicationPacketRecord) {
  const sections = [
    normalizeBlockText(packet.resumeVersion.headlineText),
    normalizeBlockText(packet.professionalSummary),
    packet.resumeVersion.highlightedRequirements.length > 0
      ? `Highlighted requirements\n${packet.resumeVersion.highlightedRequirements.map((item) => `- ${item}`).join('\n')}`
      : '',
    packet.resumeVersion.skillsSection.length > 0
      ? `Skills\n${packet.resumeVersion.skillsSection.join(' | ')}`
      : '',
    packet.resumeVersion.experienceEntries.length > 0
      ? `Experience\n${packet.resumeVersion.experienceEntries
          .map((entry) => {
            const heading = [entry.roleTitle, entry.companyName]
              .map((value) => normalizeInlineText(value))
              .filter(Boolean)
              .join(' | ')
            const locationLine = isMeaningfulText(entry.locationLabel) ? normalizeInlineText(entry.locationLabel) : ''
            const datesLine = formatResumeDateRange(
              isMeaningfulText(entry.startDate) ? entry.startDate : '',
              isMeaningfulText(entry.endDate) ? entry.endDate : '',
            )
            const summary = isMeaningfulText(entry.summary) ? normalizeBlockText(entry.summary) : ''
            const highlights =
              entry.highlights.length > 0
                ? entry.highlights
                    .filter((highlight) => isMeaningfulText(highlight))
                    .map((highlight) => `- ${normalizeInlineText(highlight)}`)
                    .join('\n')
                : ''

            return [heading, locationLine, datesLine, summary, highlights]
              .filter(Boolean)
              .join('\n')
          })
          .filter(Boolean)
          .join('\n\n')}`
      : '',
    normalizeBlockText(packet.resumeVersion.tailoringNotes)
      ? `Tailoring notes\n${normalizeBlockText(packet.resumeVersion.tailoringNotes)}`
      : '',
  ].filter(Boolean)

  return sections.join('\n\n')
}

function buildCoverLetterPreviewText(packet: ApplicationPacketRecord) {
  return normalizeBlockText(packet.coverLetterDraft)
    .split(/\n{2,}/)
    .map((paragraph) => normalizeBlockText(paragraph))
    .filter((paragraph) => Boolean(paragraph) && !hasPlaceholderText(paragraph))
    .join('\n\n')
}

function collectResumeIssues(packet: ApplicationPacketRecord) {
  const issues: string[] = []

  if (!isMeaningfulText(packet.resumeVersion.headlineText)) {
    issues.push('headline')
  }

  if (!isMeaningfulText(packet.professionalSummary)) {
    issues.push('professional summary')
  }

  if (packet.resumeVersion.skillsSection.length === 0) {
    issues.push('core skills')
  }

  if (packet.resumeVersion.experienceEntries.length === 0) {
    issues.push('professional experience')
  }

  if (
    packet.resumeVersion.experienceEntries.some(
      (entry) =>
        hasPlaceholderText(entry.locationLabel) ||
        hasPlaceholderText(entry.startDate) ||
        hasPlaceholderText(entry.endDate) ||
        hasPlaceholderText(entry.summary) ||
        entry.highlights.some((highlight) => hasPlaceholderText(highlight)),
    )
  ) {
    issues.push('professional experience')
    issues.push('experience details / highlights')
  }

  return dedupe(issues)
}

function collectCoverLetterIssues(packet: ApplicationPacketRecord, workspace: OperatorWorkspaceRecord) {
  const issues: string[] = []

  if (hasPlaceholderText(packet.coverLetterDraft)) {
    issues.push('cover letter content')
  }

  if (
    hasPlaceholderText(workspace.resumeMaster.contactSnapshot.name) ||
    /\[[^\]]*name[^\]]*\]/i.test(packet.coverLetterDraft)
  ) {
    issues.push('contact details')
  }

  return dedupe(issues)
}

function formatIssueList(issues: string[]) {
  if (issues.length === 0) {
    return ''
  }

  if (issues.length === 1) {
    return issues[0]
  }

  if (issues.length === 2) {
    return `${issues[0]} and ${issues[1]}`
  }

  return `${issues.slice(0, -1).join(', ')}, and ${issues[issues.length - 1]}`
}

export interface PacketMaterialReview {
  blocked: boolean
  buttonLabel: string
  downloadFileName: string
  downloadHref: string
  previewText: string
  remediationHint?: string
  remediationLead?: string
}

export interface ResumeExportContent {
  additionalInformation: string[]
  certifications: string[]
  contactLines: string[]
  education: string[]
  experience: Array<{
    heading: string
    highlights: string[]
    meta: string
    summary: string
  }>
  headline: string
  languages: string[]
  name: string
  skills: string[]
  summary: string
  toolsPlatforms: string[]
}

export interface CoverLetterExportContent {
  bodyParagraphs: string[]
  contactLines: string[]
  name: string
}

export function buildResumeExportContent(packet: ApplicationPacketRecord, workspace: OperatorWorkspaceRecord): ResumeExportContent {
  const contact = workspace.resumeMaster.contactSnapshot

  return {
    additionalInformation: workspace.resumeMaster.additionalInformation.filter((item) => isMeaningfulText(item)).map(normalizeInlineText),
    certifications: workspace.resumeMaster.certifications.filter((item) => isMeaningfulText(item)).map(normalizeInlineText),
    contactLines: [
      [contact.location, contact.phone, contact.email]
        .filter((item) => isMeaningfulText(item))
        .map(normalizeInlineText)
        .join(' | '),
      [contact.portfolioUrl, contact.websiteUrl, contact.linkedinUrl]
        .filter((item) => isMeaningfulText(item))
        .map(normalizeInlineText)
        .join(' | '),
    ].filter(Boolean),
    education: workspace.resumeMaster.educationEntries
      .map((entry) =>
        [
          [entry.credential, entry.schoolName].filter((item) => isMeaningfulText(item)).map(normalizeInlineText).join(' | '),
          [entry.fieldOfStudy, formatResumeDateRange(entry.startDate, entry.endDate)]
            .filter((item) => isMeaningfulText(item))
            .map(normalizeInlineText)
            .join(' | '),
          isMeaningfulText(entry.notes) ? normalizeBlockText(entry.notes) : '',
        ]
          .filter(Boolean)
          .join('\n'),
      )
      .filter(Boolean),
    experience: packet.resumeVersion.experienceEntries
      .map((entry) => ({
        heading: [entry.roleTitle, entry.companyName]
          .filter((item) => isMeaningfulText(item))
          .map(normalizeInlineText)
          .join(' | '),
        highlights: entry.highlights.filter((item) => isMeaningfulText(item)).map(normalizeInlineText),
        meta: [entry.locationLabel, formatResumeDateRange(entry.startDate, entry.endDate)]
          .filter((item) => isMeaningfulText(item))
          .map(normalizeInlineText)
          .join(' | '),
        summary: isMeaningfulText(entry.summary) ? normalizeBlockText(entry.summary) : '',
      }))
      .filter((entry) => Boolean(entry.heading || entry.meta || entry.summary || entry.highlights.length > 0)),
    headline: isMeaningfulText(packet.resumeVersion.headlineText) ? normalizeInlineText(packet.resumeVersion.headlineText) : '',
    languages: workspace.resumeMaster.languages.filter((item) => isMeaningfulText(item)).map(normalizeInlineText),
    name: isMeaningfulText(contact.name) ? normalizeInlineText(contact.name) : '',
    skills: packet.resumeVersion.skillsSection.filter((item) => isMeaningfulText(item)).map(normalizeInlineText),
    summary: isMeaningfulText(packet.professionalSummary) ? normalizeBlockText(packet.professionalSummary) : '',
    toolsPlatforms: workspace.resumeMaster.toolsPlatforms.filter((item) => isMeaningfulText(item)).map(normalizeInlineText),
  }
}

export function buildCoverLetterExportContent(
  packet: ApplicationPacketRecord,
  workspace: OperatorWorkspaceRecord,
): CoverLetterExportContent {
  const contact = workspace.resumeMaster.contactSnapshot

  return {
    bodyParagraphs: normalizeBlockText(packet.coverLetterDraft)
      .split(/\n{2,}/)
      .map((paragraph) => normalizeBlockText(paragraph))
      .filter((paragraph) => Boolean(paragraph) && !hasPlaceholderText(paragraph)),
    contactLines: [
      [contact.location, contact.phone, contact.email]
        .filter((item) => isMeaningfulText(item))
        .map(normalizeInlineText)
        .join(' | '),
      [contact.portfolioUrl, contact.websiteUrl, contact.linkedinUrl]
        .filter((item) => isMeaningfulText(item))
        .map(normalizeInlineText)
        .join(' | '),
    ].filter(Boolean),
    name: isMeaningfulText(contact.name) ? normalizeInlineText(contact.name) : '',
  }
}

export function buildResumeMaterialReview({
  companyName,
  jobId,
  jobTitle,
  packet,
}: {
  companyName: string
  jobId: string
  jobTitle: string
  packet: ApplicationPacketRecord
}): PacketMaterialReview {
  const issues = collectResumeIssues(packet)
  const fileStem = formatMaterialFileStem(companyName, jobTitle) || 'application-materials'

  return {
    blocked: issues.length > 0,
    buttonLabel: 'Download Resume',
    downloadFileName: `${fileStem}-resume.docx`,
    downloadHref: `/api/jobs/${jobId}/materials/resume`,
    previewText: buildResumePreviewText(packet),
    remediationHint:
      issues.length > 0
        ? `Update ${formatIssueList(issues)} in Profile, regenerate the application materials, and review again here.`
        : undefined,
    remediationLead:
      issues.length > 0 ? 'Resume export is blocked until the missing profile sections are completed.' : undefined,
  }
}

export function buildCoverLetterMaterialReview({
  companyName,
  jobId,
  jobTitle,
  packet,
  workspace,
}: {
  companyName: string
  jobId: string
  jobTitle: string
  packet: ApplicationPacketRecord
  workspace: OperatorWorkspaceRecord
}): PacketMaterialReview {
  const issues = collectCoverLetterIssues(packet, workspace)
  const fileStem = formatMaterialFileStem(companyName, jobTitle) || 'application-materials'

  return {
    blocked: issues.length > 0,
    buttonLabel: 'Download Cover Letter',
    downloadFileName: `${fileStem}-cover-letter.docx`,
    downloadHref: `/api/jobs/${jobId}/materials/cover-letter`,
    previewText: buildCoverLetterPreviewText(packet),
    remediationHint:
      issues.length > 0
        ? `Update ${formatIssueList(issues)} in Profile, regenerate the application materials, and review again here.`
        : undefined,
    remediationLead:
      issues.length > 0 ? 'Cover letter export is blocked until the missing profile sections are completed.' : undefined,
  }
}
