"use client";
import { useEffect, useState } from "react";
import { getFarmerOrders, farmerRespondToOrder, getSession } from "@/lib/api";
import { CheckCircle2, RefreshCw, XCircle, AlertTriangle, HandCoins, Truck, Store } from "lucide-react";
import WaContactButton from "@/components/WaContactButton";

interface OrderItem {
  id: number;
  buyer: string;
  buyerPhone?: string;
  commodity: string;
  kg: number;
  total: number;
  status: string;
  pricePerKg?: number;
  originalPricePerKg?: number;
  isNego?: boolean;
  negoReason?: string;
  rejectionReason?: string;
  deliveryMethod?: string;
  deliveryFee?: number;
  created_at: string;
}

const rupiah = (n: number) => `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;

export default function FarmerOrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function loadOrders() {
    setLoading(true);
    setMsg("");
    const session = getSession();
    const farmerId = session?.id ?? 1;

    getFarmerOrders(farmerId)
      .then(data => setOrders(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function handleAccept(orderId: number) {
    setSubmitting(true);
    try {
      const res = await farmerRespondToOrder(orderId, "ACCEPT");
      setMsg(`✓ ${res.message}`);
      loadOrders();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? `✗ ${err.message}` : "Gagal menyetujui pesanan");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject(orderId: number) {
    setSubmitting(true);
    try {
      const res = await farmerRespondToOrder(orderId, "REJECT", rejectReason);
      setMsg(`✓ ${res.message}`);
      setRejectingId(null);
      setRejectReason("");
      loadOrders();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? `✗ ${err.message}` : "Gagal menolak pesanan");
    } finally {
      setSubmitting(false);
    }
  }

  const isPending = (s: string) =>
    s === "PENDING_FARMER_CONFIRMATION" || s === "WAITING_FARMER_NEGO_APPROVAL";

  function statusBadge(status: string) {
    if (status === "REJECTED")
      return (
        <span className="bg-rose-100 text-rose-700 text-xs font-bold px-3 py-1 rounded-full border border-rose-200 inline-flex items-center gap-1">
          <XCircle className="w-3.5 h-3.5" /> Ditolak
        </span>
      );
    if (status === "ACCEPTED")
      return (
        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200 inline-flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Disetujui
        </span>
      );
    if (status === "COMPLETED")
      return (
        <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1 rounded-full border border-slate-200">
          Selesai
        </span>
      );
    if (status === "WAITING_FARMER_NEGO_APPROVAL")
      return (
        <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full border border-amber-200 inline-flex items-center gap-1">
          <HandCoins className="w-3.5 h-3.5" /> Nego — Perlu Persetujuan
        </span>
      );
    return (
      <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full border border-blue-200">
        Menunggu Konfirmasi Anda
      </span>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center bg-white p-8 rounded-2xl shadow-sm border border-slate-200 gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 truncate">Kelola Pesanan Langsung</h1>
          <p className="text-slate-600 text-base truncate">
            Pesanan langsung dari UMKM Kuliner. Setujui atau tolak dengan alasan yang jelas.
          </p>
        </div>
        <button
          onClick={loadOrders}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} strokeWidth={2} />
          Refresh
        </button>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl text-base font-semibold ${
            msg.startsWith("✓")
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {msg}
        </div>
      )}

      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500 font-medium">
          ⏳ Memuat pesanan...
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500 font-medium">
          Belum ada pesanan masuk dari UMKM.
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(o => (
            <div
              key={o.id}
              className={`bg-white rounded-2xl shadow-sm border p-6 space-y-4 ${
                o.status === "REJECTED" ? "border-rose-200" : "border-slate-200"
              }`}
            >
              {/* Header */}
              <div className="flex justify-between items-start gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono font-bold text-slate-900">#ORD-{o.id}</span>
                    {statusBadge(o.status)}
                  </div>
                  <p className="text-sm text-slate-600">
                    Pembeli: <span className="font-semibold text-slate-900">{o.buyer}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Total Diterima</p>
                  <p className="text-xl font-bold text-emerald-700">{rupiah(o.total)}</p>
                </div>
              </div>

              {/* Detail */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Komoditas</p>
                  <p className="font-semibold text-slate-900 truncate">{o.commodity}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Kuantitas</p>
                  <p className="font-semibold text-slate-900">{o.kg} Kg</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Harga / Kg</p>
                  <p className="font-semibold text-slate-900 truncate">{rupiah(o.pricePerKg ?? 0)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Pengiriman</p>
                  <p className="font-semibold text-slate-900 inline-flex items-center gap-1 truncate">
                    {o.deliveryMethod === "COD_AMBIL_SENDIRI" ? (
                      <>
                        <Store className="w-3.5 h-3.5" /> Diambil UMKM
                      </>
                    ) : (
                      <>
                        <Truck className="w-3.5 h-3.5" /> Diantar ({rupiah(o.deliveryFee ?? 0)})
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Banner Nego */}
              {o.isNego && (
                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                  <p className="font-semibold text-amber-800 mb-1 flex items-center gap-1">
                    <HandCoins className="w-4 h-4 text-amber-600" />
                    UMKM Mengajukan Nego Harga
                  </p>
                  <p>
                    Harga asli <b>{rupiah(o.originalPricePerKg ?? 0)}</b> → ditawar{" "}
                    <b>{rupiah(o.pricePerKg ?? 0)}</b> / Kg
                  </p>
                  {o.negoReason && (
                    <p className="italic bg-white/70 mt-2 p-2 rounded-lg border border-amber-100">
                      &quot;{o.negoReason}&quot;
                    </p>
                  )}
                </div>
              )}

              {/* Banner Penolakan */}
              {o.status === "REJECTED" && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">
                    Stok {o.kg} Kg telah dikembalikan ke Radar PetaniKita.
                  </p>
                  <div className="bg-rose-50/80 border border-rose-200/80 rounded-xl p-3 text-xs text-rose-900">
                    <p className="font-semibold text-rose-800 mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      Alasan Penolakan Anda:
                    </p>
                    <p className="italic bg-white/70 p-2 rounded-lg border border-rose-100 text-rose-950">
                      &quot;{o.rejectionReason || "Maaf, pesanan belum dapat dipenuhi saat ini."}&quot;
                    </p>
                  </div>
                </div>
              )}

              {/* Aksi */}
              <div className="flex items-center gap-3 flex-wrap pt-1">
                {o.buyerPhone && <WaContactButton phone={o.buyerPhone} name={o.buyer} label="Hubungi Pembeli" />}

                {isPending(o.status) && rejectingId !== o.id && (
                  <>
                    <button
                      onClick={() => handleAccept(o.id)}
                      disabled={submitting}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
                      Terima Pesanan
                    </button>
                    <button
                      onClick={() => {
                        setRejectingId(o.id);
                        setRejectReason("");
                      }}
                      disabled={submitting}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs transition inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" strokeWidth={2} />
                      Tolak
                    </button>
                  </>
                )}
              </div>

              {/* Form alasan penolakan */}
              {rejectingId === o.id && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-3">
                  <label className="text-xs font-semibold text-rose-900 block">
                    Alasan Penolakan (akan diteruskan ke UMKM via WhatsApp)
                  </label>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Contoh: Maaf tanaman tersapu banjir di ladang"
                    className="w-full border border-rose-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-rose-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(o.id)}
                      disabled={submitting}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition disabled:opacity-50"
                    >
                      {submitting ? "Memproses..." : "Kirim Penolakan"}
                    </button>
                    <button
                      onClick={() => setRejectingId(null)}
                      className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl font-semibold text-xs hover:bg-white transition"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
