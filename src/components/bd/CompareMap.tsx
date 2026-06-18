"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { MapContainer, GeoJSON, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const SIDE_COLORS = { A: '#3b82f6', B: '#f59e0b' } as const;

type ByState = Map<string, { replies: number; positive: number }>;

export type CompareMapProps = {
  labelA: string;
  labelB: string;
  byStateA: ByState;
  byStateB: ByState;
};

export default function CompareMap({ labelA, labelB, byStateA, byStateB }: CompareMapProps) {
  const [geoJson, setGeoJson] = useState<unknown>(null);

  useEffect(() => {
    fetch('/us-states.geojson').then((r) => r.json()).then(setGeoJson).catch(() => {});
  }, []);

  const stateStats = useMemo(() => {
    const m = new Map<string, { hasA: boolean; hasB: boolean; posA: number; posB: number }>();
    byStateA.forEach((v, state) => {
      const cur = m.get(state) ?? { hasA: false, hasB: false, posA: 0, posB: 0 };
      cur.hasA = v.positive > 0; cur.posA = v.positive;
      m.set(state, cur);
    });
    byStateB.forEach((v, state) => {
      const cur = m.get(state) ?? { hasA: false, hasB: false, posA: 0, posB: 0 };
      cur.hasB = v.positive > 0; cur.posB = v.positive;
      m.set(state, cur);
    });
    return m;
  }, [byStateA, byStateB]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const style = useCallback((feature: any) => {
    const name: string = feature?.properties?.name ?? '';
    const s = stateStats.get(name);
    if (!s) return { fillColor: '#f3f4f6', fillOpacity: 0.5, color: '#d1d5db', weight: 1 };
    const color = s.hasA && s.hasB ? '#7c3aed' : s.hasA ? SIDE_COLORS.A : s.hasB ? SIDE_COLORS.B : '#f3f4f6';
    const hasData = s.hasA || s.hasB;
    return { fillColor: color, fillOpacity: hasData ? 0.65 : 0.2, color: hasData ? '#fff' : '#d1d5db', weight: hasData ? 1.5 : 0.5 };
  }, [stateStats]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onEachFeature = useCallback((feature: any, layer: any) => {
    const name: string = feature?.properties?.name ?? '';
    const s = stateStats.get(name);
    if (s && (s.posA > 0 || s.posB > 0)) {
      layer.bindTooltip(
        `<div style="font-size:12px;font-weight:600;margin-bottom:3px">${name}</div>` +
        (s.posA > 0 ? `<div style="color:${SIDE_COLORS.A}">A (${labelA}): ${s.posA} positive</div>` : '') +
        (s.posB > 0 ? `<div style="color:${SIDE_COLORS.B}">B (${labelB}): ${s.posB} positive</div>` : ''),
        { sticky: true }
      );
    }
  }, [stateStats, labelA, labelB]);

  return (
    <div style={{ height: 420 }}>
      <MapContainer
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        center={[39, -96]} zoom={4}
        style={{ height: '100%', width: '100%', borderRadius: '0 0 12px 12px' }}
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
            key={`${labelA}-${labelB}`}
          />
        )}
      </MapContainer>
    </div>
  );
}
