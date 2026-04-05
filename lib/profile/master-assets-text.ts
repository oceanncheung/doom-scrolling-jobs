export const ADD_DETAILS_PLACEHOLDER = '[Add details]'

export type ReviewState = 'needs-input' | 'ready' | 'review'

export function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

export function asObjectArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null)
}

export function cleanLine(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function stripUnmatchedBrackets(value: string) {
  const pairs = new Map([
    ['(', ')'],
    ['[', ']'],
    ['{', '}'],
  ])
  const openings = new Set(pairs.keys())
  const closings = new Map(
    Array.from(pairs.entries()).map(([open, close]) => [close, open]),
  )
  const chars = Array.from(value)
  const keep = chars.map(() => true)
  const stack: Array<{ char: string; index: number }> = []

  chars.forEach((char, index) => {
    if (openings.has(char)) {
      stack.push({ char, index })
      return
    }

    const opening = closings.get(char)

    if (!opening) {
      return
    }

    const last = stack[stack.length - 1]

    if (last && last.char === opening) {
      stack.pop()
      return
    }

    keep[index] = false
  })

  for (const item of stack) {
    keep[item.index] = false
  }

  return chars.filter((_, index) => keep[index]).join('')
}

export function normalizeListItemText(value: string) {
  let normalized = cleanLine(
    String(value ?? '')
      .replace(/^[•·▪◦*]\s*/u, '')
      .replace(/^-\s+(?!\d)/, ''),
  )

  normalized = normalized
    .replace(/^(?:and|or)\s+/i, '')
    .replace(/^[,;:]+\s*/, '')
    .replace(/\s*[,;:]+$/, '')
  normalized = stripUnmatchedBrackets(normalized)

  return cleanLine(normalized)
}

export function combineReviewStates(states: ReviewState[]) {
  if (states.includes('needs-input')) {
    return 'needs-input'
  }

  if (states.includes('review')) {
    return 'review'
  }

  return 'ready'
}

export function normalizeStringList(value: unknown, maxItems = 24) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => normalizeListItemText(String(item ?? '')))
    .filter(Boolean)
    .slice(0, maxItems)
}

function countUnmatchedOpenParentheses(value: string) {
  let openCount = 0

  for (const char of value) {
    if (char === '(') {
      openCount += 1
    } else if (char === ')' && openCount > 0) {
      openCount -= 1
    }
  }

  return openCount
}

function shouldMergeNarrativeListItem(previous: string, current: string) {
  if (!previous || !current) {
    return false
  }

  if (countUnmatchedOpenParentheses(previous) > 0) {
    return true
  }

  if (countUnmatchedOpenParentheses(current) > 0 && /^[a-z]/.test(current)) {
    return true
  }

  return false
}

function joinNarrativeListItems(previous: string, current: string) {
  const separator = countUnmatchedOpenParentheses(previous) > 0 ? ', ' : ' '
  return normalizeListItemText(`${previous}${separator}${current}`)
}

export function normalizeNarrativeTagList(value: unknown, maxItems = 24) {
  const normalized = normalizeStringList(value, maxItems * 3)
  const merged: string[] = []

  for (const item of normalized) {
    if (merged.length === 0) {
      merged.push(item)
      continue
    }

    const previous = merged[merged.length - 1]

    if (shouldMergeNarrativeListItem(previous, item)) {
      merged[merged.length - 1] = joinNarrativeListItems(previous, item)
      continue
    }

    merged.push(item)
  }

  return merged.slice(0, maxItems)
}
