import 'server-only'

import { generateOpenAIJson, canGenerateWithOpenAI } from '@/lib/ai/client'
import type { CoverLetterInput, CoverLetterOutput } from '@/lib/ai/contracts'
import { generateCoverLetterPrompt } from '@/lib/ai/prompts/generate-cover-letter'
import { formatPortfolioItemForPrompt } from '@/lib/ai/tasks/generate-resume-variant'
import { getOpenAIEnv } from '@/lib/env'
import { formatEvidenceForPrompt, selectRelevantEvidenceForJob } from '@/lib/jobs/evidence-matching'

function cleanLine(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export async function generateCoverLetter(input: CoverLetterInput): Promise<CoverLetterOutput> {
  if (!canGenerateWithOpenAI()) {
    throw new Error('OpenAI environment variables are missing.')
  }

  const { packetModel } = getOpenAIEnv()
  // Prefer the full fetched description when available (see generate-resume-variant.ts for
  // rationale) — cover letters benefit especially from the richer text because the "why
  // this role" paragraph needs company context the feed stub rarely carries.
  const feedDescription = input.job.descriptionText ?? ''
  const fetchedDescription = input.job.descriptionTextFetched ?? ''
  const descriptionForPrompt =
    fetchedDescription.length > feedDescription.length * 1.5 && fetchedDescription.length >= 400
      ? fetchedDescription
      : feedDescription

  // Phase D: pull in confirmed evidence_bank entries that match this JD's industry.
  // Cover letters benefit especially from this — the "why this company" paragraph is
  // where named client work (Curated Health on a supplements JD, EVIIVE on a biotech JD)
  // lands most naturally.
  const relevantEvidence = selectRelevantEvidenceForJob(
    input.workspace.confirmedEvidenceEntries,
    input.job,
  )
  const industryTagLine = input.job.primaryIndustry
    ? `${input.job.primaryIndustry}${
        input.job.adjacentIndustries.length > 0
          ? ` (adjacent: ${input.job.adjacentIndustries.join(', ')})`
          : ''
      }`
    : 'unclassified'
  const evidenceLines = relevantEvidence.entries.map(formatEvidenceForPrompt)
  const portfolioLines = input.workspace.portfolioItems
    .filter((item) => item.isActive)
    .map(formatPortfolioItemForPrompt)
  // Prefer resume-side language/cert lists because they're the ones the DOCX renders and
  // are usually the more curated of the two; fall back to the profile field so we surface
  // a list even when the user has only populated one side.
  const languages =
    input.workspace.resumeMaster.languages.length > 0
      ? input.workspace.resumeMaster.languages
      : input.workspace.profile.languages

  const user = [
    `Target role: ${input.job.title} at ${input.job.companyName}`,
    `Target job industry: ${industryTagLine}`,
    `Job description: ${descriptionForPrompt}`,
    `Requirements: ${input.job.requirements.join(' | ')}`,
    evidenceLines.length > 0
      ? `Confirmed industry-relevant work from the candidate (use as factual anchor points when relevant; do not embellish beyond what is listed): ${evidenceLines.join(' || ')}`
      : '',
    portfolioLines.length > 0
      ? `Hand-curated portfolio items (named client work the candidate has chosen to surface — prefer these when a "why this company" anchor would otherwise rely on generic claims): ${portfolioLines.join(' || ')}`
      : '',
    `Preferred qualifications: ${input.job.preferredQualifications.join(' | ')}`,
    `Profile headline: ${input.workspace.profile.headline}`,
    `Profile summary: ${input.workspace.profile.bioSummary}`,
    `Profile target roles: ${input.workspace.profile.targetRoles.join(' | ') || '(none)'}`,
    `Profile preferred industries: ${input.workspace.profile.industriesPreferred.join(' | ') || '(none)'}`,
    `Profile allowed adjacent roles: ${input.workspace.profile.allowedAdjacentRoles.join(' | ') || '(none)'}`,
    `Profile work authorization notes (reference only when the JD asks about visa / sponsorship / location): ${input.workspace.profile.workAuthorizationNotes || '(none)'}`,
    `Resume headline: ${input.resumeVariant.headline}`,
    `Resume summary: ${input.resumeVariant.summary}`,
    `Resume change summary: ${input.resumeVariant.changeSummaryForUser}`,
    `Candidate languages (reference only when the JD values bilingual / multilingual candidates): ${languages.join(' | ') || '(none)'}`,
    `Candidate certifications (reference only when the JD names a matching credential): ${input.workspace.resumeMaster.certifications.join(' | ') || '(none)'}`,
    `Candidate additional information (awards, memberships, press — reference when JD-aligned): ${input.workspace.resumeMaster.additionalInformation.join(' | ') || '(none)'}`,
    `Portfolio primary URL: ${input.workspace.profile.portfolioPrimaryUrl}`,
    `Cover-letter positioning: ${input.workspace.coverLetterMaster.positioningPhilosophy}`,
    `Cover-letter proof bank: ${JSON.stringify(input.workspace.coverLetterMaster.proofBank)}`,
    `Cover-letter disciplines: ${input.workspace.coverLetterMaster.capabilities.disciplines.join(' | ')}`,
    `Cover-letter production tools: ${input.workspace.coverLetterMaster.capabilities.productionTools.join(' | ')}`,
    `Cover-letter tone: ${input.workspace.coverLetterMaster.toneVoice.join(' | ')}`,
    `Cover-letter differentiators: ${input.workspace.coverLetterMaster.keyDifferentiators.join(' | ')}`,
    `Cover-letter selection rules: ${input.workspace.coverLetterMaster.selectionRules.join(' | ')}`,
    `Cover-letter output constraints: ${input.workspace.coverLetterMaster.outputConstraints.join(' | ')}`,
  ].join('\n')

  const response = await generateOpenAIJson<Record<string, unknown>>({
    model: packetModel,
    promptVersion: generateCoverLetterPrompt.version,
    schemaHint: generateCoverLetterPrompt.schemaHint,
    system: generateCoverLetterPrompt.system,
    user,
  })

  const changeSummaryForUser = cleanLine(
    String(response.changeSummaryForUser ?? response.change_summary_for_user ?? ''),
  )
  const draft = String(response.draft ?? '').trim()
  const summary = cleanLine(String(response.summary ?? ''))

  const normalized: CoverLetterOutput = {
    changeSummaryForUser,
    draft,
    summary,
  }

  if (!normalized.draft || !normalized.summary || !normalized.changeSummaryForUser) {
    throw new Error('Cover letter generation returned incomplete content.')
  }

  return normalized
}
