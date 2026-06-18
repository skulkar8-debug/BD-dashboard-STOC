"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { MapContainer, GeoJSON, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type ByState = Map<string, { replies: number; positive: number }>;

export type CompareHeatMapProps = {
  byState: ByState;
  color: string; // hex — intensity gradient from white → this color
  label: string;
};

export default function CompareMap({ byState, color, label }: CompareHeatMapProps) {
  const [geoJson, setGeoJson] = useState<unknown>(null);

  useEffect(() => {
    fetch('/us-states.geojson').then((r) => r.json()).then(setGeoJson).catch(() => {});
  }, []);

  const maxPos = useMemo(() => {
    let m = 1;
    byState.forEach((v) => { if (v.positive > m) m = v.positive; });
    return m;
  }, [byState]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const style = useCallback((feature: any) => {
    const name: string = feature?.properties?.name ?? '';
    const s = byState.get(name);
    if (!s || s.positive === 0) return { fillColor: '#f3f4f6', fillOpacity: 0.5, color: '#e5e7eb', weight: 0.8 };
    const intensity = s.positive / maxPos;
    // Interpolate: low intensity = light tint, high = full color
    const opacity = 0.15 + intensity * 0.75;
    return { fillColor: color, fillOpacity: opacity, color: '#ffffff', weight: 1 };
  }, [byState, color, maxPos]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onEachFeature = useCallback((feature: any, layer: any) => {
    const name: string = feature?.properties?.name ?? '';
    const s = byState.get(name);
    if (s && s.positive > 0) {
      layer.bindTooltip(
        `<div style="font-size:12px;font-weight:600;margin-bottom:2px">${name}</div>` +
        `<div style="color:${color};font-weight:600">${s.positive} positive replies</div>` +
        `<div style="color:#6b7280;font-size:11px">${s.replies} total replies</div>`,
        { sticky: true }
      );
    }
  }, [byState, color]);

  return (
    <div style={{ height: 300 }}>
      <MapContainer
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        center={[39, -96]} zoom={3}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap &copy; CartoDB"
        />
        {!!geoJson && (
          <GeoJSON
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            data={geoJson as object}
            style={style}
            onEachFeature={onEachFeature}
            key={label}
          />
        )}
      </MapContainer>
    </div>
  );
}
