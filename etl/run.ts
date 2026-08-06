import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { ChildRow } from "./load";
import { loadChildren, loadPlacements, loadProviders } from "./load";
import {
  activityByCounty, childrenInCare, homesByCounty, licenseTrendByCounty,
  monthAxis, outOfCounty, removalTrendByCounty,
} from "./metrics";
import { slugify } from "./parse";
import type { Band, CountyData, Meta, StatewideData } from "../src/lib/types";

const SNAPSHOT = new Date("2026-07-01T00:00:00Z");

function sumInto(target: number[], source: number[]): void {
  for (let i = 0; i < source.length; i++) target[i] += source[i];
}

function mergeTrend(target: Record<string, number>, source: Record<string, number>): void {
  for (const [k, v] of Object.entries(source)) target[k] = (target[k] ?? 0) + v;
}

export function buildDerived(providersCsv: string, childrenCsv: string, placementsCsv: string): {
  counties: CountyData[]; statewide: StatewideData; meta: Meta;
} {
  const providers = loadProviders(providersCsv);
  const children = loadChildren(childrenCsv);
  const placements = loadPlacements(placementsCsv);

  const childById = new Map<string, ChildRow>(children.map((c) => [c.id, c]));
  const kids = childrenInCare(children);
  const homes = homesByCounty(providers, SNAPSHOT);
  const ooc = outOfCounty(placements, childById);
  const activity = activityByCounty(providers);
  const licenses = licenseTrendByCounty(providers);
  const removals = removalTrendByCounty(children);

  const names = new Set<string>([
    ...kids.keys(), ...homes.keys(), ...ooc.keys(), ...activity.keys(),
  ]);

  const counties: CountyData[] = [...names].sort((a, b) => a.localeCompare(b)).map((name) => {
    const k = kids.get(name);
    const h = homes.get(name);
    const o = ooc.get(name);
    const a = activity.get(name);
    return {
      name,
      slug: slugify(name),
      childrenByAge: k?.byAge ?? Array(18).fill(0),
      childrenNA: k?.na ?? 0,
      homesByAge: h?.byAge ?? Array(18).fill(0),
      homesAll: h?.all ?? 0,
      homesByBand: h?.byBand ?? { "0-5": 0, "6-12": 0, "13-17": 0 },
      oocOutByAge: o?.outByAge ?? Array(18).fill(0),
      oocTotalByAge: o?.totalByAge ?? Array(18).fill(0),
      oocOutAll: o?.outAll ?? 0,
      oocTotalAll: o?.totalAll ?? 0,
      destinations: [...(o?.destinations ?? new Map<string, number>())]
        .sort((x, y) => y[1] - x[1])
        .slice(0, 5)
        .map(([county, count]) => ({ county, count })),
      activeDays: a?.activeDays ?? 0,
      licensedDays: a?.licensedDays ?? 0,
      newLicensesByMonth: licenses.get(name) ?? {},
      removalsByMonth: removals.get(name) ?? {},
    };
  });

  const statewide: StatewideData = {
    childrenByAge: Array(18).fill(0), childrenNA: 0,
    homesByAge: Array(18).fill(0), homesAll: 0,
    homesByBand: { "0-5": 0, "6-12": 0, "13-17": 0 },
    oocOutAll: 0, oocTotalAll: 0,
    activeDays: 0, licensedDays: 0,
    newLicensesByMonth: {}, removalsByMonth: {},
  };
  for (const c of counties) {
    sumInto(statewide.childrenByAge, c.childrenByAge);
    statewide.childrenNA += c.childrenNA;
    sumInto(statewide.homesByAge, c.homesByAge);
    statewide.homesAll += c.homesAll;
    for (const band of Object.keys(statewide.homesByBand) as Band[]) {
      statewide.homesByBand[band] += c.homesByBand[band];
    }
    statewide.oocOutAll += c.oocOutAll;
    statewide.oocTotalAll += c.oocTotalAll;
    statewide.activeDays += c.activeDays;
    statewide.licensedDays += c.licensedDays;
    mergeTrend(statewide.newLicensesByMonth, c.newLicensesByMonth);
    mergeTrend(statewide.removalsByMonth, c.removalsByMonth);
  }

  const meta: Meta = {
    snapshotDate: "2026-07-01",
    months: monthAxis("2022-01", "2026-06"),
    counts: { providers: providers.length, children: children.length, placements: placements.length },
  };

  return { counties, statewide, meta };
}

// Runner: `npm run etl`
if (process.argv[1]?.endsWith("run.ts")) {
  const derived = buildDerived(
    readFileSync("data/raw/provider_level.csv", "utf8"),
    readFileSync("data/raw/child_level.csv", "utf8"),
    readFileSync("data/raw/placement_level.csv", "utf8"),
  );
  mkdirSync("data/derived", { recursive: true });
  writeFileSync("data/derived/counties.json", JSON.stringify(derived.counties));
  writeFileSync("data/derived/statewide.json", JSON.stringify(derived.statewide));
  writeFileSync("data/derived/meta.json", JSON.stringify(derived.meta));
  console.log(`Wrote ${derived.counties.length} counties to data/derived/`);
}
