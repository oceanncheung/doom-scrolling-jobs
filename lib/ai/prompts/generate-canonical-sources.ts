export const generateCanonicalSourcesPrompt = {
  schemaHint: `{
  "profileDraft": {
    "headline": "string",
    "bioSummary": "string",
    "locationLabel": "string",
    "searchBrief": "string",
    "targetRoles": ["string"],
    "allowedAdjacentRoles": ["string"],
    "targetSeniorityLevels": ["junior" | "mid" | "senior" | "lead" | "principal"],
    "skills": ["string"],
    "tools": ["string"]
  },
  "resumeMaster": {
    "baseTitle": "string",
    "contactSnapshot": {
      "name": "string",
      "location": "string",
      "email": "string",
      "phone": "string",
      "portfolioUrl": "string",
      "websiteUrl": "string",
      "linkedinUrl": "string"
    },
    "summaryText": "string",
    "selectedImpactHighlights": ["string"],
    "coreExpertise": ["string"],
    "skillsSection": ["string"],
    "experienceEntries": [
      {
        "companyName": "string",
        "roleTitle": "string",
        "locationLabel": "string",
        "startDate": "string",
        "endDate": "string",
        "summary": "string",
        "highlights": ["string"]
      }
    ],
    "archivedExperienceEntries": [
      {
        "companyName": "string",
        "roleTitle": "string",
        "locationLabel": "string",
        "startDate": "string",
        "endDate": "string",
        "summary": "string",
        "highlights": ["string"]
      }
    ],
    "educationEntries": [
      {
        "schoolName": "string",
        "credential": "string",
        "fieldOfStudy": "string",
        "startDate": "string",
        "endDate": "string",
        "notes": "string"
      }
    ],
    "languages": ["string"],
    "toolsPlatforms": ["string"],
    "additionalInformation": ["string"],
    "sectionProvenance": {
      "contact": { "confidence": "high" | "medium" | "low", "notes": ["string"], "sourceLabels": ["string"] },
      "professionalSummary": { "confidence": "high" | "medium" | "low", "notes": ["string"], "sourceLabels": ["string"] },
      "selectedImpactHighlights": { "confidence": "high" | "medium" | "low", "notes": ["string"], "sourceLabels": ["string"] },
      "coreExpertise": { "confidence": "high" | "medium" | "low", "notes": ["string"], "sourceLabels": ["string"] },
      "professionalExperience": { "confidence": "high" | "medium" | "low", "notes": ["string"], "sourceLabels": ["string"] },
      "archivedExperience": { "confidence": "high" | "medium" | "low", "notes": ["string"], "sourceLabels": ["string"] },
      "education": { "confidence": "high" | "medium" | "low", "notes": ["string"], "sourceLabels": ["string"] },
      "certifications": { "confidence": "high" | "medium" | "low", "notes": ["string"], "sourceLabels": ["string"] },
      "languages": { "confidence": "high" | "medium" | "low", "notes": ["string"], "sourceLabels": ["string"] },
      "toolsPlatforms": { "confidence": "high" | "medium" | "low", "notes": ["string"], "sourceLabels": ["string"] },
      "additionalInformation": { "confidence": "high" | "medium" | "low", "notes": ["string"], "sourceLabels": ["string"] }
    }
  },
  "coverLetterMaster": {
    "contactSnapshot": {
      "name": "string",
      "location": "string",
      "roleTargets": ["string"]
    },
    "positioningPhilosophy": "string",
    "proofBank": [
      {
        "label": "string",
        "context": "string",
        "bullets": ["string"]
      }
    ],
    "capabilities": {
      "disciplines": ["string"],
      "productionTools": ["string"]
    },
    "toneVoice": ["string"],
    "keyDifferentiators": ["string"],
    "selectionRules": ["string"],
    "outputConstraints": ["string"],
    "sectionProvenance": {
      "contact": { "confidence": "high" | "medium" | "low", "notes": ["string"], "sourceLabels": ["string"] },
      "positioningPhilosophy": { "confidence": "high" | "medium" | "low", "notes": ["string"], "sourceLabels": ["string"] },
      "proofBank": { "confidence": "high" | "medium" | "low", "notes": ["string"], "sourceLabels": ["string"] },
      "capabilities": { "confidence": "high" | "medium" | "low", "notes": ["string"], "sourceLabels": ["string"] },
      "toneVoice": { "confidence": "high" | "medium" | "low", "notes": ["string"], "sourceLabels": ["string"] },
      "keyDifferentiators": { "confidence": "high" | "medium" | "low", "notes": ["string"], "sourceLabels": ["string"] },
      "selectionRules": { "confidence": "high" | "medium" | "low", "notes": ["string"], "sourceLabels": ["string"] },
      "outputConstraints": { "confidence": "high" | "medium" | "low", "notes": ["string"], "sourceLabels": ["string"] }
    }
  }
}`,
  system: `You are a strict source transformer for a designer job-search workspace.

You perform three functions only:
1. Create a canonical master resume structure.
2. Create a canonical master cover-letter source structure.
3. Draft ranking/profile fields from those same facts.

Rules:
- Use only content explicitly provided in the current request.
- Never use memory, prior chats, hidden examples, templates as facts, or outside knowledge.
- Clean and restructure wording without changing meaning.
- Do not invent, infer, or supplement missing employers, dates, tools, metrics, portfolio links, or role claims.
- If details are missing, use "[Add details]" instead of inventing facts.
- Preserve strong existing wording when possible.
- Keep headings and content modular so later rendering stays stable and machine-readable.
- Use concise bullets where useful.
- For list fields, return clean standalone items only.
- Do not include leading conjunctions like "and" or "or", bullet markers, or orphan punctuation / unmatched parentheses in any list item.
- targetRoles should be direct-fit roles only.
- allowedAdjacentRoles should stay close to the direct-fit work.
- searchBrief should read like an internal job-targeting note for ranking.
- sectionProvenance confidence should be "low" when the source is weak or ambiguous, "medium" when partially supported, and "high" when directly supported.
- If no source resume text is present, return valid JSON with "[Add details]" placeholders rather than prose commentary.

Return valid JSON only.`,
  version: 'canonical-sources-v2',
} as const
