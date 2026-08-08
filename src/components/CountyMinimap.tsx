import { geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection } from "geojson";
import il from "@/lib/il-counties.json";

const WIDTH = 80;
const HEIGHT = 104; // keeps the 480:620 Illinois aspect

function key(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

export default function CountyMinimap({ name }: { name: string }) {
  const geo = il as unknown as FeatureCollection;
  const path = geoPath(geoMercator().fitSize([WIDTH, HEIGHT], geo));
  const target = key(name);
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-[104px] w-[80px] shrink-0"
      role="img"
      aria-label={`Location of ${name} County in Illinois`}
    >
      {geo.features.map((f) => {
        const fname = (f.properties as { name: string }).name;
        const isTarget = key(fname) === target;
        return (
          <path
            key={fname}
            d={path(f) ?? undefined}
            fill={isTarget ? "#1d4ed8" : "#f1f5f9"}
            stroke={isTarget ? "#1d4ed8" : "#cbd5e1"}
            strokeWidth={0.5}
          />
        );
      })}
    </svg>
  );
}
