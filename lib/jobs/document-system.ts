import type { ApplicationPacketRecord, OperatorWorkspaceRecord } from '@/lib/domain/types'
import type { QualifiedJobRecord } from '@/lib/jobs/contracts'

const PAGE_MARGIN_INCHES = 0.6
const LETTER_PAGE_HEIGHT_PT = 11 * 72
const PAGE_CONTENT_HEIGHT_PT = LETTER_PAGE_HEIGHT_PT - PAGE_MARGIN_INCHES * 2 * 72
// Two-page hard ceiling. Resumes may be 1 or 2 pages — never more. The 8pt buffer mirrors the
// previous one-page logic and accounts for tiny rounding differences between our character-width
// estimator and Word's actual layout.
const RESUME_MAX_PAGES = 2
const RESUME_SAFE_PAGE_HEIGHT_PT = PAGE_CONTENT_HEIGHT_PT * RESUME_MAX_PAGES - 8
// Floor that defines a "substantive" role for the bullet-minimum invariant. Trims must not push
// a substantive role below this number of bullets — that's how we used to end up with shallow
// one-bullet roles. The page-fitter prefers dropping the entire oldest role over violating this.
const SUBSTANTIVE_ROLE_MIN_HIGHLIGHTS = 3

/*
 * Editor-side placeholders (set by the canonical-source generator and shown in the profile
 * editor as "[Add details]" / "[Add info]" / "[TBD]" prompts) must NEVER appear in the
 * downloadable resume. If a field is empty enough that we'd otherwise emit a placeholder,
 * we drop the field entirely — the user explicitly said: if a fact isn't on their source
 * resume, don't invent a hint, just omit it.
 */
const PLACEHOLDER_TOKEN_RE = /\[\s*(?:add\s*details?|add\s*info|placeholder|tbd|todo|pending)\s*\]/gi

function stripPlaceholderTokens(value: string | null | undefined) {
  return String(value ?? '').replace(PLACEHOLDER_TOKEN_RE, ' ')
}

function normalizeBlockText(value: string | null | undefined) {
  return stripPlaceholderTokens(value)
    .replace(/\r\n?/g, '\n')
    .trim()
}

function normalizeInlineText(value: string | null | undefined) {
  return normalizeBlockText(value).replace(/\s+/g, ' ').trim()
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

  // Outcome / proof language earns the biggest bonus — these are the bullets that read like
  // real hiring proof regardless of role type.
  if (/(?:\bto\b|\bby\b|\bresulting in\b|\breduced\b|\bincreased\b|\bimproved\b|\bcut\b|\bboosted\b|\baccelerated\b|\bclarified\b|\bgenerated\b|\blaunched\b|\bdrove\b|\bshipped\b|\bdelivered\b|\bgrew\b|\bsaved\b|\bnegotiated\b|\bclosed\b)/.test(lower)) {
    score += 2
  }

  // Quantified bullets ("$3M", "20%", "12 markets") almost always win — bumped from +1 to +2.
  if (/\d|%|\$/.test(normalized)) {
    score += 2
  }

  if (/^(helped|worked on|responsible for|assisted|supported|involved in|participated in)\b/i.test(lower)) {
    score -= 2
  }

  if (normalized.split(/\s+/).length < 6) {
    score -= 1
  }

  return score
}

/*
 * Resume + cover letter visual theme. Modernised 2026-04 to match the screenshot template:
 * Aptos throughout (Microsoft's new default sans, ships with Word 365 / Office 2024+ — Word
 * substitutes Calibri or system sans on older installs, both of which still parse cleanly
 * through every modern ATS). Section headings get a thin bottom border (see
 * sectionHeading() in packet-material-export.ts) so the document reads as designed rather
 * than as a flat ATS dump.
 */
export const SHARED_DOCUMENT_THEME = {
  color: {
    primary: '000000',
    secondary: '666666',
  },
  fontFamily: 'Aptos',
  fontSizePt: {
    body: 10,
    // Section heading dropped from 14 → 10.5 so the bold ALL CAPS + bottom-rule treatment
    // reads as a section divider, not a sub-headline. The visual weight comes from the rule,
    // not the type size.
    heading: 10.5,
    // Job/role title sits between body and section-heading: a hair larger and bold so the
    // entry is visibly the start of a new role at a glance.
    roleTitle: 11,
    // Name was 18; bumped to 20 for the modern hero-name look.
    name: 20,
  },
  lineHeight: {
    body: 1,
  },
  page: {
    marginInches: PAGE_MARGIN_INCHES,
  },
  // Border sizing for paragraph rules. `size` is in 1/8 pt — value 6 = 0.75pt, which is what
  // Word ships as its default horizontal-rule thickness when you type "---" on a blank line.
  // `space` is the gap (in pt) between the text and the rule.
  border: {
    sectionRuleSize: 6,
    sectionRuleSpace: 2,
  },
  spacingPt: {
    afterBody: 4,
    afterCompact: 0,
    afterRoleEntry: 6,
    afterSectionHeading: 4,
    beforeSectionHeading: 10,
    beforeSignature: 12,
  },
} as const

const RESUME_BUDGET = {
  // Bumped from 100 → 180 so a single bullet can carry the action + scope + outcome shape the
  // prompt now requires. Bullets may wrap to a 2nd line; that's normal resume formatting and
  // does not change the rendered template's structure.
  bulletMaxLength: 180,
  educationEntryMaxLength: 140,
  educationEntryMaxCount: 3,
  // Bumped from 3 → 6 so senior candidates' fuller history can appear when it fits in 2 pages.
  // Older roles get the bullet minimums and are first to drop if we'd overflow.
  experienceEntryMaxRoles: 6,
  roleHeadingMaxLength: 96,
  // Bumped from 3 → 5. The page-fitter (fitResumeDraftToPageBudget) trims downward from this
  // ceiling per role to hit the 2-page cap, never below SUBSTANTIVE_ROLE_MIN_HIGHLIGHTS for
  // substantive roles.
  roleHighlightMaxCount: 5,
  roleMetaMaxLength: 84,
  roleSummaryMaxLength: 160,
  secondaryContactLinkCount: 2,
  // Bumped from 8 → 12 so the prompt's "8–12 entries, tools first" guidance has room to land.
  // The skills-line builder still wraps to a single line by character width, so this is a
  // ceiling, not a floor.
  skillsMaxCount: 12,
  skillsMaxLength: 200,
  summaryMaxLength: 280,
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

/*
 * Resume schema — split apart so the renderer can style the role title, company line, and
 * date range distinctly (bold left / italic-right tab / italic line). Previously the heading
 * was a single concatenated string which forced the renderer into a flat one-line look.
 */
export interface ResumeExperienceEntry {
  roleTitle: string
  companyLine: string
  dateRange: string
  highlights: string[]
  summary: string
}

export interface ResumeEducationEntry {
  credential: string
  schoolLine: string
  dateRange: string
  notes: string
}

export interface ResumeCertificateEntry {
  title: string
}

export const RESUME_SECTION_ORDER = [
  'Summary',
  'Work Experience',
  'Education',
  'Skills',
  'Certificates',
] as const

export interface ResumeDocumentSchema {
  certificates: ResumeCertificateEntry[]
  education: ResumeEducationEntry[]
  experience: ResumeExperienceEntry[]
  header: SharedDocumentHeader
  sectionOrder: typeof RESUME_SECTION_ORDER
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
  certificates: ResumeCertificateEntry[]
  education: ResumeEducationEntry[]
  experience: ResumeExperienceEntry[]
  header: SharedDocumentHeader
  sectionOrder: typeof RESUME_SECTION_ORDER
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

/*
 * Order skills with concrete tools/software first (highest ATS-keyword payoff), then everything
 * else by the existing priority patterns and source order. Tools are identified by the
 * candidate's own `toolsPlatforms` list (authoritative source) rather than a hardcoded keyword
 * whitelist — this keeps the function role-agnostic so it works for non-designers too. The old
 * implementation filtered out anything not matching the designer-keyword priority patterns,
 * which silently dropped real skills like "Salesforce", "Python", "financial modeling".
 */
function prioritizeResumeSkills(values: string[], toolNames: ReadonlySet<string>) {
  const normalizedTools = new Set(Array.from(toolNames).map((name) => name.toLowerCase()))

  return unique(values.map((value) => normalizeResumeSkill(value)))
    .filter(Boolean)
    .map((text, index) => {
      const isTool = normalizedTools.has(text.toLowerCase())
      // Tools get a flat 1000-point boost so they always sort above non-tools regardless of
      // the heuristic priority patterns. Within tools, source order wins; within non-tools,
      // the existing scoreResumeSkill ranking applies.
      const score = isTool ? 1000 - index * 0.01 : scoreResumeSkill(text, index)
      return { index, score, text }
    })
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

  // Allow up to 2 wrapped lines per bullet — required to fit action + scope + outcome shape
  // without truncating to a one-line summary. Anything wrapping past 2 lines is rejected to
  // keep the visual rhythm of the rendered DOCX consistent across resumes.
  return (
    normalized.length <= RESUME_BUDGET.bulletMaxLength &&
    getWrappedLineCount(normalized, RESUME_LAYOUT_WIDTH_UNITS.bullet) <= 2
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
    certificates: draft.certificates,
    education: draft.education,
    experience: draft.experience,
    header: draft.header,
    sectionOrder: draft.sectionOrder,
    skillsLine: buildSkillsLine(draft.skillsItems),
    summary: draft.summary,
  }
}

function sectionHeadingHeight() {
  return paragraphHeightForFontPt(
    1,
    SHARED_DOCUMENT_THEME.fontSizePt.heading,
    SHARED_DOCUMENT_THEME.spacingPt.afterSectionHeading + SHARED_DOCUMENT_THEME.border.sectionRuleSize / 8 + SHARED_DOCUMENT_THEME.border.sectionRuleSpace,
    SHARED_DOCUMENT_THEME.spacingPt.beforeSectionHeading,
  )
}

function measureResumeDraft(draft: ResumeSchemaDraft): number {
  let totalHeightPt = 0

  // Header
  totalHeightPt += paragraphHeightForFontPt(
    getWrappedLineCount(draft.header.name, RESUME_LAYOUT_WIDTH_UNITS.name),
    SHARED_DOCUMENT_THEME.fontSizePt.name,
    SHARED_DOCUMENT_THEME.spacingPt.afterCompact,
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

  // Summary section
  if (draft.summary) {
    totalHeightPt += sectionHeadingHeight()
    totalHeightPt += paragraphHeightForFontPt(
      getWrappedLineCount(draft.summary, RESUME_LAYOUT_WIDTH_UNITS.body),
      SHARED_DOCUMENT_THEME.fontSizePt.body,
      SHARED_DOCUMENT_THEME.spacingPt.afterBody,
    )
  }

  // Work experience section
  if (draft.experience.length > 0) {
    totalHeightPt += sectionHeadingHeight()

    for (const entry of draft.experience) {
      // Title + right-aligned date sit on a single paragraph; one line for the pair.
      totalHeightPt += paragraphHeightForFontPt(
        Math.max(
          getWrappedLineCount(entry.roleTitle, RESUME_LAYOUT_WIDTH_UNITS.body),
          getWrappedLineCount(entry.dateRange, RESUME_LAYOUT_WIDTH_UNITS.compact),
        ) || 1,
        SHARED_DOCUMENT_THEME.fontSizePt.roleTitle,
        SHARED_DOCUMENT_THEME.spacingPt.afterCompact,
      )

      if (entry.companyLine) {
        totalHeightPt += paragraphHeightForFontPt(
          getWrappedLineCount(entry.companyLine, RESUME_LAYOUT_WIDTH_UNITS.body),
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

      // After-entry breathing space between roles.
      totalHeightPt += SHARED_DOCUMENT_THEME.spacingPt.afterRoleEntry
    }
  }

  // Education section
  if (draft.education.length > 0) {
    totalHeightPt += sectionHeadingHeight()

    for (const entry of draft.education) {
      totalHeightPt += paragraphHeightForFontPt(
        Math.max(
          getWrappedLineCount(entry.credential, RESUME_LAYOUT_WIDTH_UNITS.body),
          getWrappedLineCount(entry.dateRange, RESUME_LAYOUT_WIDTH_UNITS.compact),
        ) || 1,
        SHARED_DOCUMENT_THEME.fontSizePt.roleTitle,
        SHARED_DOCUMENT_THEME.spacingPt.afterCompact,
      )

      if (entry.schoolLine) {
        totalHeightPt += paragraphHeightForFontPt(
          getWrappedLineCount(entry.schoolLine, RESUME_LAYOUT_WIDTH_UNITS.body),
          SHARED_DOCUMENT_THEME.fontSizePt.body,
          SHARED_DOCUMENT_THEME.spacingPt.afterCompact,
        )
      }

      if (entry.notes) {
        totalHeightPt += paragraphHeightForFontPt(
          getWrappedLineCount(entry.notes, RESUME_LAYOUT_WIDTH_UNITS.bullet),
          SHARED_DOCUMENT_THEME.fontSizePt.body,
          SHARED_DOCUMENT_THEME.spacingPt.afterCompact,
        )
      }

      totalHeightPt += SHARED_DOCUMENT_THEME.spacingPt.afterRoleEntry
    }
  }

  // Skills section
  const skillsLine = buildSkillsLine(draft.skillsItems)

  if (skillsLine) {
    totalHeightPt += sectionHeadingHeight()
    totalHeightPt += paragraphHeightForFontPt(
      getWrappedLineCount(skillsLine, RESUME_LAYOUT_WIDTH_UNITS.body),
      SHARED_DOCUMENT_THEME.fontSizePt.body,
      SHARED_DOCUMENT_THEME.spacingPt.afterBody,
    )
  }

  // Certificates section
  if (draft.certificates.length > 0) {
    totalHeightPt += sectionHeadingHeight()
    for (const cert of draft.certificates) {
      totalHeightPt += paragraphHeightForFontPt(
        getWrappedLineCount(cert.title, RESUME_LAYOUT_WIDTH_UNITS.body),
        SHARED_DOCUMENT_THEME.fontSizePt.body,
        SHARED_DOCUMENT_THEME.spacingPt.afterCompact,
      )
    }
  }

  return totalHeightPt
}

/*
 * Fit the draft within the 2-page hard ceiling. Trim order is biased to drop the LEAST
 * load-bearing content first: oldest roles' tail bullets, then summaries, then the oldest
 * role entirely, with skills/additional details only touched when role trims aren't enough.
 *
 * Key invariant: a substantive role (one with >= SUBSTANTIVE_ROLE_MIN_HIGHLIGHTS bullets after
 * generation) is never trimmed below that floor. If we'd otherwise have to, we drop the entire
 * oldest role instead. This is what prevents the "shallow one-bullet role" failure mode the
 * old one-page trimmer produced.
 *
 * Diagnostics keep the field name `fitsOnePage` for backward compatibility with any caller
 * inspecting it; semantically it now means "fits within the page budget" (1 or 2 pages).
 */
function fitResumeDraftToPageBudget(draft: ResumeSchemaDraft): ResumeOnePageDiagnostics {
  const trimSteps: string[] = []

  // Snapshot the as-generated bullet count per role so we can tell substantive from thin
  // roles. The floor only applies to roles that started substantive — a thin 2-bullet role
  // can be trimmed to 1 or even 0 if absolutely needed.
  const initialHighlightCount = draft.experience.map((entry) => entry.highlights.length)
  const isSubstantive = (index: number) => initialHighlightCount[index] >= SUBSTANTIVE_ROLE_MIN_HIGHLIGHTS

  const applyTrim = (label: string, trim: () => boolean) => {
    if (!trim()) {
      return false
    }

    trimSteps.push(label)
    return true
  }

  // Trim oldest-first by walking the experience array from the end (reverse-chronological
  // means index 0 is most recent). Drop a tail bullet only if doing so wouldn't push a
  // substantive role below the floor.
  const trimOldestRoleTailBullet = () => {
    for (let index = draft.experience.length - 1; index >= 0; index -= 1) {
      const entry = draft.experience[index]
      const floor = isSubstantive(index) ? SUBSTANTIVE_ROLE_MIN_HIGHLIGHTS : 1
      if (entry.highlights.length > floor) {
        entry.highlights.pop()
        return true
      }
    }
    return false
  }

  const trimOldestRoleSummary = () => {
    for (let index = draft.experience.length - 1; index >= 0; index -= 1) {
      if (draft.experience[index].summary) {
        draft.experience[index].summary = ''
        return true
      }
    }
    return false
  }

  const dropOldestRole = () => {
    if (draft.experience.length === 0) {
      return false
    }
    draft.experience.pop()
    initialHighlightCount.pop()
    return true
  }

  const reduceGlobalSummary = () => {
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
  }

  const trimCertificate = () => {
    if (draft.certificates.length === 0) {
      return false
    }
    draft.certificates.pop()
    return true
  }

  const trimSkillsTail = () => {
    if (draft.skillsItems.length === 0) {
      return false
    }
    draft.skillsItems.pop()
    return true
  }

  // Order matters. Earlier steps preserve more value; later steps are last resorts.
  const trimOrder: Array<() => boolean> = [
    () => applyTrim('Trimmed tail bullet from oldest role.', trimOldestRoleTailBullet),
    () => applyTrim('Cleared summary on oldest role.', trimOldestRoleSummary),
    () => applyTrim('Dropped oldest role entirely.', dropOldestRole),
    () => applyTrim('Reduced global summary.', reduceGlobalSummary),
    () => applyTrim('Removed lowest-priority certificate.', trimCertificate),
    () => applyTrim('Reduced skills list.', trimSkillsTail),
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

/*
 * Build a flat, opinionated experience entry from the master/packet source. Splits the
 * heading into its three displayable parts (bold role title, italic company line,
 * right-tabbed italic date) so the renderer can style each one. Skips empty fields
 * silently rather than emitting placeholder text.
 */
function buildExperienceEntry(entry: {
  companyName: string
  roleTitle: string
  locationLabel: string
  startDate: string
  endDate: string
  highlights: string[]
  summary: string
}): ResumeExperienceEntry {
  const roleTitle = normalizeInlineText(entry.roleTitle)
  const company = normalizeInlineText(entry.companyName)
  const location = normalizeInlineText(entry.locationLabel)
  // "Acme Corp (New York, NY)" — but if either piece is missing, just print what we have.
  const companyLine = company && location ? `${company} (${location})` : company || ''
  return {
    roleTitle,
    companyLine,
    dateRange: formatDateRange(entry.startDate, entry.endDate),
    highlights: selectResumeHighlights(entry.highlights),
    summary: limitToWholeSentences(entry.summary, 1),
  }
}

function buildEducationEntry(entry: {
  credential: string
  fieldOfStudy: string
  schoolName: string
  startDate: string
  endDate: string
  notes: string
}): ResumeEducationEntry | null {
  const credentialPieces = [entry.credential, entry.fieldOfStudy]
    .map((item) => normalizeInlineText(item))
    .filter(Boolean)
  const credential = credentialPieces.join(' in ')
  const schoolLine = normalizeInlineText(entry.schoolName)
  const dateRange = formatDateRange(entry.startDate, entry.endDate)
  const notes = normalizeInlineText(entry.notes)

  if (!credential && !schoolLine && !notes && !dateRange) {
    return null
  }

  return {
    credential,
    schoolLine,
    dateRange,
    notes,
  }
}

function buildSkillsItems(packet: ApplicationPacketRecord, workspace: OperatorWorkspaceRecord) {
  // Tools/platforms come first so they sort to the front of the skills line — that's the
  // candidate's authoritative software-and-tools list, which is what ATS keyword scanners
  // prize most. Then the LLM-tailored skillsSection, then the master's skillsSection.
  const toolNames = new Set(
    workspace.resumeMaster.toolsPlatforms
      .map((item) => normalizeResumeSkill(item))
      .filter(Boolean),
  )
  return prioritizeResumeSkills(
    [
      ...workspace.resumeMaster.toolsPlatforms.map((item) => normalizeResumeSkill(item)),
      ...packet.resumeVersion.skillsSection.map((item) => normalizeResumeSkill(item)),
      ...workspace.resumeMaster.skillsSection.map((item) => normalizeResumeSkill(item)),
    ],
    toolNames,
  )
}

function buildCertificateEntries(workspace: OperatorWorkspaceRecord): ResumeCertificateEntry[] {
  return unique(workspace.resumeMaster.certifications.map((item) => normalizeInlineText(item)))
    .filter(Boolean)
    .map((title) => ({ title }))
}

function buildResumeDraft(
  packet: ApplicationPacketRecord,
  workspace: OperatorWorkspaceRecord,
): ResumeSchemaDraft {
  const summarySource =
    normalizeBlockText(packet.professionalSummary) ||
    normalizeBlockText(packet.resumeVersion.summaryText) ||
    normalizeBlockText(workspace.resumeMaster.summaryText)
  const skillsItems = buildSkillsItems(packet, workspace).slice(0, RESUME_BUDGET.skillsMaxCount)
  const experience = packet.resumeVersion.experienceEntries
    .slice(0, RESUME_BUDGET.experienceEntryMaxRoles)
    .map(buildExperienceEntry)
    .filter((entry) =>
      Boolean(entry.roleTitle || entry.companyLine || entry.summary || entry.highlights.length > 0 || entry.dateRange),
    )
  const education = workspace.resumeMaster.educationEntries
    .slice(0, RESUME_BUDGET.educationEntryMaxCount)
    .map(buildEducationEntry)
    .filter((entry): entry is ResumeEducationEntry => entry !== null)
  const certificates = buildCertificateEntries(workspace)

  return {
    certificates,
    education,
    experience,
    header: buildSharedHeader(workspace),
    sectionOrder: RESUME_SECTION_ORDER,
    skillsItems,
    summary: limitToWholeSentences(summarySource, 3),
  }
}

export function buildResumeDocumentSchema(
  packet: ApplicationPacketRecord,
  workspace: OperatorWorkspaceRecord,
): ResumeDocumentSchema {
  const draft = buildResumeDraft(packet, workspace)
  fitResumeDraftToPageBudget(draft)
  return toResumeSchema(draft)
}

export function getResumeOnePageDiagnostics(
  packet: ApplicationPacketRecord,
  workspace: OperatorWorkspaceRecord,
): ResumeOnePageDiagnostics {
  const draft = buildResumeDraft(packet, workspace)
  return fitResumeDraftToPageBudget(draft)
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
