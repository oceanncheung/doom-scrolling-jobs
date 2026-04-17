import 'server-only'

import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * LinkedIn data-export reader.
 *
 * LinkedIn lets users download their account data from Settings → Data Privacy →
 * "Get a copy of your data". The export arrives as a ZIP containing CSV files with
 * structured profile content — positions, projects, skills, shares, etc. — that often
 * contains detail the user didn't re-author into their resume_master (client names,
 * project blurbs, posts about work shipped). This reader takes an already-extracted
 * directory path, pulls the relevant CSVs, and concatenates them into a single markdown
 * blob the extract-evidence LLM task can consume identically to a portfolio scrape.
 *
 * v1 intentionally doesn't unzip — the user extracts once with their OS tooling (Finder /
 * unzip / 7z) and points this at the resulting directory. Keeps us from adding a zip
 * dependency for a workflow most operators will run 2–3 times a year.
 *
 * CSVs considered (in priority order — earlier content has more narrative weight):
 *   - Profile.csv            — headline, summary, industry
 *   - Positions.csv          — job history titles + descriptions
 *   - Projects.csv           — named projects with descriptions + URLs
 *   - Skills.csv             — skills list (thin but useful tool signal)
 *   - Shares.csv             — posts the user authored (often mention clients / work)
 *
 * We ignore: Ad Targeting, Member Reactions, Search Queries, etc. — those are noise.
 */

export interface LinkedInExportSnapshot {
  directory: string
  markdown: string
  sectionsFound: string[]
  fetchedAt: string
}

export interface LinkedInExportError {
  directory: string
  error: string
  fetchedAt: string
}

export type LinkedInExportResult =
  | { success: true; snapshot: LinkedInExportSnapshot }
  | { success: false; error: LinkedInExportError }

// Parses a CSV byte-safely enough for LinkedIn's exports. Handles quoted cells with
// embedded newlines + commas + escaped double-quotes. Not a full RFC 4180 parser —
// doesn't cover every edge case — but LinkedIn's exports are well-formed.
function parseCsv(content: string): string[][] {
  // Strip BOM. LinkedIn exports are UTF-8 with BOM.
  const normalized = content.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i]
    if (inQuotes) {
      if (ch === '"' && normalized[i + 1] === '"') {
        currentCell += '"'
        i += 1
      } else if (ch === '"') {
        inQuotes = false
      } else {
        currentCell += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        currentRow.push(currentCell)
        currentCell = ''
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && normalized[i + 1] === '\n') i += 1
        currentRow.push(currentCell)
        rows.push(currentRow)
        currentRow = []
        currentCell = ''
      } else {
        currentCell += ch
      }
    }
  }
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell)
    rows.push(currentRow)
  }
  return rows.filter((row) => row.some((cell) => cell.trim().length > 0))
}

function rowsToMarkdown(rows: string[][], sectionLabel: string, fieldsToSurface: readonly string[]): string {
  if (rows.length < 2) return ''
  const [header, ...body] = rows
  const columnIndex: Record<string, number> = {}
  header.forEach((name, index) => {
    columnIndex[name.trim()] = index
  })
  const lines: string[] = [`## ${sectionLabel}`]
  for (const row of body) {
    const parts: string[] = []
    for (const field of fieldsToSurface) {
      const idx = columnIndex[field]
      if (idx === undefined) continue
      const value = (row[idx] ?? '').replace(/\s+/g, ' ').trim()
      if (!value) continue
      parts.push(`${field}: ${value}`)
    }
    if (parts.length > 0) lines.push(`- ${parts.join(' · ')}`)
  }
  return lines.length > 1 ? lines.join('\n') : ''
}

async function readOptionalCsv(directory: string, filename: string): Promise<string[][] | null> {
  const filepath = path.join(directory, filename)
  try {
    const content = await fs.readFile(filepath, 'utf8')
    return parseCsv(content)
  } catch {
    return null
  }
}

const SECTION_PLAN: Array<{ filename: string; label: string; fields: readonly string[] }> = [
  {
    filename: 'Profile.csv',
    label: 'Profile',
    fields: ['First Name', 'Last Name', 'Headline', 'Summary', 'Industry', 'Geo Location'],
  },
  {
    filename: 'Positions.csv',
    label: 'Positions',
    fields: ['Company Name', 'Title', 'Started On', 'Finished On', 'Location', 'Description'],
  },
  {
    filename: 'Projects.csv',
    label: 'Projects',
    fields: ['Title', 'Description', 'Url', 'Started On', 'Finished On'],
  },
  {
    filename: 'Skills.csv',
    label: 'Skills',
    fields: ['Name'],
  },
  {
    filename: 'Shares.csv',
    label: 'Shares',
    fields: ['ShareCommentary', 'ShareLink', 'MediaUrl', 'Date'],
  },
]

const LINKEDIN_EXPORT_MAX_LENGTH = 80_000

export async function readLinkedInExportSnapshot(directory: string): Promise<LinkedInExportResult> {
  const fetchedAt = new Date().toISOString()
  const resolved = path.resolve(directory)
  let stat
  try {
    stat = await fs.stat(resolved)
  } catch (error) {
    return {
      success: false,
      error: {
        directory: resolved,
        error: `Could not open directory: ${error instanceof Error ? error.message : String(error)}`,
        fetchedAt,
      },
    }
  }
  if (!stat.isDirectory()) {
    return {
      success: false,
      error: { directory: resolved, error: 'Path is not a directory.', fetchedAt },
    }
  }

  const sections: string[] = []
  const sectionsFound: string[] = []
  for (const section of SECTION_PLAN) {
    const rows = await readOptionalCsv(resolved, section.filename)
    if (!rows) continue
    const block = rowsToMarkdown(rows, section.label, section.fields)
    if (!block) continue
    sections.push(block)
    sectionsFound.push(section.label)
  }

  if (sections.length === 0) {
    return {
      success: false,
      error: {
        directory: resolved,
        error:
          'No recognized LinkedIn export CSVs found (expected Profile.csv / Positions.csv / Projects.csv / Skills.csv / Shares.csv). Is this the right directory?',
        fetchedAt,
      },
    }
  }

  const joined = sections.join('\n\n').slice(0, LINKEDIN_EXPORT_MAX_LENGTH)
  return {
    success: true,
    snapshot: {
      directory: resolved,
      markdown: joined,
      sectionsFound,
      fetchedAt,
    },
  }
}
