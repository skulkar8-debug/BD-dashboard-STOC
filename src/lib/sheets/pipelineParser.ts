import { isValid, parseISO } from 'date-fns'

const EXCLUDED_STATUSES = [
  'Interested / Qualified',
  'Interested - Future Follow Up',
  'Submitted to Client: Future Follow Up',
  'Not Acquired (Exited Process)',
]

export type PipelineRow = {
  opportunity: string
  ownerName: string
  annualizedValue: number
  city: string
  state: string
  currentStatus: string
  statusUpdate: string | null
  daysInStatus: number | null
  lastContactOn: string | null
  lastCommSummary: string
  ndaRequested: string | null
  ndaReceived: string | null
  submitted: string | null
  loi: string | null
  nda: string | null
  qre: string | null
  fin: string | null
  calls: string | null
  emails: string | null
  texts: string | null
  notes: string
  lat?: number
  lng?: number
}

function parseDate(val: string | undefined): string | null {
  if (!val || val.trim() === '') return null
  const cleaned = val.trim()
  const iso = parseISO(cleaned)
  if (isValid(iso)) return cleaned
  const parts = cleaned.split('/')
  if (parts.length === 3) {
    const d = new Date(
      `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
    )
    if (isValid(d)) return d.toISOString().slice(0, 10)
  }
  return cleaned
}

function parseCurrency(val: string | undefined): number {
  if (!val) return 0
  return parseInt(val.replace(/[$,]/g, ''), 10) || 0
}

function parseDays(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null
  const n = parseInt(val.trim(), 10)
  return isNaN(n) ? null : n
}

export function parsePipelineRows(
  data: string[][],
  from?: Date,
  to?: Date
): PipelineRow[] {
  const rows: PipelineRow[] = []

  for (let i = 1; i < data.length; i++) {
    const r = data[i]
    const status = (r[5] || '').trim()
    if (EXCLUDED_STATUSES.includes(status)) continue
    if (!status) continue

    const statusUpdate = parseDate(r[6])

    if (from && to && statusUpdate) {
      const d = parseISO(statusUpdate)
      if (isValid(d) && (d < from || d > to)) continue
    }

    rows.push({
      opportunity: (r[0] || '').trim(),
      ownerName: (r[1] || '').trim(),
      annualizedValue: parseCurrency(r[2]),
      city: (r[3] || '').trim(),
      state: (r[4] || '').trim(),
      currentStatus: status,
      statusUpdate,
      daysInStatus: parseDays(r[7]),
      lastContactOn: parseDate(r[9]),
      lastCommSummary: (r[10] || '').trim(),
      ndaRequested: parseDate(r[11]),
      ndaReceived: parseDate(r[12]),
      submitted: parseDate(r[13]),
      loi: (r[14] || '').trim() || null,
      nda: (r[15] || '').trim() || null,
      qre: (r[16] || '').trim() || null,
      fin: (r[17] || '').trim() || null,
      calls: (r[18] || '').trim() || null,
      emails: (r[19] || '').trim() || null,
      texts: (r[20] || '').trim() || null,
      notes: (r[21] || '').trim(),
    })
  }

  return rows
}
