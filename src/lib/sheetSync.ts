'use client'

/**
 * Live sync from the published Google Sheet via the gviz/tq CSV endpoint.
 * No API key required — works as long as the sheet is shared
 * "Anyone with the link can view".
 */

import type { AppData, Sector, SectorStatus, Priority, Person, PersonRole } from './types'

const SHEET_ID = '1wqW8zgy2E_W6I5S_wi9iDqA4OWC0B74zd6l6_v3uQpo'
const BASE     = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=`

// ─── simple CSV parser (handles quoted fields with commas) ──────────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[]      = []
  let field              = ''
  let inQuotes           = false

  for (let i = 0; i < text.length; i++) {
    const ch   = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++ }
      else if (ch === '"')            inQuotes = false
      else                            field += ch
    } else {
      if      (ch === '"')                    inQuotes = true
      else if (ch === ',')                  { row.push(field.trim()); field = '' }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && next === '\n')   i++
        row.push(field.trim()); rows.push(row); row = []; field = ''
      } else                                field += ch
    }
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row) }
  return rows.filter(r => r.some(c => c !== ''))
}

// Parse date strings like "04-21-26" or "2026-04-21" → "2026-04-21"
function parseDate(raw: string): string {
  if (!raw || raw.trim() === '') return ''
  const s = raw.trim()
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // MM-DD-YY
  const m = s.match(/^(\d{2})-(\d{2})-(\d{2})$/)
  if (m) return `20${m[3]}-${m[1]}-${m[2]}`
  return ''
}

async function fetchSheet(tab: string): Promise<string[][]> {
  const res = await fetch(BASE + encodeURIComponent(tab), { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch sheet "${tab}": ${res.status}`)
  const text = await res.text()
  return parseCSV(text)
}

// ─── Sectors ─────────────────────────────────────────────────────────────────
async function fetchSectors(): Promise<Sector[]> {
  const rows = await fetchSheet('Sectors')
  if (rows.length < 2) return []
  // header: Sector ID, Sector, Status, Report Publish Date, LinkedIn Connect Start,
  //         LinkedIn Connect Due, TIP Create Date, TIP Send Date, Call Follow-up Start,
  //         MP, BD Owner, Senior Manager Reminder Owner, Market Research Owner, MR Support,
  //         Report Link, TIP Link, Source Data Link, Clay Export Link, Notes, Last Updated

  const STATUS_MAP: Record<string, SectorStatus> = {
    'completed':    'Completed',
    'planned':      'Planning',
    'planning':     'Planning',   // handle both casings from sheet
    'active':       'In Progress',
    'in progress':  'In Progress',
    'published': 'Published',
  }

  // Derive priority from existing seed data (sheet doesn't have a priority column)
  // We'll keep whatever is in localStorage for priority; default to 'Medium'
  return rows.slice(1).map(r => {
    const id     = (r[0]  ?? '').trim()
    const name   = (r[1]  ?? '').trim()
    const rawSt  = (r[2]  ?? '').trim().toLowerCase()
    const status = STATUS_MAP[rawSt] ?? 'Planning'
    const pub    = parseDate(r[3] ?? '')
    const mp     = (r[9]  ?? '').trim()
    const bd     = (r[10] ?? '').trim()
    const sm     = (r[11] ?? '').trim()
    const mr     = (r[12] ?? '').trim() || 'Srushti'
    const mrSup  = (r[13] ?? '').trim() || 'Sharvan'
    const rptLnk = (r[14] ?? '').trim()
    const tipLnk = (r[15] ?? '').trim()
    const dataLnk= (r[16] ?? '').trim()
    const notes  = (r[18] ?? '').trim()

    return {
      id, name, status, priority: 'Medium' as Priority,
      publishDate: pub, mp, bd, sm, mr, mrSupport: mrSup,
      reportLink: rptLnk, tipLink: tipLnk, dataLink: dataLnk,
      outreachStatus: pub ? 'In Progress' : 'Not Started',
      notes,
    }
  }).filter(s => s.id && s.name)
}

// ─── People ───────────────────────────────────────────────────────────────────
async function fetchPeople(): Promise<Person[]> {
  const rows = await fetchSheet('People')
  if (rows.length < 2) return []
  // header: Person ID, Name, Role Group, Primary Role in This App, Active, Notes
  const ROLE_MAP: Record<string, PersonRole> = {
    'mp':                         'MP',
    'senior manager':             'Senior Manager',
    'bd':                         'BD',
    'market research':            'Market Research',
    'market research support':    'Market Research Support',
  }
  return rows.slice(1).map(r => ({
    name:    (r[1] ?? '').trim(),
    role:    ROLE_MAP[(r[2] ?? '').trim().toLowerCase()] ?? 'BD',
    email:   `${(r[1] ?? '').trim().toLowerCase()}@stocadvisory.com`,
    sectors: '',
    notes:   (r[5] ?? '').trim(),
  })).filter(p => p.name)
}

// ─── Main sync entry point ────────────────────────────────────────────────────
export interface SyncResult {
  ok:       boolean
  sectors:  number
  people:   number
  error?:   string
  syncedAt: string
}

export async function syncFromGoogleSheet(
  currentData: AppData
): Promise<{ data: AppData; result: SyncResult }> {
  try {
    const [sectors, people] = await Promise.all([
      fetchSectors(),
      fetchPeople(),
    ])

    if (sectors.length === 0) {
      throw new Error('Sectors tab returned no rows — check sheet permissions.')
    }

    // Preserve priorities from existing seed data (sheet doesn't have a priority column)
    const merged = sectors.map(s => {
      const existing = currentData.sectors.find(e => e.id === s.id)
      return {
        ...s,
        priority:       existing?.priority       ?? s.priority,
        reportLink:     s.reportLink  || existing?.reportLink  || '',
        tipLink:        s.tipLink     || existing?.tipLink     || '',
        dataLink:       s.dataLink    || existing?.dataLink    || '',
        notes:          s.notes       || existing?.notes       || '',
        outreachStatus: existing?.outreachStatus ?? s.outreachStatus,
      }
    })

    // Calendar is derived from sectors automatically in store.ts (deriveCalendar).
    // Reminders are derived from sectors in seedData.ts (sectorToReminders).
    // Both will be recomputed on next app load from the updated sector dates.
    const nextData: AppData = {
      ...currentData,
      sectors: merged,
      people:  people.length > 0 ? people : currentData.people,
    }

    return {
      data: nextData,
      result: {
        ok:       true,
        sectors:  merged.length,
        people:   people.length,
        syncedAt: new Date().toISOString(),
      },
    }
  } catch (err) {
    return {
      data: currentData,
      result: {
        ok:       false,
        sectors:  0,
        people:   0,
        error:    err instanceof Error ? err.message : String(err),
        syncedAt: new Date().toISOString(),
      },
    }
  }
}

export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`
