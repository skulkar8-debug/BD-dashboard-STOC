import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const INSTANTLY_BASE = "https://api.instantly.ai/api/v2";

const ACCOUNTS: Record<string, string | undefined> = {
  MY_ORG:    process.env.INSTANTLY_MY_ORG_API_KEY,
  EMBARK:    process.env.INSTANTLY_EMBARK_API_KEY,
  SUN_AUTO:  process.env.INSTANTLY_SUN_AUTO_API_KEY,
  AEG_VISION:process.env.INSTANTLY_AEG_VISION_API_KEY,
  MCLERRAN:  process.env.INSTANTLY_MCLERRAN_API_KEY,
  BRANTA:    process.env.INSTANTLY_BRANTA_API_KEY,
  CORVIA:    process.env.INSTANTLY_CORVIA_API_KEY,
};

async function instantlyGet(apiKey: string, path: string, params?: Record<string, string>) {
  const url = new URL(`${INSTANTLY_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = text; }

  return { status: res.status, ok: res.ok, body };
}

export async function GET() {
  const results: Record<string, unknown> = {};

  for (const [name, rawKey] of Object.entries(ACCOUNTS)) {
    if (!rawKey) {
      results[name] = { error: "env var not set" };
      continue;
    }

    const apiKey = rawKey.trim();

    const [accounts, campaigns, emails] = await Promise.all([
      instantlyGet(apiKey, "/accounts", { limit: "10" }),
      instantlyGet(apiKey, "/campaigns", { limit: "10" }),
      instantlyGet(apiKey, "/emails", { limit: "10", email_type: "received", preview_only: "false" }),
    ]);

    results[name] = {
      apiKeyPreview: `${apiKey.slice(0, 8)}…`,
      accounts: { status: accounts.status, body: accounts.body },
      campaigns: { status: campaigns.status, body: campaigns.body },
      emails_received: { status: emails.status, body: emails.body },
    };
  }

  return NextResponse.json(results, { status: 200 });
}
