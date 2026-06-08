import { NextRequest, NextResponse } from 'next/server'
import { ROADMAP_SHEET_ID, isGoogleOAuthConfigured } from '@/lib/google/config'
import {
  fetchRoadmapTab,
  requireAuthenticatedClient,
  updateSheetCells,
} from '@/lib/google/sheets'
import {
  DATA_TIP_COL,
  DATA_TIP_FIELD_TO_COL,
  DATA_TIP_TAB,
  findSectorRowIndex,
  parseDataTipRows,
  sheetValueForField,
} from '@/lib/sheets/dataTipSheet'
import { googleApiErrorResponse } from '@/lib/google/errors'
import type { DataTipItem } from '@/lib/types'

export const dynamic = 'force-dynamic'

const SYNCABLE_FIELDS = new Set(Object.keys(DATA_TIP_FIELD_TO_COL))

export async function GET() {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      { error: 'not_configured', message: 'Google OAuth is not configured.' },
      { status: 503 }
    )
  }

  try {
    const rows = await fetchRoadmapTab(DATA_TIP_TAB)
    const items = parseDataTipRows(rows)
    return NextResponse.json({
      items,
      syncedAt: new Date().toISOString(),
    })
  } catch (err) {
    return googleApiErrorResponse(err, '/roadmap/data-tip')
  }
}

export async function PATCH(req: NextRequest) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      { error: 'not_configured', message: 'Google OAuth is not configured.' },
      { status: 503 }
    )
  }

  try {
    const body = (await req.json()) as {
      sector?: string
      updates?: Partial<DataTipItem>
    }

    const sector = body.sector?.trim()
    const updates = body.updates

    if (!sector || !updates || typeof updates !== 'object') {
      return NextResponse.json(
        { error: 'bad_request', message: 'sector and updates are required' },
        { status: 400 }
      )
    }

    const sheetUpdates: Partial<DataTipItem> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (SYNCABLE_FIELDS.has(key)) {
        sheetUpdates[key as keyof DataTipItem] = value as never
      }
    }

    if (Object.keys(sheetUpdates).length === 0) {
      return NextResponse.json({
        ok: true,
        syncedAt: new Date().toISOString(),
        note: 'No sheet-backed fields in update',
      })
    }

    const auth = await requireAuthenticatedClient()
    const rows = await fetchRoadmapTab(DATA_TIP_TAB)
    const rowIndex = findSectorRowIndex(rows, sector)

    if (rowIndex === -1) {
      return NextResponse.json(
        { error: 'not_found', message: `Sector "${sector}" not found in sheet` },
        { status: 404 }
      )
    }

    const cellUpdates = Object.entries(sheetUpdates).map(([field, value]) => ({
      colIndex: DATA_TIP_FIELD_TO_COL[field as keyof DataTipItem]!,
      rowIndex,
      value: sheetValueForField(field as keyof DataTipItem, value),
    }))

    cellUpdates.push({
      colIndex: DATA_TIP_COL.lastUpdated,
      rowIndex,
      value: new Date().toISOString().slice(0, 10),
    })

    await updateSheetCells(auth, ROADMAP_SHEET_ID, DATA_TIP_TAB, cellUpdates)

    return NextResponse.json({
      ok: true,
      sector,
      syncedAt: new Date().toISOString(),
    })
  } catch (err) {
    return googleApiErrorResponse(err, '/roadmap/data-tip')
  }
}
