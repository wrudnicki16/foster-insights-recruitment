import { describe, expect, test } from "vitest";
import { county } from "./stats.test";
import { reasonFor, reasonKindsFor, verdictFor } from "./verdict";

// Build a statewide field of 10 identical baseline counties, then perturb one.
// Baseline: 20 children / 10 homes = pressure 2.0; activity 40%.
const baseline = Array.from({ length: 10 }, (_, i) => county({ name: `C${i}`, slug: `c${i}` }));
const ALL = { kind: "all" } as const;

describe("verdictFor", () => {
  test("high pressure + low activity -> recruit_investigate", () => {
    const c = county({ childrenByAge: Array(18).fill(3), activeDays: 10 }); // pressure 5.6, activity 10%
    expect(verdictFor(c, [...baseline, c], ALL).kind).toBe("recruit_investigate");
  });
  test("high pressure + normal activity -> recruit", () => {
    const c = county({ childrenByAge: Array(18).fill(3) });
    expect(verdictFor(c, [...baseline, c], ALL).kind).toBe("recruit");
  });
  test("normal pressure + low activity -> investigate_activity", () => {
    const c = county({ activeDays: 10 });
    expect(verdictFor(c, [...baseline, c], ALL).kind).toBe("investigate_activity");
  });
  test("low pressure + high activity -> comparatively_low", () => {
    const c = county({ childrenByAge: Array(18).fill(0), childrenNA: 5, activeDays: 90 }); // pressure 0.5, activity 90%
    expect(verdictFor(c, [...baseline, c], ALL).kind).toBe("comparatively_low");
  });
  test("everything near median -> in_line", () => {
    const c = county({});
    const v = verdictFor(c, [...baseline, c], ALL);
    expect(v.kind).toBe("in_line");
    expect(v.headline).toMatch(/In line with statewide patterns/);
  });
  test("no compatible homes is always high pressure", () => {
    const c = county({ homesByAge: Array(18).fill(0), homesAll: 0, homesByBand: { "0-5": 0, "6-12": 0, "13-17": 0 } });
    expect(verdictFor(c, [...baseline, c], ALL).kind).toBe("recruit");
  });
  test("verdict carries baselines for transparent display", () => {
    const v = verdictFor(county({}), [...baseline], ALL);
    expect(v.pressureMedian).toBe(2);
    expect(v.activityMedian).toBe(0.4);
  });
});

describe("reasonFor", () => {
  test("elevated signals produce specific reasons", () => {
    const c = county({ childrenByAge: Array(18).fill(3), oocOutAll: 79, activeDays: 10 });
    const reason = reasonFor(c, [...baseline, c], ALL);
    expect(reason).toMatch(/children per age-compatible home/);
    expect(reason).toMatch(/outside the county/);
  });
  test("nothing elevated produces the neutral line", () => {
    expect(reasonFor(county({}), [...baseline], ALL)).toMatch(/No standout signal/);
  });
});

describe("reasonKindsFor", () => {
  test("elevated signals produce specific kinds", () => {
    const c = county({ childrenByAge: Array(18).fill(3), oocOutAll: 79, activeDays: 10 });
    const kinds = reasonKindsFor(c, [...baseline, c], ALL);
    expect(kinds).toContain("high_pressure");
    expect(kinds).toContain("high_ooc");
    expect(kinds).toContain("low_activity");
  });
  test("nothing elevated produces an empty list", () => {
    expect(reasonKindsFor(county({}), [...baseline], ALL)).toEqual([]);
  });
});
