import 'server-only'

import { generateOpenAIJson, canGenerateWithOpenAI } from '@/lib/ai/client'
import type { CoverLetterInput, CoverLetterOutput } from '@/lib/ai/contracts'
import { generateCoverLetterPrompt } from '@/lib/ai/prompts/generate-cover-letter'
import { getOpenAIEnv } from '@/lib/env'

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
  const user = [
    `Target role: ${input.job.title} at ${input.job.companyName}`,
    `Job description: ${descriptionForPrompt}`,
    `Requirements: ${input.job.requirements.join(' | ')}`,
    `Preferred qualifications: ${input.job.preferredQualifications.join(' | ')}`,
    `Profile headline: ${input.workspace.profile.headline}`,
    `Profile summary: ${input.workspace.profile.bioSummary}`,
    `Resume headline: ${input.resumeVariant.headline}`,
    `Resume summary: ${input.resumeVariant.summary}`,
    `Resume change summary: ${input.resumeVariant.changeSummaryForUser}`,
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
