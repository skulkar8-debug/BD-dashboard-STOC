import { NextResponse } from 'next/server'
import { isGoogleOAuthConfigured } from '@/lib/google/config'
import { getAuthStatus } from '@/lib/google/oauth'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json({
      configured: false,
      connected: false,
    })
  }

  const status = await getAuthStatus()
  return NextResponse.json({
    configured: true,
    ...status,
  })
}
