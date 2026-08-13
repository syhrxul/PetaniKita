import React from "react";
import { Sprout } from "lucide-react";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "light" | "dark";
}

const ICON_SIZES = { sm: "w-4 h-4", md: "w-5 h-5", lg: "w-6 h-6" } as const;
const BADGE_SIZES = { sm: "p-1.5 rounded-xl", md: "p-2 rounded-2xl", lg: "p-2.5 rounded-2xl" } as const;
const TEXT_SIZES = { sm: "text-base", md: "text-xl", lg: "text-2xl" } as const;

export default function Logo({
  className = "",
  showText = true,
  size = "md",
  variant = "dark",
}: LogoProps) {
  const titleColor = variant === "dark" ? "text-white" : "text-slate-900";
  const subColor = variant === "dark" ? "text-slate-400" : "text-slate-500";

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className={`bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md shadow-emerald-900/30 flex items-center justify-center border border-emerald-400/30 ${BADGE_SIZES[size]}`}
      >
        <Sprout className={ICON_SIZES[size]} strokeWidth={2.5} aria-hidden="true" />
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`font-black tracking-tight ${titleColor} ${TEXT_SIZES[size]}`}>
            Petani<span className="text-emerald-500">Kita</span>
          </span>
          <span className={`text-[9px] font-bold tracking-widest uppercase mt-0.5 ${subColor}`}>
            P2P Supply Chain
          </span>
        </div>
      )}
    </div>
  );
}
