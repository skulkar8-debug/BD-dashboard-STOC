'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, ExternalLink, Check, X, ChevronDown } from 'lucide-react'
import { useStore, fmtDate } from '@/lib/store'
import { StatusBadge, PriorityBadge } from '@/components/roadmap/StatusBadge'
import { Modal } from '@/components/roadmap/Modal'
import type { Sector, SectorStatus, Priority } from '@/lib/types'

const STATUSES: SectorStatus[] = ['Planning', 'In Progress', 'Published', 'Completed']
const PRIORITIES: Priority[]   = ['High', 'Medium', 'Low']

// ── Inline cell editors ────────────────────────────────────────────────────────

function InlineSelect<T extends string>({
  value, options, onSave, onCancel, renderOption,
}: {
  value: T
  options: T[]
  onSave: (v: T) => void
  onCancel: () => void
  renderOption?: (v: T) => React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1">
      <select
        autoFocus
        className="border border-indigo-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
        defaultValue={value}
        onClick={e => e.stopPropagation()}
        onChange={e => { onSave(e.target.value as T); }}
        onBlur={onCancel}
        onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function InlineDateInput({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <input
        ref={ref}
        type="date"
        defaultValue={value}
        className="border border-indigo-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 w-32"
        onKeyDown={e => {
          if (e.key === 'Enter') onSave((e.target as HTMLInputElement).value)
          if (e.key === 'Escape') onCancel()
        }}
        onBlur={e => onSave(e.target.value)}
      />
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
type EditCell = { id: string; field: 'status' | 'priority' | 'publishDate' | 'mp' | 'bd' | 'sm' }

export default function SectorsPage() {
  const { data, addSector, updateSector } = useStore()
  const router = useRouter()

  // Filters
  const [search,    setSearch]    = useState('')
  const [statusF,   setStatusF]   = useState('')
  const [priorityF, setPriorityF] = useState('')
  const [mpF,       setMpF]       = useState('')
  const [bdF,       setBdF]       = useState('')

  // Inline editing
  const [editing, setEditing] = useState<EditCell | null>(null)

  // Add modal
  const [addOpen, setAddOpen] = useState(false)
  const [newSector, setNewSector] = useState<Partial<Sector>>({
    status: 'Planning', priority: 'Medium', outreachStatus: 'Not Started',
    mr: 'Srushti', mrSupport: 'Sharvan',
  })

  const mps = [...new Set(data.people.filter(p => p.role === 'MP').map(p => p.name))]
  const bds = [...new Set(data.people.filter(p => p.role === 'BD').map(p => p.name))]
  const sms = [...new Set(data.people.filter(p => p.role === 'Senior Manager').map(p => p.name))]

  const allMPs = [...new Set(data.sectors.map(s => s.mp).filter(Boolean))].sort()
  const allBDs = [...new Set(data.sectors.map(s => s.bd).filter(Boolean))].sort()

  const filtered = data.sectors
    .filter(s => {
      if (search    && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.id.toLowerCase().includes(search.toLowerCase())) return false
      if (statusF   && s.status   !== statusF)   return false
      if (priorityF && s.priority !== priorityF) return false
      if (mpF       && s.mp       !== mpF)       return false
      if (bdF       && s.bd       !== bdF)       return false
      return true
    })
    .sort((a, b) => {
      // Sectors with publish dates first, sorted by date ascending
      // Sectors without publish dates last, sorted by sector ID
      if (a.publishDate && b.publishDate) return a.publishDate.localeCompare(b.publishDate)
      if (a.publishDate && !b.publishDate) return -1
      if (!a.publishDate && b.publishDate) return 1
      return a.id.localeCompare(b.id)
    })

  const saveField = (id: string, field: keyof Sector, value: string) => {
    const s = data.sectors.find(x => x.id === id)
    if (!s) return
    updateSector({ ...s, [field]: value })
    setEditing(null)
  }

  const isEditing = (id: string, field: string) => editing?.id === id && editing?.field === field

  const startEdit = (e: React.MouseEvent, id: string, field: EditCell['field']) => {
    e.stopPropagation()
    setEditing({ id, field })
  }

  const handleAddSector = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSector.name?.trim()) return
    const newId = `S${String(data.sectors.length + 1).padStart(3, '0')}`
    addSector({ ...newSector, id: newId, mr: 'Srushti', mrSupport: 'Sharvan', reportLink: '', tipLink: '', dataLink: '' } as Sector)
    setAddOpen(false)
    setNewSector({ status: 'Planning', priority: 'Medium', outreachStatus: 'Not Started', mr: 'Srushti', mrSupport: 'Sharvan' })
  }

  const inp  = 'border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'
  const finp = 'border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300'
  const lbl  = 'text-xs font-semibold text-gray-600'
  const row  = 'flex flex-col gap-1'

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sectors</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} of {data.sectors.length} sectors · Click a cell to edit inline, or row to view detail
          </p>
        </div>
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
          <Plus className="size-4" /> Add Sector
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <input
          className={`${inp} w-48`}
          placeholder="Search name or ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className={`${inp} w-38`} value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className={`${inp} w-36`} value={priorityF} onChange={e => setPriorityF(e.target.value)}>
          <option value="">All Priorities</option>
          {PRIORITIES.map(p => <option key={p}>{p}</option>)}
        </select>
        <select className={`${inp} w-28`} value={mpF} onChange={e => setMpF(e.target.value)}>
          <option value="">All MPs</option>
          {allMPs.map(m => <option key={m}>{m}</option>)}
        </select>
        <select className={`${inp} w-32`} value={bdF} onChange={e => setBdF(e.target.value)}>
          <option value="">All BD Owners</option>
          {allBDs.map(b => <option key={b}>{b}</option>)}
        </select>
        {(search || statusF || priorityF || mpF || bdF) && (
          <button
            onClick={() => { setSearch(''); setStatusF(''); setPriorityF(''); setMpF(''); setBdF('') }}
            className="text-xs text-indigo-600 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="text-[10px] text-gray-400 mb-2 ml-1">
        💡 <strong>Tip:</strong> Click Status, Priority, Publish Date, MP, BD, or SM cells to edit inline.
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs">ID</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs">Sector</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs cursor-pointer select-none">
                Status <span className="text-indigo-400">✎</span>
              </th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs">
                Priority <span className="text-indigo-400">✎</span>
              </th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs">
                Publish Date <span className="text-indigo-400">✎</span>
              </th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs">
                MP <span className="text-indigo-400">✎</span>
              </th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs">
                BD <span className="text-indigo-400">✎</span>
              </th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs">
                SM <span className="text-indigo-400">✎</span>
              </th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs">MR</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs">Links</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-sm">No sectors found.</td></tr>
            )}
            {filtered.map(s => (
              <tr
                key={s.id}
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => { if (!editing) router.push(`/roadmap/sectors/${s.id}`) }}
              >
                <td className="px-3 py-2 text-xs text-gray-400 font-semibold">{s.id}</td>
                <td className="px-3 py-2 font-semibold text-gray-900 whitespace-nowrap max-w-[180px]">
                  <span className="truncate block">{s.name}</span>
                </td>

                {/* Status — inline edit */}
                <td className="px-3 py-2" onClick={e => startEdit(e, s.id, 'status')}>
                  {isEditing(s.id, 'status')
                    ? <InlineSelect
                        value={s.status} options={STATUSES}
                        onSave={v => saveField(s.id, 'status', v)}
                        onCancel={() => setEditing(null)}
                      />
                    : <div className="group flex items-center gap-1">
                        <StatusBadge status={s.status} />
                        <ChevronDown className="size-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                  }
                </td>

                {/* Priority — inline edit */}
                <td className="px-3 py-2" onClick={e => startEdit(e, s.id, 'priority')}>
                  {isEditing(s.id, 'priority')
                    ? <InlineSelect
                        value={s.priority} options={PRIORITIES}
                        onSave={v => saveField(s.id, 'priority', v)}
                        onCancel={() => setEditing(null)}
                      />
                    : <div className="group flex items-center gap-1">
                        <PriorityBadge priority={s.priority} />
                        <ChevronDown className="size-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                  }
                </td>

                {/* Publish Date — inline edit */}
                <td className="px-3 py-2 whitespace-nowrap" onClick={e => startEdit(e, s.id, 'publishDate')}>
                  {isEditing(s.id, 'publishDate')
                    ? <InlineDateInput
                        value={s.publishDate}
                        onSave={v => saveField(s.id, 'publishDate', v)}
                        onCancel={() => setEditing(null)}
                      />
                    : <span className={`text-sm group flex items-center gap-1 ${s.publishDate ? 'text-gray-700' : 'text-gray-300 italic'}`}>
                        {s.publishDate ? fmtDate(s.publishDate) : 'No date'}
                        <ChevronDown className="size-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                  }
                </td>

                {/* MP — inline edit */}
                <td className="px-3 py-2" onClick={e => startEdit(e, s.id, 'mp')}>
                  {isEditing(s.id, 'mp')
                    ? <InlineSelect
                        value={s.mp} options={mps}
                        onSave={v => saveField(s.id, 'mp', v)}
                        onCancel={() => setEditing(null)}
                      />
                    : <span className="group flex items-center gap-1 text-gray-700">
                        {s.mp}
                        <ChevronDown className="size-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                  }
                </td>

                {/* BD — inline edit */}
                <td className="px-3 py-2" onClick={e => startEdit(e, s.id, 'bd')}>
                  {isEditing(s.id, 'bd')
                    ? <InlineSelect
                        value={s.bd} options={bds}
                        onSave={v => saveField(s.id, 'bd', v)}
                        onCancel={() => setEditing(null)}
                      />
                    : <span className="group flex items-center gap-1 text-gray-700">
                        {s.bd}
                        <ChevronDown className="size-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                  }
                </td>

                {/* SM — inline edit */}
                <td className="px-3 py-2" onClick={e => startEdit(e, s.id, 'sm')}>
                  {isEditing(s.id, 'sm')
                    ? <InlineSelect
                        value={s.sm} options={sms}
                        onSave={v => saveField(s.id, 'sm', v)}
                        onCancel={() => setEditing(null)}
                      />
                    : <span className="group flex items-center gap-1 text-gray-700">
                        {s.sm || <span className="text-gray-300 italic text-xs">—</span>}
                        <ChevronDown className="size-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                  }
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs">{s.mr}</td>

                {/* Links */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {s.reportLink
                      ? <a href={s.reportLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-0.5">RPT<ExternalLink className="size-2.5" /></a>
                      : <span className="text-[10px] text-gray-300">RPT</span>
                    }
                    {s.tipLink
                      ? <a href={s.tipLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-0.5">TIP<ExternalLink className="size-2.5" /></a>
                      : <span className="text-[10px] text-gray-300">TIP</span>
                    }
                    {s.dataLink
                      ? <a href={s.dataLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-0.5">DATA<ExternalLink className="size-2.5" /></a>
                      : <span className="text-[10px] text-gray-300">DATA</span>
                    }
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Sector Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Sector" size="lg">
        <form onSubmit={handleAddSector} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className={`${row} col-span-2`}><label className={lbl}>Sector Name *</label>
              <input className={finp} value={newSector.name ?? ''} onChange={e => setNewSector(f => ({...f, name: e.target.value}))} required />
            </div>
            <div className={row}><label className={lbl}>Status</label>
              <select className={finp} value={newSector.status} onChange={e => setNewSector(f => ({...f, status: e.target.value as SectorStatus}))}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className={row}><label className={lbl}>Priority</label>
              <select className={finp} value={newSector.priority} onChange={e => setNewSector(f => ({...f, priority: e.target.value as Priority}))}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className={row}><label className={lbl}>Publish Date</label>
              <input type="date" className={finp} value={newSector.publishDate ?? ''} onChange={e => setNewSector(f => ({...f, publishDate: e.target.value}))} />
            </div>
            <div className={row}><label className={lbl}>Outreach Status</label>
              <select className={finp} value={newSector.outreachStatus ?? 'Not Started'} onChange={e => setNewSector(f => ({...f, outreachStatus: e.target.value}))}>
                {['Not Started','In Progress','Completed'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className={row}><label className={lbl}>MP</label>
              <select className={finp} value={newSector.mp ?? ''} onChange={e => setNewSector(f => ({...f, mp: e.target.value}))}>
                <option value="">Select…</option>{mps.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className={row}><label className={lbl}>BD Owner</label>
              <select className={finp} value={newSector.bd ?? ''} onChange={e => setNewSector(f => ({...f, bd: e.target.value}))}>
                <option value="">Select…</option>{bds.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div className={row}><label className={lbl}>Senior Manager</label>
              <select className={finp} value={newSector.sm ?? ''} onChange={e => setNewSector(f => ({...f, sm: e.target.value}))}>
                <option value="">Select…</option>{sms.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className={row}><label className={lbl}>Market Research</label>
              <input className={finp} value={newSector.mr ?? 'Srushti'} onChange={e => setNewSector(f => ({...f, mr: e.target.value}))} />
            </div>
            <div className={`${row} col-span-2`}><label className={lbl}>Notes</label>
              <textarea className={finp} rows={2} value={newSector.notes ?? ''} onChange={e => setNewSector(f => ({...f, notes: e.target.value}))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Add Sector</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
