"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface PortalCountContextType {
  portalCount: number;
  refreshPortalCount: () => Promise<void>;
}

const PortalCountContext = createContext<PortalCountContextType>({
  portalCount: 0,
  refreshPortalCount: async () => {},
});

export function PortalCountProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [portalCount, setPortalCount] = useState(0);

  const refreshPortalCount = useCallback(async () => {
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("origin", "portal")
      .eq("status", "pendiente");
    setPortalCount(count ?? 0);
  }, [supabase]);

  useEffect(() => {
    refreshPortalCount();
    const interval = setInterval(refreshPortalCount, 60_000);
    return () => clearInterval(interval);
  }, [refreshPortalCount]);

  return (
    <PortalCountContext.Provider value={{ portalCount, refreshPortalCount }}>
      {children}
    </PortalCountContext.Provider>
  );
}

export function usePortalCount() {
  return useContext(PortalCountContext);
}
