import { NextRequest, NextResponse } from 'next/server'
import { getAppUrl } from '@/lib/google/config'
import { handleOAuthCallback } from '@/lib/google/oauth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const oauthError = req.nextUrl.searchParams.get('error')

  if (oauthError) {
    const redirect = new URL('/roadmap/settings', getAppUrl())
    redirect.searchParams.set('google_error', oauthError)
    return NextResponse.redirect(redirect)
  }

  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 })
  }

  try {
    const { returnTo } = await handleOAuthCallback(code, state)
    const redirect = new URL(returnTo, getAppUrl())
    redirect.searchParams.set('google_connected', '1')
    return NextResponse.redirect(redirect)
  } catch (err) {
    const redirect = new URL('/roadmap/settings', getAppUrl())
    redirect.searchParams.set(
      'google_error',
      err instanceof Error ? err.message : 'OAuth failed'
    )
    return NextResponse.redirect(redirect)
  }
}
