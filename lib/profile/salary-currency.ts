import {
  SUPPORTED_SALARY_CURRENCIES,
  type SupportedSalaryCurrency,
} from '@/lib/jobs/salary-estimation'

const LABELS: Record<SupportedSalaryCurrency, string> = {
  USD: 'USD',
  CAD: 'CAD',
  EUR: 'EUR',
  GBP: 'GBP',
}

export const SALARY_CURRENCY_OPTIONS = SUPPORTED_SALARY_CURRENCIES.map((value) => ({
  label: LABELS[value],
  value,
}))

export function normalizeSalaryFloorCurrency(raw: string | null | undefined): SupportedSalaryCurrency {
  const code = String(raw ?? '')
    .trim()
    .toUpperCase()

  return (SUPPORTED_SALARY_CURRENCIES as readonly string[]).includes(code)
    ? (code as SupportedSalaryCurrency)
    : 'USD'
}
