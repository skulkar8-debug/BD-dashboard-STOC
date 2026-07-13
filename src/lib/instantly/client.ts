import type {
  InstantlyCampaign,
  InstantlyAnalytics,
  InstantlyEmail,
} from './types';

const BASE = 'https://api.instantly.ai/api/v2';

// Shared state: track last request time to enforce a global minimum gap
let lastRequestAt = 0;
const MIN_REQUEST_GAP_MS = 600; // never fire faster than ~100 req/min across all calls

async function get<T>(
  apiKey: string,
  path: string,
  params: Record<string, string | string[]> = {},
  retries = 5
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (Array.isArray(v)) v.forEach((vi) => url.searchParams.append(k, vi));
    else url.searchParams.set(k, v);
  });
  for (let attempt = 0; attempt <= retries; attempt++) {
    // Enforce minimum gap between all requests
    const gap = Date.now() - lastRequestAt;
    if (gap < MIN_REQUEST_GAP_MS) await sleep(MIN_REQUEST_GAP_MS - gap);
    lastRequestAt = Date.now();

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
        throw new Error(`Instantly ${path} → 429 after ${retries} retries: ${text.slice(0, 300)}`);
      }
      // Exponential backoff: 5s, 10s, 20s, 40s, 80s
      const wait = 5000 * Math.pow(2, attempt);
      console.warn(`[Instantly] 429 on ${path}, waiting ${wait / 1000}s (attempt ${attempt + 1}/${retries})`);
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
// MIN_REQUEST_GAP_MS in get() already enforces a floor; interPageDelayMs adds extra breathing room
async function paginateItems<T>(
  apiKey: string,
  path: string,
  params: Record<string, string> = {},
  maxItems = 500,
  interPageDelayMs = 800
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
  limit = 10_000
): Promise<InstantlyEmail[]> {
  const params: Record<string, string> = {
    email_type: 'received',
    preview_only: 'false',
  };
  if (campaignId) params.campaign_id = campaignId;
  // 100ms between pages; retry-with-backoff in get() handles any 429s
  return paginateItems<InstantlyEmail>(apiKey, '/emails', params, limit, 100);
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
