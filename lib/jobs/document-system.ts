import type { ApplicationPacketRecord, OperatorWorkspaceRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'

const PAGE_MARGIN_INCHES = 0.6
const LETTER_PAGE_HEIGHT_PT = 11 * 72
const PAGE_CONTENT_HEIGHT_PT = LETTER_PAGE_HEIGHT_PT - PAGE_MARGIN_INCHES * 2 * 72
const RESUME_SAFE_PAGE_HEIGHT_PT = PAGE_CONTENT_HEIGHT_PT - 8

function normalizeBlockText(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .trim()
}

function normalizeInlineText(value: string | null | undefined) {
  return normalizeBlockText(value).replace(/\s+/g, ' ').trim()
}

function isMeaningfulText(value: string | null | undefined) {
  return Boolean(normalizeBlockText(value))
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function formatDateRange(startDate: string | null | undefined, endDate: string | null | undefined) {
  const start = normalizeInlineText(startDate)
  const end = normalizeInlineText(endDate)

  if (start && end) {
    return `${start} - ${end}`
  }

  return start || end
}

function clipAtWord(text: string, maxLength: number) {
  const normalized = normalizeInlineText(text)

  if (!normalized || normalized.length <= maxLength) {
    return normalized
  }

  const clipped = normalized.slice(0, Math.max(0, maxLength - 3))
  const boundary = clipped.lastIndexOf(' ')

  return `${(boundary > 0 ? clipped.slice(0, boundary) : clipped).trim()}...`
}

function clipParagraph(text: string, maxLength: number, maxSentences?: number) {
  const normalized = normalizeBlockText(text)

  if (!normalized) {
    return ''
  }

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

  const limited = typeof maxSentences === 'number' ? sentences.slice(0, maxSentences).join(' ') : normalized

  return clipAtWord(limited, maxLength)
}

function ensureTerminalPunctuation(value: string) {
  const normalized = normalizeInlineText(value).replace(/\.{3,}/g, '.')

  if (!normalized) {
    return ''
  }

  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`
}

function splitCompleteSentences(value: string | null | undefined) {
  const normalized = normalizeBlockText(value).replace(/\.{3,}/g, '.')

  if (!normalized) {
    return []
  }

  if (!/[.!?]/.test(normalized)) {
    return [ensureTerminalPunctuation(normalized)]
  }

  return normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => ensureTerminalPunctuation(sentence))
    .filter(Boolean)
}

function limitToWholeSentences(value: string | null | undefined, maxSentences: number) {
  return splitCompleteSentences(value).slice(0, maxSentences).join(' ')
}

function joinLine(values: Array<string | null | undefined>) {
  return values
    .map((value) => normalizeInlineText(value))
    .filter(Boolean)
    .join(' | ')
}

function formatDisplayUrl(value: string | null | undefined) {
  const normalized = normalizeInlineText(value)

  if (!normalized) {
    return ''
  }

  return normalized
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '')
}

function splitParagraphs(value: string | null | undefined) {
  return normalizeBlockText(value)
    .split(/\n{2,}/)
    .map((paragraph) => normalizeBlockText(paragraph))
    .filter(Boolean)
}

function joinWholeItems(values: string[], maxItems: number) {
  return unique(values.map((value) => normalizeInlineText(value)))
    .filter(Boolean)
    .slice(0, maxItems)
    .join(' | ')
}

function toAdditionalLine(label: string, values: string[], maxItems: number) {
  const content = joinWholeItems(values, maxItems)

  if (!content) {
    return null
  }

  return {
    label,
    value: content,
  }
}

const RESUME_SKILL_LABELS = new Map<string, string>([
  ['adobe', 'Adobe Creative Suite'],
  ['adobe creative suite', 'Adobe Creative Suite'],
  ['adobe cc', 'Adobe Creative Suite'],
  ['accessibility', 'Accessibility (WCAG)'],
  ['design systems', 'Design systems'],
  ['figjam', 'FigJam'],
  ['figma', 'Figma'],
  ['html', 'HTML'],
  ['html/css', 'HTML/CSS'],
  ['html + css', 'HTML/CSS'],
  ['html and css', 'HTML/CSS'],
  ['css', 'CSS'],
  ['information architecture', 'Information architecture'],
  ['interaction design', 'Interaction design'],
  ['prototyping', 'Prototyping'],
  ['prototype', 'Prototyping'],
  ['research', 'User research'],
  ['ui design', 'UX/UI design'],
  ['ux/ui', 'UX/UI design'],
  ['ux ui', 'UX/UI design'],
  ['ux/ui design', 'UX/UI design'],
  ['ux design', 'UX/UI design'],
  ['usability testing', 'Usability testing'],
  ['user interviews', 'User interviews'],
  ['wcag', 'Accessibility (WCAG)'],
  ['wireframing', 'Wireframing'],
])

const RESUME_SKILL_PRIORITY_PATTERNS: Array<[RegExp, number]> = [
  [/^figma$/i, 110],
  [/^adobe creative suite$/i, 108],
  [/^html\/css$/i, 106],
  [/^html$/i, 104],
  [/^css$/i, 102],
  [/^figjam$/i, 100],
  [/^accessibility(?: \(wcag\))?$/i, 98],
  [/^design systems$/i, 96],
  [/^prototyping$/i, 94],
  [/^wireframing$/i, 92],
  [/^interaction design$/i, 90],
  [/^information architecture$/i, 88],
  [/^user research$/i, 86],
  [/^usability testing$/i, 84],
  [/^user interviews$/i, 82],
  [/^ux\/ui design$/i, 80],
]

const SPECIFIC_BULLET_REWRITES: Array<[RegExp, string]> = [
  [/^helped create\b/i, 'Created'],
  [/^helped build\b/i, 'Built'],
  [/^helped design\b/i, 'Designed'],
  [/^helped develop\b/i, 'Developed'],
  [/^helped improve\b/i, 'Improved'],
  [/^helped reduce\b/i, 'Reduced'],
  [/^assisted with creating\b/i, 'Created'],
  [/^assisted with building\b/i, 'Built'],
  [/^assisted with designing\b/i, 'Designed'],
  [/^assisted with developing\b/i, 'Developed'],
]

const WEAK_BULLET_PREFIXES: Array<[RegExp, string]> = [
  [/^responsible for\b/i, 'Led'],
  [/^worked on\b/i, 'Delivered'],
  [/^helped\b/i, 'Supported'],
  [/^assisted with\b/i, 'Supported'],
  [/^involved in\b/i, 'Led'],
  [/^participated in\b/i, 'Contributed to'],
]

function normalizeResumeSkill(value: string) {
  const normalized = normalizeInlineText(value)

  if (!normalized) {
    return ''
  }

  return RESUME_SKILL_LABELS.get(normalized.toLowerCase()) ?? normalized
}

function isConcreteResumeSkill(value: string) {
  return RESUME_SKILL_PRIORITY_PATTERNS.some(([pattern]) => pattern.test(value))
}

function normalizeResumeBullet(value: string) {
  let normalized = normalizeInlineText(value).replace(/^[•\-–—\s]+/, '')

  if (!normalized) {
    return ''
  }

  for (const [pattern, replacement] of SPECIFIC_BULLET_REWRITES) {
    if (pattern.test(normalized)) {
      normalized = normalized.replace(pattern, replacement)
      break
    }
  }

  for (const [pattern, replacement] of WEAK_BULLET_PREFIXES) {
    if (pattern.test(normalized)) {
      normalized = normalized.replace(pattern, replacement)
      break
    }
  }

  return ensureTerminalPunctuation(limitToWholeSentences(normalized, 1))
}

function scoreResumeBullet(value: string) {
  const normalized = normalizeInlineText(value)
  const lower = normalized.toLowerCase()
  let score = 0

  if (/^(led|built|designed|launched|improved|created|developed|streamlined|delivered|owned|drove|shipped|optimized|reduced|increased|scaled|defined|established|partnered|translated)\b/i.test(normalized)) {
    score += 3
  }

  if (/(?:\bto\b|\bby\b|\bresulting in\b|\breduced\b|\bincreased\b|\bimproved\b|\bcut\b|\bboosted\b|\baccelerated\b|\bclarified\b)/.test(lower)) {
    score += 2
  }

  if (/\d|%/.test(normalized)) {
    score += 1
  }

  if (/(figma|accessibility|design systems|user research|prototype|workflow|hiring|product|ux|ui|content design)/.test(lower)) {
    score += 1
  }

  if (/^(helped|worked on|responsible for|assisted|supported|involved in|participated in)\b/i.test(lower)) {
    score -= 2
  }

  if (normalized.split(/\s+/).length < 6) {
    score -= 1
  }

  return score
}

export const SHARED_DOCUMENT_THEME = {
  color: {
    primary: '000000',
    secondary: '666666',
  },
  fontFamily: 'Times New Roman',
  fontSizePt: {
    body: 10,
    heading: 14,
    name: 18,
  },
  lineHeight: {
    body: 1,
  },
  page: {
    marginInches: PAGE_MARGIN_INCHES,
  },
  spacingPt: {
    afterBody: 2,
    afterCompact: 0,
    afterSectionHeading: 2,
    beforeSectionHeading: 4,
    beforeSignature: 12,
  },
} as const

const RESUME_BUDGET = {
  additionalLineMaxLength: 90,
  additionalSectionMaxLines: 3,
  bulletMaxLength: 100,
  educationEntryMaxLength: 110,
  educationEntryMaxCount: 1,
  experienceEntryMaxRoles: 3,
  roleHeadingMaxLength: 84,
  roleHighlightMaxCount: 3,
  roleMetaMaxLength: 72,
  roleSummaryMaxLength: 110,
  secondaryContactLinkCount: 2,
  skillsMaxCount: 8,
  skillsMaxLength: 140,
  summaryMaxLength: 240,
} as const

const COVER_LETTER_BUDGET = {
  bodyParagraphMaxLength: 700,
  maxParagraphs: 3,
} as const

export interface SharedDocumentHeader {
  name: string
  primaryContactLine: string
  secondaryContactLine?: string
}

export interface ResumeDocumentSchema {
  additionalDetails: Array<{
    label: string
    value: string
  }>
  education: string[]
  experience: Array<{
    heading: string
    highlights: string[]
    meta: string
    summary: string
  }>
  header: SharedDocumentHeader
  sectionOrder: readonly ['Professional Summary', 'Core Skills', 'Professional Experience', 'Education', 'Additional Details']
  skillsLine: string
  summary: string
}

export interface CoverLetterDocumentSchema {
  bodyParagraphs: string[]
  companyLine: string
  dateLine: string
  header: SharedDocumentHeader
  roleLine: string
  salutation: string
  signatureName: string
}

interface ResumeSchemaDraft {
  additionalDetails: Array<{
    label: string
    value: string
  }>
  education: string[]
  experience: Array<{
    heading: string
    highlights: string[]
    meta: string
    summary: string
  }>
  header: SharedDocumentHeader
  sectionOrder: ResumeDocumentSchema['sectionOrder']
  skillsItems: string[]
  summary: string
}

export interface ResumeOnePageDiagnostics {
  fitsOnePage: boolean
  safeHeightPt: number
  totalHeightPt: number
  trimSteps: string[]
}

const RESUME_LAYOUT_WIDTH_UNITS = {
  body: 78,
  bullet: 82,
  compact: 82,
  heading: 64,
  name: 33,
} as const

function getCharacterUnits(character: string) {
  if (character === ' ') {
    return 0.35
  }

  if (/[ilI1'`.,:;!|]/.test(character)) {
    return 0.45
  }

  if (/[mwMW@#%&]/.test(character)) {
    return 1.2
  }

  if (/[A-Z0-9]/.test(character)) {
    return 0.95
  }

  return 0.82
}

function getWrappedLineCount(text: string, widthUnits: number) {
  const normalized = normalizeInlineText(text)

  if (!normalized) {
    return 0
  }

  let lineCount = 1
  let lineUnits = 0

  for (const word of normalized.split(/\s+/)) {
    const wordUnits = Array.from(word).reduce((sum, character) => sum + getCharacterUnits(character), 0)

    if (wordUnits > widthUnits) {
      if (lineUnits > 0) {
        lineCount += 1
      }

      lineCount += Math.max(1, Math.ceil(wordUnits / widthUnits)) - 1
      lineUnits = wordUnits % widthUnits
      continue
    }

    const nextUnits = lineUnits === 0 ? wordUnits : lineUnits + getCharacterUnits(' ') + wordUnits

    if (nextUnits > widthUnits && lineUnits > 0) {
      lineCount += 1
      lineUnits = wordUnits
      continue
    }

    lineUnits = nextUnits
  }

  return lineCount
}

function scoreResumeSkill(value: string, index: number) {
  let score = 50 - index * 0.01

  for (const [pattern, priority] of RESUME_SKILL_PRIORITY_PATTERNS) {
    if (pattern.test(value)) {
      score = priority - index * 0.01
      break
    }
  }

  if (/(figma|adobe|html|css|accessibility|design systems|prototyping|wireframing|research|testing|interviews)/i.test(value)) {
    score += 0.5
  }

  return score
}

function prioritizeResumeSkills(values: string[]) {
  return unique(values.map((value) => normalizeResumeSkill(value)))
    .filter(Boolean)
    .filter((value) => isConcreteResumeSkill(value))
    .map((text, index) => ({
      index,
      score: scoreResumeSkill(text, index),
      text,
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((item) => item.text)
}

function buildSkillsLine(skillsItems: string[]) {
  const selected: string[] = []

  for (const skill of skillsItems) {
    const candidate = selected.length > 0 ? `${selected.join(' | ')} | ${skill}` : skill

    if (
      candidate.length > RESUME_BUDGET.skillsMaxLength ||
      getWrappedLineCount(candidate, RESUME_LAYOUT_WIDTH_UNITS.body) > 1
    ) {
      break
    }

    selected.push(skill)
  }

  return selected.join(' | ')
}

function isUsableResumeBullet(value: string) {
  const normalized = normalizeInlineText(value)

  if (!normalized) {
    return false
  }

  return (
    normalized.length <= RESUME_BUDGET.bulletMaxLength &&
    getWrappedLineCount(normalized, RESUME_LAYOUT_WIDTH_UNITS.bullet) <= 1
  )
}

function selectResumeHighlights(highlights: string[]) {
  return highlights
    .map((highlight, index) => ({
      index,
      score: scoreResumeBullet(highlight),
      text: normalizeResumeBullet(highlight),
    }))
    .filter((highlight) => Boolean(highlight.text))
    .filter((highlight) => isUsableResumeBullet(highlight.text))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((highlight) => highlight.text)
    .slice(0, RESUME_BUDGET.roleHighlightMaxCount)
}

function paragraphHeightForFontPt(lineCount: number, fontSizePt: number, afterPt: number, beforePt = 0) {
  if (lineCount <= 0) {
    return 0
  }

  return beforePt + afterPt + lineCount * fontSizePt * SHARED_DOCUMENT_THEME.lineHeight.body
}

function toResumeSchema(draft: ResumeSchemaDraft): ResumeDocumentSchema {
  return {
    additionalDetails: draft.additionalDetails,
    education: draft.education,
    experience: draft.experience,
    header: draft.header,
    sectionOrder: draft.sectionOrder,
    skillsLine: buildSkillsLine(draft.skillsItems),
    summary: draft.summary,
  }
}

function measureResumeDraft(draft: ResumeSchemaDraft): number {
  let totalHeightPt = 0

  totalHeightPt += paragraphHeightForFontPt(
    getWrappedLineCount(draft.header.name, RESUME_LAYOUT_WIDTH_UNITS.name),
    SHARED_DOCUMENT_THEME.fontSizePt.name,
    SHARED_DOCUMENT_THEME.spacingPt.afterBody,
  )

  if (draft.header.primaryContactLine) {
    totalHeightPt += paragraphHeightForFontPt(
      getWrappedLineCount(draft.header.primaryContactLine, RESUME_LAYOUT_WIDTH_UNITS.compact),
      SHARED_DOCUMENT_THEME.fontSizePt.body,
      SHARED_DOCUMENT_THEME.spacingPt.afterCompact,
    )
  }

  if (draft.header.secondaryContactLine) {
    totalHeightPt += paragraphHeightForFontPt(
      getWrappedLineCount(draft.header.secondaryContactLine, RESUME_LAYOUT_WIDTH_UNITS.compact),
      SHARED_DOCUMENT_THEME.fontSizePt.body,
      SHARED_DOCUMENT_THEME.spacingPt.afterCompact,
    )
  }

  if (draft.summary) {
    totalHeightPt += paragraphHeightForFontPt(
      getWrappedLineCount('Professional Summary', RESUME_LAYOUT_WIDTH_UNITS.heading),
      SHARED_DOCUMENT_THEME.fontSizePt.heading,
      SHARED_DOCUMENT_THEME.spacingPt.afterSectionHeading,
      SHARED_DOCUMENT_THEME.spacingPt.beforeSectionHeading,
    )
    totalHeightPt += paragraphHeightForFontPt(
      getWrappedLineCount(draft.summary, RESUME_LAYOUT_WIDTH_UNITS.body),
      SHARED_DOCUMENT_THEME.fontSizePt.body,
      SHARED_DOCUMENT_THEME.spacingPt.afterBody,
    )
  }

  const skillsLine = buildSkillsLine(draft.skillsItems)

  if (skillsLine) {
    totalHeightPt += paragraphHeightForFontPt(
      getWrappedLineCount('Core Skills', RESUME_LAYOUT_WIDTH_UNITS.heading),
      SHARED_DOCUMENT_THEME.fontSizePt.heading,
      SHARED_DOCUMENT_THEME.spacingPt.afterSectionHeading,
      SHARED_DOCUMENT_THEME.spacingPt.beforeSectionHeading,
    )
    totalHeightPt += paragraphHeightForFontPt(
      getWrappedLineCount(skillsLine, RESUME_LAYOUT_WIDTH_UNITS.body),
      SHARED_DOCUMENT_THEME.fontSizePt.body,
      SHARED_DOCUMENT_THEME.spacingPt.afterBody,
    )
  }

  if (draft.experience.length > 0) {
    totalHeightPt += paragraphHeightForFontPt(
      getWrappedLineCount('Professional Experience', RESUME_LAYOUT_WIDTH_UNITS.heading),
      SHARED_DOCUMENT_THEME.fontSizePt.heading,
      SHARED_DOCUMENT_THEME.spacingPt.afterSectionHeading,
      SHARED_DOCUMENT_THEME.spacingPt.beforeSectionHeading,
    )

    for (const entry of draft.experience) {
      if (entry.heading) {
        totalHeightPt += paragraphHeightForFontPt(
          getWrappedLineCount(entry.heading, RESUME_LAYOUT_WIDTH_UNITS.body),
          SHARED_DOCUMENT_THEME.fontSizePt.body,
          SHARED_DOCUMENT_THEME.spacingPt.afterCompact,
        )
      }

      if (entry.meta) {
        totalHeightPt += paragraphHeightForFontPt(
          getWrappedLineCount(entry.meta, RESUME_LAYOUT_WIDTH_UNITS.compact),
          SHARED_DOCUMENT_THEME.fontSizePt.body,
          SHARED_DOCUMENT_THEME.spacingPt.afterCompact,
        )
      }

      if (entry.summary) {
        totalHeightPt += paragraphHeightForFontPt(
          getWrappedLineCount(entry.summary, RESUME_LAYOUT_WIDTH_UNITS.body),
          SHARED_DOCUMENT_THEME.fontSizePt.body,
          SHARED_DOCUMENT_THEME.spacingPt.afterBody,
        )
      }

      for (const highlight of entry.highlights) {
        totalHeightPt += paragraphHeightForFontPt(
          getWrappedLineCount(highlight, RESUME_LAYOUT_WIDTH_UNITS.bullet),
          SHARED_DOCUMENT_THEME.fontSizePt.body,
          SHARED_DOCUMENT_THEME.spacingPt.afterCompact,
        )
      }
    }
  }

  if (draft.education.length > 0) {
    totalHeightPt += paragraphHeightForFontPt(
      getWrappedLineCount('Education', RESUME_LAYOUT_WIDTH_UNITS.heading),
      SHARED_DOCUMENT_THEME.fontSizePt.heading,
      SHARED_DOCUMENT_THEME.spacingPt.afterSectionHeading,
      SHARED_DOCUMENT_THEME.spacingPt.beforeSectionHeading,
    )

    for (const entry of draft.education) {
      totalHeightPt += paragraphHeightForFontPt(
        getWrappedLineCount(entry, RESUME_LAYOUT_WIDTH_UNITS.body),
        SHARED_DOCUMENT_THEME.fontSizePt.body,
        SHARED_DOCUMENT_THEME.spacingPt.afterBody,
      )
    }
  }

  if (draft.additionalDetails.length > 0) {
    totalHeightPt += paragraphHeightForFontPt(
      getWrappedLineCount('Additional Details', RESUME_LAYOUT_WIDTH_UNITS.heading),
      SHARED_DOCUMENT_THEME.fontSizePt.heading,
      SHARED_DOCUMENT_THEME.spacingPt.afterSectionHeading,
      SHARED_DOCUMENT_THEME.spacingPt.beforeSectionHeading,
    )

    for (const detail of draft.additionalDetails) {
      totalHeightPt += paragraphHeightForFontPt(
        getWrappedLineCount(`${detail.label}: ${detail.value}`, RESUME_LAYOUT_WIDTH_UNITS.body),
        SHARED_DOCUMENT_THEME.fontSizePt.body,
        SHARED_DOCUMENT_THEME.spacingPt.afterCompact,
      )
    }
  }

  return totalHeightPt
}

function trimResumeDraftToOnePage(draft: ResumeSchemaDraft): ResumeOnePageDiagnostics {
  const trimSteps: string[] = []

  const applyTrim = (label: string, trim: () => boolean) => {
    if (!trim()) {
      return false
    }

    trimSteps.push(label)
    return true
  }

  const trimOrder: Array<() => boolean> = [
    () => applyTrim('Reduced global summary.', () => {
      const sentences = splitCompleteSentences(draft.summary)

      if (sentences.length > 1) {
        draft.summary = sentences.slice(0, sentences.length - 1).join(' ')
        return true
      }

      if (draft.summary) {
        draft.summary = ''
        return true
      }

      return false
    }),
    () => applyTrim('Removed lowest-priority additional detail.', () => {
      if (draft.additionalDetails.length === 0) {
        return false
      }

      draft.additionalDetails.pop()
      return true
    }),
    () => applyTrim('Reduced skills list.', () => {
      if (draft.skillsItems.length === 0) {
        return false
      }

      draft.skillsItems.pop()
      return true
    }),
    () => applyTrim('Removed oldest role summary.', () => {
      for (let index = draft.experience.length - 1; index >= 0; index -= 1) {
        if (draft.experience[index].summary) {
          draft.experience[index].summary = ''
          return true
        }
      }

      return false
    }),
    () => applyTrim('Dropped lowest-priority role.', () => {
      if (draft.experience.length === 0) {
        return false
      }

      draft.experience.pop()
      return true
    }),
  ]

  let totalHeightPt = measureResumeDraft(draft)

  while (totalHeightPt > RESUME_SAFE_PAGE_HEIGHT_PT) {
    let trimmed = false

    for (const step of trimOrder) {
      if (!step()) {
        continue
      }

      trimmed = true
      totalHeightPt = measureResumeDraft(draft)

      if (totalHeightPt <= RESUME_SAFE_PAGE_HEIGHT_PT) {
        break
      }
    }

    if (!trimmed) {
      break
    }
  }

  return {
    fitsOnePage: totalHeightPt <= RESUME_SAFE_PAGE_HEIGHT_PT,
    safeHeightPt: RESUME_SAFE_PAGE_HEIGHT_PT,
    totalHeightPt,
    trimSteps,
  }
}

function buildSharedHeader(workspace: OperatorWorkspaceRecord): SharedDocumentHeader {
  const contact = workspace.resumeMaster.contactSnapshot
  const primaryContactLine = joinLine([contact.location, contact.phone, contact.email])
  const secondaryLinks = [
    contact.linkedinUrl,
    contact.portfolioUrl || contact.websiteUrl,
    contact.websiteUrl && contact.websiteUrl !== contact.portfolioUrl ? contact.websiteUrl : '',
  ]
    .map(formatDisplayUrl)
    .filter(Boolean)
    .slice(0, RESUME_BUDGET.secondaryContactLinkCount)

  return {
    name: normalizeInlineText(contact.name),
    primaryContactLine,
    secondaryContactLine: secondaryLinks.length > 0 ? secondaryLinks.join(' | ') : undefined,
  }
}

export function buildResumeDocumentSchema(
  packet: ApplicationPacketRecord,
  workspace: OperatorWorkspaceRecord,
): ResumeDocumentSchema {
  // Keep the resume safely within one letter page by budgeting content here,
  // before docx rendering, instead of shrinking typography later.
  const summarySource =
    normalizeBlockText(packet.professionalSummary) ||
    normalizeBlockText(packet.resumeVersion.summaryText) ||
    normalizeBlockText(workspace.resumeMaster.summaryText)
  const skillsSource = prioritizeResumeSkills([
    ...packet.resumeVersion.skillsSection.map((item) => normalizeResumeSkill(item)),
    ...workspace.resumeMaster.skillsSection.map((item) => normalizeResumeSkill(item)),
    ...workspace.resumeMaster.toolsPlatforms.map((item) => normalizeResumeSkill(item)),
  ])
  const experience = packet.resumeVersion.experienceEntries.slice(0, RESUME_BUDGET.experienceEntryMaxRoles).map((entry) => ({
    heading: joinLine([entry.roleTitle, entry.companyName]),
    highlights: selectResumeHighlights(entry.highlights),
    meta: joinLine([entry.locationLabel, formatDateRange(entry.startDate, entry.endDate)]),
    summary: limitToWholeSentences(entry.summary, 1),
  }))
  const education = workspace.resumeMaster.educationEntries.slice(0, RESUME_BUDGET.educationEntryMaxCount).map((entry) =>
    [
      [entry.credential, entry.schoolName].filter((item) => isMeaningfulText(item)).map(normalizeInlineText).join(', '),
      [entry.fieldOfStudy, formatDateRange(entry.startDate, entry.endDate)]
        .filter((item) => isMeaningfulText(item))
        .map(normalizeInlineText)
        .join(' | '),
      isMeaningfulText(entry.notes) ? ensureTerminalPunctuation(entry.notes) : '',
    ]
      .filter(Boolean)
      .join(' | '),
  )
  const additionalDetails = [
    toAdditionalLine('Certifications', workspace.resumeMaster.certifications, 3),
    toAdditionalLine('Languages', workspace.resumeMaster.languages, 4),
    toAdditionalLine('Additional', workspace.resumeMaster.additionalInformation, 2),
  ]
    .filter((item): item is { label: string; value: string } => item !== null)
    .slice(0, RESUME_BUDGET.additionalSectionMaxLines)

  const draft: ResumeSchemaDraft = {
    additionalDetails,
    education: education.filter(Boolean),
    experience: experience.filter(
      (entry) => Boolean(entry.heading || entry.meta || entry.summary || entry.highlights.length > 0),
    ),
    header: buildSharedHeader(workspace),
    sectionOrder: [
      'Professional Summary',
      'Core Skills',
      'Professional Experience',
      'Education',
      'Additional Details',
    ],
    skillsItems: skillsSource.slice(0, RESUME_BUDGET.skillsMaxCount),
    summary: limitToWholeSentences(summarySource, 2),
  }

  trimResumeDraftToOnePage(draft)

  return toResumeSchema(draft)
}

export function getResumeOnePageDiagnostics(
  packet: ApplicationPacketRecord,
  workspace: OperatorWorkspaceRecord,
): ResumeOnePageDiagnostics {
  const summarySource =
    normalizeBlockText(packet.professionalSummary) ||
    normalizeBlockText(packet.resumeVersion.summaryText) ||
    normalizeBlockText(workspace.resumeMaster.summaryText)
  const skillsSource = prioritizeResumeSkills([
    ...packet.resumeVersion.skillsSection.map((item) => normalizeResumeSkill(item)),
    ...workspace.resumeMaster.skillsSection.map((item) => normalizeResumeSkill(item)),
    ...workspace.resumeMaster.toolsPlatforms.map((item) => normalizeResumeSkill(item)),
  ])
  const draft: ResumeSchemaDraft = {
    additionalDetails: [
      toAdditionalLine('Certifications', workspace.resumeMaster.certifications, 3),
      toAdditionalLine('Languages', workspace.resumeMaster.languages, 4),
      toAdditionalLine('Additional', workspace.resumeMaster.additionalInformation, 2),
    ]
      .filter((item): item is { label: string; value: string } => item !== null)
      .slice(0, RESUME_BUDGET.additionalSectionMaxLines),
    education: workspace.resumeMaster.educationEntries
      .slice(0, RESUME_BUDGET.educationEntryMaxCount)
      .map((entry) =>
        [
          [entry.credential, entry.schoolName].filter((item) => isMeaningfulText(item)).map(normalizeInlineText).join(', '),
          [entry.fieldOfStudy, formatDateRange(entry.startDate, entry.endDate)]
            .filter((item) => isMeaningfulText(item))
            .map(normalizeInlineText)
            .join(' | '),
          isMeaningfulText(entry.notes) ? ensureTerminalPunctuation(entry.notes) : '',
        ]
          .filter(Boolean)
          .join(' | '),
      )
      .filter(Boolean),
    experience: packet.resumeVersion.experienceEntries
      .slice(0, RESUME_BUDGET.experienceEntryMaxRoles)
      .map((entry) => ({
        heading: joinLine([entry.roleTitle, entry.companyName]),
        highlights: selectResumeHighlights(entry.highlights),
        meta: joinLine([entry.locationLabel, formatDateRange(entry.startDate, entry.endDate)]),
        summary: limitToWholeSentences(entry.summary, 1),
      }))
      .filter((entry) => Boolean(entry.heading || entry.meta || entry.summary || entry.highlights.length > 0)),
    header: buildSharedHeader(workspace),
    sectionOrder: [
      'Professional Summary',
      'Core Skills',
      'Professional Experience',
      'Education',
      'Additional Details',
    ],
    skillsItems: skillsSource.slice(0, RESUME_BUDGET.skillsMaxCount),
    summary: limitToWholeSentences(summarySource, 2),
  }

  return trimResumeDraftToOnePage(draft)
}

export function buildCoverLetterDocumentSchema({
  job,
  packet,
  workspace,
}: {
  job: Pick<QualifiedJobRecord, 'companyName' | 'title'>
  packet: ApplicationPacketRecord
  workspace: OperatorWorkspaceRecord
}): CoverLetterDocumentSchema {
  const header = buildSharedHeader(workspace)
  const paragraphSource = splitParagraphs(packet.coverLetterDraft)
    .map((paragraph) => clipParagraph(paragraph, COVER_LETTER_BUDGET.bodyParagraphMaxLength))
    .filter(Boolean)
  const normalizedParagraphs =
    paragraphSource.length <= COVER_LETTER_BUDGET.maxParagraphs
      ? paragraphSource
      : [
          paragraphSource[0],
          clipParagraph(paragraphSource.slice(1, -1).join(' '), COVER_LETTER_BUDGET.bodyParagraphMaxLength),
          paragraphSource[paragraphSource.length - 1],
        ].filter(Boolean)
  const exportDate = new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'long',
    timeZone: 'America/Toronto',
  }).format(new Date())

  return {
    bodyParagraphs: normalizedParagraphs,
    companyLine: clipAtWord(job.companyName, 80),
    dateLine: exportDate,
    header,
    roleLine: clipAtWord(job.title, 80),
    salutation: 'Hiring Team,',
    signatureName: header.name,
  }
}
