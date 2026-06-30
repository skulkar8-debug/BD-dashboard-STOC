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
  orgs: string[];       // org ids, [] = all
  sectors: string[];    // sector names, [] = all
  bd_owners: string[];  // bd owner names, [] = all
  state: string;        // '' = all (single)
  campaigns: string[];  // campaign_ids, [] = all
  campaign_status: string;
  has_positive_replies: '' | 'yes' | 'no';
  recommended_action: string;
};

export function presetDates(preset: DatePreset): { from_date: string; to_date: string } {
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

export function defaultFilters(): FilterState {
  return {
    datePreset: 'last_30',
    ...presetDates('last_30'),
    orgs: [],
    sectors: [],
    bd_owners: [],
    state: '',
    campaigns: [],
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

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(forceRefresh ? '/api/instantly/data?refresh=1' : '/api/instantly/data');
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

  // Pre-filtered emails used for has_positive_replies campaign filter
  const emailFilteredByCampaignDimensions = useMemo(() => {
    return allEmails.filter((e) => {
      if (filters.orgs.length > 0 && !filters.orgs.includes(e.org_id)) return false;
      if (filters.sectors.length > 0 && !filters.sectors.includes(e.sector)) return false;
      if (filters.bd_owners.length > 0 && !filters.bd_owners.includes(e.bd_owner)) return false;
      if (filters.state && e.state !== filters.state) return false;
      if (filters.campaigns.length > 0 && !filters.campaigns.includes(e.campaign_id)) return false;
      if (filters.from_date && e.date_local < filters.from_date) return false;
      if (filters.to_date && e.date_local > filters.to_date) return false;
      return true;
    });
  }, [allEmails, filters.orgs, filters.sectors, filters.bd_owners, filters.state, filters.campaigns, filters.from_date, filters.to_date]);

  const campaignPositiveMap = useMemo(() => {
    const m = new Map<string, boolean>();
    emailFilteredByCampaignDimensions.forEach((e) => {
      if (e.is_positive) m.set(e.campaign_id, true);
    });
    return m;
  }, [emailFilteredByCampaignDimensions]);

  const filteredCampaigns = useMemo(() => {
    return allCampaigns.filter((c) => {
      if (filters.orgs.length > 0 && !filters.orgs.includes(c.org_id)) return false;
      if (filters.sectors.length > 0 && !filters.sectors.includes(c.sector)) return false;
      if (filters.bd_owners.length > 0 && !filters.bd_owners.includes(c.bd_owner)) return false;
      if (filters.state && c.state !== filters.state) return false;
      if (filters.campaigns.length > 0 && !filters.campaigns.includes(c.campaign_id)) return false;
      if (filters.campaign_status && c.campaign_status !== filters.campaign_status) return false;
      if (filters.recommended_action && c.recommended_action !== filters.recommended_action) return false;
      if (filters.has_positive_replies === 'yes' && !campaignPositiveMap.has(c.campaign_id)) return false;
      if (filters.has_positive_replies === 'no' && campaignPositiveMap.has(c.campaign_id)) return false;
      return true;
    });
  }, [allCampaigns, filters, campaignPositiveMap]);

  const filteredEmails = useMemo(() => {
    return allEmails.filter((e) => {
      if (filters.orgs.length > 0 && !filters.orgs.includes(e.org_id)) return false;
      if (filters.sectors.length > 0 && !filters.sectors.includes(e.sector)) return false;
      if (filters.bd_owners.length > 0 && !filters.bd_owners.includes(e.bd_owner)) return false;
      if (filters.state && e.state !== filters.state) return false;
      if (filters.campaigns.length > 0 && !filters.campaigns.includes(e.campaign_id)) return false;
      if (filters.from_date && e.date_local < filters.from_date) return false;
      if (filters.to_date && e.date_local > filters.to_date) return false;
      return true;
    });
  }, [allEmails, filters]);

  // Compare tab: same filters as filtered* but WITHOUT sectors or bd_owners,
  // because CompareTab does its own segmentation by those dimensions.
  const compareCampaigns = useMemo(() => {
    return allCampaigns.filter((c) => {
      if (filters.orgs.length > 0 && !filters.orgs.includes(c.org_id)) return false;
      // ← no sector / bd_owner filter here
      if (filters.state && c.state !== filters.state) return false;
      if (filters.campaigns.length > 0 && !filters.campaigns.includes(c.campaign_id)) return false;
      if (filters.campaign_status && c.campaign_status !== filters.campaign_status) return false;
      if (filters.recommended_action && c.recommended_action !== filters.recommended_action) return false;
      if (filters.has_positive_replies === 'yes' && !campaignPositiveMap.has(c.campaign_id)) return false;
      if (filters.has_positive_replies === 'no' && campaignPositiveMap.has(c.campaign_id)) return false;
      return true;
    });
  }, [allCampaigns, filters.orgs, filters.state, filters.campaigns, filters.campaign_status, filters.recommended_action, filters.has_positive_replies, campaignPositiveMap]);

  const compareEmails = useMemo(() => {
    return allEmails.filter((e) => {
      if (filters.orgs.length > 0 && !filters.orgs.includes(e.org_id)) return false;
      // ← no sector / bd_owner filter here
      if (filters.state && e.state !== filters.state) return false;
      if (filters.campaigns.length > 0 && !filters.campaigns.includes(e.campaign_id)) return false;
      if (filters.from_date && e.date_local < filters.from_date) return false;
      if (filters.to_date && e.date_local > filters.to_date) return false;
      return true;
    });
  }, [allEmails, filters.orgs, filters.state, filters.campaigns, filters.from_date, filters.to_date]);

  // Per-campaign stats from filteredEmails — replaces pre-computed fields
  const campaignStats = useMemo(() => {
    const m = new Map<string, { received: number; positive: number; human: number }>();
    filteredEmails.forEach((e) => {
      const cur = m.get(e.campaign_id) ?? { received: 0, positive: 0, human: 0 };
      cur.received++;
      if (e.is_positive) cur.positive++;
      if (!e.is_auto_reply && e.final_classification !== 'unsubscribe') cur.human++;
      m.set(e.campaign_id, cur);
    });
    return m;
  }, [filteredEmails]);

  const humanEmails = useMemo(
    () => filteredEmails.filter(
      (e) => !e.is_auto_reply && e.final_classification !== 'unsubscribe'
    ),
    [filteredEmails]
  );
  const positiveEmails = useMemo(() => humanEmails.filter((e) => e.is_positive), [humanEmails]);

  // Options for filter dropdowns — cascade: orgs -> sectors -> states -> campaigns
  const options = useMemo(() => {
    const orgCampaigns = filters.orgs.length > 0
      ? allCampaigns.filter((c) => filters.orgs.includes(c.org_id))
      : allCampaigns;
    const sectorCampaigns = filters.sectors.length > 0
      ? orgCampaigns.filter((c) => filters.sectors.includes(c.sector))
      : orgCampaigns;
    const stateCampaigns = filters.state
      ? sectorCampaigns.filter((c) => c.state === filters.state)
      : sectorCampaigns;
    return {
      orgs: [...new Map(allCampaigns.map((c) => [c.org_id, c.org_label])).entries()]
        .map(([id, label]) => ({ id, label })),
      sectors: [...new Set(orgCampaigns.map((c) => c.sector))].filter(Boolean).sort(),
      bd_owners: [...new Set(orgCampaigns.map((c) => c.bd_owner))].filter(Boolean).sort(),
      states: [...new Set(
        sectorCampaigns.map((c) => c.state).filter((s) => s && s !== 'Unmapped')
      )].sort(),
      campaigns: [...stateCampaigns]
        .sort((a, b) => a.campaign_name.localeCompare(b.campaign_name))
        .map((c) => ({ id: c.campaign_id, name: c.campaign_name, org: c.org_label })),
      campaign_statuses: [...new Set(allCampaigns.map((c) => c.campaign_status))].sort(),
      recommended_actions: [...new Set(allCampaigns.map((c) => c.recommended_action))].sort(),
    };
  }, [allCampaigns, filters.orgs, filters.sectors, filters.state]);

  // Remove selected campaigns that are no longer in the cascaded options list
  useEffect(() => {
    const validIds = new Set(options.campaigns.map((c) => c.id));
    setFilters((prev) => {
      if (prev.campaigns.length === 0) return prev;
      const valid = prev.campaigns.filter((id) => validIds.has(id));
      if (valid.length === prev.campaigns.length) return prev;
      return { ...prev, campaigns: valid };
    });
  }, [options.campaigns]);

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
    const totalReceived = filteredEmails.length;
    const humanReplies = humanEmails.length;
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
      sent, analyticsAvailable,
      replies: totalReceived,
      humanReplies,
      actionable,
      actionable_rate: r(actionable, humanReplies),
      positive: actionable,
      positive_reply_rate: r(actionable, humanReplies),
      opps, opp_rate: r(opps, sent),
      bounces, bounce_rate: r(bounces, sent),
      unsubs, unsub_rate: r(unsubs, sent),
      activeCampaigns,
      totalCampaigns: filteredCampaigns.length,
      needsAttention,
      followUp,
    };
  }, [filteredCampaigns, filteredEmails, humanEmails, positiveEmails]);

  return {
    data, loading, error, refresh: load, hardRefresh: () => load(true),
    filters, setFilters, updateFilter, setDatePreset, resetFilters,
    allCampaigns, allEmails,
    filteredCampaigns, filteredEmails, humanEmails, positiveEmails,
    compareCampaigns, compareEmails,
    campaignStats,
    options, stats,
  };
}
