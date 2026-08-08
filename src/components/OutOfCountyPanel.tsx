interface Props {
  ratePct: string;
  label: string;
  destinations: { county: string; count: number }[];
}

export default function OutOfCountyPanel({ ratePct, label, destinations }: Props) {
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
                <span>{d.county}</span>
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
