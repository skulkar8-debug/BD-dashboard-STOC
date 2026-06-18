"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { MapContainer, GeoJSON, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { PathOptions } from "leaflet";
import type { Feature, FeatureCollection, Geometry, GeoJsonProperties } from "geojson";

type ByState = Map<string, { replies: number; positive: number }>;

export type CompareHeatMapProps = {
  byState: ByState;
  /** hex color for this sector — controls the bucket color ramp */
  color: "blue" | "green";
  label: string;
};

const BUCKETS = {
  blue:  { thresholds: [0, 3, 9, 19], colors: ["#f0f4f8", "#bfdbfe", "#93c5fd", "#3b82f6", "#1e40af"] },
  green: { thresholds: [0, 3, 9, 19], colors: ["#f0f4f8", "#bbf7d0", "#86efac", "#22c55e", "#15803d"] },
};

const LEGEND_LABELS = ["0", "1–3", "4–9", "10–19", "20+"];

function getBucketColor(positive: number, color: "blue" | "green"): string {
  const { thresholds, colors } = BUCKETS[color];
  if (positive <= 0) return colors[0];
  for (let i = 0; i < thresholds.length; i++) {
    if (positive <= thresholds[i]) return colors[i];
  }
  return colors[colors.length - 1];
}

const GEOJSON_URL =
  "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json";

const DEFAULT_STYLE: PathOptions = {
  weight: 1.5, opacity: 1, color: "#ffffff", dashArray: "3", fillOpacity: 0.72,
};
const HOVER_STYLE: PathOptions = {
  weight: 3, color: "#555", dashArray: "", fillOpacity: 0.85,
};

function getFeatureName(feature?: Feature<Geometry, GeoJsonProperties>): string {
  if (!feature?.properties) return "";
  const p = feature.properties;
  return (p["NAME"] as string) ?? (p["name"] as string) ?? (p["State"] as string) ?? "";
}

export default function CompareMap({ byState, color, label }: CompareHeatMapProps) {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(GEOJSON_URL)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() as Promise<FeatureCollection>; })
      .then((d) => { if (live) { setGeoData(d); setLoadState("ready"); } })
      .catch(() => { if (live) setLoadState("error"); });
    return () => { live = false; };
  }, []);

  // build lookup with case-insensitive fallbacks
  const lookup = useMemo(() => {
    const m = new Map<string, { replies: number; positive: number }>();
    byState.forEach((v, name) => {
      m.set(name, v);
      m.set(name.toLowerCase().trim(), v);
    });
    return m;
  }, [byState]);

  const lookupState = useCallback(
    (name: string) => lookup.get(name) ?? lookup.get(name.trim()) ?? lookup.get(name.toLowerCase().trim()),
    [lookup]
  );

  const dataKey = useMemo(() => {
    let pos = 0;
    byState.forEach((v) => { pos += v.positive; });
    return `${color}-${byState.size}-${pos}`;
  }, [byState, color]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const styleFeature = useCallback((feature: any): PathOptions => {
    const name = getFeatureName(feature);
    const s = lookupState(name);
    return { ...DEFAULT_STYLE, fillColor: getBucketColor(s?.positive ?? 0, color) };
  }, [lookupState, color]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onEachFeature = useCallback((feature: any, layer: any) => {
    const name = getFeatureName(feature);
    layer.on({
      mouseover(e: { target: { setStyle: (s: PathOptions) => void; bringToFront: () => void } }) {
        const s = lookupState(name);
        setHovered(name);
        e.target.setStyle({ ...HOVER_STYLE, fillColor: getBucketColor(s?.positive ?? 0, color) });
        e.target.bringToFront();
      },
      mouseout(e: { target: { setStyle: (s: PathOptions) => void } }) {
        const s = lookupState(name);
        setHovered(null);
        e.target.setStyle({ ...DEFAULT_STYLE, fillColor: getBucketColor(s?.positive ?? 0, color) });
      },
    });
    const s = lookupState(name);
    if (s && s.positive > 0) {
      layer.bindTooltip(
        `<div style="font-size:12px;font-weight:600;margin-bottom:2px">${name}</div>` +
        `<div style="font-weight:600">${s.positive} positive</div>` +
        `<div style="color:#6b7280;font-size:11px">${s.replies} total replies</div>`,
        { sticky: true }
      );
    }
  }, [lookupState, color]);

  const hoveredData = hovered ? lookupState(hovered) : null;
  const cfg = BUCKETS[color];

  return (
    <div className="relative" style={{ height: 310 }}>
      {loadState === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
          <span className="text-sm text-gray-400">Loading map…</span>
        </div>
      )}
      {loadState === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
          <span className="text-sm text-red-400">Map unavailable</span>
        </div>
      )}
      {loadState === "ready" && geoData && (
        <MapContainer
          center={[37.8, -96]} zoom={3}
          zoomControl={false} scrollWheelZoom={false} dragging={false}
          doubleClickZoom={false} boxZoom={false} keyboard={false} touchZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap &copy; CARTO'
          />
          <GeoJSON
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            key={dataKey}
            data={geoData}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        </MapContainer>
      )}
      {/* Hover tooltip */}
      {loadState === "ready" && (
        <div className="absolute top-2 right-2 z-[1000] bg-white/95 border border-gray-200 rounded-lg shadow p-2.5 text-xs pointer-events-none min-w-[130px]">
          {!hovered ? (
            <div className="text-gray-400 text-center py-1">Hover a state</div>
          ) : !hoveredData ? (
            <><div className="font-semibold text-gray-800 mb-1">{hovered}</div><div className="text-gray-400">No data</div></>
          ) : (
            <>
              <div className="font-semibold text-gray-800 mb-1">{hovered}</div>
              <div className="text-gray-500">Replies: <span className="font-semibold text-gray-800">{hoveredData.replies}</span></div>
              <div className="text-gray-500">Positive: <span className="font-semibold text-gray-800">{hoveredData.positive}</span></div>
              {hoveredData.replies > 0 && <div className="text-gray-400 text-[11px]">{(hoveredData.positive / hoveredData.replies * 100).toFixed(1)}% rate</div>}
            </>
          )}
        </div>
      )}
      {/* Legend */}
      {loadState === "ready" && (
        <div className="absolute bottom-2 left-2 z-[1000] bg-white/90 border border-gray-100 rounded-lg p-2 pointer-events-none shadow-sm">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Positive Replies</div>
          {cfg.colors.map((c, i) => (
            <div key={i} className="flex items-center gap-1.5 mb-0.5 last:mb-0">
              <span className="inline-block w-3.5 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: c, border: "1px solid #e5e7eb" }} />
              <span className="text-[10px] text-gray-600">{LEGEND_LABELS[i]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
