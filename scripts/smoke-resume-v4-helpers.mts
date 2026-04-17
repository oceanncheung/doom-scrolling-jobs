import assert from 'node:assert/strict'

import { computeRelevanceHints, type RelevanceAnnotation } from '@/lib/ai/tasks/compute-relevance-hints'
import {
  compareEntriesByRecency,
  computeTenureMonths,
  filterIrrelevantEntries,
  filterSkillsToSource,
  parseResumeDateToMonths,
} from '@/lib/ai/tasks/generate-resume-variant'
import { verifyResumeVariant } from '@/lib/ai/tasks/verify-resume-variant'
import type { OperatorWorkspaceRecord, ResumeExperienceRecord } from '@/lib/domain/types'
import type { RankedJobRecord } from '@/lib/jobs/contracts'

const failures: string[] = []

function test(name: string, fn: () => void) {
  try {
    fn()
    console.info(`\u2713 ${name}`)
  } catch (error) {
    failures.push(`\u2717 ${name}: ${(error as Error).message}`)
    console.error(`\u2717 ${name}`)
    console.error(error)
  }
}

test('filterSkillsToSource keeps matching tools and strips soft skills', () => {
  const result = filterSkillsToSource(
    [
      'Figma',
      'Adobe Creative Suite',
      'Sketch', // not in source
      'Communication', // soft skill
      'Teamwork', // soft skill
      'Brand systems',
      'Illustrator', // alias of Adobe Illustrator via alias map
    ],
    {
      toolsPlatforms: ['Figma', 'Adobe Illustrator', 'Adobe Photoshop'],
      resumeSkills: ['Brand systems', 'Typography'],
      coreExpertise: ['Brand identity'],
      profileSkills: ['Design systems'],
    },
  )
  assert.ok(result.kept.includes('Figma'), 'Figma should survive')
  assert.ok(result.kept.includes('Brand systems'), 'Brand systems should survive')
  assert.ok(result.kept.includes('Illustrator'), 'Illustrator should match Adobe Illustrator via alias')
  assert.ok(!result.kept.includes('Sketch'), 'Sketch should be stripped — not in source')
  assert.ok(!result.kept.includes('Communication'), 'Communication should be stripped as soft skill')
  assert.ok(!result.kept.includes('Teamwork'), 'Teamwork should be stripped as soft skill')
  assert.ok(result.stripped.includes('Sketch'), 'stripped list should include Sketch')
  assert.ok(result.stripped.includes('Communication'), 'stripped list should include Communication')
})

test('filterSkillsToSource matches Adobe Creative Suite via canonical alias', () => {
  const result = filterSkillsToSource(['Adobe Creative Cloud'], {
    toolsPlatforms: ['Adobe Creative Suite'],
    resumeSkills: [],
    coreExpertise: [],
    profileSkills: [],
  })
  assert.equal(result.kept.length, 1, 'Creative Cloud alias should match Creative Suite source')
})

test('computeRelevanceHints buckets designer role vs healthcare admin', () => {
  const entries: Array<ResumeExperienceRecord & { id: string }> = [
    {
      id: 'exp_1',
      companyName: 'Acme',
      roleTitle: 'Senior Brand Designer',
      locationLabel: 'Remote',
      startDate: 'Jan 2020',
      endDate: 'Dec 2022',
      summary: 'Led brand and marketing design',
      highlights: [
        'Designed brand identity system for B2B launches',
        'Built presentation templates in Figma for exec team',
        'Shipped design system components used across marketing',
      ],
    },
    {
      id: 'exp_2',
      companyName: 'Mercy Hospital',
      roleTitle: 'Healthcare Administrator',
      locationLabel: 'Toronto',
      startDate: 'Jan 2018',
      endDate: 'Dec 2019',
      summary: 'Managed patient intake operations',
      highlights: ['Coordinated patient intake workflow', 'Managed a team of administrative staff'],
    },
  ]
  const job = {
    title: 'Senior Graphic Designer',
    skillsKeywords: ['Figma', 'Brand identity', 'Design systems', 'Typography'],
    requirements: ['5+ years in brand design', 'Fluent in Figma'],
    preferredQualifications: ['Design system ownership'],
  } as const
  const hints = computeRelevanceHints(entries, job as unknown as RankedJobRecord)
  const acme = hints.find((h) => h.id === 'exp_1')!
  const mercy = hints.find((h) => h.id === 'exp_2')!
  assert.equal(acme.relevanceHint, 'high', `Acme designer should be high, got ${acme.relevanceHint}`)
  assert.equal(mercy.relevanceHint, 'low', `Mercy admin should be low, got ${mercy.relevanceHint}`)
})

test('verifyResumeVariant flags fabricated percentages', () => {
  const workspace = {
    resumeMaster: {
      experienceEntries: [
        {
          companyName: 'Acme',
          roleTitle: 'Senior Brand Designer',
          locationLabel: 'Remote',
          startDate: 'Jan 2020',
          endDate: 'Dec 2022',
          summary: 'Led brand design',
          highlights: [
            'Designed brand identity for product launches',
            'Built Figma components used by marketing team',
          ],
        },
      ],
      archivedExperienceEntries: [],
      summaryText: 'Senior designer focused on brand systems.',
      selectedImpactHighlights: ['Owned brand identity refresh'],
    },
  } as unknown as OperatorWorkspaceRecord
  const variant = {
    changeSummaryForUser: 'Tailored for senior brand role',
    tailoringRationale: 'Highlights brand work',
    headline: 'Senior Brand Designer',
    summary: 'Senior designer focused on brand systems.',
    highlightedRequirements: ['Brand identity'],
    skillsSection: ['Figma'],
    experienceEntries: [
      {
        companyName: 'Acme',
        roleTitle: 'Senior Brand Designer',
        locationLabel: 'Remote',
        startDate: 'Jan 2020',
        endDate: 'Dec 2022',
        summary: 'Led brand design',
        highlights: [
          'Designed brand identity for product launches, increasing engagement 38%', // fabricated 38%
          'Built Figma components used by marketing team',
        ],
      },
    ],
  }
  const job = { skillsKeywords: ['Figma', 'Brand identity'] } as unknown as RankedJobRecord
  const result = verifyResumeVariant(variant, job, workspace)
  assert.ok(result.unverifiedClaims.length >= 1, 'Should flag fabricated 38% claim')
  assert.equal(result.unverifiedClaims[0].kind, 'percent')
  assert.ok(result.userFacingNote.includes('unverified'))
  assert.ok(result.coverage.matched >= 1)
})

test('verifyResumeVariant does not flag numbers present in source', () => {
  const workspace = {
    resumeMaster: {
      experienceEntries: [
        {
          companyName: 'Acme',
          roleTitle: 'Senior Brand Designer',
          locationLabel: 'Remote',
          startDate: 'Jan 2020',
          endDate: 'Dec 2022',
          summary: '',
          highlights: ['Shipped brand refresh that increased web conversion 28% across product pages'],
        },
      ],
      archivedExperienceEntries: [],
      summaryText: '',
      selectedImpactHighlights: [],
    },
  } as unknown as OperatorWorkspaceRecord
  const variant = {
    changeSummaryForUser: '',
    tailoringRationale: '',
    headline: 'Senior Brand Designer',
    summary: 'Brand designer.',
    highlightedRequirements: [],
    skillsSection: [],
    experienceEntries: [
      {
        companyName: 'Acme',
        roleTitle: 'Senior Brand Designer',
        locationLabel: 'Remote',
        startDate: 'Jan 2020',
        endDate: 'Dec 2022',
        summary: '',
        highlights: ['Led brand refresh driving 28% lift in web conversion across product pages'],
      },
    ],
  }
  const job = { skillsKeywords: [] } as unknown as RankedJobRecord
  const result = verifyResumeVariant(variant, job, workspace)
  assert.equal(result.unverifiedClaims.length, 0, 'Should not flag a number present in source')
})

test('parseResumeDateToMonths handles common formats', () => {
  assert.equal(parseResumeDateToMonths('Jan 2020'), 2020 * 12 + 0)
  assert.equal(parseResumeDateToMonths('January 2020'), 2020 * 12 + 0)
  assert.equal(parseResumeDateToMonths('Dec 2022'), 2022 * 12 + 11)
  assert.equal(parseResumeDateToMonths('2020-01'), 2020 * 12 + 0)
  assert.equal(parseResumeDateToMonths('01/2020'), 2020 * 12 + 0)
  assert.equal(parseResumeDateToMonths('2020'), 2020 * 12 + 0)
  assert.equal(parseResumeDateToMonths('Present'), null)
  assert.equal(parseResumeDateToMonths('current'), null)
  assert.equal(parseResumeDateToMonths(''), null)
  assert.equal(parseResumeDateToMonths('garbage'), null)
})

test('compareEntriesByRecency sorts Present before past roles, newer startDate wins ties', () => {
  const entries = [
    { startDate: 'Jan 2015', endDate: 'Dec 2018' }, // past
    { startDate: 'Jan 2020', endDate: 'Present' }, // current, started 2020
    { startDate: 'Jan 2022', endDate: 'Present' }, // current, started 2022 (newer)
    { startDate: 'Jan 2019', endDate: 'Dec 2020' }, // past, mid
  ]
  const sorted = [...entries].sort(compareEntriesByRecency)
  assert.equal(sorted[0].startDate, 'Jan 2022', 'Most recently started Present role should be first')
  assert.equal(sorted[1].startDate, 'Jan 2020', 'Second Present role should be second')
  assert.equal(sorted[2].endDate, 'Dec 2020', 'Newer past end should come before older past end')
  assert.equal(sorted[3].endDate, 'Dec 2018', 'Oldest past end should be last')
})

test('computeTenureMonths handles Present and unparseable', () => {
  // 3 years = 36 months exact
  assert.equal(computeTenureMonths({ startDate: 'Jan 2020', endDate: 'Jan 2023' }), 36)
  // < 1 year
  assert.equal(computeTenureMonths({ startDate: 'Jan 2020', endDate: 'Jul 2020' }), 6)
  // unparseable start = 0 tenure
  assert.equal(computeTenureMonths({ startDate: '', endDate: 'Dec 2020' }), 0)
  // Present end should be >= today's month - startDate
  const montranLike = computeTenureMonths({ startDate: 'Jan 2020', endDate: 'Present' })
  assert.ok(montranLike >= 36, `Long-tenure Present role should show real tenure, got ${montranLike}`)
})

test('filterIrrelevantEntries drops zero-overlap roles but never below MIN floor', () => {
  const montran: ResumeExperienceRecord = {
    companyName: 'Montran',
    roleTitle: 'Design & Digital Marketing Lead',
    locationLabel: 'Remote',
    startDate: '2024',
    endDate: 'Present',
    summary: '',
    highlights: ['Led brand system across marketing deliverables', 'Designed product marketing visuals'],
  }
  const ha: ResumeExperienceRecord = {
    companyName: 'Hospital Authority, HKSAR Government',
    roleTitle: 'Executive Assistant, Internal Communications',
    locationLabel: 'Hong Kong',
    startDate: '2019',
    endDate: '2020',
    summary: '',
    highlights: ['Coordinated internal communications scheduling'],
  }
  const relevance = new Map<string, RelevanceAnnotation>([
    [
      'montran::design & digital marketing lead',
      { id: 'a', relevanceHint: 'high', keywordMatches: 3, keywordTotal: 5, titleSimilarity: 0.5 },
    ],
    [
      'hospital authority, hksar government::executive assistant, internal communications',
      { id: 'b', relevanceHint: 'low', keywordMatches: 0, keywordTotal: 5, titleSimilarity: 0 },
    ],
  ])
  const result = filterIrrelevantEntries([montran, ha], relevance)
  assert.equal(result.kept.length, 2, 'MIN floor keeps both when only 2 entries exist')
  assert.equal(result.dropped.length, 0, 'MIN floor means HA stays as rescued Tier D')

  // Now with more entries — HA should actually drop.
  const mm = {
    ...montran,
    companyName: 'MM.S',
    roleTitle: 'Founder / Fractional Creative Director',
    startDate: '2019',
  }
  const rbc = {
    ...montran,
    companyName: 'RBC',
    roleTitle: 'Creative Consultant / Senior Communication Designer',
    startDate: '2021',
    endDate: '2023',
  }
  const fuller = new Map<string, RelevanceAnnotation>([
    ...relevance.entries(),
    [
      'mm.s::founder / fractional creative director',
      { id: 'c', relevanceHint: 'high', keywordMatches: 4, keywordTotal: 5, titleSimilarity: 0.4 },
    ],
    [
      'rbc::creative consultant / senior communication designer',
      { id: 'd', relevanceHint: 'high', keywordMatches: 3, keywordTotal: 5, titleSimilarity: 0.5 },
    ],
  ])
  const fullResult = filterIrrelevantEntries([montran, mm, rbc, ha], fuller)
  assert.equal(fullResult.kept.length, 3, 'With 4 entries and 3 strong, HA should drop')
  assert.ok(
    !fullResult.kept.some((e) => e.companyName === 'Hospital Authority, HKSAR Government'),
    'HA must not survive when 3+ relevant roles exist',
  )
  assert.equal(fullResult.dropped.length, 1)
})

test('real-shape end-to-end: HA buckets low, Montran/MM.S/RBC bucket high, HA drops', () => {
  // Shapes taken verbatim from the real master (see supabase resume_master for this operator).
  // This is the scenario the user actually hit — v4 must handle it correctly in code, not
  // only via LLM compliance.
  const entries: Array<ResumeExperienceRecord & { id: string }> = [
    {
      id: 'exp_1',
      companyName: 'Montran',
      roleTitle: 'Design & Digital Marketing Lead',
      locationLabel: 'Remote',
      startDate: '2024',
      endDate: 'Present',
      summary: '',
      highlights: [
        'Owned brand identity system for product marketing launches',
        'Led design for executive presentations and investor decks',
        'Shipped Figma design system components used across all customer-facing materials',
      ],
    },
    {
      id: 'exp_2',
      companyName: 'MM.S',
      roleTitle: 'Founder / Fractional Creative Director',
      locationLabel: 'Remote',
      startDate: '2019',
      endDate: 'Present',
      summary: '',
      highlights: [
        'Led brand identity engagements for B2B SaaS clients',
        'Designed marketing sites and product UI across multiple launches',
        'Directed visual identity rebrands including typography, colour, logo systems',
      ],
    },
    {
      id: 'exp_3',
      companyName: 'RBC',
      roleTitle: 'Creative Consultant / Senior Communication Designer',
      locationLabel: 'Toronto',
      startDate: '2021',
      endDate: '2023',
      summary: '',
      highlights: ['Designed internal brand comms templates', 'Partnered with marketing on campaign visuals'],
    },
    {
      id: 'exp_4',
      companyName: 'Hospital Authority, HKSAR Government',
      roleTitle: 'Executive Assistant, Internal Communications',
      locationLabel: 'Hong Kong',
      startDate: '2019',
      endDate: '2020',
      summary: '',
      highlights: ['Coordinated scheduling for the internal communications department'],
    },
  ]
  const job = {
    title: 'Senior Graphic Designer',
    skillsKeywords: ['Figma', 'Brand identity', 'Design systems', 'Typography', 'Marketing design'],
    requirements: ['5+ years brand design', 'Fluent in Figma', 'Design system ownership'],
    preferredQualifications: ['Agency or consultancy experience'],
  } as unknown as RankedJobRecord

  const hints = computeRelevanceHints(entries, job)
  const byId = new Map(hints.map((hint) => [hint.id, hint] as const))
  assert.equal(byId.get('exp_1')?.relevanceHint, 'high', 'Montran should bucket high')
  assert.equal(byId.get('exp_2')?.relevanceHint, 'high', 'MM.S should bucket high')
  // RBC has "Senior Communication Designer" — shares "designer" after seniority stopwords.
  const rbcHint = byId.get('exp_3')?.relevanceHint
  assert.ok(rbcHint === 'high' || rbcHint === 'medium', `RBC should bucket high or medium, got ${rbcHint}`)
  assert.equal(byId.get('exp_4')?.relevanceHint, 'low', 'HA should bucket low')

  // Now run through the filter: HA should drop because 3 strong roles exist.
  const relevance = new Map(hints.map((h) => [`${entries.find((e) => e.id === h.id)!.companyName}::${entries.find((e) => e.id === h.id)!.roleTitle}`.toLowerCase(), h] as const))
  const stripId = (entry: ResumeExperienceRecord & { id: string }): ResumeExperienceRecord => {
    const copy = { ...entry } as ResumeExperienceRecord & { id?: string }
    delete copy.id
    return copy
  }
  const filtered = filterIrrelevantEntries(entries.map(stripId), relevance)
  const keptNames = filtered.kept.map((entry) => entry.companyName)
  assert.ok(!keptNames.includes('Hospital Authority, HKSAR Government'), `HA must drop; kept: ${keptNames.join(', ')}`)
  assert.ok(filtered.kept.length >= 3, `At least Montran/MM.S/RBC kept; got ${filtered.kept.length}`)

  // And the sort: reverse-chronological with Present roles first.
  const sorted = [...filtered.kept].sort(compareEntriesByRecency)
  assert.equal(sorted[0].endDate, 'Present', 'First role must be a Present role')
  assert.equal(sorted[sorted.length - 1].endDate, '2023', 'Past role (RBC) ends up last')
})

test('seniority words no longer inflate title similarity', () => {
  const entries = [
    {
      id: 'ea',
      companyName: 'HA',
      roleTitle: 'Senior Executive Assistant',
      locationLabel: '',
      startDate: '2019',
      endDate: '2020',
      summary: '',
      highlights: ['Scheduled meetings', 'Coordinated travel'],
    },
  ]
  const job = {
    title: 'Senior Graphic Designer',
    skillsKeywords: ['Figma', 'Design systems'],
    requirements: ['Brand identity'],
    preferredQualifications: [],
  } as unknown as RankedJobRecord
  const hints = computeRelevanceHints(entries, job)
  assert.equal(hints[0].titleSimilarity, 0, 'Senior should not count as shared token')
  assert.equal(hints[0].relevanceHint, 'low', 'Zero overlap should bucket low')
})

if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s):`)
  failures.forEach((message) => console.error(message))
  process.exit(1)
}
console.info('\nAll resume-v4 helper smoke checks passed.')
