'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Sector } from '@/lib/types'
import { WORKFLOW_EVENTS } from '@/lib/workflowEvents'

// ─── layout constants ─────────────────────────────────────────────────────────
const DAY_W      = 38
const LABEL_W    = 200
const LANE_H     = 13
const LANE_GAP   = 1
const ROW_H      = 56    // fixed uniform height for every sector row
const MAX_LANES  = 3
const HEADER_H   = 52
const DAYS_SHOWN = 56   // 8 weeks

// ─── helpers ──────────────────────────────────────────────────────────────────
function utcDate(s: string) { return new Date(s + 'T00:00:00Z') }
function addDays(d: Date, n: number) { const r = new Date(d); r.setUTCDate(r.getUTCDate() + n); return r }
function daysBetween(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86_400_000) }
function fmtDay(d: Date) { return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).slice(0, 2) }
function fmtNum(d: Date) { return d.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' }) }

const STATUS_DOT: Record<string, string> = {
  Planning:      '#9ca3af',
  'In Progress': '#60a5fa',
  Published:     '#34d399',
  Completed:     '#a78bfa',
}

export function SectorGrid({ sectors }: { sectors: Sector[] }) {
  const scheduled = useMemo(
    () => [...sectors.filter(s => !!s.publishDate)].sort((a, b) => a.publishDate.localeCompare(b.publishDate)),
    [sectors]
  )
  const [showAll, setShowAll]   = useState(false)
  const [viewStart, setViewStart] = useState<Date>(() => {
    if (!scheduled.length) return new Date('2026-05-01T00:00:00Z')
    return addDays(utcDate(scheduled[0].publishDate), -38)
  })

  const today   = new Date('2026-06-05T00:00:00Z')
  const viewEnd = addDays(viewStart, DAYS_SHOWN - 1)
  const display = showAll ? sectors : scheduled
  const chartW  = DAYS_SHOWN * DAY_W
  const todayOff = daysBetween(viewStart, today)

  const days = useMemo(
    () => Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(viewStart, i)),
    [viewStart]
  )

  const monthSpans = useMemo(() => {
    const spans: { label: string; x: number; w: number }[] = []
    days.forEach((d, i) => {
      const lbl = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
      const last = spans[spans.length - 1]
      if (last?.label === lbl) last.w += DAY_W
      else spans.push({ label: lbl, x: i * DAY_W, w: DAY_W })
    })
    return spans
  }, [days])

  // For each sector: compute all blocks and assign lanes
  const sectorRows = useMemo(() => display.map(s => {
    if (!s.publishDate) return { sector: s, blocks: [], lanes: 1 }
    const pub = utcDate(s.publishDate)

    // Get owner name per role
    const ownerMap: Record<string, string> = {
      mr: s.mr, mrsupport: s.mrSupport, bd: s.bd, sm: s.sm, mp: s.mp,
    }

    const rawBlocks = WORKFLOW_EVENTS.map(ev => ({
      key:    ev.key,
      label:  ev.label,
      bg:     ev.bg,
      border: ev.border,
      text:   ev.text,
      start:  addDays(pub, ev.sOff),
      end:    addDays(pub, ev.eOff),
      owner:  ev.owners.map(r => ownerMap[r]).filter(Boolean).join(', '),
      phase:  ev.phase,
      wfSteps: ev.wfSteps,
    }))

    // Lane assignment (greedy)
    const laneEnds: Date[] = []
    const blocks = rawBlocks.map(b => {
      let lane = laneEnds.findIndex(e => b.start >= e)
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(addDays(b.end, 1)) }
      else laneEnds[lane] = addDays(b.end, 1)
      return { ...b, lane }
    })

    return { sector: s, blocks, lanes: Math.max(1, blocks.reduce((m, b) => Math.max(m, b.lane), 0) + 1) }
  }), [display])

  const totalH = HEADER_H + sectorRows.length * ROW_H

  return (
    <div className="w-full select-none">
      {/* Legend — grouped by phase */}
      <div className="flex items-start gap-x-5 gap-y-2 flex-wrap mb-4">
        {WORKFLOW_EVENTS.map(ev => (
          <div key={ev.key} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="inline-block w-3 h-3 rounded-sm border flex-shrink-0" style={{ background: ev.bg, borderColor: ev.border }} />
            <span className="whitespace-nowrap">{ev.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <span className="inline-block w-0.5 h-3 bg-red-400 flex-shrink-0" />Today
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button onClick={() => setViewStart(d => addDays(d, -7))} className="p-1 rounded hover:bg-gray-100 text-gray-500"><ChevronLeft className="size-4" /></button>
        <button onClick={() => setViewStart(d => addDays(d,  7))} className="p-1 rounded hover:bg-gray-100 text-gray-500"><ChevronRight className="size-4" /></button>
        <button onClick={() => setViewStart(addDays(today, -14))} className="px-2.5 py-1 text-xs rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium">Today</button>
        <span className="text-xs text-gray-400">
          {viewStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} –{' '}
          {viewEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
        </span>
        <div className="ml-auto flex items-center gap-1 text-xs">
          <button onClick={() => setShowAll(false)} className={`px-2.5 py-1 rounded-md font-medium ${!showAll ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            Scheduled ({scheduled.length})
          </button>
          <button onClick={() => setShowAll(true)} className={`px-2.5 py-1 rounded-md font-medium ${showAll ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            All ({sectors.length})
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden" style={{ display: 'flex' }}>

        {/* Sticky label column */}
        <div style={{ width: LABEL_W, minWidth: LABEL_W, position: 'sticky', left: 0, zIndex: 20 }}
          className="shrink-0 border-r border-gray-200 bg-white">
          <div style={{ height: HEADER_H }} className="bg-gray-50 border-b border-gray-200 flex items-end px-3 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Sector</span>
          </div>
          {sectorRows.map(({ sector: s, lanes }) => (
            <div key={s.id} style={{ height: ROW_H }}
              className="flex flex-col justify-center px-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              onClick={() => window.location.href = `/roadmap/sectors/${s.id}`}>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_DOT[s.status] ?? '#d1d5db' }} />
                <span className="text-[12px] font-semibold text-gray-800 truncate leading-tight">{s.name}</span>
              </div>
              <div className="text-[10px] text-gray-400 pl-3.5 mt-0.5">
                {s.publishDate
                  ? utcDate(s.publishDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
                  : <span className="italic">no date set</span>}
              </div>
            </div>
          ))}
          <div style={{ height: 36 }} className="flex items-center px-3 bg-gray-50 border-t border-gray-200">
            <span className="text-xs font-bold text-gray-600">{display.length} sectors</span>
          </div>
        </div>

        {/* Scrollable chart */}
        <div style={{ flex: 1, overflowX: 'auto' }}>
          <svg width={chartW} height={totalH + 36} style={{ display: 'block', minWidth: chartW }}>
            {/* Month band */}
            <rect x={0} y={0} width={chartW} height={24} fill="#f9fafb" />
            {monthSpans.map((m, i) => (
              <g key={i}>
                <text x={m.x + 4} y={16} fontSize={10} fontWeight="700" fill="#6b7280">{m.label}</text>
                {i > 0 && <line x1={m.x} y1={0} x2={m.x} y2={24} stroke="#e5e7eb" />}
              </g>
            ))}

            {/* Day headers */}
            <rect x={0} y={24} width={chartW} height={HEADER_H - 24} fill="#f9fafb" />
            {days.map((d, i) => {
              const isToday = i === todayOff
              const isSun = d.getUTCDay() === 0; const isSat = d.getUTCDay() === 6
              return (
                <g key={i}>
                  <rect x={i * DAY_W} y={24} width={DAY_W} height={HEADER_H - 24}
                    fill={isToday ? '#eef2ff' : isSat || isSun ? '#f9fafb' : 'transparent'} />
                  <text x={i * DAY_W + DAY_W / 2} y={36} fontSize={8} fill={isSat || isSun ? '#d1d5db' : '#9ca3af'} textAnchor="middle" fontWeight="600">{fmtDay(d)}</text>
                  <text x={i * DAY_W + DAY_W / 2} y={49} fontSize={10}
                    fill={isToday ? '#4f46e5' : isSat || isSun ? '#d1d5db' : '#374151'}
                    textAnchor="middle" fontWeight={isToday ? '800' : '400'}>{fmtNum(d)}</text>
                  <line x1={i * DAY_W} y1={24} x2={i * DAY_W} y2={HEADER_H} stroke="#f3f4f6" />
                </g>
              )
            })}
            <line x1={0} y1={HEADER_H} x2={chartW} y2={HEADER_H} stroke="#e5e7eb" />

            {/* Rows — fixed uniform height */}
            {(() => {
              let yOff = HEADER_H
              return sectorRows.map(({ sector: s, blocks }) => {
                const el = (
                  <g key={s.id}>
                    {days.map((d, i) => {
                      const isSat = d.getUTCDay() === 6; const isSun = d.getUTCDay() === 0
                      return (
                        <g key={i}>
                          {(isSat || isSun) && <rect x={i * DAY_W} y={yOff} width={DAY_W} height={ROW_H} fill="#fafafa" />}
                          <line x1={i * DAY_W} y1={yOff} x2={i * DAY_W} y2={yOff + ROW_H} stroke="#f3f4f6" />
                        </g>
                      )
                    })}
                    {todayOff >= 0 && todayOff < DAYS_SHOWN && (
                      <rect x={todayOff * DAY_W} y={yOff} width={DAY_W} height={ROW_H} fill="#eef2ff" opacity={0.4} />
                    )}
                    {!s.publishDate && (
                      <text x={8} y={yOff + ROW_H / 2 + 4} fontSize={10} fill="#d1d5db" fontStyle="italic">no publish date</text>
                    )}
                    {blocks.filter(b => b.lane < MAX_LANES).map((b, bi) => {
                      const bs = daysBetween(viewStart, b.start)
                      const be = daysBetween(viewStart, b.end)
                      const cs = Math.max(0, bs); const ce = Math.min(DAYS_SHOWN - 1, be)
                      if (cs > ce) return null
                      const bx = cs * DAY_W + 1; const bw = Math.max((ce - cs + 1) * DAY_W - 2, 4)
                      const by = yOff + 3 + b.lane * (LANE_H + LANE_GAP)
                      return (
                        <g key={bi}>
                          <rect x={bx} y={by} width={bw} height={LANE_H} rx={2} fill={b.bg} stroke={b.border} strokeWidth={1} opacity={0.92} />
                          {bs < 0 && <polygon points={`${bx},${by} ${bx+5},${by+LANE_H/2} ${bx},${by+LANE_H}`} fill={b.border} opacity={0.6} />}
                          {be >= DAYS_SHOWN && <polygon points={`${bx+bw},${by} ${bx+bw-5},${by+LANE_H/2} ${bx+bw},${by+LANE_H}`} fill={b.border} opacity={0.6} />}
                          {bw > 20 && (
                            <text x={bx + (bs < 0 ? 8 : 3)} y={by + LANE_H / 2 + 3.5} fontSize={7.5} fill={b.text} fontWeight="600"
                              style={{ pointerEvents: 'none', userSelect: 'none' }}>
                              {bw > 80 ? b.label : bw > 35 ? b.label.split(' ')[0] : ''}
                            </text>
                          )}
                          <title>{`${s.name} — ${b.label} (${b.wfSteps})\n${b.start.toISOString().split('T')[0]} → ${b.end.toISOString().split('T')[0]}\nOwner: ${b.owner}`}</title>
                        </g>
                      )
                    })}
                    <line x1={0} y1={yOff + ROW_H} x2={chartW} y2={yOff + ROW_H} stroke="#f3f4f6" />
                  </g>
                )
                yOff += ROW_H
                return el
              })
            })()}

            {/* Today line */}
            {todayOff >= 0 && todayOff < DAYS_SHOWN && (
              <line x1={todayOff * DAY_W + DAY_W / 2} y1={0} x2={todayOff * DAY_W + DAY_W / 2} y2={totalH}
                stroke="#f87171" strokeWidth={1.5} strokeDasharray="4,3" />
            )}

            {/* Footer */}
            <rect x={0} y={totalH} width={chartW} height={36} fill="#f9fafb" />
            <line x1={0} y1={totalH} x2={chartW} y2={totalH} stroke="#e5e7eb" />
          </svg>
        </div>
      </div>
    </div>
  )
}
