import { describe, expect, test } from "vitest";
import {
  mapKey, monthKey, normalizeCounty, parseCsv, parseDate, requireDate,
  slugify, wholeYearsBetween,
} from "./parse";

describe("parseCsv", () => {
  test("splits header and rows", () => {
    const { header, rows } = parseCsv("a,b\n1,2\n3,4\n");
    expect(header).toEqual(["a", "b"]);
    expect(rows).toEqual([["1", "2"], ["3", "4"]]);
  });
  test("throws on ragged row", () => {
    expect(() => parseCsv("a,b\n1\n")).toThrow(/Row 2/);
  });
});

describe("parseDate", () => {
  test("parses M/D/YY as UTC", () => {
    expect(parseDate("12/9/23")!.toISOString()).toBe("2023-12-09T00:00:00.000Z");
    expect(parseDate("3/29/25")!.toISOString()).toBe("2025-03-29T00:00:00.000Z");
  });
  test("NA is null", () => {
    expect(parseDate("NA")).toBeNull();
  });
  test("requireDate throws on NA", () => {
    expect(() => requireDate("NA", "provider 1 license_start")).toThrow(/license_start/);
  });
});

test("monthKey pads", () => {
  expect(monthKey(new Date(Date.UTC(2022, 0, 15)))).toBe("2022-01");
  expect(monthKey(new Date(Date.UTC(2026, 11, 1)))).toBe("2026-12");
});

describe("wholeYearsBetween", () => {
  const d = (s: string) => new Date(s + "T00:00:00Z");
  test("same day is 0", () => {
    expect(wholeYearsBetween(d("2022-05-01"), d("2022-05-01"))).toBe(0);
  });
  test("day before anniversary is 0, on anniversary is 1", () => {
    expect(wholeYearsBetween(d("2022-05-01"), d("2023-04-30"))).toBe(0);
    expect(wholeYearsBetween(d("2022-05-01"), d("2023-05-01"))).toBe(1);
  });
  test("multi-year", () => {
    expect(wholeYearsBetween(d("2022-05-01"), d("2026-04-30"))).toBe(3);
  });
});

test("normalizeCounty merges Vermillion", () => {
  expect(normalizeCounty("Vermillion")).toBe("Vermilion");
  expect(normalizeCounty(" Cook ")).toBe("Cook");
});

test("mapKey strips punctuation and case", () => {
  expect(mapKey("St. Clair")).toBe("stclair");
  expect(mapKey("Jo Daviess")).toBe("jodaviess");
  expect(mapKey("La Salle")).toBe("lasalle");
  expect(mapKey("LaSalle")).toBe("lasalle");
  expect(mapKey("De Witt")).toBe("dewitt");
});

test("slugify kebab-cases", () => {
  expect(slugify("St. Clair")).toBe("st-clair");
  expect(slugify("Jo Daviess")).toBe("jo-daviess");
  expect(slugify("DeKalb")).toBe("dekalb");
});
