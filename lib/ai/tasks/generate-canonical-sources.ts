import 'server-only'

import type {
  CanonicalSourceGenerationInput,
  CanonicalSourceGenerationOutput,
  GeneratedCoverLetterMasterOutput,
  GeneratedResumeMasterOutput,
  ProfileWorkspaceGenerationOutput,
} from '@/lib/ai/contracts'
import { generateOpenAIJson, canGenerateWithOpenAI } from '@/lib/ai/client'
import { generateCanonicalSourcesPrompt } from '@/lib/ai/prompts/generate-canonical-sources'
import { getOpenAIEnv } from '@/lib/env'
import { cleanLine, normalizeNarrativeTagList, normalizeStringList } from '@/lib/profile/master-assets'

function normalizeProfileDraft(
  value: Partial<ProfileWorkspaceGenerationOutput>,
): ProfileWorkspaceGenerationOutput {
  const allowedSeniority = new Set(['junior', 'mid', 'senior', 'lead', 'principal'])

  return {
    allowedAdjacentRoles: normalizeStringList(value.allowedAdjacentRoles, 8),
    bioSummary: cleanLine(value.bioSummary ?? ''),
    headline: cleanLine(value.headline ?? ''),
    locationLabel: cleanLine(value.locationLabel ?? ''),
    searchBrief: cleanLine(value.searchBrief ?? ''),
    skills: normalizeStringList(value.skills, 12),
    targetRoles: normalizeStringList(value.targetRoles, 8),
    targetSeniorityLevels: normalizeStringList(value.targetSeniorityLevels, 5).filter((item) =>
      allowedSeniority.has(item),
    ),
    tools: normalizeStringList(value.tools, 12),
  }
}

function normalizeResumeOutput(
  value: Partial<GeneratedResumeMasterOutput>,
): GeneratedResumeMasterOutput {
  return {
    additionalInformation: normalizeStringList(value.additionalInformation, 12),
    archivedExperienceEntries: Array.isArray(value.archivedExperienceEntries)
      ? value.archivedExperienceEntries
      : [],
    baseTitle: cleanLine(value.baseTitle ?? ''),
    contactSnapshot: {
      email: cleanLine(value.contactSnapshot?.email ?? ''),
      linkedinUrl: cleanLine(value.contactSnapshot?.linkedinUrl ?? ''),
      location: cleanLine(value.contactSnapshot?.location ?? ''),
      name: cleanLine(value.contactSnapshot?.name ?? ''),
      phone: cleanLine(value.contactSnapshot?.phone ?? ''),
      portfolioUrl: cleanLine(value.contactSnapshot?.portfolioUrl ?? ''),
      websiteUrl: cleanLine(value.contactSnapshot?.websiteUrl ?? ''),
    },
    coreExpertise: normalizeStringList(value.coreExpertise, 16),
    educationEntries: Array.isArray(value.educationEntries) ? value.educationEntries : [],
    experienceEntries: Array.isArray(value.experienceEntries) ? value.experienceEntries : [],
    languages: normalizeStringList(value.languages, 12),
    sectionProvenance:
      typeof value.sectionProvenance === 'object' && value.sectionProvenance
        ? value.sectionProvenance
        : {},
    selectedImpactHighlights: normalizeStringList(value.selectedImpactHighlights, 16),
    skillsSection: normalizeStringList(value.skillsSection, 16),
    summaryText: cleanLine(value.summaryText ?? ''),
    toolsPlatforms: normalizeStringList(value.toolsPlatforms, 16),
  }
}

function normalizeCoverLetterOutput(
  value: Partial<GeneratedCoverLetterMasterOutput>,
): GeneratedCoverLetterMasterOutput {
  return {
    capabilities: {
      disciplines: normalizeStringList(value.capabilities?.disciplines, 16),
      productionTools: normalizeStringList(value.capabilities?.productionTools, 16),
    },
    contactSnapshot: {
      location: cleanLine(value.contactSnapshot?.location ?? ''),
      name: cleanLine(value.contactSnapshot?.name ?? ''),
      roleTargets: normalizeStringList(value.contactSnapshot?.roleTargets, 12),
    },
    keyDifferentiators: normalizeNarrativeTagList(value.keyDifferentiators, 16),
    outputConstraints: normalizeNarrativeTagList(value.outputConstraints, 16),
    positioningPhilosophy: String(value.positioningPhilosophy ?? '').trim(),
    proofBank: Array.isArray(value.proofBank) ? value.proofBank : [],
    sectionProvenance:
      typeof value.sectionProvenance === 'object' && value.sectionProvenance
        ? value.sectionProvenance
        : {},
    selectionRules: normalizeNarrativeTagList(value.selectionRules, 16),
    toneVoice: normalizeNarrativeTagList(value.toneVoice, 16),
  }
}

export async function generateCanonicalSources(
  input: CanonicalSourceGenerationInput,
): Promise<CanonicalSourceGenerationOutput> {
  if (!canGenerateWithOpenAI()) {
    throw new Error('OpenAI environment variables are missing.')
  }

  const sourceResumeText = input.sourceResumeText.trim()
  const sourceCoverLetterText = input.sourceCoverLetterText?.trim() ?? ''

  if (!sourceResumeText) {
    throw new Error('Upload a source resume before generating canonical materials.')
  }

  const user = [
    `Source resume text:\n${sourceResumeText}`,
    sourceCoverLetterText ? `Source cover letter text:\n${sourceCoverLetterText}` : '',
  ]
    .filter(Boolean)
    .join('\n\n---\n\n')

  const { packetModel } = getOpenAIEnv()
  const response = await generateOpenAIJson<CanonicalSourceGenerationOutput>({
    model: packetModel,
    promptVersion: generateCanonicalSourcesPrompt.version,
    schemaHint: generateCanonicalSourcesPrompt.schemaHint,
    system: generateCanonicalSourcesPrompt.system,
    user,
  })

  const normalized = {
    coverLetterMaster: normalizeCoverLetterOutput(response.coverLetterMaster ?? {}),
    profileDraft: normalizeProfileDraft(response.profileDraft ?? {}),
    resumeMaster: normalizeResumeOutput(response.resumeMaster ?? {}),
  }

  if (!normalized.resumeMaster.contactSnapshot.name && !normalized.profileDraft.headline) {
    throw new Error('Canonical generation returned incomplete source material.')
  }

  return normalized
}
