"use client";
import { useEffect, useState } from "react";
import { getPriceProposals, overridePrice } from "@/lib/api";
import DashboardLayout from "@/app/dashboard/layout";
import { Sparkles, CheckCircle2, AlertTriangle, ShieldCheck, Lock, RefreshCw } from "lucide-react";

export default function SuperadminProposalsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [overridePriceVal, setOverridePriceVal] = useState("");
  const [lockOption, setLockOption] = useState<"12h" | "custom">("12h");
  const [customDate, setCustomDate] = useState("");
  const [executing, setExecuting] = useState(false);
  const [msg, setMsg] = useState("");

  function loadProposals() {
    setLoading(true); setMsg("");
    getPriceProposals()
      .then(res => {
        setData(res);
        if (res.aiAnalysis?.recommendedPrice) {
          setOverridePriceVal(String(res.aiAnalysis.recommendedPrice));
        } else if (res.summary?.avgProposedPrice) {
          setOverridePriceVal(String(res.summary.avgProposedPrice));
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadProposals(); }, []);

  async function handleExecuteOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!data?.summary) return;
    setExecuting(true); setMsg("");

    const isCustomLocked = lockOption === "custom";
    const lockUntil = isCustomLocked ? customDate : undefined;

    try {
      const res = await overridePrice({
        regionName: data.summary.regionName,
        commodity: data.summary.commodity,
        overridePrice: parseFloat(overridePriceVal),
        isCustomLocked,
        lockUntil,
      });
      setMsg(`✓ ${res.message}`);
      setTimeout(() => loadProposals(), 1500);
    } catch (err: unknown) {
      setMsg(err instanceof Error ? `✗ ${err.message}` : "Gagal meng-override harga");
    } finally { setExecuting(false); }
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="bg-slate-900 text-white rounded-2xl p-8 flex justify-between items-center border border-slate-800">
          <div>
            <h1 className="text-3xl font-bold mb-2">Aspirasi &amp; Penyesuaian Harga Petani</h1>
            <p className="text-slate-300 text-base">Monitoring pengajuan harga petani &amp; AI Decision Engine 9Router</p>
          </div>
          <button
            onClick={loadProposals}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-sm transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} strokeWidth={2} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center text-slate-500 font-medium">
            ⏳ Menganalisis pengajuan harga petani dengan AI Decision Engine...
          </div>
        ) : !data || !data.summary ? (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center text-slate-600 font-medium">
            Tidak ada pengajuan harga petani yang pending saat ini.
          </div>
        ) : (
          <div className="space-y-8">
            {/* Kartu Ringkasan Aspirasi */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-4">
              <div className="flex items-center gap-3">
                <span className="p-3 bg-amber-100 text-amber-800 rounded-xl font-bold text-sm">
                  {data.summary.totalFarmers} Petani
                </span>
                <h2 className="text-2xl font-bold text-slate-900">
                  {data.summary.totalFarmers} Petani di {data.summary.regionName} Meminta Kenaikan Harga {data.summary.commodity}
                </h2>
              </div>

              <div className="grid md:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-xl border border-slate-200">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Harga Resmi Saat Ini</p>
                  <p className="text-2xl font-bold text-slate-900">Rp {data.summary.currentPrice.toLocaleString()} / kg</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Rata-Rata Pengajuan Petani</p>
                  <p className="text-2xl font-bold text-amber-600">Rp {data.summary.avgProposedPrice.toLocaleString()} / kg</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Total Aspirasi</p>
                  <p className="text-2xl font-bold text-slate-800">{data.summary.totalFarmers} Orang</p>
                </div>
              </div>

              {data.summary.reasons.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Alasan Utama Petani:</p>
                  <ul className="space-y-1 text-slate-600 text-sm list-disc pl-5">
                    {data.summary.reasons.map((r: string, i: number) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Panel Rekomendasi AI Decision Engine (9Router) */}
            {data.aiAnalysis && (
              <div className="bg-gradient-to-br from-slate-900 to-emerald-950 text-white rounded-2xl p-8 border border-slate-800 shadow-xl space-y-6">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-8 h-8 text-amber-400" strokeWidth={2} />
                  <div>
                    <h2 className="text-2xl font-bold text-white">Rekomendasi AI Decision Support Engine</h2>
                    <p className="text-xs font-mono text-emerald-400">9Router Model: PetaniKita • Impact Level: {data.aiAnalysis.impactLevel}</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 bg-slate-800/60 p-6 rounded-xl border border-slate-700/50">
                  <div>
                    <p className="text-xs text-slate-300 mb-1">Rekomendasi Harga AI Penengah</p>
                    <p className="text-4xl font-bold text-emerald-400">
                      Rp {data.aiAnalysis.recommendedPrice.toLocaleString()} / kg
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-300 mb-1">Analisis Ekonomi AI</p>
                    <p className="text-sm text-slate-200 leading-relaxed font-medium">
                      &quot;{data.aiAnalysis.rationale}&quot;
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Form Eksekusi Superadmin */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-6">
              <h3 className="text-2xl font-bold text-slate-900">Eksekusi Keputusan Harga Superadmin</h3>

              {msg && (
                <div className={`p-4 rounded-xl text-base font-semibold ${msg.startsWith("✓") ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
                  {msg}
                </div>
              )}

              <form onSubmit={handleExecuteOverride} className="space-y-6">
                <div>
                  <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">
                    Harga Keputusan Baru (Rp/Kg) *
                  </label>
                  <input
                    required
                    type="number"
                    value={overridePriceVal}
                    onChange={e => setOverridePriceVal(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-2xl font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block">
                    Pilihan Masa Berlaku Harga (Lock Policy)
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition">
                      <input
                        type="radio"
                        name="lockOption"
                        checked={lockOption === "12h"}
                        onChange={() => setLockOption("12h")}
                        className="w-4 h-4 text-emerald-600"
                      />
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">Berlaku Sampai Refresh 12 Jam Berikutnya (Default)</p>
                        <p className="text-xs text-slate-500">Harga akan otomatis mengikuti sync AI 12-hour batch cron job berikutnya.</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition">
                      <input
                        type="radio"
                        name="lockOption"
                        checked={lockOption === "custom"}
                        onChange={() => setLockOption("custom")}
                        className="w-4 h-4 text-emerald-600"
                      />
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">Pertahankan Sampai Tanggal Kustom (Custom Lock)</p>
                        <p className="text-xs text-slate-500">Kunci harga agar TIDAK ditimpa oleh Cron Job 12 jam sampai tanggal yang ditentukan.</p>
                      </div>
                    </label>
                  </div>
                </div>

                {lockOption === "custom" && (
                  <div>
                    <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">
                      Kunci Sampai Tanggal
                    </label>
                    <input
                      required
                      type="date"
                      value={customDate}
                      onChange={e => setCustomDate(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base text-slate-900 font-semibold focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={executing}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-4 font-bold text-base shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
                >
                  <CheckCircle2 className="w-5 h-5" strokeWidth={2} />
                  {executing ? "Menerapkan Keputusan..." : "Setujui &amp; Terapkan Harga Baru"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
