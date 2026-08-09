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
22. **Left-censored removal dates.** Zero removals predate the data window, and 7,904
    statewide (1,882 in Cook) are stamped January 2022 — the standing in-care
    population at window start, not real removals. The trends chart excludes 2022-01
    from the removals series with an explanatory footnote rather than letting an
    artifact flatten the real monthly signal (~150–190 statewide).
23. **Raw-file quirks handled explicitly.** The CSVs are CRLF-terminated and lack a
    trailing newline; `wc -l` undercounts them and naive last-field matching fails.
    The parser splits on `/\r?\n/` and the reconciliation tests pin the true row
    counts, which is how both quirks were caught.
24. **The statewide out-of-county tile follows the age selection**, summed from
    per-county per-age matrices. (An early build showed the all-ages aggregate
    regardless of selection — caught in user review.)
25. **Wayfinding minimaps.** County pages carry a grey locator minimap and a
    placement-pressure minimap (current county grey, top destination counties blue),
    and destination county names link to their county pages — "where is that county?"
    is answered without leaving the flow.
26. **Statewide explorer ergonomics.** The map and table headers are sticky on
    desktop; the map has an instant custom tooltip (native SVG titles are OS-delayed);
    hovering a table row highlights that county on the map; and a filter narrows the
    ranking by need category.
