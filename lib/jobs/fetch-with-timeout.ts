import 'server-only'

const defaultSourceFetchTimeoutMs = 15_000

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = defaultSourceFetchTimeoutMs,
) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal

  try {
    return await fetch(input, {
      ...init,
      signal,
    })
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`Request timed out after ${timeoutMs}ms.`)
    }

    throw error
  }
}
