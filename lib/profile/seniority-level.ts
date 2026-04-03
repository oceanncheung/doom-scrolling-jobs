/** Stored in `operator_profiles.seniority_level`; aligned with `getSeniorityScore` in real-feed. */
export const SENIORITY_LEVEL_OPTIONS: ReadonlyArray<{ label: string; value: string }> = [
  { value: '', label: 'No preference' },
  { value: 'junior', label: 'Junior / entry' },
  { value: 'mid', label: 'Mid-level' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead' },
  { value: 'staff', label: 'Staff / principal IC' },
]

const ALLOWED = new Set(SENIORITY_LEVEL_OPTIONS.map((o) => o.value).filter(Boolean))

/** Map legacy free-text (or canonical) values to the closest `<select>` value. */
export function seniorityLevelToSelectValue(stored: string | undefined | null): string {
  const raw = (stored ?? '').trim().toLowerCase()
  if (!raw) {
    return ''
  }
  if (ALLOWED.has(raw)) {
    return raw
  }
  if (raw.includes('staff') || raw.includes('principal')) {
    return 'staff'
  }
  if (raw.includes('lead') || raw.includes('director') || raw.includes('head of')) {
    return 'lead'
  }
  if (raw.includes('junior') || raw.includes('entry') || raw.includes('intern')) {
    return 'junior'
  }
  if (raw.includes('mid')) {
    return 'mid'
  }
  if (raw.includes('senior') || raw === 'sr') {
    return 'senior'
  }
  return ''
}
