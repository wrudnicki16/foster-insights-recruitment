import { describe, expect, test } from "vitest";
import { ChildRow } from "./load";
import { childrenInCare } from "./metrics";

const d = (s: string) => new Date(s + "T00:00:00Z");

function child(over: Partial<ChildRow>): ChildRow {
  return {
    id: "1", removalDate: d("2024-01-01"), dischargeDate: null,
    ageAtRemoval: 5, mostRecentAge: 6, county: "Adams", ...over,
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
