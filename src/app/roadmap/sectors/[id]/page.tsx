'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, AlertTriangle } from 'lucide-react'
import { useStore, daysFrom, fmtDate } from '@/lib/store'
import { StatusBadge, PriorityBadge, ReminderStatusBadge, TipStatusBadge, DataReadyBadge, EventTypeBadge } from '@/components/roadmap/StatusBadge'
import { Modal } from '@/components/roadmap/Modal'
import type { Sector, SectorStatus, Priority } from '@/lib/types'

const STATUSES: SectorStatus[] = ['Planning', 'In Progress', 'Published', 'Completed']
const PRIORITIES: Priority[] = ['High', 'Medium', 'Low']

function LinkOrMissing({ url, label }: { url: string; label: string }) {
  if (!url) return (
    <span className="flex items-center gap-1 text-red-500 text-xs font-medium">
      <AlertTriangle className="size-3" /> Missing
    </span>
  )
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-indigo-600 text-sm hover:underline">
      {label} <ExternalLink className="size-3" />
    </a>
  )
}

export default function SectorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data, updateSector } = useStore()
  const [editOpen, setEditOpen] = useState(false)

  const sector = data.sectors.find(s => s.id === id)

  if (!sector) {
    return (
      <div className="p-8">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="size-4" /> Back
        </button>
        <p className="text-gray-500">Sector not found.</p>
      </div>
    )
  }

  const tipData = data.dataTip.find(t => t.sector === sector.name)
  const relCal  = data.calendar.filter(e => e.sector === sector.name).sort((a, b) => a.date.localeCompare(b.date))
  const relRem  = data.reminders.filter(r => r.sector === sector.name).sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  const daysLeft = daysFrom(sector.publishDate)
  const daysStr  = daysLeft === null ? '—' : daysLeft < 0 ? `${Math.abs(daysLeft)}d ago` : daysLeft === 0 ? 'Today' : `In ${daysLeft}d`

  const handleSave = (updated: Sector) => {
    updateSector(updated)
    setEditOpen(false)
  }

  const inp = 'border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300'
  const row = 'flex flex-col gap-1'
  const lbl = 'text-xs font-semibold text-gray-600'

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="size-4" /> Back to Sectors
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{sector.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <StatusBadge status={sector.status} />
            <PriorityBadge priority={sector.priority} />
            <span className="text-xs text-gray-500">{sector.id}</span>
          </div>
        </div>
        <button onClick={() => setEditOpen(true)} className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          Edit Sector
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Overview */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Overview</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-xs text-gray-400 block">Publish Date</span><span className="font-medium">{fmtDate(sector.publishDate)}</span> <span className="text-xs text-gray-400">({daysStr})</span></div>
            <div><span className="text-xs text-gray-400 block">Outreach Status</span><span className="font-medium">{sector.outreachStatus}</span></div>
          </div>
          {sector.notes && (
            <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs text-gray-600">{sector.notes}</div>
          )}
        </div>

        {/* Owners */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Owners</div>
          <div className="space-y-2 text-sm">
            {[
              { label: 'MP', value: sector.mp, note: 'Strategic / follow-on only' },
              { label: 'BD', value: sector.bd, note: 'Outreach, send, follow-up, intel' },
              { label: 'Senior Manager', value: sector.sm, note: 'Reminder-only connection support' },
              { label: 'Market Research', value: sector.mr, note: 'Report, data, publishing, TIP' },
              { label: 'MR Support', value: sector.mrSupport, note: 'Data / research support' },
            ].map(({ label, value, note }) => (
              <div key={label} className="flex items-start justify-between gap-2">
                <span className="text-xs text-gray-400 w-36 shrink-0">{label}</span>
                <div className="text-right">
                  <span className="font-medium text-gray-900">{value}</span>
                  <span className="block text-[10px] text-gray-400">{note}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Report */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Report</div>
          <LinkOrMissing url={sector.reportLink} label="View Report" />
        </div>

        {/* TIP */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">TIP</div>
          {tipData && <div className="mb-2"><TipStatusBadge status={tipData.tipStatus} /></div>}
          <LinkOrMissing url={tipData?.tipLink ?? ''} label="View TIP" />
          {tipData?.tipCreated && <div className="mt-2 text-xs text-gray-400">Created: {fmtDate(tipData.tipCreated)}</div>}
          {tipData?.tipSent    && <div className="text-xs text-gray-400">Sent: {fmtDate(tipData.tipSent)}</div>}
        </div>

        {/* Data */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Data / Source</div>
          {tipData && (
            <>
              <div className="text-xs text-gray-500 mb-2">{tipData.sourceDataLocation || '—'}</div>
              <div className="space-y-1">
                <LinkOrMissing url={tipData.sourceLink} label="Source" />
                {tipData.clayLink    && <a href={tipData.clayLink}   target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-indigo-600 text-sm hover:underline">Clay export <ExternalLink className="size-3" /></a>}
                {tipData.gsheetLink  && <a href={tipData.gsheetLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-indigo-600 text-sm hover:underline">GSheet <ExternalLink className="size-3" /></a>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <DataReadyBadge value={tipData.dataReady} />
                <span className="text-[10px] text-gray-500">In Report: {tipData.inReport ? '✓' : '—'}</span>
                <span className="text-[10px] text-gray-500">In TIP: {tipData.inTip ? '✓' : '—'}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Calendar events */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Related Calendar Events</div>
          {relCal.length === 0
            ? <p className="text-sm text-gray-400">No calendar events.</p>
            : relCal.map(e => (
              <div key={e.id} className="flex items-start justify-between gap-2 py-2 border-b border-gray-50 last:border-0">
                <div>
                  <EventTypeBadge type={e.type} />
                  <div className="text-xs text-gray-400 mt-0.5">{e.owner} · {e.notes}</div>
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">{fmtDate(e.date)}</span>
              </div>
            ))
          }
        </div>

        {/* Reminders */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Related Reminders</div>
          {relRem.length === 0
            ? <p className="text-sm text-gray-400">No reminders.</p>
            : relRem.map(r => (
              <div key={r.id} className="py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-800 truncate">{r.title}</span>
                  <ReminderStatusBadge status={r.status} />
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{r.owner} · Due {fmtDate(r.dueDate)}</div>
              </div>
            ))
          }
        </div>
      </div>

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Edit ${sector.name}`} size="lg">
        <form onSubmit={e => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          handleSave({
            ...sector,
            name:           fd.get('name') as string,
            status:         fd.get('status') as SectorStatus,
            priority:       fd.get('priority') as Priority,
            publishDate:    fd.get('publishDate') as string,
            mp:             fd.get('mp') as string,
            bd:             fd.get('bd') as string,
            sm:             fd.get('sm') as string,
            outreachStatus: fd.get('outreachStatus') as string,
            reportLink:     fd.get('reportLink') as string,
            tipLink:        fd.get('tipLink') as string,
            dataLink:       fd.get('dataLink') as string,
            notes:          fd.get('notes') as string,
          })
        }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className={`${row} col-span-2`}><label className={lbl}>Sector Name</label><input name="name" className={inp} defaultValue={sector.name} /></div>
            <div className={row}><label className={lbl}>Status</label><select name="status" className={inp} defaultValue={sector.status}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
            <div className={row}><label className={lbl}>Priority</label><select name="priority" className={inp} defaultValue={sector.priority}>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</select></div>
            <div className={row}><label className={lbl}>Publish Date</label><input type="date" name="publishDate" className={inp} defaultValue={sector.publishDate} /></div>
            <div className={row}><label className={lbl}>Outreach Status</label><select name="outreachStatus" className={inp} defaultValue={sector.outreachStatus}>{['Not Started','In Progress','Completed'].map(s=><option key={s}>{s}</option>)}</select></div>
            <div className={row}><label className={lbl}>MP</label><select name="mp" className={inp} defaultValue={sector.mp}>{data.people.filter(p=>p.role==='MP').map(p=><option key={p.name}>{p.name}</option>)}</select></div>
            <div className={row}><label className={lbl}>BD</label><select name="bd" className={inp} defaultValue={sector.bd}>{data.people.filter(p=>p.role==='BD').map(p=><option key={p.name}>{p.name}</option>)}</select></div>
            <div className={row}><label className={lbl}>Senior Manager</label><select name="sm" className={inp} defaultValue={sector.sm}>{data.people.filter(p=>p.role==='Senior Manager').map(p=><option key={p.name}>{p.name}</option>)}</select></div>
            <div className={`${row} col-span-2`}><label className={lbl}>Report Link</label><input name="reportLink" className={inp} placeholder="https://…" defaultValue={sector.reportLink} /></div>
            <div className={`${row} col-span-2`}><label className={lbl}>TIP Link</label><input name="tipLink" className={inp} placeholder="https://…" defaultValue={sector.tipLink} /></div>
            <div className={`${row} col-span-2`}><label className={lbl}>Data/Source Link</label><input name="dataLink" className={inp} placeholder="https://…" defaultValue={sector.dataLink} /></div>
            <div className={`${row} col-span-2`}><label className={lbl}>Notes</label><textarea name="notes" className={inp} rows={2} defaultValue={sector.notes} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setEditOpen(false)} className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save Changes</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
