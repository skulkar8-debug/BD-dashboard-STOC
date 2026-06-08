import { google } from 'googleapis'
import { GOOGLE_SCOPES, getGoogleOAuthConfig } from './config'
import {
  GOOGLE_SCOPE_VERSION,
  fetchTokenScopes,
  scopesIncludeWrite,
} from './errors'
import {
  clearGoogleSession,
  consumeOAuthState,
  createOAuthState,
  getGoogleSession,
  setGoogleSession,
  setOAuthState,
  type GoogleTokenSession,
} from './session'

export function createOAuth2Client() {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig()
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export async function getGoogleAuthUrl(returnTo = '/roadmap/settings'): Promise<string> {
  const client = createOAuth2Client()
  const state = createOAuthState()
  await setOAuthState(state)

  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES,
    include_granted_scopes: false,
    state: JSON.stringify({ nonce: state, returnTo }),
  })
}

export async function handleOAuthCallback(
  code: string,
  stateParam: string | null
): Promise<{ returnTo: string; email?: string }> {
  let returnTo = '/roadmap/settings'
  let nonce = ''

  if (stateParam) {
    try {
      const parsed = JSON.parse(stateParam) as { nonce?: string; returnTo?: string }
      nonce = parsed.nonce ?? ''
      if (parsed.returnTo?.startsWith('/')) returnTo = parsed.returnTo
    } catch {
      throw new Error('Invalid OAuth state')
    }
  }

  const valid = await consumeOAuthState(nonce)
  if (!valid) throw new Error('OAuth state mismatch')

  const client = createOAuth2Client()
  const { tokens } = await client.getToken(code)
  client.setCredentials(tokens)

  const grantedScopes = tokens.scope?.split(' ').filter(Boolean) ?? []
  if (!scopesIncludeWrite(grantedScopes)) {
    throw new Error(
      'Google did not grant spreadsheet write access. Reconnect and approve all requested permissions.'
    )
  }

  let email: string | undefined
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client })
    const profile = await oauth2.userinfo.get()
    email = profile.data.email ?? undefined
  } catch {
    // email is optional for sheet access
  }

  const session: GoogleTokenSession = {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry_date ?? Date.now() + 3600_000,
    email,
    scopeVersion: GOOGLE_SCOPE_VERSION,
  }

  await setGoogleSession(session)
  return { returnTo, email }
}

async function loadValidSession(): Promise<GoogleTokenSession | null> {
  const session = await getGoogleSession()
  if (!session?.access_token) return null

  if (session.scopeVersion !== GOOGLE_SCOPE_VERSION) {
    await clearGoogleSession()
    return null
  }

  return session
}

export async function getAuthenticatedClient() {
  const session = await loadValidSession()
  if (!session) return null

  const client = createOAuth2Client()
  client.setCredentials({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expiry_date: session.expiry_date,
  })

  const isExpired = !session.expiry_date || Date.now() >= session.expiry_date - 60_000
  if (isExpired && session.refresh_token) {
    const { credentials } = await client.refreshAccessToken()
    const nextSession: GoogleTokenSession = {
      access_token: credentials.access_token!,
      refresh_token: credentials.refresh_token ?? session.refresh_token,
      expiry_date: credentials.expiry_date ?? Date.now() + 3600_000,
      email: session.email,
      scopeVersion: GOOGLE_SCOPE_VERSION,
    }
    await setGoogleSession(nextSession)
    client.setCredentials(credentials)
  } else if (isExpired) {
    await clearGoogleSession()
    return null
  }

  return client
}

export async function getAuthStatus() {
  const session = await loadValidSession()
  if (!session?.access_token) {
    return { connected: false as const }
  }

  const client = await getAuthenticatedClient()
  if (!client) {
    return { connected: false as const }
  }

  const scopes = await fetchTokenScopes(session.access_token)
  const canWrite = scopesIncludeWrite(scopes)

  return {
    connected: true as const,
    email: session.email,
    expiresAt: session.expiry_date,
    canWrite,
    needsReauth: !canWrite,
  }
}
