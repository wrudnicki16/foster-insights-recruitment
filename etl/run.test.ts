import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { loadChildren, loadPlacements, loadProviders } from "./load";
import { isActive } from "./metrics";
import { buildDerived } from "./run";
import { mapKey } from "./parse";

const providersCsv = readFileSync("data/raw/provider_level.csv", "utf8");
const childrenCsv = readFileSync("data/raw/child_level.csv", "utf8");
const placementsCsv = readFileSync("data/raw/placement_level.csv", "utf8");
const derived = buildDerived(providersCsv, childrenCsv, placementsCsv);

describe("reconciliation against raw data", () => {
  test("raw row counts match known totals", () => {
    expect(derived.meta.counts).toEqual({ providers: 6063, children: 16139, placements: 51994 });
  });

  test("exactly 102 counties, unique names and slugs, sorted by name", () => {
    expect(derived.counties).toHaveLength(102);
    const names = derived.counties.map((c) => c.name);
    expect(new Set(names).size).toBe(102);
    expect(new Set(derived.counties.map((c) => c.slug)).size).toBe(102);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(names).toContain("Vermilion");
    expect(names).not.toContain("Vermillion");
  });

  test("children in care sums to independent count (8071)", () => {
    const inCare = loadChildren(childrenCsv).filter((c) => c.dischargeDate === null);
    expect(inCare).toHaveLength(8071);
    const total = derived.counties.reduce(
      (sum, c) => sum + c.childrenNA + c.childrenByAge.reduce((a, b) => a + b, 0), 0);
    expect(total).toBe(8071);
    const statewideTotal = derived.statewide.childrenNA + derived.statewide.childrenByAge.reduce((a, b) => a + b, 0);
    expect(statewideTotal).toBe(8071);
  });

  test("active homes sum to independent count", () => {
    const snapshot = new Date("2026-07-01T00:00:00Z");
    const active = loadProviders(providersCsv).filter((p) => isActive(p, snapshot)).length;
    const total = derived.counties.reduce((sum, c) => sum + c.homesAll, 0);
    expect(total).toBe(active);
    expect(derived.statewide.homesAll).toBe(active);
  });

  test("out-of-county totals cover every foster_home placement (32859)", () => {
    const fosterCount = loadPlacements(placementsCsv).filter((p) => p.resourceType === "foster_home").length;
    expect(fosterCount).toBe(32859);
    const total = derived.counties.reduce((sum, c) => sum + c.oocTotalAll, 0);
    expect(total).toBe(32859);
  });

  test("every county joins to a map feature and vice versa", () => {
    const geo = JSON.parse(readFileSync("src/lib/il-counties.json", "utf8"));
    const featureKeys = new Set<string>(geo.features.map((f: { properties: { name: string } }) => mapKey(f.properties.name)));
    expect(featureKeys.size).toBe(102);
    const countyKeys = new Set(derived.counties.map((c) => mapKey(c.name)));
    expect(countyKeys.size).toBe(102);
    expect([...countyKeys].filter((k) => !featureKeys.has(k))).toEqual([]);
    expect([...featureKeys].filter((k) => !countyKeys.has(k))).toEqual([]);
  });

  test("destinations are top-5, sorted desc, out-of-county only", () => {
    for (const c of derived.counties) {
      expect(c.destinations.length).toBeLessThanOrEqual(5);
      for (let i = 1; i < c.destinations.length; i++) {
        expect(c.destinations[i - 1].count).toBeGreaterThanOrEqual(c.destinations[i].count);
      }
      expect(c.destinations.map((dd) => dd.county)).not.toContain(c.name);
    }
  });
});
