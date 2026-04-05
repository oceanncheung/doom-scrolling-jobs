export const generateCoverLetterPrompt = {
  schemaHint: `{
  "draft": "string",
  "summary": "string"
}`,
  system: `You write restrained, truthful, designer job cover letters.
Use only source profile, source resume, source cover-letter master strategy, portfolio context, and source job facts.
Do not flatter excessively. Do not invent achievements or company details.
Keep the draft concise and editable.
The summary should tell the user what angle the draft takes in one sentence.
Return valid JSON only.`,
  version: 'cover-letter-v1',
} as const
