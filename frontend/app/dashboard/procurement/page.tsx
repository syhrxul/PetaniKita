"use client";
import { useEffect, useState } from "react";
import { SkeletonGrid } from "@/components/ui/SkeletonCard";
import { useRouter } from "next/navigation";
import { getProcurementDashboardStats, getProcurementRecommendations, getProcurementSuppliers, checkoutProcurementOrder, getSession, getCurrentUser, getPricesByRegion } from "@/lib/api";
import { formatCompactRupiah, formatRupiah } from "@/lib/format";
import { ShoppingBag, Lock, TrendingDown, Wallet, Sparkles, MapPin, RefreshCw, CheckCircle2, AlertCircle, X, CreditCard, Clock, Truck, Store, Receipt, Calculator, MessageCircle, Search, TrendingUp } from "lucide-react";

type ProcurementMethod = "DIANTAR_PETANI" | "COD_AMBIL_SENDIRI";

const wibDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "-";
const wibDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) + " WIB" : "-";
type PriceDisplayMode = "ALL_IN" | "TRANSPARENT";

export default function ProcurementPage() {
  const router = useRouter();
  const [stats, setStats] = useState<{
    weeklyDemandKg: number;
    activeEscrowOrders: number;
    totalCostSavings: number;
    monthlyExpenses: number;
    totalKgThisWeek?: number;
    activeOrdersCount?: number;
    totalSaved?: number;
    totalSpentThisMonth?: number;
    aiStatus?: {
      isReady: boolean;
      daysActive: number;
      daysRemaining: number;
      totalTransactions: number;
    };
  } | null>(null);

  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Regional Market Prices State
  const [regionPrices, setRegionPrices] = useState<Array<{
    commodity: string;
    farmerPrice: number;
    umkmPrice: number;
    hapPrice: number;
    trend: string;
  }> | null>(null);
  const [regionName, setRegionName] = useState("");
  const [regionalLoading, setRegionalLoading] = useState(true);
  const [priceSearch, setPriceSearch] = useState("");

  // Checkout Modal State
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
  const [inputQuantityKg, setInputQuantityKg] = useState("");
  const [procurementMethod, setProcurementMethod] = useState<ProcurementMethod>("DIANTAR_PETANI");
  const [enableNego, setEnableNego] = useState(false);
  const [negoPrice, setNegoPrice] = useState("");
  const [negoReason, setNegoReason] = useState("");
  const [priceDisplayMode, setPriceDisplayMode] = useState<PriceDisplayMode>("ALL_IN");
  const [submittingCheckout, setSubmittingCheckout] = useState(false);
  const [modalMsg, setModalMsg] = useState("");
  const [checkoutSuccessData, setCheckoutSuccessData] = useState<{ directWaUrl: string; farmerPhone: string } | null>(null);

  function loadWorkspaceData(isSilent = false) {
    if (!isSilent) setLoading(true);
    const session = getSession();
    const umkmId = session?.id ?? 2;

    Promise.all([
      getProcurementDashboardStats(umkmId),
      getProcurementRecommendations(umkmId),
      getProcurementSuppliers(umkmId),
    ])
      .then(([sData, rList, supList]) => {
        setStats(sData);
        setRecommendations(Array.isArray(rList) ? rList : []);
        setSuppliers(Array.isArray(supList) ? supList : []);
      })
      .catch(err => console.error(err))
      .finally(() => {
        if (!isSilent) setLoading(false);
      });
  }

  function loadRegionalPrices() {
    setRegionalLoading(true);
    getCurrentUser()
      .then(u => {
        const region = u.regionName || "";
        setRegionName(region);
        return region ? getPricesByRegion(region) : null;
      })
      .then(res => {
        if (res && Array.isArray(res.data)) {
          setRegionPrices(res.data);
        } else {
          setRegionPrices(null);
        }
      })      .catch(() => setRegionPrices(null))
      .finally(() => setRegionalLoading(false));
  }

  useEffect(() => {
    loadWorkspaceData(false);
    loadRegionalPrices();
    const interval = setInterval(() => loadWorkspaceData(true), 5000);
    return () => clearInterval(interval);
  }, []);

  function handleOpenCheckoutModal(supplier: any) {
    setSelectedSupplier(supplier);
    setInputQuantityKg(String(supplier.availableYieldKg ?? 50));
    setEnableNego(false);
    setNegoPrice("");
    setNegoReason("");
    setProcurementMethod("DIANTAR_PETANI");
    setPriceDisplayMode("ALL_IN");
    setModalMsg("");
  }

  async function handleConfirmCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSupplier) return;
    setSubmittingCheckout(true); setModalMsg("");
    const session = getSession();

    const qtyToBuy = parseFloat(inputQuantityKg);
    if (isNaN(qtyToBuy) || qtyToBuy <= 0) {
      setModalMsg("Masukkan jumlah Kilogram yang valid!");
      setSubmittingCheckout(false);
      return;
    }
    if (qtyToBuy > selectedSupplier.availableYieldKg) {
      setModalMsg(`Jumlah pembelian melebihi stok yang tersedia (${selectedSupplier.availableYieldKg} Kg)!`);
      setSubmittingCheckout(false);
      return;
    }

    try {
      const res = await checkoutProcurementOrder({
        harvestEventId: selectedSupplier.harvestId,
        quantityKg: qtyToBuy,
        umkmUserId: session?.id ?? 2,
        deliveryMethod: procurementMethod,
        ...(enableNego && Number(negoPrice) > 0
          ? { proposedPricePerKg: Number(negoPrice), negoReason: negoReason || undefined }
          : {}),
      });

      if (res.success) {
        setCheckoutSuccessData({
          directWaUrl: res.data?.farmerWaUrl || "",
          farmerPhone: res.data?.farmerPhone || "",
        });
        setModalMsg(`✓ ${res.message}`);
        setTimeout(() => {
          setSelectedSupplier(null);
          setCheckoutSuccessData(null);
          router.push("/dashboard/procurement/history");
        }, 5000);
      } else {
        setModalMsg(`✗ ${res.message}`);
      }
    } catch (err: unknown) {
      setModalMsg(err instanceof Error ? `✗ ${err.message}` : "Gagal memproses checkout");
    } finally {
      setSubmittingCheckout(false);
    }
  }

  const foodPrice = (parseFloat(inputQuantityKg) || 0) * (selectedSupplier?.pricePerKg ?? 0);
  const filteredPrices = (regionPrices || []).filter(p =>
    priceSearch.trim() === "" || p.commodity.toLowerCase().includes(priceSearch.trim().toLowerCase())
  );
  const effectivePricePerKg = enableNego && Number(negoPrice) > 0
    ? Number(negoPrice)
    : (selectedSupplier?.pricePerKg ?? 0);
  const freightCost = procurementMethod === "COD_AMBIL_SENDIRI"
    ? 0
    : Math.round((4000 + (selectedSupplier?.distanceKm ?? 0) * 1200 + (parseFloat(inputQuantityKg) || 0) * 150) / 500) * 500;
  const totalPrice = foodPrice + freightCost;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-700 text-white rounded-2xl p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 truncate">Pengadaan Bahan Baku &amp; Auto-Restock</h1>
          <p className="text-teal-100 text-sm sm:text-lg truncate">Powered by Prophet AI Forecasting &amp; Sistem Pencocokan Jarak Otomatis</p>
        </div>
        <button
          onClick={() => loadWorkspaceData(false)}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-sm transition disabled:opacity-50 self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} strokeWidth={2} />
          Refresh Data
        </button>
      </div>

      {/* 4 Dynamic Metric Cards */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 min-w-0">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <p className="text-slate-600 text-sm font-medium mb-1">Estimasi Kebutuhan Minggu Ini</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 truncate">{stats?.totalKgThisWeek ?? stats?.weeklyDemandKg ?? 0} Kg</p>
            </div>
            <ShoppingBag className="w-8 h-8 text-teal-600 shrink-0" strokeWidth={2} />
          </div>
          <p className="text-xs text-slate-500 font-medium">Berdasarkan rekap otomatis</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 min-w-0">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <p className="text-slate-600 text-sm font-medium mb-1">Pesanan Dikunci DP (Escrow)</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 truncate">{stats?.activeOrdersCount ?? stats?.activeEscrowOrders ?? 0} Order</p>
            </div>
            <Lock className="w-8 h-8 text-emerald-600 shrink-0" strokeWidth={2} />
          </div>
          <p className="text-xs text-slate-500 font-medium">Status Escrow Aktif</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 min-w-0">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <p className="text-slate-600 text-sm font-medium mb-1">Total Hemat Procurement</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 truncate">{formatCompactRupiah(stats?.totalSaved ?? stats?.totalCostSavings ?? 0)}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-emerald-600 shrink-0" strokeWidth={2} />
          </div>
          <p className="text-xs text-slate-500 font-medium">vs Harga Distributor Pasar</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 min-w-0">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <p className="text-slate-600 text-sm font-medium mb-1">Pengeluaran Kas Bulan Ini</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 truncate">{formatCompactRupiah(stats?.totalSpentThisMonth ?? stats?.monthlyExpenses ?? 0)}</p>
            </div>
            <Wallet className="w-8 h-8 text-slate-600 shrink-0" strokeWidth={2} />
          </div>
          <p className="text-xs text-slate-500 font-medium">Pengeluaran terdata</p>
        </div>
      </div>

      {/* Regional Market Prices Widget */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900">Harga Pasar di Daerah Anda</h2>
              {regionName && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full">
                  <MapPin className="w-3.5 h-3.5" strokeWidth={2} />
                  {regionName}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Acuan harga petani &amp; UMKM terkini di wilayah Anda. Cari komoditas untuk cek harga.
            </p>
          </div>

          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={2} />
            <input
              type="text"
              value={priceSearch}
              onChange={e => setPriceSearch(e.target.value)}
              placeholder="Cari komoditas..."
              className="w-full border border-slate-300 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            />
          </div>
        </div>

        {regionalLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-xl border border-slate-200" />
            ))}
          </div>
        ) : !regionPrices || regionPrices.length === 0 ? (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center text-slate-600 text-sm font-medium">
            <AlertCircle className="w-7 h-7 text-amber-600 mx-auto mb-2" strokeWidth={2} />
            Belum ada data harga pasar untuk wilayah Anda.
          </div>
        ) : filteredPrices.length === 0 ? (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center text-slate-600 text-sm font-medium">
            Komoditas &quot;{priceSearch}&quot; tidak ditemukan di {regionName || "wilayah Anda"}.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPrices.map((p, idx) => {
              const isUp = p.trend === "UP";
              const isDown = p.trend === "DOWN";
              return (
                <div key={`${p.commodity}-${idx}`} className="bg-slate-50 rounded-xl border border-slate-200/80 p-4 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h4 className="font-bold text-slate-900 min-w-0 truncate">{p.commodity}</h4>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      isUp ? "bg-rose-100 text-rose-700" : isDown ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                    }`}>
                      {isUp ? <TrendingUp className="w-3 h-3" strokeWidth={2.5} /> : isDown ? <TrendingDown className="w-3 h-3" strokeWidth={2.5} /> : null}
                      {p.trend === "STABLE" ? "Stabil" : p.trend}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Harga Petani</p>
                      <p className="font-bold text-emerald-700 truncate">{formatRupiah(p.farmerPrice)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Harga UMKM</p>
                      <p className="font-bold text-slate-900 truncate">{formatRupiah(p.umkmPrice)}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-200/70 truncate">HAP: {formatRupiah(p.hapPrice)} / Kg</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Forecast Banner - Prophet ML & Cold-Start Logic */}
      {!stats?.aiStatus?.isReady ? (
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-emerald-800/40 my-6">
          <div className="flex items-start justify-between">
            <div className="flex space-x-4">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-lg text-white">Sistem AI Sedang Mempelajari Pola Usaha Anda</h3>
                  <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    Tahap Akumulasi Data
                  </span>
                </div>
                <p className="text-slate-300 text-xs mt-1 max-w-xl">
                  Model Prophet AI membutuhkan masa aktif minimal <strong>3 hari transaksi</strong> untuk menyajikan estimasi kebutuhan stok yang presisi secara otomatis.
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-600">Status Pengumpulan</p>
              <p className="text-xl font-bold text-emerald-400 truncate">
                {stats?.aiStatus?.daysActive || 1} / 3 Hari
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-800 rounded-full h-2 mt-4 overflow-hidden">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (((stats?.aiStatus?.daysActive || 1) / 3) * 100))}%` }}
            />
          </div>

          <p className="text-xs text-slate-600 mt-3 italic">
            💡 Sementara AI mempelajari pola Anda, berikut adalah Paket Starter Rekomendasi umum bahan baku UMKM kuliner:
          </p>

          {recommendations.length > 0 && (
            <div className="grid md:grid-cols-3 gap-4 mt-4">
              {recommendations.map((item, i) => (
                <div key={i} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                  <p className="text-sm text-slate-300 mb-1">{item.commodityName}</p>
                  <p className="text-2xl sm:text-3xl font-bold text-white mb-2 truncate">{item.requiredKg || item.predictedKg || 10} Kg</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-600 min-w-0 truncate">Deadline: {item.deadline}</span>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {item.priority || "Normal"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gradient-to-r from-slate-900 to-emerald-950 text-white rounded-2xl p-8 shadow-xl border border-slate-800">
          <div className="flex items-start gap-4 mb-6">
            <Sparkles className="w-7 h-7 text-amber-400 flex-shrink-0 mt-1" strokeWidth={2} />
            <div>
              <h2 className="text-2xl font-bold mb-2">Rekomendasi Restock Prophet AI</h2>
              <p className="text-slate-300 text-base">Prediksi otomatis berdasarkan histori pengeluaran &amp; kebutuhan usaha makanan Anda.</p>
            </div>
          </div>

          {recommendations.length === 0 ? (
            <div className="p-6 bg-slate-800/40 border border-slate-700/40 rounded-xl text-slate-300 text-sm text-center">
              Belum ada rekomendasi restock aktif.
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {recommendations.map((item, i) => (
                <div key={i} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                  <p className="text-sm text-slate-300 mb-1">{item.commodityName}</p>
                  <p className="text-2xl sm:text-3xl font-bold text-white mb-2 truncate">{item.requiredKg || item.predictedKg} Kg</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-600 min-w-0 truncate">Deadline: {item.deadline}</span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                      item.priority === "Urgent" ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}>
                      {item.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => loadWorkspaceData(false)}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3.5 font-bold text-base shadow-md transition"
          >
            <Sparkles className="w-5 h-5" strokeWidth={2} />
            Otomatis Cari Supplier Terdekat (Sistem Pencocokan Jarak Otomatis)
          </button>
        </div>
      )}

      {/* Dynamic Supplier Catalog Grid */}
      <div className="space-y-4">
        <div className="flex justify-between items-center gap-2">
          <h3 className="text-lg sm:text-2xl font-bold text-slate-900 min-w-0 truncate">Rekomendasi Supplier Terdekat (&lt; 25 km)</h3>
          <span className="text-xs font-semibold px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full shrink-0">
            Calculated by Distance Engine
          </span>
        </div>

        {loading ? (
          <SkeletonGrid count={4} />
        ) : suppliers.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-600 font-medium bg-slate-50">
            <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-2" strokeWidth={2} />
            Tidak ada supplier panen aktif dalam radius &lt; 50 km di wilayah Anda.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {suppliers.map(s => (
              <div key={s.harvestId} className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 flex flex-col justify-between space-y-6">
                <div>
                  <div className="flex justify-between items-start mb-2 gap-3">
                    <div className="flex-1 min-w-0">
                      {s.uploadedAt && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-md inline-block mb-1.5">
                          Diupload: {wibDateTime(s.uploadedAt)}
                        </span>
                      )}
                      <h4 className="text-xl font-bold text-slate-900 truncate">{s.farmerName}</h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2} />
                        {s.regionName}
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200">
                      {s.distanceKm} km dari lokasi Anda
                    </span>
                  </div>

                  <p className="text-sm font-medium text-slate-700 mt-3">Komoditas: {s.commodities}</p>

                  <div className="bg-slate-50 rounded-xl p-4 mt-4 border border-slate-200/60 grid grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 mb-1">Harga per Kg</p>
                      <p className="text-xl font-bold text-slate-900 truncate">Rp {s.pricePerKg.toLocaleString("id-ID")}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 mb-1">Stok Tersedia</p>
                      <p className="text-xl font-bold text-emerald-700 truncate">{s.availableYieldKg} Kg</p>
                    </div>
                  </div>

                  {/* Jadwal Ketersediaan */}
                  <div className="grid grid-cols-2 gap-2 bg-emerald-50/60 p-3 rounded-xl text-[11px] text-emerald-900 border border-emerald-100 mt-3">
                    <div>
                      <span className="text-slate-500 block text-[10px]">🗓️ Tanggal Panen</span>
                      <strong>{wibDate(s.harvestDate)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">🚚 Ready Kirim / Diambil</span>
                      <strong>{wibDateTime(s.deliveryReadyDate)}</strong>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenCheckoutModal(s)}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3.5 font-bold text-base shadow-md shadow-emerald-600/20 transition"
                >
                  <Lock className="w-4 h-4" strokeWidth={2} />
                  Lock Order &amp; Bayar DP Escrow
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* In-Page Checkout Modal */}
      {selectedSupplier && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-6 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Checkout &amp; Lock Order</h3>
                <p className="text-xs font-semibold text-emerald-700">{selectedSupplier.farmerName} • {selectedSupplier.regionName}</p>
              </div>
              <button onClick={() => setSelectedSupplier(null)} className="text-slate-600 hover:text-slate-600 p-1">
                <X className="w-6 h-6" strokeWidth={2} />
              </button>
            </div>

            {modalMsg && (
              <div className={`p-4 rounded-xl text-sm font-semibold ${modalMsg.startsWith("✓") ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
                {modalMsg}
              </div>
            )}

            {checkoutSuccessData?.directWaUrl && (
              <a
                href={checkoutSuccessData.directWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition mt-3"
              >
                <MessageCircle className="w-4 h-4" strokeWidth={2} />
                <span>Hubungi Petani Langsung via WhatsApp</span>
              </a>
            )}

            <form onSubmit={handleConfirmCheckout} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">
                  Komoditas &amp; Harga
                </label>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center gap-2">
                  <span className="font-bold text-slate-900 min-w-0 truncate">{selectedSupplier.commodities}</span>
                  <span className="font-bold text-emerald-700 shrink-0 truncate">Rp {selectedSupplier.pricePerKg.toLocaleString("id-ID")} / Kg</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">
                  Jumlah Pesanan (Kg) *
                </label>
                <input
                  required
                  type="number"
                  max={selectedSupplier.availableYieldKg}
                  value={inputQuantityKg}
                  onChange={e => setInputQuantityKg(e.target.value)}
                  placeholder={`Maksimal ${selectedSupplier.availableYieldKg} Kg`}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              {/* Procurement Method Toggle */}
              <div>
                <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">
                  Metode Pengadaan
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setProcurementMethod("DIANTAR_PETANI")}
                    className={`p-3 rounded-xl border-2 font-semibold text-xs flex items-center gap-2 transition ${
                      procurementMethod === "DIANTAR_PETANI"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Truck className="w-4 h-4 mr-1" strokeWidth={2} />
                    <div className="text-left">
                      <p className="font-bold">Diantar Petani</p>
                      <p className="text-[10px] text-slate-500 font-normal">Ongkir adil by AI</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProcurementMethod("COD_AMBIL_SENDIRI")}
                    className={`p-3 rounded-xl border-2 font-semibold text-xs flex items-center gap-2 transition ${
                      procurementMethod === "COD_AMBIL_SENDIRI"
                        ? "border-amber-600 bg-amber-50 text-amber-900"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Store className="w-4 h-4 mr-1" strokeWidth={2} />
                    <div className="text-left">
                      <p className="font-bold">Ambil Sendiri (COD)</p>
                      <p className="text-[10px] text-slate-500 font-normal">Ke ladang petani</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Price Display Toggle */}
              <div>
                <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">
                  Tampilan Harga
                </label>
                <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPriceDisplayMode("ALL_IN")}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                      priceDisplayMode === "ALL_IN"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500"
                    }`}
                  >
                    <Calculator className="w-3.5 h-3.5" strokeWidth={2} />
                    Harga All-In (Gabungan)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceDisplayMode("TRANSPARENT")}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                      priceDisplayMode === "TRANSPARENT"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500"
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" strokeWidth={2} />
                    Rincian Transparan
                  </button>
                </div>
              </div>

              {/* Nego Harga Transparan */}
              <div className="border border-slate-200 rounded-xl p-3 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableNego}
                    onChange={e => setEnableNego(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600"
                  />
                  <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                    Ajukan Nego Harga
                  </span>
                </label>

                {enableNego && (
                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] font-medium text-slate-600 block mb-1">
                        Harga Penawaran Anda (Rp / Kg)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={negoPrice}
                        onChange={e => setNegoPrice(e.target.value)}
                        placeholder={`Harga petani: Rp ${(selectedSupplier?.pricePerKg ?? 0).toLocaleString("id-ID")}`}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-semibold focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-600 block mb-1">
                        Alasan Nego (Opsional)
                      </label>
                      <input
                        type="text"
                        value={negoReason}
                        onChange={e => setNegoReason(e.target.value)}
                        placeholder="Contoh: Beli borongan 200 Kg untuk langganan mingguan"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                    <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                      Pesanan akan berstatus <b>Menunggu Persetujuan Petani</b>. Petani dapat menerima atau menolak dengan alasan.
                    </p>
                  </div>
                )}
              </div>

              {/* Self Pick-Up Free Shipping Badge */}
              {procurementMethod === "COD_AMBIL_SENDIRI" && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-bold shadow-xs">
                  <span className="text-sm">🎉</span>
                  <span>Bebas Ongkir (Ambil Sendiri ke Ladang Petani)</span>
                </div>
              )}

              {/* Price Summary */}
              {priceDisplayMode === "ALL_IN" ? (
                <div className="p-4 bg-slate-900 text-white rounded-xl">
                  <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 font-medium">
                        {procurementMethod === "COD_AMBIL_SENDIRI" ? "Total Pembayaran (COD di Ladang)" : "Total All-In (Termasuk Ongkir Petani)"}
                      </p>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        {procurementMethod === "COD_AMBIL_SENDIRI" ? "Bayar langsung ke petani di ladang" : "Dibayar langsung ke petani saat barang tiba"}
                      </p>
                    </div>
                    <span className="text-xl font-bold text-emerald-400 text-right truncate">
                      Rp {totalPrice.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <p className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">Rincian Transparan</p>
                  <div className="flex justify-between items-center text-sm gap-2">
                    <span className="text-slate-600 min-w-0 truncate">Harga Bahan Pangan ({inputQuantityKg || 0} Kg)</span>
                    <span className="font-semibold text-slate-900 shrink-0 truncate">Rp {foodPrice.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm gap-2">
                    <span className="text-slate-600 min-w-0 truncate">Ongkir Antar Petani</span>
                    <span className={`font-semibold shrink-0 truncate ${freightCost === 0 ? "text-emerald-600" : "text-slate-900"}`}>
                      {procurementMethod === "COD_AMBIL_SENDIRI" ? "Rp 0 (Ambil Sendiri)" : `Rp ${freightCost.toLocaleString("id-ID")}`}
                    </span>
                  </div>
                  <div className="border-t border-slate-200 pt-2 flex justify-between items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm min-w-0 truncate">Total</span>
                    <span className="font-bold text-emerald-700 text-base shrink-0 truncate">Rp {totalPrice.toLocaleString("id-ID")}</span>
                  </div>
                  <p className="text-[10px] text-slate-600 pt-1">
                    {procurementMethod === "COD_AMBIL_SENDIRI"
                      ? "Anda bertemu petani langsung di ladang. Tidak ada biaya pengiriman."
                      : "Ongkir dihitung adil: Rp 4.000 + Rp 1.200/km + Rp 150/kg. Dibayarkan langsung ke petani."}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedSupplier(null)}
                  className="flex-1 py-3 border border-slate-300 rounded-xl text-slate-700 font-semibold text-sm hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingCheckout}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3.5 font-bold text-sm shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
                  {submittingCheckout ? "Memproses..." : procurementMethod === "COD_AMBIL_SENDIRI" ? "Kirim Permintaan (COD)" : "Kirim ke Petani"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
