'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { FilterState, DatePreset } from '@/hooks/useBDData';

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'all',       label: 'All time' },
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'last_7',    label: 'Last 7 days' },
  { value: 'last_30',   label: 'Last 30 days' },
  { value: 'mtd',       label: 'Month to date' },
  { value: 'custom',    label: 'Custom range' },
];

type Props = {
  filters: FilterState;
  options: {
    orgs: { id: string; label: string }[];
    sectors: string[];
    states: string[];
    campaigns: { id: string; name: string; org: string }[];
    campaign_statuses: string[];
    recommended_actions: string[];
  };
  updateFilter: <K extends keyof FilterState>(k: K, v: FilterState[K]) => void;
  setDatePreset: (p: DatePreset) => void;
  resetFilters: () => void;
};

// ─── Single select ────────────────────────────────────────────────────────────

function Sel({
  label, value, onChange, children,
}: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  const active = !!value;
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pl-0.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`text-xs rounded-lg border px-2.5 py-1.5 pr-7 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer transition-colors ${
          active ? 'border-blue-400 text-blue-700 bg-blue-50 font-medium' : 'border-gray-200 text-gray-700'
        }`}
        style={{ appearance: 'auto' }}
      >
        {children}
      </select>
    </div>
  );
}

// ─── Multi-select checkbox dropdown ──────────────────────────────────────────

type MultiSelItem = { id: string; label: string; sub?: string };

function MultiSel({
  label,
  placeholder,
  items,
  selected,
  onChange,
  maxWidth = 'max-w-[220px]',
}: {
  label: string;
  placeholder: string;
  items: MultiSelItem[];
  selected: string[];
  onChange: (v: string[]) => void;
  maxWidth?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = useCallback((id: string) => {
    if (selected.includes(id)) onChange(selected.filter((s) => s !== id));
    else onChange([...selected, id]);
  }, [selected, onChange]);

  const active = selected.length > 0;

  const buttonLabel = active
    ? selected.length === 1
      ? (items.find((i) => i.id === selected[0])?.label ?? selected[0])
      : `${selected.length} selected`
    : placeholder;

  return (
    <div className="flex flex-col gap-0.5 relative" ref={ref}>
      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pl-0.5">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`text-xs rounded-lg border px-2.5 py-1.5 text-left flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer transition-colors whitespace-nowrap ${
          active
            ? 'border-blue-400 text-blue-700 bg-blue-50 font-medium'
            : 'border-gray-200 text-gray-700 bg-white'
        }`}
        style={{ minWidth: '110px' }}
      >
        <span className="flex-1 truncate">{buttonLabel}</span>
        <svg className={`w-3 h-3 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className={`absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 ${maxWidth} min-w-[160px]`}
          style={{ maxHeight: '280px', overflowY: 'auto' }}
        >
          {items.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400 italic">No options</div>
          ) : (
            <>
              {active && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="w-full text-left px-3 py-1.5 text-xs text-blue-500 hover:text-blue-700 font-medium border-b border-gray-100"
                >
                  Clear all
                </button>
              )}
              {items.map((item) => {
                const checked = selected.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id)}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-start gap-2 hover:bg-gray-50 transition-colors ${checked ? 'bg-blue-50' : ''}`}
                  >
                    <span className={`mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center ${checked ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                      {checked && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={`block truncate ${checked ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>{item.label}</span>
                      {item.sub && <span className="block text-[10px] text-gray-400 truncate">{item.sub}</span>}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Date inputs ──────────────────────────────────────────────────────────────

function DateInput({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pl-0.5">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`text-xs rounded-lg border px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer transition-colors ${
          value ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-gray-200 text-gray-700'
        }`}
      />
    </div>
  );
}

// ─── Main FilterBar ───────────────────────────────────────────────────────────

export function FilterBar({ filters, options, updateFilter, setDatePreset, resetFilters }: Props) {
  const activeCount = [
    ...filters.orgs, ...filters.sectors, ...filters.campaigns,
    filters.state, filters.campaign_status, filters.has_positive_replies, filters.recommended_action,
    filters.datePreset !== 'last_30' ? 'x' : '',
  ].filter(Boolean).length;

  function handleFromDate(v: string) {
    updateFilter('from_date', v);
    if (filters.datePreset !== 'custom') updateFilter('datePreset', 'custom');
  }
  function handleToDate(v: string) {
    updateFilter('to_date', v);
    if (filters.datePreset !== 'custom') updateFilter('datePreset', 'custom');
  }

  const orgItems: MultiSelItem[] = options.orgs.map((o) => ({ id: o.id, label: o.label }));
  const sectorItems: MultiSelItem[] = options.sectors.map((s) => ({ id: s, label: s }));
  const campaignItems: MultiSelItem[] = options.campaigns.map((c) => ({
    id: c.id,
    label: c.name,
    sub: c.org,
  }));

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">

        {/* Date preset shortcut */}
        <Sel label="Quick Date" value={filters.datePreset} onChange={(v) => setDatePreset(v as DatePreset)}>
          {DATE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </Sel>

        <DateInput label="From" value={filters.from_date} onChange={handleFromDate} />
        <DateInput label="To"   value={filters.to_date}   onChange={handleToDate} />

        <div className="w-px h-8 bg-gray-200 self-end mb-1" />

        {/* Org multi-select */}
        <MultiSel
          label="Org"
          placeholder={`All orgs (${options.orgs.length})`}
          items={orgItems}
          selected={filters.orgs}
          onChange={(v) => {
            updateFilter('orgs', v);
            updateFilter('sectors', []);
            updateFilter('state', '');
          }}
        />

        {/* Sector multi-select (cascades from orgs) */}
        <MultiSel
          label="Sector"
          placeholder={`All sectors (${options.sectors.length})`}
          items={sectorItems}
          selected={filters.sectors}
          onChange={(v) => {
            updateFilter('sectors', v);
            updateFilter('state', '');
          }}
        />

        {/* State single-select (cascades from orgs + sectors) */}
        <Sel label="State" value={filters.state} onChange={(v) => updateFilter('state', v)}>
          <option value="">All states{(filters.orgs.length > 0 || filters.sectors.length > 0) ? ` (${options.states.length})` : ''}</option>
          {options.states.map((s) => <option key={s} value={s}>{s}</option>)}
        </Sel>

        {/* Campaign multi-select (cascades from orgs + sectors + state) */}
        <MultiSel
          label="Campaign"
          placeholder={`All campaigns (${options.campaigns.length})`}
          items={campaignItems}
          selected={filters.campaigns}
          onChange={(v) => updateFilter('campaigns', v)}
          maxWidth="max-w-[300px]"
        />

        {/* Campaign status */}
        <Sel label="Status" value={filters.campaign_status} onChange={(v) => updateFilter('campaign_status', v)}>
          <option value="">All statuses</option>
          {options.campaign_statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </Sel>

        {/* Positive replies */}
        <Sel label="Positives" value={filters.has_positive_replies} onChange={(v) => updateFilter('has_positive_replies', v as FilterState['has_positive_replies'])}>
          <option value="">Any</option>
          <option value="yes">Has positive</option>
          <option value="no">None</option>
        </Sel>

        {/* Recommended action */}
        <Sel label="Action" value={filters.recommended_action} onChange={(v) => updateFilter('recommended_action', v)}>
          <option value="">All actions</option>
          {options.recommended_actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </Sel>

        {activeCount > 0 && (
          <button
            onClick={resetFilters}
            className="self-end mb-0.5 text-xs text-blue-500 hover:text-blue-700 font-medium underline whitespace-nowrap"
          >
            Clear {activeCount > 1 ? `(${activeCount})` : ''}
          </button>
        )}
      </div>
    </div>
  );
}
