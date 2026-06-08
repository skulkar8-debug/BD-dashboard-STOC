import { NextRequest, NextResponse } from 'next/server'
import { ROADMAP_SHEET_ID, isGoogleOAuthConfigured } from '@/lib/google/config'
import { googleApiErrorResponse } from '@/lib/google/errors'
import { requireAuthenticatedClient, fetchSheetValues } from '@/lib/google/sheets'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tab: string }> }
) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      { error: 'not_configured', message: 'Google OAuth is not configured.' },
      { status: 503 }
    )
  }

  const { tab } = await params
  const tabName = decodeURIComponent(tab)

  try {
    const auth = await requireAuthenticatedClient()
    const rows = await fetchSheetValues(auth, ROADMAP_SHEET_ID, tabName)
    return NextResponse.json({ tab: tabName, rows, syncedAt: new Date().toISOString() })
  } catch (err) {
    return googleApiErrorResponse(err, '/roadmap/settings')
  }
}
