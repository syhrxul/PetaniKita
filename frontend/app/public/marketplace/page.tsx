"use client";
import { useEffect, useState } from "react";
import { getProcurementSuppliers, submitNegotiation } from "@/lib/api";
import { getGoogleMapsPointUrl } from "@/lib/maps";
import { formatRupiah } from "@/lib/format";
import { ShoppingBag, MapPin, Send, X, CheckCircle2, Info, Leaf } from "lucide-react";

export default function PublicMarketplacePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Negotiation Modal State
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [negoForm, setNegoForm] = useState({
    buyer_name: "",
    buyer_phone: "",
    quantity_kg: "",
    proposed_price: "",
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [modalMsg, setModalMsg] = useState("");

  function loadProducts() {
    setLoading(true);
    getProcurementSuppliers(2)
      .then(data => setProducts(Array.isArray(data) ? data : []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadProducts(); }, []);

  function handleOpenNegotiation(p: any) {
    setSelectedProduct(p);
    setNegoForm({ buyer_name: "", buyer_phone: "", quantity_kg: String(p.availableYieldKg ?? 10), proposed_price: String(p.pricePerKg ?? 28000), reason: "" });
    setModalMsg("");
  }

  async function handleSubmitNegotiation(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    setSubmitting(true); setModalMsg("");

    try {
      const res = await submitNegotiation({
        harvest_event_id: selectedProduct.harvestId,
        buyer_name: negoForm.buyer_name,
        buyer_phone: negoForm.buyer_phone,
        commodity: selectedProduct.commodities,
        quantity_kg: parseFloat(negoForm.quantity_kg),
        normal_price: selectedProduct.pricePerKg,
        proposed_price: parseFloat(negoForm.proposed_price),
        reason: negoForm.reason,
      });
      setModalMsg(`✓ ${res.message}`);
      setTimeout(() => setSelectedProduct(null), 1500);
    } catch (err: unknown) {
      setModalMsg(err instanceof Error ? `✗ ${err.message}` : "Gagal mengirim penawaran");
    } finally { setSubmitting(false); }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-green-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Leaf className="w-8 h-8 text-green-700" strokeWidth={2} />
            <div>
              <h1 className="text-2xl font-bold text-green-700">PetaniKita</h1>
              <p className="text-xs text-slate-500">Katalog Pangan Segar Langsung dari Petani</p>
            </div>
          </div>
          <nav className="flex gap-6 text-sm font-medium">
            <a href="/public/marketplace" className="text-green-700">Katalog</a>
            <a href="/auth/login" className="text-slate-600 hover:text-green-700">Masuk</a>
            <a href="/auth/register" className="text-slate-600 hover:text-green-700">Daftar</a>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Katalog Bahan Pangan Segar</h2>
          <p className="text-slate-600">Beli langsung dari petani terdekat. Ajukan nego harga untuk pembelian grosir.</p>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-500 font-medium">⏳ Memuat katalog...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-slate-500 font-medium bg-white rounded-2xl border border-slate-200">
            Belum ada produk panen tersedia saat ini.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map(p => (
              <div key={p.harvestId} className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 flex flex-col justify-between space-y-4 min-w-0">
                <div>
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-slate-900 truncate">{p.commodities}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 min-w-0 truncate">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" strokeWidth={2} />
                        {p.farmerName} • {p.regionName}
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200 shrink-0">
                      {p.distanceKm} km
                    </span>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/60 grid grid-cols-2 gap-3 mb-4">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Harga / Kg</p>
                      <p className="text-xl font-bold text-slate-900 truncate">{formatRupiah(p.pricePerKg)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Stok Tersedia</p>
                      <p className="text-xl font-bold text-emerald-700 truncate">{p.availableYieldKg} Kg</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <a
                    href={getGoogleMapsPointUrl(p.farmerLat ?? -7.7558, p.farmerLng ?? 110.4052, p.farmerName)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold text-xs transition"
                  >
                    <MapPin className="w-4 h-4 text-emerald-600" strokeWidth={2} />
                    Lihat Lokasi
                  </a>
                  <button
                    onClick={() => handleOpenNegotiation(p)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition"
                  >
                    <Send className="w-4 h-4" strokeWidth={2} />
                    Ajukan Nego Harga
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Negotiation Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-6 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Ajukan Nego Harga</h3>
                <p className="text-xs font-semibold text-emerald-700">{selectedProduct.commodities} • {selectedProduct.farmerName}</p>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="text-slate-600 hover:text-slate-600 p-1">
                <X className="w-6 h-6" strokeWidth={2} />
              </button>
            </div>

            {modalMsg && (
              <div className={`p-4 rounded-xl text-sm font-semibold ${modalMsg.startsWith("✓") ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
                {modalMsg}
              </div>
            )}

            <form onSubmit={handleSubmitNegotiation} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center gap-2">
                <span className="text-sm text-slate-600 min-w-0 truncate">Harga Normal:</span>
                <span className="font-bold text-slate-900 shrink-0 truncate">{formatRupiah(selectedProduct.pricePerKg)} / Kg</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">Nama Pembeli *</label>
                  <input required value={negoForm.buyer_name} onChange={e => setNegoForm({ ...negoForm, buyer_name: e.target.value })} placeholder="Nama Anda" className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-600" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">No. WhatsApp *</label>
                  <input required value={negoForm.buyer_phone} onChange={e => setNegoForm({ ...negoForm, buyer_phone: e.target.value })} placeholder="08123456789" className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-600" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">Jumlah (Kg) *</label>
                  <input required type="number" value={negoForm.quantity_kg} onChange={e => setNegoForm({ ...negoForm, quantity_kg: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 font-bold focus:outline-none focus:border-emerald-600" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">Harga Nego (Rp/Kg) *</label>
                  <input required type="number" value={negoForm.proposed_price} onChange={e => setNegoForm({ ...negoForm, proposed_price: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 font-bold focus:outline-none focus:border-emerald-600" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">Catatan Nego (Opsional)</label>
                <textarea rows={3} value={negoForm.reason} onChange={e => setNegoForm({ ...negoForm, reason: e.target.value })} placeholder="misal: Beli grosir 40 kg untuk acara keluarga, mohon diskonnya Pak" className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-600" />
              </div>

              <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3.5 font-bold text-sm shadow-md transition disabled:opacity-50">
                <Send className="w-4 h-4" strokeWidth={2} />
                {submitting ? "Mengirim..." : "Kirim Penawaran Nego ke Petani"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
