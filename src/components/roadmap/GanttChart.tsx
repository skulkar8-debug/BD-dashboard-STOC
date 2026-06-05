'use client'

import { useMemo, useState } from 'react'
import type { Sector } from '@/lib/types'

interface GanttProps {
  sectors: Sector[]
}

const LABEL_W  = 170
const ROW_H    = 34
const HEADER_H = 28
const CHART_W  = 680

const EVENTS = [
  { key: 'connect',   color: '#60a5fa', label: 'LinkedIn Outreach', offset: -14, isBar: true,  barEnd: -1 },
  { key: 'publish',   color: '#22c55e', label: 'Report Publish',    offset: 0,   isBar: false },
  { key: 'tipcreate', color: '#fb923c', label: 'TIP Create',        offset: 1,   isBar: false },
  { key: 'tipsend',   color: '#c084fc', label: 'TIP Send',          offset: 5,   isBar: false },
  { key: 'followup',  color: '#facc15', label: 'Follow-up',         offset: 8,   isBar: false },
] as const

function addDays(dateStr: string, n: number): Date {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d
}

function fmtShort(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function GanttChart({ sectors }: GanttProps) {
  const [showAll, setShowAll] = useState(false)

  const scheduled = useMemo(
    () => sectors.filter(s => !!s.publishDate).sort((a, b) => a.publishDate.localeCompare(b.publishDate)),
    [sectors]
  )

  const display = showAll ? sectors : scheduled

  const { minMs, rangeMs } = useMemo(() => {
    if (scheduled.length === 0) {
      const now = Date.now()
      return { minMs: now, rangeMs: 30 * 86400000 }
    }
    const dates: number[] = scheduled.flatMap(s => [
      addDays(s.publishDate, -20).getTime(),
      addDays(s.publishDate,  15).getTime(),
    ])
    const lo = Math.min(...dates)
    const hi = Math.max(...dates)
    return { minMs: lo, rangeMs: Math.max(hi - lo, 1) }
  }, [scheduled])

  const x = (d: Date) => ((d.getTime() - minMs) / rangeMs) * CHART_W

  const todayX = x(new Date('2026-06-05'))

  // Month tick marks
  const months = useMemo(() => {
    const result: { label: string; xPos: number }[] = []
    const start = new Date(minMs)
    const end   = new Date(minMs + rangeMs)
    const cur   = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
    while (cur.getTime() <= end.getTime()) {
      result.push({
        label: cur.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
        xPos:  Math.max(0, x(cur)),
      })
      cur.setUTCMonth(cur.getUTCMonth() + 1)
    }
    return result
  }, [minMs, rangeMs])

  if (scheduled.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
        No sectors have publish dates set yet — add a publish date to a sector to see it here.
      </div>
    )
  }

  const totalH = HEADER_H + display.length * ROW_H + 20

  return (
    <div className="w-full">
      {/* Legend + toggle */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {EVENTS.map(e => (
            <div key={e.key} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: e.color }} />
              {e.label}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="inline-block w-px h-3 bg-red-400" />
            Today
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <button
            onClick={() => setShowAll(false)}
            className={`px-2.5 py-1 rounded-md font-medium ${!showAll ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            Scheduled ({scheduled.length})
          </button>
          <button
            onClick={() => setShowAll(true)}
            className={`px-2.5 py-1 rounded-md font-medium ${showAll ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            All ({sectors.length})
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: LABEL_W + CHART_W + 16, display: 'flex' }}>
          {/* Name labels column */}
          <div style={{ width: LABEL_W, minWidth: LABEL_W, paddingTop: HEADER_H }} className="shrink-0">
            {display.map(s => (
              <div key={s.id} style={{ height: ROW_H }} className="flex flex-col justify-center pr-3">
                <div className="text-[11px] font-semibold text-gray-700 truncate text-right leading-tight" title={s.name}>
                  {s.name}
                </div>
                {s.publishDate && (
                  <div className="text-[9px] text-gray-400 text-right">
                    {new Date(s.publishDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* SVG chart area */}
          <svg
            width={CHART_W}
            height={totalH}
            style={{ overflow: 'visible', flex: 1 }}
          >
            {/* Background */}
            <rect x={0} y={0} width={CHART_W} height={totalH} fill="transparent" />

            {/* Month grid lines + labels */}
            {months.map((m, i) => (
              <g key={i}>
                <line
                  x1={m.xPos} y1={HEADER_H}
                  x2={m.xPos} y2={totalH - 20}
                  stroke="#e5e7eb" strokeWidth={1}
                />
                <text
                  x={m.xPos + 4} y={HEADER_H - 8}
                  fontSize={9} fill="#9ca3af" fontWeight="600"
                >
                  {m.label}
                </text>
              </g>
            ))}

            {/* Today vertical line */}
            {todayX >= 0 && todayX <= CHART_W && (
              <>
                <line
                  x1={todayX} y1={0}
                  x2={todayX} y2={totalH - 20}
                  stroke="#f87171" strokeWidth={1.5} strokeDasharray="4,3"
                />
                <text x={todayX + 3} y={totalH - 6} fontSize={9} fill="#f87171" fontWeight="700">Today</text>
              </>
            )}

            {/* Row backgrounds (alternating) */}
            {display.map((_, rowIdx) => (
              <rect
                key={rowIdx}
                x={0} y={HEADER_H + rowIdx * ROW_H}
                width={CHART_W} height={ROW_H}
                fill={rowIdx % 2 === 0 ? '#fafafa' : '#ffffff'}
              />
            ))}

            {/* Events */}
            {display.map((s, rowIdx) => {
              if (!s.publishDate) return null
              const cy = HEADER_H + rowIdx * ROW_H + ROW_H / 2
              return (
                <g key={s.id}>
                  {EVENTS.map(ev => {
                    const evDate = addDays(s.publishDate, ev.offset)
                    const evX    = x(evDate)

                    if (ev.isBar) {
                      // LinkedIn connect window: bar from connect start to publish-1
                      const barStart = x(addDays(s.publishDate, ev.offset))
                      const barEnd   = x(addDays(s.publishDate, ev.barEnd))
                      const barW     = Math.max(barEnd - barStart, 4)
                      return (
                        <g key={ev.key}>
                          <rect
                            x={barStart} y={cy - 7}
                            width={barW} height={14}
                            rx={3} fill={ev.color} opacity={0.75}
                          />
                          <title>{`${ev.label}: ${fmtShort(addDays(s.publishDate, ev.offset))} → ${fmtShort(addDays(s.publishDate, ev.barEnd))}`}</title>
                        </g>
                      )
                    }

                    // Point event: circle
                    return (
                      <g key={ev.key}>
                        <circle
                          cx={evX} cy={cy}
                          r={5.5}
                          fill={ev.color}
                          stroke="white" strokeWidth={1.5}
                        />
                        <title>{`${ev.label}: ${fmtShort(evDate)}`}</title>
                      </g>
                    )
                  })}
                </g>
              )
            })}

            {/* Bottom axis line */}
            <line x1={0} y1={HEADER_H} x2={CHART_W} y2={HEADER_H} stroke="#e5e7eb" strokeWidth={1} />
          </svg>
        </div>
      </div>
    </div>
  )
}
