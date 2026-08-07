"use client";

import Link from "next/link";
import { useState } from "react";

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

export default function CountyTable({ rows }: { rows: TableRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("pressureSort");
  const [desc, setDesc] = useState(true);

  const sorted = [...rows].sort((a, b) => {
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

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[720px] bg-white text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left">
            {COLUMNS.map((col) => (
              <th key={col.key} className="px-3 py-2">
                <button onClick={() => onSort(col.key)} className="font-semibold text-slate-700 hover:text-slate-900">
                  {col.label}
                  {sortKey === col.key ? (desc ? " ↓" : " ↑") : ""}
                </button>
              </th>
            ))}
            <th className="px-3 py-2 font-semibold text-slate-700">Why</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.slug} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
              <td className="px-3 py-2">
                <Link
                  href={r.ageParam === "all" ? `/county/${r.slug}` : `/county/${r.slug}?age=${r.ageParam}`}
                  className="font-medium text-blue-700 underline-offset-2 hover:underline"
                >
                  {r.name}
                </Link>
              </td>
              <td className="px-3 py-2 tabular-nums">{r.children.toLocaleString("en-US")}</td>
              <td className="px-3 py-2 tabular-nums">{r.homes.toLocaleString("en-US")}</td>
              <td className="px-3 py-2 tabular-nums">{r.pressureDisplay}</td>
              <td className="px-3 py-2 tabular-nums">{r.ooc}</td>
              <td className="px-3 py-2 text-slate-600">{r.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
