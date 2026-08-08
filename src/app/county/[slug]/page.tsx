import Link from "next/link";
import { notFound } from "next/navigation";
import AgeCompatibilityChart from "@/components/AgeCompatibilityChart";
import AgeFilter from "@/components/AgeFilter";
import CampaignBrief from "@/components/CampaignBrief";
import CountyMinimap from "@/components/CountyMinimap";
import DiagnosticCard from "@/components/DiagnosticCard";
import OutOfCountyPanel from "@/components/OutOfCountyPanel";
import TrendsChart from "@/components/TrendsChart";
import { countyBySlug, getCounties, getMeta } from "@/lib/data";
import { briefFor } from "@/lib/brief";
import { ageParamValue, agesFor, parseAgeParam, selectionLabel } from "@/lib/selection";
import { childrenFor, homesFor, oocRateFor } from "@/lib/stats";
import { AGES } from "@/lib/types";
import { verdictFor } from "@/lib/verdict";

export function generateStaticParams() {
  return getCounties().map((c) => ({ slug: c.slug }));
}

export default async function CountyPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ age?: string }>;
}) {
  const { slug } = await params;
  const { age } = await searchParams;
  const county = countyBySlug(slug);
  if (!county) notFound();

  const sel = parseAgeParam(age);
  const counties = getCounties();
  const meta = getMeta();
  const label = selectionLabel(sel).toLowerCase();

  const chartData = AGES.map((a) => ({
    age: a,
    children: county.childrenByAge[a],
    homes: county.homesByAge[a],
  }));

  const trendData = meta.months.map((month) => ({
    month,
    licenses: county.newLicensesByMonth[month] ?? 0,
    removals: month === "2022-01" ? null : county.removalsByMonth[month] ?? 0,
  }));

  const ooc = oocRateFor(county, sel);

  return (
    <div className="space-y-6">
      <nav className="no-print text-sm">
        <Link href="/" className="text-blue-700 hover:underline">← All counties</Link>
      </nav>
      <section className="flex items-start gap-8">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold">{county.name} County</h1>
          <AgeFilter />
          <p className="text-sm text-slate-600">
            {childrenFor(county, sel).toLocaleString()} children in care ({label}) ·{" "}
            {homesFor(county, sel).toLocaleString()} active licensed homes accepting these ages
          </p>
        </div>
        <div className="hidden sm:block">
          <CountyMinimap
            highlightNames={[county.name]}
            ariaLabel={`Location of ${county.name} County in Illinois`}
          />
        </div>
      </section>
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-lg font-semibold">Children vs. homes accepting each age</h2>
            <AgeCompatibilityChart
              data={chartData}
              highlightAges={agesFor(sel)}
              ageParam={ageParamValue(sel)}
            />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-lg font-semibold">Licensing vs. removals</h2>
            <TrendsChart data={trendData} />
          </div>
        </div>
        <div className="space-y-6">
          <DiagnosticCard verdict={verdictFor(county, counties, sel)} label={label} />
          <OutOfCountyPanel
            ratePct={ooc === null ? "—" : `${(ooc * 100).toFixed(0)}%`}
            label={label}
            destinations={county.destinations}
            ageParam={ageParamValue(sel)}
            countyName={county.name}
          />
        </div>
      </section>
      <section>
        <CampaignBrief brief={briefFor(county, counties, sel)} />
      </section>
    </div>
  );
}
