import { Sidebar } from '@/components/roadmap/Sidebar'

export const metadata = {
  title: 'STOC | Sector Roadmap',
  description: 'Internal sector roadmap, calendar, reminders, and Data + TIP tracker',
}

export default function RoadmapLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        {/* Prototype banner */}
        <div className="sticky top-0 z-40 bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs font-medium text-amber-800">
          ⚠️ Prototype Mode — Live Google Sheet sync not connected yet.
        </div>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
