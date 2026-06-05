'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, Users, CalendarDays, List, Search, SlidersHorizontal, X } from 'lucide-react'
import { useStore, fmtDate } from '@/lib/store'
import { WorkflowGantt }    from '@/components/roadmap/WorkflowGantt'
import { ResourceGrid }     from '@/components/roadmap/ResourceGrid'
import { CalendarMonthView } from '@/components/roadmap/CalendarMonthView'
import { WORKFLOW_EVENTS } from '@/lib/workflowEvents'

// ─── inline event badge ───────────────────────────────────────────────────────
function EventBadge({ type }: { type: string }) {
  const ev = WORKFLOW_EVENTS.find(e => e.label === type)
  if (!ev) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">{type}</span>
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border"
      style={{ background: ev.bg, borderColor: ev.border, color: ev.text }}>{type}</span>
  )
}

type ViewMode = 'sector' | 'people' | 'month' | 'list'

const STATUSES   = ['Planning', 'In Progress', 'Published', 'Completed']
const PRIORITIES = ['High', 'Medium', 'Low']
const PHASES     = [...new Set(WORKFLOW_EVENTS.map(e => e.phase))]
const STEP_LABELS = WORKFLOW_EVENTS.map(e => e.label)

// ─── page ─────────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { data } = useStore()
  const router   = useRouter()
  const [view, setView] = useState<ViewMode>('sector')
  const [filtersOpen, setFiltersOpen] = useState(false)

  // ── universal filter state ────────────────────────────────────────────────
  const [search,     setSearch]     = useState('')
  const [phase,      setPhase]      = useState('')
  const [stepType,   setStepType]   = useState('')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')
  const [status,     setStatus]     = useState('')
  const [priority,   setPriority]   = useState('')
  const [mp,         setMp]         = useState('')
  const [bd,         setBd]         = useState('')
  const [schedOnly,  setSchedOnly]  = useState(false)
  const [owner,      setOwner]      = useState('')

  const allMPs    = useMemo(() => [...new Set(data.sectors.map(s => s.mp).filter(Boolean))].sort(), [data.sectors])
  const allBDs    = useMemo(() => [...new Set(data.sectors.map(s => s.bd).filter(Boolean))].sort(), [data.sectors])
  const allOwners = useMemo(() => [...new Set(data.calendar.map(e => e.owner).filter(Boolean))].sort(), [data.calendar])

  const hasFilters = !!(search || phase || stepType || dateFrom || dateTo || status || priority || mp || bd || schedOnly || owner)

  const clearAll = () => { setSearch(''); setPhase(''); setStepType(''); setDateFrom(''); setDateTo(''); setStatus(''); setPriority(''); setMp(''); setBd(''); setSchedOnly(false); setOwner('') }

  // ── filtered sectors (for Gantt + People views) ───────────────────────────
  const filteredSectors = useMemo(() => data.sectors.filter(s => {
    if (search   && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    if (status   && s.status   !== status)   return false
    if (priority && s.priority !== priority) return false
    if (mp       && s.mp       !== mp)       return false
    if (bd       && s.bd       !== bd)       return false
    if (schedOnly && !s.publishDate)         return false
    // When a date range is active, sectors with no publish date are excluded
    if (dateFrom && (!s.publishDate || s.publishDate < dateFrom)) return false
    if (dateTo   && (!s.publishDate || s.publishDate > dateTo))   return false
    return true
  }), [data.sectors, search, status, priority, mp, bd, schedOnly, dateFrom, dateTo])

  // ── filtered calendar events (for Month + List views) ────────────────────
  const filteredEvents = useMemo(() => data.calendar.filter(e => {
    if (search   && !e.sector.toLowerCase().includes(search.toLowerCase()) && !e.type.toLowerCase().includes(search.toLowerCase())) return false
    if (phase    && WORKFLOW_EVENTS.find(w => w.label === e.type)?.phase !== phase) return false
    if (stepType && e.type !== stepType) return false
    if (owner    && e.owner !== owner)   return false
    if (dateFrom && e.date < dateFrom)   return false
    if (dateTo   && e.date > dateTo)     return false
    // sector-level filters: only show events whose sector passes sector filters
    const sec = data.sectors.find(s => s.name === e.sector)
    if (status   && sec && sec.status   !== status)   return false
    if (priority && sec && sec.priority !== priority) return false
    if (mp       && sec && sec.mp       !== mp)       return false
    if (bd       && sec && sec.bd       !== bd)       return false
    if (schedOnly && sec && !sec.publishDate)         return false
    return true
  }), [data.calendar, data.sectors, search, phase, stepType, owner, dateFrom, dateTo, status, priority, mp, bd, schedOnly])

  const inp = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white'

  const BTNS: { v: ViewMode; icon: React.ElementType; label: string; tag?: string }[] = [
    { v: 'sector', icon: Building2,   label: 'By Sector', tag: 'primary'   },
    { v: 'people', icon: Users,        label: 'By People', tag: 'secondary' },
    { v: 'month',  icon: CalendarDays, label: 'Month'                       },
    { v: 'list',   icon: List,         label: 'List'                        },
  ]

  return (
    <div className="p-8">

      {/* Page header + view toggle */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">Publish dates, outreach windows, TIP events, and follow-ups.</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 flex-wrap shrink-0">
          {BTNS.map(({ v, icon: Icon, label, tag }) => (
            <button key={v} onClick={() => setView(v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === v ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon className="size-4" />{label}
              {tag && (
                <span className={`text-[9px] px-1 py-0.5 rounded font-bold uppercase tracking-wide ${tag === 'primary' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>{tag}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Universal filter bar ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        {/* Always-visible row: search + date range + filter toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
            <input className="border border-gray-200 rounded-lg pl-7 pr-3 py-1.5 text-xs w-52 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="Search sectors or event types…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 shrink-0">From</span>
            <input type="date" className={inp} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <span className="text-xs text-gray-400">to</span>
            <input type="date" className={inp} value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>

          {/* More filters toggle */}
          <button
            onClick={() => setFiltersOpen(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filtersOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <SlidersHorizontal className="size-3.5" />
            Filters {hasFilters && !filtersOpen ? <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> : null}
          </button>

          {hasFilters && (
            <button onClick={clearAll} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
              <X className="size-3" /> Clear all
            </button>
          )}

          <span className="ml-auto text-xs text-gray-400">
            {filteredSectors.length} sectors · {filteredEvents.length} events
          </span>
        </div>

        {/* Expanded filters */}
        {filtersOpen && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2 flex-wrap items-center">
            {/* Phase / Step */}
            <select className={inp} value={phase} onChange={e => { setPhase(e.target.value); setStepType('') }}>
              <option value="">All Phases</option>
              {PHASES.map(p => <option key={p}>{p}</option>)}
            </select>
            <select className={inp} value={stepType} onChange={e => { setStepType(e.target.value); setPhase('') }}>
              <option value="">All Steps</option>
              {STEP_LABELS.map(s => <option key={s}>{s}</option>)}
            </select>

            {/* Owner */}
            <select className={inp} value={owner} onChange={e => setOwner(e.target.value)}>
              <option value="">All Owners</option>
              {allOwners.map(o => <option key={o}>{o}</option>)}
            </select>

            {/* Sector attributes */}
            <select className={inp} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select className={inp} value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="">All Priorities</option>
              {PRIORITIES.map(p => <option key={p}>{p}</option>)}
            </select>
            <select className={inp} value={mp} onChange={e => setMp(e.target.value)}>
              <option value="">All MPs</option>
              {allMPs.map(m => <option key={m}>{m}</option>)}
            </select>
            <select className={inp} value={bd} onChange={e => setBd(e.target.value)}>
              <option value="">All BD</option>
              {allBDs.map(b => <option key={b}>{b}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={schedOnly} onChange={e => setSchedOnly(e.target.checked)} />
              Scheduled only
            </label>
          </div>
        )}

        {/* Active filter chips */}
        {hasFilters && (
          <div className="mt-2.5 flex gap-1.5 flex-wrap">
            {[
              search     && { label: `"${search}"`,         clear: () => setSearch('')     },
              phase      && { label: `Phase: ${phase}`,     clear: () => setPhase('')      },
              stepType   && { label: `Step: ${stepType}`,   clear: () => setStepType('')   },
              owner      && { label: `Owner: ${owner}`,     clear: () => setOwner('')      },
              status     && { label: `Status: ${status}`,   clear: () => setStatus('')     },
              priority   && { label: `Priority: ${priority}`,clear: () => setPriority('') },
              mp         && { label: `MP: ${mp}`,           clear: () => setMp('')         },
              bd         && { label: `BD: ${bd}`,           clear: () => setBd('')         },
              dateFrom   && { label: `From ${dateFrom}`,    clear: () => setDateFrom('')   },
              dateTo     && { label: `To ${dateTo}`,        clear: () => setDateTo('')     },
              schedOnly  && { label: 'Scheduled only',      clear: () => setSchedOnly(false) },
            ].filter(Boolean).map((chip, i) => (
              <button key={i} onClick={(chip as any).clear}
                className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[11px] font-medium hover:bg-indigo-100 transition-colors">
                {(chip as any).label} <X className="size-2.5" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Views ──────────────────────────────────────────────────────────── */}
      {view === 'sector' && <WorkflowGantt sectors={filteredSectors} />}
      {view === 'people' && <ResourceGrid  sectors={filteredSectors} />}

      {view === 'month' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <CalendarMonthView
            events={filteredEvents}
            sectors={filteredSectors}
            onSectorClick={id => router.push(`/roadmap/sectors/${id}`)}
          />
        </div>
      )}

      {view === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Date','Step','Sector','Owner','Notes'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">No events match the current filters.</td></tr>
              )}
              {filteredEvents
                .sort((a, b) => a.date.localeCompare(b.date))
                .map(e => {
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
                })
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
