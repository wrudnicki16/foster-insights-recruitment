# Illinois Foster Home Recruitment Planner

A dashboard for Illinois DCFS staff answering two questions: **where should we recruit
foster homes, and for which ages?** Built for the Foster Insights full-stack task.

**Live site:** https://foster-insights-recruitment.vercel.app

## What it shows

- **Statewide view** — a top-gaps strip naming the five most under-served
  county × age-band combinations (each card links to that county pre-filtered),
  above an Illinois county map and ranked table showing recruitment pressure
  (children in care per age-compatible licensed home), filterable by age band or
  exact age, with a plain-language reason per county, a category filter over those
  reasons, and table-to-map hover highlighting.
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
