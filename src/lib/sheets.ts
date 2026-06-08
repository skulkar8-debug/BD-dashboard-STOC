// Pipeline sheet helpers — data is fetched via OAuth-backed /api/pipeline

import type { PipelineRow } from "./sheets/pipelineParser";

export type { PipelineRow } from "./sheets/pipelineParser";
export { parsePipelineRows } from "./sheets/pipelineParser";

export const SHEET_ID =
  process.env.GOOGLE_PIPELINE_SHEET_ID?.trim() ||
  "1x36UMX4T21Jc0Uv1WCSiCuYyLRK860rKzZpRet7xH_Y";

let geocodeCache: Record<string, { lat: number; lng: number } | null> = {};

async function geocode(
  company: string,
  city: string,
  state: string
): Promise<{ lat: number; lng: number } | null> {
  const key = `${city},${state}`;
  if (key in geocodeCache) return geocodeCache[key];

  const queries = [
    `${company}, ${city}, ${state}, USA`,
    `${city}, ${state}, USA`,
  ];

  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=us`;
      const res = await fetch(url, {
        headers: { "User-Agent": "STOC-Dashboard/1.0 contact@stocadvisory.com" },
        next: { revalidate: 86400 },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.length > 0) {
        const result = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
        geocodeCache[key] = result;
        return result;
      }
    } catch {
      // continue to next query
    }
  }
  geocodeCache[key] = null;
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function geocodePipelineRows(
  rows: PipelineRow[]
): Promise<PipelineRow[]> {
  const batchSize = 5;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (row) => {
        const coords = await geocode(row.opportunity, row.city, row.state);
        if (coords) {
          row.lat = coords.lat;
          row.lng = coords.lng;
        }
      })
    );
    if (i + batchSize < rows.length) await sleep(1100);
  }
  return rows;
}

/** Client-side fetch via OAuth-backed API route. */
export async function fetchPipelineData(
  from?: Date,
  to?: Date
): Promise<PipelineRow[]> {
  const params = new URLSearchParams();
  if (from) params.set("from", from.toISOString().slice(0, 10));
  if (to) params.set("to", to.toISOString().slice(0, 10));

  const res = await fetch(`/api/pipeline?${params}`, { cache: "no-store" });
  const body = await res.json();

  if (!res.ok) {
    const err = new Error(body.message ?? "Failed to fetch pipeline data") as Error & {
      status?: number;
      loginUrl?: string;
      code?: string;
    };
    err.status = res.status;
    err.loginUrl = body.loginUrl;
    err.code = body.error;
    throw err;
  }

  return body.rows as PipelineRow[];
}

export const STATUS_COLORS: Record<string, string> = {
  "NDA Requested": "#3B82F6",
  "NDA Received": "#8B5CF6",
  "Submitted to Client": "#06B6D4",
  "LOI Received": "#F59E0B",
  "Under LOI": "#F97316",
  "LOI Signed": "#EF4444",
  "QRE/Fin Received": "#EC4899",
  "In Due Diligence": "#14B8A6",
  Closed: "#10B981",
  Dead: "#6B7280",
  "On Hold": "#A3A3A3",
};

const FALLBACK_PALETTE = [
  "#6366F1",
  "#D946EF",
  "#0EA5E9",
  "#84CC16",
  "#F43F5E",
  "#FB923C",
  "#A78BFA",
  "#34D399",
  "#FBBF24",
  "#38BDF8",
];

function hashColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[h % FALLBACK_PALETTE.length];
}

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? hashColor(status);
}

export function formatCurrency(val: number): string {
  if (!val) return "—";
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toLocaleString()}`;
}
