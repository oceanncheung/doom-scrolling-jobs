import { normalizeListItemText } from '@/lib/profile/master-assets'

/** One highlight per line; leading bullet glyphs and list fragments are normalized away. */
export function highlightLinesFromMultiline(value: string): string[] {
  return String(value ?? '')
    .split('\n')
    .map((line) => normalizeListItemText(line))
    .filter(Boolean)
}
