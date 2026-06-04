'use client';

import React from 'react';
import type { FilterState, DatePreset } from '@/hooks/useBDData';

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'all',       label: 'All time' },
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'last_7',    label: 'Last 7 days' },
  { value: 'last_30',   label: 'Last 30 days' },
  { value: 'mtd',       label: 'Month to date' },
];

type Props = {
  filters: FilterState;
  options: {
    orgs: { id: string; label: string }[];
    sectors: string[];
    states: string[];
    campaign_statuses: string[];
    recommended_actions: string[];
  };
  updateFilter: <K extends keyof FilterState>(k: K, v: FilterState[K]) => void;
  setDatePreset: (p: DatePreset) => void;
  resetFilters: () => void;
};

function Sel({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  const active = !!value;
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pl-0.5">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`text-xs rounded-lg border px-2.5 py-1.5 pr-7 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer transition-colors ${
          active
            ? 'border-blue-400 text-blue-700 bg-blue-50 font-medium'
            : 'border-gray-200 text-gray-700'
        }`}
        style={{ appearance: 'auto' }}
      >
        {children}
      </select>
    </div>
  );
}

export function FilterBar({ filters, options, updateFilter, setDatePreset, resetFilters }: Props) {
  const activeCount = [
    filters.org, filters.sector, filters.state,
    filters.campaign_status, filters.has_positive_replies, filters.recommended_action,
    filters.datePreset !== 'last_30' ? 'x' : '',
  ].filter(Boolean).length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        {/* Date preset */}
        <Sel
          label="Date"
          value={filters.datePreset}
          onChange={(v) => setDatePreset(v as DatePreset)}
        >
          {DATE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </Sel>

        {/* Custom date range (only when preset = custom) */}
        {filters.datePreset === 'custom' && (
          <>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">From</label>
              <input
                type="date"
                value={filters.from_date}
                onChange={(e) => updateFilter('from_date', e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">To</label>
              <input
                type="date"
                value={filters.to_date}
                onChange={(e) => updateFilter('to_date', e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
              />
            </div>
          </>
        )}

        <div className="w-px h-8 bg-gray-200 self-end mb-1" />

        {/* Org */}
        <Sel label="Org" value={filters.org} onChange={(v) => updateFilter('org', v)}>
          <option value="">All orgs ({options.orgs.length})</option>
          {options.orgs.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </Sel>

        {/* Sector */}
        <Sel label="Sector" value={filters.sector} onChange={(v) => updateFilter('sector', v)}>
          <option value="">All sectors</option>
          {options.sectors.map((s) => <option key={s} value={s}>{s}</option>)}
        </Sel>

        {/* State */}
        <Sel label="State" value={filters.state} onChange={(v) => updateFilter('state', v)}>
          <option value="">All states</option>
          {options.states.map((s) => <option key={s} value={s}>{s}</option>)}
        </Sel>

        {/* Campaign status */}
        <Sel label="Status" value={filters.campaign_status} onChange={(v) => updateFilter('campaign_status', v)}>
          <option value="">All statuses</option>
          {options.campaign_statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </Sel>

        {/* Positive replies */}
        <Sel label="Positives" value={filters.has_positive_replies} onChange={(v) => updateFilter('has_positive_replies', v as FilterState['has_positive_replies'])}>
          <option value="">Any</option>
          <option value="yes">Has positive replies</option>
          <option value="no">No positive replies</option>
        </Sel>

        {/* Recommended action */}
        <Sel label="Action" value={filters.recommended_action} onChange={(v) => updateFilter('recommended_action', v)}>
          <option value="">All actions</option>
          {options.recommended_actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </Sel>

        {/* Clear */}
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
