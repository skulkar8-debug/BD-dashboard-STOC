import { NextResponse } from 'next/server';
import { ORGS } from '@/lib/instantly/orgs';

export const dynamic = 'force-dynamic';

const BASE = 'https://api.instantly.ai/api/v2';

async function probe(apiKey: string, path: string, params: Record<string, string | string[]> = {}) {
  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (Array.isArray(v)) v.forEach((vi) => url.searchParams.append(k, vi));
    else url.searchParams.set(k, v);
  });
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

  // Get first campaign ID
  const campRes = await probe(org.apiKey, '/campaigns', { limit: '3' });
  const campaigns = (campRes.body as Record<string, unknown>)?.items as { id: string; name: string }[] ?? [];
  const id1 = campaigns[0]?.id;
  const id2 = campaigns[1]?.id;

  const results: Record<string, unknown> = {
    org: org.label,
    first_campaigns: campaigns.slice(0, 3).map((c) => ({ id: c.id, name: c.name })),
  };

  if (!id1) return NextResponse.json({ error: 'No campaigns', campRes });

  // Try every analytics endpoint variant
  const tests = [
    { label: 'overview_no_params', path: '/campaigns/analytics/overview', params: {} },
    { label: 'overview_with_id', path: '/campaigns/analytics/overview', params: { id: id1 } },
    { label: 'overview_with_ids', path: '/campaigns/analytics/overview', params: { ids: [id1, ...(id2 ? [id2] : [])] } },
    { label: 'analytics_no_params', path: '/campaigns/analytics', params: {} },
    { label: 'analytics_with_id', path: '/campaigns/analytics', params: { id: id1 } },
    { label: 'analytics_with_campaign_id', path: '/campaigns/analytics', params: { campaign_id: id1 } },
    { label: 'campaign_detail', path: `/campaigns/${id1}`, params: {} },
    { label: 'campaign_analytics_sub', path: `/campaigns/${id1}/analytics`, params: {} },
    { label: 'list_analytics', path: '/analytics', params: {} },
    { label: 'list_analytics_campaigns', path: '/analytics/campaigns', params: {} },
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
