/**
 * Shared `FormData`-entry parsing helpers used across server actions in app/jobs/actions.ts,
 * app/profile/actions.ts, and app/operators/actions.ts. Each action file previously defined
 * its own near-identical copies (see `.codex-artifacts/audit/report.md` item 3.1); this
 * module is the single canonical source.
 *
 * Keep these semantics stable — many callers rely on the `null`-vs-`""` distinction and the
 * list-parsing behavior (comma and newline as separators).
 */

export function asTextValue(value: FormDataEntryValue | null): string {
  return String(value ?? '').trim()
}

export function asOptionalText(value: FormDataEntryValue | null): string | null {
  const text = asTextValue(value)
  return text.length > 0 ? text : null
}

/**
 * Variant that accepts `unknown` rather than FormDataEntryValue — used when a form value has
 * already been widened (e.g. pulled from a parsed JSON blob) but the narrowing step still
 * wants the same "empty → null" semantics.
 */
export function asOptionalUnknownText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

export function asList(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function asOptionalInteger(value: FormDataEntryValue | null): number | null {
  const raw = asTextValue(value)
  if (!raw) {
    return null
  }
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : null
}
