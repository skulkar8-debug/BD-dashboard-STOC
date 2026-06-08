import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { getGoogleOAuthConfig } from './config'

const SESSION_COOKIE = 'google_sheets_session'
const STATE_COOKIE = 'google_oauth_state'

export interface GoogleTokenSession {
  access_token: string
  refresh_token?: string
  expiry_date: number
  email?: string
  /** Bumped when OAuth scopes change — stale sessions must re-authenticate. */
  scopeVersion?: number
}

function signPayload(payload: string, secret: string): string {
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

function verifySignedPayload(signed: string, secret: string): string | null {
  const i = signed.lastIndexOf('.')
  if (i === -1) return null

  const payload = signed.slice(0, i)
  const sig = signed.slice(i + 1)
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')

  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    return payload
  } catch {
    return null
  }
}

function encodeSession(session: GoogleTokenSession, secret: string): string {
  const payload = Buffer.from(JSON.stringify(session), 'utf8').toString('base64url')
  return signPayload(payload, secret)
}

function decodeSession(value: string, secret: string): GoogleTokenSession | null {
  const payload = verifySignedPayload(value, secret)
  if (!payload) return null

  try {
    const json = Buffer.from(payload, 'base64url').toString('utf8')
    return JSON.parse(json) as GoogleTokenSession
  } catch {
    return null
  }
}

export async function getGoogleSession(): Promise<GoogleTokenSession | null> {
  const authSecret = process.env.AUTH_SECRET?.trim()
  if (!authSecret) return null

  const jar = await cookies()
  const raw = jar.get(SESSION_COOKIE)?.value
  if (!raw) return null

  return decodeSession(raw, authSecret)
}

export async function setGoogleSession(session: GoogleTokenSession): Promise<void> {
  const { authSecret } = getGoogleOAuthConfig()
  const jar = await cookies()
  jar.set(SESSION_COOKIE, encodeSession(session, authSecret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
}

export async function clearGoogleSession(): Promise<void> {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
}

export async function setOAuthState(state: string): Promise<void> {
  const jar = await cookies()
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  })
}

export async function consumeOAuthState(state: string): Promise<boolean> {
  const jar = await cookies()
  const saved = jar.get(STATE_COOKIE)?.value
  jar.delete(STATE_COOKIE)
  return !!saved && saved === state
}

export function createOAuthState(): string {
  return randomBytes(24).toString('base64url')
}
