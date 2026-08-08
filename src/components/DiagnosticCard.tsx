import type { Verdict } from "@/lib/verdict";

const TONE: Record<Verdict["kind"], string> = {
  recruit: "border-amber-300 bg-amber-50",
  recruit_investigate: "border-red-300 bg-red-50",
  investigate_activity: "border-sky-300 bg-sky-50",
  comparatively_low: "border-emerald-300 bg-emerald-50",
  in_line: "border-slate-300 bg-slate-50",
};

export default function DiagnosticCard({ verdict, label }: { verdict: Verdict; label: string }) {
  return (
    <div className={`rounded-lg border p-4 ${TONE[verdict.kind]}`}>
      <h3 className="text-sm font-medium uppercase tracking-wide text-slate-500">
        Recommended focus · {label}
      </h3>
      <p className="mt-1 text-lg font-semibold text-slate-900">{verdict.headline}</p>
      <p className="mt-2 text-sm text-slate-700">{verdict.detail}</p>
      <p className="mt-2 text-xs text-slate-500">
        Comparisons are relative to statewide levels, which may themselves reflect shortage.
      </p>
    </div>
  );
}
