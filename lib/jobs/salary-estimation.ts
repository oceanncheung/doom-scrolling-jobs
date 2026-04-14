import type { OperatorProfileRecord } from '@/lib/domain/types'
import type { CompensationPeriod, NormalizedJobRecord, RankedJobRecord } from '@/lib/jobs/contracts'

/** Annual/unknown amounts above 10k use compact “$80K” style; other periods stay full currency. */
export function formatSalaryAmountForUi(
  amount: number,
  currency: string,
  period: CompensationPeriod,
): string {
  const formatter = new Intl.NumberFormat('en-US', {
    currency,
    maximumFractionDigits: 0,
    style: 'currency',
  })

  if (period !== 'annual' && period !== 'unknown') {
    return formatter.format(amount)
  }

  if (amount <= 10_000) {
    return formatter.format(amount)
  }

  const thousands = Math.round(amount / 1000)
  const currencySymbol = formatter.formatToParts(amount).find((p) => p.type === 'currency')?.value ?? ''
  return `${currencySymbol}${thousands}K`
}

type SalaryEstimateJob = Pick<
  NormalizedJobRecord,
  | 'department'
  | 'descriptionText'
  | 'employmentType'
  | 'locationLabel'
  | 'remoteRegions'
  | 'remoteType'
  | 'salaryCurrency'
  | 'salaryMax'
  | 'salaryMin'
  | 'salaryPeriod'
  | 'seniorityLabel'
  | 'skillsKeywords'
  | 'title'
>

export interface SalaryInsight {
  currency: string
  estimated: boolean
  label: string
  max?: number
  min?: number
  note?: string
  period: CompensationPeriod
  value: string
}

/** Codes with conversion rates for estimated ranges; profile salary target uses the same set. */
export const SUPPORTED_SALARY_CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP'] as const
export type SupportedSalaryCurrency = (typeof SUPPORTED_SALARY_CURRENCIES)[number]

const currencyConversionRates: Record<SupportedSalaryCurrency, number> = {
  CAD: 1.35,
  EUR: 0.92,
  GBP: 0.79,
  USD: 1,
}

const roleBenchmarks = [
  {
    baseMaxUsd: 112000,
    baseMinUsd: 82000,
    key: 'brand_visual',
    phrases: [
      'brand designer',
      'brand design',
      'visual designer',
      'visual design',
      'communication designer',
      'communication design',
      'integrated designer',
    ],
  },
  {
    baseMaxUsd: 98000,
    baseMinUsd: 70000,
    key: 'graphic_editorial',
    phrases: [
      'graphic designer',
      'graphic design',
      'editorial designer',
      'editorial design',
      'communication design',
      'print design',
      'layout design',
      'experiential graphic',
    ],
  },
  {
    baseMaxUsd: 106000,
    baseMinUsd: 76000,
    key: 'marketing_digital',
    phrases: [
      'marketing designer',
      'growth designer',
      'digital designer',
      'web designer',
      'website designer',
      'creative designer',
      'campaign design',
      'social creative',
      'landing pages',
    ],
  },
  {
    baseMaxUsd: 102000,
    baseMinUsd: 74000,
    key: 'production_presentation',
    phrases: [
      'production designer',
      'production artist',
      'presentation designer',
      'presentation design',
      'powerpoint designer',
      'slide design',
    ],
  },
  {
    baseMaxUsd: 124000,
    baseMinUsd: 86000,
    key: 'motion_art_direction',
    phrases: [
      'motion designer',
      'motion design',
      'motion graphics',
      'art director',
      'creative lead',
      'creative director',
      'art direction',
    ],
  },
]

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function asSearchText(values: string[]) {
  const normalized = values.map((value) => normalizeText(value)).filter(Boolean).join(' ')
  return ` ${normalized} `
}

function roundToNearest(amount: number, step = 5000) {
  return Math.round(amount / step) * step
}

function formatRangeValue(
  min: number,
  max: number,
  currency: string,
  period: CompensationPeriod,
) {
  const suffix =
    period === 'hourly'
      ? ' / hr'
      : period === 'daily'
        ? ' / day'
        : period === 'weekly'
          ? ' / wk'
          : period === 'monthly'
            ? ' / mo'
            : ''

  if (Math.abs(max - min) < 1000) {
    return `${formatSalaryAmountForUi(min, currency, period)}${suffix}`
  }

  return `${formatSalaryAmountForUi(min, currency, period)} - ${formatSalaryAmountForUi(max, currency, period)}${suffix}`
}

function getCompensationLabel(period: CompensationPeriod, estimated: boolean) {
  if (estimated || period === 'annual' || period === 'unknown') {
    return estimated ? 'Estimated salary' : 'Salary'
  }

  switch (period) {
    case 'hourly':
      return 'Hourly pay'
    case 'monthly':
      return 'Monthly pay'
    case 'weekly':
      return 'Weekly pay'
    case 'daily':
      return 'Daily pay'
    default:
      return 'Compensation'
  }
}

function hasSuspiciousStoredSalary(job: SalaryEstimateJob | RankedJobRecord) {
  const min = job.salaryMin ?? job.salaryMax ?? 0
  const max = job.salaryMax ?? job.salaryMin ?? min

  if (job.salaryPeriod !== 'annual' && job.salaryPeriod !== 'unknown') {
    return false
  }

  if (!min && !max) {
    return false
  }

  if (max > 0 && max < 10_000) {
    return true
  }

  return min >= 1900 && max <= 2105 && max - min <= 5
}

function getSeniorityMultiplier(job: SalaryEstimateJob) {
  const normalized = normalizeText([job.seniorityLabel ?? '', job.title].join(' '))

  if (normalized.includes('principal') || normalized.includes('staff')) {
    return 1.6
  }

  if (normalized.includes('director') || normalized.includes('lead')) {
    return 1.42
  }

  if (normalized.includes('senior') || normalized.includes('sr')) {
    return 1.24
  }

  if (normalized.includes('junior') || normalized.includes('associate')) {
    return 0.82
  }

  return 1
}

function getRoleBenchmark(job: SalaryEstimateJob) {
  const searchText = asSearchText([
    job.title,
    job.department ?? '',
    job.descriptionText,
    ...job.skillsKeywords,
  ])

  return (
    roleBenchmarks.find((benchmark) =>
      benchmark.phrases.some((phrase) => searchText.includes(` ${normalizeText(phrase)} `)),
    ) ?? {
      baseMaxUsd: 104000,
      baseMinUsd: 78000,
      key: 'general_design',
      phrases: [],
    }
  )
}

function inferCurrency(job: SalaryEstimateJob, profile?: OperatorProfileRecord) {
  if (job.salaryCurrency) {
    return job.salaryCurrency
  }

  if (profile?.salaryFloorCurrency) {
    return profile.salaryFloorCurrency
  }

  const regionText = asSearchText([job.locationLabel ?? '', ...job.remoteRegions])

  if (regionText.includes(' united kingdom ') || regionText.includes(' uk ')) {
    return 'GBP'
  }

  if (
    regionText.includes(' europe ') ||
    regionText.includes(' portugal ') ||
    regionText.includes(' germany ') ||
    regionText.includes(' france ')
  ) {
    return 'EUR'
  }

  if (regionText.includes(' canada ')) {
    return 'CAD'
  }

  return 'USD'
}

function getMarketMultiplier(job: SalaryEstimateJob, profile?: OperatorProfileRecord) {
  const regionText = asSearchText([
    job.locationLabel ?? '',
    ...job.remoteRegions,
    profile?.primaryMarket ?? '',
    ...(profile?.secondaryMarkets ?? []),
  ])

  if (regionText.includes(' united states ') || regionText.includes(' us national ')) {
    return 1.12
  }

  if (regionText.includes(' north america ')) {
    return 1.06
  }

  if (regionText.includes(' canada ')) {
    return 1
  }

  if (regionText.includes(' united kingdom ')) {
    return 0.94
  }

  if (regionText.includes(' europe ')) {
    return 0.88
  }

  if (regionText.includes(' portugal ')) {
    return 0.8
  }

  if (regionText.includes(' latin america ') || regionText.includes(' mexico ')) {
    return 0.78
  }

  if (regionText.includes(' apac ') || regionText.includes(' india ') || regionText.includes(' singapore ')) {
    return 0.76
  }

  if (regionText.includes(' worldwide ') || regionText.includes(' anywhere ') || regionText.includes(' global ')) {
    return 0.95
  }

  return 1
}

function convertFromUsd(amountUsd: number, currency: string) {
  return amountUsd * (currencyConversionRates[currency as SupportedSalaryCurrency] ?? 1)
}

function buildEstimatedRange(job: SalaryEstimateJob, profile?: OperatorProfileRecord) {
  const benchmark = getRoleBenchmark(job)
  const seniorityMultiplier = getSeniorityMultiplier(job)
  const marketMultiplier = getMarketMultiplier(job, profile)
  const currency = inferCurrency(job, profile)
  const estimatedMin = convertFromUsd(benchmark.baseMinUsd * seniorityMultiplier * marketMultiplier, currency)
  const estimatedMax = convertFromUsd(benchmark.baseMaxUsd * seniorityMultiplier * marketMultiplier, currency)
  const min = roundToNearest(Math.min(estimatedMin, estimatedMax))
  const max = roundToNearest(Math.max(estimatedMin, estimatedMax))

  return {
    currency,
    max: Math.max(max, min + 5000),
    min,
    period: 'annual' as CompensationPeriod,
  }
}

export function getEffectiveSalaryInsight(
  job: SalaryEstimateJob | RankedJobRecord,
  profile?: OperatorProfileRecord,
): SalaryInsight {
  if (job.salaryCurrency && (job.salaryMin || job.salaryMax) && !hasSuspiciousStoredSalary(job)) {
    const min = job.salaryMin ?? job.salaryMax ?? 0
    const max = job.salaryMax ?? job.salaryMin ?? min

    return {
      currency: job.salaryCurrency,
      estimated: false,
      label: getCompensationLabel(job.salaryPeriod, false),
      max,
      min,
      period: job.salaryPeriod,
      value: formatRangeValue(min, max, job.salaryCurrency, job.salaryPeriod),
    }
  }

  const estimate = buildEstimatedRange(job, profile)

  return {
    ...estimate,
    estimated: true,
    label: getCompensationLabel(estimate.period, true),
    note: 'Estimated market range',
    value: formatRangeValue(estimate.min, estimate.max, estimate.currency, estimate.period),
  }
}

export function getEffectiveSalaryBounds(
  job: SalaryEstimateJob | RankedJobRecord,
  profile?: OperatorProfileRecord,
) {
  const insight = getEffectiveSalaryInsight(job, profile)

  return {
    estimated: insight.estimated,
    max: insight.max,
    min: insight.min,
  }
}
