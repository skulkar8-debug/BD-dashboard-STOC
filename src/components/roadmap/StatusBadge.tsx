'use client'

import { cn } from '@/lib/utils'
import type { SectorStatus, Priority, ReminderStatus, TipStatus, PersonRole, DataReady } from '@/lib/types'

interface ChipProps { label: string; className: string }
function Chip({ label, className }: ChipProps) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap', className)}>
      {label}
    </span>
  )
}

export function StatusBadge({ status }: { status: SectorStatus }) {
  const cls: Record<SectorStatus, string> = {
    Planning:      'bg-gray-100 text-gray-700',
    'In Progress': 'bg-blue-100 text-blue-800',
    Published:     'bg-green-100 text-green-800',
    Completed:     'bg-purple-100 text-purple-800',
  }
  return <Chip label={status} className={cls[status]} />
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const cls: Record<Priority, string> = {
    High:   'bg-red-100 text-red-800',
    Medium: 'bg-yellow-100 text-yellow-800',
    Low:    'bg-gray-100 text-gray-700',
  }
  return <Chip label={priority} className={cls[priority]} />
}

export function ReminderStatusBadge({ status }: { status: ReminderStatus }) {
  const cls: Record<ReminderStatus, string> = {
    Open:          'bg-yellow-100 text-yellow-800',
    'In Progress': 'bg-blue-100 text-blue-800',
    Done:          'bg-green-100 text-green-800',
    Overdue:       'bg-red-100 text-red-800',
  }
  return <Chip label={status} className={cls[status]} />
}

export function TipStatusBadge({ status }: { status: TipStatus }) {
  const cls: Record<TipStatus, string> = {
    'Not Started': 'bg-gray-100 text-gray-700',
    'In Progress': 'bg-blue-100 text-blue-800',
    Created:       'bg-teal-100 text-teal-800',
    Sent:          'bg-green-100 text-green-800',
  }
  return <Chip label={status} className={cls[status]} />
}

export function RoleBadge({ role }: { role: PersonRole | string }) {
  const cls: Record<string, string> = {
    MP:                        'bg-purple-100 text-purple-800',
    BD:                        'bg-blue-100 text-blue-800',
    'Senior Manager':          'bg-teal-100 text-teal-800',
    'Market Research':         'bg-orange-100 text-orange-800',
    'Market Research Support': 'bg-yellow-100 text-yellow-800',
  }
  return <Chip label={role} className={cls[role] ?? 'bg-gray-100 text-gray-700'} />
}

export function DataReadyBadge({ value }: { value: DataReady }) {
  const cls: Record<DataReady, string> = {
    Yes:     'bg-green-100 text-green-800',
    Partial: 'bg-yellow-100 text-yellow-800',
    No:      'bg-red-100 text-red-800',
  }
  return <Chip label={value} className={cls[value]} />
}

export function EventTypeBadge({ type }: { type: string }) {
  // Colors derived directly from WORKFLOW_EVENTS so they never go stale
  const { WORKFLOW_EVENTS: WF } = require('@/lib/workflowEvents')
  const ev = (WF as { label: string; bg: string; border: string; text: string }[]).find(e => e.label === type)
  if (ev) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
        style={{ background: ev.bg, borderColor: ev.border, color: ev.text }}>
        {type}
      </span>
    )
  }
  return <Chip label={type} className="bg-gray-100 text-gray-700" />
}
