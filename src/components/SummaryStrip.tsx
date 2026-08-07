interface Props {
  childCount: number;
  homes: number;
  oocPct: string;
  label: string;
}

export default function SummaryStrip({ childCount, homes, oocPct, label }: Props) {
  const items = [
    { value: childCount.toLocaleString(), text: `children in care (${label})` },
    { value: homes.toLocaleString(), text: "active licensed homes accepting these ages" },
    { value: oocPct, text: "of foster placements are outside the child's county" },
  ];
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.text} className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-sm text-slate-500">{item.text}</dt>
          <dd className="text-2xl font-semibold text-slate-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
