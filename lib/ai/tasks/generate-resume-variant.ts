import 'server-only'

import { generateOpenAIJson, canGenerateWithOpenAI } from '@/lib/ai/client'
import type { ResumeVariantInput, ResumeVariantOutput } from '@/lib/ai/contracts'
import { generateResumeVariantPrompt } from '@/lib/ai/prompts/generate-resume-variant'
import { computeRelevanceHints } from '@/lib/ai/tasks/compute-relevance-hints'
import { verifyResumeVariant } from '@/lib/ai/tasks/verify-resume-variant'
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

// Soft-skill phrases banned from skillsSection. The prompt already instructs the model not to
// emit these, but we strip them in code too so a single prompt regression can't leak them in.
// Matched case-insensitively against the full normalized skill string.
const SOFT_SKILL_PATTERNS: RegExp[] = [
  /^communication(?:\s+skills)?$/i,
  /^(?:strong\s+)?communicator$/i,
  /^leadership(?:\s+skills)?$/i,
  /^teamwork$/i,
  /^team\s+player$/i,
  /^collaboration$/i,
  /^problem[-\s]?solving$/i,
  /^critical\s+thinking$/i,
  /^time\s+management$/i,
  /^organization(?:al\s+skills)?$/i,
  /^adaptability$/i,
  /^adaptable$/i,
  /^creativity$/i,
  /^creative\s+thinking$/i,
  /^work\s+ethic$/i,
  /^attention\s+to\s+detail$/i,
  /^detail[-\s]?oriented$/i,
  /^self[-\s]?motivated$/i,
  /^self[-\s]?starter$/i,
  /^fast\s+learner$/i,
  /^quick\s+learner$/i,
  /^multitasking$/i,
  /^interpersonal\s+skills$/i,
  /^(?:strong\s+)?work[-\s]ethic$/i,
]

// Weak opener patterns that should not survive padding from source bullets. The prompt
// instructs the LLM to rewrite these, but source-verbatim padding could still reintroduce
// them. Bullets starting with any of these are skipped during padding.
const WEAK_BULLET_PREFIXES: RegExp[] = [
  /^responsible\s+for\b/i,
  /^worked\s+on\b/i,
  /^helped\b/i,
  /^assisted\s+(?:with|in)\b/i,
  /^involved\s+in\b/i,
  /^participated\s+in\b/i,
  /^supported(?:\s+the)?\s+team\b/i,
  /^tasked\s+with\b/i,
]

// A soft-skill phrase inside a bullet is fine (demonstrated through work); a bullet that is
// ENTIRELY a soft-skill claim is not. These match a whole-bullet soft-skill assertion.
const WEAK_BULLET_BODY_PATTERNS: RegExp[] = [
  /^strong\s+(?:communication|communicator|leadership|teamwork)\b/i,
  /^excellent\s+(?:communication|communicator|teamwork|interpersonal)\b/i,
  /^team\s+player\b/i,
  /^detail[-\s]?oriented\b/i,
]

const MIN_BULLET_LENGTH = 40

function isWeakSourceBullet(value: string) {
  const normalized = cleanLine(value)
  if (!normalized) return true
  if (normalized.length < MIN_BULLET_LENGTH) return true
  if (WEAK_BULLET_PREFIXES.some((pattern) => pattern.test(normalized))) return true
  if (WEAK_BULLET_BODY_PATTERNS.some((pattern) => pattern.test(normalized))) return true
  return false
}

function isSoftSkill(value: string) {
  const normalized = cleanLine(value).replace(/[()]/g, '').trim()
  return SOFT_SKILL_PATTERNS.some((pattern) => pattern.test(normalized))
}

// Canonical key for skill comparison. Lowercases, strips punctuation/suffixes, collapses
// whitespace. "Adobe Illustrator" and "adobe-illustrator" and "Illustrator (Adobe)" should
// all normalize to roughly the same comparable token.
function canonicalizeSkillKey(value: string) {
  return cleanLine(value)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9+#./]+/g, ' ')
    .replace(/\b(?:software|tool|tools|platform|platforms|suite|experience|proficiency|proficient|skilled)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Alias map for tools that appear under multiple canonical names. Keys are canonical; values
// are any strings that should match as aliases. Deliberately small — expand only with real
// false-positive cases we see in generation logs.
const SKILL_ALIASES: Array<[string, string[]]> = [
  ['adobe creative suite', ['adobe cc', 'adobe creative cloud', 'creative cloud', 'adobe suite']],
  ['adobe illustrator', ['illustrator']],
  ['adobe photoshop', ['photoshop']],
  ['adobe indesign', ['indesign']],
  ['adobe after effects', ['after effects', 'ae']],
  ['adobe premiere', ['premiere pro', 'premiere']],
  ['figma', ['figjam']],
  ['google analytics', ['ga4', 'ga 4', 'google analytics 4']],
  ['search engine optimization', ['seo']],
  ['search engine marketing', ['sem']],
  ['user experience', ['ux']],
  ['user interface', ['ui']],
  ['user experience design', ['ux design', 'ux/ui design', 'ux ui']],
  ['customer relationship management', ['crm']],
  ['content management system', ['cms']],
  ['html/css', ['html', 'css', 'html and css', 'html + css']],
]

function buildSourceSkillLookup(sources: string[]) {
  const lookup = new Set<string>()
  for (const source of sources) {
    const key = canonicalizeSkillKey(source)
    if (!key) continue
    lookup.add(key)
    // Also add each aliased canonical key so "Illustrator" in source matches "Adobe Illustrator"
    // being shipped.
    for (const [canonical, aliases] of SKILL_ALIASES) {
      const canonicalKey = canonicalizeSkillKey(canonical)
      const aliasKeys = aliases.map((alias) => canonicalizeSkillKey(alias))
      if (key === canonicalKey || aliasKeys.includes(key)) {
        lookup.add(canonicalKey)
        aliasKeys.forEach((aliasKey) => lookup.add(aliasKey))
      }
    }
  }
  return lookup
}

function matchesSourceSkill(value: string, sourceLookup: Set<string>) {
  const key = canonicalizeSkillKey(value)
  if (!key) return false
  if (sourceLookup.has(key)) return true
  // Substring match catches "Figma (Advanced)" vs source "Figma", and multi-word
  // partial overlaps.
  for (const sourceKey of sourceLookup) {
    if (!sourceKey) continue
    if (key === sourceKey) return true
    if (sourceKey.length >= 4 && key.includes(sourceKey)) return true
    if (key.length >= 4 && sourceKey.includes(key)) return true
  }
  return false
}

interface FilterSkillsResult {
  kept: string[]
  stripped: string[]
}

// Filter skillsSection entries down to those that (a) are not soft skills, and (b) trace back
// to a source skill/tool/expertise token the candidate actually has. Prevents the LLM from
// padding the skills list with JD-named tools the candidate's source doesn't support.
export function filterSkillsToSource(
  skills: string[],
  sources: {
    toolsPlatforms: string[]
    resumeSkills: string[]
    coreExpertise: string[]
    profileSkills: string[]
  },
): FilterSkillsResult {
  const sourceLookup = buildSourceSkillLookup([
    ...sources.toolsPlatforms,
    ...sources.resumeSkills,
    ...sources.coreExpertise,
    ...sources.profileSkills,
  ])

  const kept: string[] = []
  const stripped: string[] = []
  const seenKeys = new Set<string>()

  for (const raw of skills) {
    const normalized = cleanLine(raw)
    if (!normalized) continue
    const key = canonicalizeSkillKey(normalized)
    if (!key || seenKeys.has(key)) continue
    seenKeys.add(key)

    if (isSoftSkill(normalized)) {
      stripped.push(normalized)
      continue
    }
    if (!matchesSourceSkill(normalized, sourceLookup)) {
      stripped.push(normalized)
      continue
    }
    kept.push(normalized)
  }

  return { kept, stripped }
}

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
  //
  // v4: filter out weak source bullets (too short, "Responsible for", soft-skill assertions)
  // BEFORE padding, so padding can't reintroduce the exact phrasing the prompt tried to ban.
  // If every candidate bullet is weak, we accept the LLM's count as-is — better to ship 2
  // sharp bullets than 3 including a weak one.
  const sourceFallback = source.highlights
    .map((item) => cleanLine(item))
    .filter((item) => Boolean(item) && !isWeakSourceBullet(item))
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
  const baseCatalog = sourceExperience.map((entry, index) => ({
    id: `experience_${index + 1}`,
    ...entry,
  }))
  // v4: compute a cheap relevance hint per entry (keyword overlap + title similarity) and
  // pass it to the LLM. The prompt says: use this to break ties, trust the source bullets
  // over the hint when they disagree. This is a deterministic signal, not a filter — the
  // model still decides what to keep or drop.
  const relevanceAnnotations = computeRelevanceHints(baseCatalog, input.job)
  const annotationByKey = new Map(relevanceAnnotations.map((item) => [item.id, item] as const))
  const experienceCatalog = baseCatalog.map((entry) => {
    const annotation = annotationByKey.get(entry.id)
    return {
      ...entry,
      relevanceHint: annotation?.relevanceHint ?? 'low',
      keywordMatches: annotation?.keywordMatches ?? 0,
      titleSimilarity: annotation?.titleSimilarity ?? 0,
    }
  })
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

  // v4: filter skills against candidate's actual source before shipping. Soft skills (banned
  // by the prompt) and out-of-source tools get stripped. The prompt tells the model not to do
  // this; the code enforces it.
  const rawSkills = asStringArray(response.skillsSection, 24)
  const { kept: filteredSkills } = filterSkillsToSource(rawSkills, {
    toolsPlatforms: input.workspace.resumeMaster.toolsPlatforms,
    resumeSkills: input.workspace.resumeMaster.skillsSection,
    coreExpertise: input.workspace.resumeMaster.coreExpertise,
    profileSkills: input.workspace.profile.skills,
  })

  const normalized: ResumeVariantOutput = {
    changeSummaryForUser: cleanLine(response.changeSummaryForUser ?? ''),
    experienceEntries: fallbackEntries.slice(0, MAX_EXPERIENCE_ENTRIES),
    headline:
      cleanLine(response.headline ?? '') ||
      cleanLine(input.workspace.resumeMaster.baseTitle) ||
      cleanLine(input.workspace.profile.headline),
    highlightedRequirements: asStringArray(response.highlightedRequirements, 5),
    skillsSection: filteredSkills.slice(0, 12),
    summary:
      cleanLine(response.summary ?? '') ||
      cleanLine(input.workspace.resumeMaster.summaryText) ||
      cleanLine(input.workspace.profile.bioSummary),
    tailoringRationale: cleanLine(response.tailoringRationale ?? ''),
  }

  if (!normalized.summary || (sourceExperience.length > 0 && normalized.experienceEntries.length === 0)) {
    throw new Error('Resume generation returned incomplete ATS content.')
  }

  // v4: verify coverage + unverified claims. Logging mode — we surface a terse note to the user
  // via changeSummaryForUser and emit the structured payload to server logs for review. No
  // content is stripped yet; once we've watched false-positive rate for a week, we can flip
  // numeric-claim stripping to strict mode.
  const verification = verifyResumeVariant(normalized, input.job, input.workspace)
  if (verification.userFacingNote) {
    normalized.changeSummaryForUser = [normalized.changeSummaryForUser, verification.userFacingNote]
      .filter(Boolean)
      .join(' · ')
  }
  console.info('[resume-variant][verify]', {
    jobId: input.job.id,
    jobTitle: input.job.title,
    coverage: verification.coverage,
    unverifiedClaims: verification.unverifiedClaims,
  })

  return normalized
}
