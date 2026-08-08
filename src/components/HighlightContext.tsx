"use client";

import { createContext, useContext, useState } from "react";

interface Highlight {
  slug: string | null;
  setSlug: (slug: string | null) => void;
}

const HighlightContext = createContext<Highlight>({ slug: null, setSlug: () => {} });

export function HighlightProvider({ children }: { children: React.ReactNode }) {
  const [slug, setSlug] = useState<string | null>(null);
  return <HighlightContext.Provider value={{ slug, setSlug }}>{children}</HighlightContext.Provider>;
}

export function useHighlight() {
  return useContext(HighlightContext);
}
