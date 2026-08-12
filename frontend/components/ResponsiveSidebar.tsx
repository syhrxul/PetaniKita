"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import { Menu, X, LogOut } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

interface Props {
  items: NavItem[];
  roleLabel: string;
  badgeLabel?: string;
  userName: string;
  userSubtitle?: string;
  onLogout: () => void;
  /** emerald = tema petani, slate = tema UMKM/admin */
  theme?: "emerald" | "slate";
}

export default function ResponsiveSidebar({
  items,
  roleLabel,
  badgeLabel,
  userName,
  userSubtitle,
  onLogout,
  theme = "slate",
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Tutup drawer saat pindah halaman
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Kunci scroll body saat drawer terbuka + tutup dengan Escape
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onEsc);
    };
  }, [mobileOpen]);

  const bg = theme === "emerald" ? "bg-emerald-950" : "bg-slate-900";
  const border = theme === "emerald" ? "border-emerald-800/40" : "border-slate-800/60";
  const hover =
    theme === "emerald" ? "hover:bg-emerald-900/50" : "hover:bg-slate-800/70";

  return (
    <>
      {/* HEADER MOBILE */}
      <header
        className={`md:hidden fixed top-0 left-0 right-0 h-16 ${bg} border-b ${border} flex items-center justify-between px-4 z-40`}
      >
        <Logo showText size="sm" variant="dark" />
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 text-slate-200 hover:text-white rounded-xl bg-white/10 hover:bg-white/20 transition"
          aria-label="Buka menu navigasi"
          aria-expanded={mobileOpen}
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* BACKDROP */}
      <div
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
        className={`md:hidden fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* SIDEBAR: fixed di desktop, off-canvas drawer di mobile */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 ${bg} border-r ${border} flex flex-col shadow-xl transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        aria-label="Navigasi utama"
      >
        {/* Branding */}
        <div className={`px-5 py-5 border-b ${border} flex items-start justify-between gap-2`}>
          <div>
            <Logo showText size="md" variant="dark" />
            {badgeLabel && (
              <div className="inline-block mt-3 px-3 py-1 bg-emerald-500/15 border border-emerald-500/40 rounded-full">
                <span className="text-[10px] font-bold text-emerald-300 tracking-wide">
                  {badgeLabel}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1.5 text-slate-300 hover:text-white rounded-lg bg-white/10"
            aria-label="Tutup menu navigasi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigasi */}
        <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
          {items.map(item => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/40"
                    : `text-slate-300 ${hover} hover:text-white`
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={2} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        {/* Profil & Logout */}
        <div className={`px-4 py-5 border-t ${border} space-y-3`}>
          <div className="bg-white/5 px-3 py-3 rounded-xl border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">
                  {(userName || "U").charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{userName || "Mitra"}</p>
                <p className="text-xs text-slate-400 truncate">{userSubtitle || roleLabel}</p>
              </div>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 hover:text-white rounded-xl font-bold text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" strokeWidth={2} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
