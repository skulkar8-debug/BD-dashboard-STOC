'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CalendarEvent, Sector } from '@/lib/types'
import { WORKFLOW_EVENTS } from '@/lib/workflowEvents'

interface Props {
  events: CalendarEvent[]
  sectors: Sector[]
  onSectorClick?: (id: string) => void
}

// Build color maps dynamically from WORKFLOW_EVENTS
function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgb(${r},${g},${b})`
}

const EVENT_BG:     Record<string, string> = {}
const EVENT_BORDER: Record<string, string> = {}
const EVENT_TEXT:   Record<string, string> = {}

WORKFLOW_EVENTS.forEach(ev => {
  EVENT_BG[ev.label]     = ev.bg
  EVENT_BORDER[ev.label] = ev.border
  EVENT_TEXT[ev.label]   = ev.text
})

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarMonthView({ events, sectors, onSectorClick }: Props) {
  const today = new Date('2026-06-05T00:00:00Z')
  const [current, setCurrent] = useState(() => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const year  = current.getUTCFullYear()
  const month = current.getUTCMonth()

  const firstDayOfMonth = new Date(Date.UTC(year, month, 1))
  const lastDayOfMonth  = new Date(Date.UTC(year, month + 1, 0))
  const startOffset     = firstDayOfMonth.getUTCDay()
  const daysInMonth     = lastDayOfMonth.getUTCDate()

  // Build grid: 6 rows × 7 cols
  const gridCells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (gridCells.length % 7 !== 0) gridCells.push(null)

  // Events indexed by YYYY-MM-DD
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    events.forEach(e => {
      if (!e.date) return
      map[e.date] = map[e.date] ? [...map[e.date], e] : [e]
    })
    return map
  }, [events])

  const fmt = (day: number) => {
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    return `${year}-${mm}-${dd}`
  }

  const todayKey = today.toISOString().split('T')[0]

  const selectedEvents = selectedDay ? (eventsByDate[selectedDay] ?? []) : []

  const monthLabel = current.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrent(new Date(Date.UTC(year, month - 1, 1)))}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-800"
        >
          <ChevronLeft className="size-4" />
        </button>
        <h2 className="text-base font-semibold text-gray-800">{monthLabel}</h2>
        <button
          onClick={() => setCurrent(new Date(Date.UTC(year, month + 1, 1)))}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-800"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 border-l border-t border-gray-200">
        {gridCells.map((day, i) => {
          const key  = day ? fmt(day) : null
          const evts = key ? (eventsByDate[key] ?? []) : []
          const isToday   = key === todayKey
          const isSelected = key === selectedDay
          const hasEvents = evts.length > 0

          return (
            <div
              key={i}
              onClick={() => day && setSelectedDay(isSelected ? null : key)}
              className={`border-r border-b border-gray-200 min-h-[72px] p-1.5 transition-colors ${day ? 'cursor-pointer' : 'bg-gray-50'} ${isSelected ? 'bg-indigo-50 border-indigo-200' : day ? 'hover:bg-gray-50' : ''}`}
            >
              {day && (
                <>
                  <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-gray-700'}`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {evts.slice(0, 3).map((e, j) => {
                      const bg     = EVENT_BG[e.type]     ?? '#f3f4f6'
                      const border = EVENT_BORDER[e.type] ?? '#d1d5db'
                      const color  = EVENT_TEXT[e.type]   ?? '#374151'
                      return (
                        <div key={j}
                          className="flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-medium border truncate"
                          style={{ background: bg, borderColor: border, color }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: border }} />
                          <span className="truncate">{e.sector}</span>
                        </div>
                      )
                    })}
                    {evts.length > 3 && (
                      <div className="text-[9px] text-gray-400 pl-1">+{evts.length - 3} more</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Selected day detail panel */}
      {selectedDay && selectedEvents.length > 0 && (
        <div className="mt-4 bg-white border border-indigo-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-gray-800">
              {new Date(selectedDay + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
            </div>
            <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕ close</button>
          </div>
          <div className="space-y-2">
            {selectedEvents.map((e, i) => {
              const sec    = sectors.find(s => s.name === e.sector)
              const bg     = EVENT_BG[e.type]     ?? '#f9fafb'
              const border = EVENT_BORDER[e.type] ?? '#e5e7eb'
              const color  = EVENT_TEXT[e.type]   ?? '#374151'
              return (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg border"
                  style={{ background: bg, borderColor: border }}>
                  <span className="mt-0.5 w-2 h-2 rounded-full shrink-0" style={{ background: border }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold" style={{ color }}>{e.type}</span>
                      {sec && (
                        <button onClick={() => onSectorClick?.(sec.id)}
                          className="text-[10px] text-indigo-600 hover:underline font-medium">
                          {e.sector} →
                        </button>
                      )}
                    </div>
                    <div className="text-[11px] mt-0.5 text-gray-500">{e.notes}</div>
                    <div className="text-[10px] mt-0.5 text-gray-400">Owner: {e.owner}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {selectedDay && selectedEvents.length === 0 && (
        <div className="mt-4 text-sm text-gray-400 text-center py-4">No events on this day.</div>
      )}
    </div>
  )
}
