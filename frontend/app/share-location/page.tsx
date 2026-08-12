"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { updateLocationFromWa } from "@/lib/api";
import { MapPin, CheckCircle, Navigation, Loader2, Lock, Eye, EyeOff, Globe } from "lucide-react";

const REGION_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "Kabupaten Purbalingga": { lat: -7.3891, lng: 109.3644 },
  "Kabupaten Sleman": { lat: -7.7156, lng: 110.3553 },
  "Kabupaten Banyumas": { lat: -7.4278, lng: 109.2444 },
  "Kabupaten Cilacap": { lat: -7.7269, lng: 109.0069 },
  "Kabupaten Magelang": { lat: -7.4706, lng: 110.2178 },
  "Kabupaten Boyolali": { lat: -7.5306, lng: 110.5964 },
  "Kabupaten Klaten": { lat: -7.7056, lng: 110.6044 },
  "Kabupaten Bantul": { lat: -7.8894, lng: 110.3289 },
  "Kabupaten Gunungkidul": { lat: -7.9625, lng: 110.6031 },
  "Kabupaten Kulon Progo": { lat: -7.7667, lng: 110.1500 },
  "Kota Yogyakarta": { lat: -7.7956, lng: 110.3695 },
  "Kota Semarang": { lat: -6.9667, lng: 110.4167 },
};

export default function ShareLocationAndSetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" strokeWidth={2} />
        </div>
      }
    >
      <ShareLocationContent />
    </Suspense>
  );
}

function ShareLocationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [detectedRegion, setDetectedRegion] = useState("");
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [manualRegion, setManualRegion] = useState("Kabupaten Purbalingga");

  const submitLocationData = async (lat: number, lng: number, regName?: string) => {
    try {
      const res = await updateLocationFromWa({
        token: decodeURIComponent(token || ""),
        latitude: lat,
        longitude: lng,
        regionName: regName,
        password,
      });

      if (res.success) {
        setDetectedRegion(res.data?.regionName || res.data?.region || regName || manualRegion);
        setSuccess(true);
      } else {
        setErrorMsg(res.message || "Gagal mengaktifkan akun.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengaktifkan akun.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateAccount = () => {
    if (!password || password.length < 6) {
      setErrorMsg("Password minimal 6 karakter.");
      return;
    }

    if (showManualFallback) {
      setLoading(true);
      setErrorMsg("");
      const coords = REGION_COORDINATES[manualRegion] || REGION_COORDINATES["Kabupaten Purbalingga"];
      submitLocationData(coords.lat, coords.lng, manualRegion);
      return;
    }

    if (!navigator.geolocation) {
      setErrorMsg("Browser Anda tidak mendukung deteksi lokasi GPS. Harap pilih wilayah manual.");
      setShowManualFallback(true);
      return;
    }

    setLoading(true);
    setErrorMsg("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        submitLocationData(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        setLoading(false);
        setShowManualFallback(true);
        if (error.code === error.PERMISSION_DENIED) {
          setErrorMsg("Akses lokasi GPS ditolak. Silakan pilih wilayah Anda secara manual di bawah.");
        } else {
          setErrorMsg("Gagal mendeteksi lokasi GPS. Silakan pilih wilayah Anda secara manual di bawah.");
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 text-center space-y-6 border border-slate-100">
        {!success ? (
          <>
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <MapPin className="w-7 h-7 animate-bounce" strokeWidth={2} />
            </div>

            <div>
              <h1 className="text-xl font-bold text-slate-800">Aktivasi Akun & Lokasi</h1>
              <p className="text-xs text-slate-500 mt-1">
                Lengkapi lokasi ladang/toko Anda dan buat password untuk login ke Web PetaniKita.
              </p>
            </div>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs p-3 rounded-xl text-left font-medium">
                {errorMsg}
              </div>
            )}

            <div className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Buat Password Login Web *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-600 absolute left-3 top-3.5" strokeWidth={2} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-600 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={2} /> : <Eye className="w-4 h-4" strokeWidth={2} />}
                  </button>
                </div>
              </div>

              {showManualFallback && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <label className="block text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-amber-600" strokeWidth={2} />
                    Pilih Wilayah Domisili / Ladang (Manual)
                  </label>
                  <p className="text-[11px] text-amber-700">
                    Karena sensor GPS tidak aktif, silakan pilih wilayah tempat tinggal atau lokasi ladang Anda:
                  </p>
                  <select
                    value={manualRegion}
                    onChange={(e) => setManualRegion(e.target.value)}
                    className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {Object.keys(REGION_COORDINATES).map((reg) => (
                      <option key={reg} value={reg}>
                        {reg}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <button
              onClick={handleActivateAccount}
              disabled={loading || !token || !password}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-md shadow-emerald-200"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
                  <span>Mendeteksi Wilayah & Menyimpan...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-5 h-5" strokeWidth={2} />
                  <span>{showManualFallback ? "Simpan Lokasi Manual & Aktifkan" : "Kirim Lokasi GPS & Aktifkan Akun"}</span>
                </>
              )}
            </button>

            {!showManualFallback && (
              <button
                type="button"
                onClick={() => setShowManualFallback(true)}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold underline block mx-auto mt-2"
              >
                Gunakan Pilihan Wilayah Manual (Jika GPS Error)
              </button>
            )}

            {!token && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-2">
                Token tidak ditemukan. Pastikan Anda mengakses link dari WhatsApp.
              </p>
            )}
          </>
        ) : (
          <div className="space-y-4 py-2">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10" strokeWidth={2} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Akun Berhasil Aktif!</h2>

            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-xs text-emerald-800 space-y-1">
              {detectedRegion && (
                <p>
                  Wilayah Terdaftar: <strong>{detectedRegion}</strong>
                </p>
              )}
              <p>Password web Anda telah berhasil dibuat.</p>
            </div>

            <button
              onClick={() => router.push("/auth/login")}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-xl text-sm transition"
            >
              Masuk ke Web PetaniKita
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
