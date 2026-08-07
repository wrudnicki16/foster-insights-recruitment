import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
import type { FeatureCollection } from "geojson";

// topojson-specification is not installed; use any casts for the build script
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const topo = JSON.parse(readFileSync("node_modules/us-atlas/counties-10m.json", "utf8")) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const counties = feature(topo, topo.objects.counties as any) as unknown as FeatureCollection;
const il = counties.features.filter((f) => String(f.id).length === 5 && String(f.id).slice(0, 2) === "17");
writeFileSync("src/lib/il-counties.json", JSON.stringify({ type: "FeatureCollection", features: il }));
console.log(`Wrote ${il.length} Illinois county features`);
