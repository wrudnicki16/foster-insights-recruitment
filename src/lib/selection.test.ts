import { describe, expect, test } from "vitest";
import { ageParamValue, agesFor, parseAgeParam, selectionLabel } from "./selection";

describe("parseAgeParam", () => {
  test("bands, ages, and fallbacks", () => {
    expect(parseAgeParam("6-12")).toEqual({ kind: "band", band: "6-12" });
    expect(parseAgeParam("16")).toEqual({ kind: "age", age: 16 });
    expect(parseAgeParam("0")).toEqual({ kind: "age", age: 0 });
    expect(parseAgeParam(undefined)).toEqual({ kind: "all" });
    expect(parseAgeParam("18")).toEqual({ kind: "all" });
    expect(parseAgeParam("banana")).toEqual({ kind: "all" });
  });
});

test("ageParamValue round-trips", () => {
  expect(ageParamValue({ kind: "all" })).toBe("all");
  expect(ageParamValue({ kind: "band", band: "0-5" })).toBe("0-5");
  expect(ageParamValue({ kind: "age", age: 7 })).toBe("7");
});

test("selectionLabel", () => {
  expect(selectionLabel({ kind: "all" })).toBe("All ages");
  expect(selectionLabel({ kind: "band", band: "13-17" })).toBe("Ages 13–17");
  expect(selectionLabel({ kind: "age", age: 3 })).toBe("Age 3");
});

test("agesFor", () => {
  expect(agesFor({ kind: "all" })).toHaveLength(18);
  expect(agesFor({ kind: "band", band: "0-5" })).toEqual([0, 1, 2, 3, 4, 5]);
  expect(agesFor({ kind: "age", age: 9 })).toEqual([9]);
});
