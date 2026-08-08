import { geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection } from "geojson";
import il from "@/lib/il-counties.json";

const WIDTH = 80;
const HEIGHT = 104; // keeps the 480:620 Illinois aspect

function key(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

interface Props {
  highlightNames: string[];
  highlightFill?: string;
  secondaryNames?: string[];
  secondaryFill?: string;
  width?: number;
  height?: number;
  ariaLabel: string;
}

export default function CountyMinimap({
  highlightNames,
  highlightFill = "#94a3b8",
  secondaryNames = [],
  secondaryFill = "#94a3b8",
  width = WIDTH,
  height = HEIGHT,
  ariaLabel,
}: Props) {
  const geo = il as unknown as FeatureCollection;
  const path = geoPath(geoMercator().fitSize([WIDTH, HEIGHT], geo));
  const targets = new Set(highlightNames.map(key));
  const secondaryTargets = new Set(secondaryNames.map(key));
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{ width, height }}
      className="h-auto shrink-0"
      role="img"
      aria-label={ariaLabel}
    >
      {geo.features.map((f) => {
        const fname = (f.properties as { name: string }).name;
        const fkey = key(fname);
        const isTarget = targets.has(fkey);
        const isSecondary = !isTarget && secondaryTargets.has(fkey);
        const fill = isTarget ? highlightFill : isSecondary ? secondaryFill : "#f1f5f9";
        const stroke = isTarget ? highlightFill : isSecondary ? secondaryFill : "#cbd5e1";
        return (
          <path key={fname} d={path(f) ?? undefined} fill={fill} stroke={stroke} strokeWidth={0.5} />
        );
      })}
    </svg>
  );
}
