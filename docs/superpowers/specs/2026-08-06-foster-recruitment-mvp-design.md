# Foster Home Recruitment MVP — Design

**Date:** 2026-08-06
**Deadline:** submission by 11:59pm EDT Sunday, Aug 9, 2026 (site + GitHub repo frozen after that)
**Task:** Foster Insights Full Stack Engineer take-home — build a web app for Illinois DCFS staff (not data experts) focused on foster home **recruitment**.

## Goal

Give DCFS staff a tool that answers two questions:

1. **Where should we recruit foster homes, and for which ages?** (statewide prioritization)
2. **What is the situation in a specific county, and what action should we take?** (county diagnosis + campaign brief)

Success criteria: useful to a non-data-expert; strong visual design that serves function; every product and technical decision explainable in a follow-up interview.

## Users & framing

- DCFS recruitment staff. They know the child-welfare system; they lack data visibility.
- The app must never overstate what the data supports. Terminology guardrails:
  - Say "homes accepting this age" / "potentially age-compatible homes" — never "available homes," "open beds," or "exact home shortage."
  - The age-compatibility view carries a visible caveat: it measures age compatibility, not vacancies or willingness to accept a specific child.
  - "Out-of-county placement" is a pressure signal, not labeled "adverse" (an out-of-county placement can be appropriate, e.g. kin).
- No opaque composite scores. Every ranking is a transparent metric plus a plain-language reason.

## Scope

### In scope (MVP)

1. **Statewide Recruitment Priorities page** (`/`)
   - Shared age control: `All ages · 0–5 · 6–12 · 13–17` + "Exact age…" dropdown (0–17). Drives everything on the page. Selection stored in URL (`?age=13-17`, `?age=16`) so links are shareable and state persists across navigation. Children still in care at age 18+ (possible, since `most_recent_age` advances over time) appear in "All ages" and in the age-by-age chart, but not in the exact-age selector — provider preferences cap at 18 and recruitment targets the 0–17 pipeline.
   - Illinois county choropleth shaded by recruitment pressure for the selected age(s); click → county page.
   - Ranked county table: children in care, age-compatible active homes, pressure ratio, out-of-county foster placement rate, one-line plain-language reason. Sortable; default sort by pressure.
   - Statewide summary strip: total children in care, active licensed homes, statewide out-of-county rate.
2. **County Detail page** (`/county/[slug]`)
   - Age-by-age compatibility chart (children in care at each age vs. homes accepting that age) — the centerpiece.
   - Recruit-vs-reactivate diagnostic (2×2 verdict, thresholds shown transparently).
   - Out-of-county placement panel (rate + destination counties).
   - Monthly trends: new licenses vs. removals (secondary).
   - Campaign brief generator: copyable/printable brief from a deterministic template filled with the county's metrics (target ages, children represented, local-placement pressure, desired provider profile, suggested outreach message). No LLM, no API keys — reproducible and defensible.

### Out of scope (documented, deliberate)

- Scenario planner (highest complexity, least necessary for the recruitment story under the deadline)
- Retention product (activity % appears only as diagnostic context)
- Individual-provider outreach prompts / "too restrictive preferences" flags (aggregate gaps only)
- Behavioral/medical-needs matching (no supporting data; the app states this limitation rather than proxying it)
- Applicant CRM, ad-audience targeting, campaign conversion tracking
- Embedding external tools via iframes (nothing external fits the data better than purpose-built views)

## Metric definitions

**Snapshot date:** July 1, 2026 (end of the data window). "Currently" always means as-of this date.

1. **Children in care (county × age):** `child_level` rows with `discharge_date = NA`. County = `removal_county` (recruitment demand originates in the child's home county). Age = `most_recent_age`.
2. **Active licensed home:** `license_start_date ≤ snapshot ≤ license_end_date`. County = `county_provider`. Expired licenses are excluded from current capacity but included in trends and activity history.
3. **Age-compatible home (age a):** active home with `min_age ≤ a ≤ max_age`. For an age band: home accepts ≥ 1 age in the band, labeled in the UI as "homes accepting any age in this range." The county page's age-by-age chart exposes within-band gaps.
4. **Pressure ratio:** children in care ÷ age-compatible active homes. Edge cases: 0 homes with > 0 children → rendered "no compatible homes," sorts above all finite ratios; 0 children → 0.
5. **Out-of-county foster placement rate (county × age):** among `resource_type = foster_home` placements for children removed from county X, the share with `placement_county ≠ removal_county`. Age-filterable via derived **age at placement start** = `age_at_removal` + whole years elapsed from `removal_date` to `placement_start_date`. Kin and nonfamily placements are excluded (recruitment concerns licensed foster homes).
6. **Home activity % (county):** `Σ n_days_active ÷ Σ n_days_licensed` across all county providers in the window — day-weighted, matching the task's note that capacity is placement-days, not unique children.
7. **Recruit-vs-reactivate diagnostic:** pressure vs. statewide median × activity % vs. statewide median →
   | Supply pressure | Activity | Verdict |
   |---|---|---|
   | High | High | Recruit additional homes |
   | High | Low | Recruit + investigate inactive licensed homes |
   | Low | Low | Investigate existing-home activity |
   | Low | High | Recruitment pressure comparatively low |
   plus, when both signals are near median: "In line with statewide patterns — no county-specific signal stands out." All verdicts are explicitly comparative, never absolute — a median county in a system-wide shortage still has a problem, so the diagnostic card always displays the statewide baselines it compares against and carries a one-line caveat that comparisons are relative to statewide levels, which may themselves reflect shortage. The verdict and the plain-language reason are **pure functions evaluated at render time for the current age selection** (pressure medians are computed across counties for that selection; activity % is age-independent). Both functions live in shared lib code and are unit-tested. Thresholds are displayed in the UI (e.g. "42% vs. statewide 61%").
8. **Plain-language reason (per county):** template assembled from which signals are elevated (e.g. top-quartile pressure for the selected ages, top-quartile out-of-county rate, low activity).
9. **Trends:** monthly counts of new licenses (`license_start_date`) and removals (`removal_date`), per county and statewide.

### Data decisions

- **`Vermillion` → `Vermilion` merge.** Illinois has exactly 102 counties; the datasets contain 103 spellings. The merge is required for the GeoJSON map join and is documented in DECISIONS.md as a normalization (not "cleaning," which the task says is unnecessary).
- **NA ages** (6 children): included in "All ages" counts, excluded from age-specific views, footnoted in the UI.
- Raw CSVs are committed to the repo (synthetic mirror data) so the build is reproducible for reviewers.

## Architecture

**Build-time ETL → static JSON. No database.**

Rationale: the dataset is a fixed extract (Jan 2022 – Jul 2026); after aggregation the entire app payload is a few hundred KB. A runtime database adds deploy risk and zero functional value. The ETL boundary is where a live feed would slot in later — this is the interview answer, not a concession.

- **Stack:** Next.js (App Router) + TypeScript + Tailwind CSS. Recharts for charts (accessibility layer enabled). `react-simple-maps` + US-atlas TopoJSON for the Illinois choropleth. Vitest for tests. GitHub + Vercel.
- **ETL (`etl/`):** pure, individually-testable metric functions + a runner (`npm run etl`). Reads `data/raw/*.csv`, writes `data/derived/`:
  - `counties.json` — per county: children-by-age, compatible-homes-by-age, out-of-county-by-age, top out-of-county destination counties (all ages), activity %, monthly trends
  - `statewide.json` — statewide aggregates and trend series
  - `meta.json` — snapshot date, statewide medians/quartiles used as thresholds
  - Derived JSON is committed, so deploys never depend on the pipeline running; reviewers can regenerate and diff.
- **App:** server components read derived JSON; all age-filter interactivity is client-side selection over the small precomputed matrices (103 counties × 18 ages).
- **Components:** `AgeFilter`, `ChoroplethMap`, `CountyTable`, `SummaryStrip`, `AgeCompatibilityChart`, `DiagnosticCard`, `OutOfCountyPanel`, `TrendsChart`, `CampaignBrief`.
- **Routing:** `/` and `/county/[slug]` with kebab-case slugs (`st-clair`, `jo-daviess`, `dekalb`).

## Error handling

- Unknown county slug → 404 page with a link back to the statewide view.
- Zero-compatible-homes handled in the ETL as an explicit state (never `Infinity`/`NaN` in the UI).
- Counties with no data for a metric render neutral map fill and an em-dash in tables.
- Color scale is colorblind-safe with numeric labels; the ranked table is the accessible equivalent of the map; Recharts accessibility layer on; semantic HTML throughout.

## Testing

- **Vitest unit tests for every metric function**, written TDD-style against small fixtures (e.g. a 3-provider / 4-child / 6-placement mini-dataset with hand-computed answers).
- **Reconciliation checks:** county sums equal statewide totals; ETL row counts match raw file row counts; every county in the output joins to a map feature.
- UI verified against a manual checklist (both pages × age selections × edge counties). No browser-automation suite within the deadline budget.

## Deliverables

1. Deployed app on Vercel (reviewer-accessible URL)
2. GitHub repo: source, ETL, raw + derived data, tests
3. `README.md` — what/why/how to run
4. `DECISIONS.md` — running log of product and technical decisions with rationale (interview prep artifact)

## Process notes

- Work split: Claude implements from the approved plan; Wyatt makes every product/architecture decision at checkpoints and reviews each chunk. DECISIONS.md is updated as decisions are made, not retroactively.
