import { cleanLine } from '@/lib/profile/master-assets'

const COUNTRY_ALIASES: Array<{ country: string; pattern: RegExp }> = [
  { country: 'Canada', pattern: /\bcanada\b/i },
  { country: 'United States', pattern: /\b(united states|usa|u\.s\.a\.|u\.s\.|us)\b/i },
  { country: 'United Kingdom', pattern: /\b(united kingdom|uk|u\.k\.)\b/i },
  { country: 'Germany', pattern: /\bgermany\b/i },
  { country: 'Netherlands', pattern: /\bnetherlands\b/i },
  { country: 'France', pattern: /\bfrance\b/i },
  { country: 'Spain', pattern: /\bspain\b/i },
  { country: 'Portugal', pattern: /\bportugal\b/i },
  { country: 'Ireland', pattern: /\bireland\b/i },
  { country: 'Denmark', pattern: /\bdenmark\b/i },
  { country: 'Sweden', pattern: /\bsweden\b/i },
  { country: 'Singapore', pattern: /\bsingapore\b/i },
  { country: 'Australia', pattern: /\baustralia\b/i },
  { country: 'New Zealand', pattern: /\bnew zealand\b/i },
  { country: 'Japan', pattern: /\bjapan\b/i },
  { country: 'India', pattern: /\bindia\b/i },
]

const COUNTRY_HINTS: Array<{ country: string; hints: string[] }> = [
  {
    country: 'Canada',
    hints: [
      'toronto',
      'ontario',
      'vancouver',
      'montreal',
      'ottawa',
      'calgary',
      'edmonton',
      'halifax',
      'winnipeg',
      'victoria',
      'quebec city',
      'british columbia',
      'alberta',
      'manitoba',
      'saskatchewan',
      'nova scotia',
      'new brunswick',
      'newfoundland',
      'labrador',
      'prince edward island',
      'yukon',
      'nunavut',
      'northwest territories',
    ],
  },
  {
    country: 'United States',
    hints: [
      'new york',
      'san francisco',
      'los angeles',
      'seattle',
      'austin',
      'chicago',
      'boston',
      'denver',
      'atlanta',
      'miami',
      'portland',
      'washington dc',
      'washington, dc',
      'california',
      'texas',
      'illinois',
      'massachusetts',
      'colorado',
      'georgia',
      'florida',
      'oregon',
    ],
  },
  {
    country: 'United Kingdom',
    hints: ['london', 'manchester', 'edinburgh', 'england', 'scotland', 'wales'],
  },
  { country: 'Germany', hints: ['berlin', 'munich'] },
  { country: 'Netherlands', hints: ['amsterdam'] },
  { country: 'France', hints: ['paris'] },
  { country: 'Spain', hints: ['barcelona', 'madrid'] },
  { country: 'Portugal', hints: ['lisbon'] },
  { country: 'Ireland', hints: ['dublin'] },
  { country: 'Denmark', hints: ['copenhagen'] },
  { country: 'Sweden', hints: ['stockholm'] },
  { country: 'Australia', hints: ['sydney', 'melbourne'] },
  { country: 'New Zealand', hints: ['auckland'] },
  { country: 'Japan', hints: ['tokyo'] },
]

function normalizeValue(value: string) {
  return cleanLine(value)
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
}

export function deriveCountryFromLocationLabel(locationLabel: string) {
  const normalized = normalizeValue(locationLabel)

  if (!normalized) {
    return null
  }

  for (const { country, pattern } of COUNTRY_ALIASES) {
    if (pattern.test(normalized)) {
      return country
    }
  }

  for (const { country, hints } of COUNTRY_HINTS) {
    if (hints.some((hint) => normalized.includes(hint))) {
      return country
    }
  }

  return null
}

export function ensureLocationCountryFirst(markets: string[], locationLabel: string) {
  const deduped = Array.from(new Set(markets.map((value) => cleanLine(value)).filter(Boolean)))
  const derivedCountry = deriveCountryFromLocationLabel(locationLabel)

  if (!derivedCountry) {
    return deduped
  }

  return [derivedCountry, ...deduped.filter((value) => value.toLowerCase() !== derivedCountry.toLowerCase())]
}
