import { NextResponse } from 'next/server'
import { isGoogleOAuthConfigured } from '@/lib/google/config'
import { googleApiErrorResponse } from '@/lib/google/errors'
import { fetchRoadmapTab } from '@/lib/google/sheets'
import { parsePeopleFromRows, parseSectorsFromRows } from '@/lib/sheets/roadmapParser'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      {
        error: 'not_configured',
        message:
          'Google OAuth is not configured on the server. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and AUTH_SECRET.',
      },
      { status: 503 }
    )
  }

  try {
    const [sectorRows, peopleRows] = await Promise.all([
      fetchRoadmapTab('Sectors'),
      fetchRoadmapTab('People'),
    ])

    const sectors = parseSectorsFromRows(sectorRows)
    const people = parsePeopleFromRows(peopleRows)

    if (sectors.length === 0) {
      return NextResponse.json(
        { error: 'empty_sheet', message: 'Sectors tab returned no rows.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      sectors,
      people,
      syncedAt: new Date().toISOString(),
    })
  } catch (err) {
    return googleApiErrorResponse(err, '/roadmap/settings')
  }
}
