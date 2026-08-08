import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold">County not found</h1>
      <p className="mt-2 text-sm text-slate-600">
        That county isn&apos;t in the dataset.
      </p>
      <Link href="/" className="mt-4 inline-block text-blue-700 hover:underline">
        ← Back to all counties
      </Link>
    </div>
  );
}
