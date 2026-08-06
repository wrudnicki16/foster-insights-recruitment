import { describe, expect, test } from "vitest";
import { ChildRow, ProviderRow, PlacementRow } from "./load";
import { activityByCounty, childrenInCare, homesByCounty, isActive, licenseTrendByCounty, monthAxis, outOfCounty, removalTrendByCounty } from "./metrics";

const d = (s: string) => new Date(s + "T00:00:00Z");

const SNAPSHOT = d("2026-07-01");

function child(over: Partial<ChildRow>): ChildRow {
  return {
    id: "1", removalDate: d("2024-01-01"), dischargeDate: null,
    ageAtRemoval: 5, mostRecentAge: 6, county: "Adams", ...over,
  };
}

function provider(over: Partial<ProviderRow>): ProviderRow {
  return {
    id: "p1", licenseStart: d("2024-01-01"), licenseEnd: d("2026-12-31"),
    county: "Adams", daysLicensed: 900, daysActive: 400, minAge: 0, maxAge: 17, ...over,
  };
}

describe("childrenInCare", () => {
  test("counts only children without a discharge date, by most recent age", () => {
    const out = childrenInCare([
      child({ id: "1", mostRecentAge: 6 }),
      child({ id: "2", mostRecentAge: 6 }),
      child({ id: "3", mostRecentAge: 17 }),
      child({ id: "4", dischargeDate: d("2025-01-01") }), // discharged - excluded
      child({ id: "5", mostRecentAge: null }),            // NA bucket
      child({ id: "6", county: "Bond", mostRecentAge: 0 }),
    ]);
    const adams = out.get("Adams")!;
    expect(adams.byAge[6]).toBe(2);
    expect(adams.byAge[17]).toBe(1);
    expect(adams.na).toBe(1);
    expect(adams.byAge.reduce((a, b) => a + b, 0)).toBe(3);
    expect(out.get("Bond")!.byAge[0]).toBe(1);
  });
});

describe("isActive", () => {
  test("boundaries are inclusive", () => {
    expect(isActive(provider({ licenseEnd: d("2026-07-01") }), SNAPSHOT)).toBe(true);
    expect(isActive(provider({ licenseStart: d("2026-07-01") }), SNAPSHOT)).toBe(true);
    expect(isActive(provider({ licenseEnd: d("2026-06-30") }), SNAPSHOT)).toBe(false);
    expect(isActive(provider({ licenseStart: d("2026-07-02") }), SNAPSHOT)).toBe(false);
  });
});

describe("homesByCounty", () => {
  test("counts by age, all, and band with >=1-age-overlap rule", () => {
    const out = homesByCounty([
      provider({ id: "a", minAge: 0, maxAge: 5 }),
      provider({ id: "b", minAge: 4, maxAge: 8 }),
      provider({ id: "c", minAge: 16, maxAge: 18 }), // maxAge 18 exists in data; byAge caps at 17
      provider({ id: "expired", licenseEnd: d("2025-01-01") }),
      provider({ id: "elsewhere", county: "Bond", minAge: 0, maxAge: 17 }),
    ], SNAPSHOT);
    const adams = out.get("Adams")!;
    expect(adams.all).toBe(3);
    expect(adams.byAge[4]).toBe(2);  // a and b
    expect(adams.byAge[17]).toBe(1); // c
    expect(adams.byBand["0-5"]).toBe(2);  // a, b
    expect(adams.byBand["6-12"]).toBe(1); // b
    expect(adams.byBand["13-17"]).toBe(1); // c
    expect(out.get("Bond")!.all).toBe(1);
  });
});

function placement(over: Partial<PlacementRow>): PlacementRow {
  return {
    childId: "1", start: d("2024-06-01"), end: null, resourceType: "foster_home",
    index: 1, removalCounty: "Adams", placementCounty: "Adams", providerId: "p", length: 10, ...over,
  };
}

describe("outOfCounty", () => {
  const kids = new Map([
    ["1", child({ id: "1", ageAtRemoval: 5, removalDate: d("2024-01-01") })],
    ["2", child({ id: "2", ageAtRemoval: null })],
  ]);

  test("counts foster_home placements in/out with derived age", () => {
    const out = outOfCounty([
      placement({ childId: "1", placementCounty: "Adams" }),                       // in-county, age 5
      placement({ childId: "1", placementCounty: "Bond", start: d("2025-06-01") }), // out, age 6 (1 anniversary passed)
      placement({ childId: "1", placementCounty: "Cook", resourceType: "kin" }),    // kin - ignored
      placement({ childId: "2", placementCounty: "Bond" }),                         // out, NA age
    ], kids);
    const adams = out.get("Adams")!;
    expect(adams.totalAll).toBe(3);
    expect(adams.outAll).toBe(2);
    expect(adams.totalByAge[5]).toBe(1);
    expect(adams.outByAge[6]).toBe(1);
    expect(adams.totalByAge.reduce((a, b) => a + b, 0)).toBe(2); // NA-age excluded from byAge
    expect(adams.destinations.get("Bond")).toBe(2);
    expect(adams.destinations.has("Adams")).toBe(false);
  });
});

describe("activityByCounty", () => {
  test("sums days across all providers regardless of active status", () => {
    const out = activityByCounty([
      provider({ daysLicensed: 100, daysActive: 40 }),
      provider({ daysLicensed: 200, daysActive: 10, licenseEnd: d("2023-01-01") }),
      provider({ county: "Bond", daysLicensed: 50, daysActive: 50 }),
    ]);
    expect(out.get("Adams")).toEqual({ activeDays: 50, licensedDays: 300 });
    expect(out.get("Bond")).toEqual({ activeDays: 50, licensedDays: 50 });
  });
});

test("licenseTrendByCounty buckets by start month", () => {
  const out = licenseTrendByCounty([
    provider({ licenseStart: d("2024-03-05") }),
    provider({ licenseStart: d("2024-03-20") }),
    provider({ licenseStart: d("2025-01-01") }),
  ]);
  expect(out.get("Adams")).toEqual({ "2024-03": 2, "2025-01": 1 });
});

test("removalTrendByCounty buckets by removal month", () => {
  const out = removalTrendByCounty([
    child({ removalDate: d("2022-05-10") }),
    child({ removalDate: d("2022-05-11"), dischargeDate: d("2023-01-01") }), // discharged still counts as a removal
  ]);
  expect(out.get("Adams")).toEqual({ "2022-05": 2 });
});

test("monthAxis spans inclusive range", () => {
  const axis = monthAxis("2022-01", "2026-06");
  expect(axis).toHaveLength(54);
  expect(axis[0]).toBe("2022-01");
  expect(axis[53]).toBe("2026-06");
  expect(axis[11]).toBe("2022-12");
  expect(axis[12]).toBe("2023-01");
});
