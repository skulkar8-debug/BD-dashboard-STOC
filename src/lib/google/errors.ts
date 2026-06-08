import { NextResponse } from 'next/server'
import { clearGoogleSession } from './session'

export const GOOGLE_SCOPE_VERSION = 2

export const GOOGLE_SHEETS_WRITE_SCOPE =
  'https://www.googleapis.com/auth/spreadsheets'

export function isInsufficientScopeError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false

  const message =
    'message' in err && typeof err.message === 'string'
      ? err.message.toLowerCase()
      : ''

  if (message.includes('insufficient authentication scopes')) return true

  const status =
    'code' in err && typeof err.code === 'number'
      ? err.code
      : 'status' in err && typeof err.status === 'number'
        ? err.status
        : 'response' in err &&
            err.response &&
            typeof err.response === 'object' &&
            'status' in err.response
          ? (err.response as { status?: number }).status
          : undefined

  return status === 403 && message.includes('scope')
}

export function scopesIncludeWrite(scopes: string[]): boolean {
  return scopes.includes(GOOGLE_SHEETS_WRITE_SCOPE)
}

export async function fetchTokenScopes(accessToken: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
    )
    if (!res.ok) return []
    const data = (await res.json()) as { scope?: string }
    return data.scope?.split(' ').filter(Boolean) ?? []
  } catch {
    return []
  }
}

export async function googleApiErrorResponse(
  err: unknown,
  returnTo = '/roadmap/settings'
): Promise<NextResponse> {
  const loginUrl = `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`

  if (isInsufficientScopeError(err)) {
    await clearGoogleSession()
    return NextResponse.json(
      {
        error: 'insufficient_scopes',
        message:
          'Your Google account is connected with read-only access. Disconnect and reconnect to grant sheet write permission.',
        loginUrl,
      },
      { status: 403 }
    )
  }

  const status =
    err && typeof err === 'object' && 'status' in err && err.status === 401
      ? 401
      : 500
  const message = err instanceof Error ? err.message : 'Request failed'

  return NextResponse.json(
    {
      error: status === 401 ? 'not_authenticated' : 'request_failed',
      message,
      loginUrl,
    },
    { status }
  )
}
