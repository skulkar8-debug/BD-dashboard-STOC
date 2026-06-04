import { NextResponse } from 'next/server';
import { ORGS } from '@/lib/instantly/orgs';

export const dynamic = 'force-dynamic';

const BASE = 'https://api.instantly.ai/api/v2';

type QueryParams = Record<string, string | string[]>;

async function probe(apiKey: string, path: string, params?: QueryParams) {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, v));
      } else {
        url.searchParams.set(key, value);
      }
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 500); }
  return { status: res.status, url: url.toString().replace(apiKey, '<key>'), body };
}

export async function GET() {
  const org = ORGS.find((o) => o.apiKey && o.enabled);
  if (!org?.apiKey) return NextResponse.json({ error: 'No org key' }, { status: 400 });

  // Fetch first few campaigns to get real IDs for testing
  const campRes = await probe(org.apiKey, '/campaigns', { limit: '3' });
  const campaigns = ((campRes.body as Record<string, unknown>)?.items ?? []) as { id: string; name: string }[];
  const id1: string | undefined = campaigns[0]?.id;
  const id2: string | undefined = campaigns[1]?.id;

  const results: Record<string, unknown> = {
    org: org.label,
    first_campaigns: campaigns.slice(0, 3).map((c) => ({ id: c.id, name: c.name })),
  };

  if (!id1) return NextResponse.json({ error: 'No campaigns', campRes });

  // id1 is now narrowed to string — build ids array without any undefined values
  const idsParam: string[] = id2 ? [id1, id2] : [id1];

  const tests: Array<{ label: string; path: string; params?: QueryParams }> = [
    { label: 'overview_no_params',         path: '/campaigns/analytics/overview' },
    { label: 'overview_with_id',           path: '/campaigns/analytics/overview', params: { id: id1 } },
    { label: 'overview_with_ids',          path: '/campaigns/analytics/overview', params: { ids: idsParam } },
    { label: 'analytics_no_params',        path: '/campaigns/analytics' },
    { label: 'analytics_with_id',          path: '/campaigns/analytics',          params: { id: id1 } },
    { label: 'analytics_with_campaign_id', path: '/campaigns/analytics',          params: { campaign_id: id1 } },
    { label: 'campaign_detail',            path: `/campaigns/${id1}` },
    { label: 'campaign_analytics_sub',     path: `/campaigns/${id1}/analytics` },
    { label: 'list_analytics',             path: '/analytics' },
    { label: 'list_analytics_campaigns',   path: '/analytics/campaigns' },
  ];

  for (const t of tests) {
    try {
      results[t.label] = await probe(org.apiKey, t.path, t.params);
    } catch (e) {
      results[t.label] = { error: String(e) };
    }
  }

  return NextResponse.json(results);
}
