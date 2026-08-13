"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUmkmOrders, getSession, updateOrderUmkm } from "@/lib/api";
import { Receipt, RefreshCw, ShoppingBag, CheckCircle2, Clock, MessageCircle, Truck, Sprout, Pencil, X, Save, XCircle, HandCoins, AlertTriangle } from "lucide-react";

interface OrderItem {
  id: number;
  created_at: string;
  supplier?: string;
  commodity?: string;
  kg?: number;
  total_amount: number;
  payment_method?: string;
  status: string;
  amount_kg?: number;
  delivery_fee?: number;
  food_total_price?: number;
  grand_total?: number;
  is_self_pickup?: boolean;
  price_per_kg?: number;
  original_price_per_kg?: number;
  is_nego?: boolean;
  nego_reason?: string | null;
  rejection_reason?: string | null;
  delivery_method?: string;
  distance_km?: number;
  harvest_event?: {
    est_yield_kg?: number;
    crop?: {
      crop_type?: string;
      user?: {
        name?: string;
        phone_number?: string;
      };
    };
  };
  umkm_user?: {
    name?: string;
    phone_number?: string;
  };
}

export default function ProcurementHistoryPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmMsg, setConfirmMsg] = useState("");

  // Edit Modal State (UMKM)
  const [editOrder, setEditOrder] = useState<OrderItem | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState<"ESCROW_ONLINE" | "CASH_COD">("ESCROW_ONLINE");
  const [editSelfPickup, setEditSelfPickup] = useState(false);
  const [editMsg, setEditMsg] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function loadHistory() {
    setLoading(true);
    setConfirmMsg("");
    const session = getSession();
    const umkmId = session?.id ?? 2;
    getUmkmOrders(umkmId)
      .then((data: any) => {
        setOrders(Array.isArray(data) ? data : []);
      })
      .catch((err: unknown) => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadHistory();
  }, []);

  function getStatusBadge(status: string) {
    switch (status) {
      case "PENDING_FARMER_CONFIRMATION":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="w-3.5 h-3.5" strokeWidth={2} />
            MENUNGGU PETANI
          </span>
        );
      case "WAITING_FARMER_NEGO_APPROVAL":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <HandCoins className="w-3.5 h-3.5" strokeWidth={2} />
            NEGO DIAJUKAN
          </span>
        );
      case "ACCEPTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
            DISETUJUI PETANI
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" strokeWidth={2} />
            DITOLAK PETANI
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
            SELESAI
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
            {status}
          </span>
        );
    }
  }

  // UMKM: Open Edit Modal
  function handleOpenEdit(order: OrderItem) {
    setEditOrder(order);
    setEditQty(String(order.amount_kg ?? order.kg ?? 0));
    setEditPaymentMethod((order.payment_method as any) || "ESCROW_ONLINE");
    setEditSelfPickup(order.is_self_pickup ?? false);
    setEditMsg("");
  }

  // UMKM: Submit Edit
  async function handleSubmitEdit() {
    if (!editOrder) return;
    setEditSaving(true);
    setEditMsg("");
    try {
      const res = await updateOrderUmkm({
        orderId: editOrder.id,
        quantityKg: editQty ? parseFloat(editQty) : undefined,
        paymentMethod: editPaymentMethod,
        isSelfPickup: editSelfPickup,
      });
      if (res.success) {
        setEditMsg("Rincian Nota Berhasil Diperbarui!");
        setTimeout(() => {
          setEditOrder(null);
          loadHistory();
        }, 1200);
      } else {
        setEditMsg(`✗ ${res.message}`);
      }
    } catch (err: unknown) {
      setEditMsg(err instanceof Error ? `✗ ${err.message}` : "Gagal memperbarui pesanan");
    } finally {
      setEditSaving(false);
    }
  }

  // Sanitize phone to 62 format
  function sanitizePhone(phone: string): string {
    if (!phone) return "";
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("0")) {
      cleaned = "62" + cleaned.slice(1);
    }
    return cleaned;
  }

  return (
    <div className="flex-1 w-full bg-slate-50 min-h-screen p-6 overflow-y-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-xs border border-slate-200/80">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Riwayat Transaksi &amp; Pembayaran</h1>
          <p className="text-slate-600 text-sm">Daftar transaksi pengadaan bahan baku real-time terhubung resmi.</p>
        </div>
        <button
          onClick={loadHistory}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} strokeWidth={2} />
          Refresh Data
        </button>
      </div>

      {confirmMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-semibold text-sm">
          {confirmMsg}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            <div className="h-8 bg-slate-100 rounded-lg w-full animate-pulse" />
            <div className="h-12 bg-slate-100 rounded-lg w-full animate-pulse" />
            <div className="h-12 bg-slate-100 rounded-lg w-full animate-pulse" />
            <div className="h-12 bg-slate-100 rounded-lg w-full animate-pulse" />
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
            <h3 className="text-lg font-bold text-slate-900 mb-1">Belum Ada Transaksi Pengadaan</h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
              Anda belum melakukan pemesanan bahan baku. Silakan pilih supplier terdekat di menu Restock &amp; Matching.
            </p>
            <Link
              href="/dashboard/procurement"
              className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition shadow-sm"
            >
              <ShoppingBag className="w-4 h-4" strokeWidth={2} />
              Mulai Belanja Bahan Baku
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="bg-slate-100 text-slate-600 font-semibold text-xs uppercase tracking-wider py-3.5 px-4 text-left">ID Transaksi</th>
                  <th className="bg-slate-100 text-slate-600 font-semibold text-xs uppercase tracking-wider py-3.5 px-4 text-left">Tanggal &amp; Waktu</th>
                  <th className="bg-slate-100 text-slate-600 font-semibold text-xs uppercase tracking-wider py-3.5 px-4 text-left">Supplier / Poktan</th>
                  <th className="bg-slate-100 text-slate-600 font-semibold text-xs uppercase tracking-wider py-3.5 px-4 text-left">Komoditas &amp; Berat</th>
                  <th className="bg-slate-100 text-slate-600 font-semibold text-xs uppercase tracking-wider py-3.5 px-4 text-left">Total Pembayaran</th>
                  <th className="bg-slate-100 text-slate-600 font-semibold text-xs uppercase tracking-wider py-3.5 px-4 text-left">Metode &amp; Status</th>
                  <th className="bg-slate-100 text-slate-600 font-semibold text-xs uppercase tracking-wider py-3.5 px-4 text-center">Aksi &amp; Kontak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {orders.map((o) => {
                  const supplierName = o.supplier ?? o.harvest_event?.crop?.user?.name ?? "Poktan Tani Makmur";
                  const commodityName = o.commodity ?? o.harvest_event?.crop?.crop_type ?? "Cabai Rawit Merah";
                  const weightKg = o.amount_kg ?? o.kg ?? o.harvest_event?.est_yield_kg ?? 15;
                  const farmerPhone = sanitizePhone(o.harvest_event?.crop?.user?.phone_number ?? "");

                  return (
                    <tr key={o.id} className="border-b border-slate-200/80 hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-900">#TRX-{o.id}</td>
                      <td className="py-3.5 px-4 text-slate-700">
                        {new Date(o.created_at).toLocaleDateString("id-ID", {
                          day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{supplierName}</td>
                      <td className="py-3.5 px-4 text-slate-800">
                        <span className="font-semibold">{commodityName}</span>
                        <span className="text-slate-500 mx-1.5">&bull;</span>
                        <span className="font-bold text-slate-900">{weightKg} Kg</span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-700">Rp {o.total_amount.toLocaleString("id-ID")}</td>
                      <td className="py-3.5 px-4">{getStatusBadge(o.status)}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 justify-center">
                          {farmerPhone && (
                            <a
                              href={`https://wa.me/${farmerPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200 transition"
                            >
                              <Sprout className="w-3 h-3" strokeWidth={2} />
                              Chat Petani
                            </a>
                          )}
                          {o.status !== "COMPLETED" && o.status !== "REJECTED" && o.status !== "ACCEPTED" && (
                            <button
                              onClick={() => handleOpenEdit(o)}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg border border-amber-200 transition"
                            >
                              <Pencil className="w-3 h-3" strokeWidth={2} />
                              Edit Pesanan
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }).flatMap((row, idx) => {
                  const o = orders[idx];
                  const extras: React.ReactNode[] = [row];

                  if (o.is_nego && o.status !== "REJECTED") {
                    extras.push(
                      <tr key={`nego-${o.id}`} className="bg-amber-50/40">
                        <td colSpan={7} className="px-4 pb-3">
                          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                            <p className="font-semibold text-amber-800 mb-1 flex items-center gap-1">
                              <HandCoins className="w-4 h-4 text-amber-600" />
                              Nego Harga Diajukan
                            </p>
                            <p>
                              Harga asli <b>Rp {(o.original_price_per_kg ?? 0).toLocaleString("id-ID")}</b> → penawaran Anda{" "}
                              <b>Rp {(o.price_per_kg ?? 0).toLocaleString("id-ID")}</b> / Kg
                            </p>
                            {o.nego_reason && (
                              <p className="italic bg-white/70 mt-2 p-2 rounded-lg border border-amber-100">
                                &quot;{o.nego_reason}&quot;
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  if (o.status === "REJECTED") {
                    extras.push(
                      <tr key={`rej-${o.id}`} className="bg-rose-50/40">
                        <td colSpan={7} className="px-4 pb-3">
                          <div className="space-y-2">
                            <p className="text-[11px] text-slate-500">
                              Stok {o.amount_kg ?? o.kg ?? 0} Kg telah dikembalikan ke petani — Anda dapat memesan ke petani lain.
                            </p>
                            <div className="bg-rose-50/80 border border-rose-200/80 rounded-xl p-3 text-xs text-rose-900">
                              <p className="font-semibold text-rose-800 mb-1 flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4 text-rose-600" />
                                Alasan Penolakan Petani:
                              </p>
                              <p className="italic bg-white/70 p-2 rounded-lg border border-rose-100 text-rose-950">
                                &quot;{o.rejection_reason || "Maaf, pesanan belum dapat dipenuhi saat ini."}&quot;
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return extras;
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Edit Order by UMKM */}
      {editOrder && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Edit Pesanan Saya</h3>
                <p className="text-xs font-mono text-emerald-600 font-semibold">TRX-{editOrder.id}</p>
              </div>
              <button onClick={() => setEditOrder(null)} className="text-slate-600 hover:text-slate-600 p-1">
                <X className="w-6 h-6" strokeWidth={2} />
              </button>
            </div>

            {editMsg && (
              <div className={`p-4 rounded-xl text-sm font-semibold ${editMsg.startsWith("✓") ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
                {editMsg}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">Kuantitas (Kg)</label>
                <input
                  type="number"
                  value={editQty}
                  onChange={e => setEditQty(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base text-slate-900 font-semibold focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">Metode Pembayaran</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditPaymentMethod("ESCROW_ONLINE")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border-2 transition ${
                      editPaymentMethod === "ESCROW_ONLINE"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    DP Escrow Online
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPaymentMethod("CASH_COD")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border-2 transition ${
                      editPaymentMethod === "CASH_COD"
                        ? "border-amber-600 bg-amber-50 text-amber-900"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Cash COD
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">Mode Pengambilan</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditSelfPickup(false)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border-2 transition flex items-center justify-center gap-1 ${
                      !editSelfPickup
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" strokeWidth={2} />
                    Pakai Kolektor
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditSelfPickup(true)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border-2 transition flex items-center justify-center gap-1 ${
                      editSelfPickup
                        ? "border-amber-600 bg-amber-50 text-amber-900"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" strokeWidth={2} />
                    Ambil Sendiri
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditOrder(null)}
                className="flex-1 py-3 border border-slate-300 rounded-xl text-slate-700 font-semibold text-sm hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmitEdit}
                disabled={editSaving}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3 font-bold text-sm shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" strokeWidth={2} />
                {editSaving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
