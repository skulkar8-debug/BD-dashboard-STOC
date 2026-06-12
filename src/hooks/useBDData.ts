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
  campaign: string;    // campaign_id, '' = all
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
    campaign: '',
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
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
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

  // campaignStats from filteredEmails — needed for has_positive_replies filtering
  // We compute a preliminary version here using all emails with geo/campaign filters only.
  const emailFilteredByCampaignDimensions = useMemo(() => {
    return allEmails.filter((e) => {
      if (filters.org && e.org_id !== filters.org) return false;
      if (filters.sector && e.sector !== filters.sector) return false;
      if (filters.state && e.state !== filters.state) return false;
      if (filters.campaign && e.campaign_id !== filters.campaign) return false;
      if (filters.from_date && e.timestamp_email < filters.from_date) return false;
      if (filters.to_date && e.timestamp_email > filters.to_date + 'T23:59:59') return false;
      return true;
    });
  }, [allEmails, filters.org, filters.sector, filters.state, filters.campaign, filters.from_date, filters.to_date]);

  const campaignPositiveMap = useMemo(() => {
    const m = new Map<string, boolean>();
    emailFilteredByCampaignDimensions.forEach((e) => {
      if (e.is_positive) m.set(e.campaign_id, true);
    });
    return m;
  }, [emailFilteredByCampaignDimensions]);

  const filteredCampaigns = useMemo(() => {
    return allCampaigns.filter((c) => {
      if (filters.org && c.org_id !== filters.org) return false;
      if (filters.sector && c.sector !== filters.sector) return false;
      if (filters.state && c.state !== filters.state) return false;
      if (filters.campaign && c.campaign_id !== filters.campaign) return false;
      if (filters.campaign_status && c.campaign_status !== filters.campaign_status) return false;
      if (filters.recommended_action && c.recommended_action !== filters.recommended_action) return false;
      if (filters.has_positive_replies === 'yes' && !campaignPositiveMap.has(c.campaign_id)) return false;
      if (filters.has_positive_replies === 'no' && campaignPositiveMap.has(c.campaign_id)) return false;
      return true;
    });
  }, [allCampaigns, filters, campaignPositiveMap]);

  const filteredEmails = useMemo(() => {
    return allEmails.filter((e) => {
      if (filters.org && e.org_id !== filters.org) return false;
      if (filters.sector && e.sector !== filters.sector) return false;
      if (filters.state && e.state !== filters.state) return false;
      if (filters.campaign && e.campaign_id !== filters.campaign) return false;
      if (filters.from_date && e.timestamp_email < filters.from_date) return false;
      if (filters.to_date && e.timestamp_email > filters.to_date + 'T23:59:59') return false;
      return true;
    });
  }, [allEmails, filters]);

  // ── Per-campaign stats derived from filteredEmails ────────────────────────
  // These replace c.positive_reply_count / c.actual_received_count everywhere
  // in the UI so that date/campaign filters are correctly reflected.
  const campaignStats = useMemo(() => {
    const m = new Map<string, { received: number; positive: number; human: number }>();
    filteredEmails.forEach((e) => {
      const cur = m.get(e.campaign_id) ?? { received: 0, positive: 0, human: 0 };
      cur.received++;
      if (e.is_positive) cur.positive++;
      if (!e.is_auto_reply && e.final_classification !== 'unsubscribe') cur.human++;
      if (!m.has(e.campaign_id)) m.set(e.campaign_id, cur);
      else m.set(e.campaign_id, cur);
    });
    return m;
  }, [filteredEmails]);

  // ── Human / actionable split (excludes automated + unsubscribe) ───────────
  const humanEmails = useMemo(
    () => filteredEmails.filter(
      (e) => !e.is_auto_reply && e.final_classification !== 'unsubscribe'
    ),
    [filteredEmails]
  );
  const positiveEmails = useMemo(() => humanEmails.filter((e) => e.is_positive), [humanEmails]);

  // Dimension options derived from ALL campaigns (not filtered) for the filter dropdowns
  const options = useMemo(() => {
    // Cascading: sectors + states + campaigns filtered by selected org/sector/state
    const orgCampaigns = filters.org
      ? allCampaigns.filter((c) => c.org_id === filters.org)
      : allCampaigns;
    const sectorCampaigns = filters.sector
      ? orgCampaigns.filter((c) => c.sector === filters.sector)
      : orgCampaigns;
    const stateCampaigns = filters.state
      ? sectorCampaigns.filter((c) => c.state === filters.state)
      : sectorCampaigns;
    return {
      orgs: [...new Map(allCampaigns.map((c) => [c.org_id, c.org_label])).entries()]
        .map(([id, label]) => ({ id, label })),
      sectors: [...new Set(orgCampaigns.map((c) => c.sector))].sort(),
      states: [...new Set(
        sectorCampaigns.map((c) => c.state).filter((s) => s && s !== 'Unmapped')
      )].sort(),
      campaigns: [...stateCampaigns]
        .sort((a, b) => a.campaign_name.localeCompare(b.campaign_name))
        .map((c) => ({ id: c.campaign_id, name: c.campaign_name, org: c.org_label })),
      campaign_statuses: [...new Set(allCampaigns.map((c) => c.campaign_status))].sort(),
      recommended_actions: [...new Set(allCampaigns.map((c) => c.recommended_action))].sort(),
    };
  }, [allCampaigns, filters.org, filters.sector, filters.state]);

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

    // All received emails (includes automated, OOO, unsubscribe)
    const totalReceived = filteredEmails.length;
    // Human replies only — excludes automated/OOO/bounce/unsubscribe
    const humanReplies = humanEmails.length;
    // Actionable = positive classification among human replies
    const actionable = positiveEmails.length;

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
      // Kept for backward compat display but clearly named
      replies: totalReceived,           // all received (incl. automated)
      humanReplies,                      // excludes OOO/bounce/auto/unsub
      actionable,                        // positive classification, human only
      actionable_rate: r(actionable, humanReplies),  // actionable / human
      // legacy aliases (some tabs still use these, same values)
      positive: actionable,
      positive_reply_rate: r(actionable, humanReplies),
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
  }, [filteredCampaigns, filteredEmails, humanEmails, positiveEmails]);

  return {
    data, loading, error, refresh: load,
    filters, updateFilter, setDatePreset, resetFilters,
    allCampaigns, allEmails,
    filteredCampaigns, filteredEmails, humanEmails, positiveEmails,
    campaignStats,   // Map<campaign_id, {received, positive, human}> — from filtered emails
    options, stats,
  };
}
