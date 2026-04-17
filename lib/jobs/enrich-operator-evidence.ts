import 'server-only'

import { extractEvidenceFromMarkdown } from '@/lib/ai/tasks/extract-evidence'
import { insertExtractedEvidenceEntries } from '@/lib/data/evidence-bank'
import { getOperatorProfile } from '@/lib/data/operator-profile'
import { getActiveOperatorContext } from '@/lib/data/operators'
import type { EvidenceBankEntryRecord, EvidenceSourceKind } from '@/lib/domain/evidence'
import { hasOpenAIEnv, hasSupabaseServerEnv } from '@/lib/env'
import { readLinkedInExportSnapshot } from '@/lib/scraping/sources/linkedin-export'
import { fetchPersonalSiteSnapshot, fetchPortfolioSnapshot } from '@/lib/scraping/sources/portfolio'
import { createClient } from '@/lib/supabase/server'

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

export interface EnrichActiveOperatorEvidenceOptions {
  /** Explicit operator to enrich. When set, bypasses cookie-based selection. Used by the
   *  CLI script so it can run without a signed-in session. */
  operatorIdOverride?: string
  /** Explicit operator slug. Resolved to id via the operators table. */
  operatorSlugOverride?: string
  /** Path to an extracted LinkedIn data-export directory. When set, the CSVs are parsed
   *  and fed through the same extract-evidence pipeline as the portfolio scrape. */
  linkedinExportDirectory?: string
}

interface ResolvedOperatorTarget {
  operatorId: string
  userId: string
  profile: {
    portfolioPrimaryUrl: string
    personalSiteUrl: string
    linkedinUrl: string
    headline: string
    bioSummary: string
  }
  resumeMaster: {
    baseTitle: string
    experienceKeys: string[]
  }
}

async function resolveCliTarget(operatorId: string | null, slug: string | null): Promise<ResolvedOperatorTarget> {
  const supabase = createClient()
  let query = supabase
    .from('operators')
    .select('id, slug')
    .limit(1)
  if (operatorId) {
    query = query.eq('id', operatorId)
  } else if (slug) {
    query = query.eq('slug', slug)
  } else {
    throw new Error('resolveCliTarget requires an operatorId or slug.')
  }
  const { data: opRow, error: opError } = await query.maybeSingle()
  if (opError || !opRow) {
    throw new Error(
      `No operator found for ${operatorId ? `id=${operatorId}` : `slug=${slug}`}: ${opError?.message ?? 'not found'}`,
    )
  }
  // Single-user Phase-1 convention: operator.id IS the user_id. See
  // lib/config/runtime.ts (defaultOperator) and the seeded operator in lib/data/operators.ts.
  const targetOperatorId = String((opRow as { id?: string }).id ?? '')
  const targetUserId = targetOperatorId

  const { data: profileRow } = await supabase
    .from('user_profiles')
    .select('portfolio_primary_url, personal_site_url, linkedin_url, headline, bio_summary')
    .eq('operator_id', targetOperatorId)
    .maybeSingle()
  const { data: resumeRow } = await supabase
    .from('resume_master')
    .select('base_title, experience_entries, archived_experience_entries')
    .eq('operator_id', targetOperatorId)
    .maybeSingle()

  const row = (profileRow ?? {}) as Record<string, unknown>
  const experienceEntries = Array.isArray((resumeRow as { experience_entries?: unknown })?.experience_entries)
    ? ((resumeRow as { experience_entries: Array<{ companyName?: string; roleTitle?: string }> }).experience_entries)
    : []
  const archivedEntries = Array.isArray(
    (resumeRow as { archived_experience_entries?: unknown })?.archived_experience_entries,
  )
    ? ((resumeRow as { archived_experience_entries: Array<{ companyName?: string; roleTitle?: string }> }).archived_experience_entries)
    : []
  const experienceKeys = [...experienceEntries, ...archivedEntries]
    .map((entry) => `${entry.companyName ?? ''}::${entry.roleTitle ?? ''}`.toLowerCase())
    .filter((key) => key !== '::')

  return {
    operatorId: targetOperatorId,
    userId: targetUserId,
    profile: {
      portfolioPrimaryUrl: String(row.portfolio_primary_url ?? ''),
      personalSiteUrl: String(row.personal_site_url ?? ''),
      linkedinUrl: String(row.linkedin_url ?? ''),
      headline: String(row.headline ?? ''),
      bioSummary: String(row.bio_summary ?? ''),
    },
    resumeMaster: {
      baseTitle: String((resumeRow as { base_title?: string })?.base_title ?? ''),
      experienceKeys,
    },
  }
}

export async function enrichActiveOperatorEvidence(
  options: EnrichActiveOperatorEvidenceOptions = {},
): Promise<EnrichOperatorEvidenceResult> {
  if (!hasSupabaseServerEnv()) {
    throw new Error('Supabase env missing; cannot enrich evidence.')
  }
  if (!hasOpenAIEnv()) {
    throw new Error('OpenAI env missing; cannot extract evidence.')
  }

  let operatorId: string
  let userId: string
  let portfolioUrl: string
  let personalSiteUrl: string
  let headline: string
  let bioSummary: string
  let baseTitle: string
  let existingExperienceKeys: string[]

  if (options.operatorIdOverride || options.operatorSlugOverride) {
    const target = await resolveCliTarget(
      options.operatorIdOverride ?? null,
      options.operatorSlugOverride ?? null,
    )
    operatorId = target.operatorId
    userId = target.userId
    portfolioUrl = target.profile.portfolioPrimaryUrl
    personalSiteUrl = target.profile.personalSiteUrl
    headline = target.profile.headline
    bioSummary = target.profile.bioSummary
    baseTitle = target.resumeMaster.baseTitle
    existingExperienceKeys = target.resumeMaster.experienceKeys
  } else {
    const operatorContext = await getActiveOperatorContext()
    if (!operatorContext || !operatorContext.operator?.id) {
      throw new Error('No active operator selected; cannot enrich evidence. Pass --operator-slug or --operator-id from the CLI.')
    }
    // ActiveOperatorContext carries ids only; fetch the full workspace separately so we have
    // the portfolio/personal-site URLs and the existing experience entries to link against.
    const { workspace } = await getOperatorProfile()
    operatorId = operatorContext.operator.id
    userId = operatorContext.userId
    portfolioUrl = workspace.profile.portfolioPrimaryUrl
    personalSiteUrl = workspace.profile.personalSiteUrl
    headline = workspace.profile.headline
    bioSummary = workspace.profile.bioSummary
    baseTitle = workspace.resumeMaster.baseTitle
    existingExperienceKeys = [
      ...workspace.resumeMaster.experienceEntries,
      ...workspace.resumeMaster.archivedExperienceEntries,
    ].map((entry) => `${entry.companyName}::${entry.roleTitle}`.toLowerCase())
  }

  const candidateContext = [
    headline && `Headline: ${headline}`,
    baseTitle && `Target role: ${baseTitle}`,
    bioSummary && `Bio: ${bioSummary}`,
  ]
    .filter(Boolean)
    .join(' · ')

  const sources: EnrichOperatorEvidenceResult['sources'] = []
  const insertedEntries: EvidenceBankEntryRecord[] = []

  const plan: Array<{ sourceKind: EvidenceSourceKind; sourceKindLabel: string; url?: string }> = [
    { sourceKind: 'portfolio_url', sourceKindLabel: 'portfolio', url: portfolioUrl },
    { sourceKind: 'personal_site', sourceKindLabel: 'personal site', url: personalSiteUrl },
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

  // LinkedIn export path — user-supplied directory, parsed into markdown from the CSVs.
  // We treat it as a separate source so entries carry `source_kind = linkedin_export` and
  // the source_url points to the directory path for provenance (the real URL would be the
  // LinkedIn profile the export came from; we don't have that here, and the directory is
  // enough for the user to re-verify).
  if (options.linkedinExportDirectory) {
    const linkedinResult = await readLinkedInExportSnapshot(options.linkedinExportDirectory)
    if (!linkedinResult.success) {
      sources.push({
        sourceKind: 'linkedin_export',
        sourceUrl: linkedinResult.error.directory,
        status: 'fetch-failed',
        error: linkedinResult.error.error,
        inserted: 0,
      })
    } else {
      const extracted = await extractEvidenceFromMarkdown({
        sourceMarkdown: linkedinResult.snapshot.markdown,
        sourceKindLabel: `LinkedIn export (sections: ${linkedinResult.snapshot.sectionsFound.join(', ')})`,
        existingExperienceKeys,
        candidateContext,
      })
      if (extracted.length === 0) {
        sources.push({
          sourceKind: 'linkedin_export',
          sourceUrl: linkedinResult.snapshot.directory,
          status: 'no-entries-extracted',
          contentLength: linkedinResult.snapshot.markdown.length,
          inserted: 0,
        })
      } else {
        const persisted = await insertExtractedEvidenceEntries(
          {
            operatorId,
            userId,
            sourceKind: 'linkedin_export',
            sourceUrl: linkedinResult.snapshot.directory,
            sourceFetchedAt: linkedinResult.snapshot.fetchedAt,
          },
          extracted,
        )
        insertedEntries.push(...persisted)
        sources.push({
          sourceKind: 'linkedin_export',
          sourceUrl: linkedinResult.snapshot.directory,
          status: 'fetched',
          contentLength: linkedinResult.snapshot.markdown.length,
          inserted: persisted.length,
        })
      }
    }
  }

  return { operatorId, sources, insertedEntries }
}
