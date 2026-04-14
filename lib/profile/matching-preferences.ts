import type {
  MatchingMarketStrictness,
  MatchingPreferencesRecord,
  MatchingRoleBreadth,
  MatchingSourceMix,
} from '@/lib/domain/types'

export interface MatchingPreferenceOption<TValue extends string> {
  helper?: string
  label: string
  value: TValue
}

export const defaultMatchingPreferences: MatchingPreferencesRecord = {
  marketStrictness: 'balanced',
  roleBreadth: 'balanced',
  sourceMix: 'balanced',
}

export const matchingRoleBreadthOptions: MatchingPreferenceOption<MatchingRoleBreadth>[] = [
  {
    helper: 'Stays close to target roles and core design families.',
    label: 'Tight',
    value: 'tight',
  },
  {
    helper: 'Keeps the current default balance of direct and adjacent roles.',
    label: 'Balanced',
    value: 'balanced',
  },
  {
    helper: 'Lets adjacent creative and leadership roles compete more often.',
    label: 'Broad',
    value: 'broad',
  },
]

export const matchingMarketStrictnessOptions: MatchingPreferenceOption<MatchingMarketStrictness>[] =
  [
    {
      helper: 'Only keeps jobs that clearly match your stated markets.',
      label: 'Strict',
      value: 'strict',
    },
    {
      helper: 'Uses the current mix of direct markets plus reasonable fallback.',
      label: 'Balanced',
      value: 'balanced',
    },
    {
      helper: 'Keeps more timezone-compatible and relocation-compatible roles visible.',
      label: 'Flexible',
      value: 'flexible',
    },
  ]

export const matchingSourceMixOptions: MatchingPreferenceOption<MatchingSourceMix>[] = [
  {
    helper: 'Favors company and ATS-hosted postings over discovery boards.',
    label: 'ATS first',
    value: 'ats_first',
  },
  {
    helper: 'Keeps the current source balance.',
    label: 'Balanced',
    value: 'balanced',
  },
  {
    helper: 'Lets broader remote boards compete more strongly in the queue.',
    label: 'Discovery',
    value: 'discovery',
  },
]

export function normalizeMatchingRoleBreadth(value: unknown): MatchingRoleBreadth {
  return value === 'tight' || value === 'broad' ? value : defaultMatchingPreferences.roleBreadth
}

export function normalizeMatchingMarketStrictness(value: unknown): MatchingMarketStrictness {
  return value === 'strict' || value === 'flexible'
    ? value
    : defaultMatchingPreferences.marketStrictness
}

export function normalizeMatchingSourceMix(value: unknown): MatchingSourceMix {
  return value === 'ats_first' || value === 'discovery'
    ? value
    : defaultMatchingPreferences.sourceMix
}

export function normalizeMatchingPreferences(value: unknown): MatchingPreferencesRecord {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}

  return {
    marketStrictness: normalizeMatchingMarketStrictness(record.marketStrictness),
    roleBreadth: normalizeMatchingRoleBreadth(record.roleBreadth),
    sourceMix: normalizeMatchingSourceMix(record.sourceMix),
  }
}
