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
