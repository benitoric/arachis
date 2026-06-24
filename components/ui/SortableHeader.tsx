"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { SortState } from "@/hooks/useSortableData";

interface Props {
  label: string;
  sortKey: string;
  sort: SortState;
  onSort: (key: string) => void;
  className?: string;
  align?: "left" | "right" | "center";
}

export default function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  className = "",
  align = "left",
}: Props) {
  const active = sort.key === sortKey;
  const alignClass =
    align === "right"
      ? "justify-end"
      : align === "center"
      ? "justify-center"
      : "justify-start";

  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`cursor-pointer select-none text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-4 hover:text-gray-700 transition-colors ${className}`}
    >
      <span className={`flex items-center gap-1 ${alignClass}`}>
        {label}
        {active ? (
          sort.dir === "asc" ? (
            <ChevronUp size={11} className="text-blue-500 flex-shrink-0" />
          ) : (
            <ChevronDown size={11} className="text-blue-500 flex-shrink-0" />
          )
        ) : (
          <ChevronsUpDown size={11} className="opacity-30 flex-shrink-0" />
        )}
      </span>
    </th>
  );
}
