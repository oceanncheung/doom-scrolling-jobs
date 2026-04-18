/**
 * Normalize a user-entered web URL so the backend accepts domain-only inputs
 * (e.g. "google.com") without forcing the user to type "https://www." up front.
 *
 * Rules:
 * - Returns null for empty / whitespace-only input.
 * - Preserves an existing `http://` or `https://` scheme as-is (doesn't force
 *   upgrade — some users legitimately enter http-only intranet links).
 * - Adds `https://` when the input looks like a hostname (contains a dot and
 *   no whitespace). That covers `google.com`, `www.google.com`,
 *   `linkedin.com/in/foo`, subdomains, and paths.
 * - Leaves non-URL-like input untouched (e.g. `notes` or `draft 1`) so
 *   downstream validation / storage can decide how to handle it. We intentionally
 *   don't throw here — failing input validation for a URL field is a UI concern,
 *   not a normalizer's job.
 *
 * Call sites (examples):
 * - app/profile/actions.ts — saveOperatorProfile reads linkedinUrl,
 *   portfolioPrimaryUrl, personalSiteUrl from formData.
 * - Portfolio item URL fields on the Experience section.
 * - Anywhere else that reads a web URL from user input.
 *
 * Not appropriate for:
 * - mailto:, tel:, sms: or other non-http(s) URIs (pass them through raw).
 * - internal relative paths (they shouldn't reach this helper).
 */
export function normalizeWebUrl(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null

  // Already has an http(s) scheme — leave alone so we don't clobber the user's
  // choice (e.g. an intranet link that must stay http://).
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  // Other schemes (mailto:, tel:, etc.) — leave alone. The check is permissive:
  // any `scheme:` prefix that isn't http or https gets returned untouched.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed
  }

  // Only add `https://` when the input plausibly looks like a hostname: contains
  // a dot and no whitespace. This avoids auto-prefixing free-form text that
  // happens to land in a URL field (e.g. "needs review" or "see linkedin").
  if (trimmed.includes('.') && !/\s/.test(trimmed)) {
    return `https://${trimmed}`
  }

  // Fallback: return the raw input so a downstream validator / UI can surface
  // it untouched rather than silently reshaping into something the user didn't
  // intend.
  return trimmed
}
