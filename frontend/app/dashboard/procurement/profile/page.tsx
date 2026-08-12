"use client";
import { useEffect, useState } from "react";
import { getUserProfile, updateUserProfile } from "@/lib/api";
import GeolocationInput from "@/components/GeolocationInput";
import { Store, CheckCircle2, User, Phone, Building2 } from "lucide-react";

export default function ProcurementProfilePage() {
  const [form, setForm] = useState({
    name: "",
    business_type: "Warung Makan / Restoran",
    phone_number: "",
    latitude: -7.8014,
    longitude: 110.3644,
    regionName: "Kabupaten Sleman",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function loadProfile() {
    setLoading(true); setMsg("");
    getUserProfile()
      .then(u => {
        setForm({
          name: u.name || "",
          business_type: u.business_type || "Warung Makan / Restoran",
          phone_number: u.phone_number || "",
          latitude: u.latitude ?? -7.8014,
          longitude: u.longitude ?? 110.3644,
          regionName: u.regionName || "Kabupaten Sleman",
        });
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadProfile(); }, []);

  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg("");
    try {
      const res = await updateUserProfile({
        name: form.name,
        business_type: form.business_type,
        phone_number: form.phone_number,
        latitude: form.latitude,
        longitude: form.longitude,
        regionName: form.regionName,
      });
      setMsg(res.message);
    } catch (err: unknown) {
      setMsg(err instanceof Error ? `✗ ${err.message}` : "Gagal memperbarui profil");
    } finally { setSaving(false); }
  }

  return (
    <div className="flex-1 w-full bg-slate-50 min-h-screen p-6 overflow-y-auto space-y-6">
      <div className="bg-white p-8 rounded-2xl shadow-xs border border-slate-200/80 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Profil Usaha &amp; Lokasi Geospasial UMKM</h1>
          <p className="text-slate-600 text-base">Pengaturan identitas outlet &amp; titik lokasi untuk pencocokan supplier terdekat</p>
        </div>
        <Store className="w-10 h-10 text-teal-600" strokeWidth={2} />
      </div>

      {msg && (
        <div className={`p-4 rounded-xl text-base font-semibold ${msg.startsWith("✓") ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
          {msg}
        </div>
      )}

      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500 font-medium">
          ⏳ Memuat profil usaha...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card 1: Identitas Usaha */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-8 space-y-6">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-teal-600" strokeWidth={2} />
              Identitas Usaha UMKM / Hotel
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">
                  Nama Pemilik / Pengelola *
                </label>
                <div className="relative">
                  <input
                    required
                    value={form.name}
                    onChange={e => set("name", e.target.value)}
                    placeholder="Bu Ambo"
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                  />
                  <User className="w-5 h-5 text-slate-600 absolute right-4 top-3.5" strokeWidth={2} />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">
                  Jenis Usaha *
                </label>
                <select
                  value={form.business_type}
                  onChange={e => set("business_type", e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base text-slate-900 font-medium focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                >
                  <option value="Warung Makan / Restoran">Warung Makan / Restoran</option>
                  <option value="Hotel">Hotel</option>
                  <option value="Catering">Catering</option>
                  <option value="Industri Olahan Pangan">Industri Olahan Pangan</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider block mb-2">
                  No. WhatsApp / Kontak Usaha *
                </label>
                <div className="relative">
                  <input
                    required
                    value={form.phone_number}
                    onChange={e => set("phone_number", e.target.value)}
                    placeholder="081234567892"
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                  />
                  <Phone className="w-5 h-5 text-slate-600 absolute right-4 top-3.5" strokeWidth={2} />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Universal Geolocation Input */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-8 space-y-6">
            <h2 className="text-xl font-bold text-slate-900">Lokasi Geospasial Outlet</h2>

            <GeolocationInput
              initialLatitude={form.latitude}
              initialLongitude={form.longitude}
              initialRegionName={form.regionName}
              onChange={({ latitude, longitude, regionName }) => {
                setForm(f => ({ ...f, latitude, longitude, regionName }));
              }}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-4 font-bold text-base shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
          >
            <CheckCircle2 className="w-5 h-5" strokeWidth={2} />
            {saving ? "Menyimpan..." : "Simpan Perubahan Profil"}
          </button>
        </form>
      )}
    </div>
  );
}
