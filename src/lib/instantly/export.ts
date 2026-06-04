import type { NormalizedCampaign, NormalizedEmail } from './types';

function escapeCsv(val: unknown): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
}

export function exportCampaignsCsv(campaigns: NormalizedCampaign[]): string {
  const headers = [
    'Org', 'Sector', 'State', 'Region', 'BD Owner',
    'Campaign Name', 'Status',
    'Sent', 'Opens', 'Open Rate %',
    'Replies (analytics)', 'Reply Rate %',
    'Actual Received', 'Positive Replies', 'Positive Reply Rate %',
    'Bounces', 'Bounce Rate %',
    'Unsubscribes', 'Unsubscribe Rate %',
    'Opportunities', 'Opportunity Rate %',
    'Last Reply Date', 'Recommended Action',
  ];
  const rows = campaigns.map((c) => [
    c.org_label, c.sector, c.state, c.region, c.bd_owner,
    c.campaign_name, c.campaign_status,
    c.sent, c.opens, c.open_rate,
    c.replies_analytics, c.reply_rate,
    c.actual_received_count, c.positive_reply_count, c.positive_reply_rate,
    c.bounces, c.bounce_rate,
    c.unsubscribes, c.unsubscribe_rate,
    c.opportunities, c.opportunity_rate,
    c.last_reply_date ?? '', c.recommended_action,
  ].map(String));
  return toCsv(headers, rows);
}

export function exportEmailsCsv(emails: NormalizedEmail[]): string {
  const headers = [
    'Org', 'Sector', 'State', 'Campaign', 'Week',
    'From Email', 'From Name', 'To',
    'Subject', 'Reply Preview', 'Body Text',
    'Reply Date', 'Classification', 'Is Positive',
    'AI Interest Value', 'Campaign ID', 'Lead ID',
  ];
  const rows = emails.map((e) => [
    e.org_label, e.sector, e.state, e.campaign_name, e.week,
    e.from_email, e.from_name, e.to_emails.join('; '),
    e.subject, e.content_preview, e.body_text.slice(0, 1000),
    e.timestamp_email, e.final_classification, String(e.is_positive),
    String(e.ai_interest_value ?? ''), e.campaign_id, e.lead_id,
  ].map(String));
  return toCsv(headers, rows);
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
