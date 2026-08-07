import { agesFor } from "./selection";
import { AgeSelection, CountyData, StatewideData } from "./types";

export function median(xs: number[]): number {
  return quantile(xs, 0.5);
}

export function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  if (s.length === 0) return NaN;
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

type CountyLike = CountyData | StatewideData;

export function childrenFor(c: CountyLike, sel: AgeSelection): number {
  const base = agesFor(sel).reduce((sum, a) => sum + c.childrenByAge[a], 0);
  return sel.kind === "all" ? base + c.childrenNA : base;
}

export function homesFor(c: CountyLike, sel: AgeSelection): number {
  if (sel.kind === "all") return c.homesAll;
  if (sel.kind === "band") return c.homesByBand[sel.band];
  return c.homesByAge[sel.age];
}

export type Pressure =
  | { kind: "ratio"; value: number }
  | { kind: "no-homes"; children: number }
  | { kind: "no-children" };

export function pressureFor(c: CountyLike, sel: AgeSelection): Pressure {
  const children = childrenFor(c, sel);
  const homes = homesFor(c, sel);
  if (children === 0) return { kind: "no-children" };
  if (homes === 0) return { kind: "no-homes", children };
  return { kind: "ratio", value: children / homes };
}

export function pressureSortValue(p: Pressure): number {
  if (p.kind === "no-children") return 0;
  if (p.kind === "no-homes") return Infinity;
  return p.value;
}

export function oocRateFor(c: CountyData, sel: AgeSelection): number | null {
  if (sel.kind === "all") {
    return c.oocTotalAll === 0 ? null : c.oocOutAll / c.oocTotalAll;
  }
  const ages = agesFor(sel);
  const total = ages.reduce((sum, a) => sum + c.oocTotalByAge[a], 0);
  if (total === 0) return null;
  const out = ages.reduce((sum, a) => sum + c.oocOutByAge[a], 0);
  return out / total;
}

export function activityRateFor(c: { activeDays: number; licensedDays: number }): number | null {
  return c.licensedDays === 0 ? null : c.activeDays / c.licensedDays;
}
