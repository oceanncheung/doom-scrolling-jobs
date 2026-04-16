import 'server-only'

import { BorderStyle, Document, LineRuleType, PageOrientation, Packer, Paragraph, TextRun, convertInchesToTwip } from 'docx'

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
      line: Math.round(SHARED_DOCUMENT_THEME.lineHeight.body * 240),
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
      line: Math.round(SHARED_DOCUMENT_THEME.lineHeight.body * 240),
      lineRule: LineRuleType.AUTO,
    },
  })
}

function sectionHeading(text: string) {
  return new Paragraph({
    border: {
      top: {
        color: SHARED_DOCUMENT_THEME.color.primary,
        size: 2,
        space: 1,
        style: BorderStyle.SINGLE,
      },
    },
    children: [
      new TextRun({
        bold: true,
        font: SHARED_DOCUMENT_THEME.fontFamily,
        size: toHalfPoints(SHARED_DOCUMENT_THEME.fontSizePt.heading),
        text,
      }),
    ],
    spacing: {
      after: toTwip(SHARED_DOCUMENT_THEME.spacingPt.afterSectionHeading),
      before: toTwip(SHARED_DOCUMENT_THEME.spacingPt.beforeSectionHeading),
      line: Math.round(SHARED_DOCUMENT_THEME.lineHeight.body * 240),
      lineRule: LineRuleType.AUTO,
    },
  })
}

function bulletParagraph(text: string) {
  return new Paragraph({
    bullet: {
      level: 0,
    },
    children: [
      new TextRun({
        font: SHARED_DOCUMENT_THEME.fontFamily,
        size: toHalfPoints(SHARED_DOCUMENT_THEME.fontSizePt.body),
        text,
      }),
    ],
    spacing: {
      after: toTwip(SHARED_DOCUMENT_THEME.spacingPt.afterCompact),
      line: Math.round(SHARED_DOCUMENT_THEME.lineHeight.body * 240),
      lineRule: LineRuleType.AUTO,
    },
  })
}

function labeledParagraph(label: string, value: string) {
  return new Paragraph({
    children: [
      new TextRun({
        bold: true,
        font: SHARED_DOCUMENT_THEME.fontFamily,
        size: toHalfPoints(SHARED_DOCUMENT_THEME.fontSizePt.body),
        text: `${label}: `,
      }),
      new TextRun({
        font: SHARED_DOCUMENT_THEME.fontFamily,
        size: toHalfPoints(SHARED_DOCUMENT_THEME.fontSizePt.body),
        text: value,
      }),
    ],
    spacing: {
      after: toTwip(SHARED_DOCUMENT_THEME.spacingPt.afterCompact),
      line: Math.round(SHARED_DOCUMENT_THEME.lineHeight.body * 240),
      lineRule: LineRuleType.AUTO,
    },
  })
}

function createSharedDocument(children: Paragraph[]) {
  return new Document({
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
              line: Math.round(SHARED_DOCUMENT_THEME.lineHeight.body * 240),
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
          after: toTwip(SHARED_DOCUMENT_THEME.spacingPt.afterBody),
          line: Math.round(SHARED_DOCUMENT_THEME.lineHeight.body * 240),
          lineRule: LineRuleType.AUTO,
        },
      }),
    )
  }

  if (content.header.primaryContactLine) {
    children.push(compactParagraph(content.header.primaryContactLine, true))
  }

  if (content.header.secondaryContactLine) {
    children.push(compactParagraph(content.header.secondaryContactLine, true))
  }

  if (content.summary) {
    children.push(sectionHeading('Professional Summary'))
    children.push(bodyParagraph(content.summary))
  }

  if (content.skillsLine) {
    children.push(sectionHeading('Core Skills'))
    children.push(bodyParagraph(content.skillsLine))
  }

  if (content.experience.length > 0) {
    children.push(sectionHeading('Professional Experience'))
    for (const entry of content.experience) {
      if (entry.heading) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                bold: true,
                font: SHARED_DOCUMENT_THEME.fontFamily,
                size: toHalfPoints(SHARED_DOCUMENT_THEME.fontSizePt.body),
                text: entry.heading,
              }),
            ],
            spacing: {
              after: toTwip(SHARED_DOCUMENT_THEME.spacingPt.afterCompact),
              line: Math.round(SHARED_DOCUMENT_THEME.lineHeight.body * 240),
              lineRule: LineRuleType.AUTO,
            },
          }),
        )
      }

      if (entry.meta) {
        children.push(compactParagraph(entry.meta, true))
      }

      if (entry.summary) {
        children.push(bodyParagraph(entry.summary))
      }

      for (const highlight of entry.highlights) {
        children.push(bulletParagraph(highlight))
      }
    }
  }

  if (content.education.length > 0) {
    children.push(sectionHeading('Education'))
    for (const entry of content.education) {
      children.push(bodyParagraph(entry))
    }
  }

  if (content.additionalDetails.length > 0) {
    children.push(sectionHeading('Additional Details'))
    for (const item of content.additionalDetails) {
      children.push(labeledParagraph(item.label, item.value))
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
          after: toTwip(SHARED_DOCUMENT_THEME.spacingPt.afterBody),
          line: Math.round(SHARED_DOCUMENT_THEME.lineHeight.body * 240),
          lineRule: LineRuleType.AUTO,
        },
      }),
    )
  }

  if (content.header.primaryContactLine) {
    children.push(compactParagraph(content.header.primaryContactLine, true))
  }

  if (content.header.secondaryContactLine) {
    children.push(compactParagraph(content.header.secondaryContactLine, true))
  }

  children.push(bodyParagraph(content.dateLine))
  children.push(bodyParagraph(content.companyLine))
  children.push(bodyParagraph(content.roleLine))
  children.push(bodyParagraph(content.salutation))

  for (const paragraph of content.bodyParagraphs) {
    children.push(bodyParagraph(paragraph))
  }

  if (content.signatureName) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            font: SHARED_DOCUMENT_THEME.fontFamily,
            size: toHalfPoints(SHARED_DOCUMENT_THEME.fontSizePt.body),
            text: content.signatureName,
          }),
        ],
        spacing: {
          before: toTwip(SHARED_DOCUMENT_THEME.spacingPt.beforeSignature),
          line: Math.round(SHARED_DOCUMENT_THEME.lineHeight.body * 240),
          lineRule: LineRuleType.AUTO,
        },
      }),
    )
  }

  const document = createSharedDocument(children)

  return Packer.toBuffer(document)
}
