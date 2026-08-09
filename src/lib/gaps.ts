import { BAND_VALUES } from "./selection";
import { childrenFor, homesFor, median, Pressure, pressureFor, pressureSortValue } from "./stats";
import { AgeSelection, Band, CountyData } from "./types";

export interface Gap {
  slug: string;
  name: string;
  band: Band;
  children: number;
  homes: number;
  pressure: Pressure;
  bandMedian: number;
  multiple: number | null; // pressure as a multiple of the band's statewide median; null when no compatible homes
}

// Raw pressure ratios are not comparable across bands (the statewide 13–17
// baseline is ~3× the 0–5 baseline), so each county×band is ranked by its
// multiple of that band's statewide median. No-compatible-homes cases have no
// finite multiple and rank above everything, by children in care.
export function topGaps(counties: CountyData[], n = 5): Gap[] {
  const candidates: Gap[] = [];
  for (const band of BAND_VALUES) {
    const sel: AgeSelection = { kind: "band", band };
    const bandMedian = median(
      counties.map((c) => pressureSortValue(pressureFor(c, sel))).filter(Number.isFinite),
    );
    for (const c of counties) {
      const pressure = pressureFor(c, sel);
      if (pressure.kind === "no-children") continue;
      candidates.push({
        slug: c.slug,
        name: c.name,
        band,
        children: childrenFor(c, sel),
        homes: homesFor(c, sel),
        pressure,
        bandMedian,
        multiple:
          pressure.kind === "no-homes" ? null
          : bandMedian > 0 ? pressure.value / bandMedian
          : pressure.value,
      });
    }
  }
  candidates.sort(byUrgency);

  const seen = new Set<string>();
  const out: Gap[] = [];
  for (const g of candidates) {
    if (seen.has(g.slug)) continue;
    seen.add(g.slug);
    out.push(g);
    if (out.length === n) break;
  }
  return out;
}

function byUrgency(a: Gap, b: Gap): number {
  if (a.multiple === null || b.multiple === null) {
    if (a.multiple !== null) return 1;
    if (b.multiple !== null) return -1;
    return b.children - a.children;
  }
  return b.multiple - a.multiple || b.children - a.children || a.name.localeCompare(b.name);
}
