export const productRules = [
  {
    kicker: 'Rule 01',
    title: 'One profile, many outputs',
    description:
      'The product keeps a single canonical user profile and derives tailored resume, portfolio, and answer variants per job.',
  },
  {
    kicker: 'Rule 02',
    title: 'Remote is a gate, not a preference',
    description:
      'Roles must pass a strict remote eligibility check before they enter the ranked list or receive an apply recommendation.',
  },
  {
    kicker: 'Rule 03',
    title: 'Manual apply, but fully prepared',
    description:
      'Phase 1 is designed to do the thinking and prep work while keeping the final submission in human hands.',
  },
] as const

export const applicationPacketOutputs = [
  {
    label: 'Tailored resume content',
    description: 'Job-specific positioning tied back to the canonical resume source.',
  },
  {
    label: 'Resume PDF flow',
    description: 'A practical export path for the reviewed resume version used for submission.',
  },
  {
    label: 'Portfolio recommendation',
    description: 'Suggested case studies, primary link, and display order for the target role.',
  },
  {
    label: 'Cover letter draft',
    description: 'Editable first-pass narrative anchored to the job, company, and profile.',
  },
  {
    label: 'Short answers and paste fields',
    description: 'Field-by-field text ready for ATS forms, prompts, and manual copy/paste.',
  },
] as const

export const foundationTracks = [
  {
    title: 'App shell',
    description:
      'App Router routes, layout, and visual scaffolding for the first dashboard experience.',
    paths: ['app/', 'app/dashboard'],
  },
  {
    title: 'Shared domain contracts',
    description:
      'Workflow status, recommendation levels, and typed product entities that mirror the planning docs.',
    paths: ['lib/domain', 'lib/scoring', 'lib/ai'],
  },
  {
    title: 'Supabase data edge',
    description:
      'Browser and server clients ready for the seeded internal operator setup and future auth only when it is truly needed.',
    paths: ['lib/supabase', '.env.example', 'supabase/migrations'],
  },
] as const
