import 'server-only'

import { canGenerateWithOpenAI, generateOpenAIJson } from '@/lib/ai/client'
import { classifyJobIndustryPrompt } from '@/lib/ai/prompts/classify-job-industry'
import { getOpenAIEnv } from '@/lib/env'

/**
 * Industry classifier — Phase C. Produces a structured tag set describing the hiring
 * company's industry so Phase D can match the candidate's confirmed evidence_bank entries
 * to it.
 *
 * Returns an empty payload if the input is too thin to classify responsibly. This keeps
 * "no data / no confident answer" from ever looking like a real classification.
 */

const ALLOWED_INDUSTRIES = new Set([
  'supplements',
  'wellness',
  'healthcare',
  'biotech',
  'CPG',
  'DTC',
  'SaaS',
  'ecommerce',
  'fintech',
  'healthtech',
  'edtech',
  'media',
  'entertainment',
  'agency',
  'nonprofit',
  'B2B',
  'B2C',
  'enterprise',
  'startup',
  'remote-first',
  'generalist',
])

export interface JobIndustryClassification {
  primaryIndustry: string
  adjacentIndustries: string[]
  industryEvidence: string[]
}

export interface ClassifyJobIndustryInput {
  title: string
  companyName: string
  descriptionText: string
  /** Optional: the fuller fetched description when available (see description-enrichment). */
  descriptionTextFetched?: string
}

interface RawOutput {
  primaryIndustry?: unknown
  adjacentIndustries?: unknown
  industryEvidence?: unknown
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function asAllowedTagArray(value: unknown, max = 6): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const trimmed = cleanString(item)
    if (!trimmed || !ALLOWED_INDUSTRIES.has(trimmed) || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
    if (out.length >= max) break
  }
  return out
}

function asEvidenceArray(value: unknown, max = 5): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => cleanString(item))
    .filter((item) => item.length > 0 && item.length <= 240)
    .slice(0, max)
}

const MIN_DESCRIPTION_LENGTH = 200

export async function classifyJobIndustry(
  input: ClassifyJobIndustryInput,
): Promise<JobIndustryClassification | null> {
  const feed = cleanString(input.descriptionText)
  const fetched = cleanString(input.descriptionTextFetched ?? '')
  const descriptionForPrompt = fetched.length > feed.length ? fetched : feed
  if (descriptionForPrompt.length < MIN_DESCRIPTION_LENGTH) {
    // Not enough context — don't guess. Caller can retry after fetching the fuller text.
    return null
  }
  if (!canGenerateWithOpenAI()) {
    throw new Error('OpenAI environment variables are missing.')
  }

  const { packetModel } = getOpenAIEnv()

  const user = [
    `Target role: ${input.title} at ${input.companyName}`,
    `Job description:`,
    descriptionForPrompt,
  ].join('\n')

  const response = await generateOpenAIJson<RawOutput>({
    model: packetModel,
    promptVersion: classifyJobIndustryPrompt.version,
    schemaHint: classifyJobIndustryPrompt.schemaHint,
    system: classifyJobIndustryPrompt.system,
    user,
  })

  const primaryCandidate = cleanString(response?.primaryIndustry)
  const primaryIndustry = ALLOWED_INDUSTRIES.has(primaryCandidate) ? primaryCandidate : 'generalist'
  const adjacentIndustries = asAllowedTagArray(response?.adjacentIndustries).filter(
    (tag) => tag !== primaryIndustry,
  )
  const industryEvidence = asEvidenceArray(response?.industryEvidence)

  return {
    primaryIndustry,
    adjacentIndustries,
    industryEvidence,
  }
}
