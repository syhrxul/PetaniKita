"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  label: string;
  value: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface Props {
  options: SelectOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  required?: boolean;
}

export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Pilih Opsi",
  label,
  disabled = false,
  required = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function pick(val: string) {
    onChange(val);
    setOpen(false);
    setActiveIndex(-1);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;

    if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(Math.max(0, options.findIndex(o => o.value === value)));
        return;
      }
      const dir = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex(i => (i + dir + options.length) % options.length);
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && open && activeIndex >= 0) {
      e.preventDefault();
      pick(options[activeIndex].value);
    }
  }

  return (
    <div className="space-y-1.5 relative" ref={containerRef}>
      {label && (
        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
          {label} {required && <span className="text-rose-600">*</span>}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label || placeholder}
        className={`w-full bg-white border-2 text-slate-900 text-sm rounded-xl px-4 py-3 flex items-center justify-between gap-2 transition shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
          disabled
            ? "border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed"
            : open
            ? "border-emerald-600"
            : "border-slate-300 hover:border-emerald-500"
        }`}
      >
        <span className="font-semibold truncate flex items-center gap-2">
          {selected ? (
            <>
              {selected.icon && <selected.icon className="w-4 h-4 text-emerald-600" />}
              {selected.label}
            </>
          ) : (
            <span className="text-slate-500 font-normal">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto"
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isActive = idx === activeIndex;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => pick(opt.value)}
                className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between gap-2 transition ${
                  isSelected
                    ? "bg-emerald-50 text-emerald-900 font-bold"
                    : isActive
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {Icon && <Icon className="w-4 h-4 text-emerald-600 shrink-0" />}
                  <div className="min-w-0">
                    <p className="truncate">{opt.label}</p>
                    {opt.description && (
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">{opt.description}</p>
                    )}
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
