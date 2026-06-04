// Instantly API V2 raw types

export type InstantlyCampaign = {
  id: string;
  name: string;
  status: number; // -2=stopped 0=draft 1=active 2=paused 3=completed
  timestamp_created: string;
  timestamp_updated: string;
  tags?: string[];
};

// Real field names from GET /api/v2/campaigns/analytics
export type InstantlyAnalytics = {
  campaign_id?: string;
  campaign_name?: string;
  campaign_status?: number;
  emails_sent_count?: number;
  open_count?: number;
  open_count_unique?: number;
  reply_count?: number;
  reply_count_unique?: number;
  reply_count_automatic?: number;
  bounced_count?: number;
  unsubscribed_count?: number;
  total_opportunities?: number;
  total_opportunity_value?: number;
  leads_count?: number;
  contacted_count?: number;
  completed_count?: number;
  new_leads_contacted_count?: number;
  link_click_count?: number;
};

export type InstantlyEmail = {
  id: string;
  timestamp_created?: string;
  timestamp_email: string;
  message_id?: string;
  subject?: string;
  body?: { text?: string; html?: string };
  organization_id?: string;
  eaccount?: string;
  from_address_email: string;
  to_address_email_list?: string | string[];
  cc_address_email_list?: string;
  campaign_id?: string;
  lead?: string;
  ue_type?: number;
  step?: string;
  is_unread?: number;
  ai_interest_value?: number;
  is_focused?: number;
  i_status?: number;
  thread_id?: string;
  content_preview?: string;
  from_address_json?: { name?: string; addr?: string }[];
};

export type InstantlyLead = {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  job_title?: string;
  email_reply_count?: number;
  lt_interest_status?: string;
  timestamp_last_reply?: string;
  timestamp_last_interest_change?: string;
  campaign_id?: string;
};

// ─── Org config ──────────────────────────────────────────────────────────────

export type OrgConfig = {
  id: string;
  label: string;
  envKey: string;
  apiKey: string | undefined;
  enabled: boolean;
  error?: string;
};

// ─── Reply classification ────────────────────────────────────────────────────

export type ReplyClassification =
  | 'positive_interested'
  | 'meeting_requested'
  | 'referral_given'
  | 'more_info_requested'
  | 'neutral_needs_review'
  | 'not_interested'
  | 'out_of_office'
  | 'unsubscribe'
  | 'negative_complaint'
  | 'auto_reply';

export const POSITIVE_CLASSIFICATIONS: ReplyClassification[] = [
  'positive_interested',
  'meeting_requested',
  'referral_given',
  'more_info_requested',
];

export const CLASSIFICATION_LABELS: Record<ReplyClassification, string> = {
  positive_interested: 'Positive / Interested',
  meeting_requested: 'Meeting Requested',
  referral_given: 'Referral / Correct Contact Given',
  more_info_requested: 'More Info Requested',
  neutral_needs_review: 'Neutral / Needs Review',
  not_interested: 'Not Interested',
  out_of_office: 'Out of Office',
  unsubscribe: 'Unsubscribe',
  negative_complaint: 'Negative / Complaint',
  auto_reply: 'Auto Reply',
};

export const CLASSIFICATION_COLORS: Record<ReplyClassification, string> = {
  positive_interested: '#10B981',
  meeting_requested: '#059669',
  referral_given: '#0D9488',
  more_info_requested: '#0EA5E9',
  neutral_needs_review: '#6B7280',
  not_interested: '#EF4444',
  out_of_office: '#F59E0B',
  unsubscribe: '#F97316',
  negative_complaint: '#DC2626',
  auto_reply: '#9CA3AF',
};

// ─── Sector mapping ──────────────────────────────────────────────────────────

export type SectorMapping = {
  org?: string;
  campaign_id?: string;
  campaign_name_pattern?: string;
  sector: string;
  state?: string;
  region?: string;
  bd_owner?: string;
  notes?: string;
};

// ─── Normalized types ────────────────────────────────────────────────────────

export type NormalizedEmail = {
  id: string;
  org_id: string;
  org_label: string;
  campaign_id: string;
  campaign_name: string;
  sector: string;
  state: string;
  region: string;
  bd_owner: string;
  timestamp_email: string;
  week: string;
  subject: string;
  content_preview: string;
  body_text: string;
  body_html: string;
  has_body_text: boolean;
  has_body_html: boolean;
  from_email: string;
  from_name: string;
  to_emails: string[];
  lead_id: string;
  thread_id: string;
  is_auto_reply: boolean;
  ai_interest_value: number | null;
  i_status: number | null;
  original_classification: ReplyClassification;
  manual_override: ReplyClassification | null;
  final_classification: ReplyClassification;
  is_positive: boolean;
};

export type NormalizedCampaign = {
  org_id: string;
  org_label: string;
  campaign_id: string;
  campaign_name: string;
  campaign_status: string;
  campaign_status_num: number;
  created_at: string;
  updated_at: string;
  tags: string[];
  sector: string;
  state: string;
  region: string;
  bd_owner: string;
  // Analytics (all-time, may be unavailable)
  sent: number;
  opens: number;
  opens_unique: number;
  replies_analytics: number;
  replies_unique_analytics: number;
  bounces: number;
  unsubscribes: number;
  opportunities: number;
  opportunity_value: number;
  leads_count: number;
  contacted_count: number;
  completed_count: number;
  analytics_available: boolean;
  // From actual email pull
  actual_received_count: number;
  positive_reply_count: number;
  last_reply_date: string | null;
  // Computed rates
  reply_rate: number;
  positive_reply_rate: number;
  bounce_rate: number;
  unsubscribe_rate: number;
  opportunity_rate: number;
  open_rate: number;
  recommended_action: string;
};

export type OrgData = {
  org: OrgConfig;
  campaigns: NormalizedCampaign[];
  emails: NormalizedEmail[];
  errors: { campaigns?: string; analytics?: string; emails?: string; leads?: string };
  email_pull_warning?: string;
};

export type BDData = {
  orgs: OrgData[];
  fetched_at: string;
  total_campaigns: number;
  total_emails: number;
};
