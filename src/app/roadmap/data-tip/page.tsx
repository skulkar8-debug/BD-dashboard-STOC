'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { ExternalLink, ChevronDown } from 'lucide-react'
import { useStore, fmtDate } from '@/lib/store'
import { TipStatusBadge, DataReadyBadge } from '@/components/roadmap/StatusBadge'
import type { DataTipItem, TipStatus, DataReady } from '@/lib/types'

const TIP_STATUSES: TipStatus[]  = ['Not Started', 'In Progress', 'Created', 'Sent']
const DATA_READY:   DataReady[]  = ['Yes', 'Partial', 'No']
const SOURCE_LOCS = ['Google Sheets', 'Google Sheets + Clay', 'Clay', 'TBD', 'Other']

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

// clickable cell wrapper
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

export default function DataTipPage() {
  const { data, updateDataTip } = useStore()
  const [tipStatusF, setTipStatusF] = useState('')
  const [dataReadyF, setDataReadyF] = useState('')
  const [editingKey, setEditingKey] = useState<EditingKey | null>(null)

  const isEditing = (sector: string, field: string) => editingKey === `${sector}:${field}`
  const startEdit = (sector: string, field: string) => setEditingKey(`${sector}:${field}` as EditingKey)
  const stopEdit = () => setEditingKey(null)

  const save = useCallback((sector: string, patch: Partial<DataTipItem>) => {
    const item = data.dataTip.find(t => t.sector === sector)
    if (!item) return
    updateDataTip({ ...item, ...patch })
    setEditingKey(null)
  }, [data.dataTip, updateDataTip])

  const filtered = data.dataTip.filter(t => {
    if (tipStatusF && t.tipStatus !== tipStatusF) return false
    if (dataReadyF && t.dataReady !== dataReadyF) return false
    return true
  })

  const inp = 'border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Data + TIP Sync</h1>
        <p className="text-sm text-gray-500 mt-1">Click any cell to edit inline. Changes save to localStorage.</p>
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
        💡 <strong>Tip:</strong> Click any cell with a <ChevronDown className="inline size-2.5 text-indigo-400" /> to edit. Toggle switches for In Rpt / In TIP.
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

                  {/* Sector */}
                  <td className="px-3 py-2 sticky left-0 bg-white z-10 border-r border-gray-100">
                    {sec
                      ? <Link href={`/roadmap/sectors/${sec.id}`} className="font-semibold text-indigo-600 hover:underline text-sm whitespace-nowrap">{t.sector}</Link>
                      : <span className="font-semibold text-gray-800 text-sm">{t.sector}</span>
                    }
                  </td>

                  {/* Source Location */}
                  <td className="px-3 py-2">
                    {e('sourceLoc')
                      ? <InlineDrop value={t.sourceDataLocation as TipStatus} options={SOURCE_LOCS as TipStatus[]} onSave={v => save(t.sector, { sourceDataLocation: v })} />
                      : <EditCell onClick={() => startEdit(t.sector, 'sourceLoc')}>
                          <span className="text-xs text-gray-600">{t.sourceDataLocation || <span className="text-gray-300 italic">—</span>}</span>
                        </EditCell>
                    }
                  </td>

                  {/* Source Link */}
                  <td className="px-3 py-2">
                    {e('sourceLink')
                      ? <InlineText value={t.sourceLink} onSave={v => save(t.sector, { sourceLink: v })} />
                      : <EditCell onClick={() => startEdit(t.sector, 'sourceLink')}>
                          <LinkOrDash url={t.sourceLink} label="Source" />
                          {!t.sourceLink && <span className="text-[10px] text-gray-300 italic">add link</span>}
                        </EditCell>
                    }
                  </td>

                  {/* Clay Link */}
                  <td className="px-3 py-2">
                    {e('clayLink')
                      ? <InlineText value={t.clayLink} onSave={v => save(t.sector, { clayLink: v })} />
                      : <EditCell onClick={() => startEdit(t.sector, 'clayLink')}>
                          <LinkOrDash url={t.clayLink} label="Clay" />
                          {!t.clayLink && <span className="text-[10px] text-gray-300 italic">add link</span>}
                        </EditCell>
                    }
                  </td>

                  {/* GSheet Link */}
                  <td className="px-3 py-2">
                    {e('gsheetLink')
                      ? <InlineText value={t.gsheetLink} onSave={v => save(t.sector, { gsheetLink: v })} />
                      : <EditCell onClick={() => startEdit(t.sector, 'gsheetLink')}>
                          <LinkOrDash url={t.gsheetLink} label="Sheet" />
                          {!t.gsheetLink && <span className="text-[10px] text-gray-300 italic">add link</span>}
                        </EditCell>
                    }
                  </td>

                  {/* TIP Link */}
                  <td className="px-3 py-2">
                    {e('tipLink')
                      ? <InlineText value={t.tipLink} onSave={v => save(t.sector, { tipLink: v })} />
                      : <EditCell onClick={() => startEdit(t.sector, 'tipLink')}>
                          <LinkOrDash url={t.tipLink} label="TIP App" />
                          {!t.tipLink && <span className="text-[10px] text-gray-300 italic">add link</span>}
                        </EditCell>
                    }
                  </td>

                  {/* TIP Status */}
                  <td className="px-3 py-2">
                    {e('tipStatus')
                      ? <InlineDrop value={t.tipStatus} options={TIP_STATUSES} onSave={v => save(t.sector, { tipStatus: v })} />
                      : <EditCell onClick={() => startEdit(t.sector, 'tipStatus')}>
                          <TipStatusBadge status={t.tipStatus} />
                        </EditCell>
                    }
                  </td>

                  {/* TIP Created */}
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

                  {/* TIP Sent */}
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

                  {/* Data Ready */}
                  <td className="px-3 py-2">
                    {e('dataReady')
                      ? <InlineDrop value={t.dataReady} options={DATA_READY} onSave={v => save(t.sector, { dataReady: v })} />
                      : <EditCell onClick={() => startEdit(t.sector, 'dataReady')}>
                          <DataReadyBadge value={t.dataReady} />
                        </EditCell>
                    }
                  </td>

                  {/* In Report — toggle */}
                  <td className="px-3 py-2 text-center">
                    <div className="flex justify-center">
                      <InlineBool value={t.inReport} onSave={v => save(t.sector, { inReport: v })} />
                    </div>
                  </td>

                  {/* In TIP — toggle */}
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
