import AgeFilter from "@/components/AgeFilter";
import CountyTable, { TableRow } from "@/components/CountyTable";
import SummaryStrip from "@/components/SummaryStrip";
import { getCounties, getStatewide } from "@/lib/data";
import { ageParamValue, parseAgeParam, selectionLabel } from "@/lib/selection";
import { childrenFor, homesFor, oocRateFor, pressureFor, pressureSortValue } from "@/lib/stats";
import { reasonFor } from "@/lib/verdict";

export default async function Home({ searchParams }: { searchParams: Promise<{ age?: string }> }) {
  const { age } = await searchParams;
  const sel = parseAgeParam(age);
  const counties = getCounties();
  const statewide = getStatewide();

  const rows: TableRow[] = counties.map((c) => {
    const pressure = pressureFor(c, sel);
    const ooc = oocRateFor(c, sel);
    return {
      slug: c.slug,
      name: c.name,
      children: childrenFor(c, sel),
      homes: homesFor(c, sel),
      pressureDisplay:
        pressure.kind === "ratio" ? pressure.value.toFixed(1)
        : pressure.kind === "no-homes" ? "No compatible homes"
        : "—",
      pressureSort: pressureSortValue(pressure),
      ooc: ooc === null ? "—" : `${(ooc * 100).toFixed(0)}%`,
      oocSort: ooc ?? -1,
      reason: reasonFor(c, counties, sel),
      ageParam: ageParamValue(sel),
    };
  });

  const swOoc = statewide.oocTotalAll === 0 ? "—" : `${((statewide.oocOutAll / statewide.oocTotalAll) * 100).toFixed(0)}%`;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Where should we recruit, and for whom?</h1>
        <AgeFilter />
        <SummaryStrip
          childCount={childrenFor(statewide, sel)}
          homes={homesFor(statewide, sel)}
          oocPct={swOoc}
          label={selectionLabel(sel).toLowerCase()}
        />
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">County recruitment priorities</h2>
        <p className="text-sm text-slate-500">
          Ranked by children in care per age-compatible active home. Click a county for details
          and a recruitment brief.
        </p>
        <CountyTable rows={rows} />
      </section>
    </div>
  );
}
