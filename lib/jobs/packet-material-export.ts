import 'server-only'

import {
  AlignmentType,
  BorderStyle,
  Document,
  LevelFormat,
  LineRuleType,
  PageOrientation,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
  convertInchesToTwip,
} from 'docx'

import type { ApplicationPacketRecord, OperatorWorkspaceRecord } from '@/lib/domain/types'
import { type QualifiedJobRecord } from '@/lib/jobs/contracts'
import {
  SHARED_DOCUMENT_THEME,
  buildCoverLetterDocumentSchema,
  buildResumeDocumentSchema,
} from '@/lib/jobs/document-system'

function toHalfPoints(sizePt: number) {
  return sizePt * 2
}

function toTwip(points: number) {
  return points * 20
}

/*
 * Right-tab position for the bold-title-left / italic-date-right pattern. Letter page is 8.5",
 * margins 0.6" each side → content width 7.3" → 10512 twip. Used by role and education
 * entry headings so the date column lines up consistently throughout the document.
 */
const PAGE_CONTENT_WIDTH_TWIP = Math.round(
  (8.5 - 2 * SHARED_DOCUMENT_THEME.page.marginInches) * 1440,
)

const BODY_LINE_HEIGHT = Math.round(SHARED_DOCUMENT_THEME.lineHeight.body * 240)

/*
 * Custom bullet style. Word's default list-style bullet inherits the body run's font size
 * (10pt here) which makes the • glyph look oversized — the user reported it as "gigantic".
 * We ship a named numbering config with an explicit small bullet size (7pt) and a tight
 * hanging indent so wrapped bullet lines align with the bullet text, not the glyph. This is
 * still a proper Word list so ATS parsers recognise each paragraph as its own list item.
 */
const RESUME_BULLET_REFERENCE = 'resume-bullet'
const RESUME_BULLET_SIZE_PT = 7
const RESUME_BULLET_INDENT_TWIP = 288 // 0.2"
const RESUME_BULLET_HANGING_TWIP = 180 // 0.125"

const RESUME_NUMBERING_CONFIG = {
  config: [
    {
      levels: [
        {
          alignment: AlignmentType.LEFT,
          format: LevelFormat.BULLET,
          level: 0,
          style: {
            paragraph: {
              indent: {
                hanging: RESUME_BULLET_HANGING_TWIP,
                left: RESUME_BULLET_INDENT_TWIP,
              },
            },
            run: {
              font: SHARED_DOCUMENT_THEME.fontFamily,
              size: toHalfPoints(RESUME_BULLET_SIZE_PT),
            },
          },
          text: '\u2022',
        },
      ],
      reference: RESUME_BULLET_REFERENCE,
    },
  ],
}

function bodyParagraph(text: string) {
  return new Paragraph({
    children: [
      new TextRun({
        font: SHARED_DOCUMENT_THEME.fontFamily,
        size: toHalfPoints(SHARED_DOCUMENT_THEME.fontSizePt.body),
        text,
      }),
    ],
    spacing: {
      after: toTwip(SHARED_DOCUMENT_THEME.spacingPt.afterBody),
      line: BODY_LINE_HEIGHT,
      lineRule: LineRuleType.AUTO,
    },
  })
}

function compactParagraph(text: string, secondary = false) {
  return new Paragraph({
    children: [
      new TextRun({
        color: secondary ? SHARED_DOCUMENT_THEME.color.secondary : SHARED_DOCUMENT_THEME.color.primary,
        font: SHARED_DOCUMENT_THEME.fontFamily,
        size: toHalfPoints(SHARED_DOCUMENT_THEME.fontSizePt.body),
        text,
      }),
    ],
    spacing: {
      after: toTwip(SHARED_DOCUMENT_THEME.spacingPt.afterCompact),
      line: BODY_LINE_HEIGHT,
      lineRule: LineRuleType.AUTO,
    },
  })
}

/*
 * Section heading with a thin horizontal rule UNDER the text — Word's default-style border at
 * 0.75pt. Rendered as a paragraph border (border.bottom), which is ATS-safe (parsers ignore
 * border data and just read the paragraph text). The rule provides the visual separation the
 * old top-border heading lacked.
 */
function sectionHeading(text: string) {
  return new Paragraph({
    border: {
      bottom: {
        color: SHARED_DOCUMENT_THEME.color.primary,
        size: SHARED_DOCUMENT_THEME.border.sectionRuleSize,
        space: SHARED_DOCUMENT_THEME.border.sectionRuleSpace,
        style: BorderStyle.SINGLE,
      },
    },
    children: [
      new TextRun({
        bold: true,
        characterSpacing: 12,
        font: SHARED_DOCUMENT_THEME.fontFamily,
        size: toHalfPoints(SHARED_DOCUMENT_THEME.fontSizePt.heading),
        text: text.toUpperCase(),
      }),
    ],
    spacing: {
      after: toTwip(SHARED_DOCUMENT_THEME.spacingPt.afterSectionHeading),
      before: toTwip(SHARED_DOCUMENT_THEME.spacingPt.beforeSectionHeading),
      line: BODY_LINE_HEIGHT,
      lineRule: LineRuleType.AUTO,
    },
  })
}

function bulletParagraph(text: string) {
  return new Paragraph({
    children: [
      new TextRun({
        font: SHARED_DOCUMENT_THEME.fontFamily,
        size: toHalfPoints(SHARED_DOCUMENT_THEME.fontSizePt.body),
        text,
      }),
    ],
    numbering: {
      level: 0,
      reference: RESUME_BULLET_REFERENCE,
    },
    spacing: {
      after: toTwip(SHARED_DOCUMENT_THEME.spacingPt.afterCompact),
      line: BODY_LINE_HEIGHT,
      lineRule: LineRuleType.AUTO,
    },
  })
}

/*
 * One-line entry header used by both Work Experience and Education sections:
 *   **Bold title**                                         *Italic dates (right-aligned)*
 * Achieved with a single right tab stop at the content edge. Falls back to a single-line bold
 * title when no date is present so the layout doesn't collapse on entries with missing dates.
 */
function entryTitleParagraph({ title, dateRange }: { title: string; dateRange: string }) {
  const children = [
    new TextRun({
      bold: true,
      font: SHARED_DOCUMENT_THEME.fontFamily,
      size: toHalfPoints(SHARED_DOCUMENT_THEME.fontSizePt.roleTitle),
      text: title,
    }),
  ]

  if (dateRange) {
    children.push(
      new TextRun({
        font: SHARED_DOCUMENT_THEME.fontFamily,
        size: toHalfPoints(SHARED_DOCUMENT_THEME.fontSizePt.body),
        text: '\t',
      }),
      new TextRun({
        font: SHARED_DOCUMENT_THEME.fontFamily,
        italics: true,
        size: toHalfPoints(SHARED_DOCUMENT_THEME.fontSizePt.body),
        text: dateRange,
      }),
    )
  }

  return new Paragraph({
    children,
    spacing: {
      after: toTwip(SHARED_DOCUMENT_THEME.spacingPt.afterCompact),
      line: BODY_LINE_HEIGHT,
      lineRule: LineRuleType.AUTO,
    },
    tabStops: dateRange
      ? [{ position: PAGE_CONTENT_WIDTH_TWIP, type: TabStopType.RIGHT }]
      : undefined,
  })
}

function italicCompanyParagraph(text: string) {
  return new Paragraph({
    children: [
      new TextRun({
        font: SHARED_DOCUMENT_THEME.fontFamily,
        italics: true,
        size: toHalfPoints(SHARED_DOCUMENT_THEME.fontSizePt.body),
        text,
      }),
    ],
    spacing: {
      after: toTwip(SHARED_DOCUMENT_THEME.spacingPt.afterCompact),
      line: BODY_LINE_HEIGHT,
      lineRule: LineRuleType.AUTO,
    },
  })
}

function entrySpacer() {
  return new Paragraph({
    children: [],
    spacing: {
      after: toTwip(SHARED_DOCUMENT_THEME.spacingPt.afterRoleEntry),
      before: 0,
      line: BODY_LINE_HEIGHT,
      lineRule: LineRuleType.AUTO,
    },
  })
}

function createSharedDocument(children: Paragraph[]) {
  return new Document({
    // Registered once at the document level so every bullet paragraph can reference it by name.
    // Harmless for the cover letter (which has no bullets) — the config just sits unused.
    numbering: RESUME_NUMBERING_CONFIG,
    sections: [
      {
        children,
        properties: {
          page: {
            margin: {
              bottom: convertInchesToTwip(SHARED_DOCUMENT_THEME.page.marginInches),
              left: convertInchesToTwip(SHARED_DOCUMENT_THEME.page.marginInches),
              right: convertInchesToTwip(SHARED_DOCUMENT_THEME.page.marginInches),
              top: convertInchesToTwip(SHARED_DOCUMENT_THEME.page.marginInches),
            },
            size: {
              height: 15840,
              orientation: PageOrientation.PORTRAIT,
              width: 12240,
            },
          },
        },
      },
    ],
    styles: {
      default: {
        document: {
          paragraph: {
            spacing: {
              line: BODY_LINE_HEIGHT,
              lineRule: LineRuleType.AUTO,
            },
          },
          run: {
            color: SHARED_DOCUMENT_THEME.color.primary,
            font: SHARED_DOCUMENT_THEME.fontFamily,
            size: toHalfPoints(SHARED_DOCUMENT_THEME.fontSizePt.body),
          },
        },
      },
    },
  })
}

export async function buildResumeDocxBuffer({
  packet,
  workspace,
}: {
  packet: ApplicationPacketRecord
  workspace: OperatorWorkspaceRecord
}) {
  const content = buildResumeDocumentSchema(packet, workspace)
  const children: Paragraph[] = []

  // Hero name — large bold, left-aligned at the top of page 1.
  if (content.header.name) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            bold: true,
            font: SHARED_DOCUMENT_THEME.fontFamily,
            size: toHalfPoints(SHARED_DOCUMENT_THEME.fontSizePt.name),
            text: content.header.name,
          }),
        ],
        spacing: {
          after: toTwip(SHARED_DOCUMENT_THEME.spacingPt.afterCompact),
          line: BODY_LINE_HEIGHT,
          lineRule: LineRuleType.AUTO,
        },
      }),
    )
  }

  // Contact lines stay close to the name so the header reads as one block.
  if (content.header.primaryContactLine) {
    children.push(compactParagraph(content.header.primaryContactLine))
  }

  if (content.header.secondaryContactLine) {
    children.push(compactParagraph(content.header.secondaryContactLine))
  }

  if (content.summary) {
    children.push(sectionHeading('Summary'))
    children.push(bodyParagraph(content.summary))
  }

  if (content.experience.length > 0) {
    children.push(sectionHeading('Work Experience'))

    content.experience.forEach((entry, index) => {
      children.push(entryTitleParagraph({ title: entry.roleTitle, dateRange: entry.dateRange }))

      if (entry.companyLine) {
        children.push(italicCompanyParagraph(entry.companyLine))
      }

      if (entry.summary) {
        children.push(bodyParagraph(entry.summary))
      }

      for (const highlight of entry.highlights) {
        children.push(bulletParagraph(highlight))
      }

      // Breathing space between role entries, but not after the last one (the next section
      // heading already brings its own `before` spacing).
      if (index < content.experience.length - 1) {
        children.push(entrySpacer())
      }
    })
  }

  if (content.education.length > 0) {
    children.push(sectionHeading('Education'))

    content.education.forEach((entry, index) => {
      children.push(
        entryTitleParagraph({
          title: entry.credential || entry.schoolLine,
          dateRange: entry.dateRange,
        }),
      )

      if (entry.credential && entry.schoolLine) {
        children.push(italicCompanyParagraph(entry.schoolLine))
      }

      // Education notes render as plain body text, not bullets — user-facing callout for
      // GPA / honours / coursework reads better as a line than as a list item. Bullets are
      // reserved for the Work Experience section where they carry proof-point density.
      if (entry.notes) {
        children.push(bodyParagraph(entry.notes))
      }

      if (index < content.education.length - 1) {
        children.push(entrySpacer())
      }
    })
  }

  if (content.skillsLine) {
    children.push(sectionHeading('Skills'))
    children.push(bodyParagraph(content.skillsLine))
  }

  if (content.certificates.length > 0) {
    children.push(sectionHeading('Certificates'))
    for (const cert of content.certificates) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              bold: true,
              font: SHARED_DOCUMENT_THEME.fontFamily,
              size: toHalfPoints(SHARED_DOCUMENT_THEME.fontSizePt.body),
              text: cert.title,
            }),
          ],
          spacing: {
            after: toTwip(SHARED_DOCUMENT_THEME.spacingPt.afterCompact),
            line: BODY_LINE_HEIGHT,
            lineRule: LineRuleType.AUTO,
          },
        }),
      )
    }
  }

  const document = createSharedDocument(children)

  return Packer.toBuffer(document)
}

export async function buildCoverLetterDocxBuffer({
  job,
  packet,
  workspace,
}: {
  job: QualifiedJobRecord
  packet: ApplicationPacketRecord
  workspace: OperatorWorkspaceRecord
}) {
  const content = buildCoverLetterDocumentSchema({
    job,
    packet,
    workspace,
  })
  const children: Paragraph[] = []

  if (content.header.name) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            bold: true,
            font: SHARED_DOCUMENT_THEME.fontFamily,
            size: toHalfPoints(SHARED_DOCUMENT_THEME.fontSizePt.name),
            text: content.header.name,
          }),
        ],
        spacing: {
          after: toTwip(SHARED_DOCUMENT_THEME.spacingPt.afterCompact),
          line: BODY_LINE_HEIGHT,
          lineRule: LineRuleType.AUTO,
        },
      }),
    )
  }

  if (content.header.primaryContactLine) {
    children.push(compactParagraph(content.header.primaryContactLine))
  }

  if (content.header.secondaryContactLine) {
    children.push(compactParagraph(content.header.secondaryContactLine))
  }

  children.push(bodyParagraph(content.dateLine))
  children.push(bodyParagraph(content.companyLine))
  children.push(bodyParagraph(content.roleLine))
  children.push(bodyParagraph(content.salutation))

  for (const paragraph of content.bodyParagraphs) {
    children.push(bodyParagraph(paragraph))
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          font: SHARED_DOCUMENT_THEME.fontFamily,
          size: toHalfPoints(SHARED_DOCUMENT_THEME.fontSizePt.body),
          text: 'Sincerely,',
        }),
      ],
      spacing: {
        after: toTwip(SHARED_DOCUMENT_THEME.spacingPt.afterBody),
        before: toTwip(SHARED_DOCUMENT_THEME.spacingPt.beforeSignature),
        line: BODY_LINE_HEIGHT,
        lineRule: LineRuleType.AUTO,
      },
    }),
  )
  children.push(bodyParagraph(content.signatureName))

  const document = createSharedDocument(children)

  return Packer.toBuffer(document)
}
