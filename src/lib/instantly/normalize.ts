import { getISOWeek, getISOWeekYear, parseISO, isValid } from 'date-fns';
import type {
  InstantlyCampaign,
  InstantlyAnalytics,
  InstantlyEmail,
  NormalizedCampaign,
  NormalizedEmail,
  OrgConfig,
  SectorMapping,
} from './types';
import { CAMPAIGN_SECTOR_MAP, KNOWN_SECTORS } from '@/config/campaign-sector-map';
import { normalizeState } from './states';
import { classifyEmail, isPositive } from './classify';

export const CAMPAIGN_STATUS_LABELS: Record<number, string> = {
  [-2]: 'Stopped',
  0: 'Draft',
  1: 'Active',
  2: 'Paused',
  3: 'Completed',
};

function getCampaignStatus(num: number): string {
  return CAMPAIGN_STATUS_LABELS[num] ?? `Unknown (${num})`;
}

// ─── Sector / state resolution ────────────────────────────────────────────────

function parseCampaignName(name: string): {
  parsed_sector: string;
  parsed_state: string;
  parsed_variant: string;
} {
  // Split on " - " separator
  const parts = name.split(' - ').map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    // Scan parts[1..] for the first valid US state — handles patterns like:
    // "Sector - State" → parts[1] is state
    // "Sector - PersonName - State" → parts[1] is not a state, parts[2] is
    // "Org - Sector - State - Variant" → parts[2] is state
    let stateIdx = -1;
    let resolvedState = 'Unmapped';
    for (let i = 1; i < parts.length; i++) {
      const s = normalizeState(parts[i]);
      if (s) { stateIdx = i; resolvedState = s; break; }
    }
    const variantParts = stateIdx >= 0
      ? parts.filter((_, i) => i !== 0 && i !== stateIdx)
      : parts.slice(2);
    return {
      parsed_sector: parts[0],
      parsed_state: resolvedState,
      parsed_variant: variantParts.join(' - '),
    };
  }
  return { parsed_sector: 'Unmapped', parsed_state: 'Unmapped', parsed_variant: name };
}

export function resolveMapping(
  orgId: string,
  campaignId: string,
  campaignName: string
): { sector: string; state: string; region: string; bd_owner: string } {
  const map = CAMPAIGN_SECTOR_MAP as SectorMapping[];

  // 1. Exact campaign_id match
  const byId = map.find((m) => m.campaign_id === campaignId);
  if (byId) {
    const parsed = parseCampaignName(campaignName);
    return {
      sector: byId.sector,
      state: byId.state ?? parsed.parsed_state,
      region: byId.region ?? '',
      bd_owner: byId.bd_owner ?? '',
    };
  }

  // 2. campaign_name_pattern — org-scoped entries take priority over global
  const patternEntries = map.filter((m) => m.campaign_name_pattern);
  const byOrgPattern = patternEntries
    .filter((m) => m.org === orgId)
    .find((m) => campaignName.toLowerCase().includes(m.campaign_name_pattern!.toLowerCase()));
  const byGlobalPattern = !byOrgPattern
    ? patternEntries
        .filter((m) => !m.org)
        .find((m) => campaignName.toLowerCase().includes(m.campaign_name_pattern!.toLowerCase()))
    : null;
  const byPattern = byOrgPattern ?? byGlobalPattern;

  if (byPattern) {
    const parsed = parseCampaignName(campaignName);
    return {
      sector: byPattern.sector,
      state: byPattern.state ?? parsed.parsed_state,
      region: byPattern.region ?? '',
      bd_owner: byPattern.bd_owner ?? '',
    };
  }

  // 3. Org-level default (no pattern, no campaign_id, specific org)
  const byOrg = map.find(
    (m) => m.org === orgId && !m.campaign_name_pattern && !m.campaign_id
  );
  if (byOrg) {
    const parsed = parseCampaignName(campaignName);
    return {
      sector: byOrg.sector,
      state: byOrg.state ?? parsed.parsed_state,
      region: byOrg.region ?? '',
      bd_owner: byOrg.bd_owner ?? '',
    };
  }

  // 4. Fallback: parse campaign name
  const parsed = parseCampaignName(campaignName);
  // Only accept the parsed sector if it's a recognized canonical sector name
  const sector = KNOWN_SECTORS.has(parsed.parsed_sector)
    ? parsed.parsed_sector
    : 'Other / Unmapped';
  return { sector, state: parsed.parsed_state, region: '', bd_owner: '' };
}

// ─── Week helper ──────────────────────────────────────────────────────────────

function toWeek(isoString: string): string {
  try {
    const d = parseISO(isoString);
    if (!isValid(d)) return 'Unknown';
    const yr = getISOWeekYear(d);
    const wk = String(getISOWeek(d)).padStart(2, '0');
    return `${yr}-W${wk}`;
  } catch {
    return 'Unknown';
  }
}

// ─── Analytics field extraction (real Instantly field names) ─────────────────

function n(val: unknown): number {
  return typeof val === 'number' ? val : 0;
}

function extractAnalytics(a: InstantlyAnalytics) {
  return {
    sent: n(a.emails_sent_count),
    opens: n(a.open_count),
    opens_unique: n(a.open_count_unique ?? a.open_count),
    replies: n(a.reply_count),
    replies_unique: n(a.reply_count_unique ?? a.reply_count),
    bounces: n(a.bounced_count),
    unsubscribes: n(a.unsubscribed_count),
    opportunities: n(a.total_opportunities),
    opportunity_value: n(a.total_opportunity_value),
    leads_count: n(a.leads_count),
    contacted_count: n(a.contacted_count),
    completed_count: n(a.completed_count),
  };
}

// ─── Recommended action ───────────────────────────────────────────────────────

function recommendAction(c: {
  sent: number;
  reply_rate: number;
  positive_reply_count: number;
  bounce_rate: number;
  unsubscribe_rate: number;
  opportunities: number;
  campaign_status_num: number;
}): string {
  if (c.campaign_status_num === 0) return 'Draft — not launched';
  if (c.sent === 0) return 'No data';
  if (c.bounce_rate > 5 || c.unsubscribe_rate > 2) return 'Pause / Review';
  if (c.positive_reply_count > 0 || c.opportunities > 0) return 'Follow Up';
  if (c.sent >= 50 && c.reply_rate < 1) return 'Review';
  if (c.reply_rate >= 3) return 'Continue';
  if (c.campaign_status_num === 3) return 'Completed';
  return 'Monitor';
}

// ─── Main normalizers ─────────────────────────────────────────────────────────

export function normalizeCampaign(
  org: OrgConfig,
  campaign: InstantlyCampaign,
  analytics: InstantlyAnalytics | null,
  emails: NormalizedEmail[]
): NormalizedCampaign {
  const mapping = resolveMapping(org.id, campaign.id, campaign.name);
  const a = analytics ? extractAnalytics(analytics) : null;

  const actual_received_count = emails.length;
  const positive_reply_count = emails.filter((e) => e.is_positive).length;
  const sorted = [...emails].sort((a, b) =>
    b.timestamp_email.localeCompare(a.timestamp_email)
  );
  const last_reply_date = sorted[0]?.timestamp_email ?? null;

  const sent = a?.sent ?? 0;
  const reply_rate = sent > 0 ? (actual_received_count / sent) * 100 : 0;
  const pos_reply_rate =
    actual_received_count > 0 ? (positive_reply_count / actual_received_count) * 100 : 0;
  const bounce_rate = sent > 0 ? ((a?.bounces ?? 0) / sent) * 100 : 0;
  const unsubscribe_rate = sent > 0 ? ((a?.unsubscribes ?? 0) / sent) * 100 : 0;
  const opportunity_rate = sent > 0 ? ((a?.opportunities ?? 0) / sent) * 100 : 0;
  const open_rate = sent > 0 ? ((a?.opens ?? 0) / sent) * 100 : 0;

  const round1 = (v: number) => Math.round(v * 10) / 10;

  const c: NormalizedCampaign = {
    org_id: org.id,
    org_label: org.label,
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    campaign_status: getCampaignStatus(campaign.status),
    campaign_status_num: campaign.status,
    created_at: campaign.timestamp_created,
    updated_at: campaign.timestamp_updated,
    tags: campaign.tags ?? [],
    ...mapping,
    sent,
    opens: a?.opens ?? 0,
    opens_unique: a?.opens_unique ?? 0,
    replies_analytics: a?.replies ?? 0,
    replies_unique_analytics: a?.replies_unique ?? 0,
    bounces: a?.bounces ?? 0,
    unsubscribes: a?.unsubscribes ?? 0,
    opportunities: a?.opportunities ?? 0,
    opportunity_value: a?.opportunity_value ?? 0,
    leads_count: a?.leads_count ?? 0,
    contacted_count: a?.contacted_count ?? 0,
    completed_count: a?.completed_count ?? 0,
    analytics_available: !!analytics,
    actual_received_count,
    positive_reply_count,
    last_reply_date,
    reply_rate: round1(reply_rate),
    positive_reply_rate: round1(pos_reply_rate),
    bounce_rate: round1(bounce_rate),
    unsubscribe_rate: round1(unsubscribe_rate),
    opportunity_rate: round1(opportunity_rate),
    open_rate: round1(open_rate),
    recommended_action: '',
  };
  c.recommended_action = recommendAction(c);
  return c;
}

export function normalizeEmail(
  org: OrgConfig,
  email: InstantlyEmail,
  campaignName: string,
  sector: string,
  state: string,
  region: string,
  bd_owner: string,
  manualOverrides: Record<string, string> = {}
): NormalizedEmail {
  const bodyText = email.body?.text ?? '';
  const bodyHtml = email.body?.html ?? '';

  const toRaw = email.to_address_email_list;
  const toEmails = Array.isArray(toRaw)
    ? toRaw
    : typeof toRaw === 'string' && toRaw
    ? [toRaw]
    : [];

  const fromJson = email.from_address_json?.[0];
  const original_classification = classifyEmail(email);
  const manual_override =
    (manualOverrides[email.id] as NormalizedEmail['manual_override']) ?? null;
  const final_classification = manual_override ?? original_classification;

  return {
    id: email.id,
    org_id: org.id,
    org_label: org.label,
    campaign_id: email.campaign_id ?? '',
    campaign_name: campaignName,
    sector,
    state,
    region,
    bd_owner,
    timestamp_email: email.timestamp_email,
    week: toWeek(email.timestamp_email),
    subject: email.subject ?? '',
    content_preview: email.content_preview ?? bodyText.slice(0, 200),
    body_text: bodyText,
    body_html: bodyHtml,
    has_body_text: bodyText.trim().length > 0,
    has_body_html: bodyHtml.trim().length > 0,
    from_email: email.from_address_email,
    from_name: fromJson?.name ?? '',
    to_emails: toEmails,
    lead_id: email.lead ?? '',
    thread_id: email.thread_id ?? '',
    is_auto_reply:
      original_classification === 'bounce' ||
      original_classification === 'auto_reply' ||
      original_classification === 'out_of_office',
    ai_interest_value: email.ai_interest_value ?? null,
    i_status: email.i_status ?? null,
    original_classification,
    manual_override,
    final_classification,
    is_positive: isPositive(final_classification),
  };
}
