"use client";

import { geoMercator, geoPath } from "d3-geo";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import { useHighlight } from "./HighlightContext";
import il from "@/lib/il-counties.json";

export interface MapItem {
  slug: string;
  name: string;
  value: number | null; // pressureSortValue; null = no children in care
  display: string;      // e.g. "2.3 children per home"
}

// Colorblind-safe sequential blues (ColorBrewer 5-class), plus special states.
const PALETTE = ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"];
const NO_CHILDREN = "#e5e7eb";
const NO_HOMES = "#b91c1c";

const WIDTH = 480;
const HEIGHT = 620;

function key(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

export default function ChoroplethMap({ items, ageParam, legendTitle }: {
  items: MapItem[];
  ageParam: string;
  legendTitle: string;
}) {
  const router = useRouter();
  const geo = il as unknown as FeatureCollection;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ item: MapItem; x: number; y: number } | null>(null);
  const { slug: highlightSlug, setSlug } = useHighlight();

  const path = useMemo(() => {
    const projection = geoMercator().fitSize([WIDTH, HEIGHT], geo);
    return geoPath(projection);
  }, [geo]);

  const byKey = useMemo(() => new Map(items.map((i) => [key(i.name), i])), [items]);

  const thresholds = useMemo(() => {
    const finite = items.map((i) => i.value).filter((v): v is number => v !== null && Number.isFinite(v)).sort((a, b) => a - b);
    return [0.2, 0.4, 0.6, 0.8].map((q) => finite[Math.floor(q * (finite.length - 1))]);
  }, [items]);

  function fill(value: number | null): string {
    if (value === null) return NO_CHILDREN;
    if (!Number.isFinite(value)) return NO_HOMES;
    let bucket = 0;
    while (bucket < thresholds.length && value > thresholds[bucket]) bucket++;
    return PALETTE[bucket];
  }

  function trackHover(item: MapItem, e: { clientX: number; clientY: number }) {
    const rect = wrapRef.current?.getBoundingClientRect();
    setHover({ item, x: e.clientX - (rect?.left ?? 0) + 12, y: e.clientY - (rect?.top ?? 0) + 12 });
  }

  return (
    <figure>
      <div ref={wrapRef} className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full max-w-md" role="group"
          aria-label={`Illinois county map shaded by ${legendTitle}`}>
          {geo.features.map((f) => {
            const item = byKey.get(key((f.properties as { name: string }).name));
            if (!item) return null;
            return (
              <path
                key={item.slug}
                d={path(f) ?? undefined}
                fill={fill(item.value)}
                stroke="#ffffff"
                strokeWidth={0.6}
                style={item.slug === highlightSlug ? { filter: "brightness(0.85)" } : undefined}
                tabIndex={0}
                role="link"
                aria-label={`${item.name} County: ${item.display}. Open county page.`}
                className="cursor-pointer outline-offset-2 hover:opacity-80 focus:outline focus:outline-2 focus:outline-slate-800"
                onClick={() => router.push(ageParam === "all" ? `/county/${item.slug}` : `/county/${item.slug}?age=${ageParam}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") router.push(ageParam === "all" ? `/county/${item.slug}` : `/county/${item.slug}?age=${ageParam}`);
                }}
                onMouseEnter={(e) => {
                  trackHover(item, e);
                  setSlug(item.slug);
                }}
                onMouseMove={(e) => {
                  trackHover(item, e);
                  setSlug(item.slug);
                }}
                onMouseLeave={() => {
                  setHover(null);
                  setSlug(null);
                }}
              />
            );
          })}
          {highlightSlug && (() => {
            const f = geo.features.find((ft) => byKey.get(key((ft.properties as { name: string }).name))?.slug === highlightSlug);
            return f ? (
              <path d={path(f) ?? undefined} fill="none" stroke="#0f172a" strokeWidth={1.75} pointerEvents="none" />
            ) : null;
          })()}
        </svg>
        {hover && (
          <div
            className="pointer-events-none absolute z-10 w-max max-w-[220px] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-md"
            style={{ left: hover.x, top: hover.y }}
          >
            <span className="font-semibold text-slate-900">{hover.item.name}</span>
            <span className="block text-slate-600">{hover.item.display}</span>
          </div>
        )}
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <span className="font-medium">{legendTitle}</span>
        <span className="flex items-center gap-1">
          {PALETTE.map((c) => (
            <span key={c} className="inline-block h-3 w-6" style={{ backgroundColor: c }} />
          ))}
          <span className="ml-1">low → high</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3" style={{ backgroundColor: NO_HOMES }} /> no compatible homes
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3" style={{ backgroundColor: NO_CHILDREN }} /> no children in care
        </span>
      </figcaption>
    </figure>
  );
}
