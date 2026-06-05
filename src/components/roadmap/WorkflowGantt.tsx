'use client'

import { useMemo, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Sector } from '@/lib/types'
import { WORKFLOW_EVENTS } from '@/lib/workflowEvents'

// ─── layout ───────────────────────────────────────────────────────────────────
const LABEL_W    = 200   // sticky sector-name column
const DAY_W      = 38
const ROW_COLLAPSED = 34
const LANE_H     = 14
const LANE_GAP   = 2
const ROW_PAD    = 5
const HEADER_H   = 48
const DAYS_SHOWN = 56
const MAX_LANES  = 5     // how many lanes fit in expanded row

// expanded row height = enough for all lanes
const ROW_EXPANDED = ROW_PAD * 2 + MAX_LANES * LANE_H + (MAX_LANES - 1) * LANE_GAP  // ≈ 88px

const PHASE_BAR: Record<string, { fill: string; stroke: string; text: string }> = {
  'Research/Data': { fill: '#ddd6fe', stroke: '#7c3aed', text: '#4c1d95' },
  'Report':        { fill: '#bbf7d0', stroke: '#16a34a', text: '#14532d' },
  'Outreach':      { fill: '#bfdbfe', stroke: '#2563eb', text: '#1e3a8a' },
  'TIP':           { fill: '#fed7aa', stroke: '#ea580c', text: '#7c2d12' },
  'Calls/Intel':   { fill: '#fef08a', stroke: '#d97706', text: '#78350f' },
}

const STATUS_DOT: Record<string, string> = {
  Planning: '#d1d5db', 'In Progress': '#60a5fa',
  Published: '#34d399', Completed:    '#a78bfa',
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function utcDate(s: string)    { return new Date(s + 'T00:00:00Z') }
function addDays(d: Date, n: number) { const r = new Date(d); r.setUTCDate(r.getUTCDate() + n); return r }
function daysBetween(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86_400_000) }
function fmtDay(d: Date)  { return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).slice(0, 1) }
function fmtNum(d: Date)  { return d.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' }) }

// Greedy lane assignment for a set of blocks
interface RawBlock { key: string; phase: string; label: string; start: Date; end: Date; fill: string; stroke: string; text: string }
interface LanedBlock extends RawBlock { lane: number }

function assignLanes(blocks: RawBlock[]): LanedBlock[] {
  const ends: Date[] = []
  return blocks
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map(b => {
      let lane = ends.findIndex(e => b.start >= e)
      if (lane === -1) { lane = ends.length; ends.push(addDays(b.end, 1)) }
      else ends[lane] = addDays(b.end, 1)
      return { ...b, lane }
    })
}

// ─── component ────────────────────────────────────────────────────────────────
export function WorkflowGantt({ sectors }: { sectors: Sector[] }) {
  const today = new Date('2026-06-05T00:00:00Z')

  const scheduled = useMemo(() => sectors.filter(s => !!s.publishDate), [sectors])

  // All collapsed by default
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  // Sectors come pre-filtered from the parent Calendar page
  const filtered = sectors

  const toggle      = useCallback((id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n }), [])
  const expandAll   = () => setExpanded(new Set(sectors.map(s => s.id)))
  const collapseAll = () => setExpanded(new Set())

  // ── Timeline ───────────────────────────────────────────────────────────────
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

  // ── Per-sector precomputed blocks ──────────────────────────────────────────
  const sectorBlocks = useMemo(() => {
    const map = new Map<string, LanedBlock[]>()
    filtered.forEach(s => {
      if (!s.publishDate) { map.set(s.id, []); return }
      const pub = utcDate(s.publishDate)
      const raw: RawBlock[] = WORKFLOW_EVENTS.map(ev => {
        const c = PHASE_BAR[ev.phase] ?? PHASE_BAR['Report']
        return { key: ev.key, phase: ev.phase, label: ev.label, start: addDays(pub, ev.sOff), end: addDays(pub, ev.eOff), fill: c.fill, stroke: c.stroke, text: c.text }
      })
      map.set(s.id, assignLanes(raw))
    })
    return map
  }, [filtered])

  // ── Total SVG height ───────────────────────────────────────────────────────
  const totalH = useMemo(() =>
    HEADER_H + filtered.reduce((h, s) => h + (expanded.has(s.id) ? ROW_EXPANDED : ROW_COLLAPSED), 0),
    [filtered, expanded]
  )

  return (
    <div className="w-full select-none">

      {/* Timeline nav + expand controls */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button onClick={() => setViewStart(d => addDays(d, -7))} className="p-1 rounded hover:bg-gray-100 text-gray-500"><ChevronLeft className="size-4" /></button>
        <button onClick={() => setViewStart(d => addDays(d,  7))} className="p-1 rounded hover:bg-gray-100 text-gray-500"><ChevronRight className="size-4" /></button>
        <button onClick={() => setViewStart(addDays(today, -14))} className="px-2.5 py-1 text-xs rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium">Today</button>
        <span className="text-xs text-gray-400">
          {viewStart.toLocaleDateString('en-US', { month:'short', day:'numeric', timeZone:'UTC' })} –{' '}
          {viewEnd.toLocaleDateString('en-US',   { month:'short', day:'numeric', year:'numeric', timeZone:'UTC' })}
        </span>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <button onClick={expandAll}   className="text-indigo-600 hover:underline">Expand all</button>
          <span className="text-gray-300">|</span>
          <button onClick={collapseAll} className="text-gray-500 hover:underline">Collapse all</button>
        </div>
      </div>

      {/* Phase legend */}
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

        {/* Sticky sector-name column */}
        <div style={{ width: LABEL_W, minWidth: LABEL_W, position: 'sticky', left: 0, zIndex: 20 }}
          className="shrink-0 bg-white border-r border-gray-200">

          {/* Header */}
          <div style={{ height: HEADER_H }} className="bg-gray-50 border-b border-gray-200 flex items-end px-3 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Sector</span>
          </div>

          {/* Sector rows */}
          {filtered.map(s => {
            const isExp   = expanded.has(s.id)
            const hasDate = !!s.publishDate
            const rh      = isExp ? ROW_EXPANDED : ROW_COLLAPSED
            return (
              <div key={s.id} style={{ height: rh }}
                className="flex flex-col justify-center px-3 border-b border-gray-100 cursor-pointer hover:bg-indigo-50 transition-colors"
                onClick={() => toggle(s.id)}>
                <div className="flex items-center gap-1.5">
                  <span className={`text-gray-400 text-xs font-bold shrink-0 transition-transform duration-150 ${isExp ? 'rotate-90' : ''}`}>›</span>
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

          {/* Footer */}
          <div style={{ height: 32 }} className="bg-gray-50 border-t border-gray-200 flex items-center px-3">
            <span className="text-xs font-bold text-gray-600">{filtered.length} sectors · {expanded.size} expanded</span>
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
              const isSun = d.getUTCDay() === 0; const isSat = d.getUTCDay() === 6
              return (
                <g key={i}>
                  <rect x={i * DAY_W} y={22} width={DAY_W} height={HEADER_H - 22}
                    fill={isToday ? '#eef2ff' : isSat || isSun ? '#f9fafb' : 'transparent'} />
                  <text x={i * DAY_W + DAY_W / 2} y={33} fontSize={8} fill={isSat||isSun ? '#d1d5db':'#9ca3af'} textAnchor="middle">{fmtDay(d)}</text>
                  <text x={i * DAY_W + DAY_W / 2} y={44} fontSize={10}
                    fill={isToday ? '#4f46e5' : isSat||isSun ? '#d1d5db':'#374151'}
                    textAnchor="middle" fontWeight={isToday ? '800':'400'}>{fmtNum(d)}</text>
                  <line x1={i * DAY_W} y1={22} x2={i * DAY_W} y2={HEADER_H} stroke="#f3f4f6" />
                </g>
              )
            })}
            <line x1={0} y1={HEADER_H} x2={chartW} y2={HEADER_H} stroke="#e5e7eb" />

            {/* Sector rows */}
            {(() => {
              let yOff = HEADER_H
              return filtered.map(s => {
                const isExp  = expanded.has(s.id)
                const rh     = isExp ? ROW_EXPANDED : ROW_COLLAPSED
                const blocks = sectorBlocks.get(s.id) ?? []

                const el = (
                  <g key={s.id} style={{ cursor: 'pointer' }} onClick={() => toggle(s.id)}>
                    {/* Row background + grid */}
                    {days.map((d, i) => {
                      const we = d.getUTCDay() === 0 || d.getUTCDay() === 6
                      return (
                        <g key={i}>
                          {we && <rect x={i * DAY_W} y={yOff} width={DAY_W} height={rh} fill="#fafafa" />}
                          <line x1={i * DAY_W} y1={yOff} x2={i * DAY_W} y2={yOff + rh} stroke="#f3f4f6" />
                        </g>
                      )
                    })}

                    {/* Today column highlight */}
                    {todayOff >= 0 && todayOff < DAYS_SHOWN && (
                      <rect x={todayOff * DAY_W} y={yOff} width={DAY_W} height={rh} fill="#eef2ff" opacity={0.4} />
                    )}

                    {/* Workflow bars — only when expanded */}
                    {isExp && blocks.filter(b => b.lane < MAX_LANES).map((b, bi) => {
                      const startD = daysBetween(viewStart, b.start)
                      const endD   = daysBetween(viewStart, b.end)
                      const cs = Math.max(0, startD); const ce = Math.min(DAYS_SHOWN - 1, endD)
                      if (cs > ce) return null
                      const bx = cs * DAY_W + 2
                      const bw = Math.max((ce - cs + 1) * DAY_W - 4, 6)
                      const by = yOff + ROW_PAD + b.lane * (LANE_H + LANE_GAP)
                      return (
                        <g key={bi}>
                          <rect x={bx} y={by} width={bw} height={LANE_H} rx={3}
                            fill={b.fill} stroke={b.stroke} strokeWidth={1} opacity={0.92} />
                          {startD < 0 && <polygon points={`${bx},${by} ${bx+5},${by+LANE_H/2} ${bx},${by+LANE_H}`} fill={b.stroke} opacity={0.5} />}
                          {endD >= DAYS_SHOWN && <polygon points={`${bx+bw},${by} ${bx+bw-5},${by+LANE_H/2} ${bx+bw},${by+LANE_H}`} fill={b.stroke} opacity={0.5} />}
                          {bw > 24 && (
                            <text x={bx + (startD < 0 ? 8 : 4)} y={by + LANE_H / 2 + 4}
                              fontSize={8} fill={b.text} fontWeight="600"
                              style={{ pointerEvents: 'none', userSelect: 'none' }}>
                              {bw > 90 ? b.label : bw > 40 ? b.label.split(' ')[0] : ''}
                            </text>
                          )}
                          <title>{`${s.name} — ${b.label}\n${b.start.toISOString().split('T')[0]} → ${b.end.toISOString().split('T')[0]}`}</title>
                        </g>
                      )
                    })}

                    {/* Collapsed: show mini phase color dots if has date */}
                    {!isExp && s.publishDate && (
                      <>
                        {Object.entries(PHASE_BAR).map(([, c], pi) => (
                          <circle key={pi} cx={8 + pi * 10} cy={yOff + ROW_COLLAPSED / 2}
                            r={3} fill={c.fill} stroke={c.stroke} strokeWidth={0.8} />
                        ))}
                      </>
                    )}

                    <line x1={0} y1={yOff + rh} x2={chartW} y2={yOff + rh} stroke="#e5e7eb" strokeWidth={0.5} />
                  </g>
                )
                yOff += rh
                return el
              })
            })()}

            {/* Gray wash over past */}
            {todayX > 0 && (
              <rect x={0} y={0} width={Math.min(todayX, chartW)} height={totalH}
                fill="rgba(0,0,0,0.055)" style={{ pointerEvents: 'none' }} />
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
