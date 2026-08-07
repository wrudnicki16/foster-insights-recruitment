import countiesJson from "../../data/derived/counties.json";
import statewideJson from "../../data/derived/statewide.json";
import metaJson from "../../data/derived/meta.json";
import { CountyData, Meta, StatewideData } from "./types";

// JSON literal inference produces a union of narrow per-county shapes (e.g. sparse
// newLicensesByMonth/removalsByMonth keys) that TS won't cast directly to CountyData[]
// ("insufficient overlap"); route through `unknown` to assert the documented shape.
const counties = countiesJson as unknown as CountyData[];
const statewide = statewideJson as unknown as StatewideData;
const meta = metaJson as unknown as Meta;

export function getCounties(): CountyData[] {
  return counties;
}

export function getStatewide(): StatewideData {
  return statewide;
}

export function getMeta(): Meta {
  return meta;
}

export function countyBySlug(slug: string): CountyData | undefined {
  return counties.find((c) => c.slug === slug);
}
