import 'server-only'

import {
  evidenceConfidenceLevels,
  evidenceKinds,
  evidenceSourceKinds,
  type EvidenceBankEntryRecord,
  type EvidenceConfidence,
  type EvidenceKind,
  type EvidenceSourceKind,
  type ExtractedEvidenceEntry,
} from '@/lib/domain/evidence'
import { createClient } from '@/lib/supabase/server'

/**
 * CRUD helpers for the evidence_bank table. Phase A is persistence + LLM extraction only
 * (no UI yet); Phase B will add a /profile confirmation view that reads via
 * `listEvidenceForOperator` and writes via `confirmEvidenceEntry` / `discardEvidenceEntry`.
 *
 * Design invariants this module enforces:
 *  - Every persisted entry carries a source_snapshot_excerpt so the confirmation UI can
 *    render provenance (see lib/ai/tasks/extract-evidence.ts — extraction rejects entries
 *    without a snippet).
 *  - Writes happen via the service-role Supabase client because the evidence_bank row
 *    structure is operator-owned but not exposed to any public RLS path yet.
 *  - `confirmed_at` is the only gate the resume generator checks before consuming an
 *    entry; see the Phase D integration (not yet shipped).
 */

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}
function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
    return value as T
  }
  return fallback
}

export function rowToEvidenceBankRecord(row: Record<string, unknown>): EvidenceBankEntryRecord {
  return {
    id: asString(row.id),
    operatorId: asString(row.operator_id),
    userId: asString(row.user_id),
    kind: asEnum<EvidenceKind>(row.kind, evidenceKinds, 'project'),
    clientName: asString(row.client_name) || undefined,
    industryTags: asStringArray(row.industry_tags),
    scope: asStringArray(row.scope),
    tools: asStringArray(row.tools),
    summary: asString(row.summary),
    proofPoints: asStringArray(row.proof_points),
    confidence: asEnum<EvidenceConfidence>(row.confidence, evidenceConfidenceLevels, 'low'),
    sourceKind: asEnum<EvidenceSourceKind>(row.source_kind, evidenceSourceKinds, 'manual'),
    sourceUrl: asString(row.source_url) || undefined,
    sourceSnapshotExcerpt: asString(row.source_snapshot_excerpt) || undefined,
    sourceFetchedAt: asString(row.source_fetched_at) || undefined,
    linkedExperienceSourceKey: asString(row.linked_experience_source_key) || undefined,
    confirmedAt: asString(row.confirmed_at) || undefined,
    discardedAt: asString(row.discarded_at) || undefined,
    confirmationNotes: asString(row.confirmation_notes) || undefined,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

export interface InsertEvidenceInput {
  operatorId: string
  userId: string
  sourceKind: EvidenceSourceKind
  sourceUrl?: string
  sourceFetchedAt?: string
}

/**
 * Batch-inserts extracted evidence entries. Returns the persisted records. Entries start
 * with confirmed_at = null — the resume generator will not consume them until the
 * operator confirms them (Phase B UI).
 */
export async function insertExtractedEvidenceEntries(
  input: InsertEvidenceInput,
  entries: ExtractedEvidenceEntry[],
): Promise<EvidenceBankEntryRecord[]> {
  if (entries.length === 0) return []
  const supabase = createClient()
  const payload = entries.map((entry) => ({
    operator_id: input.operatorId,
    user_id: input.userId,
    kind: entry.kind,
    client_name: entry.clientName ?? null,
    industry_tags: entry.industryTags,
    scope: entry.scope,
    tools: entry.tools,
    summary: entry.summary,
    proof_points: entry.proofPoints,
    confidence: entry.confidence,
    source_kind: input.sourceKind,
    source_url: input.sourceUrl ?? null,
    source_snapshot_excerpt: entry.sourceSnapshotExcerpt ?? null,
    source_fetched_at: input.sourceFetchedAt ?? null,
    linked_experience_source_key: entry.linkedExperienceSourceKey ?? null,
  }))
  const { data, error } = await supabase
    .from('evidence_bank')
    .insert(payload)
    .select('*')
  if (error) {
    throw new Error(`Failed to insert evidence entries: ${error.message}`)
  }
  return ((data as Array<Record<string, unknown>>) ?? []).map(rowToEvidenceBankRecord)
}

export async function listEvidenceForOperator(operatorId: string): Promise<EvidenceBankEntryRecord[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('evidence_bank')
    .select('*')
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false })
  if (error) {
    throw new Error(`Failed to load evidence bank: ${error.message}`)
  }
  return ((data as Array<Record<string, unknown>>) ?? []).map(rowToEvidenceBankRecord)
}

export async function listConfirmedEvidenceForOperator(
  operatorId: string,
): Promise<EvidenceBankEntryRecord[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('evidence_bank')
    .select('*')
    .eq('operator_id', operatorId)
    .not('confirmed_at', 'is', null)
    .is('discarded_at', null)
    .order('confirmed_at', { ascending: false })
  if (error) {
    throw new Error(`Failed to load confirmed evidence: ${error.message}`)
  }
  return ((data as Array<Record<string, unknown>>) ?? []).map(rowToEvidenceBankRecord)
}

export async function confirmEvidenceEntry(
  entryId: string,
  confirmationNotes?: string,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('evidence_bank')
    .update({
      confirmed_at: new Date().toISOString(),
      discarded_at: null,
      confirmation_notes: confirmationNotes ?? null,
    })
    .eq('id', entryId)
  if (error) {
    throw new Error(`Failed to confirm evidence entry: ${error.message}`)
  }
}

export async function discardEvidenceEntry(
  entryId: string,
  reason?: string,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('evidence_bank')
    .update({
      discarded_at: new Date().toISOString(),
      confirmed_at: null,
      confirmation_notes: reason ?? null,
    })
    .eq('id', entryId)
  if (error) {
    throw new Error(`Failed to discard evidence entry: ${error.message}`)
  }
}
