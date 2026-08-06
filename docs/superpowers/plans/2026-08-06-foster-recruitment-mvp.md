# Foster Home Recruitment MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a two-page Next.js dashboard that shows Illinois DCFS staff where to recruit foster homes and for which ages, backed by a build-time ETL over three CSVs.

**Architecture:** A TypeScript ETL (`etl/`) parses `data/raw/*.csv` into three committed JSON files in `data/derived/`. Next.js 16 server components read that JSON; all interactivity is client-side filtering over precomputed county×age matrices, with the age selection stored in the URL. The Illinois choropleth is rendered as React SVG using d3-geo path math over a TopoJSON extract.

**Tech Stack:** Next.js 16 (App Router, React 19, TypeScript, Tailwind v4 — via create-next-app defaults), Recharts 3 (charts), d3-geo + topojson-client + us-atlas (map), Vitest 4 (tests), tsx (ETL runner), Vercel (hosting).

**Spec:** `docs/superpowers/specs/2026-08-06-foster-recruitment-mvp-design.md` — read it before starting any task.

## Global Constraints

- Snapshot date is **2026-07-01** (UTC). "Currently" always means as-of this date.
- Data window: Jan 1 2022 – Jul 1 2026. Trend month axis: `"2022-01"` … `"2026-06"`.
- Child ages run 0–17. Age matrices have exactly 18 slots (index = age).
- Age bands: `0-5`, `6-12`, `13-17`. Band-compatible home = accepts ≥ 1 age in the band.
- County merge: `Vermillion` → `Vermilion` at load time. Post-merge there are exactly **102** counties.
- All dates parsed as UTC (`Date.UTC`) — never local time. CSV dates are `M/D/YY`, year 20YY, `"NA"` = null.
- **No runtime database.** No new runtime dependencies beyond: `recharts`, `d3-geo`, `topojson-client`.
- Copy rules (verbatim, everywhere): say "homes accepting this age" / "age-compatible homes"; **never** "available homes", "open beds", or "shortage of exactly N". Out-of-county is a "pressure signal", never "adverse".
- Diagnostic verdicts are comparative, never absolute; always display the statewide baselines being compared against.
- All interactive state lives in the URL (`?age=all|0-5|6-12|13-17|0..17`; absent = all).
- Known reconciliation totals (assert in tests): 6,063 providers · 16,139 children · 51,994 placements · 8,071 children in care at snapshot · 32,859 foster_home placements · 102 counties. (Corrected during Task 8: the raw CSVs have no trailing newline, so earlier `wc -l`-derived counts were each one short.)
- Deadline: site + repo frozen 11:59pm EDT Sunday Aug 9, 2026. Deploy (Task 18) must complete no later than Aug 9 afternoon.
- Test commands: `npm test` (vitest run). ETL: `npm run etl`. Map prep: `npm run prep-map`.

---

### Task 1: Scaffold Next.js project + test tooling + raw data

**Files:**
- Create: entire Next.js scaffold at repo root (via create-next-app in a scratch dir, then rsync)
- Create: `vitest.config.ts`, `tests/smoke.test.ts`
- Create: `data/raw/provider_level.csv`, `data/raw/placement_level.csv`, `data/raw/child_level.csv` (copied from `~/Downloads`)
- Modify: `package.json` (scripts), `.gitignore`

**Interfaces:**
- Produces: working `npm run dev`, `npm test`, `npm run etl` / `npm run prep-map` script slots; raw CSVs at `data/raw/` for every later task.

- [ ] **Step 1: Scaffold in scratch dir and move into repo**

The repo root is non-empty (docs/, .git, counties.txt), so scaffold elsewhere and rsync:

```bash
cd "$(mktemp -d)"
npx create-next-app@latest scaffold --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
rsync -a --exclude .git scaffold/ /Users/wyattrudnicki/Repos/aA/job-search/codingChallenges/foster-insights-recruitment/
cd /Users/wyattrudnicki/Repos/aA/job-search/codingChallenges/foster-insights-recruitment
```

- [ ] **Step 2: Install dependencies**

```bash
npm install recharts d3-geo topojson-client
npm install -D vitest tsx us-atlas @types/d3-geo @types/topojson-client @types/geojson
```

- [ ] **Step 3: Add vitest config, scripts, smoke test**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["etl/**/*.test.ts", "src/lib/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
```

In `package.json` `"scripts"`, add (keep existing next scripts):

```json
"test": "vitest run",
"test:watch": "vitest",
"etl": "tsx etl/run.ts",
"prep-map": "tsx scripts/prep-map.ts"
```

Create `tests/smoke.test.ts`:

```ts
import { expect, test } from "vitest";

test("vitest runs", () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 4: Copy raw data + verify .gitignore does not exclude it**

```bash
mkdir -p data/raw data/derived
cp /Users/wyattrudnicki/Downloads/provider_level.csv /Users/wyattrudnicki/Downloads/placement_level.csv /Users/wyattrudnicki/Downloads/child_level.csv data/raw/
grep -E "^data|^\*\.csv" .gitignore || echo "OK: data not ignored"
echo "counties.txt" >> .gitignore
```

Expected: "OK: data not ignored" (create-next-app's default .gitignore only covers node_modules/.next/etc).

- [ ] **Step 5: Verify test + dev server**

```bash
npm test
```
Expected: 1 passed.

```bash
npm run dev &
sleep 5 && curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 && kill %1
```
Expected: `200`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 + vitest + raw data"
```

---

### Task 2: ETL parsing utilities

**Files:**
- Create: `etl/parse.ts`
- Test: `etl/parse.test.ts`

**Interfaces:**
- Produces (exact signatures — later tasks import these from `"./parse"`):
  - `parseCsv(text: string): { header: string[]; rows: string[][] }` — throws on ragged rows
  - `parseDate(s: string): Date | null` — `"12/9/23"` → UTC 2023-12-09; `"NA"`/`""` → null
  - `requireDate(s: string, ctx: string): Date` — like parseDate but throws on null
  - `monthKey(d: Date): string` — `"2023-12"`
  - `wholeYearsBetween(a: Date, b: Date): number` — completed years from a to b
  - `normalizeCounty(raw: string): string` — trim; `"Vermillion"` → `"Vermilion"`
  - `mapKey(name: string): string` — lowercase letters only (`"St. Clair"` → `"stclair"`)
  - `slugify(name: string): string` — kebab (`"Jo Daviess"` → `"jo-daviess"`)

- [ ] **Step 1: Write the failing tests**

Create `etl/parse.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./parse`.

- [ ] **Step 3: Implement `etl/parse.ts`**

```ts
export interface Csv {
  header: string[];
  rows: string[][];
}

// The raw CSVs contain no quoted fields or embedded commas, so a plain
// split is safe; the width check catches any violation of that assumption.
export function parseCsv(text: string): Csv {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = lines[0].split(",");
  const rows = lines.slice(1).map((line, i) => {
    const cells = line.split(",");
    if (cells.length !== header.length) {
      throw new Error(`Row ${i + 2}: expected ${header.length} cells, got ${cells.length}`);
    }
    return cells;
  });
  return { header, rows };
}

export function parseDate(s: string): Date | null {
  if (s === "NA" || s === "") return null;
  const parts = s.split("/");
  if (parts.length !== 3) throw new Error(`Bad date: ${s}`);
  const [mo, d, y] = parts.map(Number);
  return new Date(Date.UTC(2000 + y, mo - 1, d));
}

export function requireDate(s: string, ctx: string): Date {
  const d = parseDate(s);
  if (d === null) throw new Error(`Missing required date (${ctx})`);
  return d;
}

export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function wholeYearsBetween(a: Date, b: Date): number {
  let years = b.getUTCFullYear() - a.getUTCFullYear();
  const anniversary = new Date(Date.UTC(a.getUTCFullYear() + years, a.getUTCMonth(), a.getUTCDate()));
  if (anniversary.getTime() > b.getTime()) years -= 1;
  return years;
}

export function normalizeCounty(raw: string): string {
  const name = raw.trim();
  return name === "Vermillion" ? "Vermilion" : name;
}

export function mapKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add etl/parse.ts etl/parse.test.ts
git commit -m "feat: ETL parsing utilities"
```

---

### Task 3: Typed row loaders

**Files:**
- Create: `etl/load.ts`
- Test: `etl/load.test.ts`

**Interfaces:**
- Consumes: `parseCsv`, `parseDate`, `requireDate`, `normalizeCounty` from `./parse`
- Produces:
  - `interface ProviderRow { id: string; licenseStart: Date; licenseEnd: Date; county: string; daysLicensed: number; daysActive: number; minAge: number; maxAge: number }`
  - `interface ChildRow { id: string; removalDate: Date; dischargeDate: Date | null; ageAtRemoval: number | null; mostRecentAge: number | null; county: string }`
  - `type ResourceType = "foster_home" | "kin" | "nonfamily"`
  - `interface PlacementRow { childId: string; start: Date; end: Date | null; resourceType: ResourceType; index: number; removalCounty: string; placementCounty: string; providerId: string | null; length: number }`
  - `loadProviders(text: string): ProviderRow[]` / `loadChildren(text: string): ChildRow[]` / `loadPlacements(text: string): PlacementRow[]` — each validates the exact expected header and normalizes county names.

- [ ] **Step 1: Write the failing tests**

Create `etl/load.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { loadChildren, loadPlacements, loadProviders } from "./load";

const PROVIDERS = `id_provider,license_start_date,license_end_date,county_provider,n_days_licensed,n_days_active,min_age,max_age
500001,12/9/23,10/2/26,Adams,1028,449,6,18
500002,3/29/25,6/15/26,Vermillion,443,206,2,16
`;

const CHILDREN = `id_child,removal_date,discharge_date,age_at_removal,most_recent_age,removal_county
10002,11/1/23,9/3/24,7,7,DuPage
10003,1/1/22,NA,NA,NA,Vermillion
`;

const PLACEMENTS = `id_child,placement_start_date,placement_end_date,resource_type_on_this_placement,placement_index,removal_county,placement_county,id_provider,placement_length
10002,11/1/23,8/8/24,kin,1,DuPage,Woodford,NA,281
10002,8/8/24,NA,foster_home,2,Vermillion,McHenry,504896,26
`;

describe("loadProviders", () => {
  test("parses rows and normalizes county", () => {
    const rows = loadProviders(PROVIDERS);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: "500001", county: "Adams", daysLicensed: 1028, daysActive: 449, minAge: 6, maxAge: 18 });
    expect(rows[0].licenseStart.toISOString()).toBe("2023-12-09T00:00:00.000Z");
    expect(rows[1].county).toBe("Vermilion");
  });
  test("rejects wrong header", () => {
    expect(() => loadProviders("a,b\n1,2\n")).toThrow(/header/);
  });
});

describe("loadChildren", () => {
  test("handles NA discharge and NA ages", () => {
    const rows = loadChildren(CHILDREN);
    expect(rows[0]).toMatchObject({ id: "10002", ageAtRemoval: 7, mostRecentAge: 7, county: "DuPage" });
    expect(rows[0].dischargeDate!.toISOString()).toBe("2024-09-03T00:00:00.000Z");
    expect(rows[1]).toMatchObject({ dischargeDate: null, ageAtRemoval: null, mostRecentAge: null, county: "Vermilion" });
  });
});

describe("loadPlacements", () => {
  test("parses rows, NA provider/end, normalizes both county columns", () => {
    const rows = loadPlacements(PLACEMENTS);
    expect(rows[0]).toMatchObject({ childId: "10002", resourceType: "kin", index: 1, removalCounty: "DuPage", placementCounty: "Woodford", providerId: null, length: 281 });
    expect(rows[1]).toMatchObject({ resourceType: "foster_home", end: null, removalCounty: "Vermilion", providerId: "504896" });
  });
  test("rejects unknown resource type", () => {
    const bad = PLACEMENTS.replace("kin", "mystery");
    expect(() => loadPlacements(bad)).toThrow(/resource type/);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./load`.

- [ ] **Step 3: Implement `etl/load.ts`**

```ts
import { normalizeCounty, parseCsv, parseDate, requireDate } from "./parse";

export interface ProviderRow {
  id: string;
  licenseStart: Date;
  licenseEnd: Date;
  county: string;
  daysLicensed: number;
  daysActive: number;
  minAge: number;
  maxAge: number;
}

export interface ChildRow {
  id: string;
  removalDate: Date;
  dischargeDate: Date | null;
  ageAtRemoval: number | null;
  mostRecentAge: number | null;
  county: string;
}

export type ResourceType = "foster_home" | "kin" | "nonfamily";

export interface PlacementRow {
  childId: string;
  start: Date;
  end: Date | null;
  resourceType: ResourceType;
  index: number;
  removalCounty: string;
  placementCounty: string;
  providerId: string | null;
  length: number;
}

const RESOURCE_TYPES: ReadonlySet<string> = new Set(["foster_home", "kin", "nonfamily"]);

function checkHeader(actual: string[], expected: string, file: string): void {
  if (actual.join(",") !== expected) {
    throw new Error(`${file}: unexpected header ${actual.join(",")}`);
  }
}

function numOrNull(s: string): number | null {
  return s === "NA" ? null : Number(s);
}

export function loadProviders(text: string): ProviderRow[] {
  const { header, rows } = parseCsv(text);
  checkHeader(header, "id_provider,license_start_date,license_end_date,county_provider,n_days_licensed,n_days_active,min_age,max_age", "provider_level");
  return rows.map((r) => ({
    id: r[0],
    licenseStart: requireDate(r[1], `provider ${r[0]} license_start`),
    licenseEnd: requireDate(r[2], `provider ${r[0]} license_end`),
    county: normalizeCounty(r[3]),
    daysLicensed: Number(r[4]),
    daysActive: Number(r[5]),
    minAge: Number(r[6]),
    maxAge: Number(r[7]),
  }));
}

export function loadChildren(text: string): ChildRow[] {
  const { header, rows } = parseCsv(text);
  checkHeader(header, "id_child,removal_date,discharge_date,age_at_removal,most_recent_age,removal_county", "child_level");
  return rows.map((r) => ({
    id: r[0],
    removalDate: requireDate(r[1], `child ${r[0]} removal_date`),
    dischargeDate: parseDate(r[2]),
    ageAtRemoval: numOrNull(r[3]),
    mostRecentAge: numOrNull(r[4]),
    county: normalizeCounty(r[5]),
  }));
}

export function loadPlacements(text: string): PlacementRow[] {
  const { header, rows } = parseCsv(text);
  checkHeader(header, "id_child,placement_start_date,placement_end_date,resource_type_on_this_placement,placement_index,removal_county,placement_county,id_provider,placement_length", "placement_level");
  return rows.map((r) => {
    if (!RESOURCE_TYPES.has(r[3])) throw new Error(`Unknown resource type: ${r[3]}`);
    return {
      childId: r[0],
      start: requireDate(r[1], `placement for child ${r[0]} start`),
      end: parseDate(r[2]),
      resourceType: r[3] as ResourceType,
      index: Number(r[4]),
      removalCounty: normalizeCounty(r[5]),
      placementCounty: normalizeCounty(r[6]),
      providerId: r[7] === "NA" ? null : r[7],
      length: Number(r[8]),
    };
  });
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add etl/load.ts etl/load.test.ts
git commit -m "feat: typed CSV row loaders with county normalization"
```

---

### Task 4: Metric — children in care by county × age

**Files:**
- Create: `etl/metrics.ts`
- Test: `etl/metrics.test.ts`

**Interfaces:**
- Consumes: `ChildRow` from `./load`
- Produces:
  - `interface ChildrenByCounty { byAge: number[]; na: number }` (byAge length 18)
  - `childrenInCare(children: ChildRow[]): Map<string, ChildrenByCounty>` — in care = `dischargeDate === null`; keyed by `county`; `mostRecentAge` null (or out of 0–17) increments `na`.

- [ ] **Step 1: Write the failing tests**

Create `etl/metrics.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./metrics`.

- [ ] **Step 3: Implement in `etl/metrics.ts`**

```ts
import { ChildRow } from "./load";

export interface ChildrenByCounty {
  byAge: number[];
  na: number;
}

export function childrenInCare(children: ChildRow[]): Map<string, ChildrenByCounty> {
  const out = new Map<string, ChildrenByCounty>();
  for (const c of children) {
    if (c.dischargeDate !== null) continue;
    const entry = out.get(c.county) ?? { byAge: Array(18).fill(0), na: 0 };
    if (c.mostRecentAge === null || c.mostRecentAge < 0 || c.mostRecentAge > 17) {
      entry.na += 1;
    } else {
      entry.byAge[c.mostRecentAge] += 1;
    }
    out.set(c.county, entry);
  }
  return out;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add etl/metrics.ts etl/metrics.test.ts
git commit -m "feat: children-in-care metric"
```

---

### Task 5: Metric — active homes by county × age/band

**Files:**
- Modify: `etl/metrics.ts`
- Test: `etl/metrics.test.ts` (append)

**Interfaces:**
- Consumes: `ProviderRow` from `./load`
- Produces:
  - `type Band = "0-5" | "6-12" | "13-17"` and `const BANDS: Record<Band, [number, number]>`
  - `isActive(p: ProviderRow, snapshot: Date): boolean` — licenseStart ≤ snapshot ≤ licenseEnd
  - `interface HomesByCounty { byAge: number[]; all: number; byBand: Record<Band, number> }`
  - `homesByCounty(providers: ProviderRow[], snapshot: Date): Map<string, HomesByCounty>` — active homes only; `byAge[a]` counts homes with minAge ≤ a ≤ maxAge; `byBand` counts homes accepting ≥ 1 age in the band.

- [ ] **Step 1: Write the failing tests (append to `etl/metrics.test.ts`)**

```ts
import { ProviderRow } from "./load";
import { homesByCounty, isActive } from "./metrics";

const SNAPSHOT = d("2026-07-01");

function provider(over: Partial<ProviderRow>): ProviderRow {
  return {
    id: "p1", licenseStart: d("2024-01-01"), licenseEnd: d("2026-12-31"),
    county: "Adams", daysLicensed: 900, daysActive: 400, minAge: 0, maxAge: 17, ...over,
  };
}

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
```

- [ ] **Step 2: Run tests, verify the new ones fail**

Run: `npm test`
Expected: FAIL — `homesByCounty` not exported.

- [ ] **Step 3: Implement (append to `etl/metrics.ts`)**

```ts
import { ProviderRow } from "./load"; // merge into existing import line

export type Band = "0-5" | "6-12" | "13-17";

export const BANDS: Record<Band, [number, number]> = {
  "0-5": [0, 5],
  "6-12": [6, 12],
  "13-17": [13, 17],
};

export function isActive(p: ProviderRow, snapshot: Date): boolean {
  return p.licenseStart.getTime() <= snapshot.getTime() && snapshot.getTime() <= p.licenseEnd.getTime();
}

export interface HomesByCounty {
  byAge: number[];
  all: number;
  byBand: Record<Band, number>;
}

export function homesByCounty(providers: ProviderRow[], snapshot: Date): Map<string, HomesByCounty> {
  const out = new Map<string, HomesByCounty>();
  for (const p of providers) {
    if (!isActive(p, snapshot)) continue;
    const entry = out.get(p.county) ?? {
      byAge: Array(18).fill(0),
      all: 0,
      byBand: { "0-5": 0, "6-12": 0, "13-17": 0 },
    };
    entry.all += 1;
    for (let a = Math.max(0, p.minAge); a <= Math.min(17, p.maxAge); a++) {
      entry.byAge[a] += 1;
    }
    for (const band of Object.keys(BANDS) as Band[]) {
      const [lo, hi] = BANDS[band];
      if (p.minAge <= hi && p.maxAge >= lo) entry.byBand[band] += 1;
    }
    out.set(p.county, entry);
  }
  return out;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add etl/metrics.ts etl/metrics.test.ts
git commit -m "feat: active-homes age/band compatibility metric"
```

---

### Task 6: Metric — out-of-county foster placements

**Files:**
- Modify: `etl/metrics.ts`
- Test: `etl/metrics.test.ts` (append)

**Interfaces:**
- Consumes: `PlacementRow`, `ChildRow` from `./load`; `wholeYearsBetween` from `./parse`
- Produces:
  - `interface OocByCounty { outByAge: number[]; totalByAge: number[]; outAll: number; totalAll: number; destinations: Map<string, number> }`
  - `outOfCounty(placements: PlacementRow[], childById: Map<string, ChildRow>): Map<string, OocByCounty>` — foster_home placements only, keyed by `removalCounty`. Derived age at placement start = `ageAtRemoval + wholeYearsBetween(removalDate, start)`; ages outside 0–17 or with null `ageAtRemoval` count in `outAll`/`totalAll` only. `destinations` counts out-of-county `placementCounty` values.

- [ ] **Step 1: Write the failing tests (append)**

```ts
import { PlacementRow } from "./load";
import { outOfCounty } from "./metrics";

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
```

- [ ] **Step 2: Run tests, verify the new ones fail**

Run: `npm test`
Expected: FAIL — `outOfCounty` not exported.

- [ ] **Step 3: Implement (append to `etl/metrics.ts`)**

```ts
import { PlacementRow } from "./load"; // merge into existing import line
import { wholeYearsBetween } from "./parse";

export interface OocByCounty {
  outByAge: number[];
  totalByAge: number[];
  outAll: number;
  totalAll: number;
  destinations: Map<string, number>;
}

export function outOfCounty(
  placements: PlacementRow[],
  childById: Map<string, ChildRow>,
): Map<string, OocByCounty> {
  const out = new Map<string, OocByCounty>();
  for (const pl of placements) {
    if (pl.resourceType !== "foster_home") continue;
    const entry = out.get(pl.removalCounty) ?? {
      outByAge: Array(18).fill(0),
      totalByAge: Array(18).fill(0),
      outAll: 0,
      totalAll: 0,
      destinations: new Map<string, number>(),
    };
    const isOut = pl.placementCounty !== pl.removalCounty;
    entry.totalAll += 1;
    if (isOut) {
      entry.outAll += 1;
      entry.destinations.set(pl.placementCounty, (entry.destinations.get(pl.placementCounty) ?? 0) + 1);
    }
    const c = childById.get(pl.childId);
    const age = c && c.ageAtRemoval !== null ? c.ageAtRemoval + wholeYearsBetween(c.removalDate, pl.start) : null;
    if (age !== null && age >= 0 && age <= 17) {
      entry.totalByAge[age] += 1;
      if (isOut) entry.outByAge[age] += 1;
    }
    out.set(pl.removalCounty, entry);
  }
  return out;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add etl/metrics.ts etl/metrics.test.ts
git commit -m "feat: out-of-county foster placement metric with derived age"
```

---

### Task 7: Metrics — activity and monthly trends

**Files:**
- Modify: `etl/metrics.ts`
- Test: `etl/metrics.test.ts` (append)

**Interfaces:**
- Consumes: `ProviderRow`, `ChildRow` from `./load`; `monthKey` from `./parse`
- Produces:
  - `activityByCounty(providers: ProviderRow[]): Map<string, { activeDays: number; licensedDays: number }>` — all providers in window (not just active), day-weighted
  - `licenseTrendByCounty(providers: ProviderRow[]): Map<string, Record<string, number>>` — count of licenseStart per monthKey
  - `removalTrendByCounty(children: ChildRow[]): Map<string, Record<string, number>>` — count of removalDate per monthKey
  - `monthAxis(startYm: string, endYm: string): string[]` — inclusive `"2022-01"`…`"2026-06"` list

- [ ] **Step 1: Write the failing tests (append)**

```ts
import { activityByCounty, licenseTrendByCounty, monthAxis, removalTrendByCounty } from "./metrics";

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
```

- [ ] **Step 2: Run tests, verify the new ones fail**

Run: `npm test`
Expected: FAIL — `activityByCounty` not exported.

- [ ] **Step 3: Implement (append to `etl/metrics.ts`)**

```ts
import { monthKey } from "./parse"; // merge into existing import line

export function activityByCounty(providers: ProviderRow[]): Map<string, { activeDays: number; licensedDays: number }> {
  const out = new Map<string, { activeDays: number; licensedDays: number }>();
  for (const p of providers) {
    const entry = out.get(p.county) ?? { activeDays: 0, licensedDays: 0 };
    entry.activeDays += p.daysActive;
    entry.licensedDays += p.daysLicensed;
    out.set(p.county, entry);
  }
  return out;
}

function trend<T>(items: T[], county: (t: T) => string, date: (t: T) => Date): Map<string, Record<string, number>> {
  const out = new Map<string, Record<string, number>>();
  for (const item of items) {
    const entry = out.get(county(item)) ?? {};
    const key = monthKey(date(item));
    entry[key] = (entry[key] ?? 0) + 1;
    out.set(county(item), entry);
  }
  return out;
}

export function licenseTrendByCounty(providers: ProviderRow[]): Map<string, Record<string, number>> {
  return trend(providers, (p) => p.county, (p) => p.licenseStart);
}

export function removalTrendByCounty(children: ChildRow[]): Map<string, Record<string, number>> {
  return trend(children, (c) => c.county, (c) => c.removalDate);
}

export function monthAxis(startYm: string, endYm: string): string[] {
  const [sy, sm] = startYm.split("-").map(Number);
  const [ey, em] = endYm.split("-").map(Number);
  const res: string[] = [];
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    res.push(`${y}-${String(m).padStart(2, "0")}`);
    if (m === 12) { y += 1; m = 1; } else { m += 1; }
  }
  return res;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add etl/metrics.ts etl/metrics.test.ts
git commit -m "feat: activity and monthly trend metrics"
```

---

### Task 8: Shared types, map prep, ETL runner, reconciliation tests

**Files:**
- Create: `src/lib/types.ts`, `etl/run.ts`, `scripts/prep-map.ts`
- Create (generated, committed): `src/lib/il-counties.json`, `data/derived/counties.json`, `data/derived/statewide.json`, `data/derived/meta.json`
- Test: `etl/run.test.ts`

**Interfaces:**
- Consumes: everything from `etl/load.ts` and `etl/metrics.ts`
- Produces (all later tasks depend on these exact shapes, imported from `@/lib/types` in app code / `../src/lib/types` in etl):

```ts
// src/lib/types.ts
export const AGES: number[]; // [0..17]
export type Band = "0-5" | "6-12" | "13-17";
export type AgeSelection = { kind: "all" } | { kind: "band"; band: Band } | { kind: "age"; age: number };

export interface CountyData {
  name: string;                     // display name, e.g. "St. Clair"
  slug: string;                     // "st-clair"
  childrenByAge: number[];          // 18 slots
  childrenNA: number;
  homesByAge: number[];             // 18 slots
  homesAll: number;
  homesByBand: Record<Band, number>;
  oocOutByAge: number[];
  oocTotalByAge: number[];
  oocOutAll: number;
  oocTotalAll: number;
  destinations: { county: string; count: number }[]; // top 5, desc
  activeDays: number;
  licensedDays: number;
  newLicensesByMonth: Record<string, number>;
  removalsByMonth: Record<string, number>;
}

export interface StatewideData {
  childrenByAge: number[]; childrenNA: number;
  homesByAge: number[]; homesAll: number; homesByBand: Record<Band, number>;
  oocOutAll: number; oocTotalAll: number;
  activeDays: number; licensedDays: number;
  newLicensesByMonth: Record<string, number>;
  removalsByMonth: Record<string, number>;
}

export interface Meta {
  snapshotDate: string;             // "2026-07-01"
  months: string[];                 // "2022-01".."2026-06"
  counts: { providers: number; children: number; placements: number };
}
```

- `etl/run.ts` exports `buildDerived(providersCsv: string, childrenCsv: string, placementsCsv: string): { counties: CountyData[]; statewide: StatewideData; meta: Meta }` and, when run directly (`npm run etl`), writes the three files under `data/derived/`.
- `scripts/prep-map.ts` (`npm run prep-map`) writes `src/lib/il-counties.json`: a GeoJSON FeatureCollection of the 102 Illinois counties from `us-atlas/counties-10m.json` (features keep `id` and `properties.name`).

- [ ] **Step 1: Write `src/lib/types.ts`** (types only — no test needed)

Copy the block from Interfaces above verbatim, with `export const AGES = Array.from({ length: 18 }, (_, i) => i);` as the AGES implementation.

- [ ] **Step 2: Write `scripts/prep-map.ts`**

```ts
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
import type { FeatureCollection } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";

const topo = JSON.parse(readFileSync("node_modules/us-atlas/counties-10m.json", "utf8")) as Topology;
const counties = feature(topo, topo.objects.counties as GeometryCollection<{ name: string }>) as FeatureCollection;
const il = counties.features.filter((f) => String(f.id).length === 5 && String(f.id).slice(0, 2) === "17");
writeFileSync("src/lib/il-counties.json", JSON.stringify({ type: "FeatureCollection", features: il }));
console.log(`Wrote ${il.length} Illinois county features`);
```

Note: if `topojson-specification` types are unavailable, use `any` for the topology cast — this is a build script, not app code. Run:

```bash
npm run prep-map
```
Expected output: `Wrote 102 Illinois county features`.

- [ ] **Step 3: Write the failing reconciliation tests**

Create `etl/run.test.ts`:

```ts
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
```

- [ ] **Step 4: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./run`.

- [ ] **Step 5: Implement `etl/run.ts`**

```ts
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { ChildRow } from "./load";
import { loadChildren, loadPlacements, loadProviders } from "./load";
import {
  activityByCounty, childrenInCare, homesByCounty, licenseTrendByCounty,
  monthAxis, outOfCounty, removalTrendByCounty,
} from "./metrics";
import { slugify } from "./parse";
import type { Band, CountyData, Meta, StatewideData } from "../src/lib/types";

const SNAPSHOT = new Date("2026-07-01T00:00:00Z");

function sumInto(target: number[], source: number[]): void {
  for (let i = 0; i < source.length; i++) target[i] += source[i];
}

function mergeTrend(target: Record<string, number>, source: Record<string, number>): void {
  for (const [k, v] of Object.entries(source)) target[k] = (target[k] ?? 0) + v;
}

export function buildDerived(providersCsv: string, childrenCsv: string, placementsCsv: string): {
  counties: CountyData[]; statewide: StatewideData; meta: Meta;
} {
  const providers = loadProviders(providersCsv);
  const children = loadChildren(childrenCsv);
  const placements = loadPlacements(placementsCsv);

  const childById = new Map<string, ChildRow>(children.map((c) => [c.id, c]));
  const kids = childrenInCare(children);
  const homes = homesByCounty(providers, SNAPSHOT);
  const ooc = outOfCounty(placements, childById);
  const activity = activityByCounty(providers);
  const licenses = licenseTrendByCounty(providers);
  const removals = removalTrendByCounty(children);

  const names = new Set<string>([
    ...kids.keys(), ...homes.keys(), ...ooc.keys(), ...activity.keys(),
  ]);

  const counties: CountyData[] = [...names].sort((a, b) => a.localeCompare(b)).map((name) => {
    const k = kids.get(name);
    const h = homes.get(name);
    const o = ooc.get(name);
    const a = activity.get(name);
    return {
      name,
      slug: slugify(name),
      childrenByAge: k?.byAge ?? Array(18).fill(0),
      childrenNA: k?.na ?? 0,
      homesByAge: h?.byAge ?? Array(18).fill(0),
      homesAll: h?.all ?? 0,
      homesByBand: h?.byBand ?? { "0-5": 0, "6-12": 0, "13-17": 0 },
      oocOutByAge: o?.outByAge ?? Array(18).fill(0),
      oocTotalByAge: o?.totalByAge ?? Array(18).fill(0),
      oocOutAll: o?.outAll ?? 0,
      oocTotalAll: o?.totalAll ?? 0,
      destinations: [...(o?.destinations ?? new Map<string, number>())]
        .sort((x, y) => y[1] - x[1])
        .slice(0, 5)
        .map(([county, count]) => ({ county, count })),
      activeDays: a?.activeDays ?? 0,
      licensedDays: a?.licensedDays ?? 0,
      newLicensesByMonth: licenses.get(name) ?? {},
      removalsByMonth: removals.get(name) ?? {},
    };
  });

  const statewide: StatewideData = {
    childrenByAge: Array(18).fill(0), childrenNA: 0,
    homesByAge: Array(18).fill(0), homesAll: 0,
    homesByBand: { "0-5": 0, "6-12": 0, "13-17": 0 },
    oocOutAll: 0, oocTotalAll: 0,
    activeDays: 0, licensedDays: 0,
    newLicensesByMonth: {}, removalsByMonth: {},
  };
  for (const c of counties) {
    sumInto(statewide.childrenByAge, c.childrenByAge);
    statewide.childrenNA += c.childrenNA;
    sumInto(statewide.homesByAge, c.homesByAge);
    statewide.homesAll += c.homesAll;
    for (const band of Object.keys(statewide.homesByBand) as Band[]) {
      statewide.homesByBand[band] += c.homesByBand[band];
    }
    statewide.oocOutAll += c.oocOutAll;
    statewide.oocTotalAll += c.oocTotalAll;
    statewide.activeDays += c.activeDays;
    statewide.licensedDays += c.licensedDays;
    mergeTrend(statewide.newLicensesByMonth, c.newLicensesByMonth);
    mergeTrend(statewide.removalsByMonth, c.removalsByMonth);
  }

  const meta: Meta = {
    snapshotDate: "2026-07-01",
    months: monthAxis("2022-01", "2026-06"),
    counts: { providers: providers.length, children: children.length, placements: placements.length },
  };

  return { counties, statewide, meta };
}

// Runner: `npm run etl`
if (process.argv[1]?.endsWith("run.ts")) {
  const derived = buildDerived(
    readFileSync("data/raw/provider_level.csv", "utf8"),
    readFileSync("data/raw/child_level.csv", "utf8"),
    readFileSync("data/raw/placement_level.csv", "utf8"),
  );
  mkdirSync("data/derived", { recursive: true });
  writeFileSync("data/derived/counties.json", JSON.stringify(derived.counties));
  writeFileSync("data/derived/statewide.json", JSON.stringify(derived.statewide));
  writeFileSync("data/derived/meta.json", JSON.stringify(derived.meta));
  console.log(`Wrote ${derived.counties.length} counties to data/derived/`);
}
```

- [ ] **Step 6: Run tests, verify they pass**

Run: `npm test`
Expected: all pass, including all reconciliation tests. **If the map-join test fails**, print the two mismatch lists from the test output — the fix belongs in `mapKey` (or, if us-atlas genuinely names a county differently, add a special case to `normalizeCounty` with a comment) — do not weaken the test.

- [ ] **Step 7: Generate derived data and commit everything**

```bash
npm run etl
```
Expected: `Wrote 102 counties to data/derived/`.

```bash
git add src/lib/types.ts scripts/prep-map.ts src/lib/il-counties.json etl/run.ts etl/run.test.ts data/derived/
git commit -m "feat: ETL runner, map prep, derived data + reconciliation tests"
```

---

### Task 9: Lib — age selection and county stats

**Files:**
- Create: `src/lib/selection.ts`, `src/lib/stats.ts`
- Test: `src/lib/selection.test.ts`, `src/lib/stats.test.ts`

**Interfaces:**
- Consumes: types from `./types`
- Produces (exact signatures):
  - `parseAgeParam(p: string | undefined): AgeSelection` — `"0-5" | "6-12" | "13-17"` → band; `"0"`…`"17"` → age; anything else → all
  - `ageParamValue(sel: AgeSelection): string` — inverse (`all` → `"all"`)
  - `selectionLabel(sel: AgeSelection): string` — `"All ages" | "Ages 6–12" | "Age 16"` (en dash)
  - `agesFor(sel: AgeSelection): number[]`
  - `median(xs: number[]): number` / `quantile(xs: number[], q: number): number`
  - `childrenFor(c: CountyData | StatewideData, sel): number` — includes `childrenNA` when `all`
  - `homesFor(c: CountyData | StatewideData, sel): number`
  - `type Pressure = { kind: "ratio"; value: number } | { kind: "no-homes"; children: number } | { kind: "no-children" }`
  - `pressureFor(c, sel): Pressure` / `pressureSortValue(p: Pressure): number` (no-children → 0, no-homes → Infinity)
  - `oocRateFor(c: CountyData, sel): number | null` — null when denominator 0; `all` uses `oocOutAll/oocTotalAll`
  - `activityRateFor(c: { activeDays: number; licensedDays: number }): number | null`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/selection.test.ts`:

```ts
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
```

Create `src/lib/stats.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./selection` / `./stats`.

- [ ] **Step 3: Implement `src/lib/selection.ts`**

```ts
import { AGES, AgeSelection, Band } from "./types";

const BAND_VALUES: Band[] = ["0-5", "6-12", "13-17"];

const BAND_RANGES: Record<Band, [number, number]> = {
  "0-5": [0, 5],
  "6-12": [6, 12],
  "13-17": [13, 17],
};

export function parseAgeParam(p: string | undefined): AgeSelection {
  if (p !== undefined && (BAND_VALUES as string[]).includes(p)) {
    return { kind: "band", band: p as Band };
  }
  if (p !== undefined && /^\d{1,2}$/.test(p)) {
    const age = Number(p);
    if (age >= 0 && age <= 17) return { kind: "age", age };
  }
  return { kind: "all" };
}

export function ageParamValue(sel: AgeSelection): string {
  if (sel.kind === "band") return sel.band;
  if (sel.kind === "age") return String(sel.age);
  return "all";
}

export function selectionLabel(sel: AgeSelection): string {
  if (sel.kind === "band") return `Ages ${sel.band.replace("-", "–")}`;
  if (sel.kind === "age") return `Age ${sel.age}`;
  return "All ages";
}

export function agesFor(sel: AgeSelection): number[] {
  if (sel.kind === "all") return AGES;
  if (sel.kind === "age") return [sel.age];
  const [lo, hi] = BAND_RANGES[sel.band];
  return AGES.filter((a) => a >= lo && a <= hi);
}
```

- [ ] **Step 4: Implement `src/lib/stats.ts`**

```ts
import { agesFor } from "./selection";
import { AgeSelection, CountyData, StatewideData } from "./types";

export function median(xs: number[]): number {
  return quantile(xs, 0.5);
}

export function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  if (s.length === 0) return NaN;
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

type CountyLike = CountyData | StatewideData;

export function childrenFor(c: CountyLike, sel: AgeSelection): number {
  const base = agesFor(sel).reduce((sum, a) => sum + c.childrenByAge[a], 0);
  return sel.kind === "all" ? base + c.childrenNA : base;
}

export function homesFor(c: CountyLike, sel: AgeSelection): number {
  if (sel.kind === "all") return c.homesAll;
  if (sel.kind === "band") return c.homesByBand[sel.band];
  return c.homesByAge[sel.age];
}

export type Pressure =
  | { kind: "ratio"; value: number }
  | { kind: "no-homes"; children: number }
  | { kind: "no-children" };

export function pressureFor(c: CountyLike, sel: AgeSelection): Pressure {
  const children = childrenFor(c, sel);
  const homes = homesFor(c, sel);
  if (children === 0) return { kind: "no-children" };
  if (homes === 0) return { kind: "no-homes", children };
  return { kind: "ratio", value: children / homes };
}

export function pressureSortValue(p: Pressure): number {
  if (p.kind === "no-children") return 0;
  if (p.kind === "no-homes") return Infinity;
  return p.value;
}

export function oocRateFor(c: CountyData, sel: AgeSelection): number | null {
  if (sel.kind === "all") {
    return c.oocTotalAll === 0 ? null : c.oocOutAll / c.oocTotalAll;
  }
  const ages = agesFor(sel);
  const total = ages.reduce((sum, a) => sum + c.oocTotalByAge[a], 0);
  if (total === 0) return null;
  const out = ages.reduce((sum, a) => sum + c.oocOutByAge[a], 0);
  return out / total;
}

export function activityRateFor(c: { activeDays: number; licensedDays: number }): number | null {
  return c.licensedDays === 0 ? null : c.activeDays / c.licensedDays;
}
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/selection.ts src/lib/selection.test.ts src/lib/stats.ts src/lib/stats.test.ts
git commit -m "feat: age selection and county stat selectors"
```

---

### Task 10: Lib — verdict and plain-language reason

**Files:**
- Create: `src/lib/verdict.ts`
- Test: `src/lib/verdict.test.ts`

**Interfaces:**
- Consumes: `pressureFor`, `pressureSortValue`, `activityRateFor`, `oocRateFor`, `median`, `quantile` from `./stats`; `selectionLabel` from `./selection`
- Produces:
  - `type VerdictKind = "recruit" | "recruit_investigate" | "investigate_activity" | "comparatively_low" | "in_line"`
  - `interface Verdict { kind: VerdictKind; headline: string; detail: string; pressure: Pressure; pressureMedian: number; activity: number | null; activityMedian: number }`
  - `verdictFor(c: CountyData, all: CountyData[], sel: AgeSelection): Verdict`
  - `reasonFor(c: CountyData, all: CountyData[], sel: AgeSelection): string` — one line for the statewide table
- Classification rule (exact): pressure value = `pressureSortValue(pressureFor(...))`; median over all counties' **finite** values; level = high if `v > 1.1 × median` (Infinity is always high), low if `v < 0.9 × median`, else mid. Activity level identical using `activityRateFor` (null → mid, excluded from median). Verdict precedence: `pHigh && aLow → recruit_investigate`; `pHigh → recruit`; `aLow → investigate_activity`; `pLow && aHigh → comparatively_low`; else `in_line`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/verdict.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { county } from "./stats.test";
import { reasonFor, verdictFor } from "./verdict";

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
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./verdict`.

- [ ] **Step 3: Implement `src/lib/verdict.ts`**

```ts
import { selectionLabel } from "./selection";
import {
  Pressure, activityRateFor, median, oocRateFor, pressureFor, pressureSortValue, quantile,
} from "./stats";
import { AgeSelection, CountyData } from "./types";

export type VerdictKind =
  | "recruit"
  | "recruit_investigate"
  | "investigate_activity"
  | "comparatively_low"
  | "in_line";

export interface Verdict {
  kind: VerdictKind;
  headline: string;
  detail: string;
  pressure: Pressure;
  pressureMedian: number;
  activity: number | null;
  activityMedian: number;
}

type Level = "high" | "mid" | "low";

function level(value: number, med: number): Level {
  if (!Number.isFinite(value)) return "high";
  if (med === 0) return value > 0 ? "high" : "mid";
  if (value > 1.1 * med) return "high";
  if (value < 0.9 * med) return "low";
  return "mid";
}

const HEADLINES: Record<VerdictKind, string> = {
  recruit: "Recruit additional homes",
  recruit_investigate: "Recruit — and investigate inactive licensed homes",
  investigate_activity: "Investigate existing-home activity before recruiting",
  comparatively_low: "Recruitment pressure comparatively low",
  in_line: "In line with statewide patterns — no county-specific signal stands out",
};

export function verdictFor(c: CountyData, all: CountyData[], sel: AgeSelection): Verdict {
  const values = all.map((x) => pressureSortValue(pressureFor(x, sel)));
  const pressureMedian = median(values.filter(Number.isFinite));
  const activities = all.map(activityRateFor).filter((a): a is number => a !== null);
  const activityMedian = median(activities);

  const pressure = pressureFor(c, sel);
  const p = level(pressureSortValue(pressure), pressureMedian);
  const activity = activityRateFor(c);
  const a = activity === null ? "mid" : level(activity, activityMedian);

  let kind: VerdictKind;
  if (p === "high" && a === "low") kind = "recruit_investigate";
  else if (p === "high") kind = "recruit";
  else if (a === "low") kind = "investigate_activity";
  else if (p === "low" && a === "high") kind = "comparatively_low";
  else kind = "in_line";

  const label = selectionLabel(sel).toLowerCase();
  const pressureText =
    pressure.kind === "no-homes"
      ? `${pressure.children} children (${label}) with no age-compatible active homes`
      : pressure.kind === "no-children"
        ? `no children currently in care for ${label}`
        : `${pressure.value.toFixed(1)} children per age-compatible home (statewide median ${pressureMedian.toFixed(1)})`;
  const activityText =
    activity === null
      ? "no licensed-home history to measure activity"
      : `licensed homes have had an active placement ${(activity * 100).toFixed(0)}% of licensed days (statewide median ${(activityMedian * 100).toFixed(0)}%)`;

  return {
    kind,
    headline: HEADLINES[kind],
    detail: `For ${label}: ${pressureText}; ${activityText}.`,
    pressure,
    pressureMedian,
    activity,
    activityMedian,
  };
}

export function reasonFor(c: CountyData, all: CountyData[], sel: AgeSelection): string {
  const parts: string[] = [];

  const values = all.map((x) => pressureSortValue(pressureFor(x, sel)));
  const p75 = quantile(values.filter(Number.isFinite), 0.75);
  const own = pressureSortValue(pressureFor(c, sel));
  if (own === Infinity) parts.push("no age-compatible active homes");
  else if (own >= p75 && own > 0) parts.push("children per age-compatible home among the highest in the state");

  const oocValues = all.map((x) => oocRateFor(x, sel)).filter((r): r is number => r !== null);
  const ooc = oocRateFor(c, sel);
  if (ooc !== null && oocValues.length > 0 && ooc >= quantile(oocValues, 0.75)) {
    parts.push("high share of foster placements outside the county");
  }

  const activities = all.map(activityRateFor).filter((a): a is number => a !== null);
  const act = activityRateFor(c);
  if (act !== null && activities.length > 0 && act <= quantile(activities, 0.25)) {
    parts.push("licensed homes are often inactive");
  }

  if (parts.length === 0) return "No standout signal for this age selection.";
  const joined = parts.join("; ");
  return joined.charAt(0).toUpperCase() + joined.slice(1) + ".";
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: all pass. If the perturbation fixtures land on unexpected sides of the 1.1×/0.9× thresholds, adjust the fixture *numbers* (not the thresholds) and re-derive the expected verdicts by hand.

- [ ] **Step 5: Commit**

```bash
git add src/lib/verdict.ts src/lib/verdict.test.ts
git commit -m "feat: comparative recruit-vs-reactivate verdict and county reasons"
```

---

### Task 11: Lib — campaign brief content

**Files:**
- Create: `src/lib/brief.ts`
- Test: `src/lib/brief.test.ts`

**Interfaces:**
- Consumes: `childrenFor`, `homesFor`, `oocRateFor` from `./stats`; `verdictFor` from `./verdict`; `selectionLabel` from `./selection`
- Produces:
  - `interface Brief { title: string; lines: { label: string; value: string }[]; message: string; caveat: string }`
  - `briefFor(c: CountyData, all: CountyData[], sel: AgeSelection): Brief` — deterministic; no randomness, no dates-now.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/brief.test.ts`:

```ts
import { expect, test } from "vitest";
import { briefFor } from "./brief";
import { county } from "./stats.test";

const baseline = Array.from({ length: 10 }, (_, i) => county({ name: `C${i}`, slug: `c${i}` }));

test("brief contains county, ages, counts, and guardrail caveat", () => {
  const c = county({ name: "Champaign", slug: "champaign" });
  const brief = briefFor(c, [...baseline, c], { kind: "band", band: "13-17" });
  expect(brief.title).toBe("Champaign County recruitment brief — Ages 13–17");
  expect(brief.lines.map((l) => l.label)).toEqual([
    "Target county", "Priority ages", "Children in care", "Homes accepting these ages",
    "Out-of-county foster placement rate", "Recommended focus",
  ]);
  expect(brief.lines[2].value).toBe("5");
  expect(brief.lines[3].value).toBe("6");
  expect(brief.message).toContain("Champaign County");
  expect(brief.message).toContain("ages 13–17");
  expect(brief.caveat).toMatch(/age compatibility, not current vacancies/);
});

test("brief message is deterministic", () => {
  const c = county({});
  const a = briefFor(c, baseline, { kind: "all" });
  const b = briefFor(c, baseline, { kind: "all" });
  expect(a).toEqual(b);
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./brief`.

- [ ] **Step 3: Implement `src/lib/brief.ts`**

```ts
import { selectionLabel } from "./selection";
import { childrenFor, homesFor, oocRateFor } from "./stats";
import { AgeSelection, CountyData } from "./types";
import { verdictFor } from "./verdict";

export interface Brief {
  title: string;
  lines: { label: string; value: string }[];
  message: string;
  caveat: string;
}

function agePhrase(sel: AgeSelection): string {
  if (sel.kind === "band") return `ages ${sel.band.replace("-", "–")}`;
  if (sel.kind === "age") return `${sel.age}-year-olds`;
  return "children of all ages";
}

export function briefFor(c: CountyData, all: CountyData[], sel: AgeSelection): Brief {
  const children = childrenFor(c, sel);
  const homes = homesFor(c, sel);
  const ooc = oocRateFor(c, sel);
  const verdict = verdictFor(c, all, sel);
  const ages = agePhrase(sel);

  const oocSentence =
    ooc !== null && ooc >= 0.5
      ? ` Emphasize the need for local homes: most foster placements for these children are currently outside the county, away from their schools and communities.`
      : ooc !== null
        ? ` Local homes help children stay connected to their schools and communities; ${(ooc * 100).toFixed(0)}% of foster placements for these children are currently outside the county.`
        : "";

  const message =
    `Focus outreach on adults in ${c.name} County prepared to foster ${ages}. ` +
    `The county currently has ${children} children in care (${selectionLabel(sel).toLowerCase()}) and ` +
    `${homes} licensed homes accepting ${sel.kind === "all" ? "placements" : "these ages"}.` +
    oocSentence;

  return {
    title: `${c.name} County recruitment brief — ${selectionLabel(sel)}`,
    lines: [
      { label: "Target county", value: `${c.name} County` },
      { label: "Priority ages", value: selectionLabel(sel) },
      { label: "Children in care", value: String(children) },
      { label: "Homes accepting these ages", value: String(homes) },
      { label: "Out-of-county foster placement rate", value: ooc === null ? "—" : `${(ooc * 100).toFixed(0)}%` },
      { label: "Recommended focus", value: verdict.headline },
    ],
    message,
    caveat: "Home counts reflect age compatibility, not current vacancies or willingness to accept a specific child.",
  };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: all pass. (If `Children in care`/`Homes accepting these ages` literals differ, fix the fixture expectation by hand-computing from the `county()` fixture: children 13–17 = 5 × 1 = 5; homes byBand 13-17 = 6.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/brief.ts src/lib/brief.test.ts
git commit -m "feat: deterministic campaign brief content"
```

---

### Task 12: Statewide page — data access, age filter, summary, table

**Files:**
- Create: `src/lib/data.ts`, `src/components/AgeFilter.tsx`, `src/components/SummaryStrip.tsx`, `src/components/CountyTable.tsx`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css` (only if scaffold styles conflict)

**Interfaces:**
- Consumes: derived JSON, all lib functions
- Produces:
  - `src/lib/data.ts`: `getCounties(): CountyData[]`, `getStatewide(): StatewideData`, `getMeta(): Meta`, `countyBySlug(slug: string): CountyData | undefined`
  - `CountyTable` props: `{ rows: TableRow[] }` where `interface TableRow { slug: string; name: string; children: number; homes: number; pressureDisplay: string; pressureSort: number; ooc: string; oocSort: number; reason: string; ageParam: string }` (exported from `CountyTable.tsx`)
  - `AgeFilter` props: none (reads URL itself)
  - `SummaryStrip` props: `{ children: number; homes: number; oocPct: string; label: string }`

- [ ] **Step 1: Implement `src/lib/data.ts`**

```ts
import countiesJson from "../../data/derived/counties.json";
import statewideJson from "../../data/derived/statewide.json";
import metaJson from "../../data/derived/meta.json";
import { CountyData, Meta, StatewideData } from "./types";

const counties = countiesJson as CountyData[];
const statewide = statewideJson as StatewideData;
const meta = metaJson as Meta;

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
```

- [ ] **Step 2: Implement `src/components/AgeFilter.tsx`**

```tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseAgeParam, ageParamValue } from "@/lib/selection";

const OPTIONS = [
  { value: "all", label: "All ages" },
  { value: "0-5", label: "0–5" },
  { value: "6-12", label: "6–12" },
  { value: "13-17", label: "13–17" },
];

export default function AgeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = ageParamValue(parseAgeParam(params.get("age") ?? undefined));
  const isExact = /^\d/.test(current);

  function setAge(value: string) {
    router.replace(value === "all" ? pathname : `${pathname}?age=${value}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by age">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => setAge(o.value)}
          aria-pressed={current === o.value}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            current === o.value
              ? "bg-slate-800 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          {o.label}
        </button>
      ))}
      <label className="ml-2 flex items-center gap-2 text-sm text-slate-600">
        Exact age
        <select
          value={isExact ? current : ""}
          onChange={(e) => setAge(e.target.value === "" ? "all" : e.target.value)}
          className={`rounded-md border px-2 py-1.5 text-sm ${
            isExact ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white text-slate-700"
          }`}
        >
          <option value="">—</option>
          {Array.from({ length: 18 }, (_, a) => (
            <option key={a} value={String(a)}>{a}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
```

- [ ] **Step 3: Implement `src/components/SummaryStrip.tsx`**

```tsx
interface Props {
  childCount: number;
  homes: number;
  oocPct: string;
  label: string;
}

export default function SummaryStrip({ childCount, homes, oocPct, label }: Props) {
  const items = [
    { value: childCount.toLocaleString(), text: `children in care (${label})` },
    { value: homes.toLocaleString(), text: "active licensed homes accepting these ages" },
    { value: oocPct, text: "of foster placements are outside the child's county" },
  ];
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.text} className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-sm text-slate-500">{item.text}</dt>
          <dd className="text-2xl font-semibold text-slate-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
```

- [ ] **Step 4: Implement `src/components/CountyTable.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";

export interface TableRow {
  slug: string;
  name: string;
  children: number;
  homes: number;
  pressureDisplay: string;
  pressureSort: number;
  ooc: string;
  oocSort: number;
  reason: string;
  ageParam: string;
}

type SortKey = "name" | "children" | "homes" | "pressureSort" | "oocSort";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "name", label: "County", numeric: false },
  { key: "children", label: "Children in care", numeric: true },
  { key: "homes", label: "Homes accepting", numeric: true },
  { key: "pressureSort", label: "Children per home", numeric: true },
  { key: "oocSort", label: "Out-of-county rate", numeric: true },
];

export default function CountyTable({ rows }: { rows: TableRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("pressureSort");
  const [desc, setDesc] = useState(true);

  const sorted = [...rows].sort((a, b) => {
    const cmp = sortKey === "name" ? a.name.localeCompare(b.name) : (a[sortKey] as number) - (b[sortKey] as number);
    return desc ? -cmp : cmp;
  });

  function onSort(key: SortKey) {
    if (key === sortKey) setDesc(!desc);
    else {
      setSortKey(key);
      setDesc(key !== "name");
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[720px] bg-white text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left">
            {COLUMNS.map((col) => (
              <th key={col.key} className="px-3 py-2">
                <button onClick={() => onSort(col.key)} className="font-semibold text-slate-700 hover:text-slate-900">
                  {col.label}
                  {sortKey === col.key ? (desc ? " ↓" : " ↑") : ""}
                </button>
              </th>
            ))}
            <th className="px-3 py-2 font-semibold text-slate-700">Why</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.slug} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
              <td className="px-3 py-2">
                <Link
                  href={r.ageParam === "all" ? `/county/${r.slug}` : `/county/${r.slug}?age=${r.ageParam}`}
                  className="font-medium text-blue-700 underline-offset-2 hover:underline"
                >
                  {r.name}
                </Link>
              </td>
              <td className="px-3 py-2 tabular-nums">{r.children.toLocaleString()}</td>
              <td className="px-3 py-2 tabular-nums">{r.homes.toLocaleString()}</td>
              <td className="px-3 py-2 tabular-nums">{r.pressureDisplay}</td>
              <td className="px-3 py-2 tabular-nums">{r.ooc}</td>
              <td className="px-3 py-2 text-slate-600">{r.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Implement `src/app/layout.tsx` and `src/app/page.tsx`**

Replace the scaffold `layout.tsx` body content (keep the font setup create-next-app generated — the `${geistSans.variable} ${geistMono.variable}` class vars stay on `<body>`; add `import Link from "next/link";`) so the `<body>` renders:

```tsx
<body className={`${geistSans.variable} ${geistMono.variable} bg-slate-50 text-slate-900 antialiased`}>
  <header className="no-print border-b border-slate-200 bg-white">
    <div className="mx-auto max-w-6xl px-4 py-4">
      <Link href="/" className="text-lg font-semibold">Illinois Foster Home Recruitment Planner</Link>
      <p className="text-sm text-slate-500">
        Data snapshot: July 1, 2026 · For DCFS recruitment planning
      </p>
    </div>
  </header>
  <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
  <footer className="no-print mx-auto max-w-6xl px-4 pb-8 text-xs text-slate-400">
    Counts reflect age compatibility of licensed homes, not current vacancies. Six children with
    unrecorded ages are included in all-ages totals only. County name “Vermillion” in the source
    data is normalized to Vermilion.
  </footer>
</body>
```

Update `metadata` in layout: title "Illinois Foster Home Recruitment Planner", description "Where to recruit foster homes, and for which ages — for Illinois DCFS staff."

Replace `src/app/page.tsx` entirely:

```tsx
import AgeFilter from "@/components/AgeFilter";
import CountyTable, { TableRow } from "@/components/CountyTable";
import SummaryStrip from "@/components/SummaryStrip";
import { getCounties, getStatewide } from "@/lib/data";
import { ageParamValue, parseAgeParam, selectionLabel } from "@/lib/selection";
import { childrenFor, homesFor, oocRateFor, pressureFor, pressureSortValue } from "@/lib/stats";
import { reasonFor } from "@/lib/verdict";

export default async function Home({ searchParams }: { searchParams: Promise<{ age?: string }> }) {
  const { age } = await searchParams;
  const sel = parseAgeParam(age);
  const counties = getCounties();
  const statewide = getStatewide();

  const rows: TableRow[] = counties.map((c) => {
    const pressure = pressureFor(c, sel);
    const ooc = oocRateFor(c, sel);
    return {
      slug: c.slug,
      name: c.name,
      children: childrenFor(c, sel),
      homes: homesFor(c, sel),
      pressureDisplay:
        pressure.kind === "ratio" ? pressure.value.toFixed(1)
        : pressure.kind === "no-homes" ? "No compatible homes"
        : "—",
      pressureSort: pressureSortValue(pressure),
      ooc: ooc === null ? "—" : `${(ooc * 100).toFixed(0)}%`,
      oocSort: ooc ?? -1,
      reason: reasonFor(c, counties, sel),
      ageParam: ageParamValue(sel),
    };
  });

  const swOoc = statewide.oocTotalAll === 0 ? "—" : `${((statewide.oocOutAll / statewide.oocTotalAll) * 100).toFixed(0)}%`;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Where should we recruit, and for whom?</h1>
        <AgeFilter />
        <SummaryStrip
          childCount={childrenFor(statewide, sel)}
          homes={homesFor(statewide, sel)}
          oocPct={swOoc}
          label={selectionLabel(sel).toLowerCase()}
        />
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">County recruitment priorities</h2>
        <p className="text-sm text-slate-500">
          Ranked by children in care per age-compatible active home. Click a county for details
          and a recruitment brief.
        </p>
        <CountyTable rows={rows} />
      </section>
    </div>
  );
}
```

Note: `useSearchParams` in `AgeFilter` requires a Suspense boundary in Next 16 — if the build errors, wrap `<AgeFilter />` in `<Suspense fallback={null}>` (import from react).

- [ ] **Step 6: Verify manually**

```bash
npm test && npm run dev
```

Checklist (browser at localhost:3000):
- Table renders 102 counties, default-sorted by children-per-home descending
- Clicking "13–17" updates URL to `?age=13-17` and all numbers change
- Exact age dropdown → `?age=16` works; invalid URL param (`?age=banana`) falls back to All ages
- Sort by each column works both directions; county links carry the age param

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: statewide priorities page with age filter and ranked table"
```

---

### Task 13: Choropleth map

**Files:**
- Create: `src/components/ChoroplethMap.tsx`
- Modify: `src/app/page.tsx` (add map section above the table)

**Interfaces:**
- Consumes: `src/lib/il-counties.json`, `mapKey`-equivalent join (inline), lib stats
- Produces: `ChoroplethMap` props: `{ items: MapItem[]; ageParam: string; legendTitle: string }` where `interface MapItem { slug: string; name: string; value: number | null; display: string }` (`value` = pressureSortValue, null = no children; Infinity = no compatible homes; exported from `ChoroplethMap.tsx`)

- [ ] **Step 1: Implement `src/components/ChoroplethMap.tsx`**

```tsx
"use client";

import { geoMercator, geoPath } from "d3-geo";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { FeatureCollection } from "geojson";
import il from "@/lib/il-counties.json";

export interface MapItem {
  slug: string;
  name: string;
  value: number | null; // pressureSortValue; null = no children in care
  display: string;      // e.g. "2.3 children per home"
}

// Colorblind-safe sequential blues (ColorBrewer 5-class), plus special states.
const PALETTE = ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"];
const NO_CHILDREN = "#e5e7eb";
const NO_HOMES = "#b91c1c";

const WIDTH = 480;
const HEIGHT = 620;

function key(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

export default function ChoroplethMap({ items, ageParam, legendTitle }: {
  items: MapItem[];
  ageParam: string;
  legendTitle: string;
}) {
  const router = useRouter();
  const geo = il as unknown as FeatureCollection;

  const path = useMemo(() => {
    const projection = geoMercator().fitSize([WIDTH, HEIGHT], geo);
    return geoPath(projection);
  }, [geo]);

  const byKey = useMemo(() => new Map(items.map((i) => [key(i.name), i])), [items]);

  const thresholds = useMemo(() => {
    const finite = items.map((i) => i.value).filter((v): v is number => v !== null && Number.isFinite(v)).sort((a, b) => a - b);
    return [0.2, 0.4, 0.6, 0.8].map((q) => finite[Math.floor(q * (finite.length - 1))]);
  }, [items]);

  function fill(value: number | null): string {
    if (value === null) return NO_CHILDREN;
    if (!Number.isFinite(value)) return NO_HOMES;
    let bucket = 0;
    while (bucket < thresholds.length && value > thresholds[bucket]) bucket++;
    return PALETTE[bucket];
  }

  return (
    <figure>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full max-w-md" role="img"
        aria-label={`Illinois county map shaded by ${legendTitle}`}>
        {geo.features.map((f) => {
          const item = byKey.get(key((f.properties as { name: string }).name));
          if (!item) return null;
          return (
            <path
              key={item.slug}
              d={path(f) ?? undefined}
              fill={fill(item.value)}
              stroke="#ffffff"
              strokeWidth={0.6}
              tabIndex={0}
              role="link"
              aria-label={`${item.name} County: ${item.display}. Open county page.`}
              className="cursor-pointer outline-offset-2 hover:opacity-80 focus:outline focus:outline-2 focus:outline-slate-800"
              onClick={() => router.push(ageParam === "all" ? `/county/${item.slug}` : `/county/${item.slug}?age=${ageParam}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter") router.push(ageParam === "all" ? `/county/${item.slug}` : `/county/${item.slug}?age=${ageParam}`);
              }}
            >
              <title>{`${item.name}: ${item.display}`}</title>
            </path>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <span className="font-medium">{legendTitle}</span>
        <span className="flex items-center gap-1">
          {PALETTE.map((c) => (
            <span key={c} className="inline-block h-3 w-6" style={{ backgroundColor: c }} />
          ))}
          <span className="ml-1">low → high</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3" style={{ backgroundColor: NO_HOMES }} /> no compatible homes
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3" style={{ backgroundColor: NO_CHILDREN }} /> no children in care
        </span>
      </figcaption>
    </figure>
  );
}
```

- [ ] **Step 2: Wire into `src/app/page.tsx`**

Add to the imports: `import ChoroplethMap, { MapItem } from "@/components/ChoroplethMap";` and `selectionLabel` is already imported. Inside `Home`, after `rows`, add:

```tsx
const mapItems: MapItem[] = counties.map((c) => {
  const p = pressureFor(c, sel);
  return {
    slug: c.slug,
    name: c.name,
    value: p.kind === "no-children" ? null : pressureSortValue(p),
    display:
      p.kind === "ratio" ? `${p.value.toFixed(1)} children in care per age-compatible home`
      : p.kind === "no-homes" ? `${p.children} children in care, no age-compatible homes`
      : "no children in care for this selection",
  };
});
```

Then render a two-column section between the summary and the table:

```tsx
<section className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr]">
  <ChoroplethMap
    items={mapItems}
    ageParam={ageParamValue(sel)}
    legendTitle={`Children per age-compatible home (${selectionLabel(sel).toLowerCase()})`}
  />
  <div className="space-y-2">
    <h2 className="text-lg font-semibold">County recruitment priorities</h2>
    <p className="text-sm text-slate-500">
      Ranked by children in care per age-compatible active home. Click a county for details
      and a recruitment brief.
    </p>
    <CountyTable rows={rows} />
  </div>
</section>
```

(Remove the previous standalone table `<section>` — the table now lives beside the map.)

- [ ] **Step 3: Verify manually**

Checklist (localhost:3000):
- Illinois renders recognizably (tall state, Chicago top-right); 102 counties
- Shading changes when the age filter changes; legend present
- Hover shows county tooltip; click navigates to `/county/<slug>` preserving age param
- Tab reaches county paths; Enter navigates
- Counties with no compatible homes render dark red; verify at `?age=0` or another selection where some county has zero

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: d3-geo Illinois choropleth with keyboard navigation"
```

---

### Task 14: County detail page

**Files:**
- Create: `src/app/county/[slug]/page.tsx`, `src/app/county/[slug]/not-found.tsx`
- Create: `src/components/AgeCompatibilityChart.tsx`, `src/components/DiagnosticCard.tsx`, `src/components/OutOfCountyPanel.tsx`, `src/components/TrendsChart.tsx`

**Interfaces:**
- Consumes: lib + Recharts
- Produces component props:
  - `AgeCompatibilityChart`: `{ data: { age: number; children: number; homes: number }[]; highlightAges: number[]; ageParam: string }`
  - `DiagnosticCard`: `{ verdict: Verdict; label: string }` (Verdict from `@/lib/verdict`)
  - `OutOfCountyPanel`: `{ ratePct: string; label: string; destinations: { county: string; count: number }[] }`
  - `TrendsChart`: `{ data: { month: string; licenses: number; removals: number }[] }`

- [ ] **Step 1: Implement `src/components/AgeCompatibilityChart.tsx`**

```tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Bar, CartesianGrid, ComposedChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

interface Props {
  data: { age: number; children: number; homes: number }[];
  highlightAges: number[];
  ageParam: string;
}

export default function AgeCompatibilityChart({ data, highlightAges, ageParam }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const highlightAll = highlightAges.length === 18;

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="age" label={{ value: "Age", position: "insideBottom", offset: -2 }} />
          <YAxis allowDecimals={false} />
          <Tooltip
            formatter={(value: number, name: string) => [value, name]}
            labelFormatter={(age) => `Age ${age}`}
          />
          <Legend />
          <Bar
            name="Children in care"
            dataKey="children"
            fill="#1d4ed8"
            fillOpacity={highlightAll ? 1 : 0.35}
            onClick={(_, index) => router.push(`${pathname}?age=${data[index].age}`)}
            className="cursor-pointer"
          />
          <Bar
            name="Homes accepting this age"
            dataKey="homes"
            fill="#f59e0b"
            fillOpacity={highlightAll ? 1 : 0.35}
            onClick={(_, index) => router.push(`${pathname}?age=${data[index].age}`)}
            className="cursor-pointer"
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-1 text-xs text-slate-500">
        Compares children currently in care at each age with licensed homes whose age preferences
        include that age. This measures age compatibility, not vacancies or beds. Click a bar to
        filter the page to that exact age{ageParam !== "all" ? "; use the All ages button to reset" : ""}.
      </p>
    </div>
  );
}
```

Note: per-age highlight opacity via Recharts `<Cell>` is a polish item (Task 16); at this task, bars render at full opacity when "All ages" and dimmed otherwise — acceptable intermediate state.

- [ ] **Step 2: Implement `src/components/DiagnosticCard.tsx`**

```tsx
import type { Verdict } from "@/lib/verdict";

const TONE: Record<Verdict["kind"], string> = {
  recruit: "border-amber-300 bg-amber-50",
  recruit_investigate: "border-red-300 bg-red-50",
  investigate_activity: "border-sky-300 bg-sky-50",
  comparatively_low: "border-emerald-300 bg-emerald-50",
  in_line: "border-slate-300 bg-slate-50",
};

export default function DiagnosticCard({ verdict, label }: { verdict: Verdict; label: string }) {
  return (
    <div className={`rounded-lg border p-4 ${TONE[verdict.kind]}`}>
      <h3 className="text-sm font-medium uppercase tracking-wide text-slate-500">
        Recommended focus · {label}
      </h3>
      <p className="mt-1 text-lg font-semibold text-slate-900">{verdict.headline}</p>
      <p className="mt-2 text-sm text-slate-700">{verdict.detail}</p>
      <p className="mt-2 text-xs text-slate-500">
        Comparisons are relative to statewide levels, which may themselves reflect shortage.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Implement `src/components/OutOfCountyPanel.tsx`**

```tsx
interface Props {
  ratePct: string;
  label: string;
  destinations: { county: string; count: number }[];
}

export default function OutOfCountyPanel({ ratePct, label, destinations }: Props) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-medium uppercase tracking-wide text-slate-500">
        Local placement pressure
      </h3>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{ratePct}</p>
      <p className="text-sm text-slate-600">
        of foster-home placements for children from this county ({label}) were outside the county.
      </p>
      {destinations.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-medium text-slate-500">
            Most common destination counties (all ages)
          </h4>
          <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
            {destinations.map((d) => (
              <li key={d.county} className="flex justify-between">
                <span>{d.county}</span>
                <span className="tabular-nums text-slate-500">{d.count.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Out-of-county placement is a pressure signal, not a judgment — some placements outside the
        county are appropriate for an individual child.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Implement `src/components/TrendsChart.tsx`**

```tsx
"use client";

import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export default function TrendsChart({ data }: { data: { month: string; licenses: number; removals: number }[] }) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="month" interval={11} tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line name="New licenses" type="monotone" dataKey="licenses" stroke="#0f766e" dot={false} />
          <Line name="Removals" type="monotone" dataKey="removals" stroke="#b45309" dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-1 text-xs text-slate-500">
        Monthly newly licensed homes vs. children removed into care, Jan 2022 – Jun 2026.
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Implement `src/app/county/[slug]/page.tsx` and `not-found.tsx`**

`page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import AgeCompatibilityChart from "@/components/AgeCompatibilityChart";
import AgeFilter from "@/components/AgeFilter";
import DiagnosticCard from "@/components/DiagnosticCard";
import OutOfCountyPanel from "@/components/OutOfCountyPanel";
import TrendsChart from "@/components/TrendsChart";
import { countyBySlug, getCounties, getMeta } from "@/lib/data";
import { ageParamValue, agesFor, parseAgeParam, selectionLabel } from "@/lib/selection";
import { childrenFor, homesFor, oocRateFor } from "@/lib/stats";
import { AGES } from "@/lib/types";
import { verdictFor } from "@/lib/verdict";

export function generateStaticParams() {
  return getCounties().map((c) => ({ slug: c.slug }));
}

export default async function CountyPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ age?: string }>;
}) {
  const { slug } = await params;
  const { age } = await searchParams;
  const county = countyBySlug(slug);
  if (!county) notFound();

  const sel = parseAgeParam(age);
  const counties = getCounties();
  const meta = getMeta();
  const label = selectionLabel(sel).toLowerCase();

  const chartData = AGES.map((a) => ({
    age: a,
    children: county.childrenByAge[a],
    homes: county.homesByAge[a],
  }));

  const trendData = meta.months.map((month) => ({
    month,
    licenses: county.newLicensesByMonth[month] ?? 0,
    removals: county.removalsByMonth[month] ?? 0,
  }));

  const ooc = oocRateFor(county, sel);

  return (
    <div className="space-y-6">
      <nav className="no-print text-sm">
        <Link href="/" className="text-blue-700 hover:underline">← All counties</Link>
      </nav>
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">{county.name} County</h1>
        <AgeFilter />
        <p className="text-sm text-slate-600">
          {childrenFor(county, sel).toLocaleString()} children in care ({label}) ·{" "}
          {homesFor(county, sel).toLocaleString()} active licensed homes accepting these ages
        </p>
      </section>
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-lg font-semibold">Children vs. homes accepting each age</h2>
            <AgeCompatibilityChart
              data={chartData}
              highlightAges={agesFor(sel)}
              ageParam={ageParamValue(sel)}
            />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-lg font-semibold">Licensing vs. removals</h2>
            <TrendsChart data={trendData} />
          </div>
        </div>
        <div className="space-y-6">
          <DiagnosticCard verdict={verdictFor(county, counties, sel)} label={label} />
          <OutOfCountyPanel
            ratePct={ooc === null ? "—" : `${(ooc * 100).toFixed(0)}%`}
            label={label}
            destinations={county.destinations}
          />
        </div>
      </section>
    </div>
  );
}
```

`not-found.tsx`:

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold">County not found</h1>
      <p className="mt-2 text-sm text-slate-600">
        That county isn&apos;t in the dataset.
      </p>
      <Link href="/" className="mt-4 inline-block text-blue-700 hover:underline">
        ← Back to all counties
      </Link>
    </div>
  );
}
```

- [ ] **Step 6: Verify manually**

```bash
npm test && npm run dev
```

Checklist:
- `/county/cook` renders chart, diagnostic, out-of-county panel, trends
- `/county/st-clair` and `/county/jo-daviess` work (slug edge cases)
- `/county/narnia` → county 404 page
- Age filter changes diagnostic verdict text and header numbers; chart bar click sets `?age=N`
- Diagnostic shows statewide medians in its detail line

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: county detail page with compatibility chart and diagnostic"
```

---

### Task 15: Campaign brief UI

**Files:**
- Create: `src/components/CampaignBrief.tsx`
- Modify: `src/app/county/[slug]/page.tsx` (add brief section), `src/app/globals.css` (print rules)

**Interfaces:**
- Consumes: `briefFor` from `@/lib/brief`
- Produces: `CampaignBrief` props: `{ brief: Brief }` (Brief from `@/lib/brief`)

- [ ] **Step 1: Implement `src/components/CampaignBrief.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { Brief } from "@/lib/brief";

export default function CampaignBrief({ brief }: { brief: Brief }) {
  const [copied, setCopied] = useState(false);

  const plainText = [
    brief.title,
    "",
    ...brief.lines.map((l) => `${l.label}: ${l.value}`),
    "",
    brief.message,
    "",
    `Note: ${brief.caveat}`,
  ].join("\n");

  async function copy() {
    await navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="print-brief rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold">{brief.title}</h2>
        <div className="no-print flex gap-2">
          <button onClick={copy} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            {copied ? "Copied ✓" : "Copy"}
          </button>
          <button onClick={() => window.print()} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            Print
          </button>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
        {brief.lines.map((l) => (
          <div key={l.label} className="flex justify-between gap-4 border-b border-slate-100 pb-1 text-sm">
            <dt className="text-slate-500">{l.label}</dt>
            <dd className="text-right font-medium text-slate-900">{l.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm leading-relaxed text-slate-800">{brief.message}</p>
      <p className="mt-3 text-xs text-slate-500">Note: {brief.caveat}</p>
    </div>
  );
}
```

- [ ] **Step 2: Add print rules to `src/app/globals.css`** (append)

```css
@media print {
  .no-print {
    display: none !important;
  }
  body:has(.print-brief) main > * > *:not(:has(.print-brief)):not(.print-brief) {
    display: none;
  }
}
```

If the `:has` selector proves unreliable across the scaffold's CSS setup, fall back to simply keeping `.no-print` on the header/footer/nav/filter and letting the whole county page print — acceptable.

- [ ] **Step 3: Wire into county page**

In `src/app/county/[slug]/page.tsx` add imports:

```tsx
import CampaignBrief from "@/components/CampaignBrief";
import { briefFor } from "@/lib/brief";
```

and after the two-column `<section>`, add:

```tsx
<section>
  <CampaignBrief brief={briefFor(county, counties, sel)} />
</section>
```

- [ ] **Step 4: Verify manually**

Checklist:
- Brief renders on county page and changes with age selection
- Copy button copies plain text (paste into a text editor to confirm layout)
- Print preview shows a usable one-page brief
- Caveat line present

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: copyable/printable campaign brief"
```

---

### Task 16: Polish, accessibility, full manual checklist

**Files:**
- Modify: as needed per checklist findings (components, globals.css)

**Interfaces:** none new — this task fixes, it does not add features.

- [ ] **Step 1: Run the lint + test gate**

```bash
npm run lint && npm test && npm run build
```
Expected: all clean. Fix anything that isn't (typical: unused imports, `<a>` vs `<Link>`, img warnings — none expected).

- [ ] **Step 2: Full manual checklist** (fix every failure before checking off)

Statewide page:
- [ ] All 5 age selections × sort orders work; no NaN/Infinity ever displays
- [ ] Map and table agree for spot-checked counties (Cook, St. Clair, a small county)
- [ ] "No compatible homes" counties (if any at current selection) sort to top and render red on map
- [ ] Keyboard: tab through filter → map counties → table sorts; everything reachable and operable
- [ ] Viewport 375px wide: table scrolls horizontally, map fits, filter wraps

County page:
- [ ] Cook, St. Clair, Jo Daviess, DeKalb, a zero-ish county (e.g. lowest-population) all render sensibly
- [ ] Chart click-to-filter works; caveat text present under chart, diagnostic, out-of-county panel, brief
- [ ] Verdict text reads correctly for at least 3 different verdict kinds (find counties exhibiting each by sorting the statewide table)
- [ ] Print preview of brief is clean

Copy audit (grep the repo):

```bash
grep -ri "available homes\|open beds\|adverse" src/ && echo "FAIL: forbidden copy" || echo "OK"
```
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "polish: accessibility, responsive, and copy fixes from manual checklist"
```

---

### Task 17: README and DECISIONS docs

**Files:**
- Modify: `README.md` (replace scaffold content)
- Create: `DECISIONS.md`

**Interfaces:** none.

- [ ] **Step 1: Write `README.md`** (replace entirely)

```markdown
# Illinois Foster Home Recruitment Planner

A dashboard for Illinois DCFS staff answering two questions: **where should we recruit
foster homes, and for which ages?** Built for the Foster Insights full-stack task.

**Live site:** <VERCEL_URL — filled in at deploy>

## What it shows

- **Statewide view** — an Illinois county map and ranked table showing recruitment
  pressure (children in care per age-compatible licensed home), filterable by age
  band or exact age, with a plain-language reason per county.
- **County view** — age-by-age compatibility chart, a comparative
  recruit-vs-reactivate diagnostic, out-of-county placement pressure, licensing/removal
  trends, and a copyable recruitment campaign brief.

## Running locally

    npm install
    npm test          # unit + reconciliation tests
    npm run dev       # http://localhost:3000

## Data pipeline

Raw CSVs (provider, child, placement level; Jan 2022 – Jul 2026 extract) live in
`data/raw/`. `npm run etl` recomputes `data/derived/*.json`, which is committed so
builds are reproducible; `npm run prep-map` regenerates the Illinois TopoJSON extract.
All metric definitions and their tests are in `etl/` and `src/lib/`.

See `DECISIONS.md` for why each product and technical choice was made.
```

- [ ] **Step 2: Write `DECISIONS.md`**

```markdown
# Decisions

Product and technical decisions, in the order they were made.

## Product

1. **Recruitment over retention.** The task allows either; recruitment offered the
   clearest data-to-action story with the provided fields (age preferences, counties,
   placements). Retention signals (home activity) appear only as diagnostic context.
2. **Two pages, one shared age filter.** Statewide prioritization → county diagnosis →
   campaign brief mirrors how staff would actually work. Age selection lives in the URL
   so views are shareable.
3. **Age bands first, exact age as drill-down.** Bands answer "which broad type of home
   should this county recruit?"; exact ages expose gaps a band hides (a county can look
   fine for 13–17 while having almost no homes for 16–17). The county chart's bars are
   click-to-filter for this reason.
4. **Pressure ratio, not a composite score.** Children in care per age-compatible home
   is explainable in one sentence. Out-of-county rate and home activity are shown as
   separate signals with plain-language reasons, never blended into an opaque index.
5. **Comparative verdicts, never absolute.** "In line with statewide patterns" — not
   "no shortage" — because a median county in a system-wide shortage still has a
   problem. Statewide baselines are always displayed next to county values.
6. **Careful terminology.** "Homes accepting this age," never "available homes" or
   "open beds" — the data shows age compatibility, not vacancies. "Out-of-county rate,"
   not "adverse placements" — some out-of-county placements are appropriate.
7. **No individual-provider preference prompts.** Age preferences are personal choices
   that may reflect training, household composition, or safety; the app aggregates
   gaps to shape recruitment instead of flagging individual homes as restrictive.
8. **Campaign brief is a deterministic template, not an LLM.** Reproducible, testable,
   no keys or costs, and every sentence is traceable to a metric.
9. **Excluded:** scenario planner (complexity vs. deadline), behavioral-needs matching
   (no supporting data — stated as a limitation rather than proxied), applicant CRM and
   ad targeting (out of scope for a decision-support tool).

## Data

10. **Snapshot date July 1, 2026** (end of extract window). "Currently in care" =
    no discharge date; age = most recent age.
11. **Demand is keyed to removal county** — recruitment aims to place children near
    home, so need is counted where children come from, not where they are placed.
12. **Band compatibility = accepts ≥1 age in band**, labeled as such in the UI; the
    age-by-age chart exposes within-band gaps rather than pretending one number
    covers five ages.
13. **Out-of-county rate uses foster_home placements only** — kin and nonfamily
    placements are not what home recruitment addresses. Age filtering uses age at
    placement start, derived from age at removal + elapsed whole years.
14. **Activity is day-weighted** (Σ active days ÷ Σ licensed days), matching the task
    note that one long placement equals many short ones in capacity terms.
15. **"Vermillion" → "Vermilion".** Illinois has 102 counties; the 103rd spelling is
    normalized so the map join and county pages are correct. Documented as
    normalization, not data cleaning.
16. **Six children with unrecorded ages** are included in all-ages totals and excluded
    from age-specific views, with a footnote in the UI.

## Technical

17. **Build-time ETL → committed JSON; no database.** The data is a fixed extract and
    the entire aggregated payload is a few hundred KB. A database adds deploy risk and
    zero user value here; the ETL boundary is where a live feed would slot in.
18. **Next.js 16 App Router + TypeScript + Tailwind.** Server components read derived
    JSON; interactivity is client-side over precomputed county×age matrices.
19. **Recharts for charts** (React-native composition, accessibility layer on by
    default in v3) — but **d3-geo + topojson-client directly for the map**:
    react-simple-maps' peer deps cap at React 18, and a hand-rolled SVG choropleth is
    ~80 lines with full control over focus/ARIA behavior.
20. **Vitest with TDD on every metric** plus reconciliation tests pinning known totals
    (6,063 providers · 16,139 children · 51,994 placements · 8,071 in care · 102
    counties) and a map-join test guaranteeing every county matches a map feature.
21. **Verdict/reason are pure functions evaluated per age selection** at render time —
    they can't be precomputed because the median-based thresholds depend on the
    selection; the inputs are precomputed matrices, so it's still O(counties) work.
```

- [ ] **Step 3: Commit**

```bash
git add README.md DECISIONS.md
git commit -m "docs: README and decision log"
```

---

### Task 18: Deploy to GitHub + Vercel

**Files:**
- Modify: `README.md` (fill in live URL)

**Interfaces:** none — this task publishes.

**⚠️ Outward-facing actions — confirm with Wyatt before each of: repo creation (name/visibility), first push, Vercel project creation, production deploy. Also ask whether `docs/superpowers/` planning docs and `instruction_notes.md` should ship in the public submission repo or be removed from history first (AI use is permitted by the task, so either is defensible — Wyatt's call).**

- [ ] **Step 1: Final pre-flight**

```bash
npm run lint && npm test && npm run build
git status
```
Expected: clean tree, all green.

- [ ] **Step 2: Create GitHub repo and push** (after confirmation)

```bash
gh repo create foster-insights-recruitment --public --source=. --push
```

- [ ] **Step 3: Deploy to Vercel** (after confirmation)

```bash
vercel --prod
```
Follow prompts to link the new project. Framework auto-detects Next.js; no env vars needed (static data is committed).

- [ ] **Step 4: Verify the live site**

```bash
curl -s -o /dev/null -w "%{http_code}\n" <VERCEL_URL>
curl -s -o /dev/null -w "%{http_code}\n" <VERCEL_URL>/county/cook
```
Expected: `200` twice. Then a human pass in the browser: statewide page, one county page, age filter, brief print preview.

- [ ] **Step 5: Fill the live URL into README, push**

```bash
git add README.md
git commit -m "docs: add live URL"
git push
```

- [ ] **Step 6: Confirm freeze** — no further pushes after Wyatt submits the email response; deadline 11:59pm EDT Sun Aug 9.
