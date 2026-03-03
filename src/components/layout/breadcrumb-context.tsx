"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbContextValue {
  items: BreadcrumbItem[];
  setBreadcrumbs: (items: BreadcrumbItem[]) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BreadcrumbItem[]>([]);

  const setBreadcrumbs = useCallback((newItems: BreadcrumbItem[]) => {
    setItems(newItems);
  }, []);

  return (
    <BreadcrumbContext.Provider value={{ items, setBreadcrumbs }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbs() {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) throw new Error("useBreadcrumbs must be used within BreadcrumbProvider");
  return ctx;
}

/**
 * Renders nothing visible — sets breadcrumbs on mount, clears on unmount.
 * Safe to render inside server components (only serializable props).
 */
export function SetBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs(items);
    return () => setBreadcrumbs([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(items), setBreadcrumbs]);

  return null;
}
