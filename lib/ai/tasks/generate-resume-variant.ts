import 'server-only'

import { generateOpenAIJson, canGenerateWithOpenAI } from '@/lib/ai/client'
import type { ResumeVariantInput, ResumeVariantOutput } from '@/lib/ai/contracts'
import { generateResumeVariantPrompt } from '@/lib/ai/prompts/generate-resume-variant'
import type { ResumeExperienceRecord } from '@/lib/domain/types'
import { getOpenAIEnv } from '@/lib/env'

function cleanLine(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

// Caps here are deliberately generous — the rendered DOCX is the authoritative size budget
// (see RESUME_BUDGET in lib/jobs/document-system.ts). We let the LLM produce up to 5 bullets
// per role so the renderer's two-page fitter has real material to work with; under-producing
// here used to force shallow one-bullet roles even when the source had more to say.
const MAX_HIGHLIGHTS_PER_ENTRY = 5
const MAX_EXPERIENCE_ENTRIES = 6
// Floor enforced AFTER the LLM call. If the model returns fewer bullets for a role than this,
// we top it up using the candidate's own master-source bullets verbatim. This is truthful — we
// never invent text — but it stops "1 bullet for a real role" from ever shipping. The user
// explicitly said: "having one bullet is insanely weird." We match the renderer's
// SUBSTANTIVE_ROLE_MIN_HIGHLIGHTS so the schema and renderer agree on the floor.
const MIN_HIGHLIGHTS_PER_ENTRY = 3

function dedupeHighlights(values: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const key = value.toLowerCase().replace(/\s+/g, ' ').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

function normalizeExperienceEntry(
  source: ResumeExperienceRecord,
  draft: Partial<ResumeExperienceRecord> | undefined,
): ResumeExperienceRecord {
  const summary = cleanLine(draft?.summary ?? source.summary)
  const draftHighlights = Array.isArray(draft?.highlights)
    ? draft.highlights
        .filter((item): item is string => typeof item === 'string')
        .map((item) => cleanLine(item))
        .filter(Boolean)
    : source.highlights
  // Pad up to the floor with master-source bullets the LLM didn't already cover. This protects
  // against the LLM returning 1–2 bullets for a substantive role; we never fabricate, we just
  // surface the user's own source content. If the master itself has fewer than 3 bullets, the
  // role gets what the master has — we never make up text.
  const sourceFallback = source.highlights.map((item) => cleanLine(item)).filter(Boolean)
  const padded = dedupeHighlights([...draftHighlights, ...sourceFallback])
  const targetCount = Math.min(
    MAX_HIGHLIGHTS_PER_ENTRY,
    Math.max(draftHighlights.length, Math.min(MIN_HIGHLIGHTS_PER_ENTRY, padded.length)),
  )
  const highlights = padded.slice(0, targetCount)

  return {
    companyName: source.companyName,
    endDate: source.endDate,
    highlights,
    locationLabel: source.locationLabel,
    roleTitle: source.roleTitle,
    startDate: source.startDate,
    summary,
  }
}

function toSourceKey(entry: ResumeExperienceRecord) {
  return `${entry.companyName}::${entry.roleTitle}`.toLowerCase()
}

function asStringArray(value: unknown, max = 8) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => cleanLine(item))
        .filter(Boolean)
        .slice(0, max)
    : []
}

export async function generateResumeVariant(input: ResumeVariantInput): Promise<ResumeVariantOutput> {
  if (!canGenerateWithOpenAI()) {
    throw new Error('OpenAI environment variables are missing.')
  }

  const { packetModel } = getOpenAIEnv()
  const sourceExperience = [
    ...input.workspace.resumeMaster.experienceEntries,
    ...input.workspace.resumeMaster.archivedExperienceEntries,
  ]
  const experienceCatalog = sourceExperience.map((entry, index) => ({
    id: `experience_${index + 1}`,
    ...entry,
  }))
  const user = [
    `Target role: ${input.job.title} at ${input.job.companyName}`,
    `Target job description: ${input.job.descriptionText}`,
    `Requirements: ${input.job.requirements.join(' | ')}`,
    `Preferred qualifications: ${input.job.preferredQualifications.join(' | ')}`,
    `Skills keywords: ${input.job.skillsKeywords.join(' | ')}`,
    `Profile headline: ${input.workspace.profile.headline}`,
    `Base resume title: ${input.workspace.resumeMaster.baseTitle}`,
    `Base resume summary: ${input.workspace.resumeMaster.summaryText}`,
    `Impact highlights: ${input.workspace.resumeMaster.selectedImpactHighlights.join(' | ')}`,
    `Core expertise: ${input.workspace.resumeMaster.coreExpertise.join(' | ')}`,
    `Profile summary: ${input.workspace.profile.bioSummary}`,
    `Profile skills: ${input.workspace.profile.skills.join(' | ')}`,
    `Resume skills: ${input.workspace.resumeMaster.skillsSection.join(' | ')}`,
    `Resume tools and platforms: ${input.workspace.resumeMaster.toolsPlatforms.join(' | ')}`,
    `Allowed source experience entries (reuse facts only): ${JSON.stringify(experienceCatalog)}`,
  ].join('\n')

  const response = await generateOpenAIJson<ResumeVariantOutput>({
    model: packetModel,
    promptVersion: generateResumeVariantPrompt.version,
    schemaHint: generateResumeVariantPrompt.schemaHint,
    system: generateResumeVariantPrompt.system,
    user,
  })

  const sourceByKey = new Map(sourceExperience.map((entry) => [toSourceKey(entry), entry] as const))
  const rawEntries = Array.isArray(response.experienceEntries) ? response.experienceEntries : []
  const normalizedEntries = rawEntries
    .map((entry) => {
      const key = toSourceKey({
        companyName: cleanLine(entry?.companyName ?? ''),
        endDate: '',
        highlights: [],
        locationLabel: '',
        roleTitle: cleanLine(entry?.roleTitle ?? ''),
        startDate: '',
        summary: '',
      })
      const source = sourceByKey.get(key)

      if (!source) {
        return null
      }

      return normalizeExperienceEntry(source, entry)
    })
    .filter((entry): entry is ResumeExperienceRecord => entry !== null)

  // Fallback when the LLM returned no usable entries: surface the candidate's most recent roles
  // verbatim so the rendered resume still reflects real source material. The renderer's page
  // fitter then trims as needed.
  const fallbackEntries =
    normalizedEntries.length > 0
      ? normalizedEntries
      : sourceExperience.length > 0
        ? sourceExperience
            .slice(0, MAX_EXPERIENCE_ENTRIES)
            .map((entry) => normalizeExperienceEntry(entry, entry))
        : []

  const normalized: ResumeVariantOutput = {
    changeSummaryForUser: cleanLine(response.changeSummaryForUser ?? ''),
    experienceEntries: fallbackEntries.slice(0, MAX_EXPERIENCE_ENTRIES),
    headline:
      cleanLine(response.headline ?? '') ||
      cleanLine(input.workspace.resumeMaster.baseTitle) ||
      cleanLine(input.workspace.profile.headline),
    highlightedRequirements: asStringArray(response.highlightedRequirements, 5),
    skillsSection: asStringArray(response.skillsSection, 12),
    summary:
      cleanLine(response.summary ?? '') ||
      cleanLine(input.workspace.resumeMaster.summaryText) ||
      cleanLine(input.workspace.profile.bioSummary),
    tailoringRationale: cleanLine(response.tailoringRationale ?? ''),
  }

  if (!normalized.summary || (sourceExperience.length > 0 && normalized.experienceEntries.length === 0)) {
    throw new Error('Resume generation returned incomplete ATS content.')
  }

  return normalized
}
