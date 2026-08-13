'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, usePathname } from 'next/navigation';
import { Users, Radio, Clock, MapPin, TrendingUp, LogOut, Menu, X } from 'lucide-react';

function SuperadminSidebarContent({
  onCloseMobile,
}: {
  onCloseMobile?: () => void;
}) {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') || 'USERS';

  const menuItems = [
    { key: 'AUDIT_LOGS', label: 'Audit Log Aktivitas', icon: Clock },
    { key: 'USERS', label: 'Manajemen User', icon: Users },
    { key: 'REGIONAL_PRICES', label: 'Kontrol Harga Regional', icon: TrendingUp },
    { key: 'GEOSPATIAL_RADAR', label: 'Radar Geospasial', icon: MapPin },
    { key: 'WA_BROADCAST', label: 'WA Broadcast Engine', icon: Radio },
  ];

  return (
    <div className="flex flex-col h-full justify-between p-5 space-y-6">
      <div className="space-y-6">
        {/* HEADER LOGO */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <Link
            className="flex items-center gap-3 group"
            href="/superadmin/dashboard"
            onClick={onCloseMobile}
          >
            <div className="relative w-9 h-9 shrink-0 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/60 group-hover:border-emerald-500/50 transition">
              <Image
                alt="Logo PetaniKita"
                className="w-full h-full object-contain"
                height={36}
                priority
                src="/logo.svg"
                width={36}
              />
            </div>
            <div>
              <span className="font-black text-lg text-emerald-400 tracking-wider block leading-none">
                PetaniKita
              </span>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 font-extrabold inline-block mt-1">
                SUPERADMIN
              </span>
            </div>
          </Link>

          {/* Close button untuk mobile drawer */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800"
              aria-label="Tutup Menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.key;
            return (
              <Link
                key={item.key}
                href={`/superadmin/dashboard?tab=${item.key}`}
                onClick={onCloseMobile}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition text-left shadow-md ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-xs text-white shrink-0">
            A
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white truncate">Admin PetaniKita</p>
            <p className="text-[10px] text-slate-400 truncate">Administrator Sistem</p>
          </div>
        </div>
        <a
          href="/auth/login"
          className="w-full bg-slate-800 hover:bg-rose-900/50 hover:text-rose-300 text-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Logout</span>
        </a>
      </div>
    </div>
  );
}

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Tutup drawer mobile jika route/tab berubah
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, searchParams]);

  // Lock scroll saat mobile menu terbuka
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col">
      {/* HEADER MOBILE (HAMBURGER BAR) */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-40 shadow-md">
        <Link href="/superadmin/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-slate-800 p-1 rounded-lg border border-slate-700">
            <Image
              alt="Logo PetaniKita"
              className="w-full h-full object-contain"
              height={28}
              src="/logo.svg"
              width={28}
            />
          </div>
          <span className="font-extrabold text-sm text-emerald-400">PetaniKita Admin</span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-slate-300 hover:text-white rounded-lg bg-slate-800 transition"
          aria-label="Buka Menu Superadmin"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* BACKDROP MOBILE */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 transition-opacity"
        />
      )}

      {/* FIXED SIDEBAR DESKTOP + OFF-CANVAS DRAWER MOBILE */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-white shadow-2xl transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <Suspense fallback={<div className="p-5 text-xs text-slate-400">Loading sidebar...</div>}>
          <SuperadminSidebarContent onCloseMobile={() => setMobileOpen(false)} />
        </Suspense>
      </aside>

      {/* MAIN CONTENT WORKSPACE (PADDED UNTUK SIDEBAR & MOBILE HEADER) */}
      <main className="flex-1 md:pl-64 pt-16 md:pt-0 w-full min-h-screen">
        {children}
      </main>
    </div>
  );
}