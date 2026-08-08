import AgeFilter from "@/components/AgeFilter";
import ChoroplethMap, { MapItem } from "@/components/ChoroplethMap";
import CountyTable, { TableRow } from "@/components/CountyTable";
import { HighlightProvider } from "@/components/HighlightContext";
import SummaryStrip from "@/components/SummaryStrip";
import { getCounties, getStatewide } from "@/lib/data";
import { agesFor, ageParamValue, parseAgeParam, selectionLabel } from "@/lib/selection";
import { childrenFor, homesFor, oocRateFor, pressureFor, pressureSortValue } from "@/lib/stats";
import { reasonFor, reasonKindsFor } from "@/lib/verdict";

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
      reasons: reasonKindsFor(c, counties, sel),
      ageParam: ageParamValue(sel),
    };
  });

  const ages = agesFor(sel);
  const { out: swOut, total: swTotal } =
    sel.kind === "all"
      ? { out: statewide.oocOutAll, total: statewide.oocTotalAll }
      : counties.reduce(
          (acc, c) => {
            for (const a of ages) {
              acc.out += c.oocOutByAge[a];
              acc.total += c.oocTotalByAge[a];
            }
            return acc;
          },
          { out: 0, total: 0 },
        );
  const swOoc = swTotal === 0 ? "—" : `${((swOut / swTotal) * 100).toFixed(0)}%`;

  const mapItems: MapItem[] = counties.map((c) => {
    const p = pressureFor(c, sel);
    return {
      slug: c.slug,
      name: c.name,
      value: p.kind === "no-children" ? null : pressureSortValue(p),
      display:
        p.kind === "ratio" ? `${p.value.toFixed(1)} children in care per age-compatible home`
        : p.kind === "no-homes" ? `${p.children} children in care, no age-compatible homes`
        : "no children in care for this selection",
    };
  });

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
      <HighlightProvider>
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr]">
          <div className="self-start lg:sticky lg:top-6 lg:z-30">
            <ChoroplethMap
              items={mapItems}
              ageParam={ageParamValue(sel)}
              legendTitle={`Children per age-compatible home (${selectionLabel(sel).toLowerCase()})`}
            />
          </div>
          <CountyTable rows={rows} />
        </section>
      </HighlightProvider>
    </div>
  );
}
