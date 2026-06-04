import { NextResponse } from 'next/server';
import { ORGS } from '@/lib/instantly/orgs';
import {
  fetchCampaigns,
  fetchAllCampaignAnalytics,
  fetchReceivedEmails,
  fetchEmailById,
} from '@/lib/instantly/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const results = await Promise.allSettled(
    ORGS.map(async (org) => {
      if (!org.apiKey) {
        return {
          org: org.label,
          org_id: org.id,
          auth: 'missing' as const,
          error: 'No API key in env',
          api_key_preview: '—',
          campaigns_count: 0,
          campaigns: [],
          emails_count: 0,
          emails_sample: [],
          analytics_tested: null,
          errors: {},
        };
      }

      const errors: Record<string, string> = {};
      const apiKeyPreview = org.apiKey.slice(0, 8) + '…';

      // 1. Campaigns
      let campaigns: Awaited<ReturnType<typeof fetchCampaigns>> = [];
      let auth: 'ok' | 'failed' = 'failed';
      try {
        campaigns = await fetchCampaigns(org.apiKey);
        auth = 'ok';
      } catch (e) {
        errors.campaigns = String(e);
        return {
          org: org.label, org_id: org.id, auth, api_key_preview: apiKeyPreview,
          campaigns_count: 0, campaigns: [], emails_count: 0, emails_sample: [],
          analytics_tested: null, errors,
        };
      }

      // 2. Analytics — fetch all and report coverage
      let analytics_tested: Record<string, unknown> | null = null;
      {
        const result = await fetchAllCampaignAnalytics(org.apiKey);
        const matched = campaigns[0]?.id ? result.data[campaigns[0].id] : null;
        analytics_tested = {
          total_returned: Object.keys(result.data).length,
          sample_campaign_id: campaigns[0]?.id ?? null,
          sample_campaign_name: campaigns[0]?.name ?? null,
          available: Object.keys(result.data).length > 0,
          sample_analytics: matched ?? null,
          error: result.error ?? null,
        };
        if (result.error) errors.analytics = result.error;
      }

      // 3. Received emails (first page only)
      let rawEmails: Awaited<ReturnType<typeof fetchReceivedEmails>> = [];
      try {
        rawEmails = await fetchReceivedEmails(org.apiKey, undefined, 10);
      } catch (e) {
        errors.emails = String(e);
      }

      // 4. Enrich up to 3 emails — fetch full body if missing
      const emailSamples = [];
      for (const e of rawEmails.slice(0, 3)) {
        let full = e;
        const hasBodyInList = !!(e.body?.text || e.body?.html);
        if (!hasBodyInList) {
          const fetched = await fetchEmailById(org.apiKey, e.id);
          if (fetched) full = fetched;
        }
        emailSamples.push({
          id: full.id,
          timestamp_email: full.timestamp_email,
          subject: full.subject ?? '',
          from_email: full.from_address_email,
          campaign_id: full.campaign_id ?? '',
          thread_id: full.thread_id ?? '',
          ai_interest_value: full.ai_interest_value ?? null,
          i_status: full.i_status ?? null,
          content_preview: (full.content_preview ?? '').slice(0, 300),
          body_text: (full.body?.text ?? '').slice(0, 600),
          actual_reply_body_returned: !!(full.body?.text || full.body?.html),
          body_text_present: !!full.body?.text,
          body_html_present: !!full.body?.html,
          analytics_reply_count: analytics_tested?.total_returned ?? 'n/a',
        });
      }

      return {
        org: org.label,
        org_id: org.id,
        auth,
        api_key_preview: apiKeyPreview,
        campaigns_count: campaigns.length,
        campaigns: campaigns.slice(0, 5).map((c) => ({
          id: c.id, name: c.name, status: c.status, created: c.timestamp_created,
        })),
        emails_count: rawEmails.length,
        emails_sample: emailSamples,
        analytics_tested,
        errors,
      };
    })
  );

  const data = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          org: ORGS[i].label,
          org_id: ORGS[i].id,
          auth: 'error',
          error: String((r as PromiseRejectedResult).reason),
          errors: {},
        }
  );

  return NextResponse.json(data);
}
