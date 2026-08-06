import { ChildRow, ProviderRow } from "./load";

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

export type Band = "0-5" | "6-12" | "13-17";

export const BANDS: Record<Band, [number, number]> = {
  "0-5": [0, 5],
  "6-12": [6, 12],
  "13-17": [13, 17],
};

export function isActive(p: ProviderRow, snapshot: Date): boolean {
  return p.licenseStart.getTime() <= snapshot.getTime() && snapshot.getTime() <= p.licenseEnd.getTime();
}

export interface HomesByCounty {
  byAge: number[];
  all: number;
  byBand: Record<Band, number>;
}

export function homesByCounty(providers: ProviderRow[], snapshot: Date): Map<string, HomesByCounty> {
  const out = new Map<string, HomesByCounty>();
  for (const p of providers) {
    if (!isActive(p, snapshot)) continue;
    const entry = out.get(p.county) ?? {
      byAge: Array(18).fill(0),
      all: 0,
      byBand: { "0-5": 0, "6-12": 0, "13-17": 0 },
    };
    entry.all += 1;
    for (let a = Math.max(0, p.minAge); a <= Math.min(17, p.maxAge); a++) {
      entry.byAge[a] += 1;
    }
    for (const band of Object.keys(BANDS) as Band[]) {
      const [lo, hi] = BANDS[band];
      if (p.minAge <= hi && p.maxAge >= lo) entry.byBand[band] += 1;
    }
    out.set(p.county, entry);
  }
  return out;
}
