export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.email',
]

export const ROADMAP_SHEET_ID =
  process.env.GOOGLE_ROADMAP_SHEET_ID?.trim() ||
  '1wqW8zgy2E_W6I5S_wi9iDqA4OWC0B74zd6l6_v3uQpo'

export const PIPELINE_SHEET_ID =
  process.env.GOOGLE_PIPELINE_SHEET_ID?.trim() ||
  '1x36UMX4T21Jc0Uv1WCSiCuYyLRK860rKzZpRet7xH_Y'

/** Tab name for pipeline data; falls back to the first sheet in the workbook. */
export const PIPELINE_TAB_NAME = process.env.GOOGLE_PIPELINE_TAB?.trim() || ''

export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}

function sanitizeClientId(raw: string | undefined): string {
  if (!raw) return ''
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
}

export function getGoogleOAuthConfig() {
  const clientId = sanitizeClientId(process.env.GOOGLE_CLIENT_ID)
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  const authSecret = process.env.AUTH_SECRET?.trim()

  if (!clientId || !clientSecret) {
    throw new Error(
      'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local.'
    )
  }
  if (!authSecret) {
    throw new Error(
      'AUTH_SECRET is not configured. Set a random string in .env.local to sign session cookies.'
    )
  }

  return {
    clientId,
    clientSecret,
    authSecret,
    redirectUri: `${getAppUrl()}/api/auth/google/callback`,
  }
}

export function isGoogleOAuthConfigured(): boolean {
  return !!(
    sanitizeClientId(process.env.GOOGLE_CLIENT_ID) &&
    process.env.GOOGLE_CLIENT_SECRET?.trim() &&
    process.env.AUTH_SECRET?.trim()
  )
}
