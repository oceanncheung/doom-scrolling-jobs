import 'server-only'

import { canGenerateWithOpenAI, generateOpenAIJson } from '@/lib/ai/client'
import { extractEvidencePrompt } from '@/lib/ai/prompts/extract-evidence'
import {
  evidenceConfidenceLevels,
  evidenceKinds,
  type EvidenceConfidence,
  type EvidenceKind,
  type ExtractedEvidenceEntry,
} from '@/lib/domain/evidence'
import { getOpenAIEnv } from '@/lib/env'

/**
 * Extracts structured evidence entries from fetched markdown (portfolio, personal site,
 * LinkedIn export, etc.). Never invents — the system prompt enforces that every entry must
 * be defensible by a snippet of the source text. The snippet is captured in
 * `sourceSnapshotExcerpt` so the operator can verify before confirming (Phase B UI).
 *
 * Callers typically:
 *   1. Fetch a source via `lib/scraping/sources/*`
 *   2. Pass the markdown + optional experience context here
 *   3. Persist the returned entries via `lib/data/evidence-bank.ts`
 *   4. (Phase B) Surface unconfirmed entries for operator review
 *   5. (Phase D) Generator consumes only confirmed entries
 */

export interface ExtractEvidenceInput {
  sourceMarkdown: string
  sourceKindLabel: string // human label for the system: "portfolio", "personal site", etc.
  /**
   * Optional: the candidate's existing resume experience entries so the model can link
   * extracted evidence back to a specific role when the source text makes the connection
   * explicit. Format: `${companyName}::${roleTitle}` keys, lowercased.
   */
  existingExperienceKeys?: string[]
  /**
   * Optional: short framing paragraph about the candidate the extractor should keep in
   * mind — e.g. their headline, target roles, or primary function. Helps the model choose
   * conservatively among similar entries.
   */
  candidateContext?: string
}

interface RawExtractEvidenceOutput {
  entries?: unknown
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function asStringArray(value: unknown, max = 20): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => cleanString(item))
        .filter(Boolean)
        .slice(0, max)
    : []
}

function normalizeKind(value: unknown): EvidenceKind | null {
  if (typeof value !== 'string') return null
  const normalized = value.toLowerCase().trim() as EvidenceKind
  return evidenceKinds.includes(normalized) ? normalized : null
}

function normalizeConfidence(value: unknown): EvidenceConfidence {
  if (typeof value !== 'string') return 'low'
  const normalized = value.toLowerCase().trim() as EvidenceConfidence
  return evidenceConfidenceLevels.includes(normalized) ? normalized : 'low'
}

function normalizeEntry(raw: unknown): ExtractedEvidenceEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const kind = normalizeKind(record.kind)
  const summary = cleanString(record.summary)
  const sourceSnapshotExcerpt = cleanString(record.sourceSnapshotExcerpt)

  // Every entry MUST carry a snippet so the Phase B confirmation UI can show provenance.
  // Entries without a snippet are extraction hallucinations and get discarded.
  if (!kind || !summary || !sourceSnapshotExcerpt) return null

  const clientName = cleanString(record.clientName) || undefined
  const linkedExperienceSourceKey = cleanString(record.linkedExperienceSourceKey) || undefined

  return {
    kind,
    clientName,
    industryTags: asStringArray(record.industryTags, 8),
    scope: asStringArray(record.scope, 10),
    tools: asStringArray(record.tools, 15),
    summary,
    proofPoints: asStringArray(record.proofPoints, 8),
    confidence: normalizeConfidence(record.confidence),
    sourceSnapshotExcerpt,
    linkedExperienceSourceKey,
  }
}

export async function extractEvidenceFromMarkdown(
  input: ExtractEvidenceInput,
): Promise<ExtractedEvidenceEntry[]> {
  const cleanMarkdown = input.sourceMarkdown?.trim() ?? ''
  if (!cleanMarkdown) return []
  if (!canGenerateWithOpenAI()) {
    throw new Error('OpenAI environment variables are missing.')
  }

  const { packetModel } = getOpenAIEnv()

  const userParts: string[] = [
    `Source kind: ${input.sourceKindLabel}`,
  ]
  if (input.candidateContext) {
    userParts.push(`Candidate context: ${input.candidateContext}`)
  }
  if (input.existingExperienceKeys?.length) {
    userParts.push(
      `Existing experience keys (use as linkedExperienceSourceKey when the source text maps clearly to one): ${input.existingExperienceKeys.join(' | ')}`,
    )
  }
  userParts.push('Source markdown:')
  userParts.push(cleanMarkdown)

  const response = await generateOpenAIJson<RawExtractEvidenceOutput>({
    model: packetModel,
    promptVersion: extractEvidencePrompt.version,
    schemaHint: extractEvidencePrompt.schemaHint,
    system: extractEvidencePrompt.system,
    user: userParts.join('\n'),
  })

  const rawEntries = Array.isArray(response?.entries) ? response.entries : []
  return rawEntries
    .map((entry) => normalizeEntry(entry))
    .filter((entry): entry is ExtractedEvidenceEntry => entry !== null)
}
