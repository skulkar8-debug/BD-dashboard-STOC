'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { syncFromGoogleSheet, SHEET_URL, type SyncResult } from '@/lib/sheetSync'
import { Download, RotateCcw, Database, Info, RefreshCw, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react'

const TAB_SUMMARY = [
  { tab: 'Sectors',         cols: 20, rows: 79,  maps: 'Sectors page + Sector Detail' },
  { tab: 'Calendar',        cols: 12, rows: 395, maps: 'Calendar page (derived from Sectors)' },
  { tab: 'Reminders',       cols: 10, rows: 474, maps: 'Reminders page + Dashboard stats' },
  { tab: 'Data + TIP Sync', cols: 16, rows: 79,  maps: 'Data+TIP page + Sector Detail' },
  { tab: 'People',          cols: 6,  rows: 10,  maps: 'People page + owner dropdowns' },
  { tab: 'Settings',        cols: 3,  rows: 1,   maps: 'Settings page (app config)' },
]

const REF_TABS = [
  { tab: 'Original Sector Details',    note: 'Reference only — sector priority tiers and PE value drivers' },
  { tab: 'Workflow Template (Optional)', note: 'Optional 17-step workflow checklist' },
  { tab: 'Workflow Log (Optional)',    note: 'Task-level log for sectors needing extra detail' },
]

export default function SettingsPage() {
  const { data, resetToSeed, exportJson } = useStore()
  const [syncing,    setSyncing]    = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)

  const handleReset = () => {
    if (!confirm("Reset all data to seed? This will clear any edits you've made.")) return
    resetToSeed()
    setSyncResult(null)
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const { data: next, result } = await syncFromGoogleSheet(data)
      if (result.ok) {
        // Save synced data to localStorage via store
        localStorage.setItem('sectorRoadmapData', JSON.stringify(next))
        window.location.reload()
      }
      setSyncResult(result)
    } catch (e) {
      setSyncResult({ ok: false, sectors: 0, people: 0, error: String(e), syncedAt: new Date().toISOString() })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">App configuration, data sync, and management.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

        {/* Google Sheet Sync — NEW */}
        <div className="bg-white rounded-xl border border-indigo-200 p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <RefreshCw className="size-4 text-indigo-500" />
            <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Google Sheet Sync</div>
            <span className="ml-auto text-[10px] text-green-600 font-semibold bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">✓ Connected</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Pulls live data from the published Google Sheet using the gviz/tq endpoint (no API key required).
            Sectors, MP/BD/SM assignments, links, and publish dates are updated. Priorities and local edits are preserved.
          </p>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-wait font-medium transition-colors"
            >
              <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync from Google Sheet'}
            </button>
            <a
              href={SHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
            >
              Open sheet <ExternalLink className="size-3" />
            </a>
          </div>

          {syncResult && (
            <div className={`flex items-start gap-3 p-3 rounded-lg text-sm ${syncResult.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {syncResult.ok
                ? <CheckCircle className="size-4 text-green-600 mt-0.5 shrink-0" />
                : <AlertCircle className="size-4 text-red-600 mt-0.5 shrink-0" />
              }
              <div>
                {syncResult.ok
                  ? <><strong className="text-green-800">Synced successfully</strong> — {syncResult.sectors} sectors, {syncResult.people} people updated. Page will reload.</>
                  : <><strong className="text-red-800">Sync failed:</strong> {syncResult.error}</>
                }
                <div className="text-xs text-gray-400 mt-0.5">
                  {new Date(syncResult.syncedAt).toLocaleString()}
                </div>
              </div>
            </div>
          )}

          <div className="mt-3 text-xs text-gray-400 font-mono bg-gray-50 rounded p-2 truncate">
            {`https://docs.google.com/spreadsheets/d/1wqW8zgy2E_W6I5S_wi9iDqA4OWC0B74zd6l6_v3uQpo/gviz/tq?tqx=out:csv&sheet=Sectors`}
          </div>
        </div>

        {/* Local data management */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <Database className="size-4 text-indigo-500" />
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Local Data</div>
          </div>
          <p className="text-xs text-gray-500 mb-4">All edits persist to localStorage. Export a snapshot or reset to seed.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportJson} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
              <Download className="size-3.5" /> Export JSON
            </button>
            <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
              <RotateCcw className="size-3.5" /> Reset to Seed
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[['Sectors', data.sectors.length], ['Reminders', data.reminders.length], ['People', data.people.length]].map(([l, v]) => (
              <div key={l} className="bg-gray-50 rounded-lg py-2">
                <div className="text-xl font-bold text-indigo-600">{v}</div>
                <div className="text-[10px] text-gray-400">{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* App info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info className="size-4 text-indigo-500" />
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">App Info</div>
          </div>
          <div className="space-y-2 text-sm">
            {[
              ['Version',           '1.0 Prototype'],
              ['Storage',           'localStorage'],
              ['Live Sheet Sync',   '✓ Active (gviz/tq)'],
              ['Framework',         'Next.js 16 + Tailwind v4'],
              ['Deployment',        'Vercel (stoc-dashboard)'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-xs text-gray-400 w-36 shrink-0">{k}</span>
                <span className="font-medium text-gray-800 text-xs">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Workbook tab summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Workbook Tab Summary</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Tab','Columns','Rows (sheet)','Maps to App Page'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600">{h}</th>
                ))}
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
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Reference-Only Tabs</div>
        {REF_TABS.map(r => (
          <div key={r.tab} className="flex items-start gap-2 text-sm py-1">
            <span className="text-gray-300">📎</span>
            <span className="font-medium text-gray-600">{r.tab}</span>
            <span className="text-gray-400 text-xs">— {r.note}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
