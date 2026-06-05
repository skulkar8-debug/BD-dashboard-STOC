'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, Users, CalendarDays, List } from 'lucide-react'
import { useStore, fmtDate } from '@/lib/store'
// Inline badge using workflow event colors
function EventBadge({ type }: { type: string }) {
  const ev = WORKFLOW_EVENTS.find(e => e.label === type)
  if (!ev) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">{type}</span>
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border"
      style={{ background: ev.bg, borderColor: ev.border, color: ev.text }}>
      {type}
    </span>
  )
}
import { SectorGrid }        from '@/components/roadmap/SectorGrid'
import { ResourceGrid }      from '@/components/roadmap/ResourceGrid'
import { CalendarMonthView } from '@/components/roadmap/CalendarMonthView'
import { WORKFLOW_EVENTS } from '@/lib/workflowEvents'

const EVENT_TYPES = WORKFLOW_EVENTS.map(e => e.label)

type ViewMode = 'sector' | 'people' | 'month' | 'list'

export default function CalendarPage() {
  const { data } = useStore()
  const router   = useRouter()
  const [view, setView]       = useState<ViewMode>('sector')
  const [typeF, setTypeF]     = useState('')
  const [sectorF, setSectorF] = useState('')

  const sectorNames = [...new Set(data.calendar.map(e => e.sector))].sort()
  const filtered = data.calendar
    .filter(e => {
      if (typeF && e.type !== typeF) return false
      if (sectorF && e.sector !== sectorF) return false
      return true
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  const inp = 'border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

  const BTNS: { v: ViewMode; icon: React.ElementType; label: string; tag?: string }[] = [
    { v: 'sector', icon: Building2,   label: 'By Sector', tag: 'primary'   },
    { v: 'people', icon: Users,        label: 'By People', tag: 'secondary' },
    { v: 'month',  icon: CalendarDays, label: 'Month'                       },
    { v: 'list',   icon: List,         label: 'List'                        },
  ]

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">
            Publish dates, outreach windows, TIP events, and follow-ups across all sectors.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 flex-wrap shrink-0">
          {BTNS.map(({ v, icon: Icon, label, tag }) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === v ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Icon className="size-4" />
              {label}
              {tag && (
                <span className={`text-[9px] px-1 py-0.5 rounded font-bold uppercase tracking-wide ${tag === 'primary' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>
                  {tag}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {view === 'sector' && <SectorGrid sectors={data.sectors} />}
      {view === 'people' && <ResourceGrid sectors={data.sectors} />}

      {view === 'month' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <CalendarMonthView
            events={data.calendar}
            sectors={data.sectors}
            onSectorClick={id => router.push(`/roadmap/sectors/${id}`)}
          />
        </div>
      )}

      {view === 'list' && (
        <>
          <div className="flex gap-2 mb-4 flex-wrap">
            <select className={inp} value={typeF} onChange={e => setTypeF(e.target.value)}>
              <option value="">All Event Types</option>
              {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <select className={inp} value={sectorF} onChange={e => setSectorF(e.target.value)}>
              <option value="">All Sectors</option>
              {sectorNames.map(s => <option key={s}>{s}</option>)}
            </select>
            <span className="self-center text-xs text-gray-400">{filtered.length} events</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Date','Event Type','Sector','Owner','Notes'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">No events found.</td></tr>
                )}
                {filtered.map(e => {
                  const sec = data.sectors.find(s => s.name === e.sector)
                  return (
                    <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(e.date)}</td>
                      <td className="px-4 py-2.5"><EventBadge type={e.type} /></td>
                      <td className="px-4 py-2.5">
                        {sec
                          ? <Link href={`/roadmap/sectors/${sec.id}`} className="font-medium text-indigo-600 hover:underline">{e.sector}</Link>
                          : <span className="font-medium text-gray-800">{e.sector}</span>
                        }
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{e.owner}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{e.notes}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
