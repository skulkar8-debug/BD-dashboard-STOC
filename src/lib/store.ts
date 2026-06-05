'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { AppData, Sector, Reminder, CalendarEvent, DataTipItem } from './types'
import { SEED_DATA } from './seedData'
import { WORKFLOW_EVENTS, type OwnerRole } from './workflowEvents'

const STORAGE_KEY = 'sectorRoadmapData'

// ─── Calendar derivation (always fresh — never stale from localStorage) ───────
function addDaysISO(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

export function deriveCalendar(sectors: Sector[]): CalendarEvent[] {
  return sectors
    .filter(s => !!s.publishDate)
    .flatMap(s => {
      const ownerMap: Record<OwnerRole, string> = {
        mr: s.mr, mrsupport: s.mrSupport, bd: s.bd, sm: s.sm, mp: s.mp,
      }
      return WORKFLOW_EVENTS.map(ev => ({
        id:     `EVT-${s.id}-${ev.key.toUpperCase()}`,
        date:   addDaysISO(s.publishDate, ev.sOff),
        type:   ev.label,               // always the current canonical label
        sector: s.name,
        owner:  ownerMap[ev.owners[0]] ?? '',
        notes:  `${ev.label} · ${ev.wfSteps} · ${ev.phase}`,
      }))
    })
}

// ─── Persistence ──────────────────────────────────────────────────────────────
function loadData(): Omit<AppData, 'calendar'> {
  if (typeof window === 'undefined') return structuredClone(SEED_DATA)
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(SEED_DATA)
    const parsed = JSON.parse(raw) as AppData
    // Strip stale calendar — we derive it fresh every time
    const { calendar: _dropped, ...rest } = parsed
    return rest
  } catch {
    return structuredClone(SEED_DATA)
  }
}

function persistData(data: Omit<AppData, 'calendar'>) {
  try {
    // Never persist calendar — it's derived
    const { calendar: _dropped, ...rest } = data as AppData
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
  } catch { /* storage full */ }
}

// ─── Store hook ───────────────────────────────────────────────────────────────
export function useStore() {
  const [base, setBase] = useState<Omit<AppData, 'calendar'>>(SEED_DATA)

  useEffect(() => { setBase(loadData()) }, [])

  // Calendar is ALWAYS derived from current sectors — never from storage
  const calendar = useMemo(() => deriveCalendar(base.sectors), [base.sectors])

  const data: AppData = useMemo(() => ({ ...base, calendar }), [base, calendar])

  const save = useCallback((next: Omit<AppData, 'calendar'>) => {
    setBase(next)
    persistData(next)
  }, [])

  // ── Sectors ──────────────────────────────────────────────────────────────
  const addSector    = useCallback((s: Sector)   => save({ ...base, sectors: [...base.sectors, s] }), [base, save])
  const updateSector = useCallback((u: Sector)   => save({ ...base, sectors: base.sectors.map(s => s.id === u.id ? u : s) }), [base, save])

  // ── Reminders ─────────────────────────────────────────────────────────────
  const addReminder    = useCallback((r: Reminder) => save({ ...base, reminders: [...base.reminders, r] }), [base, save])
  const updateReminder = useCallback((u: Reminder) => save({ ...base, reminders: base.reminders.map(r => r.id === u.id ? u : r) }), [base, save])
  const deleteReminder = useCallback((id: string)  => save({ ...base, reminders: base.reminders.filter(r => r.id !== id) }), [base, save])

  // ── Calendar event (manual add — rare) ────────────────────────────────────
  const addCalendarEvent = useCallback((_e: CalendarEvent) => {
    // Manual calendar events are not persisted in this prototype — calendar is derived
  }, [])

  // ── Data + TIP ────────────────────────────────────────────────────────────
  const updateDataTip = useCallback((u: DataTipItem) => save({ ...base, dataTip: base.dataTip.map(t => t.sector === u.sector ? u : t) }), [base, save])

  // ── Reset / Export ─────────────────────────────────────────────────────────
  const resetToSeed = useCallback(() => {
    const fresh = structuredClone(SEED_DATA)
    setBase(fresh)
    persistData(fresh)
  }, [])

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'sector-roadmap-export.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }, [data])

  return {
    data,
    addSector, updateSector,
    addReminder, updateReminder, deleteReminder,
    addCalendarEvent,
    updateDataTip,
    resetToSeed, exportJson,
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────
export const TODAY = new Date('2026-06-05')

export function daysFrom(dateStr: string): number | null {
  if (!dateStr) return null
  return Math.round((new Date(dateStr).getTime() - TODAY.getTime()) / 86_400_000)
}

export function fmtDate(dateStr: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
