'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Users, Radio, Clock, MapPin, TrendingUp, LogOut } from 'lucide-react';

function SuperadminSidebar() {
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
    <aside className="w-64 bg-slate-900 text-white p-5 space-y-6 shrink-0 hidden md:flex flex-col justify-between">
      <div className="space-y-6">
        {/* HEADER LOGO SVG */}
        <Link className="flex items-center gap-3 border-b border-slate-800/80 pb-4 group" href="/superadmin/dashboard">
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
            <span className="font-black text-lg text-emerald-400 tracking-wider block leading-none">PetaniKita</span>
            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 font-extrabold inline-block mt-1">SUPERADMIN</span>
          </div>
        </Link>

        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.key;
            return (
              <Link
                key={item.key}
                href={`/superadmin/dashboard?tab=${item.key}`}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition text-left shadow-md ${
                  isActive ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4"/>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-xs text-white">A</div>
          <div>
            <p className="text-xs font-bold text-white">Admin PetaniKita</p>
            <p className="text-[10px] text-slate-400">Administrator Sistem</p>
          </div>
        </div>
        <a href="/auth/login" className="w-full bg-slate-800 hover:bg-rose-900/50 hover:text-rose-300 text-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2">
          <LogOut className="w-3.5 h-3.5"/>
          <span>Logout</span>
        </a>
      </div>
    </aside>
  );
}

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-100 font-sans text-slate-800">
      
      {/* SIDEBAR UTAMA TERHUBUNG VIA URL QUERY */}
      <Suspense fallback={<div className="w-64 bg-slate-900 text-white p-5">Loading...</div>}>
        <SuperadminSidebar />
      </Suspense>

      {/* CONTENT WORKSPACE */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
