import 'server-only'

import { extractEvidenceFromMarkdown } from '@/lib/ai/tasks/extract-evidence'
import { insertExtractedEvidenceEntries } from '@/lib/data/evidence-bank'
import { getOperatorProfile } from '@/lib/data/operator-profile'
import { getActiveOperatorContext } from '@/lib/data/operators'
import type { EvidenceBankEntryRecord, EvidenceSourceKind } from '@/lib/domain/evidence'
import { hasOpenAIEnv, hasSupabaseServerEnv } from '@/lib/env'
import { fetchPersonalSiteSnapshot, fetchPortfolioSnapshot } from '@/lib/scraping/sources/portfolio'

/**
 * Phase A orchestration: given the currently-active operator, fetch their portfolio +
 * personal site (when present in their profile) and extract evidence entries via the LLM.
 * Persisted entries start unconfirmed — the Phase B UI will surface them for review.
 *
 * This is the surface callers (server actions, scripts, cron) should use. The underlying
 * pieces (fetch, extract, persist) are in separate modules for composability.
 */

export interface EnrichOperatorEvidenceResult {
  operatorId: string
  sources: Array<{
    sourceKind: EvidenceSourceKind
    sourceUrl: string
    status: 'fetched' | 'fetch-failed' | 'skipped-no-url' | 'no-entries-extracted'
    contentLength?: number
    error?: string
    inserted: number
  }>
  insertedEntries: EvidenceBankEntryRecord[]
}

export async function enrichActiveOperatorEvidence(): Promise<EnrichOperatorEvidenceResult> {
  if (!hasSupabaseServerEnv()) {
    throw new Error('Supabase env missing; cannot enrich evidence.')
  }
  if (!hasOpenAIEnv()) {
    throw new Error('OpenAI env missing; cannot extract evidence.')
  }

  const operatorContext = await getActiveOperatorContext()
  if (!operatorContext || !operatorContext.operator?.id) {
    throw new Error('No active operator selected; cannot enrich evidence.')
  }

  // ActiveOperatorContext carries ids only; fetch the full workspace separately so we have
  // the portfolio/personal-site URLs and the existing experience entries to link against.
  const { workspace } = await getOperatorProfile()

  const operatorId = operatorContext.operator.id
  const userId = operatorContext.userId
  const profile = workspace.profile
  const resumeMaster = workspace.resumeMaster

  // Build the existing-experience keys so the extractor can link evidence entries back to
  // specific roles on the resume when the source text supports that mapping.
  const existingExperienceKeys = [
    ...resumeMaster.experienceEntries,
    ...resumeMaster.archivedExperienceEntries,
  ].map((entry) => `${entry.companyName}::${entry.roleTitle}`.toLowerCase())

  const candidateContext = [
    profile.headline && `Headline: ${profile.headline}`,
    resumeMaster.baseTitle && `Target role: ${resumeMaster.baseTitle}`,
    profile.bioSummary && `Bio: ${profile.bioSummary}`,
  ]
    .filter(Boolean)
    .join(' · ')

  const sources: EnrichOperatorEvidenceResult['sources'] = []
  const insertedEntries: EvidenceBankEntryRecord[] = []

  const plan: Array<{ sourceKind: EvidenceSourceKind; sourceKindLabel: string; url?: string }> = [
    { sourceKind: 'portfolio_url', sourceKindLabel: 'portfolio', url: profile.portfolioPrimaryUrl },
    { sourceKind: 'personal_site', sourceKindLabel: 'personal site', url: profile.personalSiteUrl },
  ]

  for (const plannedSource of plan) {
    const url = (plannedSource.url ?? '').trim()
    if (!url) {
      sources.push({
        sourceKind: plannedSource.sourceKind,
        sourceUrl: '',
        status: 'skipped-no-url',
        inserted: 0,
      })
      continue
    }

    const fetchResult =
      plannedSource.sourceKind === 'portfolio_url'
        ? await fetchPortfolioSnapshot(url)
        : await fetchPersonalSiteSnapshot(url)

    if (!fetchResult.success) {
      sources.push({
        sourceKind: plannedSource.sourceKind,
        sourceUrl: fetchResult.error.url,
        status: 'fetch-failed',
        error: fetchResult.error.error,
        inserted: 0,
      })
      continue
    }

    const extracted = await extractEvidenceFromMarkdown({
      sourceMarkdown: fetchResult.snapshot.markdown,
      sourceKindLabel: plannedSource.sourceKindLabel,
      existingExperienceKeys,
      candidateContext,
    })

    if (extracted.length === 0) {
      sources.push({
        sourceKind: plannedSource.sourceKind,
        sourceUrl: fetchResult.snapshot.url,
        status: 'no-entries-extracted',
        contentLength: fetchResult.snapshot.contentLength,
        inserted: 0,
      })
      continue
    }

    const persisted = await insertExtractedEvidenceEntries(
      {
        operatorId,
        userId,
        sourceKind: plannedSource.sourceKind,
        sourceUrl: fetchResult.snapshot.url,
        sourceFetchedAt: fetchResult.snapshot.fetchedAt,
      },
      extracted,
    )

    insertedEntries.push(...persisted)
    sources.push({
      sourceKind: plannedSource.sourceKind,
      sourceUrl: fetchResult.snapshot.url,
      status: 'fetched',
      contentLength: fetchResult.snapshot.contentLength,
      inserted: persisted.length,
    })
  }

  return { operatorId, sources, insertedEntries }
}
