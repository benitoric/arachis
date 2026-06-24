"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";

export interface ACOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface Props {
  options: ACOption[];
  value: string; // selected ID, "" = none
  onChange: (id: string) => void;
  placeholder?: string;
  onCreateNew?: () => void;
  createNewLabel?: string; // e.g. "cliente", "artículo"
  disabled?: boolean;
  className?: string;
}

export default function AutocompleteField({
  options,
  value,
  onChange,
  placeholder = "Buscar o seleccionar…",
  onCreateNew,
  createNewLabel = "elemento",
  disabled = false,
  className = "",
}: Props) {
  const [text, setText] = useState(() => options.find((o) => o.id === value)?.label ?? "");
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Refs so the click-outside handler always sees the latest values
  const valueRef = useRef(value);
  valueRef.current = value;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const searchingRef = useRef(searching);
  searchingRef.current = searching;

  // Sync displayed text when value or options change externally (e.g. data load in edit mode)
  useEffect(() => {
    if (!searchingRef.current) {
      setText(optionsRef.current.find((o) => o.id === value)?.label ?? "");
    }
  }, [value, options]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtered options: show all when not searching, filter by text otherwise
  const visible = searching && text.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(text.trim().toLowerCase()) ||
          (o.sublabel?.toLowerCase().includes(text.trim().toLowerCase()) ?? false)
      )
    : options;

  const totalCount = visible.length + (onCreateNew ? 1 : 0);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        const lbl = optionsRef.current.find((o) => o.id === valueRef.current)?.label ?? "";
        setOpen(false);
        setActiveIdx(-1);
        setSearching(false);
        setText(lbl);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setText(e.target.value);
    setSearching(true);
    onChange(""); // clear selection while typing
    setOpen(true);
    setActiveIdx(-1);
  }

  function handleFocus() {
    setOpen(true);
    setSearching(false); // show all on initial focus
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function select(opt: ACOption) {
    onChange(opt.id);
    setText(opt.label);
    setOpen(false);
    setSearching(false);
    setActiveIdx(-1);
  }

  function handleClear(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onChange("");
    setText("");
    setSearching(false);
    setOpen(false);
    setTimeout(() => inputRef.current?.focus(), 10);
  }

  function handleBlur() {
    // Close dropdown when focus leaves the input.
    // Clicking list items won't trigger this because their onMouseDown uses
    // e.preventDefault() which keeps focus on the input.
    setOpen(false);
    setActiveIdx(-1);
    setSearching(false);
    const lbl = optionsRef.current.find((o) => o.id === valueRef.current)?.label ?? "";
    setText(lbl);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      const lbl = optionsRef.current.find((o) => o.id === valueRef.current)?.label ?? "";
      setOpen(false);
      setActiveIdx(-1);
      setSearching(false);
      setText(lbl);
      return;
    }
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setOpen(true);
        setActiveIdx(0);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, totalCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || (e.key === "Tab" && activeIdx >= 0)) {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < visible.length) {
        select(visible[activeIdx]);
      } else if (activeIdx === visible.length && onCreateNew) {
        setOpen(false);
        onCreateNew();
      }
    }
  }

  // Scroll active option into view
  useEffect(() => {
    if (open && activeIdx >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll<HTMLElement>("[data-opt]");
      items[activeIdx]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIdx, open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          className={`w-full border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors ${
            disabled ? "bg-gray-50 text-gray-400 cursor-not-allowed" : "bg-white"
          }`}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
          {value && !disabled ? (
            <button
              type="button"
              onMouseDown={handleClear}
              tabIndex={-1}
              className="text-gray-300 hover:text-gray-500 transition-colors"
            >
              <X size={13} />
            </button>
          ) : (
            <ChevronDown size={14} className="text-gray-400 pointer-events-none" />
          )}
        </div>
      </div>

      {open && !disabled && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto py-1"
        >
          {visible.length === 0 && !onCreateNew && (
            <li className="px-3 py-2 text-sm text-gray-400 italic">Sin resultados</li>
          )}
          {visible.map((opt, idx) => (
            <li
              key={opt.id}
              data-opt
              onMouseDown={(e) => { e.preventDefault(); select(opt); }}
              className={`px-3 py-2 text-sm cursor-pointer select-none ${
                idx === activeIdx
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span>{opt.label}</span>
              {opt.sublabel && (
                <span className="ml-2 text-xs text-gray-400">{opt.sublabel}</span>
              )}
            </li>
          ))}
          {onCreateNew && (
            <li
              data-opt
              onMouseDown={(e) => {
                e.preventDefault();
                setOpen(false);
                onCreateNew();
              }}
              className={`px-3 py-2 text-sm cursor-pointer select-none font-medium border-t border-gray-100 mt-0.5 ${
                activeIdx === visible.length
                  ? "bg-blue-50 text-blue-700"
                  : "text-blue-600 hover:bg-blue-50"
              }`}
            >
              + Crear nuevo {createNewLabel}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
