import { ChildRow } from "./load";

export interface ChildrenByCounty {
  byAge: number[];
  na: number;
}

export function childrenInCare(children: ChildRow[]): Map<string, ChildrenByCounty> {
  const out = new Map<string, ChildrenByCounty>();
  for (const c of children) {
    if (c.dischargeDate !== null) continue;
    const entry = out.get(c.county) ?? { byAge: Array(18).fill(0), na: 0 };
    if (c.mostRecentAge === null || c.mostRecentAge < 0 || c.mostRecentAge > 17) {
      entry.na += 1;
    } else {
      entry.byAge[c.mostRecentAge] += 1;
    }
    out.set(c.county, entry);
  }
  return out;
}
