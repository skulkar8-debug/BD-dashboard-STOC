'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  startOfWeek, endOfWeek, subWeeks, subDays, startOfMonth, format,
} from 'date-fns';
import type { BDData, NormalizedCampaign, NormalizedEmail, ReplyClassification } from '@/lib/instantly/types';

export type DatePreset = 'all' | 'this_week' | 'last_week' | 'last_7' | 'last_30' | 'mtd' | 'custom';

export type FilterState = {
  datePreset: DatePreset;
  from_date: string;
  to_date: string;
  org: string;         // '' = all
  sector: string;      // '' = all
  state: string;       // '' = all
  campaign_status: string;
  has_positive_replies: '' | 'yes' | 'no';
  recommended_action: string;
};

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd');
}

function presetDates(preset: DatePreset): { from_date: string; to_date: string } {
  const today = new Date();
  const iso = (d: Date) => format(d, 'yyyy-MM-dd');
  switch (preset) {
    case 'this_week': {
      const start = startOfWeek(today, { weekStartsOn: 1 });
      return { from_date: iso(start), to_date: iso(today) };
    }
    case 'last_week': {
      const lastMon = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
      const lastSun = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
      return { from_date: iso(lastMon), to_date: iso(lastSun) };
    }
    case 'last_7':
      return { from_date: iso(subDays(today, 7)), to_date: iso(today) };
    case 'last_30':
      return { from_date: iso(subDays(today, 30)), to_date: iso(today) };
    case 'mtd':
      return { from_date: iso(startOfMonth(today)), to_date: iso(today) };
    case 'custom':
    case 'all':
    default:
      return { from_date: '', to_date: '' };
  }
}

function defaultFilters(): FilterState {
  return {
    datePreset: 'last_30',
    ...presetDates('last_30'),
    org: '',
    sector: '',
    state: '',
    campaign_status: '',
    has_positive_replies: '',
    recommended_action: '',
  };
}

export function useBDData() {
  const [data, setData] = useState<BDData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(defaultFilters());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/instantly/data');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: BDData = await res.json();
      setData(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const allCampaigns = useMemo<NormalizedCampaign[]>(
    () => data?.orgs.flatMap((o) => o.campaigns) ?? [],
    [data]
  );
  const allEmails = useMemo<NormalizedEmail[]>(
    () => data?.orgs.flatMap((o) => o.emails) ?? [],
    [data]
  );

  const filteredCampaigns = useMemo(() => {
    return allCampaigns.filter((c) => {
      if (filters.org && c.org_id !== filters.org) return false;
      if (filters.sector && c.sector !== filters.sector) return false;
      if (filters.state && c.state !== filters.state) return false;
      if (filters.campaign_status && c.campaign_status !== filters.campaign_status) return false;
      if (filters.has_positive_replies === 'yes' && c.positive_reply_count === 0) return false;
      if (filters.has_positive_replies === 'no' && c.positive_reply_count > 0) return false;
      if (filters.recommended_action && c.recommended_action !== filters.recommended_action) return false;
      return true;
    });
  }, [allCampaigns, filters]);

  const filteredEmails = useMemo(() => {
    return allEmails.filter((e) => {
      if (filters.org && e.org_id !== filters.org) return false;
      if (filters.sector && e.sector !== filters.sector) return false;
      if (filters.state && e.state !== filters.state) return false;
      if (filters.from_date && e.timestamp_email < filters.from_date) return false;
      if (filters.to_date && e.timestamp_email > filters.to_date + 'T23:59:59') return false;
      return true;
    });
  }, [allEmails, filters]);

  const positiveEmails = useMemo(() => filteredEmails.filter((e) => e.is_positive), [filteredEmails]);

  // Dimension options derived from ALL campaigns (not filtered) for the filter dropdowns
  const options = useMemo(() => ({
    orgs: [...new Map(allCampaigns.map((c) => [c.org_id, c.org_label])).entries()]
      .map(([id, label]) => ({ id, label })),
    sectors: [...new Set(allCampaigns.map((c) => c.sector))].sort(),
    states: [...new Set(
      allCampaigns.map((c) => c.state).filter((s) => s && s !== 'Unmapped')
    )].sort(),
    campaign_statuses: [...new Set(allCampaigns.map((c) => c.campaign_status))].sort(),
    recommended_actions: [...new Set(allCampaigns.map((c) => c.recommended_action))].sort(),
  }), [allCampaigns]);

  const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setDatePreset = useCallback((preset: DatePreset) => {
    const dates = presetDates(preset);
    setFilters((prev) => ({ ...prev, datePreset: preset, from_date: dates.from_date, to_date: dates.to_date }));
  }, []);

  const resetFilters = useCallback(() => setFilters(defaultFilters()), []);

  const stats = useMemo(() => {
    const sent = filteredCampaigns.reduce((s, c) => s + c.sent, 0);
    const analyticsAvailable = filteredCampaigns.some((c) => c.analytics_available);
    const replies = filteredEmails.length;
    const positive = positiveEmails.length;
    const opps = filteredCampaigns.reduce((s, c) => s + c.opportunities, 0);
    const bounces = filteredCampaigns.reduce((s, c) => s + c.bounces, 0);
    const unsubs = filteredCampaigns.reduce((s, c) => s + c.unsubscribes, 0);
    const activeCampaigns = filteredCampaigns.filter(
      (c) => c.campaign_status_num === 1 || c.campaign_status_num === 2
    ).length;
    const needsAttention = filteredCampaigns.filter(
      (c) => c.recommended_action === 'Pause / Review' || c.recommended_action === 'Review'
    ).length;
    const followUp = filteredCampaigns.filter((c) => c.recommended_action === 'Follow Up').length;

    const r = (n: number, d: number) => d > 0 ? Math.round((n / d) * 1000) / 10 : 0;

    return {
      sent,
      analyticsAvailable,
      replies,
      reply_rate: r(replies, sent),
      positive,
      positive_reply_rate: r(positive, replies),
      opps,
      opp_rate: r(opps, sent),
      bounces,
      bounce_rate: r(bounces, sent),
      unsubs,
      unsub_rate: r(unsubs, sent),
      activeCampaigns,
      totalCampaigns: filteredCampaigns.length,
      needsAttention,
      followUp,
    };
  }, [filteredCampaigns, filteredEmails, positiveEmails]);

  return {
    data, loading, error, refresh: load,
    filters, updateFilter, setDatePreset, resetFilters,
    allCampaigns, allEmails,
    filteredCampaigns, filteredEmails, positiveEmails,
    options, stats,
  };
}
