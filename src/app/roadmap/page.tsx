'use client'

import Link from 'next/link'
import { useStore, daysFrom, fmtDate } from '@/lib/store'
import { StatusBadge, PriorityBadge, ReminderStatusBadge } from '@/components/roadmap/StatusBadge'
import { RoleBadge } from '@/components/roadmap/StatusBadge'

const STAT_COLORS: Record<string, string> = {
  indigo: 'border-l-indigo-500 text-indigo-600',
  blue:   'border-l-blue-500 text-blue-600',
  yellow: 'border-l-yellow-500 text-yellow-600',
  red:    'border-l-red-500 text-red-600',
  green:  'border-l-green-500 text-green-600',
  purple: 'border-l-purple-500 text-purple-600',
}

interface StatCardProps {
  label: string
  value: number
  color: keyof typeof STAT_COLORS
}
function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 p-4 ${STAT_COLORS[color]}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  )
}

export default function DashboardPage() {
  const { data } = useStore()
  const { sectors, reminders, dataTip } = data

  const activeSectors   = sectors.filter(s => s.status === 'In Progress').length
  const publishingSoon  = sectors.filter(s => { const d = daysFrom(s.publishDate); return d !== null && d >= 0 && d <= 14 })
  const tipsDueSoon     = dataTip.filter(t => {
    const sec = sectors.find(s => s.name === t.sector)
    if (!sec) return false
    const d = daysFrom(sec.publishDate)
    return d !== null && d >= 0 && d <= 21 && t.tipStatus !== 'Sent'
  })
  const openReminders   = reminders.filter(r => r.status === 'Open' || r.status === 'In Progress')
  const overdueReminders= reminders.filter(r => r.status === 'Overdue' || (r.status !== 'Done' && (daysFrom(r.dueDate) ?? 0) < 0))
  const missingReport   = sectors.filter(s => !s.reportLink && (s.status === 'In Progress' || s.status === 'Published')).length
  const missingTip      = sectors.filter(s => !s.tipLink && s.status !== 'Planning' && s.status !== 'Completed').length
  const missingData     = sectors.filter(s => !s.dataLink && s.status !== 'Completed').length

  // Owner workload
  const workload: Record<string, number> = {}
  reminders.filter(r => r.status !== 'Done').forEach(r => {
    workload[r.owner] = (workload[r.owner] ?? 0) + 1
  })
  const workloadSorted = Object.entries(workload).sort((a, b) => b[1] - a[1])
  const maxLoad = workloadSorted[0]?.[1] ?? 1

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of all sectors, tasks, and upcoming deadlines.</p>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        <StatCard label="Total Sectors"         value={sectors.length}           color="indigo" />
        <StatCard label="Active (In Progress)"  value={activeSectors}            color="blue"   />
        <StatCard label="Publishing ≤14d"       value={publishingSoon.length}    color="yellow" />
        <StatCard label="TIPs Due ≤21d"         value={tipsDueSoon.length}       color="yellow" />
        <StatCard label="Open Reminders"        value={openReminders.length}     color="green"  />
        <StatCard label="Overdue Reminders"     value={overdueReminders.length}  color="red"    />
        <StatCard label="Missing Report Links"  value={missingReport}            color="red"    />
        <StatCard label="Missing TIP Links"     value={missingTip}               color="yellow" />
        <StatCard label="Missing Data Links"    value={missingData}              color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Publishing soon */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Publishing Soon (≤14 days)</div>
          {publishingSoon.length === 0
            ? <p className="text-sm text-gray-400">No reports publishing in the next 14 days.</p>
            : publishingSoon.map(s => (
              <Link key={s.id} href={`/roadmap/sectors/${s.id}`} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded px-1 -mx-1">
                <span className="text-sm font-medium text-indigo-600">{s.name}</span>
                <span className="text-xs text-gray-500">{fmtDate(s.publishDate)}</span>
              </Link>
            ))
          }
        </div>

        {/* TIPs due soon */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">TIPs Due Soon (≤21 days)</div>
          {tipsDueSoon.length === 0
            ? <p className="text-sm text-gray-400">No TIPs due in the next 21 days.</p>
            : tipsDueSoon.map(t => {
              const sec = sectors.find(s => s.name === t.sector)
              return (
                <Link key={t.sector} href={sec ? `/roadmap/sectors/${sec.id}` : '/roadmap/data-tip'} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded px-1 -mx-1">
                  <span className="text-sm font-medium text-gray-800">{t.sector}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${t.tipStatus === 'Not Started' ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-800'}`}>{t.tipStatus}</span>
                </Link>
              )
            })
          }
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Overdue reminders */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Overdue Reminders</div>
          {overdueReminders.length === 0
            ? <p className="text-sm text-gray-400">No overdue reminders.</p>
            : overdueReminders.slice(0, 6).map(r => (
              <Link key={r.id} href="/roadmap/reminders" className="block py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded px-1 -mx-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-800 truncate">{r.title}</span>
                  <PriorityBadge priority={r.priority} />
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{r.owner} · Due {fmtDate(r.dueDate)}</div>
              </Link>
            ))
          }
        </div>

        {/* Owner workload */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Owner Workload (open reminders)</div>
          {workloadSorted.length === 0
            ? <p className="text-sm text-gray-400">No open reminders.</p>
            : workloadSorted.map(([owner, count]) => (
              <div key={owner} className="flex items-center gap-3 py-1.5">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                  {owner[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800">{owner}</div>
                  <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${(count / maxLoad) * 100}%` }} />
                  </div>
                </div>
                <span className="text-xs font-semibold text-gray-600 w-4 text-right">{count}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}
