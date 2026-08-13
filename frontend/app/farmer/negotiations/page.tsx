"use client";
import { useEffect, useState } from "react";
import { getFarmerNegotiations, decideNegotiation, getSession, type FarmerNegotiation } from "@/lib/api";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Info,
  HandCoins,
  Package,
  Truck,
  Store,
  AlertTriangle,
  Globe,
  Loader2,
} from "lucide-react";
import WaContactButton from "@/components/WaContactButton";

const rupiah = (n: number) => `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;

export default function FarmerNegotiationsPage() {
  const [negotiations, setNegotiations] = useState<FarmerNegotiation[]>([]);
  const [summary, setSummary] = useState({ total: 0, pending: 0, negoCount: 0 });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [rejectTarget, setRejectTarget] = useState<FarmerNegotiation | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<"PENDING" | "ALL">("PENDING");

  function loadNegotiations() {
    setLoading(true);
    setMsg("");
    const session = getSession();
    const farmerId = session?.id ?? 1;

    getFarmerNegotiations(farmerId)
      .then(res => {
        setNegotiations(Array.isArray(res?.data) ? res.data : []);
        if (res?.summary) setSummary(res.summary);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadNegotiations();
  }, []);

  const isPending = (s: string) =>
    s === "WAITING_FARMER_NEGO_APPROVAL" || s === "PENDING_FARMER_CONFIRMATION";

  async function handleDecision(id: string, action: "ACCEPT" | "REJECT", reason?: string) {
    setSubmitting(true);
    try {
      const res = await decideNegotiation(id, action, reason);
      setMsg(`✓ ${res.message}`);
      setRejectTarget(null);
      setRejectionReason("");
      loadNegotiations();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? `✗ ${err.message}` : "Gagal memproses keputusan.");
    } finally {
      setSubmitting(false);
    }
  }

  const visible = filter === "PENDING" ? negotiations.filter(n => isPending(n.status)) : negotiations;

  function statusBadge(n: FarmerNegotiation) {
    if (n.status === "ACCEPTED")
      return (
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Disetujui
        </span>
      );
    if (n.status === "REJECTED")
      return (
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
          <XCircle className="w-3.5 h-3.5" /> Ditolak
        </span>
      );
    if (n.status === "COMPLETED")
      return (
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
          Selesai
        </span>
      );
    return (
      <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
        <Loader2 className="w-3.5 h-3.5" /> Menunggu Keputusan
      </span>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-2xl p-8 flex justify-between items-center shadow-lg flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Kelola Penawaran &amp; Nego</h1>
          <p className="text-emerald-100 text-base">
            Semua tawaran dari UMKM Kuliner — masuk via Web maupun WhatsApp Bot.
          </p>
          <div className="flex gap-4 mt-3 text-sm">
            <span className="bg-white/10 px-3 py-1 rounded-lg">
              Perlu Keputusan: <b>{summary.pending}</b>
            </span>
            <span className="bg-white/10 px-3 py-1 rounded-lg">
              Nego Harga: <b>{summary.negoCount}</b>
            </span>
            <span className="bg-white/10 px-3 py-1 rounded-lg">
              Total: <b>{summary.total}</b>
            </span>
          </div>
        </div>
        <button
          onClick={loadNegotiations}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-sm transition"
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

      {/* Filter */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setFilter("PENDING")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
            filter === "PENDING" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          Perlu Keputusan ({summary.pending})
        </button>
        <button
          onClick={() => setFilter("ALL")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
            filter === "ALL" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          Semua Riwayat ({summary.total})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500 font-medium">
          <Info className="w-8 h-8 text-slate-600 mx-auto mb-2" strokeWidth={2} />
          {filter === "PENDING"
            ? "Tidak ada penawaran yang menunggu keputusan Anda."
            : "Belum ada penawaran atau nego masuk."}
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map(n => (
            <div
              key={n.id}
              className={`bg-white rounded-2xl shadow-sm border p-6 space-y-4 ${
                n.status === "REJECTED" ? "border-rose-200" : "border-slate-200"
              }`}
            >
              {/* Head */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        n.isNego
                          ? "text-amber-700 bg-amber-50 border border-amber-200"
                          : "text-emerald-700 bg-emerald-50 border border-emerald-200"
                      }`}
                    >
                      {n.isNego ? "⚠️ Pengajuan Nego Harga" : "📦 Pesanan Standar"}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 inline-flex items-center gap-1">
                      {n.source === "PUBLIC_OFFER" ? (
                        <>
                          <Globe className="w-3 h-3" /> Marketplace Publik
                        </>
                      ) : (
                        <>
                          <Package className="w-3 h-3" /> UMKM Terdaftar
                        </>
                      )}
                    </span>
                    {statusBadge(n)}
                  </div>

                  <h3 className="font-bold text-slate-900 text-lg">
                    {n.quantityKg} Kg {n.commodityName}
                  </h3>
                  <p className="text-sm text-slate-500">
                    Pembeli: <strong className="text-slate-800">{n.buyerName}</strong>
                    {n.buyerRegion ? ` • ${n.buyerRegion}` : ""}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-slate-600">Tawaran Harga / Kg</p>
                  <p className="text-2xl font-extrabold text-emerald-600">{rupiah(n.pricePerKg)}</p>
                  {n.isNego && n.originalPricePerKg > 0 && (
                    <p className="text-xs text-slate-600 line-through">
                      Normal: {rupiah(n.originalPricePerKg)}
                    </p>
                  )}
                  {n.isNego && n.originalPricePerKg > n.pricePerKg && (
                    <p className="text-[11px] font-semibold text-rose-600 mt-0.5">
                      Turun {rupiah(n.originalPricePerKg - n.pricePerKg)}/Kg (
                      {Math.round(((n.originalPricePerKg - n.pricePerKg) / n.originalPricePerKg) * 100)}%)
                    </p>
                  )}
                </div>
              </div>

              {/* Ringkasan */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 rounded-xl p-4 border border-slate-100 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Total Diterima</p>
                  <p className="font-bold text-slate-900">{rupiah(n.grandTotal)}</p>
                </div>
                {n.deliveryMethod && (
                  <div>
                    <p className="text-xs text-slate-500">Pengiriman</p>
                    <p className="font-semibold text-slate-900 inline-flex items-center gap-1">
                      {n.deliveryMethod === "COD_AMBIL_SENDIRI" ? (
                        <>
                          <Store className="w-3.5 h-3.5" /> Diambil UMKM
                        </>
                      ) : (
                        <>
                          <Truck className="w-3.5 h-3.5" /> Diantar ({rupiah(n.deliveryFee ?? 0)})
                        </>
                      )}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-500">Masuk</p>
                  <p className="font-semibold text-slate-900">
                    {new Date(n.createdAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              {/* Catatan nego */}
              {n.isNego && n.negoReason && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                  <strong className="block text-amber-800 mb-1 flex items-center gap-1">
                    <HandCoins className="w-4 h-4 text-amber-600" />
                    Catatan Nego dari Pembeli:
                  </strong>
                  <p className="italic bg-white/70 p-2 rounded-lg border border-amber-100">
                    &quot;{n.negoReason}&quot;
                  </p>
                </div>
              )}

              {/* Alasan penolakan */}
              {n.status === "REJECTED" && (
                <div className="bg-rose-50/80 border border-rose-200/80 rounded-xl p-3 text-xs text-rose-900">
                  <strong className="block text-rose-800 mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Alasan Penolakan Anda:
                  </strong>
                  <p className="italic bg-white/70 p-2 rounded-lg border border-rose-100 text-rose-950">
                    &quot;{n.rejectionReason || "Maaf, pesanan belum dapat dipenuhi saat ini."}&quot;
                  </p>
                  {n.source === "UMKM_ORDER" && (
                    <p className="mt-2 text-[11px] text-slate-500">
                      Stok {n.quantityKg} Kg telah dikembalikan ke Radar PetaniKita.
                    </p>
                  )}
                </div>
              )}

              {/* Aksi */}
              <div className="flex items-center gap-3 flex-wrap pt-1">
                {n.buyerPhone && (
                  <WaContactButton phone={n.buyerPhone} name={n.buyerName} label="Hubungi Pembeli" />
                )}

                {isPending(n.status) && (
                  <>
                    <button
                      onClick={() => handleDecision(n.id, "ACCEPT")}
                      disabled={submitting}
                      className="flex-1 min-w-[170px] bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Setujui Penawaran
                    </button>
                    <button
                      onClick={() => {
                        setRejectTarget(n);
                        setRejectionReason("");
                      }}
                      disabled={submitting}
                      className="flex-1 min-w-[150px] bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-sm font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Tolak Nego
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Alasan Penolakan */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Alasan Penolakan</h3>
              <p className="text-xs text-slate-500 mt-1">
                Tuliskan alasan secara jelas — akan diteruskan langsung ke WhatsApp{" "}
                <b>{rejectTarget.buyerName}</b>.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700">
              {rejectTarget.quantityKg} Kg <b>{rejectTarget.commodityName}</b> @{" "}
              {rupiah(rejectTarget.pricePerKg)}/Kg
            </div>

            <textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="Contoh: Maaf, harga di bawah biaya operasional/pupuk ladang kami."
              className="w-full text-sm p-3 border border-slate-200 rounded-xl h-24 focus:ring-2 focus:ring-rose-500 focus:outline-none text-slate-900"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setRejectTarget(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm py-2.5 rounded-xl font-semibold transition"
              >
                Batal
              </button>
              <button
                onClick={() => handleDecision(rejectTarget.id, "REJECT", rejectionReason)}
                disabled={submitting || !rejectionReason.trim()}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-sm py-2.5 rounded-xl font-bold disabled:opacity-50 transition"
              >
                {submitting ? "Memproses..." : "Kirim Penolakan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
