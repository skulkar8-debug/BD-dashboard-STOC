"use client";

import React, { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { PipelineRow } from "@/lib/sheets";
import { getStatusColor, formatCurrency } from "@/lib/sheets";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SortKey = keyof PipelineRow;
type SortDir = "asc" | "desc";

interface Props {
  rows: PipelineRow[];
}

function StatusBadge({ status }: { status: string }) {
  const color = getStatusColor(status);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{
        backgroundColor: color + "22",
        color,
        border: `1px solid ${color}55`,
      }}
    >
      {status}
    </span>
  );
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="inline ml-1 h-3 w-3 opacity-30" />;
  return sortDir === "asc"
    ? <ChevronUp className="inline ml-1 h-3 w-3" />
    : <ChevronDown className="inline ml-1 h-3 w-3" />;
}

const COLUMNS: { label: string; key: SortKey; className?: string }[] = [
  { label: "Opportunity", key: "opportunity" },
  { label: "Owner", key: "ownerName" },
  { label: "Ann. Value", key: "annualizedValue", className: "text-right" },
  { label: "City", key: "city" },
  { label: "ST", key: "state" },
  { label: "Status", key: "currentStatus" },
  { label: "Status Date", key: "statusUpdate" },
  { label: "Days", key: "daysInStatus", className: "text-right" },
  { label: "Last Contact", key: "lastContactOn" },
  { label: "Last Comm Summary", key: "lastCommSummary" },
  { label: "NDA Req", key: "ndaRequested" },
  { label: "NDA Rec", key: "ndaReceived" },
  { label: "Submitted", key: "submitted" },
  { label: "LOI", key: "loi" },
  { label: "NDA", key: "nda" },
  { label: "QRE", key: "qre" },
  { label: "FIN", key: "fin" },
  { label: "📞", key: "calls" },
  { label: "📧", key: "emails" },
  { label: "📱", key: "texts" },
  { label: "Notes", key: "notes" },
];

export function PipelineTable({ rows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("statusUpdate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    const cmp =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  if (sorted.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        No opportunities match the selected date range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table className="text-xs min-w-[1800px]">
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            {COLUMNS.map(({ label, key, className }) => (
              <TableHead
                key={key}
                className={cn("cursor-pointer select-none whitespace-nowrap px-3 py-2 font-semibold text-xs", className)}
                onClick={() => handleSort(key)}
              >
                {label}
                <SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row, idx) => {
            const color = getStatusColor(row.currentStatus);
            return (
              <TableRow
                key={idx}
                className="hover:bg-muted/20 align-top"
                style={{ borderLeft: `3px solid ${color}` }}
              >
                <TableCell className="font-medium whitespace-nowrap px-3 py-2 max-w-[200px] truncate">
                  {row.opportunity}
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2">{row.ownerName || "—"}</TableCell>
                <TableCell className="text-right whitespace-nowrap px-3 py-2 font-mono">
                  {formatCurrency(row.annualizedValue)}
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2">{row.city || "—"}</TableCell>
                <TableCell className="px-3 py-2">{row.state || "—"}</TableCell>
                <TableCell className="px-3 py-2">
                  <StatusBadge status={row.currentStatus} />
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                  {row.statusUpdate ?? "—"}
                </TableCell>
                <TableCell className="text-right px-3 py-2">
                  {row.daysInStatus ?? "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                  {row.lastContactOn ?? "—"}
                </TableCell>
                <TableCell className="px-3 py-2 max-w-[220px]">
                  <div className="truncate text-muted-foreground" title={row.lastCommSummary}>
                    {row.lastCommSummary || "—"}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2 text-muted-foreground">{row.ndaRequested ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2 text-muted-foreground">{row.ndaReceived ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2 text-muted-foreground">{row.submitted ?? "—"}</TableCell>
                <TableCell className="px-3 py-2">{row.loi ?? "—"}</TableCell>
                <TableCell className="px-3 py-2">{row.nda ?? "—"}</TableCell>
                <TableCell className="px-3 py-2">{row.qre ?? "—"}</TableCell>
                <TableCell className="px-3 py-2">{row.fin ?? "—"}</TableCell>
                <TableCell className="px-3 py-2 text-center">{row.calls ?? "—"}</TableCell>
                <TableCell className="px-3 py-2 text-center">{row.emails ?? "—"}</TableCell>
                <TableCell className="px-3 py-2 text-center">{row.texts ?? "—"}</TableCell>
                <TableCell className="px-3 py-2 max-w-[200px]">
                  <div className="truncate text-muted-foreground" title={row.notes}>
                    {row.notes || "—"}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
