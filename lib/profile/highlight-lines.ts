/** One highlight per line; leading bullet glyphs (•, hyphen list marker, *) are dropped. */
export function highlightLinesFromMultiline(value: string): string[] {
  return String(value ?? '')
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      return trimmed
        .replace(/^[•·▪◦*]\s*/u, '')
        .replace(/^-\s+(?!\d)/, '')
        .trim()
    })
    .filter(Boolean)
}
