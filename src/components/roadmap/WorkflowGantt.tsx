'use client'

import { useMemo, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react'
import type { Sector } from '@/lib/types'
import { WORKFLOW_EVENTS } from '@/lib/workflowEvents'

// ─── layout ───────────────────────────────────────────────────────────────────
const LABEL_W       = 200
const DAY_W         = 38
const HEADER_H      = 48
const DAYS_SHOWN    = 56

// Collapsed: one row showing mini bars (5px tall)
const MINI_H        = 5
const MINI_GAP      = 2
const MINI_PAD      = 6
const MINI_LANES    = 5
const ROW_COLLAPSED = MINI_PAD * 2 + MINI_LANES * MINI_H + (MINI_LANES - 1) * MINI_GAP  // ≈ 46px

// Expanded: full-size bars with labels (15px tall)
const FULL_H        = 15
const FULL_GAP      = 3
const FULL_PAD      = 6
const FULL_LANES    = 5
const ROW_EXPANDED  = FULL_PAD * 2 + FULL_LANES * FULL_H + (FULL_LANES - 1) * FULL_GAP  // ≈ 99px

const PHASE_BAR: Record<string, { fill: string; stroke: string; text: string }> = {
  'Research/Data': { fill: '#ddd6fe', stroke: '#7c3aed', text: '#4c1d95' },
  'Report':        { fill: '#bbf7d0', stroke: '#16a34a', text: '#14532d' },
  'Outreach':      { fill: '#bfdbfe', stroke: '#2563eb', text: '#1e3a8a' },
  'TIP':           { fill: '#fed7aa', stroke: '#ea580c', text: '#7c2d12' },
  'Calls/Intel':   { fill: '#fef08a', stroke: '#d97706', text: '#78350f' },
}

const STATUS_DOT: Record<string, string> = {
  Planning: '#d1d5db', 'In Progress': '#60a5fa', Published: '#34d399', Completed: '#a78bfa',
}

function utcDate(s: string) { return new Date(s + 'T00:00:00Z') }
function addDays(d: Date, n: number) { const r = new Date(d); r.setUTCDate(r.getUTCDate() + n); return r }
function daysBetween(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86_400_000) }
function fmtDay(d: Date) { return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).slice(0, 1) }
function fmtNum(d: Date) { return d.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' }) }

interface Block { key: string; phase: string; label: string; start: Date; end: Date; fill: string; stroke: string; text: string; lane: number }

function computeBlocks(pub: Date): Block[] {
  const ends: Date[] = []
  return WORKFLOW_EVENTS
    .map(ev => {
      const c = PHASE_BAR[ev.phase] ?? PHASE_BAR['Report']
      return { key: ev.key, phase: ev.phase, label: ev.label, start: addDays(pub, ev.sOff), end: addDays(pub, ev.eOff), fill: c.fill, stroke: c.stroke, text: c.text }
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map(b => {
      let lane = ends.findIndex(e => b.start >= e)
      if (lane === -1) { lane = ends.length; ends.push(addDays(b.end, 1)) }
      else ends[lane] = addDays(b.end, 1)
      return { ...b, lane }
    })
}

export function WorkflowGantt({ sectors }: { sectors: Sector[] }) {
  const today     = new Date('2026-06-05T00:00:00Z')
  const scheduled = useMemo(() => sectors.filter(s => !!s.publishDate), [sectors])

  // All collapsed by default
  const [expanded,  setExpanded]  = useState<Set<string>>(() => new Set())
  const toggle      = useCallback((id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n }), [])
  const expandAll   = () => setExpanded(new Set(sectors.map(s => s.id)))
  const collapseAll = () => setExpanded(new Set())

  const [viewStart, setViewStart] = useState<Date>(() =>
    scheduled.length ? addDays(utcDate(scheduled[0].publishDate), -38) : addDays(today, -14)
  )

  const viewEnd  = addDays(viewStart, DAYS_SHOWN - 1)
  const chartW   = DAYS_SHOWN * DAY_W
  const todayOff = daysBetween(viewStart, today)
  const todayX   = todayOff * DAY_W

  const days = useMemo(
    () => Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(viewStart, i)),
    [viewStart]
  )

  const monthSpans = useMemo(() => {
    const out: { label: string; x: number }[] = []
    days.forEach((d, i) => {
      const lbl = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
      if (out[out.length - 1]?.label !== lbl) out.push({ label: lbl, x: i * DAY_W })
    })
    return out
  }, [days])

  const blockMap = useMemo(() => {
    const m = new Map<string, Block[]>()
    sectors.forEach(s => {
      m.set(s.id, s.publishDate ? computeBlocks(utcDate(s.publishDate)) : [])
    })
    return m
  }, [sectors])

  const totalH = useMemo(() =>
    HEADER_H + sectors.reduce((h, s) => h + (expanded.has(s.id) ? ROW_EXPANDED : ROW_COLLAPSED), 0),
    [sectors, expanded]
  )

  return (
    <div className="w-full select-none">

      {/* Controls */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button onClick={() => setViewStart(d => addDays(d, -7))} className="p-1 rounded hover:bg-gray-100 text-gray-500"><ChevronLeft className="size-4" /></button>
        <button onClick={() => setViewStart(d => addDays(d,  7))} className="p-1 rounded hover:bg-gray-100 text-gray-500"><ChevronRight className="size-4" /></button>
        <button onClick={() => setViewStart(addDays(today, -14))} className="px-2.5 py-1 text-xs rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium">Today</button>
        <span className="text-xs text-gray-400">
          {viewStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} –{' '}
          {viewEnd.toLocaleDateString('en-US',   { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
        </span>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <button onClick={expandAll}   className="text-indigo-600 hover:underline">Expand all</button>
          <span className="text-gray-300">|</span>
          <button onClick={collapseAll} className="text-gray-500 hover:underline">Collapse all</button>
          <span className="text-gray-300">|</span>
          <span className="text-gray-400">{sectors.length} sectors · {expanded.size} expanded</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap mb-4">
        {Object.entries(PHASE_BAR).map(([ph, c]) => (
          <div key={ph} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-3 h-3 rounded-sm border" style={{ background: c.fill, borderColor: c.stroke }} />{ph}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-6 h-3 rounded-sm bg-black/[.055]" />Past</div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-0.5 h-3 bg-red-400" />Today</div>
      </div>

      {/* Grid */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden" style={{ display: 'flex' }}>

        {/* Sticky sector column */}
        <div style={{ width: LABEL_W, minWidth: LABEL_W, position: 'sticky', left: 0, zIndex: 20 }}
          className="shrink-0 bg-white border-r border-gray-200">

          <div style={{ height: HEADER_H }} className="bg-gray-50 border-b border-gray-200 flex items-end px-3 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Sector</span>
          </div>

          {sectors.map(s => {
            const isExp  = expanded.has(s.id)
            const rh     = isExp ? ROW_EXPANDED : ROW_COLLAPSED
            const hasDate = !!s.publishDate
            return (
              <div
                key={s.id}
                style={{ height: rh }}
                className="flex flex-col justify-center px-3 border-b border-gray-100 cursor-pointer hover:bg-indigo-50 transition-colors"
                onClick={() => toggle(s.id)}
              >
                <div className="flex items-center gap-1.5">
                  {isExp
                    ? <ChevronDown     className="size-3 text-indigo-500 shrink-0" />
                    : <ChevronRightIcon className="size-3 text-gray-400 shrink-0"  />
                  }
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_DOT[s.status] ?? '#d1d5db' }} />
                  <span className="text-[12px] font-semibold text-gray-800 truncate">{s.name}</span>
                </div>
                <div className="text-[10px] pl-5 mt-0.5">
                  {hasDate
                    ? <span className="text-gray-400">{utcDate(s.publishDate).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', timeZone:'UTC' })}</span>
                    : <span className="text-gray-300 italic">no publish date</span>
                  }
                </div>
              </div>
            )
          })}

          <div style={{ height: 32 }} className="bg-gray-50 border-t border-gray-200 flex items-center px-3">
            <span className="text-xs font-bold text-gray-600">{sectors.length} sectors</span>
          </div>
        </div>

        {/* Scrollable SVG */}
        <div style={{ flex: 1, overflowX: 'auto' }}>
          <svg width={chartW} height={totalH + 32} style={{ display: 'block', minWidth: chartW }}>

            {/* Month band */}
            <rect x={0} y={0} width={chartW} height={22} fill="#f9fafb" />
            {monthSpans.map((m, i) => (
              <g key={i}>
                <text x={m.x + 4} y={15} fontSize={10} fontWeight="700" fill="#6b7280">{m.label}</text>
                {i > 0 && <line x1={m.x} y1={0} x2={m.x} y2={22} stroke="#e5e7eb" />}
              </g>
            ))}

            {/* Day headers */}
            <rect x={0} y={22} width={chartW} height={HEADER_H - 22} fill="#f9fafb" />
            {days.map((d, i) => {
              const isToday = i === todayOff
              const isSun   = d.getUTCDay() === 0
              const isSat   = d.getUTCDay() === 6
              return (
                <g key={i}>
                  <rect x={i * DAY_W} y={22} width={DAY_W} height={HEADER_H - 22}
                    fill={isToday ? '#eef2ff' : isSat || isSun ? '#f9fafb' : 'transparent'} />
                  <text x={i * DAY_W + DAY_W / 2} y={33} fontSize={8}
                    fill={isSat || isSun ? '#d1d5db' : '#9ca3af'} textAnchor="middle">{fmtDay(d)}</text>
                  <text x={i * DAY_W + DAY_W / 2} y={44} fontSize={10}
                    fill={isToday ? '#4f46e5' : isSat || isSun ? '#d1d5db' : '#374151'}
                    textAnchor="middle" fontWeight={isToday ? '800' : '400'}>{fmtNum(d)}</text>
                  <line x1={i * DAY_W} y1={22} x2={i * DAY_W} y2={HEADER_H} stroke="#f3f4f6" />
                </g>
              )
            })}
            <line x1={0} y1={HEADER_H} x2={chartW} y2={HEADER_H} stroke="#e5e7eb" />

            {/* Sector rows */}
            {(() => {
              let yOff = HEADER_H
              return sectors.map(s => {
                const isExp  = expanded.has(s.id)
                const rh     = isExp ? ROW_EXPANDED : ROW_COLLAPSED
                const blocks = blockMap.get(s.id) ?? []
                const laneH  = isExp ? FULL_H  : MINI_H
                const laneG  = isExp ? FULL_GAP : MINI_GAP
                const pad    = isExp ? FULL_PAD : MINI_PAD

                const el = (
                  <g key={s.id} style={{ cursor: 'pointer' }} onClick={() => toggle(s.id)}>
                    {/* Background + grid */}
                    {days.map((d, i) => {
                      const we = d.getUTCDay() === 0 || d.getUTCDay() === 6
                      return (
                        <g key={i}>
                          {we && <rect x={i * DAY_W} y={yOff} width={DAY_W} height={rh} fill="#fafafa" />}
                          <line x1={i * DAY_W} y1={yOff} x2={i * DAY_W} y2={yOff + rh} stroke="#f3f4f6" />
                        </g>
                      )
                    })}

                    {/* Today column */}
                    {todayOff >= 0 && todayOff < DAYS_SHOWN && (
                      <rect x={todayOff * DAY_W} y={yOff} width={DAY_W} height={rh} fill="#eef2ff" opacity={0.4} />
                    )}

                    {/* Bars — visible in BOTH states, just different sizes */}
                    {blocks.filter(b => b.lane < FULL_LANES).map((b, bi) => {
                      const startD = daysBetween(viewStart, b.start)
                      const endD   = daysBetween(viewStart, b.end)
                      const cs = Math.max(0, startD)
                      const ce = Math.min(DAYS_SHOWN - 1, endD)
                      if (cs > ce) return null
                      const bx = cs * DAY_W + 1
                      const bw = Math.max((ce - cs + 1) * DAY_W - 2, isExp ? 6 : 2)
                      const by = yOff + pad + b.lane * (laneH + laneG)
                      return (
                        <g key={bi}>
                          <rect x={bx} y={by} width={bw} height={laneH} rx={isExp ? 3 : 1}
                            fill={b.fill} stroke={b.stroke} strokeWidth={isExp ? 1 : 0.5} opacity={0.92} />
                          {startD < 0 && (
                            <polygon points={`${bx},${by} ${bx+4},${by+laneH/2} ${bx},${by+laneH}`} fill={b.stroke} opacity={0.5} />
                          )}
                          {endD >= DAYS_SHOWN && (
                            <polygon points={`${bx+bw},${by} ${bx+bw-4},${by+laneH/2} ${bx+bw},${by+laneH}`} fill={b.stroke} opacity={0.5} />
                          )}
                          {/* Labels only when expanded */}
                          {isExp && bw > 28 && (
                            <text x={bx + (startD < 0 ? 8 : 5)} y={by + laneH / 2 + 4.5}
                              fontSize={8.5} fill={b.text} fontWeight="600"
                              style={{ pointerEvents: 'none', userSelect: 'none' }}>
                              {bw > 95 ? b.label : bw > 45 ? b.label.split(' ')[0] : ''}
                            </text>
                          )}
                          <title>{`${s.name} — ${b.label}\n${b.start.toISOString().split('T')[0]} → ${b.end.toISOString().split('T')[0]}`}</title>
                        </g>
                      )
                    })}

                    {/* No-date placeholder text */}
                    {!s.publishDate && (
                      <text x={6} y={yOff + rh / 2 + 4} fontSize={9} fill="#e5e7eb" fontStyle="italic">no publish date</text>
                    )}

                    <line x1={0} y1={yOff + rh} x2={chartW} y2={yOff + rh} stroke="#e5e7eb" strokeWidth={0.5} />
                  </g>
                )
                yOff += rh
                return el
              })
            })()}

            {/* Past gray wash */}
            {todayX > 0 && (
              <rect x={0} y={0} width={Math.min(todayX, chartW)} height={totalH}
                fill="rgba(0,0,0,0.05)" style={{ pointerEvents: 'none' }} />
            )}

            {/* Today line */}
            {todayX >= 0 && todayX <= chartW && (
              <line x1={todayX} y1={0} x2={todayX} y2={totalH}
                stroke="#f87171" strokeWidth={2} strokeDasharray="4,3" />
            )}

            {/* Footer */}
            <rect x={0} y={totalH} width={chartW} height={32} fill="#f9fafb" />
            <line x1={0} y1={totalH} x2={chartW} y2={totalH} stroke="#e5e7eb" />
          </svg>
        </div>
      </div>
    </div>
  )
}
