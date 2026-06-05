'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useStore, fmtDate, daysFrom } from '@/lib/store'
import { ReminderStatusBadge, PriorityBadge, RoleBadge } from '@/components/roadmap/StatusBadge'
import { Modal } from '@/components/roadmap/Modal'
import type { Reminder, ReminderStatus, Priority } from '@/lib/types'

const STATUSES: ReminderStatus[] = ['Open', 'In Progress', 'Done', 'Overdue']
const PRIORITIES: Priority[] = ['High', 'Medium', 'Low']
const ROLE_GROUPS = ['BD', 'Market Research', 'Market Research Support', 'Senior Manager', 'MP']

interface ReminderFormProps {
  initial?: Partial<Reminder>
  people: { name: string }[]
  sectors: { name: string }[]
  onSave: (r: Reminder) => void
  onClose: () => void
  onDelete?: () => void
}

function ReminderForm({ initial, people, sectors, onSave, onClose, onDelete }: ReminderFormProps) {
  const [form, setForm] = useState<Partial<Reminder>>({
    status: 'Open', priority: 'Medium', roleGroup: 'BD', ...initial,
  })
  const set = (k: keyof Reminder, v: string) => setForm(f => ({ ...f, [k]: v }))
  const inp = 'border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300'

  return (
    <form onSubmit={e => { e.preventDefault(); if (form.title?.trim()) onSave(form as Reminder) }} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 col-span-2"><label className="text-xs font-semibold text-gray-600">Title *</label><input className={inp} value={form.title ?? ''} onChange={e => set('title', e.target.value)} required /></div>
        <div className="flex flex-col gap-1"><label className="text-xs font-semibold text-gray-600">Sector</label>
          <select className={inp} value={form.sector ?? ''} onChange={e => set('sector', e.target.value)}>
            <option value="">—</option>{sectors.map(s => <option key={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1"><label className="text-xs font-semibold text-gray-600">Owner</label>
          <select className={inp} value={form.owner ?? ''} onChange={e => set('owner', e.target.value)}>
            <option value="">—</option>{people.map(p => <option key={p.name}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1"><label className="text-xs font-semibold text-gray-600">Role Group</label>
          <select className={inp} value={form.roleGroup ?? 'BD'} onChange={e => set('roleGroup', e.target.value)}>
            {ROLE_GROUPS.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1"><label className="text-xs font-semibold text-gray-600">Due Date</label><input type="date" className={inp} value={form.dueDate ?? ''} onChange={e => set('dueDate', e.target.value)} /></div>
        <div className="flex flex-col gap-1"><label className="text-xs font-semibold text-gray-600">Status</label>
          <select className={inp} value={form.status ?? 'Open'} onChange={e => set('status', e.target.value as ReminderStatus)}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1"><label className="text-xs font-semibold text-gray-600">Priority</label>
          <select className={inp} value={form.priority ?? 'Medium'} onChange={e => set('priority', e.target.value as Priority)}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 col-span-2"><label className="text-xs font-semibold text-gray-600">Action Required</label><input className={inp} value={form.action ?? ''} onChange={e => set('action', e.target.value)} /></div>
        <div className="flex flex-col gap-1 col-span-2"><label className="text-xs font-semibold text-gray-600">Notes</label><textarea className={inp} rows={2} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} /></div>
      </div>
      <div className="flex items-center justify-between pt-1">
        {onDelete
          ? <button type="button" onClick={onDelete} className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"><Trash2 className="size-3.5" /> Delete</button>
          : <div />
        }
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button type="submit" className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save</button>
        </div>
      </div>
    </form>
  )
}

export default function RemindersPage() {
  const { data, addReminder, updateReminder, deleteReminder } = useStore()
  const [statusF, setStatusF]   = useState('')
  const [ownerF, setOwnerF]     = useState('')
  const [priorityF, setPriorityF] = useState('')
  const [addOpen, setAddOpen]   = useState(false)
  const [editItem, setEditItem] = useState<Reminder | null>(null)

  const owners = [...new Set(data.reminders.map(r => r.owner))].sort()

  const filtered = data.reminders
    .filter(r => {
      if (statusF && r.status !== statusF) return false
      if (ownerF && r.owner !== ownerF) return false
      if (priorityF && r.priority !== priorityF) return false
      return true
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  const handleAdd = (r: Reminder) => {
    const newId = `R${String(data.reminders.length + 1).padStart(2, '0')}`
    addReminder({ ...r, id: newId })
    setAddOpen(false)
  }

  const handleUpdate = (r: Reminder) => {
    updateReminder(r)
    setEditItem(null)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this reminder?')) return
    deleteReminder(id)
    setEditItem(null)
  }

  const inp = 'border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reminders</h1>
          <p className="text-sm text-gray-500 mt-1">Pending actions and follow-ups by owner and due date.</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
          <Plus className="size-4" /> Add Reminder
        </button>
      </div>

      {/* Reminder logic note */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-5 text-xs text-indigo-700 space-y-1">
        <div className="font-semibold text-indigo-800 mb-1">Reminder Logic</div>
        <div>• <strong>14d before publish:</strong> BD starts LinkedIn / industry group outreach</div>
        <div>• <strong>7d before publish:</strong> BD confirms connections are in motion and report send list is ready</div>
        <div>• <strong>Publish week:</strong> MR coordinates publishing, BD sends report, SM supports TIP send</div>
        <div>• <strong>After publish:</strong> BD follows up and captures intel</div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <select className={inp} value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className={inp} value={ownerF} onChange={e => setOwnerF(e.target.value)}>
          <option value="">All Owners</option>
          {owners.map(o => <option key={o}>{o}</option>)}
        </select>
        <select className={inp} value={priorityF} onChange={e => setPriorityF(e.target.value)}>
          <option value="">All Priorities</option>
          {PRIORITIES.map(p => <option key={p}>{p}</option>)}
        </select>
        <span className="self-center text-xs text-gray-400">{filtered.length} reminders</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs">Title</th>
              <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs">Sector</th>
              <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs">Owner</th>
              <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs">Role</th>
              <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs">Due Date</th>
              <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs">Status</th>
              <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs">Priority</th>
              <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs">Action</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400 text-sm">No reminders found.</td></tr>
            )}
            {filtered.map(r => {
              const overdue = r.status !== 'Done' && (daysFrom(r.dueDate) ?? 0) < 0
              return (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setEditItem(r)}>
                  <td className="px-4 py-2.5 font-medium text-gray-900 max-w-xs truncate">{r.title}</td>
                  <td className="px-4 py-2.5 text-gray-600">{r.sector}</td>
                  <td className="px-4 py-2.5 text-gray-600">{r.owner}</td>
                  <td className="px-4 py-2.5"><RoleBadge role={r.roleGroup} /></td>
                  <td className={`px-4 py-2.5 whitespace-nowrap ${overdue ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>{fmtDate(r.dueDate)}</td>
                  <td className="px-4 py-2.5"><ReminderStatusBadge status={r.status} /></td>
                  <td className="px-4 py-2.5"><PriorityBadge priority={r.priority} /></td>
                  <td className="px-4 py-2.5 text-xs text-gray-400 max-w-xs truncate">{r.action}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={e => { e.stopPropagation(); setEditItem(r) }} className="text-gray-400 hover:text-indigo-600 transition-colors">
                      <Pencil className="size-3.5" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Reminder" size="lg">
        <ReminderForm people={data.people} sectors={data.sectors} onSave={handleAdd} onClose={() => setAddOpen(false)} />
      </Modal>

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Edit Reminder" size="lg">
        {editItem && (
          <ReminderForm
            initial={editItem}
            people={data.people}
            sectors={data.sectors}
            onSave={handleUpdate}
            onClose={() => setEditItem(null)}
            onDelete={() => handleDelete(editItem.id)}
          />
        )}
      </Modal>
    </div>
  )
}
