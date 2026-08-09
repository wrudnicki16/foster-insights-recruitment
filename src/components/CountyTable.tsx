"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useHighlight } from "./HighlightContext";
import { ReasonKind } from "@/lib/verdict";

export interface TableRow {
  slug: string;
  name: string;
  children: number;
  homes: number;
  pressureDisplay: string;
  pressureSort: number;
  ooc: string;
  oocSort: number;
  reason: string;
  reasons: ReasonKind[];
  ageParam: string;
}

type SortKey = "name" | "children" | "homes" | "pressureSort" | "oocSort";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "name", label: "County", numeric: false },
  { key: "children", label: "Children in care", numeric: true },
  { key: "homes", label: "Homes accepting", numeric: true },
  { key: "pressureSort", label: "Children per home", numeric: true },
  { key: "oocSort", label: "Out-of-county rate", numeric: true },
];

const FILTER_OPTIONS: { key: string; label: string }[] = [
  { key: "no_homes", label: "No age-compatible homes" },
  { key: "high_pressure", label: "High children per home" },
  { key: "high_ooc", label: "High out-of-county share" },
  { key: "low_activity", label: "Homes often inactive" },
  { key: "none", label: "No standout signal" },
];

export default function CountyTable({ rows }: { rows: TableRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("pressureSort");
  const [desc, setDesc] = useState(true);
  const [filters, setFilters] = useState<Set<string>>(new Set());
  const filterRef = useRef<HTMLDetailsElement>(null);
  const { setSlug } = useHighlight();

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const d = filterRef.current;
      if (d?.open && e.target instanceof Node && !d.contains(e.target)) d.open = false;
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const filtered =
    filters.size === 0
      ? rows
      : rows.filter(
          (r) =>
            r.reasons.some((k) => filters.has(k)) || (filters.has("none") && r.reasons.length === 0),
        );

  const sorted = [...filtered].sort((a, b) => {
    const cmp = sortKey === "name" ? a.name.localeCompare(b.name) : (a[sortKey] as number) - (b[sortKey] as number);
    return desc ? -cmp : cmp;
  });

  function onSort(key: SortKey) {
    if (key === sortKey) setDesc(!desc);
    else {
      setSortKey(key);
      setDesc(key !== "name");
    }
  }

  function toggleFilter(key: string) {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function downloadCsv() {
    const header = ["County", "Children in care", "Homes accepting", "Children per home", "Out-of-county rate", "Why"];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const body = sorted.map((r) =>
      [r.name, String(r.children), String(r.homes), r.pressureDisplay, r.ooc, r.reason],
    );
    const csv = "﻿" + [header, ...body].map((row) => row.map(esc).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const age = rows[0]?.ageParam ?? "all";
    const agePart = age === "all" ? "all-ages" : `ages-${age}`;
    a.href = url;
    a.download = `county-recruitment-priorities_${agePart}${filters.size > 0 ? "_filtered" : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-2">
      <div className="flex h-10 items-center gap-2 lg:sticky lg:top-0 lg:z-20 lg:bg-slate-50">
        <h2 className="text-lg font-semibold">County recruitment priorities</h2>
        <details className="relative" ref={filterRef}>
          <summary
            aria-label="Filter counties by reason"
            className="flex list-none items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4">
              <path d="M1 2h14L10 8v5l-4 2V8L1 2z" fill="currentColor" />
            </svg>
            {filters.size > 0 ? <span className="text-slate-500">·{filters.size}</span> : null}
          </summary>
          <div className="absolute left-0 z-20 mt-2 w-64 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why</span>
              <button
                type="button"
                onClick={() => setFilters(new Set())}
                className="text-xs font-medium text-blue-700 hover:underline"
              >
                Clear
              </button>
            </div>
            <div className="space-y-1.5">
              {FILTER_OPTIONS.map((opt) => (
                <label key={opt.key} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={filters.has(opt.key)}
                    onChange={() => toggleFilter(opt.key)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </details>
        <button
          onClick={downloadCsv}
          title="Download CSV"
          aria-label="Download current view as CSV"
          className="no-print flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
            <path d="M8 1v8m0 0L5 6m3 3l3-3M2 12v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <p className="text-sm text-slate-500">
        Ranked by children in care per age-compatible active home. Click a county for details and a
        recruitment brief.
      </p>
      {filters.size > 0 ? (
        <p className="text-xs text-slate-500">
          Showing {sorted.length} of {rows.length} counties
        </p>
      ) : null}
      <div className="overflow-x-auto lg:overflow-x-visible rounded-lg border border-slate-200">
        <table className="w-full min-w-[720px] bg-white text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 lg:sticky lg:top-10 lg:z-10 bg-white shadow-[0_1px_0_0_#e2e8f0] ${col.numeric ? "text-center" : ""}`}
                  aria-sort={sortKey === col.key ? (desc ? "descending" : "ascending") : "none"}
                >
                  <button onClick={() => onSort(col.key)} className="font-semibold text-slate-700 hover:text-slate-900">
                    {col.label}
                    {sortKey === col.key ? (desc ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
              <th className="px-3 py-2 lg:sticky lg:top-10 lg:z-10 bg-white shadow-[0_1px_0_0_#e2e8f0] font-semibold text-slate-700">Why</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.slug}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                onMouseEnter={() => setSlug(r.slug)}
                onMouseLeave={() => setSlug(null)}
              >
                <td className="px-3 py-2">
                  <Link
                    href={r.ageParam === "all" ? `/county/${r.slug}` : `/county/${r.slug}?age=${r.ageParam}`}
                    className="font-medium text-blue-700 underline-offset-2 hover:underline"
                  >
                    {r.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-center tabular-nums">{r.children.toLocaleString("en-US")}</td>
                <td className="px-3 py-2 text-center tabular-nums">{r.homes.toLocaleString("en-US")}</td>
                <td className="px-3 py-2 text-center tabular-nums">{r.pressureDisplay}</td>
                <td className="px-3 py-2 text-center tabular-nums">{r.ooc}</td>
                <td className="px-3 py-2 text-slate-600">{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
