import type { DataReady, DataTipItem, TipStatus } from '../types'

export const DATA_TIP_TAB = 'Data + TIP Sync'

/** 0-based column indices matching the Google Sheet header row. */
export const DATA_TIP_COL = {
  syncId: 0,
  sectorId: 1,
  sector: 2,
  sourceDataLink: 3,
  clayExportLink: 4,
  dataStatus: 5,
  reportLink: 6,
  tipAppLink: 7,
  tipStatus: 8,
  tipCreateDate: 9,
  tipSendDate: 10,
  owner: 11,
  usedInReport: 12,
  usedInTip: 13,
  notes: 14,
  lastUpdated: 15,
} as const

/** App field → sheet column index (only fields that exist in the sheet). */
export const DATA_TIP_FIELD_TO_COL: Partial<Record<keyof DataTipItem, number>> = {
  sourceLink: DATA_TIP_COL.sourceDataLink,
  clayLink: DATA_TIP_COL.clayExportLink,
  dataReady: DATA_TIP_COL.dataStatus,
  tipLink: DATA_TIP_COL.tipAppLink,
  tipStatus: DATA_TIP_COL.tipStatus,
  tipCreated: DATA_TIP_COL.tipCreateDate,
  tipSent: DATA_TIP_COL.tipSendDate,
  inReport: DATA_TIP_COL.usedInReport,
  inTip: DATA_TIP_COL.usedInTip,
  notes: DATA_TIP_COL.notes,
}

const TIP_STATUSES = new Set<TipStatus>([
  'Not Started',
  'In Progress',
  'Created',
  'Sent',
])
const DATA_READY = new Set<DataReady>(['Yes', 'Partial', 'No'])

function parseDate(raw: string): string {
  if (!raw || raw.trim() === '') return ''
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{2})-(\d{2})-(\d{2})$/)
  if (m) return `20${m[3]}-${m[1]}-${m[2]}`
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) {
    return `${slash[3]}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`
  }
  return s
}

function parseBool(raw: string): boolean {
  const v = raw.trim().toUpperCase()
  return v === 'TRUE' || v === 'YES' || v === '1'
}

function parseTipStatus(raw: string): TipStatus {
  const s = raw.trim() as TipStatus
  return TIP_STATUSES.has(s) ? s : 'Not Started'
}

function parseDataReady(raw: string): DataReady {
  const s = raw.trim() as DataReady
  return DATA_READY.has(s) ? s : 'No'
}

export function parseDataTipRows(rows: string[][]): DataTipItem[] {
  if (rows.length < 2) return []

  return rows
    .slice(1)
    .map((r) => ({
      sector: (r[DATA_TIP_COL.sector] ?? '').trim(),
      sourceDataLocation: '',
      sourceLink: (r[DATA_TIP_COL.sourceDataLink] ?? '').trim(),
      clayLink: (r[DATA_TIP_COL.clayExportLink] ?? '').trim(),
      gsheetLink: '',
      tipLink: (r[DATA_TIP_COL.tipAppLink] ?? '').trim(),
      tipStatus: parseTipStatus(r[DATA_TIP_COL.tipStatus] ?? ''),
      tipCreated: parseDate(r[DATA_TIP_COL.tipCreateDate] ?? ''),
      tipSent: parseDate(r[DATA_TIP_COL.tipSendDate] ?? ''),
      dataReady: parseDataReady(r[DATA_TIP_COL.dataStatus] ?? ''),
      inReport: parseBool(r[DATA_TIP_COL.usedInReport] ?? ''),
      inTip: parseBool(r[DATA_TIP_COL.usedInTip] ?? ''),
      notes: (r[DATA_TIP_COL.notes] ?? '').trim(),
    }))
    .filter((item) => item.sector)
}

export function sheetValueForField(
  field: keyof DataTipItem,
  value: unknown
): string | boolean {
  if (field === 'inReport' || field === 'inTip') {
    return Boolean(value)
  }
  return String(value ?? '')
}

export function colIndexToA1(colIndex: number): string {
  let n = colIndex + 1
  let letters = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    letters = String.fromCharCode(65 + rem) + letters
    n = Math.floor((n - 1) / 26)
  }
  return letters
}

export function findSectorRowIndex(rows: string[][], sectorName: string): number {
  const target = sectorName.trim().toLowerCase()
  for (let i = 1; i < rows.length; i++) {
    const name = (rows[i][DATA_TIP_COL.sector] ?? '').trim().toLowerCase()
    if (name === target) return i
  }
  return -1
}
