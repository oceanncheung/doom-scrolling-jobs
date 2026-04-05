import 'server-only'

import { canGenerateWithOpenAI, generateOpenAIJson } from '@/lib/ai/client'
import type {
  ProfileWorkspaceGenerationInput,
  ProfileWorkspaceGenerationOutput,
} from '@/lib/ai/contracts'
import { generateProfileWorkspacePrompt } from '@/lib/ai/prompts/generate-profile-workspace'
import { getOpenAIEnv } from '@/lib/env'

function cleanLine(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeStringList(value: unknown, maxItems = 8) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => cleanLine(String(item ?? '')))
    .filter(Boolean)
    .slice(0, maxItems)
}

function normalizeSeniorityLevels(value: unknown) {
  const allowed = new Set(['junior', 'mid', 'senior', 'lead', 'principal'])

  return normalizeStringList(value, 5).filter((item) => allowed.has(item))
}

function normalizeProfileWorkspaceOutput(
  value: Partial<ProfileWorkspaceGenerationOutput>,
): ProfileWorkspaceGenerationOutput {
  return {
    allowedAdjacentRoles: normalizeStringList(value.allowedAdjacentRoles, 8),
    bioSummary: cleanLine(value.bioSummary ?? ''),
    headline: cleanLine(value.headline ?? ''),
    locationLabel: cleanLine(value.locationLabel ?? ''),
    searchBrief: cleanLine(value.searchBrief ?? ''),
    skills: normalizeStringList(value.skills, 10),
    targetRoles: normalizeStringList(value.targetRoles, 8),
    targetSeniorityLevels: normalizeSeniorityLevels(value.targetSeniorityLevels),
    tools: normalizeStringList(value.tools, 10),
  }
}

export async function generateProfileWorkspace(
  input: ProfileWorkspaceGenerationInput,
): Promise<ProfileWorkspaceGenerationOutput> {
  if (!canGenerateWithOpenAI()) {
    throw new Error('OpenAI environment variables are missing.')
  }

  const sourceSections = [
    ['Master resume markdown', input.masterResumeMarkdown],
    ['Master cover letter markdown', input.masterCoverLetterMarkdown ?? ''],
  ]
    .map(([label, value]) => [label, value.trim()] as const)
    .filter(([, value]) => value.length > 0)

  const sourceText = sourceSections.map(([label, value]) => `${label}:\n${value}`).join('\n\n---\n\n')

  if (!input.masterResumeMarkdown.trim()) {
    throw new Error('Upload a resume and generate the profile draft first.')
  }

  const { packetModel } = getOpenAIEnv()
  const response = await generateOpenAIJson<ProfileWorkspaceGenerationOutput>({
    model: packetModel,
    promptVersion: generateProfileWorkspacePrompt.version,
    schemaHint: generateProfileWorkspacePrompt.schemaHint,
    system: generateProfileWorkspacePrompt.system,
    user: `Source text:\n${sourceText}`,
  })

  const normalized = normalizeProfileWorkspaceOutput(response)

  if (!normalized.headline || !normalized.searchBrief) {
    throw new Error('Profile generation returned incomplete workspace content.')
  }

  normalized.locationLabel = cleanLine(normalized.locationLabel)

  return normalized
}
