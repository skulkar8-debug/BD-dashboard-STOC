import { NextRequest, NextResponse } from 'next/server'
import { isGoogleOAuthConfigured } from '@/lib/google/config'
import { getGoogleAuthUrl } from '@/lib/google/oauth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      {
        error: 'not_configured',
        message:
          'Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and AUTH_SECRET in .env.local',
      },
      { status: 503 }
    )
  }

  const returnTo = req.nextUrl.searchParams.get('returnTo') ?? '/roadmap/settings'
  const safeReturn = returnTo.startsWith('/') ? returnTo : '/roadmap/settings'
  const url = await getGoogleAuthUrl(safeReturn)
  return NextResponse.redirect(url)
}
