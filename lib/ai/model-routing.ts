export const modelRouting = [
  {
    task: 'job_parse',
    label: 'Job parser',
    provider: 'Google',
    reason: 'Good fit for long-text extraction, normalization, and structured field recovery.',
  },
  {
    task: 'job_score',
    label: 'Job scorer',
    provider: 'Anthropic',
    reason: 'Strong reasoning for fit explanations, red flags, and recommendation-quality summaries.',
  },
  {
    task: 'resume_tailor',
    label: 'Resume tailor',
    provider: 'OpenAI',
    reason: 'Precise rewriting is useful for concise, constraint-aware resume updates.',
  },
  {
    task: 'portfolio_selector',
    label: 'Portfolio selector',
    provider: 'Anthropic',
    reason: 'Helpful for matching case-study evidence to nuanced role expectations.',
  },
  {
    task: 'field_response_generator',
    label: 'Field response generator',
    provider: 'OpenAI',
    reason: 'Good fit for compact, editable paste-ready application answers.',
  },
] as const
