'use client'

import { useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Sector } from '@/lib/types'

// ─── constants ────────────────────────────────────────────────────────────────
const DAY_W      = 46   // px per day column
const LABEL_W    = 156  // px for person label
const TOTAL_W    = 52   // px for task-count column
const LANE_H     = 22   // px per lane (stacked block height)
const LANE_GAP   = 2    // px between lanes
const ROW_PAD    = 6    // px top/bottom padding per row
const HEADER_H   = 52   // px for the day/month header
const DAYS_SHOWN = 35   // default visible days (~5 weeks)

// ─── event type definitions ───────────────────────────────────────────────────
const ETYPES = [
  { key: 'connect',   label: 'LinkedIn Outreach',  bg: '#bfdbfe', border: '#3b82f6', text: '#1e3a8a', sOff: -14, eOff: -1 },
  { key: 'publish',   label: 'Report Publish',      bg: '#bbf7d0', border: '#22c55e', text: '#14532d', sOff:  0,  eOff:  0 },
  { key: 'tipcreate', label: 'TIP Create',           bg: '#fed7aa', border: '#f97316', text: '#7c2d12', sOff:  1,  eOff:  1 },
  { key: 'tipsend',   label: 'TIP Send',             bg: '#e9d5ff', border: '#a855f7', text: '#4c1d95', sOff:  5,  eOff:  5 },
  { key: 'followup',  label: 'Follow-up / Intel',    bg: '#fef08a', border: '#eab308', text: '#713f12', sOff:  8,  eOff: 14 },
] as const

// which owner gets each event?
const OWNER_EVENTS: Record<string, (typeof ETYPES[number]['key'])[]> = {
  bd:  ['connect', 'tipsend', 'followup'],
  mr:  ['publish', 'tipcreate'],
  sm:  ['tipsend'],                         // SM: reminder only on TIP send day
}

// ─── types ────────────────────────────────────────────────────────────────────
interface Block {
  sectorId:  string
  sector:    string
  typeKey:   string
  label:     string
  bg:        string
  border:    string
  text:      string
  startDate: Date
  endDate:   Date
  lane:      number
}

interface PersonRow {
  name:    string
  role:    string
  blocks:  Block[]
  lanes:   number   // max lane count (determines row height)
  taskCount: number
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function utcDate(str: string): Date {
  return new Date(str + 'T00:00:00Z')
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + n)
  return r
}
function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}
function fmtDay(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).slice(0, 2)
}
function fmtNum(d: Date) {
  return d.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' })
}
function fmtMonthYear(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

// Greedy lane assignment: find first lane with no overlap
function assignLanes(blocks: Omit<Block, 'lane'>[]): Block[] {
  const lanes: Date[] = []   // tracks end date of last block per lane
  return blocks
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .map(b => {
      let lane = lanes.findIndex(end => b.startDate >= end)
      if (lane === -1) { lane = lanes.length; lanes.push(addDays(b.endDate, 1)) }
      else               lanes[lane] = addDays(b.endDate, 1)
      return { ...b, lane }
    })
}

// ─── component ────────────────────────────────────────────────────────────────
export function ResourceGrid({ sectors }: { sectors: Sector[] }) {
  const scheduled = useMemo(
    () => sectors.filter(s => !!s.publishDate),
    [sectors]
  )

  // viewport start date (scroll offset)
  const [viewStart, setViewStart] = useState<Date>(() => {
    if (scheduled.length === 0) return new Date('2026-06-01T00:00:00Z')
    // start 16 days before earliest publish
    const earliest = utcDate(
      scheduled.reduce((a, b) => a.publishDate < b.publishDate ? a : b).publishDate
    )
    return addDays(earliest, -16)
  })

  const today = new Date('2026-06-05T00:00:00Z')

  // ── build person rows ──────────────────────────────────────────────────────
  const personRows = useMemo<PersonRow[]>(() => {
    if (scheduled.length === 0) return []

    // Collect raw blocks per person
    const raw: Record<string, { role: string; blocks: Omit<Block, 'lane'>[] }> = {}

    const ensure = (name: string, role: string) => {
      if (!raw[name]) raw[name] = { role, blocks: [] }
    }

    scheduled.forEach(s => {
      const pub = utcDate(s.publishDate)
      ensure(s.bd,  'BD')
      ensure(s.mr,  'Market Research')
      ensure(s.sm,  'Senior Manager')

      ETYPES.forEach(et => {
        const start = addDays(pub, et.sOff)
        const end   = addDays(pub, et.eOff)

        // BD gets: connect, tipsend, followup
        if (OWNER_EVENTS.bd.includes(et.key) && s.bd) {
          raw[s.bd].blocks.push({ sectorId: s.id, sector: s.name, typeKey: et.key, label: et.label, bg: et.bg, border: et.border, text: et.text, startDate: start, endDate: end })
        }
        // MR gets: publish, tipcreate
        if (OWNER_EVENTS.mr.includes(et.key) && s.mr) {
          ensure(s.mr, 'Market Research')
          raw[s.mr].blocks.push({ sectorId: s.id, sector: s.name, typeKey: et.key, label: et.label, bg: et.bg, border: et.border, text: et.text, startDate: start, endDate: end })
        }
        // SM gets: tipsend (reminder only)
        if (et.key === 'tipsend' && s.sm) {
          ensure(s.sm, 'Senior Manager')
          raw[s.sm].blocks.push({ sectorId: s.id, sector: s.name, typeKey: et.key, label: `${et.label} reminder`, bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8', startDate: start, endDate: end })
        }
      })
    })

    // Role order for display
    const roleOrder = ['Market Research', 'BD', 'Senior Manager', 'MP', 'Market Research Support']

    return Object.entries(raw)
      .sort((a, b) => {
        const ri = (r: string) => roleOrder.indexOf(r) === -1 ? 99 : roleOrder.indexOf(r)
        return ri(a[1].role) - ri(b[1].role) || a[0].localeCompare(b[0])
      })
      .map(([name, { role, blocks }]) => {
        const laned = assignLanes(blocks)
        const maxLane = laned.reduce((m, b) => Math.max(m, b.lane), 0)
        return { name, role, blocks: laned, lanes: maxLane + 1, taskCount: blocks.length }
      })
  }, [scheduled])

  // ── total row height ───────────────────────────────────────────────────────
  const rowH = (lanes: number) => ROW_PAD * 2 + lanes * LANE_H + (lanes - 1) * LANE_GAP

  // ── day columns ────────────────────────────────────────────────────────────
  const days = useMemo(
    () => Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(viewStart, i)),
    [viewStart]
  )

  const viewEnd   = addDays(viewStart, DAYS_SHOWN - 1)
  const chartW    = DAYS_SHOWN * DAY_W
  const totalH    = HEADER_H + personRows.reduce((s, r) => s + rowH(r.lanes), 0)
  const todayOff  = daysBetween(viewStart, today)
  const todayX    = todayOff * DAY_W

  // Month spans in header
  const monthSpans = useMemo(() => {
    const spans: { label: string; x: number; w: number }[] = []
    days.forEach((d, i) => {
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`
      const last = spans[spans.length - 1]
      if (last && last.label === fmtMonthYear(d)) { last.w += DAY_W }
      else spans.push({ label: fmtMonthYear(d), x: i * DAY_W, w: DAY_W })
    })
    return spans
  }, [days])

  // Navigate
  const shiftWeek = (n: number) => setViewStart(d => addDays(d, n * 7))
  const jumpToday = () => setViewStart(addDays(today, -7))

  if (scheduled.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
        Add publish dates to sectors to see the resource grid.
      </div>
    )
  }

  return (
    <div className="w-full select-none">
      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap mb-4">
        {ETYPES.map(e => (
          <div key={e.key} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="inline-block w-3 h-3 rounded-sm border" style={{ background: e.bg, borderColor: e.border }} />
            {e.label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-gray-600 ml-auto">
          <span className="inline-block w-0.5 h-3 bg-red-400" />Today
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => shiftWeek(-1)} className="p-1 rounded hover:bg-gray-100 text-gray-500"><ChevronLeft className="size-4" /></button>
        <button onClick={() => shiftWeek(1)}  className="p-1 rounded hover:bg-gray-100 text-gray-500"><ChevronRight className="size-4" /></button>
        <button onClick={jumpToday} className="px-2.5 py-1 text-xs rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium">Today</button>
        <span className="text-xs text-gray-400 ml-1">
          {viewStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} – {viewEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
        </span>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden" style={{ display: 'flex' }}>

          {/* ── sticky person label column ─────────────────────────────── */}
          <div style={{ width: LABEL_W + TOTAL_W, minWidth: LABEL_W + TOTAL_W, position: 'sticky', left: 0, zIndex: 20 }} className="shrink-0 border-r border-gray-200 bg-white">
            {/* header row */}
            <div style={{ height: HEADER_H }} className="flex items-end border-b border-gray-200 px-3 pb-2 bg-gray-50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Person</span>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-gray-400">Tasks</span>
            </div>
            {/* person rows */}
            {personRows.map(row => (
              <div
                key={row.name}
                style={{ height: rowH(row.lanes) }}
                className="flex items-center px-3 border-b border-gray-100"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate">{row.name}</div>
                  <div className="text-[10px] text-gray-400 truncate">{row.role}</div>
                </div>
                <div className="ml-2 text-sm font-bold text-indigo-600">{row.taskCount}</div>
              </div>
            ))}
            {/* totals */}
            <div style={{ height: 36 }} className="flex items-center px-3 bg-gray-50 border-t border-gray-200">
              <span className="text-xs font-bold text-gray-600">Total</span>
              <span className="ml-auto text-sm font-bold text-gray-700">
                {personRows.reduce((s, r) => s + r.taskCount, 0)}
              </span>
            </div>
          </div>

          {/* ── scrollable chart area ──────────────────────────────────── */}
          <div style={{ flex: 1, overflowX: 'auto', position: 'relative' }}>
            <svg
              width={chartW}
              height={totalH + 36}
              style={{ display: 'block', overflow: 'visible' }}
            >
              {/* Month header band */}
              <rect x={0} y={0} width={chartW} height={24} fill="#f9fafb" />
              {monthSpans.map((m, i) => (
                <g key={i}>
                  <text x={m.x + 6} y={16} fontSize={10} fontWeight="700" fill="#6b7280">{m.label}</text>
                  {i > 0 && <line x1={m.x} y1={0} x2={m.x} y2={24} stroke="#e5e7eb" />}
                </g>
              ))}

              {/* Day header row */}
              <rect x={0} y={24} width={chartW} height={HEADER_H - 24} fill="#f9fafb" />
              {days.map((d, i) => {
                const isToday = i === todayOff
                const isSun = d.getUTCDay() === 0
                const isSat = d.getUTCDay() === 6
                return (
                  <g key={i}>
                    <rect
                      x={i * DAY_W} y={24}
                      width={DAY_W} height={HEADER_H - 24}
                      fill={isToday ? '#eef2ff' : isSat || isSun ? '#f9fafb' : 'transparent'}
                    />
                    <text
                      x={i * DAY_W + DAY_W / 2} y={36}
                      fontSize={9} fill={isSat || isSun ? '#d1d5db' : '#9ca3af'}
                      textAnchor="middle" fontWeight="600"
                    >
                      {fmtDay(d)}
                    </text>
                    <text
                      x={i * DAY_W + DAY_W / 2} y={49}
                      fontSize={11}
                      fill={isToday ? '#4f46e5' : isSat || isSun ? '#d1d5db' : '#374151'}
                      textAnchor="middle" fontWeight={isToday ? '800' : '500'}
                    >
                      {fmtNum(d)}
                    </text>
                    <line x1={i * DAY_W} y1={24} x2={i * DAY_W} y2={HEADER_H} stroke="#f3f4f6" />
                  </g>
                )
              })}
              <line x1={0} y1={HEADER_H} x2={chartW} y2={HEADER_H} stroke="#e5e7eb" />

              {/* Person rows */}
              {(() => {
                let yOff = HEADER_H
                return personRows.map(row => {
                  const rh = rowH(row.lanes)
                  const rowEl = (
                    <g key={row.name}>
                      {/* Row background */}
                      <rect x={0} y={yOff} width={chartW} height={rh} fill="transparent" />
                      {/* Day vertical lines + weekend shading */}
                      {days.map((d, i) => {
                        const isSun = d.getUTCDay() === 0
                        const isSat = d.getUTCDay() === 6
                        return (
                          <g key={i}>
                            {(isSat || isSun) && (
                              <rect x={i * DAY_W} y={yOff} width={DAY_W} height={rh} fill="#f9fafb" />
                            )}
                            <line x1={i * DAY_W} y1={yOff} x2={i * DAY_W} y2={yOff + rh} stroke="#f3f4f6" />
                          </g>
                        )
                      })}
                      {/* Today column highlight */}
                      {todayOff >= 0 && todayOff < DAYS_SHOWN && (
                        <rect x={todayOff * DAY_W} y={yOff} width={DAY_W} height={rh} fill="#eef2ff" opacity={0.5} />
                      )}
                      {/* Blocks */}
                      {row.blocks.map((b, bi) => {
                        const blockStart = daysBetween(viewStart, b.startDate)
                        const blockEnd   = daysBetween(viewStart, b.endDate)
                        // Clip to visible range
                        const clippedStart = Math.max(0, blockStart)
                        const clippedEnd   = Math.min(DAYS_SHOWN - 1, blockEnd)
                        if (clippedStart > clippedEnd) return null

                        const bx  = clippedStart * DAY_W + 2
                        const bw  = Math.max((clippedEnd - clippedStart + 1) * DAY_W - 4, 8)
                        const by  = yOff + ROW_PAD + b.lane * (LANE_H + LANE_GAP)
                        const bh  = LANE_H
                        const truncated = blockStart < 0 || blockEnd >= DAYS_SHOWN

                        return (
                          <g key={bi}>
                            <rect
                              x={bx} y={by} width={bw} height={bh}
                              rx={3}
                              fill={b.bg}
                              stroke={b.border} strokeWidth={1}
                              opacity={0.9}
                            />
                            {/* left notch if clipped */}
                            {blockStart < 0 && (
                              <polygon points={`${bx},${by} ${bx + 6},${by + bh / 2} ${bx},${by + bh}`} fill={b.border} opacity={0.7} />
                            )}
                            {/* right notch if clipped */}
                            {blockEnd >= DAYS_SHOWN && (
                              <polygon points={`${bx + bw},${by} ${bx + bw - 6},${by + bh / 2} ${bx + bw},${by + bh}`} fill={b.border} opacity={0.7} />
                            )}
                            {bw > 20 && (
                              <text
                                x={bx + (truncated ? 10 : 5)} y={by + bh / 2 + 4}
                                fontSize={9} fill={b.text} fontWeight="600"
                                style={{ pointerEvents: 'none', userSelect: 'none' }}
                              >
                                {bw > 80
                                  ? `${b.sector} · ${b.label}`
                                  : bw > 40 ? b.sector : b.sector.slice(0, 4) + '…'
                                }
                              </text>
                            )}
                            <title>{`${b.sector}: ${b.label}\n${b.startDate.toISOString().split('T')[0]} → ${b.endDate.toISOString().split('T')[0]}`}</title>
                          </g>
                        )
                      })}
                      {/* Row bottom border */}
                      <line x1={0} y1={yOff + rh} x2={chartW} y2={yOff + rh} stroke="#f3f4f6" />
                    </g>
                  )
                  yOff += rh
                  return rowEl
                })
              })()}

              {/* Today line */}
              {todayOff >= 0 && todayOff < DAYS_SHOWN && (
                <line
                  x1={todayOff * DAY_W + DAY_W / 2} y1={0}
                  x2={todayOff * DAY_W + DAY_W / 2} y2={totalH}
                  stroke="#f87171" strokeWidth={1.5} strokeDasharray="4,3"
                />
              )}

              {/* Totals row */}
              <rect x={0} y={totalH} width={chartW} height={36} fill="#f9fafb" />
              <line x1={0} y1={totalH} x2={chartW} y2={totalH} stroke="#e5e7eb" />
              {days.map((d, i) => {
                const dayTasks = personRows.reduce((cnt, row) =>
                  cnt + row.blocks.filter(b =>
                    b.startDate <= d && d <= b.endDate
                  ).length, 0)
                return dayTasks > 0 ? (
                  <text key={i} x={i * DAY_W + DAY_W / 2} y={totalH + 22}
                    fontSize={10} fill="#6b7280" textAnchor="middle" fontWeight="600"
                  >
                    {dayTasks}
                  </text>
                ) : null
              })}
            </svg>
          </div>
      </div>
    </div>
  )
}
