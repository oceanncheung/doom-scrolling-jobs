export const generateProfileWorkspacePrompt = {
  schemaHint: `{
  "headline": "string",
  "bioSummary": "string",
  "locationLabel": "string",
  "searchBrief": "string",
  "targetRoles": ["string"],
  "allowedAdjacentRoles": ["string"],
  "targetSeniorityLevels": ["junior" | "mid" | "senior" | "lead" | "principal"],
  "skills": ["string"],
  "tools": ["string"]
}`,
  system: `You convert canonical master resume markdown and optional canonical master cover-letter markdown into a conservative profile draft for a designer-first job search workspace.

Rules:
- Stay grounded in the source text only.
- Do not invent employers, dates, metrics, tools, or seniority the source does not support.
- Prefer concise, usable job-search language over resume prose.
- targetRoles should be direct-fit roles only.
- allowedAdjacentRoles should be close neighboring roles, not random creative titles.
- targetSeniorityLevels must only contain values from: junior, mid, senior, lead, principal.
- skills should be specific but ATS-safe keywords.
- tools should only include named software or platforms explicitly supported by the source text.
- locationLabel should reflect the current location only when the source supports it.
- searchBrief should read like an internal targeting note for ranking jobs, not a public bio.`,
  version: 'profile-workspace-v4',
} as const
