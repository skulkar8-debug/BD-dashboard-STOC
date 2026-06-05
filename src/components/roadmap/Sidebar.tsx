'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Building2,
  CalendarDays,
  Bell,
  Link2,
  Users,
  Settings,
} from 'lucide-react'

const NAV = [
  { href: '/roadmap',           label: 'Dashboard',       icon: LayoutDashboard, group: 'main' },
  { href: '/roadmap/sectors',   label: 'Sectors',         icon: Building2,       group: 'main' },
  { href: '/roadmap/calendar',  label: 'Calendar',        icon: CalendarDays,    group: 'main' },
  { href: '/roadmap/reminders', label: 'Reminders',       icon: Bell,            group: 'main' },
  { href: '/roadmap/data-tip',  label: 'Data + TIP Sync', icon: Link2,           group: 'main' },
  { href: '/roadmap/people',    label: 'People',          icon: Users,           group: 'admin' },
  { href: '/roadmap/settings',  label: 'Settings',        icon: Settings,        group: 'admin' },
]

export function Sidebar() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/roadmap') return pathname === '/roadmap'
    return pathname.startsWith(href)
  }

  return (
    <aside className="flex flex-col w-[220px] min-w-[220px] bg-white border-r border-gray-200 h-screen sticky top-0 overflow-y-auto">
      <div className="px-4 pt-5 pb-3">
        <div className="text-[15px] font-bold text-indigo-600">Sector Roadmap</div>
        <div className="text-[11px] text-gray-400 mt-0.5">Internal Prototype</div>
      </div>

      <nav className="flex-1 px-2 pb-4 space-y-0.5">
        <div className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Main</div>
        {NAV.filter(n => n.group === 'main').map(item => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}

        <div className="px-2 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Admin</div>
        {NAV.filter(n => n.group === 'admin').map(item => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
