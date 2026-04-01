export interface ScoringWeight {
  factor: string
  label: string
  points: number
  description: string
}

export const hardFilters = [
  'Remote eligibility',
  'Listing still active',
  'Valid application destination',
  'No confirmed duplicate superseding it',
  'No high-confidence scam signals',
] as const

export const scoringWeights: ScoringWeight[] = [
  {
    factor: 'quality',
    label: 'Quality',
    points: 35,
    description: 'Role quality, team signal, employer credibility, and overall opportunity strength.',
  },
  {
    factor: 'salary',
    label: 'Salary',
    points: 25,
    description: 'Compensation relative to the profile target range, with caution instead of zeroing unknowns.',
  },
  {
    factor: 'role_relevance',
    label: 'Role relevance',
    points: 20,
    description: 'Designer-first fit, with adjacent roles allowed when the overlap is genuinely credible.',
  },
  {
    factor: 'seniority_fit',
    label: 'Seniority fit',
    points: 10,
    description: 'Level alignment so the user is not pushed toward implausibly junior or mismatched roles.',
  },
  {
    factor: 'portfolio_fit',
    label: 'Portfolio fit',
    points: 5,
    description: 'Whether the current body of work can convincingly support the role.',
  },
  {
    factor: 'application_effort',
    label: 'Application effort',
    points: 5,
    description: 'Penalty-resistant reward for healthier, clearer application flows.',
  },
] as const
