"use client";
import { useEffect, useState } from "react";
import { getRegionalPrices, getCurrentUser, proposePrice, getSession, scrapePriceAI, getMultiRegionPrices, PriceRecord, PriceResponse } from "@/lib/api";
import { TrendingUp, TrendingDown, Minus, RefreshCw, Database, Sparkles, MapPin, HandCoins, X, CheckCircle2, Bot, Globe2, Loader2 } from "lucide-react";

export default function FarmerPricesPage() {
  const [data, setData] = useState<PriceResponse | null>(null);
  const [regionName, setRegionName] = useState("Kabupaten Sleman");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal State Proposal
  const [selectedCommodity, setSelectedCommodity] = useState<PriceRecord | null>(null);
  const [proposedPrice, setProposedPrice] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalMsg, setModalMsg] = useState("");

  // AI Scraping State
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState("");
  const [multiRegionData, setMultiRegionData] = useState<Array<{ regionName: string; farmerPrice: number; umkmPrice: number; hapPrice: number; trend: string }> | null>(null);
  const [showMultiRegion, setShowMultiRegion] = useState(false);

  function loadPrices(region?: string) {
    setLoading(true); setError("");
    const targetRegion = region || regionName;

    getRegionalPrices(targetRegion)
      .then(res => setData(res))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    getCurrentUser()
      .then(u => {
        if (u.regionName) {
          setRegionName(u.regionName);
          loadPrices(u.regionName);
        } else {
          loadPrices();
        }
      })
      .catch(() => loadPrices());
  }, []);

  // AI Price Scraping
  async function handleAIScrape() {
    if (!data?.prices?.length) return;
    setScraping(true);
    setScrapeMsg("");

    try {
      const results = [];
      for (const p of data.prices) {
        const res = await scrapePriceAI(p.commodity, regionName);
        if (res.success && res.data) {
          results.push(res.data);
        }
        await new Promise(r => setTimeout(r, 300));
      }
      setScrapeMsg(`✓ Berhasil scraping ${results.length} komoditas dengan AI!`);
      loadPrices();
    } catch {
      setScrapeMsg("✗ Gagal scraping. Coba lagi.");
    } finally {
      setScraping(false);
    }
  }

  async function handleMultiRegionView(commodity: string) {
    setShowMultiRegion(true);
    try {
      const res = await getMultiRegionPrices(commodity);
      if (res.success) {
        setMultiRegionData(res.data);
      }
    } catch {
      setMultiRegionData(null);
    }
  }

  function handleOpenProposal(p: PriceRecord) {
    setSelectedCommodity(p);
    setProposedPrice(String(p.farmer_price + 2000));
    setReason("Biaya pupuk & operasional mengalami kenaikan");
    setModalMsg("");
  }

  async function handleSendProposal(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCommodity) return;
    setSubmitting(true); setModalMsg("");
    const session = getSession();

    try {
      const res = await proposePrice({
        user_id: session?.id ?? 1,
        regionName: data?.regionName || regionName,
        commodity: selectedCommodity.commodity,
        proposed_price: parseFloat(proposedPrice),
        reason,
      });
      setModalMsg(`✓ ${res.message}`);
      setTimeout(() => setSelectedCommodity(null), 1500);
    } catch (err: unknown) {
      setModalMsg(err instanceof Error ? `✗ ${err.message}` : "Gagal mengajukan harga");
    } finally { setSubmitting(false); }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold text-slate-900">Acuan Harga Pangan Regional</h1>
            {data && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                data.status === "Data_Terverifikasi_12H"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "bg-amber-100 text-amber-800 border border-amber-300"
              }`}>
                {data.status === "Data_Terverifikasi_12H" ? (
                  <>
                    <Database className="w-3.5 h-3.5" strokeWidth={2} />
                    Data Terverifikasi (0 Token)
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
                    Live 9Router AI Fetch
                  </>
                )}
              </span>
            )}
          </div>
          <p className="text-slate-600 text-base flex items-center gap-1">
            <MapPin className="w-4 h-4 text-emerald-600 inline" strokeWidth={2} />
            Wilayah: <span className="font-semibold text-slate-800">{data?.regionName || regionName}</span>
            {data?.updated_at && (
              <span className="text-xs text-slate-600 ml-2">
                • Diperbarui: {new Date(data.updated_at).toLocaleTimeString("id-ID")} WIB
              </span>
            )}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleAIScrape}
            disabled={scraping || loading}
            className="inline-flex items-center gap-2 px-5 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-sm shadow-md shadow-violet-600/20 transition disabled:opacity-50"
          >
            {scraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
            {scraping ? "Scraping AI..." : "Scrape Harga AI"}
          </button>

          <button
            onClick={() => loadPrices()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} strokeWidth={2} />
            {loading ? "Memuat..." : "Refresh Harga"}
          </button>
        </div>
      </div>

      {/* Scrape Message */}
      {scrapeMsg && (
        <div className={`p-4 rounded-2xl font-medium text-sm ${scrapeMsg.startsWith("✓") ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-rose-50 border border-rose-200 text-rose-700"}`}>
          {scrapeMsg}
        </div>
      )}

      {loading && (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center">
          <p className="text-slate-500 font-medium text-base">⏳ Memuat data harga pasar terverifikasi / 9Router AI...</p>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl text-rose-700 font-medium">
          <p>Gagal memuat harga: {error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.prices.map((p: PriceRecord) => {
            const diff = p.diff ?? (p.farmer_price - p.prev_price);
            const diffPct = p.diffPct ?? (p.prev_price > 0 ? (diff / p.prev_price) * 100 : 0);
            const isUp = diff > 0;
            const isDown = diff < 0;

            return (
              <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{p.commodity}</h3>
                      <p className="text-xs text-slate-500">Harga Per Kg (Tingkat Petani)</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                      isUp ? "bg-emerald-100 text-emerald-800"
                      : isDown ? "bg-rose-100 text-rose-800"
                      : "bg-slate-100 text-slate-700"
                    }`}>
                      {isUp && <TrendingUp className="w-3.5 h-3.5" strokeWidth={2} />}
                      {isDown && <TrendingDown className="w-3.5 h-3.5" strokeWidth={2} />}
                      {!isUp && !isDown && <Minus className="w-3.5 h-3.5" strokeWidth={2} />}
                      {isUp ? `+${diffPct}%` : isDown ? `${diffPct}%` : "Stabil"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Harga Hari Ini</p>
                      <p className="text-2xl font-bold text-slate-900">Rp {p.farmer_price.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Harga Kemarin</p>
                      <p className="text-lg font-semibold text-slate-600 mt-1">Rp {p.prev_price.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                    <span>Harga UMKM: Rp {p.umkm_price.toLocaleString()}</span>
                    <span>HAP: Rp {p.hap_price.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleOpenProposal(p)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 rounded-xl font-bold text-xs transition"
                  >
                    <HandCoins className="w-4 h-4" strokeWidth={2} />
                    Ajuin Harga
                  </button>
                  <button
                    onClick={() => handleMultiRegionView(p.commodity)}
                    className="flex items-center justify-center gap-1 px-3 py-2.5 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-xl font-bold text-xs transition"
                    title="Lihat harga di semua daerah"
                  >
                    <Globe2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Multi-Region Price Display */}
      {showMultiRegion && multiRegionData && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Perbandingan Harga Multi-Daerah</h3>
              <p className="text-xs text-slate-500">{multiRegionData.length} wilayah terdata</p>
            </div>
            <button onClick={() => setShowMultiRegion(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {multiRegionData.map((item, idx) => (
              <div key={idx} className="border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <p className="text-sm font-bold text-slate-900">{item.regionName}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500">Petani</p>
                    <p className="font-bold text-slate-900">Rp {item.farmerPrice.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">UMKM</p>
                    <p className="font-bold text-emerald-700">Rp {item.umkmPrice.toLocaleString()}</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-[10px] text-slate-400">HAP: Rp {item.hapPrice.toLocaleString()}</span>
                  <span className={`text-[10px] font-bold ${item.trend === "UP" ? "text-emerald-600" : item.trend === "DOWN" ? "text-rose-600" : "text-slate-500"}`}>
                    {item.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Ajuin Penyesuaian Harga */}
      {selectedCommodity && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Ajuin Penyesuaian Harga</h3>
                <p className="text-xs text-emerald-600 font-semibold">{selectedCommodity.commodity} • {data?.regionName || regionName}</p>
              </div>
              <button onClick={() => setSelectedCommodity(null)} className="text-slate-600 hover:text-slate-600 p-1">
                <X className="w-6 h-6" strokeWidth={2} />
              </button>
            </div>

            {modalMsg && (
              <div className={`p-4 rounded-xl text-sm font-semibold ${modalMsg.startsWith("✓") ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
                {modalMsg}
              </div>
            )}

            <form onSubmit={handleSendProposal} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">
                  Harga Acuan Saat Ini
                </label>
                <p className="text-base font-bold text-slate-700 bg-slate-100 p-3 rounded-xl">
                  Rp {selectedCommodity.farmer_price.toLocaleString()} / kg
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">
                  Harga yang Diajukan (Rp/Kg) *
                </label>
                <input
                  required
                  type="number"
                  value={proposedPrice}
                  onChange={e => setProposedPrice(e.target.value)}
                  placeholder="32000"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">
                  Alasan Pengajuan (Opsional)
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="misal: Biaya pupuk naik 20%, cuaca buruk panen berkurang"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCommodity(null)}
                  className="flex-1 py-3 border border-slate-300 rounded-xl text-slate-700 font-semibold text-sm hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3 font-bold text-sm shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
                  {submitting ? "Kirim..." : "Kirim Pengajuan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
