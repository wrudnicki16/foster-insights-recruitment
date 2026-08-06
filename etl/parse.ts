export interface Csv {
  header: string[];
  rows: string[][];
}

// The raw CSVs contain no quoted fields or embedded commas, so a plain
// split is safe; the width check catches any violation of that assumption.
export function parseCsv(text: string): Csv {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = lines[0].split(",");
  const rows = lines.slice(1).map((line, i) => {
    const cells = line.split(",");
    if (cells.length !== header.length) {
      throw new Error(`Row ${i + 2}: expected ${header.length} cells, got ${cells.length}`);
    }
    return cells;
  });
  return { header, rows };
}

export function parseDate(s: string): Date | null {
  if (s === "NA" || s === "") return null;
  const parts = s.split("/");
  if (parts.length !== 3) throw new Error(`Bad date: ${s}`);
  const [mo, d, y] = parts.map(Number);
  return new Date(Date.UTC(2000 + y, mo - 1, d));
}

export function requireDate(s: string, ctx: string): Date {
  const d = parseDate(s);
  if (d === null) throw new Error(`Missing required date (${ctx})`);
  return d;
}

export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function wholeYearsBetween(a: Date, b: Date): number {
  let years = b.getUTCFullYear() - a.getUTCFullYear();
  const anniversary = new Date(Date.UTC(a.getUTCFullYear() + years, a.getUTCMonth(), a.getUTCDate()));
  if (anniversary.getTime() > b.getTime()) years -= 1;
  return years;
}

export function normalizeCounty(raw: string): string {
  const name = raw.trim();
  return name === "Vermillion" ? "Vermilion" : name;
}

export function mapKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
