import { AGES, AgeSelection, Band } from "./types";

export const BAND_VALUES: Band[] = ["0-5", "6-12", "13-17"];

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
