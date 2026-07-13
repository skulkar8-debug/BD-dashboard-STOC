import { NextResponse } from 'next/server';
import { getEnabledOrgs } from '@/lib/instantly/orgs';
import { fetchCampaigns, fetchAllCampaignAnalytics, fetchReceivedEmails } from '@/lib/instantly/client';
import { normalizeCampaign, normalizeEmail, resolveMapping } from '@/lib/instantly/normalize';
import type { BDData, NormalizedEmail, OrgData, OrgConfig, InstantlyAnalytics } from '@/lib/instantly/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Vercel Pro: allow up to 5 min for full email fetch

// 12-hour in-memory cache — data refreshes twice a day automatically
// Use ?refresh=1 to force an immediate re-fetch
let cacheData: BDData | null = null;
let cacheExpires = 0;
const CACHE_TTL = 12 * 60 * 60 * 1000;

async function fetchOrgData(org: OrgConfig): Promise<OrgData> {
  const errors: OrgData['errors'] = {};

  if (!org.apiKey) {
    return { org, campaigns: [], emails: [], errors: { campaigns: 'No API key configured' } };
  }

  const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  // 1. Campaigns
  let rawCampaigns: Awaited<ReturnType<typeof fetchCampaigns>> = [];
  try {
    rawCampaigns = await fetchCampaigns(org.apiKey);
  } catch (e) {
    errors.campaigns = String(e);
    return { org, campaigns: [], emails: [], errors };
  }

  // Pause between call types to avoid burst rate-limit hits
  await pause(1500);

  // 2. Analytics — GET /api/v2/campaigns/analytics returns an array for all campaigns
  let analyticsMap: Record<string, InstantlyAnalytics> = {};
  const analyticsResult = await fetchAllCampaignAnalytics(org.apiKey);
  analyticsMap = analyticsResult.data;
  if (analyticsResult.error) errors.analytics = analyticsResult.error;

  await pause(1500);

  // 3. Received emails — org-wide, up to 10,000
  let rawEmails: Awaited<ReturnType<typeof fetchReceivedEmails>> = [];
  let email_pull_warning: string | undefined;
  try {
    rawEmails = await fetchReceivedEmails(org.apiKey, undefined, 10_000);
    if (rawEmails.length === 0) {
      email_pull_warning = 'No received emails returned for this org.';
    }
  } catch (e) {
    errors.emails = String(e);
    email_pull_warning = `Email fetch failed: ${String(e)}`;
  }

  // 4. Campaign lookup map
  const campaignMap = new Map(rawCampaigns.map((c) => [c.id, c]));

  // 5. Normalize emails
  const normalizedEmails: NormalizedEmail[] = rawEmails.map((e) => {
    const camp = e.campaign_id ? campaignMap.get(e.campaign_id) : undefined;
    const campName = camp?.name ?? e.campaign_id ?? 'Unknown Campaign';
    const { sector, state, region, bd_owner } = resolveMapping(org.id, e.campaign_id ?? '', campName);
    return normalizeEmail(org, e, campName, sector, state, region, bd_owner);
  });

  // 6. Group emails by campaign_id
  const emailsByCampaign = new Map<string, NormalizedEmail[]>();
  for (const e of normalizedEmails) {
    const arr = emailsByCampaign.get(e.campaign_id) ?? [];
    arr.push(e);
    emailsByCampaign.set(e.campaign_id, arr);
  }

  // 7. Normalize campaigns
  const normalizedCampaigns = rawCampaigns.map((c) =>
    normalizeCampaign(org, c, analyticsMap[c.id] ?? null, emailsByCampaign.get(c.id) ?? [])
  );

  // 8. Analytics coverage warning
  const withAnalytics = normalizedCampaigns.filter((c) => c.analytics_available).length;
  if (withAnalytics === 0 && rawCampaigns.length > 0) {
    errors.analytics = `Analytics returned 0 matches for ${rawCampaigns.length} campaigns`;
  }

  // 9. Warn if analytics shows replies but actual emails don't match
  const mismatches = normalizedCampaigns.filter(
    (c) => c.replies_analytics > 0 && c.actual_received_count === 0
  );
  if (mismatches.length > 0 && !email_pull_warning) {
    email_pull_warning = `${mismatches.length} campaign(s) have analytics replies > 0 but no actual emails retrieved. Data may be paginated or filtered.`;
  }

  return { org, campaigns: normalizedCampaigns, emails: normalizedEmails, errors, email_pull_warning };
}

export async function GET(req: Request) {
  const now = Date.now();
  const refresh = new URL(req.url).searchParams.get('refresh');
  if (cacheData && now < cacheExpires && !refresh) {
    return NextResponse.json(cacheData);
  }

  const orgs = getEnabledOrgs();
  if (orgs.length === 0) {
    return NextResponse.json({
      error: 'No Instantly API keys found. Add INSTANTLY_*_API_KEY environment variables in Vercel (Settings → Environment Variables) and redeploy.',
      missing_vars: [
        'INSTANTLY_MY_ORG_API_KEY',
        'INSTANTLY_EMBARK_API_KEY',
        'INSTANTLY_SUN_AUTO_API_KEY',
        'INSTANTLY_AEG_VISION_API_KEY',
        'INSTANTLY_MCLERRAN_API_KEY',
        'INSTANTLY_BRANTA_API_KEY',
        'INSTANTLY_CORVIA_API_KEY',
        'INSTANTLY_LAUNDROMAT_API_KEY',
      ],
    }, { status: 400 });
  }

  // Fetch orgs sequentially with a gap between each to avoid rate-limit collisions
  // (some orgs share the same Instantly account pool, e.g. My Org + AEG Vision)
  const orgData: OrgData[] = [];
  for (let i = 0; i < orgs.length; i++) {
    if (i > 0) await new Promise<void>((r) => setTimeout(r, 3000));
    try {
      orgData.push(await fetchOrgData(orgs[i]));
    } catch (e) {
      orgData.push({ org: orgs[i], campaigns: [], emails: [], errors: { campaigns: String(e) } });
    }
  }

  const data: BDData = {
    orgs: orgData,
    fetched_at: new Date().toISOString(),
    total_campaigns: orgData.reduce((s, o) => s + o.campaigns.length, 0),
    total_emails: orgData.reduce((s, o) => s + o.emails.length, 0),
  };

  cacheData = data;
  cacheExpires = now + CACHE_TTL;

  return NextResponse.json(data);
}
