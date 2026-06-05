'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AppData, Sector, Reminder, CalendarEvent, DataTipItem } from './types'
import { SEED_DATA } from './seedData'

const STORAGE_KEY = 'sectorRoadmapData'

function loadData(): AppData {
  if (typeof window === 'undefined') return structuredClone(SEED_DATA)
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AppData) : structuredClone(SEED_DATA)
  } catch {
    return structuredClone(SEED_DATA)
  }
}

function persistData(data: AppData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // storage full — ignore
  }
}

export function useStore() {
  const [data, setData] = useState<AppData>(SEED_DATA)

  useEffect(() => {
    setData(loadData())
  }, [])

  const save = useCallback((next: AppData) => {
    setData(next)
    persistData(next)
  }, [])

  // ── Sectors ──────────────────────────────────────────────────────────────
  const addSector = useCallback((s: Sector) => {
    save({ ...data, sectors: [...data.sectors, s] })
  }, [data, save])

  const updateSector = useCallback((updated: Sector) => {
    save({ ...data, sectors: data.sectors.map(s => s.id === updated.id ? updated : s) })
  }, [data, save])

  // ── Reminders ─────────────────────────────────────────────────────────────
  const addReminder = useCallback((r: Reminder) => {
    save({ ...data, reminders: [...data.reminders, r] })
  }, [data, save])

  const updateReminder = useCallback((updated: Reminder) => {
    save({ ...data, reminders: data.reminders.map(r => r.id === updated.id ? updated : r) })
  }, [data, save])

  const deleteReminder = useCallback((id: string) => {
    save({ ...data, reminders: data.reminders.filter(r => r.id !== id) })
  }, [data, save])

  // ── Calendar ──────────────────────────────────────────────────────────────
  const addCalendarEvent = useCallback((e: CalendarEvent) => {
    save({ ...data, calendar: [...data.calendar, e] })
  }, [data, save])

  // ── Data + TIP ────────────────────────────────────────────────────────────
  const updateDataTip = useCallback((updated: DataTipItem) => {
    save({ ...data, dataTip: data.dataTip.map(t => t.sector === updated.sector ? updated : t) })
  }, [data, save])

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetToSeed = useCallback(() => {
    const fresh = structuredClone(SEED_DATA)
    setData(fresh)
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

// Shared today reference so the whole app agrees on "now"
export const TODAY = new Date('2026-06-04')

export function daysFrom(dateStr: string): number | null {
  if (!dateStr) return null
  return Math.round((new Date(dateStr).getTime() - TODAY.getTime()) / 86_400_000)
}

export function fmtDate(dateStr: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
