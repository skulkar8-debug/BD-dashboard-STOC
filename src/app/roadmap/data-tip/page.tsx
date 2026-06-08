'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { ExternalLink, ChevronDown, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'
import { useStore, fmtDate } from '@/lib/store'
import { TipStatusBadge, DataReadyBadge } from '@/components/roadmap/StatusBadge'
import type { AppData, DataTipItem, TipStatus, DataReady } from '@/lib/types'

const STORAGE_KEY = 'sectorRoadmapData'

function loadLocalDataTip(): DataTipItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return (JSON.parse(raw) as AppData).dataTip ?? []
  } catch {
    return []
  }
}

const TIP_STATUSES: TipStatus[]  = ['Not Started', 'In Progress', 'Created', 'Sent']
const DATA_READY:   DataReady[]  = ['Yes', 'Partial', 'No']
const SOURCE_LOCS = ['Google Sheets', 'Google Sheets + Clay', 'Clay', 'TBD', 'Other']

const LOCAL_ONLY_FIELDS = new Set<keyof DataTipItem>(['sourceDataLocation', 'gsheetLink'])

// ── tiny inline editors ────────────────────────────────────────────────────────

function InlineDrop<T extends string>({
  value, options, onSave,
}: { value: T; options: T[]; onSave: (v: T) => void }) {
  return (
    <select
      autoFocus
      className="border border-indigo-300 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
      defaultValue={value}
      onClick={e => e.stopPropagation()}
      onChange={e => onSave(e.target.value as T)}
      onBlur={() => { /* blur handled by onChange saving */ }}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function InlineText({ value, onSave, placeholder = 'https://…', width = 'w-48' }: {
  value: string; onSave: (v: string) => void; placeholder?: string; width?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <input
      ref={ref}
      autoFocus
      type="text"
      defaultValue={value}
      placeholder={placeholder}
      onClick={e => e.stopPropagation()}
      className={`${width} border border-indigo-300 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400`}
      onBlur={e => onSave(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter')  onSave((e.target as HTMLInputElement).value)
        if (e.key === 'Escape') onSave(value) // revert
      }}
    />
  )
}

function InlineDate({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  return (
    <input
      autoFocus
      type="date"
      defaultValue={value}
      onClick={e => e.stopPropagation()}
      className="border border-indigo-300 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 w-32"
      onBlur={e => onSave(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter')  onSave((e.target as HTMLInputElement).value)
        if (e.key === 'Escape') onSave(value)
      }}
    />
  )
}

function InlineBool({ value, onSave }: { value: boolean; onSave: (v: boolean) => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onSave(!value) }}
      className={`w-8 h-5 rounded-full transition-colors flex items-center ${value ? 'bg-indigo-500' : 'bg-gray-200'}`}
    >
      <span className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform mx-0.5 ${value ? 'translate-x-3' : 'translate-x-0'}`} />
    </button>
  )
}

function EditCell({ onClick, children, className = '' }: {
  onClick: () => void; children: React.ReactNode; className?: string
}) {
  return (
    <div
      className={`group cursor-pointer flex items-center gap-0.5 ${className}`}
      onClick={e => { e.stopPropagation(); onClick() }}
      title="Click to edit"
    >
      {children}
      <ChevronDown className="size-2.5 text-indigo-300 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
    </div>
  )
}

function LinkOrDash({ url, label }: { url: string; label: string }) {
  if (!url) return <span className="text-gray-300 text-xs">—</span>
  return (
    <a
      href={url} target="_blank" rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="flex items-center gap-0.5 text-indigo-600 text-xs hover:underline font-medium"
    >
      {label} <ExternalLink className="size-2.5" />
    </a>
  )
}

// ── main page ──────────────────────────────────────────────────────────────────

type EditingKey = `${string}:${'sourceLoc'|'sourceLink'|'clayLink'|'gsheetLink'|'tipLink'|'tipStatus'|'tipCreated'|'tipSent'|'dataReady'|'inReport'|'inTip'}`

type SyncState = 'idle' | 'loading' | 'syncing' | 'saved' | 'error'

export default function DataTipPage() {
  const { data, updateDataTip, replaceDataTip } = useStore()
  const [tipStatusF, setTipStatusF] = useState('')
  const [dataReadyF, setDataReadyF] = useState('')
  const [editingKey, setEditingKey] = useState<EditingKey | null>(null)
  const [syncState, setSyncState] = useState<SyncState>('loading')
  const [syncError, setSyncError] = useState<string | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)
  const initialLoadDone = useRef(false)
  const loadingRef = useRef(false)

  const isEditing = (sector: string, field: string) => editingKey === `${sector}:${field}`
  const startEdit = (sector: string, field: string) => setEditingKey(`${sector}:${field}` as EditingKey)

  const loadFromSheet = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true

    setSyncState('loading')
    setSyncError(null)
    setNeedsAuth(false)

    try {
      const res = await fetch('/api/sheets/data-tip', { cache: 'no-store' })
      const body = await res.json()

      if (!res.ok) {
        if (
          res.status === 401 ||
          body.error === 'not_authenticated' ||
          body.error === 'insufficient_scopes'
        ) {
          setNeedsAuth(true)
          setSyncError(
            body.message ??
              'Reconnect Google to grant spreadsheet read & write access.'
          )
        } else {
          setSyncError(body.message ?? 'Failed to load from Google Sheet')
        }
        setSyncState('error')
        return
      }

      const localItems = loadLocalDataTip()
      const sheetItems = body.items as DataTipItem[]
      const merged = sheetItems.map((item) => {
        const local = localItems.find((t) => t.sector === item.sector)
        return {
          ...item,
          sourceDataLocation: local?.sourceDataLocation ?? item.sourceDataLocation,
          gsheetLink: local?.gsheetLink ?? item.gsheetLink,
        }
      })

      replaceDataTip(merged)
      setSyncState('saved')
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to load')
      setSyncState('error')
    } finally {
      loadingRef.current = false
    }
  }, [replaceDataTip])

  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true
    void loadFromSheet()
  }, [loadFromSheet])

  const pushToSheet = useCallback(async (sector: string, patch: Partial<DataTipItem>) => {
    const sheetPatch = Object.fromEntries(
      Object.entries(patch).filter(([key]) => !LOCAL_ONLY_FIELDS.has(key as keyof DataTipItem))
    ) as Partial<DataTipItem>

    if (Object.keys(sheetPatch).length === 0) return true

    setSyncState('syncing')
    setSyncError(null)

    try {
      const res = await fetch('/api/sheets/data-tip', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sector, updates: sheetPatch }),
      })
      const body = await res.json()

      if (!res.ok) {
        if (
          res.status === 401 ||
          res.status === 403 ||
          body.error === 'not_authenticated' ||
          body.error === 'insufficient_scopes'
        ) {
          setNeedsAuth(true)
          setSyncError(
            body.message ??
              'Reconnect Google to grant spreadsheet write access.'
          )
        } else {
          setSyncError(body.message ?? 'Failed to sync to Google Sheet')
        }
        setSyncState('error')
        return false
      }

      setSyncState('saved')
      return true
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed')
      setSyncState('error')
      return false
    }
  }, [])

  const save = useCallback(async (sector: string, patch: Partial<DataTipItem>) => {
    const item = data.dataTip.find(t => t.sector === sector)
    if (!item) return

    updateDataTip({ ...item, ...patch })
    setEditingKey(null)
    await pushToSheet(sector, patch)
  }, [data.dataTip, updateDataTip, pushToSheet])

  const filtered = data.dataTip.filter(t => {
    if (tipStatusF && t.tipStatus !== tipStatusF) return false
    if (dataReadyF && t.dataReady !== dataReadyF) return false
    return true
  })

  const inp = 'border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

  const statusLabel =
    syncState === 'loading' ? 'Loading from sheet…'
    : syncState === 'syncing' ? 'Saving to sheet…'
    : syncState === 'saved' ? 'Synced with Google Sheet'
    : syncState === 'error' ? 'Sync issue'
    : ''

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data + TIP Sync</h1>
            <p className="text-sm text-gray-500 mt-1">
              Click any cell to edit inline. Changes sync to the Google Sheet{' '}
              <span className="font-medium">Data + TIP Sync</span> tab.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {needsAuth && (
              <a
                href="/api/auth/google?returnTo=/roadmap/data-tip"
                className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Reconnect Google
              </a>
            )}
            <button
              onClick={loadFromSheet}
              disabled={syncState === 'loading' || syncState === 'syncing'}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${syncState === 'loading' ? 'animate-spin' : ''}`} />
              Reload
            </button>
          </div>
        </div>

        {statusLabel && (
          <div className={`mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
            syncState === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : syncState === 'saved'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-indigo-50 border-indigo-200 text-indigo-700'
          }`}>
            {syncState === 'error'
              ? <AlertCircle className="size-3.5 shrink-0" />
              : syncState === 'saved'
                ? <CheckCircle className="size-3.5 shrink-0" />
                : <RefreshCw className={`size-3.5 shrink-0 ${syncState !== 'idle' ? 'animate-spin' : ''}`} />
            }
            <span>{syncError ?? statusLabel}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-3 flex-wrap items-center">
        <select className={inp} value={tipStatusF} onChange={e => setTipStatusF(e.target.value)}>
          <option value="">All TIP Statuses</option>
          {TIP_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className={inp} value={dataReadyF} onChange={e => setDataReadyF(e.target.value)}>
          <option value="">All Data Ready</option>
          {DATA_READY.map(s => <option key={s}>{s}</option>)}
        </select>
        {(tipStatusF || dataReadyF) && (
          <button onClick={() => { setTipStatusF(''); setDataReadyF('') }} className="text-xs text-indigo-600 hover:underline">Clear</button>
        )}
      </div>

      <div className="text-[10px] text-gray-400 mb-3 ml-1">
        💡 <strong>Tip:</strong> Click any cell with a <ChevronDown className="inline size-2.5 text-indigo-400" /> to edit. Toggle switches for In Rpt / In TIP. Source Location and GSheet Link are local-only (not in the sheet).
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm border-collapse" style={{ minWidth: 1100 }}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs sticky left-0 bg-gray-50 z-10">Sector</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs">Source Location <span className="text-indigo-400">✎</span></th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs">Source Link <span className="text-indigo-400">✎</span></th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs">Clay Link <span className="text-indigo-400">✎</span></th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs">GSheet Link <span className="text-indigo-400">✎</span></th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs">TIP Link <span className="text-indigo-400">✎</span></th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs">TIP Status <span className="text-indigo-400">✎</span></th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs">TIP Created <span className="text-indigo-400">✎</span></th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs">TIP Sent <span className="text-indigo-400">✎</span></th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs">Data Ready <span className="text-indigo-400">✎</span></th>
              <th className="text-center px-3 py-2.5 font-semibold text-gray-600 text-xs">In Rpt <span className="text-indigo-400">✎</span></th>
              <th className="text-center px-3 py-2.5 font-semibold text-gray-600 text-xs">In TIP <span className="text-indigo-400">✎</span></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-400 text-sm">No rows found.</td></tr>
            )}
            {filtered.map(t => {
              const sec = data.sectors.find(s => s.name === t.sector)
              const e = (field: string) => isEditing(t.sector, field)

              return (
                <tr key={t.sector} className="border-b border-gray-100 hover:bg-gray-50/50 align-middle">

                  <td className="px-3 py-2 sticky left-0 bg-white z-10 border-r border-gray-100">
                    {sec
                      ? <Link href={`/roadmap/sectors/${sec.id}`} className="font-semibold text-indigo-600 hover:underline text-sm whitespace-nowrap">{t.sector}</Link>
                      : <span className="font-semibold text-gray-800 text-sm">{t.sector}</span>
                    }
                  </td>

                  <td className="px-3 py-2">
                    {e('sourceLoc')
                      ? <InlineDrop<string> value={t.sourceDataLocation} options={SOURCE_LOCS} onSave={v => save(t.sector, { sourceDataLocation: v })} />
                      : <EditCell onClick={() => startEdit(t.sector, 'sourceLoc')}>
                          <span className="text-xs text-gray-600">{t.sourceDataLocation || <span className="text-gray-300 italic">—</span>}</span>
                        </EditCell>
                    }
                  </td>

                  <td className="px-3 py-2">
                    {e('sourceLink')
                      ? <InlineText value={t.sourceLink} onSave={v => save(t.sector, { sourceLink: v })} />
                      : <EditCell onClick={() => startEdit(t.sector, 'sourceLink')}>
                          <LinkOrDash url={t.sourceLink} label="Source" />
                          {!t.sourceLink && <span className="text-[10px] text-gray-300 italic">add link</span>}
                        </EditCell>
                    }
                  </td>

                  <td className="px-3 py-2">
                    {e('clayLink')
                      ? <InlineText value={t.clayLink} onSave={v => save(t.sector, { clayLink: v })} />
                      : <EditCell onClick={() => startEdit(t.sector, 'clayLink')}>
                          <LinkOrDash url={t.clayLink} label="Clay" />
                          {!t.clayLink && <span className="text-[10px] text-gray-300 italic">add link</span>}
                        </EditCell>
                    }
                  </td>

                  <td className="px-3 py-2">
                    {e('gsheetLink')
                      ? <InlineText value={t.gsheetLink} onSave={v => save(t.sector, { gsheetLink: v })} />
                      : <EditCell onClick={() => startEdit(t.sector, 'gsheetLink')}>
                          <LinkOrDash url={t.gsheetLink} label="Sheet" />
                          {!t.gsheetLink && <span className="text-[10px] text-gray-300 italic">add link</span>}
                        </EditCell>
                    }
                  </td>

                  <td className="px-3 py-2">
                    {e('tipLink')
                      ? <InlineText value={t.tipLink} onSave={v => save(t.sector, { tipLink: v })} />
                      : <EditCell onClick={() => startEdit(t.sector, 'tipLink')}>
                          <LinkOrDash url={t.tipLink} label="TIP App" />
                          {!t.tipLink && <span className="text-[10px] text-gray-300 italic">add link</span>}
                        </EditCell>
                    }
                  </td>

                  <td className="px-3 py-2">
                    {e('tipStatus')
                      ? <InlineDrop value={t.tipStatus} options={TIP_STATUSES} onSave={v => save(t.sector, { tipStatus: v })} />
                      : <EditCell onClick={() => startEdit(t.sector, 'tipStatus')}>
                          <TipStatusBadge status={t.tipStatus} />
                        </EditCell>
                    }
                  </td>

                  <td className="px-3 py-2 whitespace-nowrap">
                    {e('tipCreated')
                      ? <InlineDate value={t.tipCreated} onSave={v => save(t.sector, { tipCreated: v })} />
                      : <EditCell onClick={() => startEdit(t.sector, 'tipCreated')}>
                          <span className={`text-xs ${t.tipCreated ? 'text-gray-700' : 'text-gray-300 italic'}`}>
                            {t.tipCreated ? fmtDate(t.tipCreated) : 'no date'}
                          </span>
                        </EditCell>
                    }
                  </td>

                  <td className="px-3 py-2 whitespace-nowrap">
                    {e('tipSent')
                      ? <InlineDate value={t.tipSent} onSave={v => save(t.sector, { tipSent: v })} />
                      : <EditCell onClick={() => startEdit(t.sector, 'tipSent')}>
                          <span className={`text-xs ${t.tipSent ? 'text-gray-700' : 'text-gray-300 italic'}`}>
                            {t.tipSent ? fmtDate(t.tipSent) : 'no date'}
                          </span>
                        </EditCell>
                    }
                  </td>

                  <td className="px-3 py-2">
                    {e('dataReady')
                      ? <InlineDrop value={t.dataReady} options={DATA_READY} onSave={v => save(t.sector, { dataReady: v })} />
                      : <EditCell onClick={() => startEdit(t.sector, 'dataReady')}>
                          <DataReadyBadge value={t.dataReady} />
                        </EditCell>
                    }
                  </td>

                  <td className="px-3 py-2 text-center">
                    <div className="flex justify-center">
                      <InlineBool value={t.inReport} onSave={v => save(t.sector, { inReport: v })} />
                    </div>
                  </td>

                  <td className="px-3 py-2 text-center">
                    <div className="flex justify-center">
                      <InlineBool value={t.inTip} onSave={v => save(t.sector, { inTip: v })} />
                    </div>
                  </td>

                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
