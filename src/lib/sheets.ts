// Fetches pipeline data from the public Google Sheet (CSV export)
// Sheet must be shared as "Anyone with the link can view"

import Papa from "papaparse";
import { subDays, parseISO, isValid } from "date-fns";

export const SHEET_ID = "1x36UMX4T21Jc0Uv1WCSiCuYyLRK860rKzZpRet7xH_Y";
export const SHEET_GID = "0";

const EXCLUDED_STATUSES = [
  "Interested / Qualified",
  "Interested - Future Follow Up",
  "Submitted to Client: Future Follow Up",
  "Not Acquired (Exited Process)",
];

export type PipelineRow = {
  opportunity: string;
  ownerName: string;
  annualizedValue: number;
  city: string;
  state: string;
  currentStatus: string;
  statusUpdate: string | null;
  daysInStatus: number | null;
  lastContactOn: string | null;
  lastCommSummary: string;
  ndaRequested: string | null;
  ndaReceived: string | null;
  submitted: string | null;
  loi: string | null;
  nda: string | null;
  qre: string | null;
  fin: string | null;
  calls: string | null;
  emails: string | null;
  texts: string | null;
  notes: string;
  lat?: number;
  lng?: number;
};

let geocodeCache: Record<string, { lat: number; lng: number } | null> = {};

async function geocode(
  company: string,
  city: string,
  state: string
): Promise<{ lat: number; lng: number } | null> {
  const key = `${city},${state}`;
  if (key in geocodeCache) return geocodeCache[key];

  // Try company name + city + state first, fall back to just city + state
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
        const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
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

function parseDate(val: string | undefined): string | null {
  if (!val || val.trim() === "") return null;
  const cleaned = val.trim();
  // Try ISO first
  const iso = parseISO(cleaned);
  if (isValid(iso)) return cleaned;
  // Try M/D/YYYY
  const parts = cleaned.split("/");
  if (parts.length === 3) {
    const d = new Date(`${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`);
    if (isValid(d)) return d.toISOString().slice(0, 10);
  }
  return cleaned;
}

function parseCurrency(val: string | undefined): number {
  if (!val) return 0;
  return parseInt(val.replace(/[$,]/g, ""), 10) || 0;
}

function parseDays(val: string | undefined): number | null {
  if (!val || val.trim() === "") return null;
  const n = parseInt(val.trim(), 10);
  return isNaN(n) ? null : n;
}

export async function fetchPipelineData(
  from?: Date,
  to?: Date
): Promise<PipelineRow[]> {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

  const res = await fetch(csvUrl, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Failed to fetch sheet: ${res.status}`);

  const text = await res.text();

  const { data } = Papa.parse<string[]>(text, { skipEmptyLines: true });

  // Row 0 = header
  const rows: PipelineRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const status = (r[5] || "").trim();
    if (EXCLUDED_STATUSES.includes(status)) continue;
    if (!status) continue;

    const statusUpdate = parseDate(r[6]);

    // Date range filter on STATUS UPDATE
    if (from && to && statusUpdate) {
      const d = parseISO(statusUpdate);
      if (isValid(d) && (d < from || d > to)) continue;
    }

    rows.push({
      opportunity: (r[0] || "").trim(),
      ownerName: (r[1] || "").trim(),
      annualizedValue: parseCurrency(r[2]),
      city: (r[3] || "").trim(),
      state: (r[4] || "").trim(),
      currentStatus: status,
      statusUpdate,
      daysInStatus: parseDays(r[7]),
      lastContactOn: parseDate(r[9]),
      lastCommSummary: (r[10] || "").trim(),
      ndaRequested: parseDate(r[11]),
      ndaReceived: parseDate(r[12]),
      submitted: parseDate(r[13]),
      loi: (r[14] || "").trim() || null,
      nda: (r[15] || "").trim() || null,
      qre: (r[16] || "").trim() || null,
      fin: (r[17] || "").trim() || null,
      calls: (r[18] || "").trim() || null,
      emails: (r[19] || "").trim() || null,
      texts: (r[20] || "").trim() || null,
      notes: (r[21] || "").trim(),
    });
  }

  // Geocode in parallel (rate-limit to 5 at a time)
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
    // Rate-limit: 5 req/s for Nominatim
    if (i + batchSize < rows.length) await sleep(1100);
  }

  return rows;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const STATUS_COLORS: Record<string, string> = {
  "NDA Requested":        "#3B82F6", // blue
  "NDA Received":         "#8B5CF6", // violet
  "Submitted to Client":  "#06B6D4", // cyan
  "LOI Received":         "#F59E0B", // amber
  "Under LOI":            "#F97316", // orange
  "LOI Signed":           "#EF4444", // red
  "QRE/Fin Received":     "#EC4899", // pink
  "In Due Diligence":     "#14B8A6", // teal
  "Closed":               "#10B981", // emerald
  "Dead":                 "#6B7280", // gray
  "On Hold":              "#A3A3A3", // neutral
};

// Deterministic color for any status not in the map
const FALLBACK_PALETTE = [
  "#6366F1","#D946EF","#0EA5E9","#84CC16","#F43F5E",
  "#FB923C","#A78BFA","#34D399","#FBBF24","#38BDF8",
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
