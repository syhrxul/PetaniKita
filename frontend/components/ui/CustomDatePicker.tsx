"use client";

import React from "react";
import { Calendar, Clock, Sparkles } from "lucide-react";

interface CustomDatePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "date" | "datetime-local";
  helperText?: string;
  required?: boolean;
}

export default function CustomDatePicker({
  label,
  value,
  onChange,
  type = "date",
  helperText,
  required = false,
}: CustomDatePickerProps) {
  return (
    <div className="space-y-1.5 w-full min-w-0">
      {/* Header Label & Badge */}
      <div className="flex justify-between items-center flex-wrap gap-1">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 truncate">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        {type === "datetime-local" && (
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 shrink-0">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            Auto-WIB
          </span>
        )}
      </div>

      <div className="relative w-full min-w-0 group">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 bg-emerald-100 text-emerald-700 rounded-lg group-focus-within:bg-emerald-600 group-focus-within:text-white transition-colors z-10 pointer-events-none shrink-0">
          {type === "date" ? <Calendar className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
        </div>

        <input
          type={type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full box-border min-w-0 appearance-none text-xs font-semibold pl-11 pr-3 py-3 bg-slate-50 border border-slate-300 hover:border-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 text-slate-900 rounded-xl transition-all outline-none cursor-pointer"
        />
      </div>

      {/* Helper Text */}
      {helperText && (
        <p className="text-[10px] text-slate-500 font-medium pl-0.5 leading-tight">{helperText}</p>
      )}
    </div>
  );
}
