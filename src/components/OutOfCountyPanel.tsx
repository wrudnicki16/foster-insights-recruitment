import Link from "next/link";

const slug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

interface Props {
  ratePct: string;
  label: string;
  destinations: { county: string; count: number }[];
  ageParam: string;
}

export default function OutOfCountyPanel({ ratePct, label, destinations, ageParam }: Props) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-medium uppercase tracking-wide text-slate-500">
        Local placement pressure
      </h3>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{ratePct}</p>
      <p className="text-sm text-slate-600">
        of foster-home placements for children from this county ({label}) were outside the county.
      </p>
      {destinations.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-medium text-slate-500">
            Most common destination counties (all ages)
          </h4>
          <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
            {destinations.map((d) => (
              <li key={d.county} className="flex justify-between">
                <Link
                  href={`/county/${slug(d.county)}${ageParam === "all" ? "" : `?age=${ageParam}`}`}
                  className="text-blue-700 underline-offset-2 hover:underline"
                >
                  {d.county}
                </Link>
                <span className="tabular-nums text-slate-500">{d.count.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Out-of-county placement is a pressure signal, not a judgment — some placements outside the
        county are appropriate for an individual child.
      </p>
    </div>
  );
}
