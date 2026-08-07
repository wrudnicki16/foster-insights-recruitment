import { describe, expect, test } from "vitest";
import type { CountyData } from "./types";
import {
  activityRateFor, childrenFor, homesFor, median, oocRateFor,
  pressureFor, pressureSortValue, quantile,
} from "./stats";

export function county(over: Partial<CountyData>): CountyData {
  return {
    name: "Adams", slug: "adams",
    childrenByAge: Array(18).fill(1), childrenNA: 2,
    homesByAge: Array(18).fill(3), homesAll: 10,
    homesByBand: { "0-5": 4, "6-12": 5, "13-17": 6 },
    oocOutByAge: Array(18).fill(1), oocTotalByAge: Array(18).fill(4),
    oocOutAll: 20, oocTotalAll: 80,
    destinations: [], activeDays: 40, licensedDays: 100,
    newLicensesByMonth: {}, removalsByMonth: {}, ...over,
  };
}

test("median and quantile", () => {
  expect(median([3, 1, 2])).toBe(2);
  expect(median([4, 1, 3, 2])).toBe(2.5);
  expect(quantile([1, 2, 3, 4, 5], 0.75)).toBe(4);
});

describe("childrenFor / homesFor", () => {
  const c = county({});
  test("all includes NA children and uses homesAll", () => {
    expect(childrenFor(c, { kind: "all" })).toBe(20); // 18 + 2 NA
    expect(homesFor(c, { kind: "all" })).toBe(10);
  });
  test("band sums children but uses byBand homes", () => {
    expect(childrenFor(c, { kind: "band", band: "0-5" })).toBe(6);
    expect(homesFor(c, { kind: "band", band: "0-5" })).toBe(4);
  });
  test("exact age", () => {
    expect(childrenFor(c, { kind: "age", age: 16 })).toBe(1);
    expect(homesFor(c, { kind: "age", age: 16 })).toBe(3);
  });
});

describe("pressureFor", () => {
  test("ratio", () => {
    expect(pressureFor(county({}), { kind: "all" })).toEqual({ kind: "ratio", value: 2 });
  });
  test("no homes", () => {
    const p = pressureFor(county({ homesByAge: Array(18).fill(0) }), { kind: "age", age: 5 });
    expect(p).toEqual({ kind: "no-homes", children: 1 });
    expect(pressureSortValue(p)).toBe(Infinity);
  });
  test("no children", () => {
    const p = pressureFor(county({ childrenByAge: Array(18).fill(0), childrenNA: 0 }), { kind: "all" });
    expect(p).toEqual({ kind: "no-children" });
    expect(pressureSortValue(p)).toBe(0);
  });
});

test("oocRateFor", () => {
  expect(oocRateFor(county({}), { kind: "all" })).toBe(0.25);
  expect(oocRateFor(county({}), { kind: "age", age: 3 })).toBe(0.25);
  expect(oocRateFor(county({ oocTotalByAge: Array(18).fill(0) }), { kind: "age", age: 3 })).toBeNull();
});

test("activityRateFor", () => {
  expect(activityRateFor({ activeDays: 40, licensedDays: 100 })).toBe(0.4);
  expect(activityRateFor({ activeDays: 0, licensedDays: 0 })).toBeNull();
});
