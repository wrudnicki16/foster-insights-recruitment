"use client";

import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export default function TrendsChart({ data }: { data: { month: string; licenses: number; removals: number }[] }) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="month" interval={11} tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line name="New licenses" type="monotone" dataKey="licenses" stroke="#0f766e" dot={false} />
          <Line name="Removals" type="monotone" dataKey="removals" stroke="#b45309" dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-1 text-xs text-slate-500">
        Monthly newly licensed homes vs. children removed into care, Jan 2022 – Jun 2026.
      </p>
    </div>
  );
}
