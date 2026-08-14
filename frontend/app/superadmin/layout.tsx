'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
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
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <Link
            className="flex items-center gap-3 group"
            href="/superadmin/dashboard"
            onClick={onCloseMobile}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="PetaniKita"
              className="w-auto h-8"
              src="/petani kita logo.svg"
            />
          </Link>

          {/* Close button untuk mobile drawer */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-lg bg-slate-100"
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
                    : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-slate-200 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-xs text-white shrink-0">
            A
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">Admin PetaniKita</p>
            <p className="text-[10px] text-slate-500 truncate">Administrator Sistem</p>
          </div>
        </div>
        <a
          href="/auth/login"
          className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
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

  // Tutup drawer mobile jika route berpindah
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-40 shadow-md">
        <Link href="/superadmin/dashboard" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="PetaniKita"
            className="w-auto h-6"
            src="/petani kita logo.svg"
          />
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-slate-600 hover:text-slate-900 rounded-lg bg-slate-100 transition"
          aria-label="Buka Menu Superadmin"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* BACKDROP MOBILE */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-40 transition-opacity"
        />
      )}

      {/* FIXED SIDEBAR DESKTOP + OFF-CANVAS DRAWER MOBILE */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white text-slate-800 shadow-2xl transition-transform duration-300 ease-in-out ${
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