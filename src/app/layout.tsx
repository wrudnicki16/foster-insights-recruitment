import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Illinois Foster Home Recruitment Planner",
  description: "Where to recruit foster homes, and for which ages — for Illinois DCFS staff.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className={`${geistSans.variable} ${geistMono.variable} bg-slate-50 text-slate-900 antialiased`}>
        <header className="no-print border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-4">
            <Link href="/" className="text-lg font-semibold">Illinois Foster Home Recruitment Planner</Link>
            <p className="text-sm text-slate-500">
              Data snapshot: July 1, 2026 · For DCFS recruitment planning
            </p>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="no-print mx-auto max-w-6xl px-4 pb-8 text-xs text-slate-400">
          Counts reflect age compatibility of licensed homes, not current vacancies. Six children in
          the source data have no recorded age; the two currently in care are included in all-ages
          totals only. County name “Vermillion” in the source data is normalized to Vermilion.
        </footer>
      </body>
    </html>
  );
}
