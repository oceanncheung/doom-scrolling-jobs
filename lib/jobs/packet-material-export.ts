import 'server-only'

import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'

import type { ApplicationPacketRecord, OperatorWorkspaceRecord } from '@/lib/domain/types'
import { type QualifiedJobRecord } from '@/lib/jobs/contracts'
import { buildCoverLetterExportContent, buildResumeExportContent } from '@/lib/jobs/packet-materials'

function textParagraph(text: string) {
  return new Paragraph({
    children: [new TextRun(text)],
    spacing: {
      after: 120,
    },
  })
}

function headingParagraph(text: string) {
  return new Paragraph({
    children: [new TextRun({ bold: true, text })],
    heading: HeadingLevel.HEADING_2,
    spacing: {
      before: 240,
      after: 120,
    },
  })
}

function bulletParagraph(text: string) {
  return new Paragraph({
    bullet: {
      level: 0,
    },
    children: [new TextRun(text)],
    spacing: {
      after: 80,
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
  const content = buildResumeExportContent(packet, workspace)
  const children: Paragraph[] = []

  if (content.name) {
    children.push(
      new Paragraph({
        children: [new TextRun({ bold: true, size: 30, text: content.name })],
        spacing: {
          after: 120,
        },
      }),
    )
  }

  if (content.headline) {
    children.push(
      new Paragraph({
        children: [new TextRun({ size: 22, text: content.headline })],
        spacing: {
          after: 120,
        },
      }),
    )
  }

  for (const line of content.contactLines) {
    children.push(textParagraph(line))
  }

  if (content.summary) {
    children.push(headingParagraph('Professional Summary'))
    children.push(textParagraph(content.summary))
  }

  if (content.skills.length > 0) {
    children.push(headingParagraph('Core Skills'))
    children.push(textParagraph(content.skills.join(' | ')))
  }

  if (content.experience.length > 0) {
    children.push(headingParagraph('Experience'))
    for (const entry of content.experience) {
      if (entry.heading) {
        children.push(
          new Paragraph({
            children: [new TextRun({ bold: true, text: entry.heading })],
            spacing: {
              after: 80,
            },
          }),
        )
      }

      if (entry.meta) {
        children.push(textParagraph(entry.meta))
      }

      if (entry.summary) {
        children.push(textParagraph(entry.summary))
      }

      for (const highlight of entry.highlights) {
        children.push(bulletParagraph(highlight))
      }
    }
  }

  if (content.education.length > 0) {
    children.push(headingParagraph('Education'))
    for (const entry of content.education) {
      children.push(textParagraph(entry))
    }
  }

  if (content.certifications.length > 0) {
    children.push(headingParagraph('Certifications'))
    for (const item of content.certifications) {
      children.push(bulletParagraph(item))
    }
  }

  if (content.toolsPlatforms.length > 0) {
    children.push(headingParagraph('Tools & Platforms'))
    children.push(textParagraph(content.toolsPlatforms.join(' | ')))
  }

  if (content.languages.length > 0) {
    children.push(headingParagraph('Languages'))
    children.push(textParagraph(content.languages.join(' | ')))
  }

  if (content.additionalInformation.length > 0) {
    children.push(headingParagraph('Additional Information'))
    for (const item of content.additionalInformation) {
      children.push(bulletParagraph(item))
    }
  }

  const document = new Document({
    sections: [
      {
        children,
      },
    ],
  })

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
  const content = buildCoverLetterExportContent(packet, workspace)
  const exportDate = new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'long',
    timeZone: 'America/Toronto',
  }).format(new Date())
  const children: Paragraph[] = []

  if (content.name) {
    children.push(
      new Paragraph({
        children: [new TextRun({ bold: true, size: 28, text: content.name })],
        spacing: {
          after: 120,
        },
      }),
    )
  }

  for (const line of content.contactLines) {
    children.push(textParagraph(line))
  }

  children.push(textParagraph(exportDate))
  children.push(textParagraph(job.companyName))
  children.push(textParagraph(job.title))

  for (const paragraph of content.bodyParagraphs) {
    children.push(textParagraph(paragraph))
  }

  if (content.name) {
    children.push(textParagraph(content.name))
  }

  const document = new Document({
    sections: [
      {
        children,
      },
    ],
  })

  return Packer.toBuffer(document)
}
