"use client";
import { useEffect, useState } from "react";
import { getProcurementLedger, addManualLedger, deleteManualLedger, getSession } from "@/lib/api";
import { Wallet, PlusCircle, CheckCircle2, Trash2, ShoppingBag, Receipt, RefreshCw } from "lucide-react";

export default function ProcurementLedgerPage() {
  const [ledgerData, setLedgerData] = useState<{
    totalAmountRp: number;
    totalAutoRp: number;
    totalManualRp: number;
    entries: any[];
  }>({ totalAmountRp: 0, totalAutoRp: 0, totalManualRp: 0, entries: [] });

  const [form, setForm] = useState({
    item_name: "",
    category: "Bahan Pangan Utama",
    amount_rp: "",
    vendor_name: "",
    entry_date: new Date().toISOString().split("T")[0],
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  function loadLedger() {
    setLoading(true); setMsg("");
    const session = getSession();
    const userId = session?.id ?? 2;

    getProcurementLedger(userId)
      .then(data => setLedgerData(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadLedger(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setMsg("");
    const session = getSession();

    try {
      const res = await addManualLedger({
        user_id: session?.id ?? 2,
        item_name: form.item_name,
        category: form.category,
        amount_rp: parseFloat(form.amount_rp),
        vendor_name: form.vendor_name,
        entry_date: form.entry_date,
      });
      setMsg(res.message);
      setForm({ item_name: "", category: "Bahan Pangan Utama", amount_rp: "", vendor_name: "", entry_date: new Date().toISOString().split("T")[0] });
      loadLedger();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? `✗ ${err.message}` : "Gagal mencatat pengeluaran");
    } finally { setSubmitting(false); }
  }

  async function handleDeleteEntry(dbId: number) {
    try {
      const res = await deleteManualLedger(dbId);
      setMsg(res.message);
      loadLedger();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? `✗ ${err.message}` : "Gagal menghapus catatan");
    }
  }

  return (
    <div className="flex-1 w-full bg-slate-50 min-h-screen p-6 overflow-y-auto space-y-6">
      {/* Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-xs border border-slate-200/80">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Pembukuan Kas &amp; Arus Pengeluaran UMKM</h1>
          <p className="text-slate-600 text-sm">Rekapitulasi otomatis dari transaksi PetaniKita &amp; pencatatan belanja manual</p>
        </div>
        <button
          onClick={loadLedger}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} strokeWidth={2} />
          Refresh
        </button>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6">
          <div className="flex justify-between items-start mb-2">
            <p className="text-slate-600 text-sm font-medium">Total Pengeluaran Bulan Ini</p>
            <Wallet className="w-5 h-5 text-slate-600" strokeWidth={2} />
          </div>
          <p className="text-3xl font-bold text-slate-900">Rp {ledgerData.totalAmountRp.toLocaleString("id-ID")}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6">
          <div className="flex justify-between items-start mb-2">
            <p className="text-slate-600 text-sm font-medium">Transaksi via PetaniKita</p>
            <ShoppingBag className="w-5 h-5 text-emerald-600" strokeWidth={2} />
          </div>
          <p className="text-3xl font-bold text-emerald-700">Rp {ledgerData.totalAutoRp.toLocaleString("id-ID")}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6">
          <div className="flex justify-between items-start mb-2">
            <p className="text-slate-600 text-sm font-medium">Belanja Manual Luar PetaniKita</p>
            <Receipt className="w-5 h-5 text-slate-600" strokeWidth={2} />
          </div>
          <p className="text-3xl font-bold text-slate-800">Rp {ledgerData.totalManualRp.toLocaleString("id-ID")}</p>
        </div>
      </div>

      {msg && (
        <div className={`p-4 rounded-xl text-sm font-semibold ${msg.startsWith("✓") ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
          {msg}
        </div>
      )}

      {/* Dual Panel Layout */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Panel Kiri: Form Input Manual */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 space-y-6 h-fit">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-emerald-600" strokeWidth={2} />
            Catat Pengeluaran Manual
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">
                Nama Bahan / Barang *
              </label>
              <input
                required
                placeholder="misal: Beli Garam 5 Pack"
                value={form.item_name}
                onChange={e => setForm({ ...form, item_name: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">
                Kategori Pengeluaran *
              </label>
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 font-medium focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              >
                <option value="Bahan Pangan Utama">Bahan Pangan Utama</option>
                <option value="Bumbu & Rempah">Bumbu &amp; Rempah</option>
                <option value="Operasional & Transport">Operasional &amp; Transport</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">
                Nominal Pengeluaran (Rp) *
              </label>
              <input
                required
                type="number"
                placeholder="15000"
                value={form.amount_rp}
                onChange={e => setForm({ ...form, amount_rp: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">
                Nama Vendor / Toko (Opsional)
              </label>
              <input
                placeholder="Toko Kelontong Pak Eko"
                value={form.vendor_name}
                onChange={e => setForm({ ...form, vendor_name: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">
                Tanggal Transaksi *
              </label>
              <input
                required
                type="date"
                value={form.entry_date}
                onChange={e => setForm({ ...form, entry_date: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3.5 font-bold text-sm shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" strokeWidth={2} />
              {submitting ? "Mencatat..." : "Catat Pengeluaran Kas"}
            </button>
          </form>
        </div>

        {/* Panel Kanan: Tabel Arus Kas Gabungan */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 space-y-6">
          <h2 className="text-xl font-bold text-slate-900">Arus Kas Pembukuan</h2>

          {loading ? (
            <div className="p-8 text-center text-slate-500 font-medium">
              ⏳ Memuat arus kas...
            </div>
          ) : ledgerData.entries.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-medium bg-slate-50 rounded-xl border border-slate-200">
              Belum ada catatan pengeluaran kas. Silakan tambah via form di sebelah kiri.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="bg-slate-100 text-slate-600 font-semibold text-xs uppercase tracking-wider py-3.5 px-4 text-left">Tanggal</th>
                    <th className="bg-slate-100 text-slate-600 font-semibold text-xs uppercase tracking-wider py-3.5 px-4 text-left">Deskripsi &amp; Vendor</th>
                    <th className="bg-slate-100 text-slate-600 font-semibold text-xs uppercase tracking-wider py-3.5 px-4 text-left">Sumber</th>
                    <th className="bg-slate-100 text-slate-600 font-semibold text-xs uppercase tracking-wider py-3.5 px-4 text-left">Nominal</th>
                    <th className="bg-slate-100 text-slate-600 font-semibold text-xs uppercase tracking-wider py-3.5 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {ledgerData.entries.map(e => (
                    <tr key={e.id} className="border-b border-slate-200/80 hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 text-slate-700 font-medium">{e.date}</td>
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900">{e.item}</p>
                        <p className="text-xs text-slate-500">{e.vendor} • {e.category}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                          e.source === "PetaniKita_Auto"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}>
                          {e.source === "PetaniKita_Auto" ? "PetaniKita Auto" : "Manual Input"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        Rp {e.amountRp.toLocaleString("id-ID")}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {e.source === "Manual_Input" ? (
                          <button
                            onClick={() => handleDeleteEntry(e.dbId)}
                            className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" strokeWidth={2} />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-600 font-medium">Auto Lock</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
