import { describe, expect, test } from "vitest";
import { getCounties } from "./data";
import { topGaps } from "./gaps";
import { county } from "./stats.test";
import { Band, CountyData } from "./types";

function mk(name: string, bands: Record<Band, { children: number; homes: number }>): CountyData {
  const childrenByAge = Array(18).fill(0);
  childrenByAge[0] = bands["0-5"].children;
  childrenByAge[6] = bands["6-12"].children;
  childrenByAge[13] = bands["13-17"].children;
  return county({
    name,
    slug: name.toLowerCase(),
    childrenByAge,
    childrenNA: 0,
    homesByBand: {
      "0-5": bands["0-5"].homes,
      "6-12": bands["6-12"].homes,
      "13-17": bands["13-17"].homes,
    },
  });
}

// Baselines: 0-5 median 0.2, 6-12 median 0.5, 13-17 median 2.0.
const filler = (name: string) =>
  mk(name, {
    "0-5": { children: 2, homes: 10 },
    "6-12": { children: 5, homes: 10 },
    "13-17": { children: 20, homes: 10 },
  });

// Young's 0-5 ratio is 1.0 (5× the 0.2 median); Teen's 13-17 ratio is 4.0
// (2× the 2.0 median). Raw ratios would rank Teen first.
const young = mk("Young", {
  "0-5": { children: 10, homes: 10 },
  "6-12": { children: 5, homes: 10 },
  "13-17": { children: 20, homes: 10 },
});
const teen = mk("Teen", {
  "0-5": { children: 2, homes: 10 },
  "6-12": { children: 5, homes: 10 },
  "13-17": { children: 40, homes: 10 },
});
const base = [young, teen, filler("Za"), filler("Zb"), filler("Zc")];

describe("topGaps", () => {
  test("ranks by multiple of the band's statewide median, not raw ratio", () => {
    const gaps = topGaps(base, 2);
    expect(gaps[0]).toMatchObject({ slug: "young", band: "0-5", multiple: 5 });
    expect(gaps[1]).toMatchObject({ slug: "teen", band: "13-17", multiple: 2 });
  });

  test("each county appears once, with its worst band", () => {
    const gaps = topGaps(base);
    const slugs = gaps.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(gaps.filter((g) => g.slug === "young")).toEqual([
      expect.objectContaining({ band: "0-5" }),
    ]);
  });

  test("no-compatible-homes counties rank first, by children in care", () => {
    const none = mk("None", {
      "0-5": { children: 3, homes: 0 },
      "6-12": { children: 5, homes: 10 },
      "13-17": { children: 20, homes: 10 },
    });
    const noneBig = mk("Nonebig", {
      "0-5": { children: 8, homes: 0 },
      "6-12": { children: 5, homes: 10 },
      "13-17": { children: 20, homes: 10 },
    });
    const gaps = topGaps([...base, none, noneBig], 3);
    expect(gaps[0]).toMatchObject({ slug: "nonebig", children: 8, multiple: null });
    expect(gaps[1]).toMatchObject({ slug: "none", children: 3, multiple: null });
    expect(gaps[2]).toMatchObject({ slug: "young" });
  });

  test("bands with no children in care are not gaps", () => {
    const empty = mk("Empty", {
      "0-5": { children: 0, homes: 0 },
      "6-12": { children: 0, homes: 5 },
      "13-17": { children: 0, homes: 0 },
    });
    const gaps = topGaps([...base, empty], 10);
    expect(gaps.some((g) => g.slug === "empty")).toBe(false);
  });

  test("returns at most n gaps", () => {
    expect(topGaps(base, 2)).toHaveLength(2);
  });
});

test("reconciliation: real-data top five", () => {
  const gaps = topGaps(getCounties());
  expect(gaps.map((g) => ({ name: g.name, band: g.band }))).toEqual([
    { name: "Cook", band: "13-17" },
    { name: "St. Clair", band: "0-5" },
    { name: "Madison", band: "13-17" },
    { name: "LaSalle", band: "13-17" },
    { name: "Champaign", band: "0-5" },
  ]);
  for (const g of gaps) {
    expect(g.children).toBeGreaterThan(0);
    expect(g.bandMedian).toBeGreaterThan(0);
  }
});
