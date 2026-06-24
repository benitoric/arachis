import { useState, useMemo } from "react";

export type SortDir = "asc" | "desc";

export interface SortState {
  key: string | null;
  dir: SortDir;
}

export function useSortableData<T extends Record<string, unknown>>(data: T[]) {
  const [sort, setSort] = useState<SortState>({ key: null, dir: "asc" });

  function toggleSort(key: string) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  const sorted = useMemo(() => {
    if (!sort.key) return data;
    const k = sort.key;
    return [...data].sort((a, b) => {
      const aVal = a[k];
      const bVal = b[k];
      let cmp: number;
      if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal;
      } else if (aVal == null && bVal == null) {
        cmp = 0;
      } else if (aVal == null) {
        cmp = 1;
      } else if (bVal == null) {
        cmp = -1;
      } else {
        cmp = String(aVal).localeCompare(String(bVal), "es-AR", { numeric: true });
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [data, sort]);

  return { sorted, sort, toggleSort };
}
