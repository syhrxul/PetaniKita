"use client";
import { useEffect, useState } from "react";
import { submitHarvest, getUserHarvests, getRegionalPrices, getSession, getCurrentUser, getLastFarmProfile, HarvestRecord, PriceRecord } from "@/lib/api";
import GeolocationInput from "@/components/GeolocationInput";
import { SkeletonGrid } from "@/components/ui/SkeletonCard";
import CustomSelect from "@/components/ui/CustomSelect";
import CustomDatePicker from "@/components/ui/CustomDatePicker";
import { Sprout, Lock, Wallet, Truck, MapPin, CheckCircle2, TrendingUp, TrendingDown, RefreshCw, Package, Calendar, Clock, Sparkles } from "lucide-react";

// Safe Client-Side Date Formatter (prevents hydration mismatch)
export function useIsMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function formatWibDateTime(d?: string | null) {
  if (!d) return "-";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).replace(/\./g, ":") + " WIB";
  } catch {
    return "-";
  }
}

export function formatWibFullDate(d?: string | null) {
  if (!d) return "-";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    });
  } catch {
    return "-";
  }
}

// Legacy helpers (for non-hydration-critical contexts)
const wibDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).replace(/\./g, ":") + " WIB" : "-";

const wibFullDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "-";

export default function FarmerInputPage() {
  const [activeTab, setActiveTab] = useState<"input" | "list">("input");
  const [farmerName, setFarmerName] = useState("Petani");
  const [loadingInitial, setLoadingInitial] = useState(true);
  const isMounted = useIsMounted();

  const [formData, setFormData] = useState({
    cropType: "Cabai Rawit Merah",
    areaSizeM2: "",
    yieldKg: "",
    pricePerKg: "",
    harvestDate: "",
    deliveryReadyDate: "",
    latitude: "",
    longitude: "",
    regionName: "",
  });

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [harvests, setHarvests] = useState<HarvestRecord[]>([]);
  const [prices, setPrices] = useState<PriceRecord[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    const userId = session?.id ?? 1;

    getCurrentUser()
      .then(u => {
        if (u.username) setFarmerName(u.username);
      })
      .catch(() => {});

    // Auto-Prefill profile dari DB
    getLastFarmProfile()
      .then(farm => {
        setFormData(f => ({
          ...f,
          latitude: farm.latitude !== null ? String(farm.latitude) : "",
          longitude: farm.longitude !== null ? String(farm.longitude) : "",
          regionName: farm.regionName ?? "",
          areaSizeM2: farm.areaSizeM2 !== null ? String(farm.areaSizeM2) : "",
          cropType: farm.cropType ?? f.cropType,
        }));
      })
      .catch(() => {})
      .finally(() => setLoadingInitial(false));

    // Fetch Harvests & Prices
    setDbLoading(true);
    Promise.all([getUserHarvests(userId), getRegionalPrices()])
      .then(([hList, pRes]) => {
        setHarvests(hList);
        setPrices(Array.isArray(pRes) ? pRes : pRes.prices || []);
      })
      .catch(err => console.error(err))
      .finally(() => setDbLoading(false));
  }, []);

  function set(k: string, v: string) { setFormData(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg("");
    const session = getSession();
    try {
      await submitHarvest({
        crop_type: formData.cropType,
        area_size_m2: parseFloat(formData.areaSizeM2),
        est_harvest_date: formData.harvestDate,
        est_yield_kg: parseFloat(formData.yieldKg),
        price_per_kg: formData.pricePerKg ? parseFloat(formData.pricePerKg) : undefined,
        delivery_ready_date: formData.deliveryReadyDate || undefined,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        regionName: formData.regionName,
        user_id: session?.id ?? 1,
      });
      setMsg(`✓ Data panen berhasil disimpan aman di sistem!`);
      setFormData(f => ({ ...f, yieldKg: "", harvestDate: "", deliveryReadyDate: "" }));
      getUserHarvests(session?.id ?? 1).then(setHarvests);
    } catch (err: unknown) {
      setMsg(err instanceof Error ? `✗ ${err.message}` : "✗ Gagal menyimpan");
    } finally { setLoading(false); }
  }

  const totalKg = harvests.reduce((acc, curr) => acc + curr.kg, 0);
  const lockedKg = harvests.filter(h => h.status === "LOCKED_ESCROW").reduce((acc, curr) => acc + curr.kg, 0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Welcome */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-2xl p-6 sm:p-8 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">Selamat Datang, {farmerName}</h1>
          <p className="text-emerald-100 text-sm sm:text-base">
            Poktan Tani Makmur — {formData.regionName || "Kabupaten Sleman"}
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Proyeksi Panen</p>
              <p className="text-2xl font-black text-slate-900">{totalKg} Kg</p>
            </div>
            <Sprout className="w-7 h-7 text-emerald-600" strokeWidth={2} />
          </div>
          <p className="text-xs text-slate-400 font-medium">{harvests.length} komoditas aktif</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Est. Pendapatan Escrow</p>
              <p className="text-2xl font-black text-slate-900">Rp {(lockedKg * 28000).toLocaleString("id-ID")}</p>
            </div>
            <Wallet className="w-7 h-7 text-amber-600" strokeWidth={2} />
          </div>
          <p className="text-xs text-slate-400 font-medium">Berdasarkan acuan HAP</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Pesanan Siap Diambil</p>
              <p className="text-2xl font-black text-slate-900">1 Order</p>
            </div>
            <Truck className="w-7 h-7 text-sky-600" strokeWidth={2} />
          </div>
          <p className="text-xs text-slate-400 font-medium">Kurir menuju lokasi</p>
        </div>
      </div>

      {/* Dual Tab Workspace */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="flex border-b border-slate-200/80 bg-slate-50/50">
          <button
            onClick={() => setActiveTab("input")}
            className={`flex-1 px-6 py-4 font-extrabold text-sm transition-all ${
              activeTab === "input"
                ? "text-emerald-700 bg-white border-b-2 border-emerald-600 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Form Input Panen Baru
          </button>
          <button
            onClick={() => setActiveTab("list")}
            className={`flex-1 px-6 py-4 font-extrabold text-sm transition-all ${
              activeTab === "list"
                ? "text-emerald-700 bg-white border-b-2 border-emerald-600 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Stok Panen Saya ({harvests.length})
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {/* TAB 1: INPUT FORM */}
          {activeTab === "input" && (
            <div>
              {loadingInitial ? (
                <div className="p-8 text-center text-slate-500 font-medium">
                  ⏳ Mengambil profil lahan &amp; lokasi...
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {msg && (
                    <div className={`p-4 rounded-xl text-xs font-bold ${msg.startsWith("✓") ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
                      {msg}
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-5 min-w-0">
                    <div>
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1.5">
                        Komoditas
                      </label>
                      <CustomSelect
                        value={formData.cropType}
                        onChange={v => set("cropType", v)}
                        options={[
                          { label: "Cabai Rawit Merah", value: "Cabai Rawit Merah" },
                          { label: "Cabai Merah Keriting", value: "Cabai Merah Keriting" },
                          { label: "Bawang Merah", value: "Bawang Merah" },
                          { label: "Bawang Putih", value: "Bawang Putih" },
                          { label: "Tomat Segar", value: "Tomat Segar" },
                          { label: "Kentang", value: "Kentang" },
                          { label: "Wortel", value: "Wortel" },
                        ]}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1.5">
                        Luas Lahan (m²)
                      </label>
                      <input
                        required
                        type="number"
                        value={formData.areaSizeM2}
                        onChange={e => set("areaSizeM2", e.target.value)}
                        placeholder="500"
                        className="w-full border border-slate-300 rounded-xl px-4 py-3 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1.5">
                        Estimasi Hasil (Kg)
                      </label>
                      <input
                        required
                        type="number"
                        value={formData.yieldKg}
                        onChange={e => set("yieldKg", e.target.value)}
                        placeholder="150"
                        className="w-full border border-slate-300 rounded-xl px-4 py-3 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition"
                      />
                    </div>

                    <CustomDatePicker
                      label="Tanggal Panen Estimasi"
                      value={formData.harvestDate}
                      onChange={v => set("harvestDate", v)}
                      type="date"
                      required
                      helperText="Tanggal pemetikan/pemanenan dari ladang"
                    />

                    <div>
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1.5">
                        Harga Lapangan per Kg (Rp)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.pricePerKg}
                        onChange={e => set("pricePerKg", e.target.value)}
                        placeholder="28000"
                        className="w-full border border-slate-300 rounded-xl px-4 py-3 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition"
                      />
                    </div>

                    <CustomDatePicker
                      label="Ready Diantar / Diambil Mulai"
                      value={formData.deliveryReadyDate}
                      onChange={v => set("deliveryReadyDate", v)}
                      type="datetime-local"
                      required
                      helperText="Waktu siap diambil UMKM atau diantar"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1.5">
                      Lokasi Lahan Panen
                    </label>
                    <GeolocationInput
                      initialLatitude={formData.latitude}
                      initialLongitude={formData.longitude}
                      initialRegionName={formData.regionName}
                      onChange={({ latitude, longitude, regionName }) => {
                        setFormData(f => ({
                          ...f,
                          latitude: String(latitude),
                          longitude: String(longitude),
                          regionName,
                        }));
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3.5 font-extrabold text-xs shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
                    {loading ? "Menyimpan Data..." : "Simpan Data Panen"}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: STOK LIST — RINGKAS & HIGH CONTRAST */}
          {activeTab === "list" && (
            <div className="space-y-4">
              {dbLoading ? (
                <SkeletonGrid count={2} />
              ) : harvests.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 space-y-3">
                  <Package className="w-12 h-12 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">Belum Ada Stok Panen Terbit</p>
                  <p className="text-xs text-slate-400">Klik tab "Form Input Panen Baru" untuk memposting produk tani Anda.</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                    <div>
                      <h3 className="text-base font-black text-slate-900">Daftar Komoditas &amp; Stok Aktif</h3>
                      <p className="text-xs text-slate-500">Seluruh stok yang sedang ditampilkan pada Radar UMKM Kuliner.</p>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-3 py-1 rounded-full border border-emerald-200">
                      {harvests.length} Terbit
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {harvests.map(h => (
                      <div
                        key={h.id}
                        className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all space-y-3.5"
                      >
                        {/* Header Komoditas */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200 shrink-0">
                              <Sprout className="w-5 h-5" strokeWidth={2.5} />
                            </div>
                            <div>
                              <h4 className="text-base font-black text-slate-900 leading-tight">{h.crop}</h4>
                              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                                Stok: <strong className="text-slate-800">{h.kg} Kg</strong>
                                {h.pricePerKg ? ` • Rp ${Number(h.pricePerKg).toLocaleString("id-ID")}/Kg` : ""}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1 ${
                              h.status === "AVAILABLE" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : h.status === "LOCKED_ESCROW" ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-sky-50 text-sky-700 border-sky-200"
                            }`}>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {h.status === "AVAILABLE" ? "Tersedia di Radar" : h.status === "LOCKED_ESCROW" ? "Terkunci Pesanan" : "Selesai"}
                            </span>
                          </div>
                        </div>

                        {/* Schedules Badge Bar — Ringkas & Rapi */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {/* Upload Timestamp */}
                          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                              <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="truncate">Upload Sistem</span>
                            </p>
                            <p className="text-xs font-bold text-slate-800 truncate" suppressHydrationWarning>
                              {isMounted ? formatWibDateTime(h.uploadedAt) : "-"}
                            </p>
                          </div>

                          {/* Estimasi Siap Panen */}
                          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2.5">
                            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                              <Sprout className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="truncate">Estimasi Panen</span>
                            </p>
                            <p className="text-xs font-black text-emerald-900 truncate" suppressHydrationWarning>
                              {isMounted ? formatWibFullDate(h.harvestDate ?? h.date) : "-"}
                            </p>
                          </div>

                          {/* Siap Kirim / Ambil (Ringkas & Tidak Memanjang) */}
                          <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl p-2.5">
                            <p className="text-[10px] font-bold text-sky-700 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                              <Clock className="w-3 h-3 text-sky-600 shrink-0" />
                              <span className="truncate">Siap Kirim / Ambil</span>
                            </p>
                            <p className="text-xs font-black text-sky-900 truncate" suppressHydrationWarning>
                              {isMounted ? formatWibDateTime(h.deliveryReadyDate) : "-"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Market Prices Widget Real DB */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 sm:p-8">
        <h3 className="text-xl font-bold text-slate-900 mb-5">Acuan Harga Pangan Pasar Lokal</h3>
        {dbLoading ? (
          <p className="text-slate-500 text-xs">⏳ Memuat harga pasar...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {prices.map((p) => (
              <div key={p.id} className="border border-slate-200/80 rounded-2xl p-5 bg-slate-50/50">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-slate-500 text-xs font-bold mb-1">{p.commodity}</p>
                    <p className="text-xl font-black text-slate-900">Rp {p.farmer_price.toLocaleString("id-ID")}</p>
                  </div>
                  {p.trend === "UP" && <TrendingUp className="w-5 h-5 text-emerald-600" strokeWidth={2.5} />}
                  {p.trend === "DOWN" && <TrendingDown className="w-5 h-5 text-rose-600" strokeWidth={2.5} />}
                  {p.trend === "STABLE" && <div className="w-5 h-5 text-slate-400 font-bold text-center">—</div>}
                </div>
                <p className="text-[11px] text-slate-400 font-medium">Harga Acuan (HAP): Rp {p.hap_price.toLocaleString("id-ID")}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}