import type { Person, PersonRole, Priority, Sector, SectorStatus } from '../types'

function parseDate(raw: string): string {
  if (!raw || raw.trim() === '') return ''
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{2})-(\d{2})-(\d{2})$/)
  if (m) return `20${m[3]}-${m[1]}-${m[2]}`
  return ''
}

const STATUS_MAP: Record<string, SectorStatus> = {
  completed: 'Completed',
  planned: 'Planning',
  planning: 'Planning',
  active: 'In Progress',
  'in progress': 'In Progress',
  published: 'Published',
}

const ROLE_MAP: Record<string, PersonRole> = {
  mp: 'MP',
  'senior manager': 'Senior Manager',
  bd: 'BD',
  'market research': 'Market Research',
  'market research support': 'Market Research Support',
}

export function parseSectorsFromRows(rows: string[][]): Sector[] {
  if (rows.length < 2) return []

  return rows
    .slice(1)
    .map((r) => {
      const id = (r[0] ?? '').trim()
      const name = (r[1] ?? '').trim()
      const rawSt = (r[2] ?? '').trim().toLowerCase()
      const status = STATUS_MAP[rawSt] ?? 'Planning'
      const pub = parseDate(r[3] ?? '')
      const mp = (r[9] ?? '').trim()
      const bd = (r[10] ?? '').trim()
      const sm = (r[11] ?? '').trim()
      const mr = (r[12] ?? '').trim() || 'Srushti'
      const mrSup = (r[13] ?? '').trim() || 'Sharvan'
      const rptLnk = (r[14] ?? '').trim()
      const tipLnk = (r[15] ?? '').trim()
      const dataLnk = (r[16] ?? '').trim()
      const notes = (r[18] ?? '').trim()

      return {
        id,
        name,
        status,
        priority: 'Medium' as Priority,
        publishDate: pub,
        mp,
        bd,
        sm,
        mr,
        mrSupport: mrSup,
        reportLink: rptLnk,
        tipLink: tipLnk,
        dataLink: dataLnk,
        outreachStatus: pub ? 'In Progress' : 'Not Started',
        notes,
      }
    })
    .filter((s) => s.id && s.name)
}

export function parsePeopleFromRows(rows: string[][]): Person[] {
  if (rows.length < 2) return []

  return rows
    .slice(1)
    .map((r) => ({
      name: (r[1] ?? '').trim(),
      role: ROLE_MAP[(r[2] ?? '').trim().toLowerCase()] ?? 'BD',
      email: `${(r[1] ?? '').trim().toLowerCase()}@stocadvisory.com`,
      sectors: '',
      notes: (r[5] ?? '').trim(),
    }))
    .filter((p) => p.name)
}
