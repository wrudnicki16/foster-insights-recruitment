"use client";

import { useState } from "react";
import type { Brief } from "@/lib/brief";

export default function CampaignBrief({ brief }: { brief: Brief }) {
  const [copied, setCopied] = useState(false);

  const plainText = [
    brief.title,
    "",
    ...brief.lines.map((l) => `${l.label}: ${l.value}`),
    "",
    brief.message,
    "",
    `Note: ${brief.caveat}`,
  ].join("\n");

  async function copy() {
    await navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="print-brief rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold">{brief.title}</h2>
        <div className="no-print flex gap-2">
          <button onClick={copy} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            {copied ? "Copied ✓" : "Copy"}
          </button>
          <button onClick={() => window.print()} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            Print
          </button>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
        {brief.lines.map((l) => (
          <div key={l.label} className="flex justify-between gap-4 border-b border-slate-100 pb-1 text-sm">
            <dt className="text-slate-500">{l.label}</dt>
            <dd className="text-right font-medium text-slate-900">{l.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm leading-relaxed text-slate-800">{brief.message}</p>
      <p className="mt-3 text-xs text-slate-500">Note: {brief.caveat}</p>
    </div>
  );
}
