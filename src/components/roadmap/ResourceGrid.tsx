'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Sector } from '@/lib/types'
import { WORKFLOW_EVENTS, type OwnerRole } from '@/lib/workflowEvents'

// ─── layout constants ─────────────────────────────────────────────────────────
const DAY_W      = 38
const LABEL_W    = 160   // no TOTAL_W column
const LANE_H     = 13
const LANE_GAP   = 1
const ROW_H      = 56    // fixed uniform height for every person row
const MAX_LANES  = 3     // lanes beyond this are clipped
const HEADER_H   = 52
const DAYS_SHOWN = 56

// ─── helpers ──────────────────────────────────────────────────────────────────
function utcDate(s: string) { return new Date(s + 'T00:00:00Z') }
function addDays(d: Date, n: number) { const r = new Date(d); r.setUTCDate(r.getUTCDate() + n); return r }
function daysBetween(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86_400_000) }
function fmtDay(d: Date) { return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).slice(0, 2) }
function fmtNum(d: Date) { return d.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' }) }

interface Block {
  sector: string; sectorId: string; wfKey: string; label: string; phase: string; wfSteps: string
  bg: string; border: string; text: string
  startDate: Date; endDate: Date; lane: number
}

interface PersonRow {
  name: string; role: string; roleKey: OwnerRole
  blocks: Block[]; lanes: number; taskDays: number
}

const ROLE_ORDER: OwnerRole[] = ['mr', 'mrsupport', 'bd', 'sm', 'mp']
const ROLE_LABELS: Record<OwnerRole, string> = {
  mr:        'Market Research',
  mrsupport: 'MR Support',
  bd:        'BD',
  sm:        'Senior Manager',
  mp:        'MP',
}

function assignLanes(blocks: Omit<Block, 'lane'>[]): Block[] {
  const ends: Date[] = []
  return blocks
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .map(b => {
      let lane = ends.findIndex(e => b.startDate >= e)
      if (lane === -1) { lane = ends.length; ends.push(addDays(b.endDate, 1)) }
      else ends[lane] = addDays(b.endDate, 1)
      return { ...b, lane }
    })
}

export function ResourceGrid({ sectors }: { sectors: Sector[] }) {
  const scheduled = useMemo(
    () => sectors.filter(s => !!s.publishDate).sort((a, b) => a.publishDate.localeCompare(b.publishDate)),
    [sectors]
  )

  const [viewStart, setViewStart] = useState<Date>(() => {
    if (!scheduled.length) return new Date('2026-05-01T00:00:00Z')
    return addDays(utcDate(scheduled[0].publishDate), -38)
  })

  const today    = new Date('2026-06-05T00:00:00Z')
  const viewEnd  = addDays(viewStart, DAYS_SHOWN - 1)
  const chartW   = DAYS_SHOWN * DAY_W
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

  // Build person rows — one row per unique person who has scheduled sectors
  const personRows = useMemo<PersonRow[]>(() => {
    if (!scheduled.length) return []

    // Collect all people from scheduled sectors per role
    const people: Map<string, { roleKey: OwnerRole; rawBlocks: Omit<Block,'lane'>[] }> = new Map()

    const ensure = (name: string, roleKey: OwnerRole) => {
      if (!name) return
      if (!people.has(name)) people.set(name, { roleKey, rawBlocks: [] })
    }

    scheduled.forEach(s => {
      const pub      = utcDate(s.publishDate)
      const ownerMap: Record<OwnerRole, string> = {
        mr: s.mr, mrsupport: s.mrSupport, bd: s.bd, sm: s.sm, mp: s.mp,
      }

      // Ensure each role-person is registered
      ;(Object.entries(ownerMap) as [OwnerRole, string][]).forEach(([role, name]) => {
        if (name) ensure(name, role)
      })

      // For each workflow event, add blocks for the owners
      WORKFLOW_EVENTS.forEach(ev => {
        ev.owners.forEach(role => {
          const name = ownerMap[role]
          if (!name) return
          const p = people.get(name)
          if (!p) return
          p.rawBlocks.push({
            sector:    s.name,
            sectorId:  s.id,
            wfKey:     ev.key,
            label:     ev.label,
            phase:     ev.phase,
            wfSteps:   ev.wfSteps,
            bg:        ev.bg,
            border:    ev.border,
            text:      ev.text,
            startDate: addDays(pub, ev.sOff),
            endDate:   addDays(pub, ev.eOff),
          })
        })
      })
    })

    // Build rows sorted by role order then name
    return Array.from(people.entries())
      .sort((a, b) => {
        const ri = (r: OwnerRole) => ROLE_ORDER.indexOf(r)
        const ra = ri(a[1].roleKey), rb = ri(b[1].roleKey)
        return ra !== rb ? ra - rb : a[0].localeCompare(b[0])
      })
      .map(([name, { roleKey, rawBlocks }]) => {
        const blocks = assignLanes(rawBlocks)
        const maxLane = blocks.reduce((m, b) => Math.max(m, b.lane), 0)
        // Count unique "blocked days"
        const daySet = new Set<string>()
        blocks.forEach(b => {
          for (let d = new Date(b.startDate); d <= b.endDate; d = addDays(d, 1))
            daySet.add(d.toISOString().split('T')[0])
        })
        return {
          name, role: ROLE_LABELS[roleKey], roleKey,
          blocks, lanes: maxLane + 1, taskDays: daySet.size,
        }
      })
  }, [scheduled])

  const totalH = HEADER_H + personRows.length * ROW_H

  return (
    <div className="w-full select-none">
      {/* Legend */}
      <div className="flex items-start gap-x-4 gap-y-2 flex-wrap mb-4">
        {WORKFLOW_EVENTS.map(ev => (
          <div key={ev.key} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="inline-block w-3 h-3 rounded-sm border flex-shrink-0" style={{ background: ev.bg, borderColor: ev.border }} />
            <span className="whitespace-nowrap">{ev.label}</span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setViewStart(d => addDays(d, -7))} className="p-1 rounded hover:bg-gray-100 text-gray-500"><ChevronLeft className="size-4" /></button>
        <button onClick={() => setViewStart(d => addDays(d,  7))} className="p-1 rounded hover:bg-gray-100 text-gray-500"><ChevronRight className="size-4" /></button>
        <button onClick={() => setViewStart(addDays(today, -14))} className="px-2.5 py-1 text-xs rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium">Today</button>
        <span className="text-xs text-gray-400">
          {viewStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} –{' '}
          {viewEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
        </span>
      </div>

      {/* Grid: sticky label + scrollable chart */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden" style={{ display: 'flex' }}>

        {/* Sticky person column — name only, no role, no Days */}
        <div style={{ width: LABEL_W, minWidth: LABEL_W, position: 'sticky', left: 0, zIndex: 20 }}
          className="shrink-0 border-r border-gray-200 bg-white">
          <div style={{ height: HEADER_H }} className="bg-gray-50 border-b border-gray-200 flex items-end px-3 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Person</span>
          </div>
          {personRows.map(row => (
            <div key={row.name} style={{ height: ROW_H }}
              className="flex items-center px-3 border-b border-gray-100">
              <div className="text-sm font-semibold text-gray-800 truncate">{row.name}</div>
            </div>
          ))}
          <div style={{ height: 36 }} className="flex items-center px-3 bg-gray-50 border-t border-gray-200">
            <span className="text-xs font-bold text-gray-600">{personRows.length} people</span>
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

            {/* Person rows — fixed uniform height */}
            {(() => {
              let yOff = HEADER_H
              return personRows.map(row => {
                const el = (
                  <g key={row.name}>
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
                    {/* Clip blocks to MAX_LANES within fixed row height */}
                    {row.blocks.filter(b => b.lane < MAX_LANES).map((b, bi) => {
                      const bs = daysBetween(viewStart, b.startDate)
                      const be = daysBetween(viewStart, b.endDate)
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
                              {bw > 100 ? `${b.sector} · ${b.label}` : bw > 50 ? b.sector : bw > 22 ? b.sector.split(' ')[0] : ''}
                            </text>
                          )}
                          <title>{`${row.name} — ${b.label} (${b.wfSteps})\nSector: ${b.sector}\n${b.startDate.toISOString().split('T')[0]} → ${b.endDate.toISOString().split('T')[0]}`}</title>
                        </g>
                      )
                    })}
                    {/* "+N more" if blocks were clipped */}
                    {row.blocks.filter(b => b.lane >= MAX_LANES).length > 0 && (
                      <text x={4} y={yOff + ROW_H - 4} fontSize={7} fill="#9ca3af"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}>
                        +{row.blocks.filter(b => b.lane >= MAX_LANES).length} more
                      </text>
                    )}
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
