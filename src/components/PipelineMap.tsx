"use client";

import React, { useRef, useEffect } from "react";
import type { PipelineRow } from "@/lib/sheets";
import { getStatusColor, formatCurrency } from "@/lib/sheets";

interface Props {
  rows: PipelineRow[];
  statusCounts: Record<string, number>;
}

const US_STATES_GEOJSON =
  "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json";

function buildPopupHTML(row: PipelineRow, color: string) {
  return `
    <div style="background:#ffffff;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,0.16);border:1px solid #e2e8f0;padding:12px 16px;font-family:system-ui,sans-serif;font-size:13px;line-height:1.5;min-width:220px;max-width:300px;color:#1e293b;">
      <div style="font-weight:700;margin-bottom:2px;color:#0f172a">${row.opportunity}</div>
      <div style="color:#64748b;margin-bottom:8px;font-size:12px">${row.city}, ${row.state}</div>
      <div style="display:flex;gap:16px;margin-bottom:6px;font-size:12px">
        <span><strong>Owner:</strong> ${row.ownerName || "—"}</span>
        <span><strong>Value:</strong> ${formatCurrency(row.annualizedValue)}</span>
      </div>
      <div style="margin-bottom:${row.daysInStatus != null || row.lastCommSummary ? "6px" : "0"}">
        <span style="display:inline-block;padding:2px 10px;border-radius:9999px;font-size:11px;background:${color}22;color:${color};border:1px solid ${color}66;font-weight:600">${row.currentStatus}</span>
      </div>
      ${row.daysInStatus != null ? `<div style="color:#94a3b8;font-size:11px;margin-bottom:4px">${row.daysInStatus} days in status</div>` : ""}
      ${row.lastCommSummary ? `<div style="color:#475569;font-size:11px">${row.lastCommSummary.slice(0, 140)}${row.lastCommSummary.length > 140 ? "…" : ""}</div>` : ""}
    </div>
  `;
}

async function addStateBoundaries(map: any) {
  try {
    const res = await fetch(US_STATES_GEOJSON);
    const geojson = await res.json();

    map.addSource("us-states", { type: "geojson", data: geojson });

    // Subtle fill so states feel defined
    map.addLayer({
      id: "us-states-fill",
      type: "fill",
      source: "us-states",
      paint: {
        "fill-color": "#f0f4f8",
        "fill-opacity": 0.15,
      },
    });

    // Visible state boundary lines
    map.addLayer({
      id: "us-states-line",
      type: "line",
      source: "us-states",
      paint: {
        "line-color": "#94a3b8",
        "line-width": 1,
        "line-opacity": 0.8,
      },
    });
  } catch {
    // silently skip if fetch fails
  }
}

function attachMarkers(
  map: any,
  maplibre: any,
  geoRows: PipelineRow[],
  markersRef: React.MutableRefObject<any[]>
) {
  markersRef.current.forEach((m) => m.remove());
  markersRef.current = [];

  geoRows.forEach((row) => {
    const color = getStatusColor(row.currentStatus);

    // Wrapper is the hit area (32px) — never changes size, so no enter/leave flicker.
    // The inner dot scales visually inside it.
    const wrapper = document.createElement("div");
    wrapper.style.cssText = `
      width:32px;height:32px;display:flex;align-items:center;
      justify-content:center;cursor:pointer;
    `;

    const dot = document.createElement("div");
    dot.style.cssText = `
      width:14px;height:14px;border-radius:50%;
      background:${color};border:2.5px solid white;
      box-shadow:0 1px 5px rgba(0,0,0,0.35);
      transition:transform 0.15s ease;
      pointer-events:none;
    `;
    wrapper.appendChild(dot);

    wrapper.addEventListener("mouseenter", () => { dot.style.transform = "scale(1.5)"; });
    wrapper.addEventListener("mouseleave", () => { dot.style.transform = "scale(1)"; });

    const popup = new maplibre.Popup({
      offset: 6,
      closeButton: true,
      closeOnClick: true,
      maxWidth: "300px",
      className: "stoc-popup",
    }).setHTML(buildPopupHTML(row, color));

    const marker = new maplibre.Marker({ element: wrapper })
      .setLngLat([row.lng!, row.lat!])
      .setPopup(popup)
      .addTo(map);

    // Open on click; closeButton and closeOnClick handle dismissal
    wrapper.addEventListener("click", (e) => {
      e.stopPropagation();
      marker.togglePopup();
    });

    markersRef.current.push(marker);
  });
}

export function PipelineMap({ rows, statusCounts }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const geoRows = rows.filter((r) => r.lat != null && r.lng != null);

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    async function initMap() {
      const maplibre = await import("maplibre-gl");
      await import("maplibre-gl/dist/maplibre-gl.css");
      if (cancelled || !mapRef.current) return;

      const map = new maplibre.Map({
        container: mapRef.current,
        style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
        center: [-96, 39],
        zoom: 3.5,
      });

      mapInstanceRef.current = map;
      map.addControl(new maplibre.NavigationControl(), "top-right");

      map.on("load", async () => {
        await addStateBoundaries(map);
        attachMarkers(map, maplibre, geoRows, markersRef);
      });
    }

    initMap();
    return () => {
      cancelled = true;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.loaded()) return;
    import("maplibre-gl").then((maplibre) => {
      attachMarkers(map, maplibre, geoRows, markersRef);
    });
  }, [rows]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full rounded-xl overflow-hidden" />

      {geoRows.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
          No geocoded locations for this date range
        </div>
      )}
    </div>
  );
}
