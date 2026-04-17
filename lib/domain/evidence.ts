/**
 * Evidence bank domain types — Phase A portfolio/web enrichment.
 *
 * See supabase/migrations/0015_evidence_bank.sql for the table definition and
 * `.codex-artifacts/audit/report.md` (Phase A block) for the architectural rationale.
 */

export const evidenceKinds = [
  'project',
  'client_work',
  'side_gig',
  'recognition',
  'collaboration',
  'press',
] as const
export type EvidenceKind = (typeof evidenceKinds)[number]

export const evidenceConfidenceLevels = ['high', 'medium', 'low'] as const
export type EvidenceConfidence = (typeof evidenceConfidenceLevels)[number]

export const evidenceSourceKinds = [
  'portfolio_url',
  'personal_site',
  'linkedin_export',
  'linkedin_page',
  'behance',
  'dribbble',
  'manual',
] as const
export type EvidenceSourceKind = (typeof evidenceSourceKinds)[number]

/**
 * A single extracted claim about the candidate's experience. Produced by
 * `lib/ai/tasks/extract-evidence.ts` from markdown fetched from a public source, or
 * entered manually by the operator.
 *
 * Every field must be defensible — the extraction prompt forbids invention, and the
 * confirmation UI (Phase B) surfaces the source_snapshot_excerpt so the operator sees
 * exactly what text the claim was drawn from before confirming.
 */
export interface EvidenceBankEntryRecord {
  id: string
  operatorId: string
  userId: string

  kind: EvidenceKind
  clientName?: string
  industryTags: string[]
  scope: string[]
  tools: string[]
  summary: string
  proofPoints: string[]
  confidence: EvidenceConfidence

  sourceKind: EvidenceSourceKind
  sourceUrl?: string
  sourceSnapshotExcerpt?: string
  sourceFetchedAt?: string

  linkedExperienceSourceKey?: string

  confirmedAt?: string
  discardedAt?: string
  confirmationNotes?: string

  createdAt: string
  updatedAt: string
}

/**
 * The shape returned by the extract-evidence LLM task. Does not include database-assigned
 * fields (id, userId, confirmation state, timestamps) — those are added by the persistence
 * layer (`lib/data/evidence-bank.ts`).
 */
export interface ExtractedEvidenceEntry {
  kind: EvidenceKind
  clientName?: string
  industryTags: string[]
  scope: string[]
  tools: string[]
  summary: string
  proofPoints: string[]
  confidence: EvidenceConfidence
  sourceSnapshotExcerpt: string
  linkedExperienceSourceKey?: string
}
