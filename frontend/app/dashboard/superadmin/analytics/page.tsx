"use client";
import DashboardLayout from "@/app/dashboard/layout";
import { Activity, TrendingUp, TrendingDown, Database } from "lucide-react";

export default function SuperadminAnalyticsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Analytics Neraca Pangan Regional</h1>
          <p className="text-slate-600 text-base">Analisis mendalam tren produksi, pola konsumsi UMKM, &amp; stabilitas harga pangan</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-slate-600 text-sm mb-1 font-medium">Laju Inflasi Pangan Hortikultura</p>
            <p className="text-3xl font-bold text-emerald-600 mb-2">+1.2%</p>
            <p className="text-xs text-slate-500">Target regional: &lt; 2.5%</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-slate-600 text-sm mb-1 font-medium">Rata-rata Efisiensi Distribusi</p>
            <p className="text-3xl font-bold text-blue-600 mb-2">91.4%</p>
            <p className="text-xs text-slate-500">Berbasis rute SciPy linprog</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-slate-600 text-sm mb-1 font-medium">Total Volume Transaksi</p>
            <p className="text-3xl font-bold text-slate-900 mb-2">Rp 128.4 Jt</p>
            <p className="text-xs text-slate-500">Bulan Agustus 2026</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
