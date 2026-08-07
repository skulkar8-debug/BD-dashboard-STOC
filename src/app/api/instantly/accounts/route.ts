import { NextResponse } from 'next/server';
import { getEnabledOrgs } from '@/lib/instantly/orgs';
import { fetchAccounts } from '@/lib/instantly/client';
import type { OrgAccounts } from '@/lib/instantly/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// 12-hour cache — account/warmup status changes slowly
let cache: { data: OrgAccounts[]; expires: number } | null = null;
const CACHE_TTL = 12 * 60 * 60 * 1000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function GET(req: Request) {
  const refresh = new URL(req.url).searchParams.get('refresh');
  if (cache && Date.now() < cache.expires && !refresh) {
    return NextResponse.json({ orgs: cache.data });
  }

  const orgs = getEnabledOrgs();
  const results: OrgAccounts[] = [];

  for (let i = 0; i < orgs.length; i++) {
    if (i > 0) await sleep(1500);
    const org = orgs[i];
    if (!org.apiKey) {
      results.push({ org_id: org.id, org_label: org.label, accounts: [], error: 'No API key' });
      continue;
    }
    try {
      const accounts = await fetchAccounts(org.apiKey);
      results.push({ org_id: org.id, org_label: org.label, accounts });
    } catch (e) {
      results.push({ org_id: org.id, org_label: org.label, accounts: [], error: String(e) });
    }
  }

  cache = { data: results, expires: Date.now() + CACHE_TTL };
  return NextResponse.json({ orgs: results });
}
