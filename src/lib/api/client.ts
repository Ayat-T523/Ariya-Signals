/**
 * client.ts — the smallest HTTP client seam for the Ariya API (Frontend Step 4B).
 *
 * VITE_API_BASE_URL follows the same env convention as VITE_AUTH_MODE/
 * VITE_SUPABASE_URL (see .env.example) -- unset defaults to the local dev
 * backend's own default port (see ariya-lightci-python/api_server.py's
 * ARIYA_API_PORT default, 8420), never a deployed URL baked in.
 *
 * Plain fetch, not Axios -- native fetch is already used elsewhere in this
 * repo (see src/lib/db/index.ts) and is sufficient for a two-route JSON API.
 */

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8420').replace(/\/+$/, '')

export class ApiError extends Error {
  status: number
  errorCode: string | null

  constructor(status: number, errorCode: string | null, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errorCode = errorCode
  }
}

/** Thrown when the API host itself is unreachable (server down/CORS/network) -- distinct from ApiError, which means the server DID respond, just with an error. */
export class ApiUnreachableError extends Error {
  constructor(cause: unknown) {
    super('Ariya API is unreachable')
    this.name = 'ApiUnreachableError'
    this.cause = cause
  }
}

export async function apiPost<TResponse>(path: string, body: unknown): Promise<TResponse> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (cause) {
    throw new ApiUnreachableError(cause)
  }

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const errorCode = payload && typeof payload.error === 'string' ? payload.error : null
    const message = payload && typeof payload.message === 'string' ? payload.message : `Ariya API request failed (${response.status})`
    throw new ApiError(response.status, errorCode, message)
  }
  return payload as TResponse
}
