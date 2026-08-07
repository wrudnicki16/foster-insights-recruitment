import { selectionLabel } from "./selection";
import {
  Pressure, activityRateFor, median, oocRateFor, pressureFor, pressureSortValue, quantile,
} from "./stats";
import { AgeSelection, CountyData } from "./types";

export type VerdictKind =
  | "recruit"
  | "recruit_investigate"
  | "investigate_activity"
  | "comparatively_low"
  | "in_line";

export interface Verdict {
  kind: VerdictKind;
  headline: string;
  detail: string;
  pressure: Pressure;
  pressureMedian: number;
  activity: number | null;
  activityMedian: number;
}

type Level = "high" | "mid" | "low";

function level(value: number, med: number): Level {
  if (!Number.isFinite(value)) return "high";
  if (med === 0) return value > 0 ? "high" : "mid";
  if (value > 1.1 * med) return "high";
  if (value < 0.9 * med) return "low";
  return "mid";
}

const HEADLINES: Record<VerdictKind, string> = {
  recruit: "Recruit additional homes",
  recruit_investigate: "Recruit — and investigate inactive licensed homes",
  investigate_activity: "Investigate existing-home activity before recruiting",
  comparatively_low: "Recruitment pressure comparatively low",
  in_line: "In line with statewide patterns — no county-specific signal stands out",
};

export function verdictFor(c: CountyData, all: CountyData[], sel: AgeSelection): Verdict {
  const values = all.map((x) => pressureSortValue(pressureFor(x, sel)));
  const pressureMedian = median(values.filter(Number.isFinite));
  const activities = all.map(activityRateFor).filter((a): a is number => a !== null);
  const activityMedian = median(activities);

  const pressure = pressureFor(c, sel);
  const p = level(pressureSortValue(pressure), pressureMedian);
  const activity = activityRateFor(c);
  const a = activity === null ? "mid" : level(activity, activityMedian);

  let kind: VerdictKind;
  if (p === "high" && a === "low") kind = "recruit_investigate";
  else if (p === "high") kind = "recruit";
  else if (a === "low") kind = "investigate_activity";
  else if (p === "low" && a === "high") kind = "comparatively_low";
  else kind = "in_line";

  const label = selectionLabel(sel).toLowerCase();
  const pressureText =
    pressure.kind === "no-homes"
      ? `${pressure.children} children (${label}) with no age-compatible active homes`
      : pressure.kind === "no-children"
        ? `no children currently in care for ${label}`
        : `${pressure.value.toFixed(1)} children per age-compatible home (statewide median ${pressureMedian.toFixed(1)})`;
  const activityText =
    activity === null
      ? "no licensed-home history to measure activity"
      : `licensed homes have had an active placement ${(activity * 100).toFixed(0)}% of licensed days (statewide median ${(activityMedian * 100).toFixed(0)}%)`;

  return {
    kind,
    headline: HEADLINES[kind],
    detail: `For ${label}: ${pressureText}; ${activityText}.`,
    pressure,
    pressureMedian,
    activity,
    activityMedian,
  };
}

export function reasonFor(c: CountyData, all: CountyData[], sel: AgeSelection): string {
  const parts: string[] = [];

  const values = all.map((x) => pressureSortValue(pressureFor(x, sel)));
  const p75 = quantile(values.filter(Number.isFinite), 0.75);
  const own = pressureSortValue(pressureFor(c, sel));
  if (own === Infinity) parts.push("no age-compatible active homes");
  else if (own > p75 && own > 0) parts.push("children per age-compatible home among the highest in the state");

  const oocValues = all.map((x) => oocRateFor(x, sel)).filter((r): r is number => r !== null);
  const ooc = oocRateFor(c, sel);
  if (ooc !== null && oocValues.length > 0 && ooc > quantile(oocValues, 0.75)) {
    parts.push("high share of foster placements outside the county");
  }

  const activities = all.map(activityRateFor).filter((a): a is number => a !== null);
  const act = activityRateFor(c);
  if (act !== null && activities.length > 0 && act < quantile(activities, 0.25)) {
    parts.push("licensed homes are often inactive");
  }

  if (parts.length === 0) return "No standout signal for this age selection.";
  const joined = parts.join("; ");
  return joined + ".";
}
