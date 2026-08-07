import { selectionLabel } from "./selection";
import { childrenFor, homesFor, oocRateFor } from "./stats";
import { AgeSelection, CountyData } from "./types";
import { verdictFor } from "./verdict";

export interface Brief {
  title: string;
  lines: { label: string; value: string }[];
  message: string;
  caveat: string;
}

function agePhrase(sel: AgeSelection): string {
  if (sel.kind === "band") return `ages ${sel.band.replace("-", "–")}`;
  if (sel.kind === "age") return `${sel.age}-year-olds`;
  return "children of all ages";
}

export function briefFor(c: CountyData, all: CountyData[], sel: AgeSelection): Brief {
  const children = childrenFor(c, sel);
  const homes = homesFor(c, sel);
  const ooc = oocRateFor(c, sel);
  const verdict = verdictFor(c, all, sel);
  const ages = agePhrase(sel);

  const oocSentence =
    ooc !== null && ooc >= 0.5
      ? ` Emphasize the need for local homes: most foster placements for these children are currently outside the county, away from their schools and communities.`
      : ooc !== null
        ? ` Local homes help children stay connected to their schools and communities; ${(ooc * 100).toFixed(0)}% of foster placements for these children are currently outside the county.`
        : "";

  const message =
    `Focus outreach on adults in ${c.name} County prepared to foster ${ages}. ` +
    `The county currently has ${children} children in care (${selectionLabel(sel).toLowerCase()}) and ` +
    `${homes} licensed homes accepting ${sel.kind === "all" ? "placements" : "these ages"}.` +
    oocSentence;

  return {
    title: `${c.name} County recruitment brief — ${selectionLabel(sel)}`,
    lines: [
      { label: "Target county", value: `${c.name} County` },
      { label: "Priority ages", value: selectionLabel(sel) },
      { label: "Children in care", value: String(children) },
      { label: "Homes accepting these ages", value: String(homes) },
      { label: "Out-of-county foster placement rate", value: ooc === null ? "—" : `${(ooc * 100).toFixed(0)}%` },
      { label: "Recommended focus", value: verdict.headline },
    ],
    message,
    caveat: "Home counts reflect age compatibility, not current vacancies or willingness to accept a specific child.",
  };
}
