'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useBDData, presetDates, defaultFilters } from '@/hooks/useBDData';
import type { FilterState, DatePreset } from '@/hooks/useBDData';
import { FilterBar } from '@/components/bd/FilterBar';
import { KpiCard } from '@/components/bd/KpiCard';
import { StatusBadge } from '@/components/bd/Badge';
import { CLASSIFICATION_LABELS } from '@/lib/instantly/types';
import type { NormalizedCampaign, NormalizedEmail, BDData } from '@/lib/instantly/types';
import { exportCampaignsCsv, exportEmailsCsv, downloadCsv } from '@/lib/instantly/export';
import { SECTOR_OPTIONS } from '@/config/campaign-sector-map';
import {
  Loader2, RefreshCw, AlertTriangle, Bug, BarChart3,
  Calendar, Layers, MapPin, Table2, Inbox, TrendingUp, ChevronDown, ChevronRight, GitCompare, Link2, Check, MessageSquare,
} from 'lucide-react';
// Note: Calendar, TrendingUp kept for potential future use
import Image from 'next/image';

// ─── Deep-link URL sync ───────────────────────────────────────────────────────

const VALID_TABS = ['overview','sectors','states','compare','inbox','analytics','sentiment','debug'] as const;
type TabId = typeof VALID_TABS[number];

type CompareMode = 'sector' | 'owner';

function parseUrl(): { filters: FilterState; tab: TabId; sectorA: string; sectorB: string; compareMode: CompareMode; ownerA: string; ownerB: string } {
  const def = defaultFilters();
  if (typeof window === 'undefined') return { filters: def, tab: 'overview', sectorA: '', sectorB: '', compareMode: 'sector', ownerA: '', ownerB: '' };
  const p = new URLSearchParams(window.location.search);

  const dp = (p.get('dp') ?? def.datePreset) as DatePreset;
  const dates = dp === 'custom'
    ? { from_date: p.get('fd') ?? '', to_date: p.get('td') ?? '' }
    : presetDates(dp);

  const rawTab = p.get('tab') ?? 'overview';
  const tab: TabId = (VALID_TABS as readonly string[]).includes(rawTab) ? rawTab as TabId : 'overview';

  return {
    filters: {
      datePreset: dp,
      from_date: dates.from_date,
      to_date: dates.to_date,
      orgs: p.getAll('org'),
      sectors: p.getAll('sec'),
      bd_owners: p.getAll('bdo'),
      state: p.get('st') ?? '',
      campaigns: p.getAll('c'),
      campaign_status: p.get('cs') ?? '',
      has_positive_replies: (p.get('hpr') ?? '') as FilterState['has_positive_replies'],
      recommended_action: p.get('ra') ?? '',
    },
    tab,
    sectorA: p.get('sa') ?? '',
    sectorB: p.get('sb') ?? '',
    compareMode: (p.get('cm') ?? 'sector') as CompareMode,
    ownerA: p.get('oa') ?? '',
    ownerB: p.get('ob') ?? '',
  };
}

function buildUrl(filters: FilterState, tab: TabId, sectorA: string, sectorB: string, compareMode: CompareMode, ownerA: string, ownerB: string): string {
  const p = new URLSearchParams();
  if (tab !== 'overview') p.set('tab', tab);
  if (filters.datePreset !== 'last_30') p.set('dp', filters.datePreset);
  if (filters.datePreset === 'custom') {
    if (filters.from_date) p.set('fd', filters.from_date);
    if (filters.to_date)   p.set('td', filters.to_date);
  }
  filters.orgs.forEach((v) => p.append('org', v));
  filters.sectors.forEach((v) => p.append('sec', v));
  filters.bd_owners.forEach((v) => p.append('bdo', v));
  if (filters.state) p.set('st', filters.state);
  filters.campaigns.forEach((v) => p.append('c', v));
  if (filters.campaign_status) p.set('cs', filters.campaign_status);
  if (filters.has_positive_replies) p.set('hpr', filters.has_positive_replies);
  if (filters.recommended_action) p.set('ra', filters.recommended_action);
  if (sectorA) p.set('sa', sectorA);
  if (sectorB) p.set('sb', sectorB);
  if (compareMode !== 'sector') p.set('cm', compareMode);
  if (ownerA) p.set('oa', ownerA);
  if (ownerB) p.set('ob', ownerB);
  const qs = p.toString();
  return qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
}

// ─── Leaflet is browser-only — must be dynamically imported with SSR disabled
const StatePerformanceMap = dynamic(
  () => import('@/components/bd/StatePerformanceMap'),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm h-[460px] flex items-center justify-center text-sm text-gray-400">
        Loading map…
      </div>
    ),
  }
);

const TABS = [
  { id: 'overview',  label: 'Overview',   icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { id: 'sentiment', label: 'Sentiment',  icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { id: 'states',    label: 'States',     icon: <MapPin className="h-3.5 w-3.5" /> },
  { id: 'compare',   label: 'Compare',    icon: <GitCompare className="h-3.5 w-3.5" /> },
  { id: 'inbox',     label: 'Inbox',      icon: <Inbox className="h-3.5 w-3.5" /> },
  { id: 'analytics', label: 'Analytics',  icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { id: 'sectors',   label: 'Sectors',    icon: <Layers className="h-3.5 w-3.5" /> },
  { id: 'debug',     label: 'Debug',      icon: <Bug className="h-3.5 w-3.5" /> },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(n: number, d: number, decimals = 1): string {
  if (!d) return '—';
  return (Math.round((n / d) * Math.pow(10, decimals + 2)) / Math.pow(10, decimals)).toFixed(decimals) + '%';
}
function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString();
}
function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
function CsvBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-[11px] px-2.5 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
      ↓ CSV
    </button>
  );
}

// ─── Scope-aware rate display ─────────────────────────────────────────────────
// Instantly analytics fields (sent, bounces, etc.) are always all-time totals.
// Email pull counts respect UI filters. When scopes differ, hide the percentage.

const SCOPE_MISMATCH_TITLE =
  'Percentage hidden — denominator (sent) is all-time from Instantly analytics; numerator is date/filter-scoped. Scopes do not match.';
const SCOPE_APPROX_TITLE =
  'Approximate — sent count is all-time from Instantly analytics. Email pull may not cover full campaign history.';

/** Render a reply-rate where denominator is lifetime `sent` and numerator is filtered replies. */
function ScopedRate({
  num, den, isFiltered, className,
}: {
  num: number;
  den: number;
  isFiltered: boolean;
  className?: string;
}) {
  if (!den) return <span className={className}>—</span>;
  if (isFiltered) {
    return (
      <span className={className ?? ''} title={SCOPE_MISMATCH_TITLE}>
        <span className="text-gray-300 cursor-help">—</span>
        <sup className="text-gray-300 text-[8px] ml-px cursor-help" aria-label="scope mismatch">†</sup>
      </span>
    );
  }
  return (
    <span className={className} title={SCOPE_APPROX_TITLE}>
      ~{pct(num, den)}
    </span>
  );
}

/** Plain string version for non-JSX contexts (e.g. sub-labels). */
function lifetimePct(num: number, den: number, isFiltered: boolean, decimals = 1): string {
  if (!den) return '—';
  if (isFiltered) return '—';
  return '~' + pct(num, den, decimals);
}

// ─── Compact stat cell ────────────────────────────────────────────────────────

function Stat({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="text-center">
      <div className={`text-xl font-bold tabular-nums ${color ?? 'text-gray-900'}`}>{value}</div>
      <div className="text-[11px] text-gray-500 leading-tight">{label}</div>
      {sub && <div className="text-[10px] text-gray-400">{sub}</div>}
    </div>
  );
}

// ─── Filter debug bar ────────────────────────────────────────────────────────

type FilterDebugProps = {
  totalCampaigns: number;
  filteredCampaigns: number;
  totalEmails: number;
  filteredEmails: number;
  filters: ReturnType<typeof useBDData>['filters'];
  analyticsDateNote: boolean;
};

function FilterDebugBar({
  totalCampaigns, filteredCampaigns, totalEmails, filteredEmails, filters, analyticsDateNote,
}: FilterDebugProps) {
  const isFiltered = filteredCampaigns < totalCampaigns || filteredEmails < totalEmails;
  const activeFilters = [
    filters.orgs.length > 0 && `Org: ${filters.orgs.length === 1 ? filters.orgs[0] : `${filters.orgs.length} orgs`}`,
    filters.campaigns.length > 0 && `Campaign: ${filters.campaigns.length === 1 ? filters.campaigns[0] : `${filters.campaigns.length} campaigns`}`,
    filters.sectors.length > 0 && `Sector: ${filters.sectors.length === 1 ? filters.sectors[0] : `${filters.sectors.length} sectors`}`,
    filters.state && `State: ${filters.state}`,
    filters.campaign_status && `Status: ${filters.campaign_status}`,
    filters.has_positive_replies && `Positives: ${filters.has_positive_replies}`,
    filters.recommended_action && `Action: ${filters.recommended_action}`,
    filters.datePreset !== 'all' && `Date: ${filters.datePreset}`,
  ].filter(Boolean) as string[];

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] px-1 ${isFiltered ? 'text-blue-600' : 'text-gray-400'}`}>
      <span>
        Campaigns: <strong>{filteredCampaigns}</strong>
        {isFiltered && filteredCampaigns < totalCampaigns && <span className="text-gray-400"> / {totalCampaigns}</span>}
      </span>
      <span>
        Emails: <strong>{filteredEmails}</strong>
        {isFiltered && filteredEmails < totalEmails && <span className="text-gray-400"> / {totalEmails}</span>}
      </span>
      {activeFilters.length > 0 && (
        <span className="text-blue-500">
          Active: {activeFilters.join(' · ')}
        </span>
      )}
      <span className="text-gray-400" title="Sent † columns use all-time data from Instantly analytics. Reply% † hides when filters are active because the denominator scope doesn't match the numerator.">
        † = all-time denominator
      </span>
      {analyticsDateNote && (
        <span className="text-amber-500">
          ⚠ Sent/Bounce/Opps are all-time — Instantly analytics are not date-filterable. Reply% hidden when filters active.
        </span>
      )}
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function OverviewTab({
  campaigns, emails, stats, analyticsAvailable, isFiltered, campaignStats,
}: {
  campaigns: NormalizedCampaign[];
  emails: NormalizedEmail[];
  stats: ReturnType<typeof useBDData>['stats'];
  analyticsAvailable: boolean;
  isFiltered: boolean;
  campaignStats: ReturnType<typeof useBDData>['campaignStats'];
}) {
  // positive emails = human replies with positive classification (same as stats.actionable)
  const positive = emails.filter((e) => e.is_positive);
  const noAnalytics = !analyticsAvailable;

  // Best performers — all counts derived from filtered emails only
  const bySector = useMemo(() => {
    const m = new Map<string, { replies: number; positive: number; sent: number }>();
    // sent is lifetime per campaign (for context only, not used for rates)
    campaigns.forEach((c) => {
      const cur = m.get(c.sector) ?? { replies: 0, positive: 0, sent: 0 };
      cur.sent += c.sent;
      m.set(c.sector, cur);
    });
    // replies and positives come from filtered email records
    emails.forEach((e) => {
      const cur = m.get(e.sector);
      if (!cur) return;
      cur.replies++;
      if (e.is_positive) cur.positive++;
    });
    return m;
  }, [campaigns, emails]);

  const byState = useMemo(() => {
    const m = new Map<string, { replies: number; positive: number }>();
    emails.forEach((e) => {
      if (!e.state || e.state === 'Unmapped') return;
      const cur = m.get(e.state) ?? { replies: 0, positive: 0 };
      cur.replies++;
      if (e.is_positive) cur.positive++;
      m.set(e.state, cur);
    });
    return m;
  }, [emails]);

  // Use filtered-email-derived positive counts (not pre-computed c.positive_reply_count)
  const bestCampaign = [...campaigns]
    .map((c) => ({ c, pos: campaignStats.get(c.campaign_id)?.positive ?? 0 }))
    .filter(({ pos }) => pos > 0)
    .sort((a, b) => b.pos - a.pos)[0]?.c ?? null;
  const bestCampaignPos = bestCampaign ? (campaignStats.get(bestCampaign.campaign_id)?.positive ?? 0) : 0;

  const bestState = [...byState.entries()]
    .filter(([, v]) => v.replies >= 2)
    .sort((a, b) => b[1].positive / Math.max(b[1].replies, 1) - a[1].positive / Math.max(a[1].replies, 1))[0];

  const followUps = campaigns
    .map((c) => ({ c, pos: campaignStats.get(c.campaign_id)?.positive ?? 0 }))
    .filter(({ pos }) => pos > 0)
    .sort((a, b) => b.pos - a.pos)
    .slice(0, 5);
  const toReview = campaigns.filter((c) => c.recommended_action === 'Pause / Review' || c.recommended_action === 'Review')
    .sort((a, b) => b.sent - a.sent).slice(0, 5);

  // Sector performance table — show all sectors (no cap)
  const sectorRows = [...bySector.entries()]
    .filter(([sector]) => sector && sector !== 'Unmapped')
    .map(([sector, v]) => ({ sector, ...v }))
    .sort((a, b) => b.positive - a.positive);

  const stateRows = [...byState.entries()]
    .map(([state, v]) => ({ state, ...v }))
    .sort((a, b) => b.positive - a.positive)
    .slice(0, 12);

  // Recent positive replies
  const recentPositive = [...positive]
    .sort((a, b) => b.timestamp_email.localeCompare(a.timestamp_email))
    .slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Analytics notice */}
      {noAnalytics && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-2 text-xs">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Analytics unavailable — Sent/Open/Bounce metrics show 0. Reply and positive counts are from actual email data.
        </div>
      )}

      {/* Row 1: KPI cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
          <div className={`text-2xl font-bold tabular-nums ${noAnalytics ? 'text-gray-300' : 'text-gray-900'}`}>
            {noAnalytics ? <span title="Analytics unavailable">—</span> : fmt(stats.sent)}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">Sent — Only All-Time Data Available</div>
          {noAnalytics && <div className="text-[10px] text-amber-500">analytics n/a</div>}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
          <div className="text-2xl font-bold tabular-nums text-gray-900">{fmt(stats.replies)}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Replies (Date-Filtered)</div>
          <div className="text-[10px] text-gray-400">
            {noAnalytics
              ? 'filtered'
              : <ScopedRate num={stats.replies} den={stats.sent} isFiltered={isFiltered} />}
          </div>
        </div>
        <div className="bg-white border border-l-4 border-emerald-400 rounded-xl p-4 text-center shadow-sm">
          <div className="text-2xl font-bold tabular-nums text-emerald-600">{fmt(stats.actionable)}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Actionable Replies</div>
          <div className="text-[10px] text-gray-400" title="Actionable ÷ human replies (excludes OOO, bounce, auto, unsub)">
            {pct(stats.actionable, stats.humanReplies)} of {fmt(stats.humanReplies)} human
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
          <div className={`text-2xl font-bold tabular-nums ${noAnalytics ? 'text-gray-300' : 'text-amber-600'}`}>
            {noAnalytics ? '—' : fmt(stats.opps)}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">Opportunities (All-Time)</div>
          {!noAnalytics && <div className="text-[10px] text-gray-400">{pct(stats.opps, stats.sent)} of all-time sent</div>}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
          <div className="text-2xl font-bold tabular-nums text-blue-600">{stats.activeCampaigns}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Active</div>
          <div className="text-[10px] text-gray-400">of {stats.totalCampaigns} campaigns</div>
        </div>
        <div className={`border rounded-xl p-4 text-center shadow-sm ${stats.needsAttention > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <div className={`text-2xl font-bold tabular-nums ${stats.needsAttention > 0 ? 'text-red-600' : 'text-gray-300'}`}>
            {stats.needsAttention || '0'}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">Needs Attention</div>
          <div className="text-[10px] text-gray-400">{stats.followUp} to follow up</div>
        </div>
      </div>

      {/* Row 2: Insight bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
          <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-1">Best Campaign</div>
          <div className="font-semibold text-gray-800 text-sm truncate" title={bestCampaign?.campaign_name}>{bestCampaign ? bestCampaign.campaign_name : '—'}</div>
          {bestCampaign && <div className="text-xs text-gray-500 mt-0.5">{bestCampaignPos} positive · {bestCampaign.sector} · {bestCampaign.state}</div>}
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
          <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-1">Best State</div>
          <div className="font-semibold text-gray-800 text-sm">{bestState ? bestState[0] : '—'}</div>
          {bestState && <div className="text-xs text-gray-500 mt-0.5">{bestState[1].positive} positive · {pct(bestState[1].positive, bestState[1].replies)} rate</div>}
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
          <div className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-1">Follow Up ({followUps.length})</div>
          {followUps.length > 0 ? (
            <div className="space-y-0.5">
              {followUps.slice(0, 3).map(({ c, pos }) => (
                <div key={c.campaign_id} className="text-xs text-gray-700 truncate">
                  <span className="text-emerald-600 font-semibold">{pos}</span> · {c.campaign_name}
                </div>
              ))}
            </div>
          ) : <div className="text-xs text-gray-400">None</div>}
        </div>
        <div className={`border rounded-xl p-3 ${toReview.length > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
          <div className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${toReview.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>Review / Pause ({toReview.length})</div>
          {toReview.length > 0 ? (
            <div className="space-y-0.5">
              {toReview.slice(0, 3).map((c) => (
                <div key={c.campaign_id} className="text-xs text-gray-700 truncate">
                  <span className="text-red-500 font-semibold">{c.bounce_rate > 5 ? `${c.bounce_rate}% bounce` : `${c.reply_rate}% reply`}</span> · {c.campaign_name}
                </div>
              ))}
            </div>
          ) : <div className="text-xs text-gray-400">All clear</div>}
        </div>
      </div>

      {/* Row 3: Performance tables + recent positive replies */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Sector table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-600">Sector Performance</div>
          <table className="w-full text-xs">
            <thead><tr className="text-gray-400 text-[10px] uppercase">
              <th className="text-left px-3 py-2">Sector</th>
              <th className="text-right px-3 py-2">Replies</th>
              <th className="text-right px-3 py-2">Positive</th>
              <th className="text-right px-3 py-2">Rate</th>
            </tr></thead>
            <tbody>
              {sectorRows.map((r) => (
                <tr key={r.sector} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-medium text-gray-700 max-w-[120px] truncate">{r.sector}</td>
                  <td className="text-right px-3 py-1.5">{r.replies}</td>
                  <td className="text-right px-3 py-1.5 text-emerald-600 font-semibold">{r.positive}</td>
                  <td className="text-right px-3 py-1.5">{pct(r.positive, r.replies)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* State table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-600">State Performance</div>
          <table className="w-full text-xs">
            <thead><tr className="text-gray-400 text-[10px] uppercase">
              <th className="text-left px-3 py-2">State</th>
              <th className="text-right px-3 py-2">Replies</th>
              <th className="text-right px-3 py-2">Positive</th>
              <th className="text-right px-3 py-2">Rate</th>
            </tr></thead>
            <tbody>
              {stateRows.map((r) => (
                <tr key={r.state} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-medium text-gray-700">{r.state}</td>
                  <td className="text-right px-3 py-1.5">{r.replies}</td>
                  <td className="text-right px-3 py-1.5 text-emerald-600 font-semibold">{r.positive}</td>
                  <td className="text-right px-3 py-1.5">{pct(r.positive, r.replies)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent positive replies */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-600">Recent Positive Replies</div>
          <div className="divide-y divide-gray-50">
            {recentPositive.length > 0 ? recentPositive.map((e) => (
              <div key={e.id} className="px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-800 truncate">{e.from_name || e.from_email}</div>
                    <div className="text-[10px] text-gray-400 truncate">{e.campaign_name} · {e.state}</div>
                  </div>
                  <div className="text-[10px] text-gray-400 flex-shrink-0">{new Date(e.timestamp_email).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                </div>
                <div className="text-xs text-gray-600 mt-1 line-clamp-2">{e.content_preview || e.body_text.slice(0, 150)}</div>
                <StatusBadge value={CLASSIFICATION_LABELS[e.final_classification]} />
              </div>
            )) : (
              <div className="px-3 py-6 text-center text-xs text-gray-400">No positive replies in current filter</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Weekly Agenda ────────────────────────────────────────────────────────────

function AgendaTab({ campaigns, emails, isFiltered }: { campaigns: NormalizedCampaign[]; emails: NormalizedEmail[]; isFiltered: boolean }) {
  type GroupData = { campaigns: NormalizedCampaign[]; emails: NormalizedEmail[]; positive: NormalizedEmail[] };

  const groups = useMemo(() => {
    const m = new Map<string, Map<string, GroupData>>();
    campaigns.forEach((c) => {
      if (!m.has(c.org_id)) m.set(c.org_id, new Map());
      const om = m.get(c.org_id)!;
      if (!om.has(c.sector)) om.set(c.sector, { campaigns: [], emails: [], positive: [] });
      om.get(c.sector)!.campaigns.push(c);
    });
    emails.forEach((e) => {
      const om = m.get(e.org_id); if (!om) return;
      const sec = om.get(e.sector); if (!sec) return;
      sec.emails.push(e);
      if (e.is_positive) sec.positive.push(e);
    });
    return m;
  }, [campaigns, emails]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setExpanded((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([orgId, sectorMap]) => {
        const orgLabel = campaigns.find((c) => c.org_id === orgId)?.org_label ?? orgId;
        const totalPositive = [...sectorMap.values()].reduce((s, d) => s + d.positive.length, 0);
        return (
          <div key={orgId} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 text-sm">{orgLabel}</h2>
              <span className="text-xs text-gray-500">
                {[...sectorMap.values()].reduce((s, d) => s + d.campaigns.length, 0)} campaigns ·{' '}
                <span className="text-emerald-600 font-medium">{totalPositive} positive</span>
              </span>
            </div>
            {[...sectorMap.entries()].map(([sector, data]) => {
              const key = `${orgId}|${sector}`;
              const open = expanded.has(key);
              const sent = data.campaigns.reduce((s, c) => s + c.sent, 0);
              const best = [...data.campaigns].sort((a, b) => b.positive_reply_count - a.positive_reply_count)[0];
              return (
                <div key={sector} className="border-b border-gray-100 last:border-0">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50/60 transition-colors"
                    onClick={() => toggle(key)}
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-medium text-sm text-gray-700">{sector}</span>
                      <span className="text-xs text-gray-400">
                        {data.campaigns.length} campaigns · {fmt(sent)} sent ·{' '}
                        <span className={data.positive.length > 0 ? 'text-emerald-600 font-semibold' : 'text-gray-400'}>
                          {data.positive.length} positive
                        </span>{' '}
                        · {data.emails.length} replies
                      </span>
                      {data.positive.length > 0 && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                          ✓ Has positives
                        </span>
                      )}
                    </div>
                    {open ? <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                  </button>

                  {open && (
                    <div className="px-4 pb-5 pt-1 space-y-4 bg-gray-50/30">
                      {/* Stats row */}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {[
                          { v: fmt(sent), l: 'Sent (All-Time)' },
                          { v: fmt(data.emails.length), l: 'Replies (Filtered)' },
                          { v: fmt(data.positive.length), l: 'Actionable', em: true },
                          { v: lifetimePct(data.emails.length, sent, isFiltered), l: 'Reply Rate†' },
                          { v: pct(data.positive.length, data.emails.length), l: 'Pos. Rate' },
                          { v: fmt(data.campaigns.reduce((s, c) => s + c.opportunities, 0)), l: 'Opps' },
                        ].map(({ v, l, em }) => (
                          <div key={l} className="bg-white rounded-lg p-2 border border-gray-100 text-center">
                            <div className={`text-base font-bold ${em ? 'text-emerald-600' : 'text-gray-800'}`}>{v}</div>
                            <div className="text-[10px] text-gray-500">{l}</div>
                          </div>
                        ))}
                      </div>

                      {best && best.positive_reply_count > 0 && (
                        <div className="text-xs bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-gray-700">
                          <span className="font-semibold text-emerald-700">Best: </span>
                          {best.campaign_name} · <span className="text-emerald-600 font-medium">{best.positive_reply_count} positive</span> · {best.state}
                        </div>
                      )}

                      {/* Positive replies */}
                      {data.positive.length > 0 && (
                        <div>
                          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Positive Replies</div>
                          <div className="space-y-2">
                            {data.positive.slice(0, 4).map((e) => (
                              <div key={e.id} className="bg-white rounded-lg border border-gray-200 p-3">
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <div>
                                    <span className="font-medium text-sm text-gray-800">{e.from_name || e.from_email}</span>
                                    <span className="text-xs text-gray-400 ml-2">{e.from_email}</span>
                                    <div className="text-[10px] text-gray-400 mt-0.5">{e.campaign_name} · {new Date(e.timestamp_email).toLocaleDateString()}</div>
                                  </div>
                                  <StatusBadge value={CLASSIFICATION_LABELS[e.final_classification]} />
                                </div>
                                <div className="mt-1.5 text-xs text-gray-600 line-clamp-3">{e.content_preview || e.body_text.slice(0, 250)}</div>
                              </div>
                            ))}
                            {data.positive.length > 4 && <div className="text-xs text-gray-400 pl-1">+{data.positive.length - 4} more in Inbox tab</div>}
                          </div>
                        </div>
                      )}

                      {/* Campaign mini-table */}
                      <div>
                        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Campaigns</div>
                        <div className="overflow-x-auto rounded-lg border border-gray-100">
                          <table className="w-full text-xs">
                            <thead><tr className="text-gray-400 bg-gray-50 text-[10px] uppercase">
                              {['Campaign', 'State', 'Status', 'Sent', 'Replies', 'Positive', 'Action'].map((h) => (
                                <th key={h} className={`py-1.5 px-2 ${h === 'Campaign' ? 'text-left' : 'text-right'}`}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {data.campaigns.map((c) => (
                                <tr key={c.campaign_id} className="border-t border-gray-50">
                                  <td className="py-1.5 px-2 font-medium text-gray-700 max-w-[160px] truncate">{c.campaign_name}</td>
                                  <td className="text-right px-2 text-gray-500">{c.state}</td>
                                  <td className="text-right px-2"><StatusBadge value={c.campaign_status} /></td>
                                  <td className="text-right px-2">{fmt(c.sent)}</td>
                                  <td className="text-right px-2">{c.actual_received_count}</td>
                                  <td className="text-right px-2 text-emerald-600 font-semibold">{c.positive_reply_count}</td>
                                  <td className="text-right px-2"><StatusBadge value={c.recommended_action} /></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      {groups.size === 0 && <div className="text-center py-12 text-sm text-gray-400">No data matches current filters</div>}
    </div>
  );
}

// ─── Sectors ──────────────────────────────────────────────────────────────────

function SectorsTab({ campaigns, emails, isFiltered, campaignStats }: { campaigns: NormalizedCampaign[]; emails: NormalizedEmail[]; isFiltered: boolean; campaignStats: ReturnType<typeof useBDData>['campaignStats'] }) {
  const [drill, setDrill] = useState<string | null>(null);
  const bySector = useMemo(() => {
    const m = new Map<string, { campaigns: NormalizedCampaign[]; emails: NormalizedEmail[] }>();
    campaigns.forEach((c) => { if (!m.has(c.sector)) m.set(c.sector, { campaigns: [], emails: [] }); m.get(c.sector)!.campaigns.push(c); });
    emails.forEach((e) => { if (!m.has(e.sector)) return; m.get(e.sector)!.emails.push(e); });
    return m;
  }, [campaigns, emails]);

  if (drill && bySector.has(drill)) {
    const d = bySector.get(drill)!;
    const sent = d.campaigns.reduce((s, c) => s + c.sent, 0);
    const pos = d.emails.filter((e) => e.is_positive);
    return (
      <div className="space-y-5">
        <button onClick={() => setDrill(null)} className="text-sm text-blue-500 hover:underline">← Sectors</button>
        <h2 className="text-xl font-bold">{drill}</h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          <KpiCard title="Sent (All-Time)" value={fmt(sent)} />
          <KpiCard title="Replies (Filtered)" value={fmt(d.emails.length)} sub={lifetimePct(d.emails.length, sent, isFiltered)} />
          <KpiCard title="Actionable" value={fmt(pos.length)} sub={pct(pos.length, d.emails.length)} accent="#10B981" />
          <KpiCard title="Opportunities" value={fmt(d.campaigns.reduce((s, c) => s + c.opportunities, 0))} />
          <KpiCard title="Campaigns" value={d.campaigns.length} />
        </div>
        <CampaignTable campaigns={d.campaigns} emails={d.emails} isFiltered={isFiltered} campaignStats={campaignStats} />
        {pos.length > 0 && <><div className="text-sm font-semibold text-gray-600">Positive Replies</div><EmailList emails={pos} /></>}
      </div>
    );
  }

  const rows = [...bySector.entries()].sort((a, b) => b[1].emails.filter((e) => e.is_positive).length - a[1].emails.filter((e) => e.is_positive).length);
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-400 uppercase tracking-wide">
          {['Sector','Campaigns','States','Sent †','Replies','Reply% †','Positive','Pos%','Opps'].map((h) => (
            <th key={h} title={h.includes('†') ? 'Denominator is all-time sent from Instantly analytics' : undefined}
              className={`py-2 px-3 ${h==='Sector'?'text-left':'text-right'}`}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {rows.map(([sector, d]) => {
            const sent = d.campaigns.reduce((s, c) => s + c.sent, 0);
            const pos = d.emails.filter((e) => e.is_positive).length;
            return (
              <tr key={sector} className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer" onClick={() => setDrill(sector)}>
                <td className="py-2 px-3 font-medium text-blue-600">{sector}</td>
                <td className="text-right px-3">{d.campaigns.length}</td>
                <td className="text-right px-3">{new Set(d.campaigns.map((c) => c.state)).size}</td>
                <td className="text-right px-3">{fmt(sent)}</td>
                <td className="text-right px-3">{d.emails.length}</td>
                <td className="text-right px-3"><ScopedRate num={d.emails.length} den={sent} isFiltered={isFiltered} /></td>
                <td className="text-right px-3 text-emerald-600 font-semibold">{pos}</td>
                <td className="text-right px-3">{pct(pos, d.emails.length)}</td>
                <td className="text-right px-3">{d.campaigns.reduce((s, c) => s + c.opportunities, 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── States ───────────────────────────────────────────────────────────────────

function StatesTab({ campaigns, emails, isFiltered }: { campaigns: NormalizedCampaign[]; emails: NormalizedEmail[]; isFiltered: boolean }) {
  const rows = useMemo(() => {
    const m = new Map<string, { campaigns: NormalizedCampaign[]; emails: NormalizedEmail[] }>();
    campaigns.forEach((c) => {
      if (!m.has(c.state)) m.set(c.state, { campaigns: [], emails: [] });
      m.get(c.state)!.campaigns.push(c);
    });
    emails.forEach((e) => {
      if (!m.has(e.state)) return;
      m.get(e.state)!.emails.push(e);
    });
    return [...m.entries()]
      .filter(([s]) => s && s !== 'Unmapped')
      .sort((a, b) =>
        b[1].emails.filter((e) => e.is_positive).length -
        a[1].emails.filter((e) => e.is_positive).length
      );
  }, [campaigns, emails]);

  return (
    <div className="space-y-5">
      {/* ── Full-width map ── */}
      <StatePerformanceMap campaigns={campaigns} emails={emails} />

      {/* ── Full-width table directly below ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-600">
          State Performance Table
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-400 uppercase tracking-wide">
                {['State','Orgs','Sectors','Campaigns','Sent †','Replies','Reply% †','Positive','Pos%','Opps'].map((h) => (
                  <th key={h} title={h.includes('†') ? 'Denominator is all-time sent from Instantly analytics' : undefined}
                    className={`py-2 px-3 ${h === 'State' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([state, d]) => {
                const sent = d.campaigns.reduce((s, c) => s + c.sent, 0);
                const pos = d.emails.filter((e) => e.is_positive).length;
                return (
                  <tr key={state} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-800">{state}</td>
                    <td className="text-right px-3">{new Set(d.campaigns.map((c) => c.org_id)).size}</td>
                    <td className="text-right px-3">{new Set(d.campaigns.map((c) => c.sector)).size}</td>
                    <td className="text-right px-3">{d.campaigns.length}</td>
                    <td className="text-right px-3">{fmt(sent)}</td>
                    <td className="text-right px-3">{d.emails.length}</td>
                    <td className="text-right px-3"><ScopedRate num={d.emails.length} den={sent} isFiltered={isFiltered} /></td>
                    <td className="text-right px-3 text-emerald-600 font-semibold">{pos}</td>
                    <td className="text-right px-3">{pct(pos, d.emails.length)}</td>
                    <td className="text-right px-3">{d.campaigns.reduce((s, c) => s + c.opportunities, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Campaign table ───────────────────────────────────────────────────────────

function CampaignTable({
  campaigns, emails: _, isFiltered, campaignStats,
}: {
  campaigns: NormalizedCampaign[];
  emails: NormalizedEmail[];
  isFiltered: boolean;
  campaignStats: ReturnType<typeof useBDData>['campaignStats'];
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ col: keyof NormalizedCampaign; dir: 'asc' | 'desc' }>({ col: 'sent', dir: 'desc' });

  const filtered = useMemo(() => {
    let list = campaigns;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.campaign_name.toLowerCase().includes(q) || c.sector.toLowerCase().includes(q) || c.state.toLowerCase().includes(q) || c.org_label.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const av = a[sort.col] ?? 0; const bv = b[sort.col] ?? 0;
      const cmp = typeof av === 'string' ? av.localeCompare(String(bv)) : Number(av) - Number(bv);
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [campaigns, search, sort]);

  function Th({ col, label }: { col: keyof NormalizedCampaign; label: string }) {
    return (
      <th className="text-right py-2 px-2 cursor-pointer hover:text-blue-600 select-none text-[10px] whitespace-nowrap"
        onClick={() => setSort((s) => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' })}>
        {label}{sort.col === col ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
      </th>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 flex-1 max-w-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
        <CsvBtn onClick={() => downloadCsv(exportCampaignsCsv(filtered), 'campaigns.csv')} />
        <span className="text-xs text-gray-400">{filtered.length} campaigns</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-xs">
          <thead><tr className="bg-gray-50 border-b border-gray-200 text-gray-400 text-[10px] uppercase tracking-wide">
            <th className="text-left py-2 px-2">Org</th>
            <th className="text-left py-2 px-2">Sector</th>
            <th className="text-left py-2 px-2">State</th>
            <th className="text-left py-2 px-2">Campaign</th>
            <th className="text-left py-2 px-2">Status</th>
            <Th col="sent" label="Sent †" />
            <Th col="actual_received_count" label="Replies" />
            <Th col="reply_rate" label="Reply% †" />
            <Th col="positive_reply_count" label="Positive" />
            <Th col="positive_reply_rate" label="Pos%" />
            <Th col="bounces" label="Bounces" />
            <Th col="bounce_rate" label="Bounce%" />
            <Th col="unsubscribes" label="Unsubs" />
            <Th col="opportunities" label="Opps" />
            <th className="text-right py-2 px-2 text-[10px]">Action</th>
          </tr></thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.campaign_id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-1.5 px-2 text-gray-500 text-[11px]">{c.org_label}</td>
                <td className="px-2 text-gray-600 max-w-[100px] truncate text-[11px]">{c.sector}</td>
                <td className="px-2 text-gray-600 text-[11px]">{c.state}</td>
                <td className="px-2 font-medium text-gray-800 max-w-[160px] truncate" title={c.campaign_name}>{c.campaign_name}</td>
                <td className="px-2"><StatusBadge value={c.campaign_status} /></td>
                {(() => {
                  const cs = campaignStats.get(c.campaign_id) ?? { received: 0, positive: 0, human: 0 };
                  const posRate = cs.human > 0 ? (cs.positive / cs.human * 100).toFixed(1) + '%' : '—';
                  return (
                    <>
                      <td className="text-right px-2">{c.analytics_available ? fmt(c.sent) : <span className="text-gray-300">—</span>}</td>
                      <td className="text-right px-2" title="Received in current date/filter window">{cs.received}</td>
                      <td className="text-right px-2">
                        {c.analytics_available && c.sent > 0
                          ? <ScopedRate num={cs.received} den={c.sent} isFiltered={isFiltered} />
                          : '—'}
                      </td>
                      <td className="text-right px-2 text-emerald-600 font-semibold" title="Actionable replies in current filter">{cs.positive}</td>
                      <td className="text-right px-2" title="Actionable ÷ human replies (excludes automated/unsub)">{posRate}</td>
                    </>
                  );
                })()}
                <td className={`text-right px-2 ${c.bounce_rate > 5 ? 'text-red-600 font-semibold' : ''}`}>{c.analytics_available ? c.bounces : '—'}</td>
                <td className="text-right px-2">{c.analytics_available && c.sent > 0 ? c.bounce_rate + '%' : '—'}</td>
                <td className="text-right px-2">{c.analytics_available ? c.unsubscribes : '—'}</td>
                <td className="text-right px-2">{c.analytics_available ? c.opportunities : '—'}</td>
                <td className="text-right px-2"><StatusBadge value={c.recommended_action} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-8 text-sm text-gray-400">No campaigns match</div>}
      </div>
    </div>
  );
}

// ─── Email list (shared) ──────────────────────────────────────────────────────

function EmailList({ emails }: { emails: NormalizedEmail[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [overrides, setOverrides] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('bd_overrides') ?? '{}'); } catch { return {}; }
  });

  const filtered = useMemo(() => {
    if (!search) return emails;
    const q = search.toLowerCase();
    return emails.filter((e) => e.from_email.includes(q) || e.from_name.toLowerCase().includes(q) || e.campaign_name.toLowerCase().includes(q) || e.body_text.toLowerCase().includes(q));
  }, [emails, search]);

  function saveOverride(id: string, val: string) {
    const next = { ...overrides, [id]: val };
    setOverrides(next);
    try { localStorage.setItem('bd_overrides', JSON.stringify(next)); } catch {}
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search replies…"
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 flex-1 max-w-sm focus:outline-none" />
        <CsvBtn onClick={() => downloadCsv(exportEmailsCsv(filtered), 'replies.csv')} />
        <span className="text-xs text-gray-400">{filtered.length}</span>
        {search && <button onClick={() => setSearch('')} className="text-xs text-gray-400">Clear</button>}
      </div>
      {filtered.map((e) => {
        const open = expanded.has(e.id);
        const override = overrides[e.id];
        const displayClass = override ? CLASSIFICATION_LABELS[override as keyof typeof CLASSIFICATION_LABELS] ?? override : CLASSIFICATION_LABELS[e.final_classification];
        return (
          <div key={e.id} className="border border-gray-200 rounded-xl overflow-hidden">
            <button className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
              onClick={() => setExpanded((s) => { const n = new Set(s); open ? n.delete(e.id) : n.add(e.id); return n; })}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-800">{e.from_name || e.from_email}</span>
                  {companyFromEmail(e.from_email) && (
                    <span className="text-xs text-blue-700 font-medium bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                      {companyFromEmail(e.from_email)}
                    </span>
                  )}
                  <StatusBadge value={displayClass} />
                  {e.is_positive && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">✓</span>}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  <span className="text-gray-500">{e.from_email}</span>
                  {' · '}{e.campaign_name} · {e.sector} · {e.state} · {e.org_label} · {new Date(e.timestamp_email).toLocaleDateString()}
                </div>
                <div className="text-xs text-gray-600 mt-1 line-clamp-2">{e.content_preview || e.body_text.slice(0, 180)}</div>
              </div>
              {open ? <ChevronDown className="h-4 w-4 text-gray-400 mt-1 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 mt-1 flex-shrink-0" />}
            </button>
            {open && (
              <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div><span className="text-gray-400">From: </span><span className="font-medium">{e.from_email}</span></div>
                  <div><span className="text-gray-400">Date: </span><span className="font-medium">{new Date(e.timestamp_email).toLocaleString()}</span></div>
                  <div><span className="text-gray-400">Campaign: </span><span className="font-medium">{e.campaign_name}</span></div>
                  <div><span className="text-gray-400">AI Interest: </span><span className="font-medium">{e.ai_interest_value ?? '—'}</span></div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-3 text-xs text-gray-700 whitespace-pre-wrap max-h-72 overflow-y-auto font-mono leading-relaxed">
                  {e.body_text || e.content_preview || '(no body text)'}
                </div>
                <div className="flex gap-3 text-[11px] text-gray-400 flex-wrap">
                  <span>body.text: {e.has_body_text ? '✅' : '❌'}</span>
                  <span>body.html: {e.has_body_html ? '✅' : '❌'}</span>
                  <span>auto-reply: {e.is_auto_reply ? 'Yes' : 'No'}</span>
                  <span>Original: {CLASSIFICATION_LABELS[e.original_classification]}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 font-medium">Override:</span>
                  <select value={override ?? ''} onChange={(ev) => saveOverride(e.id, ev.target.value)}
                    className="border border-gray-200 rounded px-2 py-1 bg-white text-xs focus:outline-none">
                    <option value="">(auto)</option>
                    {Object.entries(CLASSIFICATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  {override && <button onClick={() => saveOverride(e.id, '')} className="text-red-400 text-xs underline">Clear</button>}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {filtered.length === 0 && <div className="text-center py-8 text-sm text-gray-400">No replies match</div>}
    </div>
  );
}

// ─── Inbox ────────────────────────────────────────────────────────────────────

function InboxTab({ emails }: { emails: NormalizedEmail[] }) {
  const [positiveOnly, setPositiveOnly] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set());

  const positive = emails.filter((e) => e.is_positive);
  const base = positiveOnly ? positive : emails;

  // Count per classification on the base set (for chip badges)
  const classCounts = useMemo(() => {
    const m = new Map<string, number>();
    base.forEach((e) => m.set(e.final_classification, (m.get(e.final_classification) ?? 0) + 1));
    return m;
  }, [base]);

  // Multi-select filter
  const display = selectedClasses.size > 0
    ? base.filter((e) => selectedClasses.has(e.final_classification))
    : base;
  const sorted = [...display].sort((a, b) => b.timestamp_email.localeCompare(a.timestamp_email));

  function toggleClass(cls: string) {
    setSelectedClasses((prev) => {
      const next = new Set(prev);
      next.has(cls) ? next.delete(cls) : next.add(cls);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-sm font-semibold text-gray-700">
          <span className="text-emerald-600">{positive.length}</span> positive · {emails.length} total received
        </div>
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[11px] rounded px-2 py-1">
          Source: <code>/api/v2/emails?email_type=received</code>
        </div>
        <button
          onClick={() => { setPositiveOnly((v) => !v); setSelectedClasses(new Set()); }}
          className={`text-xs px-3 py-1.5 rounded-lg transition-colors border ${positiveOnly ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-medium' : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'}`}>
          {positiveOnly ? '✓ Positive only' : 'Show positive only'}
        </button>
      </div>

      {/* Multi-select classification chips */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mr-1">Filter by:</span>
        {Object.entries(CLASSIFICATION_LABELS).map(([key, label]) => {
          const count = classCounts.get(key as keyof typeof CLASSIFICATION_LABELS) ?? 0;
          if (count === 0) return null;
          const active = selectedClasses.has(key);
          return (
            <button
              key={key}
              onClick={() => toggleClass(key)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                active
                  ? 'bg-blue-600 text-white border-blue-600 font-medium'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {label} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
        {selectedClasses.size > 0 && (
          <button onClick={() => setSelectedClasses(new Set())} className="text-xs text-gray-400 hover:text-gray-600 underline ml-1">
            Clear ({selectedClasses.size})
          </button>
        )}
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-3xl mb-2">📭</div>
          <div className="text-sm">No replies match current filters</div>
        </div>
      )}
      <EmailList emails={sorted} />
    </div>
  );
}

// ─── Trends ───────────────────────────────────────────────────────────────────

function TrendsTab({ emails }: { emails: NormalizedEmail[] }) {
  const byWeek = useMemo(() => {
    const m = new Map<string, { replies: number; positive: number }>();
    emails.forEach((e) => {
      const cur = m.get(e.week) ?? { replies: 0, positive: 0 };
      cur.replies++; if (e.is_positive) cur.positive++;
      m.set(e.week, cur);
    });
    return [...m.entries()].filter(([w]) => w !== 'Unknown').sort((a, b) => a[0].localeCompare(b[0]));
  }, [emails]);

  if (byWeek.length === 0) return <div className="text-center py-12 text-sm text-gray-400">No dated email data in current filter</div>;

  const max = Math.max(...byWeek.map(([, v]) => v.replies), 1);
  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="text-sm font-semibold text-gray-700 mb-4">Replies by Week</div>
        <div className="space-y-1.5">
          {byWeek.map(([week, v]) => (
            <div key={week} className="flex items-center gap-3">
              <div className="text-[11px] text-gray-500 font-mono w-20">{week}</div>
              <div className="flex-1 flex items-center h-5 gap-px">
                <div className="h-full rounded-sm bg-blue-200" style={{ width: `${(v.replies / max) * 100}%`, minWidth: v.replies ? 3 : 0 }} />
                <div className="h-full rounded-sm bg-emerald-400" style={{ width: `${(v.positive / max) * 100}%`, minWidth: v.positive ? 3 : 0 }} />
              </div>
              <div className="text-[11px] text-gray-600 w-44 text-right">{v.replies} replies · <span className="text-emerald-600 font-medium">{v.positive} pos.</span> ({pct(v.positive, v.replies)})</div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-200 rounded inline-block" /> Replies</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-400 rounded inline-block" /> Positive</span>
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-400 uppercase">
            {['Week','Replies','Positive','Pos Rate'].map((h) => <th key={h} className={`py-2 px-4 ${h==='Week'?'text-left':'text-right'}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {byWeek.map(([week, v]) => (
              <tr key={week} className="border-b border-gray-50">
                <td className="py-2 px-4 font-mono text-xs">{week}</td>
                <td className="text-right px-4">{v.replies}</td>
                <td className="text-right px-4 text-emerald-600 font-medium">{v.positive}</td>
                <td className="text-right px-4">{pct(v.positive, v.replies)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Analytics ───────────────────────────────────────────────────────────────

/** Convert "2025-10" → "Oct '25" */
function monthToLabel(monthKey: string): string {
  try {
    const [year, month] = monthKey.split('-');
    const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  } catch { return monthKey; }
}

/** Extract a company hint from an email address domain */
function companyFromEmail(email: string): string | null {
  const domain = email?.split('@')[1] ?? '';
  const personal = ['gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com','aol.com','me.com','msn.com','live.com'];
  if (!domain || personal.includes(domain.toLowerCase())) return null;
  // Humanize: remove TLD, replace hyphens with spaces, title-case
  const name = domain.split('.')[0].replace(/-/g, ' ');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function AnalyticsTab({
  campaigns,
  emails,
  campaignStats,
}: {
  campaigns: NormalizedCampaign[];
  emails: NormalizedEmail[];
  campaignStats: ReturnType<typeof useBDData>['campaignStats'];
}) {
  const positive = emails.filter((e) => e.is_positive);

  // ── Classification breakdown ───────────────────────────────────────────────
  const classCounts = useMemo(() => {
    const m = new Map<string, number>();
    emails.forEach((e) => m.set(e.final_classification, (m.get(e.final_classification) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [emails]);
  const maxClass = Math.max(...classCounts.map(([, n]) => n), 1);

  // ── Org comparison ─────────────────────────────────────────────────────────
  const byOrg = useMemo(() => {
    const m = new Map<string, { label: string; sent: number; replies: number; positive: number; campaigns: number }>();
    campaigns.forEach((c) => {
      const cur = m.get(c.org_id) ?? { label: c.org_label, sent: 0, replies: 0, positive: 0, campaigns: 0 };
      cur.sent += c.sent; cur.campaigns++;
      m.set(c.org_id, cur);
    });
    emails.forEach((e) => {
      const cur = m.get(e.org_id);
      if (!cur) return;
      cur.replies++;
      if (e.is_positive) cur.positive++;
    });
    return [...m.values()].sort((a, b) => b.positive - a.positive);
  }, [campaigns, emails]);

  // ── Sector comparison ──────────────────────────────────────────────────────
  const bySector = useMemo(() => {
    const m = new Map<string, { sent: number; replies: number; positive: number; campaigns: number }>();
    campaigns.forEach((c) => {
      const cur = m.get(c.sector) ?? { sent: 0, replies: 0, positive: 0, campaigns: 0 };
      cur.sent += c.sent; cur.campaigns++;
      m.set(c.sector, cur);
    });
    emails.forEach((e) => {
      const cur = m.get(e.sector);
      if (!cur) return;
      cur.replies++;
      if (e.is_positive) cur.positive++;
    });
    return [...m.entries()].sort((a, b) => b[1].positive - a[1].positive);
  }, [campaigns, emails]);
  const maxSectorPos = Math.max(...bySector.map(([, v]) => v.positive), 1);

  // ── Monthly activity — richer breakdown per period ────────────────────────
  type MonthRow = {
    total: number; positive: number; meetings: number;
    more_info: number; referral: number; neutral: number;
    not_interested: number; unsubscribe: number; ooo: number;
    auto_reply: number; bounce: number;
  };
  const byMonth = useMemo(() => {
    const m = new Map<string, MonthRow>();
    emails.forEach((e) => {
      if (!e.timestamp_email || e.timestamp_email.length < 7) return;
      const key = e.timestamp_email.slice(0, 7); // "2025-10"
      const cur = m.get(key) ?? { total: 0, positive: 0, meetings: 0, more_info: 0, referral: 0, neutral: 0, not_interested: 0, unsubscribe: 0, ooo: 0, auto_reply: 0, bounce: 0 };
      cur.total++;
      const cls = e.final_classification;
      if (cls === 'positive_interested')   cur.positive++;
      else if (cls === 'meeting_requested')    cur.meetings++;
      else if (cls === 'more_info_requested')  cur.more_info++;
      else if (cls === 'referral_given')       cur.referral++;
      else if (cls === 'neutral_needs_review') cur.neutral++;
      else if (cls === 'not_interested')       cur.not_interested++;
      else if (cls === 'unsubscribe')          cur.unsubscribe++;
      else if (cls === 'out_of_office')        cur.ooo++;
      else if (cls === 'auto_reply')           cur.auto_reply++;
      else if (cls === 'bounce')               cur.bounce++;
      m.set(key, cur);
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [emails]);
  const maxMonthTotal = Math.max(...byMonth.map(([, v]) => v.total), 1);

  // 4 executive buckets — detail in table below
  function monthBuckets(v: MonthRow) {
    const qualified = v.positive + v.meetings + v.more_info + v.referral;      // green
    const neutral   = v.neutral + v.ooo + v.auto_reply + v.bounce;             // gray (all non-human routing)
    const negative  = v.not_interested;                                         // red
    const optout    = v.unsubscribe;                                            // orange
    return { qualified, neutral, negative, optout };
  }

  // ── Top campaigns — ranked by filtered positive count ─────────────────────
  const topCampaigns = [...campaigns]
    .map((c) => ({ c, pos: campaignStats.get(c.campaign_id)?.positive ?? 0, rcv: campaignStats.get(c.campaign_id)?.received ?? 0, human: campaignStats.get(c.campaign_id)?.human ?? 0 }))
    .filter(({ pos }) => pos > 0)
    .sort((a, b) => b.pos - a.pos)
    .slice(0, 10);

  const totalReplies = emails.length;
  // Human replies = filtered emails minus automated/unsubscribe
  const totalHuman = emails.filter(e => !e.is_auto_reply && e.final_classification !== 'unsubscribe').length;
  const totalSent = campaigns.reduce((s, c) => s + c.sent, 0);

  function Bar({ value, max, color = '#3b82f6', height = 'h-3' }: { value: number; max: number; color?: string; height?: string }) {
    return (
      <div className={`w-full bg-gray-100 rounded-full ${height} overflow-hidden`}>
        <div className={`${height} rounded-full transition-all`} style={{ width: `${Math.max((value / max) * 100, value > 0 ? 2 : 0)}%`, backgroundColor: color }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Received', value: totalReplies.toLocaleString(), color: 'text-gray-900' },
          { label: 'Human Replies', value: totalHuman.toLocaleString(), color: 'text-gray-700' },
          { label: 'Actionable', value: positive.length.toLocaleString(), color: 'text-emerald-600' },
          { label: 'Actionable Rate', value: totalHuman > 0 ? (positive.length / totalHuman * 100).toFixed(1) + '%' : '—', color: 'text-emerald-600' },
          { label: 'Sent (all-time)', value: totalSent.toLocaleString(), color: 'text-blue-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-3 text-center shadow-sm">
            <div className={`text-xl font-bold tabular-nums ${color}`}>{value}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Monthly Reply Activity ─────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between flex-wrap gap-3">
          <div>
            <span className="text-sm font-semibold text-gray-700">Monthly Reply Activity</span>
            <div className="text-[11px] text-gray-400 mt-0.5">
              Bar width = reply volume. Color = reply quality. Longer + greener = better month.
            </div>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#34d399' }} /> Qualified</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gray-200 inline-block" /> Neutral / Routing</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#fca5a5' }} /> Negative</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#fdba74' }} /> Opt-out</span>
          </div>
        </div>

        {byMonth.length === 0 && (
          <div className="text-center py-10 text-sm text-gray-400">No dated email data in current filter</div>
        )}

        <div className="px-4 py-4 space-y-3">
          {byMonth.map(([monthKey, v]) => {
            const { qualified, neutral, negative, optout } = monthBuckets(v);
            // Segment widths are % of the bar width (which itself = % of track)
            const qPct  = v.total > 0 ? (qualified / v.total) * 100 : 0;
            const nPct  = v.total > 0 ? (neutral   / v.total) * 100 : 0;
            const rPct  = v.total > 0 ? (negative  / v.total) * 100 : 0;
            const oPct  = v.total > 0 ? (optout    / v.total) * 100 : 0;
            // Bar width = volume relative to busiest month
            const barW  = (v.total / maxMonthTotal) * 100;
            const isHighOptout = oPct >= 10;

            return (
              <div key={monthKey} className="flex items-center gap-3">
                {/* Month label */}
                <div className="text-xs text-gray-500 font-medium w-14 flex-shrink-0 text-right tabular-nums">
                  {monthToLabel(monthKey)}
                </div>

                {/* Track — full width background, colored bar absolutely inside */}
                <div className="flex-1 relative h-6 bg-gray-100 rounded-md overflow-hidden">
                  {/* Volume-scaled inner bar with 4 color segments */}
                  <div className="absolute inset-y-0 left-0 flex h-full" style={{ width: `${barW}%` }}>
                    {qPct > 0 && (
                      <div style={{ width: `${qPct}%`, backgroundColor: '#34d399' }} className="h-full"
                        title={`Qualified: ${qualified} (${qPct.toFixed(0)}%)`} />
                    )}
                    {nPct > 0 && (
                      <div style={{ width: `${nPct}%` }} className="h-full bg-gray-300"
                        title={`Neutral/Routing: ${neutral} (${nPct.toFixed(0)}%)`} />
                    )}
                    {rPct > 0 && (
                      <div style={{ width: `${rPct}%`, backgroundColor: '#fca5a5' }} className="h-full"
                        title={`Negative: ${negative} (${rPct.toFixed(0)}%)`} />
                    )}
                    {oPct > 0 && (
                      <div style={{ width: `${oPct}%`, backgroundColor: '#fdba74' }} className="h-full"
                        title={`Opt-out: ${optout} (${oPct.toFixed(0)}%)`} />
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="w-60 flex-shrink-0 flex items-center gap-2 text-[11px]">
                  <span className="text-gray-500 tabular-nums font-medium">{v.total}</span>
                  <span className="text-gray-300">·</span>
                  <span className={`font-semibold tabular-nums ${qPct > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>
                    {qPct.toFixed(0)}% qualified
                  </span>
                  {isHighOptout && (
                    <span className="text-orange-500 font-medium tabular-nums">· ⚠ {oPct.toFixed(0)}% opt-out</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Detailed table */}
        {byMonth.length > 0 && (
          <div className="border-t border-gray-100 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[10px] text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-2">Month</th>
                  <th className="text-right px-2 py-2">Total</th>
                  <th className="text-right px-2 py-2 text-emerald-600">Positive</th>
                  <th className="text-right px-2 py-2 text-purple-600">Meeting</th>
                  <th className="text-right px-2 py-2 text-blue-600">More Info</th>
                  <th className="text-right px-2 py-2 text-cyan-600">Referral</th>
                  <th className="text-right px-2 py-2 text-gray-400">Neutral</th>
                  <th className="text-right px-2 py-2 text-red-500">Not Int.</th>
                  <th className="text-right px-2 py-2 text-orange-500">Unsub</th>
                  <th className="text-right px-2 py-2 text-gray-300">OOO</th>
                  <th className="text-right px-2 py-2 text-gray-300">Auto</th>
                  <th className="text-right px-2 py-2 text-gray-300">Bounce</th>
                  <th className="text-right px-3 py-2">Pos%</th>
                </tr>
              </thead>
              <tbody>
                {byMonth.map(([monthKey, v]) => {
                  const engagedTotal = v.positive + v.meetings + v.more_info + v.referral;
                  const posRate = v.total > 0 ? (engagedTotal / v.total * 100).toFixed(1) + '%' : '—';
                  const hasIssue = v.unsubscribe > 0 && v.total > 0 && (v.unsubscribe / v.total) >= 0.1;
                  return (
                    <tr key={monthKey} className={`border-b border-gray-50 hover:bg-gray-50 ${hasIssue ? 'bg-orange-50/40' : ''}`}>
                      <td className="px-4 py-1.5 font-semibold text-gray-700">{monthToLabel(monthKey)}</td>
                      <td className="text-right px-2 py-1.5 font-medium">{v.total}</td>
                      <td className="text-right px-2 py-1.5 text-emerald-600 font-semibold">{v.positive || '—'}</td>
                      <td className="text-right px-2 py-1.5 text-purple-600">{v.meetings || '—'}</td>
                      <td className="text-right px-2 py-1.5 text-blue-600">{v.more_info || '—'}</td>
                      <td className="text-right px-2 py-1.5 text-cyan-600">{v.referral || '—'}</td>
                      <td className="text-right px-2 py-1.5 text-gray-400">{v.neutral || '—'}</td>
                      <td className="text-right px-2 py-1.5 text-red-500">{v.not_interested || '—'}</td>
                      <td className={`text-right px-2 py-1.5 font-semibold ${v.unsubscribe > 0 ? 'text-orange-500' : 'text-gray-300'}`}>{v.unsubscribe || '—'}</td>
                      <td className="text-right px-2 py-1.5 text-gray-400">{v.ooo || '—'}</td>
                      <td className="text-right px-2 py-1.5 text-gray-400">{v.auto_reply || '—'}</td>
                      <td className="text-right px-2 py-1.5 text-gray-400">{v.bounce || '—'}</td>
                      <td className="text-right px-3 py-1.5 font-semibold text-emerald-600">{posRate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-4 py-2 text-[10px] text-amber-600 border-t border-gray-100 bg-amber-50/50">
          ⚠ "Unsub" counts here are from email reply classification (Instantly's received emails). Campaign-level bounce/unsub rates (all-time) are visible in the Sectors drill-down view.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sector performance */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 text-sm font-semibold text-gray-700">Sector Performance</div>
          <div className="p-4 space-y-2.5">
            {bySector.map(([sector, v]) => (
              <div key={sector} className="flex items-center gap-2">
                <div className="text-xs text-gray-700 w-40 flex-shrink-0 truncate font-medium">{sector}</div>
                <div className="flex-1">
                  <Bar value={v.positive} max={maxSectorPos} color="#10b981" />
                </div>
                <div className="text-[11px] tabular-nums text-right w-28 flex-shrink-0 text-gray-500">
                  <span className="text-emerald-600 font-semibold">{v.positive}</span> / {v.replies} replies
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top campaigns by positive replies */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 text-sm font-semibold text-gray-700">Top Campaigns by Positive Replies</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 text-[10px] uppercase tracking-wide border-b border-gray-100">
                  <th className="text-left px-4 py-2">Campaign</th>
                  <th className="text-right px-3 py-2">Positive</th>
                  <th className="text-right px-3 py-2">Replies</th>
                  <th className="text-right px-3 py-2">Pos%</th>
                </tr>
              </thead>
              <tbody>
                {topCampaigns.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-6 text-gray-400">No campaigns with positive replies</td></tr>
                )}
                {topCampaigns.map(({ c, pos, rcv, human }) => (
                  <tr key={c.campaign_id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 max-w-[180px]">
                      <div className="font-medium text-gray-800 truncate">{c.campaign_name}</div>
                      <div className="text-[10px] text-gray-400">{c.org_label} · {c.state}</div>
                    </td>
                    <td className="text-right px-3 py-2 text-emerald-600 font-bold">{pos}</td>
                    <td className="text-right px-3 py-2">{rcv}</td>
                    <td className="text-right px-3 py-2" title="Actionable ÷ human replies">{human > 0 ? (pos / human * 100).toFixed(1) + '%' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Classification breakdown */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 text-sm font-semibold text-gray-700">
            Reply Classification Breakdown
          </div>
          <div className="p-4 space-y-2.5">
            {classCounts.map(([cls, count]) => {
              const label = CLASSIFICATION_LABELS[cls as keyof typeof CLASSIFICATION_LABELS] ?? cls;
              const isPos = ['positive_interested','meeting_requested','referral_given','more_info_requested'].includes(cls);
              const barColor = isPos ? '#10b981' : cls === 'neutral_needs_review' ? '#9ca3af' : '#ef4444';
              return (
                <div key={cls} className="flex items-center gap-2">
                  <div className="text-xs text-gray-600 w-44 flex-shrink-0 truncate">{label}</div>
                  <div className="flex-1">
                    <Bar value={count} max={maxClass} color={barColor} />
                  </div>
                  <div className="text-xs font-medium tabular-nums text-gray-700 w-10 text-right">{count}</div>
                  <div className="text-[11px] text-gray-400 w-10 text-right">{totalReplies > 0 ? (count / totalReplies * 100).toFixed(0) + '%' : '—'}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Org performance comparison */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 text-sm font-semibold text-gray-700">
            Org Performance Comparison
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 text-[10px] uppercase tracking-wide border-b border-gray-100">
                  <th className="text-left px-4 py-2">Org</th>
                  <th className="text-right px-3 py-2">Camps</th>
                  <th className="text-right px-3 py-2">Replies</th>
                  <th className="text-right px-3 py-2">Positive</th>
                  <th className="text-right px-3 py-2">Pos%</th>
                </tr>
              </thead>
              <tbody>
                {byOrg.map((o) => (
                  <tr key={o.label} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">{o.label}</td>
                    <td className="text-right px-3 py-2 text-gray-500">{o.campaigns}</td>
                    <td className="text-right px-3 py-2">{o.replies}</td>
                    <td className="text-right px-3 py-2 text-emerald-600 font-semibold">{o.positive}</td>
                    <td className="text-right px-3 py-2">{o.replies > 0 ? (o.positive / o.replies * 100).toFixed(1) + '%' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Compare ─────────────────────────────────────────────────────────────────

// Both sectors start grey; winner turns green, loser turns blue
const C_GREY  = '#9ca3af';
const C_GREEN = '#22c55e';
const C_BLUE  = '#3b82f6';

type SectorProfile = {
  label: string;
  campaigns: NormalizedCampaign[];
  emails: NormalizedEmail[];
  positive: NormalizedEmail[];
  human: NormalizedEmail[];
  sent: number;
  byState: Map<string, { replies: number; positive: number }>;
  byMonth: Map<string, { total: number; actionable: number }>;
  byClass: Map<string, number>;
};

function buildProfile(sector: string, camps: NormalizedCampaign[], emails: NormalizedEmail[]): SectorProfile {
  const campaigns = camps.filter((c) => c.sector === sector);
  const sEmails = emails.filter((e) => e.sector === sector);
  const positive = sEmails.filter((e) => e.is_positive);
  const human = sEmails.filter((e) => !e.is_auto_reply && e.final_classification !== 'unsubscribe');
  const sent = campaigns.reduce((s, c) => s + c.sent, 0);

  const byState = new Map<string, { replies: number; positive: number }>();
  sEmails.forEach((e) => {
    if (!e.state || e.state === 'Unmapped') return;
    const cur = byState.get(e.state) ?? { replies: 0, positive: 0 };
    cur.replies++;
    if (e.is_positive) cur.positive++;
    byState.set(e.state, cur);
  });

  const ACTIONABLE = new Set(['positive_interested','meeting_requested','referral_given','more_info_requested']);
  const byMonth = new Map<string, { total: number; actionable: number }>();
  sEmails.forEach((e) => {
    if (!e.timestamp_email || e.timestamp_email.length < 7) return;
    const key = e.timestamp_email.slice(0, 7);
    const z = byMonth.get(key) ?? { total: 0, actionable: 0 };
    z.total++;
    if (ACTIONABLE.has(e.final_classification)) z.actionable++;
    byMonth.set(key, z);
  });

  const byClass = new Map<string, number>();
  sEmails.forEach((e) => {
    byClass.set(e.final_classification, (byClass.get(e.final_classification) ?? 0) + 1);
  });

  return { label: sector, campaigns, emails: sEmails, positive, human, sent, byState, byMonth, byClass };
}

function buildOwnerProfile(owner: string, camps: NormalizedCampaign[], emails: NormalizedEmail[]): SectorProfile {
  const campaigns = camps.filter((c) => c.bd_owner === owner);
  const sEmails = emails.filter((e) => e.bd_owner === owner);
  const positive = sEmails.filter((e) => e.is_positive);
  const human = sEmails.filter((e) => !e.is_auto_reply && e.final_classification !== 'unsubscribe');
  const sent = campaigns.reduce((s, c) => s + c.sent, 0);

  const byState = new Map<string, { replies: number; positive: number }>();
  sEmails.forEach((e) => {
    if (!e.state || e.state === 'Unmapped') return;
    const cur = byState.get(e.state) ?? { replies: 0, positive: 0 };
    cur.replies++;
    if (e.is_positive) cur.positive++;
    byState.set(e.state, cur);
  });

  const ACTIONABLE = new Set(['positive_interested','meeting_requested','referral_given','more_info_requested']);
  const byMonth = new Map<string, { total: number; actionable: number }>();
  sEmails.forEach((e) => {
    if (!e.timestamp_email || e.timestamp_email.length < 7) return;
    const key = e.timestamp_email.slice(0, 7);
    const z = byMonth.get(key) ?? { total: 0, actionable: 0 };
    z.total++;
    if (ACTIONABLE.has(e.final_classification)) z.actionable++;
    byMonth.set(key, z);
  });

  const byClass = new Map<string, number>();
  sEmails.forEach((e) => {
    byClass.set(e.final_classification, (byClass.get(e.final_classification) ?? 0) + 1);
  });

  return { label: owner, campaigns, emails: sEmails, positive, human, sent, byState, byMonth, byClass };
}

function CmpKpi({ label, a, b, colorA, colorB, higherBetter = true, fmt: f }: {
  label: string; a: number; b: number; colorA: string; colorB: string; higherBetter?: boolean; fmt?: (n: number) => string;
}) {
  const fmtN = f ?? ((n: number) => n.toLocaleString());
  const kpiWinner: 'A' | 'B' | null = a === b ? null : higherBetter ? (a > b ? 'A' : 'B') : (a < b ? 'A' : 'B');
  const max = Math.max(a, b, 1);
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">{label}</div>
      <div className="space-y-2">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium" style={{ color: colorA }}>A</span>
            <span className="text-base font-bold tabular-nums" style={{ color: colorA }}>
              {fmtN(a)}{kpiWinner === 'A' && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded text-white font-bold" style={{ backgroundColor: colorA }}>W</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(a / max) * 100}%`, backgroundColor: colorA }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium" style={{ color: colorB }}>B</span>
            <span className="text-base font-bold tabular-nums" style={{ color: colorB }}>
              {fmtN(b)}{kpiWinner === 'B' && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded text-white font-bold" style={{ backgroundColor: colorB }}>W</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(b / max) * 100}%`, backgroundColor: colorB }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthlyBarChart({
  allMonths, profA, profB, colorA, colorB, maxMonthTotal,
}: {
  allMonths: string[];
  profA: SectorProfile;
  profB: SectorProfile;
  colorA: string;
  colorB: string;
  maxMonthTotal: number;
}) {
  return (
    <div className="space-y-3">
      {allMonths.map((m) => {
        const va = profA.byMonth.get(m)?.total ?? 0;
        const vb = profB.byMonth.get(m)?.total ?? 0;
        const pctA = maxMonthTotal > 0 ? Math.round((va / maxMonthTotal) * 100) : 0;
        const pctB = maxMonthTotal > 0 ? Math.round((vb / maxMonthTotal) * 100) : 0;
        return (
          <div key={m}>
            <div className="text-xs font-medium text-gray-500 mb-1.5">{monthToLabel(m)}</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400 w-20 text-right truncate shrink-0">{profA.label}</span>
                <div className="flex-1 bg-gray-100 rounded h-5 relative overflow-hidden">
                  <div className="h-5 rounded transition-all duration-300" style={{ width: `${pctA}%`, backgroundColor: colorA, opacity: 0.85, minWidth: va > 0 ? 4 : 0 }} />
                  {va > 0 && <span className="absolute inset-0 flex items-center pl-2 text-[11px] font-semibold text-white mix-blend-luminosity">{va}</span>}
                </div>
                <span className="text-[11px] text-gray-400 w-6 shrink-0">{va || ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400 w-20 text-right truncate shrink-0">{profB.label}</span>
                <div className="flex-1 bg-gray-100 rounded h-5 relative overflow-hidden">
                  <div className="h-5 rounded transition-all duration-300" style={{ width: `${pctB}%`, backgroundColor: colorB, opacity: 0.85, minWidth: vb > 0 ? 4 : 0 }} />
                  {vb > 0 && <span className="absolute inset-0 flex items-center pl-2 text-[11px] font-semibold text-white mix-blend-luminosity">{vb}</span>}
                </div>
                <span className="text-[11px] text-gray-400 w-6 shrink-0">{vb || ''}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CompareTab({ filteredCampaigns, filteredEmails, sectorA, setSectorA, sectorB, setSectorB, compareMode, setCompareMode, ownerA, setOwnerA, ownerB, setOwnerB }: {
  filteredCampaigns: NormalizedCampaign[];
  filteredEmails: NormalizedEmail[];
  sectorA: string; setSectorA: (s: string) => void;
  sectorB: string; setSectorB: (s: string) => void;
  compareMode: CompareMode; setCompareMode: (m: CompareMode) => void;
  ownerA: string; setOwnerA: (s: string) => void;
  ownerB: string; setOwnerB: (s: string) => void;
}) {
  const sectorList = useMemo(() => {
    const present = new Set(filteredCampaigns.map((c) => c.sector));
    return SECTOR_OPTIONS.filter((s) => present.has(s) && s !== 'Other / Unmapped');
  }, [filteredCampaigns]);

  const ownerList = useMemo(() => {
    return [...new Set(filteredCampaigns.map((c) => c.bd_owner).filter(Boolean))].sort();
  }, [filteredCampaigns]);

  // Auto-select first two when list becomes available and nothing is set yet
  useEffect(() => {
    if (compareMode === 'sector') {
      if (sectorList.length > 0 && !sectorA) setSectorA(sectorList[0]);
      if (sectorList.length > 1 && !sectorB) setSectorB(sectorList[1]);
    } else {
      if (ownerList.length > 0 && !ownerA) setOwnerA(ownerList[0]);
      if (ownerList.length > 1 && !ownerB) setOwnerB(ownerList[1]);
    }
  }, [sectorList, ownerList, compareMode, sectorA, sectorB, ownerA, ownerB, setSectorA, setSectorB, setOwnerA, setOwnerB]);

  const profA = useMemo(() => {
    if (compareMode === 'sector') return sectorA ? buildProfile(sectorA, filteredCampaigns, filteredEmails) : null;
    return ownerA ? buildOwnerProfile(ownerA, filteredCampaigns, filteredEmails) : null;
  }, [compareMode, sectorA, ownerA, filteredCampaigns, filteredEmails]);
  const profB = useMemo(() => {
    if (compareMode === 'sector') return sectorB ? buildProfile(sectorB, filteredCampaigns, filteredEmails) : null;
    return ownerB ? buildOwnerProfile(ownerB, filteredCampaigns, filteredEmails) : null;
  }, [compareMode, sectorB, ownerB, filteredCampaigns, filteredEmails]);

  const allMonths = useMemo(() => {
    const s = new Set([...(profA ? [...profA.byMonth.keys()] : []), ...(profB ? [...profB.byMonth.keys()] : [])]);
    return [...s].filter(Boolean).sort();
  }, [profA, profB]);

  const maxMonthTotal = useMemo(() => {
    let m = 1;
    allMonths.forEach((k) => m = Math.max(m, profA?.byMonth.get(k)?.total ?? 0, profB?.byMonth.get(k)?.total ?? 0));
    return m;
  }, [allMonths, profA, profB]);

  const allClasses = useMemo(() => {
    const s = new Set([...(profA ? [...profA.byClass.keys()] : []), ...(profB ? [...profB.byClass.keys()] : [])]);
    const ACTIONABLE = ['positive_interested','meeting_requested','referral_given','more_info_requested'];
    return [...s].sort((a, b) => {
      const aP = ACTIONABLE.includes(a); const bP = ACTIONABLE.includes(b);
      return aP !== bP ? (aP ? -1 : 1) : a.localeCompare(b);
    });
  }, [profA, profB]);

  const topCampsA = useMemo(() => profA ? [...profA.campaigns].sort((a, b) => b.positive_reply_count - a.positive_reply_count).slice(0, 5) : [], [profA]);
  const topCampsB = useMemo(() => profB ? [...profB.campaigns].sort((a, b) => b.positive_reply_count - a.positive_reply_count).slice(0, 5) : [], [profB]);

  const posRateA = profA && profA.human.length > 0 ? profA.positive.length / profA.human.length * 100 : 0;
  const posRateB = profB && profB.human.length > 0 ? profB.positive.length / profB.human.length * 100 : 0;

  const scores = useMemo(() => {
    if (!profA || !profB) return { A: 0, B: 0 };
    const pairs = [
      [posRateA, posRateB],
      [profA.positive.length, profB.positive.length],
      [profA.emails.length, profB.emails.length],
      [profA.campaigns.reduce((s, c) => s + c.opportunities, 0), profB.campaigns.reduce((s, c) => s + c.opportunities, 0)],
    ];
    return pairs.reduce((acc, [a, b]) => {
      if (a > b) acc.A++; else if (b > a) acc.B++;
      return acc;
    }, { A: 0, B: 0 });
  }, [profA, profB, posRateA, posRateB]);

  const compareSelector = (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        {/* Mode toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
          <button type="button" onClick={() => setCompareMode('sector')}
            className={`px-3 py-1.5 transition-colors ${compareMode === 'sector' ? 'bg-gray-700 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
            By Sector
          </button>
          <button type="button" onClick={() => setCompareMode('owner')}
            className={`px-3 py-1.5 transition-colors ${compareMode === 'owner' ? 'bg-gray-700 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
            By BD Owner
          </button>
        </div>
        <span className="text-gray-300 text-sm">|</span>
        <span className="text-xs text-gray-400">date · org · state filters apply — {compareMode === 'sector' ? 'sector' : 'BD owner'} filter ignored</span>

        {compareMode === 'sector' ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded text-white bg-gray-400">A</span>
              <select value={sectorA} onChange={(e) => setSectorA(e.target.value)}
                className="text-sm rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300">
                <option value="">Select sector</option>
                {sectorList.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <span className="text-gray-300 text-xl font-light">vs</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded text-white bg-gray-400">B</span>
              <select value={sectorB} onChange={(e) => setSectorB(e.target.value)}
                className="text-sm rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300">
                <option value="">Select sector</option>
                {sectorList.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded text-white bg-gray-400">A</span>
              <select value={ownerA} onChange={(e) => setOwnerA(e.target.value)}
                className="text-sm rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300">
                <option value="">Select owner</option>
                {ownerList.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <span className="text-gray-300 text-xl font-light">vs</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded text-white bg-gray-400">B</span>
              <select value={ownerB} onChange={(e) => setOwnerB(e.target.value)}
                className="text-sm rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300">
                <option value="">Select owner</option>
                {ownerList.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const emptyMsg = compareMode === 'sector' ? 'Select two sectors to compare' : ownerList.length === 0 ? 'No BD owners assigned to campaigns yet' : 'Select two BD owners to compare';
  if (!profA || !profB) return <div className="space-y-4">{compareSelector}<div className="text-center py-16 text-gray-400 text-sm">{emptyMsg}</div></div>;

  const winner: 'A' | 'B' | null = scores.A > scores.B ? 'A' : scores.B > scores.A ? 'B' : null;
  // Dynamic colors: winner = green, loser = blue, tied = grey
  const colorA = winner === 'A' ? C_GREEN : winner === 'B' ? C_BLUE : C_GREY;
  const colorB = winner === 'B' ? C_GREEN : winner === 'A' ? C_BLUE : C_GREY;
  const mapColorA: 'green' | 'blue' = winner === 'A' ? 'green' : 'blue';
  const mapColorB: 'green' | 'blue' = winner === 'B' ? 'green' : 'blue';

  return (
    <div className="space-y-5">
      {compareSelector}

      {/* Scoreboard */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <div className="px-4 py-2.5 text-center" style={{ backgroundColor: `${colorA}12` }}>
            <div className="text-2xl font-black" style={{ color: colorA }}>{scores.A}</div>
            <div className="text-xs font-semibold text-gray-700 mt-0.5">{profA.label}</div>
            <div className="text-[10px] text-gray-400">{profA.campaigns.length} campaigns · {profA.emails.length} replies</div>
            {winner === 'A' && <div className="mt-1 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: colorA }}>Winner</div>}
          </div>
          <div className="px-4 py-2.5 text-center bg-gray-50 flex flex-col items-center justify-center">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">Score</div>
            <div className="text-3xl font-black text-gray-300">{scores.A} : {scores.B}</div>
            {winner === null && <div className="text-[10px] text-gray-400 font-medium">Tied</div>}
          </div>
          <div className="px-4 py-2.5 text-center" style={{ backgroundColor: `${colorB}12` }}>
            <div className="text-2xl font-black" style={{ color: colorB }}>{scores.B}</div>
            <div className="text-xs font-semibold text-gray-700 mt-0.5">{profB.label}</div>
            <div className="text-[10px] text-gray-400">{profB.campaigns.length} campaigns · {profB.emails.length} replies</div>
            {winner === 'B' && <div className="mt-1 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: colorB }}>Winner</div>}
          </div>
        </div>
      </div>

      {/* Score explanation */}
      <div className="text-[11px] text-gray-400 -mt-2 px-1">
        Score = number of metrics won out of 4: <span className="font-medium text-gray-500">Positive Reply Rate · Positive Replies · Total Replies · Opportunities</span>. Higher is better for all except Bounces (lower is better, counted separately).
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <CmpKpi label="Positive Replies" a={profA.positive.length} b={profB.positive.length} colorA={colorA} colorB={colorB} />
        <CmpKpi label="Actionable Rate" a={posRateA} b={posRateB} colorA={colorA} colorB={colorB} fmt={(n) => n.toFixed(1) + '%'} />
        <CmpKpi label="Total Replies" a={profA.emails.length} b={profB.emails.length} colorA={colorA} colorB={colorB} />
        <CmpKpi label="Opportunities" a={profA.campaigns.reduce((s, c) => s + c.opportunities, 0)} b={profB.campaigns.reduce((s, c) => s + c.opportunities, 0)} colorA={colorA} colorB={colorB} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <CmpKpi label="Sent (all-time)" a={profA.sent} b={profB.sent} colorA={colorA} colorB={colorB} />
        <CmpKpi label="Human Replies" a={profA.human.length} b={profB.human.length} colorA={colorA} colorB={colorB} />
        <CmpKpi label="Campaigns" a={profA.campaigns.length} b={profB.campaigns.length} colorA={colorA} colorB={colorB} />
        <CmpKpi label="Bounces (all-time)" a={profA.campaigns.reduce((s, c) => s + c.bounces, 0)} b={profB.campaigns.reduce((s, c) => s + c.bounces, 0)} colorA={colorA} colorB={colorB} higherBetter={false} />
      </div>

      {/* Dual heatmaps side by side */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 text-sm font-semibold text-gray-700">State Heatmap — Positive Replies</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
          <div>
            <div className="px-4 py-2 text-xs font-bold border-b border-gray-100" style={{ color: colorA, backgroundColor: `${colorA}12` }}>A — {profA.label}</div>
            <CompareHeatMap byState={profA.byState} color={mapColorA} label={profA.label} />
          </div>
          <div>
            <div className="px-4 py-2 text-xs font-bold border-b border-gray-100" style={{ color: colorB, backgroundColor: `${colorB}12` }}>B — {profB.label}</div>
            <CompareHeatMap byState={profB.byState} color={mapColorB} label={profB.label} />
          </div>
        </div>
      </div>

      {/* Monthly grouped bar chart */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
          <span className="text-sm font-semibold text-gray-700">Monthly Reply Volume</span>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: colorA }} />{profA.label}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: colorB }} />{profB.label}</span>
          </div>
        </div>
        {allMonths.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No monthly data</div>
        ) : (
          <div className="p-4">
            <MonthlyBarChart
              allMonths={allMonths}
              profA={profA}
              profB={profB}
              colorA={colorA}
              colorB={colorB}
              maxMonthTotal={maxMonthTotal}
            />
          </div>
        )}
      </div>

      {/* Reply classification + Best campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 text-sm font-semibold text-gray-700">Reply Classification Breakdown</div>
          <div className="p-4 space-y-3">
            {allClasses.map((cls) => {
              const va = profA.byClass.get(cls) ?? 0;
              const vb = profB.byClass.get(cls) ?? 0;
              const maxV = Math.max(va, vb, 1);
              const label = CLASSIFICATION_LABELS[cls as keyof typeof CLASSIFICATION_LABELS] ?? cls;
              return (
                <div key={cls}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">{label}</span>
                    <div className="flex items-center gap-2 text-[11px] tabular-nums">
                      <span className="font-semibold" style={{ color: colorA }}>{va}</span>
                      <span className="text-gray-300">·</span>
                      <span className="font-semibold" style={{ color: colorB }}>{vb}</span>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(va / maxV) * 100}%`, backgroundColor: colorA }} />
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(vb / maxV) * 100}%`, backgroundColor: colorB }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 text-sm font-semibold text-gray-700">Top Campaigns by Positive Replies</div>
          <div className="grid grid-cols-2 divide-x divide-gray-100 h-full">
            {([['A', profA, topCampsA, colorA], ['B', profB, topCampsB, colorB]] as const).map(([side, prof, camps, color]) => (
              <div key={side}>
                <div className="px-3 py-2 text-xs font-bold border-b border-gray-100" style={{ color, backgroundColor: `${color}12` }}>{prof.label}</div>
                {camps.length === 0 && <div className="px-3 py-6 text-xs text-gray-400 text-center">No data</div>}
                {camps.map((c, i) => (
                  <div key={c.campaign_id} className="px-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="flex gap-2">
                      <span className="text-[10px] text-gray-300 font-mono mt-px">{i + 1}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gray-800 truncate" title={c.campaign_name}>{c.campaign_name}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{c.state}</div>
                        <div className="text-xs font-bold mt-0.5" style={{ color }}>{c.positive_reply_count} pos · <span className="text-gray-400 font-normal">{c.actual_received_count} replies</span></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* State comparison table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 text-sm font-semibold text-gray-700">State-by-State Breakdown</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-[10px] text-gray-400 uppercase tracking-wide">
                <th className="text-left px-4 py-2">State</th>
                <th className="text-right px-3 py-2" style={{ color: colorA }}>A Replies</th>
                <th className="text-right px-3 py-2" style={{ color: colorA }}>A Pos</th>
                <th className="text-right px-3 py-2" style={{ color: colorA }}>A Pos%</th>
                <th className="text-right px-3 py-2" style={{ color: colorB }}>B Replies</th>
                <th className="text-right px-3 py-2" style={{ color: colorB }}>B Pos</th>
                <th className="text-right px-3 py-2" style={{ color: colorB }}>B Pos%</th>
                <th className="text-right px-3 py-2">Winner</th>
              </tr>
            </thead>
            <tbody>
              {[...new Set([...profA.byState.keys(), ...profB.byState.keys()])].sort().map((state) => {
                const sa = profA.byState.get(state);
                const sb = profB.byState.get(state);
                const pa = sa?.positive ?? 0; const pb = sb?.positive ?? 0;
                const rA = sa && sa.replies > 0 ? (pa / sa.replies * 100).toFixed(1) + '%' : '—';
                const rB = sb && sb.replies > 0 ? (pb / sb.replies * 100).toFixed(1) + '%' : '—';
                const w: 'A' | 'B' | null = pa > pb ? 'A' : pb > pa ? 'B' : null;
                return (
                  <tr key={state} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-1.5 font-medium text-gray-700">{state}</td>
                    <td className="text-right px-3 py-1.5 text-gray-500">{sa?.replies ?? '—'}</td>
                    <td className="text-right px-3 py-1.5 font-semibold" style={{ color: colorA }}>{pa || '—'}</td>
                    <td className="text-right px-3 py-1.5 text-gray-400">{rA}</td>
                    <td className="text-right px-3 py-1.5 text-gray-500">{sb?.replies ?? '—'}</td>
                    <td className="text-right px-3 py-1.5 font-semibold" style={{ color: colorB }}>{pb || '—'}</td>
                    <td className="text-right px-3 py-1.5 text-gray-400">{rB}</td>
                    <td className="text-right px-3 py-1.5">
                      {w && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: w === 'A' ? colorA : colorB }}>{w}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Compare Heatmap (one per sector, SSR-disabled) ───────────────────────────

const CompareHeatMap = dynamic(
  () => import('@/components/bd/CompareMap'),
  {
    ssr: false,
    loading: () => <div className="h-[300px] flex items-center justify-center text-sm text-gray-400">Loading map…</div>,
  }
);

// ─── Debug ────────────────────────────────────────────────────────────────────

type DebugOrg = {
  org: string; org_id: string; auth: string; api_key_preview?: string;
  campaigns_count?: number; emails_count?: number;
  analytics_tested?: { available: boolean; analytics: unknown } | null;
  emails_sample?: Array<{
    id: string; subject: string; from_email: string; timestamp_email: string;
    body_text: string; body_text_present: boolean; body_html_present: boolean;
    actual_reply_body_returned: boolean; ai_interest_value: number | null;
    content_preview: string; campaign_id: string; analytics_reply_count: unknown;
  }>;
  errors?: Record<string, string>; error?: string;
};

function DebugTab({ data }: { data: BDData | null }) {
  const [debugData, setDebugData] = useState<DebugOrg[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [ts, setTs] = useState('');

  async function run() {
    setLoading(true);
    try {
      const res = await fetch('/api/instantly/debug');
      setDebugData(await res.json());
      setTs(new Date().toLocaleTimeString());
    } catch (e) {
      setDebugData([{ org: 'Error', org_id: '', auth: 'error', error: String(e) }]);
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={run} disabled={loading}
          className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
          Run Debug Test
        </button>
        {ts && <span className="text-xs text-gray-400">Last run: {ts}</span>}
      </div>

      {data && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs space-y-1">
          <div className="font-semibold text-gray-700 mb-1">Cached data — {ago(data.fetched_at)}</div>
          <div className="text-gray-500">{data.total_campaigns} campaigns · {data.total_emails} emails</div>
          {data.orgs.map((o) => (
            <div key={o.org.id} className="flex flex-wrap gap-x-3 text-gray-600">
              <span className="font-medium">{o.org.label}:</span>
              <span>{o.campaigns.length} campaigns</span>
              <span>{o.emails.length} emails</span>
              <span>{o.campaigns.filter((c) => c.analytics_available).length} w/ analytics</span>
              {o.email_pull_warning && <span className="text-amber-600">⚠ {o.email_pull_warning}</span>}
              {Object.entries(o.errors).map(([k, v]) => <span key={k} className="text-red-500">✗ {k}: {v}</span>)}
            </div>
          ))}
        </div>
      )}

      {debugData && (
        <div className="space-y-3">
          {debugData.map((org) => (
            <div key={org.org} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className={`px-4 py-2.5 flex items-center gap-3 flex-wrap border-b text-sm font-medium ${org.auth==='ok' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                <span>{org.auth==='ok' ? '✅' : '❌'}</span>
                <span>{org.org}</span>
                <span className="text-xs text-gray-500 font-normal">key: {org.api_key_preview ?? '—'}</span>
                <span className="text-xs font-normal">{org.campaigns_count ?? 0} campaigns · {org.emails_count ?? 0} emails (first page)</span>
                {org.analytics_tested !== undefined && (
                  <span className={`text-xs font-normal ${org.analytics_tested?.available ? 'text-emerald-600' : 'text-amber-600'}`}>
                    analytics: {org.analytics_tested?.available ? 'available ✅' : 'unavailable ⚠'}
                  </span>
                )}
                {org.auth !== 'ok' && <span className="text-red-600 text-xs">{org.error}</span>}
              </div>
              {org.emails_sample && org.emails_sample.length > 0 && (
                <div className="p-3 space-y-2">
                  {org.emails_sample.map((e) => (
                    <div key={e.id} className="bg-gray-50 rounded-lg p-3 text-xs space-y-1.5">
                      <div className="flex flex-wrap gap-3">
                        <span className={`font-bold ${e.actual_reply_body_returned ? 'text-emerald-700' : 'text-red-600'}`}>
                          Reply body: {e.actual_reply_body_returned ? 'YES ✅' : 'NO ❌'}
                        </span>
                        <span className={e.body_text_present ? 'text-emerald-600' : 'text-gray-400'}>body.text: {e.body_text_present ? '✅' : '❌'}</span>
                        <span className={e.body_html_present ? 'text-emerald-600' : 'text-gray-400'}>body.html: {e.body_html_present ? '✅' : '❌'}</span>
                        <span>ai_interest: {e.ai_interest_value ?? '—'}</span>
                        <span>analytics replies: {String(e.analytics_reply_count)}</span>
                      </div>
                      <div><span className="text-gray-400">Subject: </span>{e.subject} · <span className="text-gray-400">From: </span>{e.from_email} · <span className="text-gray-400">{new Date(e.timestamp_email).toLocaleDateString()}</span></div>
                      <div className="bg-white border border-gray-200 rounded p-2 max-h-40 overflow-y-auto font-mono whitespace-pre-wrap leading-relaxed">
                        {e.body_text.slice(0, 600) || e.content_preview || '(no body)'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {org.errors && Object.keys(org.errors).length > 0 && (
                <div className="px-3 pb-2 text-xs text-red-600 space-y-0.5">
                  {Object.entries(org.errors).map(([k, v]) => <div key={k}>✗ {k}: {v}</div>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sentiment Analysis Tab ───────────────────────────────────────────────────

// Display theme config — merges raw classifications into meaningful business labels
type DisplayThemeId = 'positive' | 'more_info' | 'follow_up_later' | 'dnc_not_interested' | 'automated' | 'neutral';

const DISPLAY_THEME_CONFIG: Record<DisplayThemeId, { label: string; color: string }> = {
  positive:           { label: 'Interested / Wants to Connect',       color: '#10B981' },
  more_info:          { label: 'Requested More Information',           color: '#0EA5E9' },
  follow_up_later:    { label: 'Follow Up Later / Not Right Now',      color: '#F59E0B' },
  dnc_not_interested: { label: 'DNC / Remove / Not Interested',        color: '#EF4444' },
  automated:          { label: 'Automated (OOO / Auto-Reply)',          color: '#9CA3AF' },
  neutral:            { label: 'Neutral / No Clear Signal',            color: '#6B7280' },
};

// Catches remove/unsubscribe intent even when Instantly overrides final_classification
const DNC_BODY_RE = /\bremove\b.{0,80}\bfrom\b.{0,30}\b(list|email list|mailing list|marketing|database|emails?)\b|\bremoved\b.{0,30}\bfrom\b.{0,30}\b(list|marketing|database|emails?)\b|\bto be removed\b|\b(contact|email) (info|information|address).{0,50}\bremov|\bunsubscribe\b|\bopt.?out\b|\bplease (remove|unsubscribe)\b|stop (emailing|contacting|sending)|don'?t (contact|email|reach out to) (me|us) (again|anymore|further)/i;

// Signals that someone wants to be contacted later — distinct from "not interested"
const FOLLOW_UP_RE = /\breach out (again|back|later|next week|next month|in \d|when i|after)\b|\bfollow.?up (later|next|in \d|when|after|in [a-z])|\bcall (me|us) (back|again|later|next|in \d)|\bcheck back (with|in|next|later|after)|\bnot (the |a )?right time\b|\bnot a good time\b|\btoo young to retire\b|\bnot (ready|looking) yet\b|\bget back to (you|me)\b|\breach back out\b|\bcontact (me|us) (in|next|after|later)\b|\btry (me|us) (again|next|later|in \d)\b|\bin (q[1-4]|january|february|march|april|may|june|july|august|september|october|november|december|the (spring|summer|fall|winter|new year))|\b\d+ (months?|weeks?|years?) (from now|away|out)\b|(reach out|follow up|call|email).{0,40}(next (week|month|quarter|year)|end of (the month|quarter|year))/i;

function getDisplayTheme(email: NormalizedEmail): DisplayThemeId {
  const cls = email.final_classification;
  const body = email.body_text || '';
  // DNC body check FIRST — overrides any Instantly signal that wrongly marks removal as positive
  if (DNC_BODY_RE.test(body)) return 'dnc_not_interested';
  if (cls === 'positive_interested' || cls === 'meeting_requested' || cls === 'referral_given') return 'positive';
  if (cls === 'more_info_requested') return 'more_info';
  // Follow-up-later: someone not saying no forever, just not now
  if (FOLLOW_UP_RE.test(body)) return 'follow_up_later';
  if (cls === 'not_interested' || cls === 'negative_complaint' || cls === 'unsubscribe') return 'dnc_not_interested';
  if (cls === 'out_of_office' || cls === 'auto_reply') return 'automated';
  return 'neutral';
}

function generateSentimentSummary(themeCounts: Record<DisplayThemeId, number>, total: number): string {
  if (total === 0) return 'N/A';
  if (total < 3) return 'Insufficient reply volume to draw a reliable sentiment conclusion.';
  const pos = themeCounts.positive ?? 0;
  const neg = themeCounts.dnc_not_interested ?? 0;
  const info = themeCounts.more_info ?? 0;
  const later = themeCounts.follow_up_later ?? 0;
  const neutral = themeCounts.neutral ?? 0;
  const posPct = pos / total;
  const negPct = neg / total;
  const laterPct = later / total;
  const neutralPct = neutral / total;
  if (posPct >= 0.6) {
    if (info >= pos * 0.4) return 'Replies were predominantly positive, with most contacts requesting additional information about the opportunity.';
    return 'Replies were predominantly positive, reflecting strong engagement and interest from contacts reached.';
  }
  if (negPct >= 0.6) return 'Replies were primarily negative, with most contacts indicating they are not interested or requesting removal.';
  if (laterPct >= 0.4) return 'A significant share of contacts asked to be followed up at a later time — strong pipeline signal.';
  if (neutralPct >= 0.5) return 'Replies were largely neutral or ambiguous, with limited clear signals of interest or disinterest.';
  if (posPct > negPct && posPct > neutralPct) {
    if (info + pos > total * 0.4) return 'Replies were mixed with a positive lean, with interest concentrated around information requests and follow-up conversations.';
    return 'Replies were mixed but leaning positive, with a notable share of contacts expressing openness or interest.';
  }
  if ((pos + later) > neg && (pos + later) > neutral) return `Replies show pipeline potential — ${pos} interested and ${later} asking to be followed up later.`;
  if (negPct > posPct && negPct > neutralPct) return 'Replies were mixed but leaning negative, with not-interested responses outpacing positive engagement.';
  return 'Replies were distributed across multiple themes with no single dominant sentiment pattern.';
}

type SentimentGroup = {
  key: string;
  org_id: string;
  org_label: string;
  sector: string;
  campaigns: NormalizedCampaign[];
  emails: NormalizedEmail[];
};

function SentKpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <div className="text-right">
        <span className="text-xs font-bold text-gray-800 tabular-nums">{value}</span>
        {sub && <div className="text-[10px] text-gray-400 tabular-nums">{sub}</div>}
      </div>
    </div>
  );
}

function SentimentBox({ group }: { group: SentimentGroup }) {
  const [expandedTheme, setExpandedTheme] = useState<DisplayThemeId | null>(null);

  // Exclude only hard bounces; OOO and auto-reply are shown under the Automated theme
  const analyzedEmails = useMemo(
    () => group.emails.filter((e) => e.final_classification !== 'bounce'),
    [group.emails]
  );

  const positiveEmails = useMemo(() => group.emails.filter((e) => e.is_positive), [group.emails]);

  // Build theme → emails map
  const themeEmailMap = useMemo(() => {
    const m = new Map<DisplayThemeId, NormalizedEmail[]>();
    analyzedEmails.forEach((e) => {
      const t = getDisplayTheme(e);
      if (!m.has(t)) m.set(t, []);
      m.get(t)!.push(e);
    });
    return m;
  }, [analyzedEmails]);

  const topThemes = useMemo(() => {
    return (Object.keys(DISPLAY_THEME_CONFIG) as DisplayThemeId[])
      .map((id) => ({ id, emails: themeEmailMap.get(id) ?? [], count: themeEmailMap.get(id)?.length ?? 0 }))
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [themeEmailMap]);

  const themeCounts = useMemo(() => {
    const c = {} as Record<DisplayThemeId, number>;
    (Object.keys(DISPLAY_THEME_CONFIG) as DisplayThemeId[]).forEach((id) => { c[id] = themeEmailMap.get(id)?.length ?? 0; });
    return c;
  }, [themeEmailMap]);

  const summary = useMemo(() => generateSentimentSummary(themeCounts, analyzedEmails.length), [themeCounts, analyzedEmails.length]);

  const bounceCount = group.emails.filter((e) => e.final_classification === 'bounce').length;
  const hasReplies = analyzedEmails.length > 0;

  const topThemeId = topThemes[0]?.id ?? null;
  const BOX_THEME: Record<DisplayThemeId, { bg: string; border: string }> = {
    positive:           { bg: 'bg-emerald-50',  border: 'border-emerald-200' },
    more_info:          { bg: 'bg-sky-50',       border: 'border-sky-200' },
    follow_up_later:    { bg: 'bg-amber-50',     border: 'border-amber-200' },
    dnc_not_interested: { bg: 'bg-red-50',       border: 'border-red-200' },
    automated:          { bg: 'bg-gray-50',      border: 'border-gray-200' },
    neutral:            { bg: 'bg-gray-50',      border: 'border-gray-200' },
  };
  const boxStyle = topThemeId ? BOX_THEME[topThemeId] : { bg: 'bg-white', border: 'border-gray-200' };

  return (
    <div className={`${boxStyle.bg} border ${boxStyle.border} rounded-xl shadow-sm overflow-hidden`}>
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">{group.org_label}</span>
              <span className="text-gray-300">|</span>
              <span className="text-sm font-bold text-gray-800">{group.sector || 'Other / Unmapped'}</span>
            </div>
            <div className="mt-1.5 flex items-start gap-1.5">
              <span className="text-[11px] font-semibold text-gray-500 shrink-0 mt-0.5">Overall Reply Sentiment:</span>
              {!hasReplies ? (
                <span className="text-xs text-gray-400 italic">N/A — no replies received in this period</span>
              ) : (
                <span className="text-xs text-gray-700 leading-relaxed">{summary}</span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0 text-[11px] text-gray-400">
            {group.campaigns.length} campaign{group.campaigns.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Top Reply Sentiments</div>
        {!hasReplies ? (
          <div className="space-y-2.5">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="w-4 text-xs font-bold text-gray-300 shrink-0">{i}.</span>
                <span className="text-xs text-gray-300 italic">N/A</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {Array.from({ length: 5 }, (_, i) => {
              const entry = topThemes[i];
              if (!entry) {
                return (
                  <div key={i} className="flex items-center gap-2.5 py-1">
                    <span className="w-4 text-xs font-bold text-gray-300 shrink-0">{i + 1}.</span>
                    <span className="text-xs text-gray-300 italic">N/A</span>
                  </div>
                );
              }
              const cfg = DISPLAY_THEME_CONFIG[entry.id];
              const pcnt = (entry.count / analyzedEmails.length * 100).toFixed(1);
              const barPct = topThemes[0] ? (entry.count / topThemes[0].count) * 100 : 0;
              const isExpanded = expandedTheme === entry.id;
              return (
                <div key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedTheme(isExpanded ? null : entry.id)}
                    className="w-full flex items-center gap-2.5 py-1.5 px-1 rounded-lg hover:bg-gray-50 transition-colors text-left group"
                  >
                    <span className="w-4 text-xs font-bold text-gray-400 shrink-0">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-700 truncate group-hover:text-gray-900">{cfg.label}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-semibold tabular-nums text-gray-700">{entry.count}</span>
                          <span className="text-[10px] text-gray-400 w-11 text-right tabular-nums">{pcnt}%</span>
                          <ChevronDown className={`h-3 w-3 text-gray-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: cfg.color }} />
                      </div>
                    </div>
                  </button>

                  {/* Expanded reply list */}
                  {isExpanded && (
                    <div className="ml-6 mt-1 mb-2 border border-gray-100 rounded-lg overflow-hidden divide-y divide-gray-50">
                      {entry.emails.slice(0, 10).map((e) => (
                        <div key={e.id} className="px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="text-xs font-semibold text-gray-800 truncate">{e.from_name || e.from_email || 'Unknown'}</span>
                            <span className="text-[10px] text-gray-400 shrink-0">
                              {e.timestamp_email ? new Date(e.timestamp_email).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-400 mb-1 truncate">{e.campaign_name}{e.state ? ` · ${e.state}` : ''}</div>
                          {(e.body_text || e.content_preview) && (
                            <div className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                              {(e.body_text || e.content_preview).slice(0, 300)}
                            </div>
                          )}
                        </div>
                      ))}
                      {entry.emails.length > 10 && (
                        <div className="px-3 py-2 text-[10px] text-gray-400 text-center bg-gray-50">
                          +{entry.emails.length - 10} more replies
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="text-[10px] text-gray-400 pt-1">
              {analyzedEmails.length} repl{analyzedEmails.length !== 1 ? 'ies' : 'y'} analyzed
              {bounceCount > 0 && ` · ${bounceCount} bounce${bounceCount !== 1 ? 's' : ''} excluded`}
              {' · '}click any row to see replies
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SentimentTab({ campaigns, emails }: { campaigns: NormalizedCampaign[]; emails: NormalizedEmail[] }) {
  const [onlyWithData, setOnlyWithData] = useState(true);

  const groups = useMemo<SentimentGroup[]>(() => {
    const map = new Map<string, SentimentGroup>();
    campaigns.forEach((c) => {
      const key = `${c.org_id}::${c.sector}`;
      if (!map.has(key)) {
        map.set(key, { key, org_id: c.org_id, org_label: c.org_label, sector: c.sector, campaigns: [], emails: [] });
      }
      map.get(key)!.campaigns.push(c);
    });
    emails.forEach((e) => {
      const key = `${e.org_id}::${e.sector}`;
      if (map.has(key)) map.get(key)!.emails.push(e);
    });
    return [...map.values()].sort((a, b) =>
      a.org_label.localeCompare(b.org_label) || a.sector.localeCompare(b.sector)
    );
  }, [campaigns, emails]);

  const visibleGroups = useMemo(
    () => onlyWithData ? groups.filter((g) => g.emails.length > 0) : groups,
    [groups, onlyWithData]
  );

  const hiddenCount = groups.length - visibleGroups.length;

  if (groups.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400 text-sm">
        No campaign data available for the selected filters.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-10 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm flex items-center justify-between gap-4">
        <span className="text-xs text-gray-500">
          Showing <strong>{visibleGroups.length}</strong> of <strong>{groups.length}</strong> org/sector combinations
          {hiddenCount > 0 && <span className="text-gray-400"> · {hiddenCount} hidden (no replies)</span>}
        </span>
        <button
          type="button"
          onClick={() => setOnlyWithData((v) => !v)}
          className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
            onlyWithData
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${onlyWithData ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
            {onlyWithData && <Check className="w-2.5 h-2.5 text-white" />}
          </span>
          Only show sectors with replies
        </button>
      </div>

      {visibleGroups.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No replies received in this period.{' '}
          <button onClick={() => setOnlyWithData(false)} className="text-blue-500 underline">Show all sectors</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {visibleGroups.map((g) => <SentimentBox key={g.key} group={g} />)}
        </div>
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function BDDashboard() {
  const [tab, setTab] = useState<TabId>('overview');
  const [sectorA, setSectorA] = useState('');
  const [sectorB, setSectorB] = useState('');
  const [compareMode, setCompareMode] = useState<CompareMode>('sector');
  const [ownerA, setOwnerA] = useState('');
  const [ownerB, setOwnerB] = useState('');
  const [copied, setCopied] = useState(false);
  const [urlReady, setUrlReady] = useState(false);

  const bd = useBDData();

  // On first mount: read URL and apply to state
  useEffect(() => {
    const parsed = parseUrl();
    bd.setFilters(parsed.filters);
    setTab(parsed.tab);
    if (parsed.sectorA) setSectorA(parsed.sectorA);
    if (parsed.sectorB) setSectorB(parsed.sectorB);
    setCompareMode(parsed.compareMode);
    if (parsed.ownerA) setOwnerA(parsed.ownerA);
    if (parsed.ownerB) setOwnerB(parsed.ownerB);
    setUrlReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  // Sync URL whenever filters/tab/sectors/compare change (after initial parse)
  useEffect(() => {
    if (!urlReady) return;
    const url = buildUrl(bd.filters, tab, sectorA, sectorB, compareMode, ownerA, ownerB);
    window.history.replaceState(null, '', url);
  }, [bd.filters, tab, sectorA, sectorB, compareMode, ownerA, ownerB, urlReady]);

  const copyLink = useCallback(() => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const isFiltered =
    bd.filters.datePreset !== 'all' ||
    bd.filters.orgs.length > 0 ||
    bd.filters.sectors.length > 0 ||
    !!bd.filters.state ||
    bd.filters.campaigns.length > 0 ||
    !!bd.filters.campaign_status ||
    !!bd.filters.has_positive_replies ||
    !!bd.filters.recommended_action;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <Image src="https://www.stocadvisory.com/_next/image?url=%2Fstoc-main-logo-cropped.png&w=256&q=75"
              alt="STOC Advisory" width={90} height={28} className="object-contain" unoptimized />
            <div className="h-5 w-px bg-gray-200" />
            <span className="text-sm font-semibold text-gray-700">BD Dashboard</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {bd.data && !bd.loading && (
              <span className="hidden sm:inline">
                {bd.data.total_campaigns} campaigns · {bd.data.total_emails} emails · updated {ago(bd.data.fetched_at)}
              </span>
            )}
            {bd.loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
            {/* Copy shareable link */}
            <button
              onClick={copyLink}
              title="Copy shareable link"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                copied
                  ? 'bg-green-50 text-green-600 border border-green-200'
                  : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
            </button>
            <button onClick={() => bd.hardRefresh()} disabled={bd.loading} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50" title="Force re-pull from Instantly API">
              <RefreshCw className="h-3.5 w-3.5 text-gray-500" />
            </button>
          </div>
        </div>
        <div className="max-w-[1800px] mx-auto px-6 flex gap-0.5 overflow-x-auto border-t border-gray-100">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.icon} <span className="hidden sm:inline">{t.label}</span>
              {t.id === 'compare' && (
                <span className="ml-0.5 text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200 rounded px-1 py-0.5 leading-none">Beta</span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-6 py-5 space-y-4">
        {bd.error && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {bd.error}
          </div>
        )}

        {!bd.loading && bd.data && (
          <>
            <FilterBar filters={bd.filters} options={bd.options}
              updateFilter={bd.updateFilter} setDatePreset={bd.setDatePreset} resetFilters={bd.resetFilters} />
            <FilterDebugBar
              totalCampaigns={bd.allCampaigns.length}
              filteredCampaigns={bd.filteredCampaigns.length}
              totalEmails={bd.allEmails.length}
              filteredEmails={bd.filteredEmails.length}
              filters={bd.filters}
              analyticsDateNote={bd.filters.datePreset !== 'all'}
            />
          </>
        )}

        {bd.loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-3">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">Loading all orgs from Instantly…</span>
            <span className="text-xs text-gray-300">First load takes 15–30s</span>
          </div>
        ) : !bd.data ? null : (
          <>
            {tab === 'overview'  && <OverviewTab campaigns={bd.filteredCampaigns} emails={bd.filteredEmails} stats={bd.stats} analyticsAvailable={bd.stats.analyticsAvailable} isFiltered={isFiltered} campaignStats={bd.campaignStats} />}
            {tab === 'sectors'   && <SectorsTab campaigns={bd.filteredCampaigns} emails={bd.filteredEmails} isFiltered={isFiltered} campaignStats={bd.campaignStats} />}
            {tab === 'states'    && <StatesTab campaigns={bd.filteredCampaigns} emails={bd.filteredEmails} isFiltered={isFiltered} />}
            {tab === 'compare'   && <CompareTab filteredCampaigns={bd.compareCampaigns} filteredEmails={bd.compareEmails} sectorA={sectorA} setSectorA={setSectorA} sectorB={sectorB} setSectorB={setSectorB} compareMode={compareMode} setCompareMode={setCompareMode} ownerA={ownerA} setOwnerA={setOwnerA} ownerB={ownerB} setOwnerB={setOwnerB} />}
            {tab === 'inbox'     && <InboxTab emails={bd.filteredEmails} />}
            {tab === 'analytics' && <AnalyticsTab campaigns={bd.filteredCampaigns} emails={bd.filteredEmails} campaignStats={bd.campaignStats} />}
            {tab === 'sentiment' && <SentimentTab campaigns={bd.filteredCampaigns} emails={bd.filteredEmails} />}
            {tab === 'debug'     && <DebugTab data={bd.data} />}
          </>
        )}
      </main>
    </div>
  );
}
