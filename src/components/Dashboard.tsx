"use client";

import React, { useState, useEffect, useCallback } from "react";
import { subDays, format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/DateRangePicker";
import { PipelineMap } from "@/components/PipelineMap";
import { PipelineTable } from "@/components/PipelineTable";
import type { PipelineRow } from "@/lib/sheets";
import { formatCurrency, getStatusColor } from "@/lib/sheets";
import Image from "next/image";
import { Loader2, TrendingUp, MapPin, CheckCircle2, X } from "lucide-react";

const PRESETS = [
  { label: "7D",  days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "All", days: 9999 },
];

export function Dashboard() {
  const today = new Date();
  const [activePreset, setActivePreset] = useState<number>(7);
  const [range, setRange] = useState<DateRange>({
    from: subDays(today, 7),
    to: today,
  });
  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async (r: DateRange) => {
    if (!r.from || !r.to) return;
    setLoading(true);
    setError(null);
    try {
      const from = format(r.from, "yyyy-MM-dd");
      const to = format(r.to, "yyyy-MM-dd");
      const res = await fetch(`/api/pipeline?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to load data");
      const json = await res.json();
      setRows(json.rows ?? []);
      setSelectedStatuses(new Set()); // reset filter on new fetch
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(range); }, []);

  function handlePreset(days: number) {
    setActivePreset(days);
    const to = new Date();
    const from = days >= 9999 ? new Date("2020-01-01") : subDays(to, days);
    const r = { from, to };
    setRange(r);
    fetchData(r);
  }

  function handleRangeChange(r: DateRange) {
    if (!r?.from) return;
    setActivePreset(-1);
    setRange(r);
    if (r.from && r.to) fetchData(r);
  }

  function toggleStatus(status: string) {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  // All unique statuses in the current data, sorted by count desc
  const statusCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.currentStatus] = (acc[r.currentStatus] ?? 0) + 1;
    return acc;
  }, {});
  const allStatuses = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);

  // Rows filtered by selected statuses (empty = show all)
  const filteredRows =
    selectedStatuses.size === 0
      ? rows
      : rows.filter((r) => selectedStatuses.has(r.currentStatus));

  const totalValue = filteredRows.reduce((s, r) => s + r.annualizedValue, 0);
  const topStatuses = Object.entries(
    filteredRows.reduce<Record<string, number>>((acc, r) => {
      acc[r.currentStatus] = (acc[r.currentStatus] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-[1800px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="https://www.stocadvisory.com/_next/image?url=%2Fstoc-main-logo-cropped.png&w=256&q=75"
              alt="STOC Advisory"
              width={120}
              height={36}
              className="object-contain"
              unoptimized
            />
            <div className="h-6 w-px bg-gray-200" />
            <span className="text-sm font-semibold text-gray-700 tracking-wide">
              Embark Pipeline Dashboard
            </span>
          </div>
          <div className="flex items-center gap-3">
            {loading && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            )}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => handlePreset(p.days)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    activePreset === p.days
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <DateRangePicker value={range} onChange={handleRangeChange} />
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-6 py-6 space-y-5">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Total Pipeline Value
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalValue)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{filteredRows.length} opportunities</div>
            </CardContent>
          </Card>

          {topStatuses.map(([status, count]) => {
            const color = getStatusColor(status);
            return (
              <Card key={status} className="shadow-sm overflow-hidden" style={{ borderTop: `3px solid ${color}` }}>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide flex items-center gap-1.5" style={{ color }}>
                    <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    {status}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-2xl font-bold text-gray-900">{count}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatCurrency(filteredRows.filter((r) => r.currentStatus === status).reduce((s, r) => s + r.annualizedValue, 0))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Status filter chips */}
        {!loading && allStatuses.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-500 mr-1">Filter by status:</span>
            {allStatuses.map(([status, count]) => {
              const color = getStatusColor(status);
              const active = selectedStatuses.has(status);
              return (
                <button
                  key={status}
                  onClick={() => toggleStatus(status)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all"
                  style={
                    active
                      ? { backgroundColor: color, color: "#fff", borderColor: color }
                      : { backgroundColor: color + "15", color, borderColor: color + "55" }
                  }
                >
                  {status}
                  <span
                    className="rounded-full px-1.5 py-0"
                    style={active ? { background: "rgba(255,255,255,0.25)" } : { background: color + "30" }}
                  >
                    {count}
                  </span>
                  {active && <X className="h-3 w-3 opacity-80" />}
                </button>
              );
            })}
            {selectedStatuses.size > 0 && (
              <button
                onClick={() => setSelectedStatuses(new Set())}
                className="text-xs text-gray-400 hover:text-gray-600 underline ml-1"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Map */}
        <Card className="shadow-sm overflow-hidden p-0">
          <CardHeader className="px-4 py-3 border-b border-gray-100">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Opportunities by Location
              {!loading && (
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  — {filteredRows.filter((r) => r.lat != null).length} mapped
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[420px] relative">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading map data…
              </div>
            ) : (
              <PipelineMap rows={filteredRows} statusCounts={statusCounts} />
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="shadow-sm">
          <CardHeader className="px-4 py-3 border-b border-gray-100">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              Opportunity Pipeline
              {!loading && (
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  — {filteredRows.length} records
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
              </div>
            ) : (
              <PipelineTable rows={filteredRows} />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
