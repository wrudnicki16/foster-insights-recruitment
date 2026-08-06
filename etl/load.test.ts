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
