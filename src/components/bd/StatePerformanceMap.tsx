"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { MapContainer, GeoJSON } from "react-leaflet";
import L from "leaflet";
import type { Feature, FeatureCollection, Geometry, GeoJsonProperties } from "geojson";
import type { PathOptions, Layer, LeafletMouseEvent } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { NormalizedCampaign, NormalizedEmail } from "@/lib/instantly/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type StateStats = {
  state: string;
  sent: number;
  replies: number;
  reply_rate: number;
  positive: number;
  positive_rate: number;
  opportunities: number;
  campaigns: number;
  org_ids: Set<string>;
  org_labels: string[];
  sectors: string[];
  top_sector: string;
  top_org: string;
};

// ─── Color-by options ────────────────────────────────────────────────────────

export type ColorMetric = "positive" | "replies" | "positive_rate";

const COLOR_OPTIONS: { value: ColorMetric; label: string }[] = [
  { value: "positive",      label: "Positive Replies" },
  { value: "replies",       label: "Replies (Total)" },
  { value: "positive_rate", label: "Positive Reply Rate %" },
];

// Each metric has its own bucket thresholds and color ramp
// First color = no data / zero — slightly darker than background so states are visible
const METRIC_CONFIG: Record<
  ColorMetric,
  { buckets: number[]; colors: string[]; legendLabels: string[] }
> = {
  positive: {
    buckets: [0, 3, 9, 19],
    colors: ["#dde3ed", "#bfdbfe", "#60a5fa", "#2563eb", "#1e3a8a"],
    legendLabels: ["0", "1–3", "4–9", "10–19", "20+"],
  },
  replies: {
    buckets: [0, 9, 29, 59],
    colors: ["#dde3ed", "#d1fae5", "#6ee7b7", "#059669", "#064e3b"],
    legendLabels: ["0", "1–9", "10–29", "30–59", "60+"],
  },
  positive_rate: {
    buckets: [0, 10, 24, 39],
    colors: ["#dde3ed", "#fef9c3", "#fde047", "#ca8a04", "#78350f"],
    legendLabels: ["0%", "1–10%", "11–24%", "25–39%", "40%+"],
  },
};

function getColorForMetric(value: number, metric: ColorMetric): string {
  const { buckets, colors } = METRIC_CONFIG[metric];
  if (value <= 0) return colors[0];
  for (let i = 0; i < buckets.length; i++) {
    if (value <= buckets[i]) return colors[i];
  }
  return colors[colors.length - 1];
}

function getStatValue(s: StateStats, metric: ColorMetric): number {
  if (metric === "positive") return s.positive;
  if (metric === "replies") return s.replies;
  if (metric === "positive_rate") return s.positive_rate;
  return 0;
}

// ─── Compute per-state stats ──────────────────────────────────────────────────

function computeStateStats(
  campaigns: NormalizedCampaign[],
  emails: NormalizedEmail[]
): Map<string, StateStats> {
  const map = new Map<string, StateStats>();

  // Sector/org frequency per state (for top_sector / top_org)
  const sectorFreq = new Map<string, Map<string, number>>();
  const orgFreq = new Map<string, Map<string, { label: string; count: number }>>();

  campaigns.forEach((c) => {
    if (!c.state || c.state === "Unmapped") return;
    let s = map.get(c.state);
    if (!s) {
      s = {
        state: c.state,
        sent: 0, replies: 0, reply_rate: 0,
        positive: 0, positive_rate: 0,
        opportunities: 0, campaigns: 0,
        org_ids: new Set(),
        org_labels: [],
        sectors: [],
        top_sector: "—",
        top_org: "—",
      };
      map.set(c.state, s);
    }
    s.sent += c.sent;
    s.campaigns += 1;
    s.opportunities += c.opportunities;
    s.org_ids.add(c.org_id);
    if (!s.org_labels.includes(c.org_label)) s.org_labels.push(c.org_label);
    if (!s.sectors.includes(c.sector)) s.sectors.push(c.sector);

    // Sector frequency
    const sf = sectorFreq.get(c.state) ?? new Map<string, number>();
    sf.set(c.sector, (sf.get(c.sector) ?? 0) + 1);
    sectorFreq.set(c.state, sf);

    // Org frequency
    const of = orgFreq.get(c.state) ?? new Map<string, { label: string; count: number }>();
    const existing = of.get(c.org_id);
    of.set(c.org_id, { label: c.org_label, count: (existing?.count ?? 0) + 1 });
    orgFreq.set(c.state, of);
  });

  emails.forEach((e) => {
    if (!e.state || e.state === "Unmapped") return;
    const s = map.get(e.state);
    if (!s) return;
    s.replies += 1;
    if (e.is_positive) s.positive += 1;
  });

  map.forEach((s, stateName) => {
    s.reply_rate = s.sent > 0 ? Math.round((s.replies / s.sent) * 1000) / 10 : 0;
    s.positive_rate = s.replies > 0 ? Math.round((s.positive / s.replies) * 1000) / 10 : 0;

    const topSec = [...(sectorFreq.get(stateName) ?? [])].sort((a, b) => b[1] - a[1])[0];
    s.top_sector = topSec ? topSec[0] : "—";

    const topOrg = [...(orgFreq.get(stateName)?.values() ?? [])].sort((a, b) => b.count - a.count)[0];
    s.top_org = topOrg ? topOrg.label : "—";
  });

  return map;
}

// ─── Tooltip row ─────────────────────────────────────────────────────────────

function TRow({ label, value, em }: { label: string; value: string | number; em?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-400">{label}</span>
      <span className={`font-medium tabular-nums text-right ${em ? "text-emerald-600" : "text-gray-800"}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  campaigns: NormalizedCampaign[];
  emails: NormalizedEmail[];
};

const GEOJSON_URL =
  "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json";

const DEFAULT_STYLE: PathOptions = {
  weight: 1,
  opacity: 1,
  color: "#94a3b8",   // slate-400 — visible gray border between states
  fillOpacity: 0.82,
};

const HOVER_STYLE: PathOptions = {
  weight: 2.5,
  color: "#1e40af",   // blue-800 — clear highlight on hover
  fillOpacity: 0.95,
};

export default function StatePerformanceMap({ campaigns, emails }: Props) {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [colorBy, setColorBy] = useState<ColorMetric>("positive");

  const stateStats = useMemo(
    () => computeStateStats(campaigns, emails),
    [campaigns, emails]
  );

  // Case-insensitive lookup map — handles GeoJSON NAME casing/whitespace variants
  const statsLookup = useMemo(() => {
    const m = new Map<string, StateStats>();
    stateStats.forEach((stats, name) => {
      m.set(name, stats);                            // exact
      m.set(name.toLowerCase().trim(), stats);       // lowercase
      m.set(name.toUpperCase().trim(), stats);       // uppercase
    });
    return m;
  }, [stateStats]);

  const lookupState = useCallback(
    (rawName: string): StateStats | undefined =>
      statsLookup.get(rawName) ??
      statsLookup.get(rawName.trim()) ??
      statsLookup.get(rawName.toLowerCase().trim()),
    [statsLookup]
  );

  // Extract state name from a GeoJSON feature — try multiple common property keys
  function getFeatureName(feature?: Feature<Geometry, GeoJsonProperties>): string {
    if (!feature?.properties) return "";
    const p = feature.properties;
    return (
      (p["NAME"] as string) ??
      (p["name"] as string) ??
      (p["State"] as string) ??
      (p["state"] as string) ??
      (p["STATE_NAME"] as string) ??
      ""
    );
  }

  // Key forces GeoJSON layer to re-render when filter data or colorBy changes
  // Include stateStats.size AND total positive so any real data change triggers re-render
  const dataKey = useMemo(() => {
    let pos = 0, rep = 0;
    stateStats.forEach((s) => { pos += s.positive; rep += s.replies; });
    return `${colorBy}-${stateStats.size}-${pos}-${rep}`;
  }, [stateStats, colorBy]);

  useEffect(() => {
    let live = true;
    setLoadState("loading");
    fetch(GEOJSON_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`GeoJSON fetch ${r.status}`);
        return r.json() as Promise<FeatureCollection>;
      })
      .then((d) => { if (live) { setGeoData(d); setLoadState("ready"); } })
      .catch(() => { if (live) setLoadState("error"); });
    return () => { live = false; };
  }, []);

  const styleFeature = useCallback(
    (feature?: Feature<Geometry, GeoJsonProperties>): PathOptions => {
      const name = getFeatureName(feature);
      const s = lookupState(name);
      const val = s ? getStatValue(s, colorBy) : 0;
      return { ...DEFAULT_STYLE, fillColor: getColorForMetric(val, colorBy) };
    },
    [lookupState, colorBy] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onEachFeature = useCallback(
    (feature: Feature<Geometry, GeoJsonProperties>, layer: Layer) => {
      const name = getFeatureName(feature);
      const path = layer as L.Path;
      path.on({
        mouseover(e: LeafletMouseEvent) {
          const s = lookupState(name);
          setHoveredState(s ? s.state : name || null);
          const val = s ? getStatValue(s, colorBy) : 0;
          (e.target as L.Path).setStyle({ ...HOVER_STYLE, fillColor: getColorForMetric(val, colorBy) });
          (e.target as L.Path).bringToFront();
        },
        mouseout(e: LeafletMouseEvent) {
          setHoveredState(null);
          const s = lookupState(name);
          const val = s ? getStatValue(s, colorBy) : 0;
          (e.target as L.Path).setStyle({ ...DEFAULT_STYLE, fillColor: getColorForMetric(val, colorBy) });
        },
      });
    },
    [lookupState, colorBy] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const hovered = hoveredState ? (lookupState(hoveredState) ?? null) : null;
  const cfg = METRIC_CONFIG[colorBy];
  const activeOption = COLOR_OPTIONS.find((o) => o.value === colorBy)!;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header with color-by dropdown */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-gray-700">State Performance Map</div>
          <div className="text-xs text-gray-400 mt-0.5">
            Hover over a state to view performance details.
          </div>
        </div>

        {/* Color-by dropdown */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
            Color by
          </label>
          <select
            value={colorBy}
            onChange={(e) => setColorBy(e.target.value as ColorMetric)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
          >
            {COLOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Map + tooltip + legend */}
      <div className="relative" style={{ height: 410 }}>
        {loadState === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
            <span className="text-sm text-gray-400">Loading map…</span>
          </div>
        )}
        {loadState === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
            <span className="text-sm text-red-400">
              Map data unavailable. Check network connection.
            </span>
          </div>
        )}

        {loadState === "ready" && geoData && (
          <MapContainer
            center={[37.8, -96]}
            zoom={4}
            zoomControl={false}
            scrollWheelZoom={false}
            dragging={false}
            doubleClickZoom={false}
            boxZoom={false}
            keyboard={false}
            touchZoom={false}
            attributionControl={false}
            style={{ height: "100%", width: "100%", background: "#ffffff" }}
          >
            <GeoJSON
              key={dataKey}
              data={geoData}
              style={styleFeature}
              onEachFeature={onEachFeature}
            />
          </MapContainer>
        )}

        {/* Tooltip info card — top right */}
        {loadState === "ready" && (
          <div
            className="absolute top-3 right-3 z-[1000] w-56 bg-white/95 border border-gray-200 rounded-xl shadow-lg p-3 text-xs pointer-events-none"
            style={{ backdropFilter: "blur(4px)" }}
          >
            {!hoveredState ? (
              <div className="text-gray-400 text-center py-3 leading-relaxed">
                Hover over a state<br />to view performance
              </div>
            ) : !hovered ? (
              <>
                <div className="font-semibold text-gray-800 mb-2">{hoveredState}</div>
                <div className="text-gray-400 text-center py-1">No activity for selected filters.</div>
              </>
            ) : (
              <>
                <div className="font-semibold text-gray-800 mb-2 text-sm">{hoveredState}</div>
                <div className="space-y-1">
                  <TRow label="Sent" value={hovered.sent.toLocaleString()} />
                  <TRow label="Replies" value={hovered.replies.toLocaleString()} em={colorBy === "replies"} />
                  <TRow label="Reply Rate" value={`${hovered.reply_rate}%`} />
                  <TRow label="Positive Replies" value={hovered.positive} em={colorBy === "positive"} />
                  <TRow label="Positive Rate" value={`${hovered.positive_rate}%`} em={colorBy === "positive_rate"} />
                  <TRow label="Opportunities" value={hovered.opportunities} />
                  <TRow label="Campaigns" value={hovered.campaigns} />
                  <TRow label="Active Orgs" value={hovered.org_ids.size} />
                  <TRow label="Active Sectors" value={hovered.sectors.length} />
                  <TRow label="Top Sector" value={hovered.top_sector} />
                  <TRow label="Top Org" value={hovered.top_org} />
                </div>
              </>
            )}
          </div>
        )}

        {/* Legend — bottom left, updates with colorBy */}
        {loadState === "ready" && (
          <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 border border-gray-100 rounded-lg p-2.5 pointer-events-none shadow-sm">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              {activeOption.label}
            </div>
            {cfg.colors.map((color, i) => (
              <div key={i} className="flex items-center gap-1.5 mb-1 last:mb-0">
                <span
                  className="inline-block w-4 h-3.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: color, border: "1px solid #e5e7eb" }}
                />
                <span className="text-[11px] text-gray-600">
                  {cfg.legendLabels[i]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-400">
        Sent reflects all-time analytics for selected campaigns · Replies are date-filtered by received timestamp
      </div>
    </div>
  );
}
