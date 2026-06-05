'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useBDData } from '@/hooks/useBDData';
import { FilterBar } from '@/components/bd/FilterBar';
import { KpiCard } from '@/components/bd/KpiCard';
import { StatusBadge } from '@/components/bd/Badge';
import { CLASSIFICATION_LABELS } from '@/lib/instantly/types';
import type { NormalizedCampaign, NormalizedEmail, BDData } from '@/lib/instantly/types';
import { exportCampaignsCsv, exportEmailsCsv, downloadCsv } from '@/lib/instantly/export';
import {
  Loader2, RefreshCw, AlertTriangle, Bug, BarChart3,
  Calendar, Layers, MapPin, Table2, Inbox, TrendingUp, ChevronDown, ChevronRight,
} from 'lucide-react';
import Image from 'next/image';

// Leaflet is browser-only — must be dynamically imported with SSR disabled
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
  { id: 'overview',  label: 'Overview',             icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { id: 'agenda',    label: 'Weekly Agenda',         icon: <Calendar className="h-3.5 w-3.5" /> },
  { id: 'sectors',   label: 'Sectors',               icon: <Layers className="h-3.5 w-3.5" /> },
  { id: 'states',    label: 'States',                icon: <MapPin className="h-3.5 w-3.5" /> },
  { id: 'campaigns', label: 'Campaigns',             icon: <Table2 className="h-3.5 w-3.5" /> },
  { id: 'inbox',     label: 'Inbox',                 icon: <Inbox className="h-3.5 w-3.5" /> },
  { id: 'trends',    label: 'Trends',                icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { id: 'debug',     label: 'Debug',                 icon: <Bug className="h-3.5 w-3.5" /> },
] as const;
type TabId = (typeof TABS)[number]['id'];

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
    filters.org && `Org: ${filters.org}`,
    filters.sector && `Sector: ${filters.sector}`,
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
      {analyticsDateNote && (
        <span className="text-amber-500">
          ⚠ Sent/Bounce/Opps are all-time per campaign — Instantly analytics are not date-filtered
        </span>
      )}
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function OverviewTab({
  campaigns, emails, stats, analyticsAvailable,
}: {
  campaigns: NormalizedCampaign[];
  emails: NormalizedEmail[];
  stats: ReturnType<typeof useBDData>['stats'];
  analyticsAvailable: boolean;
}) {
  const positive = emails.filter((e) => e.is_positive);
  const noAnalytics = !analyticsAvailable;

  // Best performers
  const bySector = useMemo(() => {
    const m = new Map<string, { replies: number; positive: number; sent: number }>();
    campaigns.forEach((c) => {
      const cur = m.get(c.sector) ?? { replies: 0, positive: 0, sent: 0 };
      cur.sent += c.sent;
      cur.positive += c.positive_reply_count;
      m.set(c.sector, cur);
    });
    emails.forEach((e) => {
      const cur = m.get(e.sector);
      if (cur) cur.replies++;
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

  const bestCampaign = [...campaigns]
    .filter((c) => c.positive_reply_count > 0)
    .sort((a, b) => b.positive_reply_count - a.positive_reply_count)[0] ?? null;
  const bestState = [...byState.entries()]
    .filter(([, v]) => v.replies >= 2)
    .sort((a, b) => b[1].positive / Math.max(b[1].replies, 1) - a[1].positive / Math.max(a[1].replies, 1))[0];

  const followUps = campaigns.filter((c) => c.recommended_action === 'Follow Up')
    .sort((a, b) => b.positive_reply_count - a.positive_reply_count).slice(0, 5);
  const toReview = campaigns.filter((c) => c.recommended_action === 'Pause / Review' || c.recommended_action === 'Review')
    .sort((a, b) => b.sent - a.sent).slice(0, 5);

  // Sector performance table
  const sectorRows = [...bySector.entries()]
    .map(([sector, v]) => ({ sector, ...v }))
    .sort((a, b) => b.positive - a.positive)
    .slice(0, 8);

  const stateRows = [...byState.entries()]
    .map(([state, v]) => ({ state, ...v }))
    .sort((a, b) => b.positive - a.positive)
    .slice(0, 8);

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
          <div className="text-[11px] text-gray-500 mt-0.5">Replies</div>
          <div className="text-[10px] text-gray-400">{noAnalytics ? 'date-filtered' : pct(stats.replies, stats.sent) + ' rate'}</div>
        </div>
        <div className="bg-white border border-l-4 border-emerald-400 rounded-xl p-4 text-center shadow-sm">
          <div className="text-2xl font-bold tabular-nums text-emerald-600">{fmt(stats.positive)}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Positive Replies</div>
          <div className="text-[10px] text-gray-400">{pct(stats.positive, stats.replies)} of replies</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
          <div className={`text-2xl font-bold tabular-nums ${noAnalytics ? 'text-gray-300' : 'text-amber-600'}`}>
            {noAnalytics ? '—' : fmt(stats.opps)}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">Opportunities — Only All-Time Data Available</div>
          {!noAnalytics && <div className="text-[10px] text-gray-400">{pct(stats.opps, stats.sent)} rate</div>}
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
          {bestCampaign && <div className="text-xs text-gray-500 mt-0.5">{bestCampaign.positive_reply_count} positive · {bestCampaign.sector} · {bestCampaign.state}</div>}
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
              {followUps.slice(0, 3).map((c) => (
                <div key={c.campaign_id} className="text-xs text-gray-700 truncate">
                  <span className="text-emerald-600 font-semibold">{c.positive_reply_count}</span> · {c.campaign_name}
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

function AgendaTab({ campaigns, emails }: { campaigns: NormalizedCampaign[]; emails: NormalizedEmail[] }) {
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
                          { v: fmt(sent), l: 'Sent' },
                          { v: fmt(data.emails.length), l: 'Replies' },
                          { v: fmt(data.positive.length), l: 'Positive', em: true },
                          { v: pct(data.emails.length, sent), l: 'Reply Rate' },
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

function SectorsTab({ campaigns, emails }: { campaigns: NormalizedCampaign[]; emails: NormalizedEmail[] }) {
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
          <KpiCard title="Sent" value={fmt(sent)} />
          <KpiCard title="Replies" value={fmt(d.emails.length)} sub={pct(d.emails.length, sent)} />
          <KpiCard title="Positive" value={fmt(pos.length)} sub={pct(pos.length, d.emails.length)} accent="#10B981" />
          <KpiCard title="Opportunities" value={fmt(d.campaigns.reduce((s, c) => s + c.opportunities, 0))} />
          <KpiCard title="Campaigns" value={d.campaigns.length} />
        </div>
        <CampaignTable campaigns={d.campaigns} emails={d.emails} />
        {pos.length > 0 && <><div className="text-sm font-semibold text-gray-600">Positive Replies</div><EmailList emails={pos} /></>}
      </div>
    );
  }

  const rows = [...bySector.entries()].sort((a, b) => b[1].emails.filter((e) => e.is_positive).length - a[1].emails.filter((e) => e.is_positive).length);
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-400 uppercase tracking-wide">
          {['Sector','Campaigns','States','Sent','Replies','Reply%','Positive','Pos%','Opps'].map((h) => (
            <th key={h} className={`py-2 px-3 ${h==='Sector'?'text-left':'text-right'}`}>{h}</th>
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
                <td className="text-right px-3">{pct(d.emails.length, sent)}</td>
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

function StatesTab({ campaigns, emails }: { campaigns: NormalizedCampaign[]; emails: NormalizedEmail[] }) {
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
                {['State','Orgs','Sectors','Campaigns','Sent','Replies','Reply%','Positive','Pos%','Opps'].map((h) => (
                  <th key={h} className={`py-2 px-3 ${h === 'State' ? 'text-left' : 'text-right'}`}>{h}</th>
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
                    <td className="text-right px-3">{pct(d.emails.length, sent)}</td>
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

function CampaignTable({ campaigns, emails: _ }: { campaigns: NormalizedCampaign[]; emails: NormalizedEmail[] }) {
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
            <Th col="sent" label="Sent" />
            <Th col="actual_received_count" label="Replies" />
            <Th col="reply_rate" label="Reply%" />
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
                <td className="text-right px-2">{c.analytics_available ? fmt(c.sent) : <span className="text-gray-300">—</span>}</td>
                <td className="text-right px-2">{c.actual_received_count}</td>
                <td className="text-right px-2">{c.analytics_available && c.sent > 0 ? c.reply_rate + '%' : '—'}</td>
                <td className="text-right px-2 text-emerald-600 font-semibold">{c.positive_reply_count}</td>
                <td className="text-right px-2">{c.actual_received_count > 0 ? c.positive_reply_rate + '%' : '—'}</td>
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
                  <span className="text-xs text-gray-400">{e.from_email}</span>
                  <StatusBadge value={displayClass} />
                  {e.is_positive && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">✓</span>}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">{e.campaign_name} · {e.sector} · {e.state} · {e.org_label} · {new Date(e.timestamp_email).toLocaleDateString()}</div>
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
  const [classFilter, setClassFilter] = useState('');
  const positive = emails.filter((e) => e.is_positive);
  // Default: show ALL replies — use Positives filter in the filter bar to narrow
  const base = positiveOnly ? positive : emails;
  const display = classFilter ? base.filter((e) => e.final_classification === classFilter) : base;
  const sorted = [...display].sort((a, b) => b.timestamp_email.localeCompare(a.timestamp_email));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-sm font-semibold text-gray-700">
          <span className="text-emerald-600">{positive.length}</span> positive · {emails.length} total received
          {positiveOnly ? ' (positive only)' : ''}
        </div>
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[11px] rounded px-2 py-1">
          Source: actual <code>/api/v2/emails?email_type=received</code>
        </div>
        <button onClick={() => setPositiveOnly((v) => !v)}
          className={`text-xs px-3 py-1.5 rounded-lg transition-colors border ${positiveOnly ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'}`}>
          {positiveOnly ? '✓ Positive only' : 'Show positive only'}
        </button>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none">
          <option value="">All classifications</option>
          {Object.entries(CLASSIFICATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
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

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function BDDashboard() {
  const [tab, setTab] = useState<TabId>('overview');
  const bd = useBDData();

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
          <div className="flex items-center gap-3 text-xs text-gray-400">
            {bd.data && !bd.loading && (
              <span className="hidden sm:inline">
                {bd.data.total_campaigns} campaigns · {bd.data.total_emails} emails · updated {ago(bd.data.fetched_at)}
              </span>
            )}
            {bd.loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
            <button onClick={bd.refresh} disabled={bd.loading} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50" title="Refresh (cached 5 min)">
              <RefreshCw className="h-3.5 w-3.5 text-gray-500" />
            </button>
            <a href="/" className="hidden sm:inline hover:text-gray-600 transition-colors">← Pipeline</a>
          </div>
        </div>
        <div className="max-w-[1800px] mx-auto px-6 flex gap-0.5 overflow-x-auto border-t border-gray-100">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.icon} <span className="hidden sm:inline">{t.label}</span>
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
            {tab === 'overview'  && <OverviewTab campaigns={bd.filteredCampaigns} emails={bd.filteredEmails} stats={bd.stats} analyticsAvailable={bd.stats.analyticsAvailable} />}
            {tab === 'agenda'    && <AgendaTab campaigns={bd.filteredCampaigns} emails={bd.filteredEmails} />}
            {tab === 'sectors'   && <SectorsTab campaigns={bd.filteredCampaigns} emails={bd.filteredEmails} />}
            {tab === 'states'    && <StatesTab campaigns={bd.filteredCampaigns} emails={bd.filteredEmails} />}
            {tab === 'campaigns' && <CampaignTable campaigns={bd.filteredCampaigns} emails={bd.filteredEmails} />}
            {tab === 'inbox'     && <InboxTab emails={bd.filteredEmails} />}
            {tab === 'trends'    && <TrendsTab emails={bd.filteredEmails} />}
            {tab === 'debug'     && <DebugTab data={bd.data} />}
          </>
        )}
      </main>
    </div>
  );
}
