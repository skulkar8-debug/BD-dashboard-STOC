'use client'

/**
 * Sync roadmap data from Google Sheets via OAuth-backed API routes.
 */

import type { AppData, Person, Sector } from './types'
import { ROADMAP_SHEET_ID } from './google/config'

export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${ROADMAP_SHEET_ID}/edit`

export interface SyncResult {
  ok: boolean
  sectors: number
  people: number
  error?: string
  syncedAt: string
  needsAuth?: boolean
  loginUrl?: string
}

interface RoadmapApiResponse {
  sectors: Sector[]
  people: Person[]
  syncedAt: string
  error?: string
  message?: string
  loginUrl?: string
}

export async function syncFromGoogleSheet(
  currentData: AppData
): Promise<{ data: AppData; result: SyncResult }> {
  const syncedAt = new Date().toISOString()

  try {
    const res = await fetch('/api/sheets/roadmap', { cache: 'no-store' })
    const body = (await res.json()) as RoadmapApiResponse

    if (!res.ok) {
      const needsAuth =
        res.status === 401 ||
        res.status === 403 ||
        body.error === 'not_authenticated' ||
        body.error === 'insufficient_scopes'
      return {
        data: currentData,
        result: {
          ok: false,
          sectors: 0,
          people: 0,
          error: body.message ?? 'Failed to sync from Google Sheet',
          syncedAt,
          needsAuth,
          loginUrl: body.loginUrl ?? '/api/auth/google?returnTo=/roadmap/settings',
        },
      }
    }

    const { sectors, people } = body

    if (sectors.length === 0) {
      throw new Error('Sectors tab returned no rows — check sheet permissions.')
    }

    const merged = sectors.map((s) => {
      const existing = currentData.sectors.find((e) => e.id === s.id)
      return {
        ...s,
        priority: existing?.priority ?? s.priority,
        reportLink: s.reportLink || existing?.reportLink || '',
        tipLink: s.tipLink || existing?.tipLink || '',
        dataLink: s.dataLink || existing?.dataLink || '',
        notes: s.notes || existing?.notes || '',
        outreachStatus: existing?.outreachStatus ?? s.outreachStatus,
      }
    })

    const nextData: AppData = {
      ...currentData,
      sectors: merged,
      people: people.length > 0 ? people : currentData.people,
    }

    return {
      data: nextData,
      result: {
        ok: true,
        sectors: merged.length,
        people: people.length,
        syncedAt: body.syncedAt ?? syncedAt,
      },
    }
  } catch (err) {
    return {
      data: currentData,
      result: {
        ok: false,
        sectors: 0,
        people: 0,
        error: err instanceof Error ? err.message : String(err),
        syncedAt,
      },
    }
  }
}

export async function fetchGoogleAuthStatus(): Promise<{
  configured: boolean
  connected: boolean
  email?: string
  canWrite?: boolean
  needsReauth?: boolean
}> {
  const res = await fetch('/api/auth/google/status', { cache: 'no-store' })
  if (!res.ok) return { configured: false, connected: false }
  return res.json()
}

export async function disconnectGoogle(): Promise<void> {
  await fetch('/api/auth/google/logout', { method: 'POST' })
}
