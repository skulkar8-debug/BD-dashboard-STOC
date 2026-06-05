'use client'

import { useMemo, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Sector } from '@/lib/types'
import { WORKFLOW_EVENTS } from '@/lib/workflowEvents'

// ─── layout ───────────────────────────────────────────────────────────────────
const SECTOR_W   = 130
const PHASE_W    = 90
const TASK_W     = 140
const LABEL_W    = SECTOR_W + PHASE_W + TASK_W   // 360px sticky
const DAY_W      = 36
const TASK_H     = 26
const SECTOR_H   = 30
const HEADER_H   = 48
const DAYS_SHOWN = 56

const PHASE_BAR: Record<string, { fill: string; stroke: string; text: string }> = {
  'Research/Data': { fill: '#ddd6fe', stroke: '#7c3aed', text: '#4c1d95' },
  'Report':        { fill: '#bbf7d0', stroke: '#16a34a', text: '#14532d' },
  'Outreach':      { fill: '#bfdbfe', stroke: '#2563eb', text: '#1e3a8a' },
  'TIP':           { fill: '#fed7aa', stroke: '#ea580c', text: '#7c2d12' },
  'Calls/Intel':   { fill: '#fef08a', stroke: '#d97706', text: '#78350f' },
}

const PHASES_ORDER = ['Research/Data', 'Report', 'Outreach', 'TIP', 'Calls/Intel'] as const
const EVENTS_BY_PHASE = PHASES_ORDER.map(ph => ({
  phase: ph, events: WORKFLOW_EVENTS.filter(e => e.phase === ph),
}))

// ─── helpers ──────────────────────────────────────────────────────────────────
function utcDate(s: string) { return new Date(s + 'T00:00:00Z') }
function addDays(d: Date, n: number) { const r = new Date(d); r.setUTCDate(r.getUTCDate() + n); return r }
function daysBetween(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86_400_000) }
function fmtDay(d: Date) { return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).slice(0, 1) }
function fmtNum(d: Date) { return d.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' }) }

const STATUS_DOT: Record<string, string> = {
  Planning: '#d1d5db', 'In Progress': '#60a5fa',
  Published: '#34d399', Completed: '#a78bfa',
}

// ─── component ────────────────────────────────────────────────────────────────
export function WorkflowGantt({ sectors }: { sectors: Sector[] }) {
  const today = new Date('2026-06-05T00:00:00Z')

  const scheduled = useMemo(
    () => sectors.filter(s => !!s.publishDate),
    [sectors]
  )

  // Default: scheduled sectors are pre-expanded, others collapsed
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(sectors.filter(s => !!s.publishDate).map(s => s.id))
  )

  const toggleSector = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

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

  // Build flat row list for both the label column and the SVG
  type SectorRow = { kind: 'sector'; sector: Sector }
  type TaskRow   = { kind: 'task'; sector: Sector; phase: string; evKey: string; label: string; sOff: number; eOff: number }
  type Row = SectorRow | TaskRow

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    sectors.forEach(s => {
      out.push({ kind: 'sector', sector: s })
      if (expanded.has(s.id)) {
        EVENTS_BY_PHASE.forEach(({ phase, events }) => {
          events.forEach(ev => {
            out.push({ kind: 'task', sector: s, phase, evKey: ev.key, label: ev.label, sOff: ev.sOff, eOff: ev.eOff })
          })
        })
      }
    })
    return out
  }, [sectors, expanded])

  const totalH = HEADER_H + rows.reduce((h, r) => h + (r.kind === 'sector' ? SECTOR_H : TASK_H), 0)

  return (
    <div className="w-full select-none">

      {/* Controls */}
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
          <span className="text-gray-300">|</span>
          <span className="text-gray-400">{sectors.length} sectors · {scheduled.length} scheduled</span>
        </div>
      </div>

      {/* Phase legend */}
      <div className="flex items-center gap-4 flex-wrap mb-4">
        {Object.entries(PHASE_BAR).map(([phase, c]) => (
          <div key={phase} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-3 h-3 rounded-sm border" style={{ background: c.fill, borderColor: c.stroke }} />
            {phase}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-6 h-3 rounded-sm bg-black/[.055]" /> Past
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-0.5 h-3 bg-red-400" /> Today
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden" style={{ display: 'flex' }}>

        {/* ── Sticky left columns ──────────────────────────────────────────── */}
        <div style={{ width: LABEL_W, minWidth: LABEL_W, position: 'sticky', left: 0, zIndex: 20 }}
          className="shrink-0 bg-white border-r border-gray-200">

          {/* Column headers */}
          <div style={{ height: HEADER_H }} className="bg-gray-50 border-b border-gray-200 flex items-end">
            <div style={{ width: SECTOR_W }} className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Sector</div>
            <div style={{ width: PHASE_W  }} className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-l border-gray-200">Phase</div>
            <div style={{ width: TASK_W  }} className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-l border-gray-200">Step</div>
          </div>

          {/* Rows */}
          {rows.map((row, i) => {
            if (row.kind === 'sector') {
              const s = row.sector
              const isExpanded = expanded.has(s.id)
              const hasDate    = !!s.publishDate
              return (
                <div key={`lbl-sect-${s.id}`} style={{ height: SECTOR_H }}
                  className="flex items-center bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-indigo-50 transition-colors"
                  onClick={() => toggleSector(s.id)}>

                  {/* Sector name col */}
                  <div style={{ width: SECTOR_W }} className="flex items-center gap-1.5 px-2 min-w-0">
                    {/* Expand arrow */}
                    <span className={`text-gray-400 text-xs font-bold shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}>›</span>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_DOT[s.status] ?? '#d1d5db' }} />
                    <span className="text-[11px] font-semibold text-gray-800 truncate">{s.name}</span>
                  </div>

                  {/* Phase + Task cols: show publish date / "no date" */}
                  <div style={{ width: PHASE_W + TASK_W }} className="flex items-center px-2 border-l border-gray-200 min-w-0">
                    <span className={`text-[10px] truncate ${hasDate ? 'text-gray-500' : 'text-gray-300 italic'}`}>
                      {hasDate
                        ? utcDate(s.publishDate).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', timeZone:'UTC' })
                        : 'no publish date — click to expand'
                      }
                    </span>
                    {hasDate && !isExpanded && (
                      <span className="ml-auto text-[9px] text-indigo-400 shrink-0">click to expand</span>
                    )}
                  </div>
                </div>
              )
            }

            // task row
            const phaseC = PHASE_BAR[row.phase] ?? PHASE_BAR['Report']
            return (
              <div key={`lbl-task-${row.sector.id}-${row.evKey}`} style={{ height: TASK_H }}
                className="flex items-center border-b border-gray-100">
                <div style={{ width: SECTOR_W }} className="border-r border-gray-100 h-full" />
                <div style={{ width: PHASE_W, borderLeftColor: phaseC.stroke }}
                  className="h-full flex items-center px-2 border-l-2 border-r border-gray-100">
                  <span className="text-[9px] font-bold uppercase tracking-wide truncate" style={{ color: phaseC.stroke }}>
                    {row.phase}
                  </span>
                </div>
                <div style={{ width: TASK_W }} className="h-full flex items-center px-2 border-l border-gray-100">
                  <span className="text-[11px] text-gray-700 truncate">{row.label}</span>
                </div>
              </div>
            )
          })}

          {/* Footer */}
          <div style={{ height: 32 }} className="bg-gray-50 border-t border-gray-200 flex items-center px-3">
            <span className="text-xs font-bold text-gray-600">
              {expanded.size} expanded · {sectors.length - expanded.size} collapsed
            </span>
          </div>
        </div>

        {/* ── Scrollable SVG chart ─────────────────────────────────────────── */}
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
                  <text x={i * DAY_W + DAY_W / 2} y={33} fontSize={8}
                    fill={isSat || isSun ? '#d1d5db' : '#9ca3af'} textAnchor="middle" fontWeight="500">{fmtDay(d)}</text>
                  <text x={i * DAY_W + DAY_W / 2} y={44} fontSize={10}
                    fill={isToday ? '#4f46e5' : isSat || isSun ? '#d1d5db' : '#374151'}
                    textAnchor="middle" fontWeight={isToday ? '800' : '400'}>{fmtNum(d)}</text>
                  <line x1={i * DAY_W} y1={22} x2={i * DAY_W} y2={HEADER_H} stroke="#f3f4f6" />
                </g>
              )
            })}
            <line x1={0} y1={HEADER_H} x2={chartW} y2={HEADER_H} stroke="#e5e7eb" />

            {/* Data rows */}
            {(() => {
              let yOff = HEADER_H
              return rows.map((row) => {
                const rh = row.kind === 'sector' ? SECTOR_H : TASK_H

                if (row.kind === 'sector') {
                  const el = (
                    <g key={`svg-sect-${row.sector.id}`} style={{ cursor: 'pointer' }}
                      onClick={() => toggleSector(row.sector.id)}>
                      <rect x={0} y={yOff} width={chartW} height={rh} fill="#f9fafb" />
                      {days.map((_, i) => (
                        <line key={i} x1={i * DAY_W} y1={yOff} x2={i * DAY_W} y2={yOff + rh} stroke="#e5e7eb" strokeWidth={0.5} />
                      ))}
                      <line x1={0} y1={yOff + rh} x2={chartW} y2={yOff + rh} stroke="#e5e7eb" />
                    </g>
                  )
                  yOff += rh; return el
                }

                // task row
                const s = row.sector
                const pub = s.publishDate ? utcDate(s.publishDate) : null
                const phaseC = PHASE_BAR[row.phase] ?? PHASE_BAR['Report']

                let bar: React.ReactNode = null
                if (pub) {
                  const startD = daysBetween(viewStart, addDays(pub, row.sOff))
                  const endD   = daysBetween(viewStart, addDays(pub, row.eOff))
                  const cs = Math.max(0, startD); const ce = Math.min(DAYS_SHOWN - 1, endD)
                  if (cs <= ce) {
                    const bx = cs * DAY_W + 2
                    const bw = Math.max((ce - cs + 1) * DAY_W - 4, 6)
                    const by = yOff + 4
                    const bh = TASK_H - 8
                    bar = (
                      <g>
                        <rect x={bx} y={by} width={bw} height={bh} rx={3}
                          fill={phaseC.fill} stroke={phaseC.stroke} strokeWidth={1} />
                        {startD < 0 && <polygon points={`${bx},${by} ${bx+6},${by+bh/2} ${bx},${by+bh}`} fill={phaseC.stroke} opacity={0.5} />}
                        {endD >= DAYS_SHOWN && <polygon points={`${bx+bw},${by} ${bx+bw-6},${by+bh/2} ${bx+bw},${by+bh}`} fill={phaseC.stroke} opacity={0.5} />}
                        {bw > 24 && (
                          <text x={bx + (startD < 0 ? 10 : 4)} y={by + bh / 2 + 4}
                            fontSize={8} fill={phaseC.text} fontWeight="600"
                            style={{ pointerEvents: 'none', userSelect: 'none' }}>
                            {bw > 90 ? row.label : bw > 40 ? row.label.split(' ')[0] : ''}
                          </text>
                        )}
                        <title>{`${s.name} — ${row.label}\n${addDays(pub, row.sOff).toISOString().split('T')[0]} → ${addDays(pub, row.eOff).toISOString().split('T')[0]}`}</title>
                      </g>
                    )
                  }
                }

                const el = (
                  <g key={`svg-task-${s.id}-${row.evKey}`}>
                    {days.map((d, i) => {
                      const we = d.getUTCDay() === 0 || d.getUTCDay() === 6
                      return (
                        <g key={i}>
                          {we && <rect x={i * DAY_W} y={yOff} width={DAY_W} height={TASK_H} fill="#fafafa" />}
                          <line x1={i * DAY_W} y1={yOff} x2={i * DAY_W} y2={yOff + TASK_H} stroke="#f3f4f6" />
                        </g>
                      )
                    })}
                    {bar}
                    <line x1={0} y1={yOff + TASK_H} x2={chartW} y2={yOff + TASK_H} stroke="#f3f4f6" />
                  </g>
                )
                yOff += TASK_H; return el
              })
            })()}

            {/* ── Gray wash over past columns ─────────────────────────────── */}
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
