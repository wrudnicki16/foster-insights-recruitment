// src/lib/types.ts
export const AGES: number[] = Array.from({ length: 18 }, (_, i) => i);
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
