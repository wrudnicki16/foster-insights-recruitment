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
