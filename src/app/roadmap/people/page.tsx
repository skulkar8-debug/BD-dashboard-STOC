'use client'

import { useStore } from '@/lib/store'
import { RoleBadge } from '@/components/roadmap/StatusBadge'
import type { PersonRole } from '@/lib/types'

const ROLE_ORDER: PersonRole[] = ['MP', 'Senior Manager', 'BD', 'Market Research', 'Market Research Support']
const ROLE_NOTES: Record<PersonRole, string> = {
  MP:                        'Strategic / follow-on only. Involved after publication if needed.',
  'Senior Manager':          'Reminder-only connection support. Not full workstream owners.',
  BD:                        'LinkedIn outreach, report send, follow-up, intel capture.',
  'Market Research':         'Report production, data tracking, publishing coordination, Data + TIP Sync.',
  'Market Research Support': 'Supports Market Research on data and research tasks.',
}

const AVATAR_COLORS: Record<PersonRole, string> = {
  MP:                        'bg-purple-100 text-purple-700',
  'Senior Manager':          'bg-teal-100 text-teal-700',
  BD:                        'bg-blue-100 text-blue-700',
  'Market Research':         'bg-orange-100 text-orange-700',
  'Market Research Support': 'bg-yellow-100 text-yellow-700',
}

export default function PeoplePage() {
  const { data } = useStore()

  const grouped = ROLE_ORDER.reduce((acc, role) => {
    acc[role] = data.people.filter(p => p.role === role)
    return acc
  }, {} as Record<PersonRole, typeof data.people>)

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">People</h1>
        <p className="text-sm text-gray-500 mt-1">Team members, roles, and sector assignments.</p>
      </div>

      <div className="space-y-8">
        {ROLE_ORDER.map(role => {
          const members = grouped[role]
          if (members.length === 0) return null
          return (
            <div key={role}>
              <div className="flex items-center gap-3 mb-3">
                <RoleBadge role={role} />
                <span className="text-xs text-gray-400">{ROLE_NOTES[role]}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {members.map(p => (
                  <div key={p.name} className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-bold shrink-0 ${AVATAR_COLORS[p.role]}`}>
                        {p.name[0]}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{p.name}</div>
                        <div className="text-xs text-gray-400">{p.email}</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mb-1">
                      <span className="font-semibold text-gray-600">Sectors: </span>{p.sectors}
                    </div>
                    <div className="text-xs text-gray-400">{p.notes}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
