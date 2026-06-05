'use client'

import { useStore } from '@/lib/store'
import { Download, RotateCcw, Database, Info } from 'lucide-react'

const TAB_SUMMARY = [
  { tab: 'Sectors',          cols: 15, rows: 10, maps: 'Sectors page + Sector Detail' },
  { tab: 'Calendar',         cols: 5,  rows: 27, maps: 'Calendar page' },
  { tab: 'Reminders',        cols: 10, rows: 25, maps: 'Reminders page + Dashboard stats' },
  { tab: 'Data + TIP Sync',  cols: 13, rows: 10, maps: 'Data+TIP page + Sector Detail' },
  { tab: 'People',           cols: 5,  rows: 10, maps: 'People page + owner dropdowns' },
  { tab: 'Settings',         cols: 3,  rows: 1,  maps: 'Settings page (app config)' },
]

const REF_TABS = [
  { tab: 'Original Sector Details', note: 'Reference only — not in main app workflow' },
  { tab: 'Workflow Template (Optional)', note: 'Optional reference checklist' },
  { tab: 'Workflow Log (Optional)', note: 'Optional workflow tracking log' },
]

export default function SettingsPage() {
  const { data, resetToSeed, exportJson } = useStore()

  const handleReset = () => {
    if (!confirm('Reset all data to seed? This will clear any edits you\'ve made.')) return
    resetToSeed()
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">App configuration and data management.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Data management */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <Database className="size-4 text-indigo-500" />
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Data Management</div>
          </div>
          <p className="text-xs text-gray-500 mb-4">All data is stored in localStorage. Export a snapshot or reset to the original seed data.</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportJson}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="size-3.5" /> Export JSON
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <RotateCcw className="size-3.5" /> Reset to Seed Data
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Sectors',   val: data.sectors.length },
              { label: 'Reminders', val: data.reminders.length },
              { label: 'People',    val: data.people.length },
            ].map(({ label, val }) => (
              <div key={label} className="bg-gray-50 rounded-lg py-2">
                <div className="text-xl font-bold text-indigo-600">{val}</div>
                <div className="text-[10px] text-gray-400">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* App info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info className="size-4 text-indigo-500" />
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Prototype Info</div>
          </div>
          <div className="space-y-2 text-sm">
            {[
              { k: 'Version',          v: '1.0 Prototype' },
              { k: 'Storage',          v: 'localStorage' },
              { k: 'Data source',      v: 'Simplified workbook seed data' },
              { k: 'Google Sheet sync', v: '⚠️ Not connected' },
              { k: 'Framework',        v: 'Next.js 16 + Tailwind v4' },
            ].map(({ k, v }) => (
              <div key={k} className="flex items-start gap-2">
                <span className="text-xs text-gray-400 w-36 shrink-0">{k}</span>
                <span className="font-medium text-gray-800">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Workbook summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Workbook Tab Summary (Core Tabs)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Tab</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600">Columns</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600">Rows (seed)</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Maps to App Page</th>
              </tr>
            </thead>
            <tbody>
              {TAB_SUMMARY.map(r => (
                <tr key={r.tab} className="border-b border-gray-100">
                  <td className="px-3 py-2 font-medium text-gray-800">{r.tab}</td>
                  <td className="px-3 py-2 text-center text-gray-500">{r.cols}</td>
                  <td className="px-3 py-2 text-center text-gray-500">{r.rows}</td>
                  <td className="px-3 py-2 text-gray-500">{r.maps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Reference-Only Tabs (not in main app)</div>
        <div className="space-y-2">
          {REF_TABS.map(r => (
            <div key={r.tab} className="flex items-start gap-2 text-sm">
              <span className="text-gray-300">📎</span>
              <div>
                <span className="font-medium text-gray-600">{r.tab}</span>
                <span className="text-gray-400 text-xs ml-2">— {r.note}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
