import { NextResponse } from 'next/server';
import { getEnabledOrgs } from '@/lib/instantly/orgs';
import { fetchAllCampaignAnalytics } from '@/lib/instantly/client';
import type { AnalyticsOverride } from '@/hooks/useBDData';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Lightweight analytics-only cache keyed by "from|to" — no email pagination, much faster
const analyticsCache = new Map<string, { data: AnalyticsOverride; expires: number }>();
const CACHE_TTL = 12 * 60 * 60 * 1000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fromDate = url.searchParams.get('from') ?? '';
  const toDate   = url.searchParams.get('to')   ?? '';

  if (!fromDate && !toDate) {
    return NextResponse.json({ analytics: null });
  }

  const cacheKey = `${fromDate}|${toDate}`;
  const cached = analyticsCache.get(cacheKey);
  if (cached && Date.now() < cached.expires) {
    return NextResponse.json({ analytics: cached.data });
  }

  const orgs = getEnabledOrgs();
  if (orgs.length === 0) return NextResponse.json({ analytics: null });

  const merged: AnalyticsOverride = {};

  for (let i = 0; i < orgs.length; i++) {
    if (i > 0) await sleep(1500);
    const org = orgs[i];
    if (!org.apiKey) continue;
    const result = await fetchAllCampaignAnalytics(org.apiKey, fromDate, toDate);
    for (const [campaignId, a] of Object.entries(result.data)) {
      merged[campaignId] = {
        sent:          a.sent                ?? 0,
        opens:         a.opens               ?? 0,
        opens_unique:  a.opens_unique         ?? 0,
        bounces:       a.bounces              ?? 0,
        unsubscribes:  a.unsubscribes         ?? 0,
      };
    }
  }

  analyticsCache.set(cacheKey, { data: merged, expires: Date.now() + CACHE_TTL });
  return NextResponse.json({ analytics: merged });
}
