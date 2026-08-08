"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Bar, CartesianGrid, ComposedChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

interface Props {
  data: { age: number; children: number; homes: number }[];
  highlightAges: number[];
  ageParam: string;
}

export default function AgeCompatibilityChart({ data, highlightAges, ageParam }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const highlightAll = highlightAges.length === 18;

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="age" label={{ value: "Age", position: "insideBottom", offset: -2 }} />
          <YAxis allowDecimals={false} />
          <Tooltip
            formatter={(value, name) => [value, name]}
            labelFormatter={(age) => `Age ${age}`}
          />
          <Legend />
          <Bar
            name="Children in care"
            dataKey="children"
            fill="#1d4ed8"
            fillOpacity={highlightAll ? 1 : 0.35}
            onClick={(_, index) => router.push(`${pathname}?age=${data[index].age}`)}
            className="cursor-pointer"
          />
          <Bar
            name="Homes accepting this age"
            dataKey="homes"
            fill="#f59e0b"
            fillOpacity={highlightAll ? 1 : 0.35}
            onClick={(_, index) => router.push(`${pathname}?age=${data[index].age}`)}
            className="cursor-pointer"
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-1 text-xs text-slate-500">
        Compares children currently in care at each age with licensed homes whose age preferences
        include that age. This measures age compatibility, not vacancies or beds. Click a bar to
        filter the page to that exact age{ageParam !== "all" ? "; use the All ages button to reset" : ""}.
      </p>
    </div>
  );
}
