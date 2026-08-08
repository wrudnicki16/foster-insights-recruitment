"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseAgeParam, ageParamValue } from "@/lib/selection";

const OPTIONS = [
  { value: "all", label: "All ages" },
  { value: "0-5", label: "0–5" },
  { value: "6-12", label: "6–12" },
  { value: "13-17", label: "13–17" },
];

export default function AgeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = ageParamValue(parseAgeParam(params.get("age") ?? undefined));
  const isExact = /^\d+$/.test(current);

  function setAge(value: string) {
    router.replace(value === "all" ? pathname : `${pathname}?age=${value}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by age">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => setAge(o.value)}
          aria-pressed={current === o.value}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800 ${
            current === o.value
              ? "bg-slate-800 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          {o.label}
        </button>
      ))}
      <label className="ml-2 flex items-center gap-2 text-sm text-slate-600">
        Exact age
        <select
          value={isExact ? current : ""}
          onChange={(e) => setAge(e.target.value === "" ? "all" : e.target.value)}
          className={`rounded-md border px-2 py-1.5 text-sm ${
            isExact ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white text-slate-700"
          }`}
        >
          <option value="">—</option>
          {Array.from({ length: 18 }, (_, a) => (
            <option key={a} value={String(a)}>{a}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
