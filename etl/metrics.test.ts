import { describe, expect, test } from "vitest";
import { ChildRow, ProviderRow } from "./load";
import { childrenInCare, homesByCounty, isActive } from "./metrics";

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
