import Link from "next/link";
import { Gap } from "@/lib/gaps";
import { selectionLabel } from "@/lib/selection";

function multipleLabel(m: number): string {
  return `${m >= 10 ? Math.round(m) : m.toFixed(1)}× the statewide median for these ages`;
}

export default function TopGaps({ gaps }: { gaps: Gap[] }) {
  return (
    <section aria-labelledby="top-gaps-heading" className="space-y-2">
      <h2 id="top-gaps-heading" className="text-sm font-medium text-slate-600">
        Top recruitment gaps
        <span className="font-normal text-slate-500">
          {" "}— every county and age band scanned, regardless of the filter below
        </span>
      </h2>
      <ol className="flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-5 lg:overflow-visible lg:pb-0">
        {gaps.map((g, i) => (
          <li key={g.slug} className="min-w-52 flex-1 lg:min-w-0">
            <Link
              href={`/county/${g.slug}?age=${g.band}`}
              className="block h-full rounded-lg border border-amber-300 bg-amber-50 p-3 transition-colors hover:border-amber-500 hover:bg-amber-100"
            >
              <div className="text-xs font-medium text-amber-800">
                {i + 1} · {selectionLabel({ kind: "band", band: g.band })}
              </div>
              <div className="text-lg font-semibold">{g.name}</div>
              <div className="text-sm text-slate-700">
                {g.pressure.kind === "ratio"
                  ? `${g.pressure.value.toFixed(1)} children per compatible home`
                  : "No age-compatible active homes"}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {g.multiple !== null && <>{multipleLabel(g.multiple)} · </>}
                {g.children.toLocaleString()} children · {g.homes.toLocaleString()}{" "}
                {g.homes === 1 ? "home" : "homes"}
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
