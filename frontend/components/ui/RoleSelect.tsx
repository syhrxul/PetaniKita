"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Sprout, Store } from "lucide-react";

interface Props {
  value: string;
  onChange: (val: string) => void;
}

export default function RoleSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const options = [
    {
      id: "PETANI",
      title: "PETANI (Produsen Panen)",
      desc: "Penjual hasil tani langsung dari ladang",
      icon: Sprout,
    },
    {
      id: "UMKM",
      title: "UMKM KULINER (Pembeli Bahan)",
      desc: "Restoran, warung, atau pengolah bahan baku",
      icon: Store,
    },
  ];

  const selected = options.find((o) => o.id === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const SelectedIcon = selected.icon;

  return (
    <div className="space-y-1.5 relative" ref={containerRef}>
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-800">
        PERAN / ROLE <span className="text-emerald-600">*</span>
      </label>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-300 hover:border-emerald-600 text-slate-900 text-xs rounded-xl p-3.5 flex items-center justify-between transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200">
            <SelectedIcon className="w-4 h-4" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-slate-900">{selected.title}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          strokeWidth={2.5}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100">
          {options.map((opt) => {
            const Icon = opt.icon;
            const isSelected = opt.id === value;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                className={`w-full text-left p-3.5 text-xs flex items-center justify-between transition-colors ${
                  isSelected ? "bg-emerald-50 text-emerald-900 font-bold" : "hover:bg-slate-50 text-slate-700"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl mt-0.5 ${isSelected ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <Icon className="w-4 h-4" strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{opt.title}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-emerald-600" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
