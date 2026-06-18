import type {
  InstantlyCampaign,
  InstantlyAnalytics,
  InstantlyEmail,
} from './types';

const BASE = 'https://api.instantly.ai/api/v2';

async function get<T>(
  apiKey: string,
  path: string,
  params: Record<string, string | string[]> = {},
  retries = 4
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (Array.isArray(v)) v.forEach((vi) => url.searchParams.append(k, vi));
    else url.searchParams.set(k, v);
  });
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    if (res.status === 429) {
      if (attempt === retries) {
        const text = await res.text();
        throw new Error(`Instantly ${path} → 429: ${text.slice(0, 300)}`);
      }
      // Back off: 6s, 12s, 24s, 48s — lets the 60-second rate-limit window clear
      const wait = 6000 * Math.pow(2, attempt);
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Instantly ${path} → ${res.status}: ${text.slice(0, 300)}`);
    }
    return res.json() as Promise<T>;
  }
  throw new Error(`Instantly ${path} → exhausted retries`);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Paginate endpoints that return { items, next_starting_after }
// interPageDelayMs: pause between pages to stay under 20 req/min rate limit per key
async function paginateItems<T>(
  apiKey: string,
  path: string,
  params: Record<string, string> = {},
  maxItems = 500,
  interPageDelayMs = 0
): Promise<T[]> {
  const items: T[] = [];
  let startingAfter: string | undefined;
  let page = 0;
  for (;;) {
    if (page > 0 && interPageDelayMs > 0) await sleep(interPageDelayMs);
    const p: Record<string, string> = {
      ...params,
      limit: '100',
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    };
    const res = await get<{ items?: T[]; next_starting_after?: string }>(apiKey, path, p);
    const batch = res.items ?? [];
    items.push(...batch);
    page++;
    if (!res.next_starting_after || batch.length === 0 || items.length >= maxItems) break;
    startingAfter = res.next_starting_after;
  }
  return items.slice(0, maxItems);
}

export async function fetchCampaigns(apiKey: string): Promise<InstantlyCampaign[]> {
  return paginateItems<InstantlyCampaign>(apiKey, '/campaigns', {}, 2000);
}

// GET /api/v2/campaigns/analytics returns a raw array (not paginated items wrapper)
// Each item: { campaign_id, campaign_name, emails_sent_count, open_count, reply_count, ... }
export async function fetchAllCampaignAnalytics(
  apiKey: string
): Promise<{ data: Record<string, InstantlyAnalytics>; error?: string }> {
  try {
    // Returns a raw array — fetch with large limit
    const res = await get<unknown>(apiKey, '/campaigns/analytics', { limit: '2000' });

    let items: InstantlyAnalytics[] = [];
    if (Array.isArray(res)) {
      items = res as InstantlyAnalytics[];
    } else if (res && typeof res === 'object') {
      const r = res as Record<string, unknown>;
      if (Array.isArray(r.items)) items = r.items as InstantlyAnalytics[];
      else if (Array.isArray(r.data)) items = r.data as InstantlyAnalytics[];
    }

    const data: Record<string, InstantlyAnalytics> = {};
    items.forEach((item) => {
      if (item.campaign_id) data[item.campaign_id] = item;
    });
    return { data };
  } catch (e) {
    return { data: {}, error: String(e) };
  }
}

export async function fetchReceivedEmails(
  apiKey: string,
  campaignId?: string,
  limit = 1000
): Promise<InstantlyEmail[]> {
  const params: Record<string, string> = {
    email_type: 'received',
    preview_only: 'false',
  };
  if (campaignId) params.campaign_id = campaignId;
  // 350ms between pages → 10 pages (1000 emails) takes ~3.5s, well under 20 req/min
  return paginateItems<InstantlyEmail>(apiKey, '/emails', params, limit, 350);
}

export async function fetchEmailById(
  apiKey: string,
  emailId: string
): Promise<InstantlyEmail | null> {
  try {
    return await get<InstantlyEmail>(apiKey, `/emails/${emailId}`);
  } catch {
    return null;
  }
}

// Named alias so any stale import of the old name still resolves
export const fetchCampaignAnalytics = fetchAllCampaignAnalytics;
