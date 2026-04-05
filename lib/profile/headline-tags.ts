/** Profile headline is stored as a single DB string; UI edits it as tags joined with ` | `. */

export function parseHeadlineTags(headline: string): string[] {
  return headline
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function joinHeadlineTags(tags: string[]): string {
  return tags.map((t) => t.trim()).filter(Boolean).join(' | ')
}
