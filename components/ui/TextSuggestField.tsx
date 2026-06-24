"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  suggestions: string[];
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Free-text input with substring-filtered suggestions from a string list.
 * Unlike AutocompleteField, the stored value IS the typed text (no ID mapping).
 */
export default function TextSuggestField({
  suggestions,
  value,
  onChange,
  placeholder = "Escribir…",
  disabled = false,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = value.trim()
    ? suggestions.filter((s) =>
        s.toLowerCase().includes(value.trim().toLowerCase())
      )
    : suggestions;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setActiveIdx(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleBlur() {
    setOpen(false);
    setActiveIdx(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActiveIdx(0); }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if ((e.key === "Enter" || e.key === "Tab") && activeIdx >= 0) {
      e.preventDefault();
      onChange(filtered[activeIdx]);
      setOpen(false);
      setActiveIdx(-1);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIdx(-1);
    }
  }

  useEffect(() => {
    if (open && activeIdx >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll<HTMLElement>("[data-opt]");
      items[activeIdx]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIdx, open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActiveIdx(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors ${
          disabled ? "bg-gray-50 text-gray-400 cursor-not-allowed" : "bg-white"
        }`}
      />
      {open && !disabled && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto py-1"
        >
          {filtered.map((s, idx) => (
            <li
              key={s}
              data-opt
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s);
                setOpen(false);
                setActiveIdx(-1);
              }}
              className={`px-3 py-2 text-sm cursor-pointer select-none ${
                idx === activeIdx
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
