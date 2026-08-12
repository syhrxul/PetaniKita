"use client";

import React, { useState } from "react";
import Link from "next/link";
import { registerDirect, checkUsername, checkPhone, UserRole } from "@/lib/api";
import { sanitizePhoneNumber, isValidUsername } from "@/lib/phoneSanitizer";
import RoleSelect from "@/components/ui/RoleSelect";
import { Phone, Lock, User, ArrowRight, ArrowLeft, Navigation, CheckCircle2, MessageSquare, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const [form, setForm] = useState({
    username: "",
    name: "",
    phone: "",
    password: "",
    role: "PETANI" as UserRole,
    latitude: null as number | null,
    longitude: null as number | null,
    regionName: "",
  });

  const [loadingRegister, setLoadingRegister] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationSuccess, setLocationSuccess] = useState(false);
  const [manualRegion, setManualRegion] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showLoginLink, setShowLoginLink] = useState(false);

  // Real-time check states
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [phoneStatus, setPhoneStatus] = useState<"idle" | "checking" | "available" | "registered">("idle");
  const [phoneCheckTimer, setPhoneCheckTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [usernameCheckTimer, setUsernameCheckTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Registration success
  const [registeredSuccessData, setRegisteredSuccessData] = useState<any>(null);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const sanitized = sanitizePhoneNumber(rawVal);
    setForm({ ...form, phone: sanitized });
    setUsernameSuggestions([]);

    // Clear previous timer
    if (phoneCheckTimer) clearTimeout(phoneCheckTimer);

    if (sanitized.length < 10) {
      setPhoneStatus("idle");
      return;
    }

    setPhoneStatus("checking");

    // Debounce 400ms
    const timer = setTimeout(async () => {
      try {
        const res = await checkPhone(sanitized);
        setPhoneStatus(res.registered ? "registered" : "available");
        if (res.registered) {
          setErrorMessage("Nomor WhatsApp sudah terdaftar. Silakan login.");
          setShowLoginLink(true);
        }
      } catch {
        setPhoneStatus("idle");
      }
    }, 400);

    setPhoneCheckTimer(timer);
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\s+/g, "");
    setForm({ ...form, username: val });
    setUsernameSuggestions([]);

    // Clear previous timer
    if (usernameCheckTimer) clearTimeout(usernameCheckTimer);

    if (val.length < 3) {
      setUsernameStatus("idle");
      return;
    }

    setUsernameStatus("checking");

    // Debounce 400ms
    const timer = setTimeout(async () => {
      try {
        const res = await checkUsername(val);
        if (res.available) {
          setUsernameStatus("available");
          setUsernameSuggestions([]);
        } else {
          setUsernameStatus("taken");
          setUsernameSuggestions(res.suggestions);
        }
      } catch {
        setUsernameStatus("idle");
      }
    }, 400);

    setUsernameCheckTimer(timer);
  };

  // 1-Klik GPS Location
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setManualRegion(true);
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
          );
          const data = await res.json();
          const detectedCity =
            data.address?.city || data.address?.regency || data.address?.county || "Wilayah Terdeteksi GPS";
          setForm((prev) => ({ ...prev, latitude: lat, longitude: lng, regionName: detectedCity }));
          setLocationSuccess(true);
        } catch {
          setForm((prev) => ({ ...prev, latitude: lat, longitude: lng, regionName: "Wilayah Terdeteksi GPS" }));
          setLocationSuccess(true);
        } finally {
          setGettingLocation(false);
        }
      },
      () => {
        setManualRegion(true);
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setShowLoginLink(false);

    if (!isValidUsername(form.username)) {
      return setErrorMessage("Username hanya boleh berupa huruf dan angka tanpa spasi!");
    }

    setLoadingRegister(true);
    try {
      const res = await registerDirect({
        username: form.username,
        name: form.name || form.username,
        phone: form.phone,
        password: form.password,
        role: form.role,
        latitude: form.latitude,
        longitude: form.longitude,
        regionName: form.regionName,
      });

      if (res.success) {
        setRegisteredSuccessData(res.data);
      } else {
        setErrorMessage(res.message || "Gagal mendaftar.");
        if (res.message?.toLowerCase().includes("sudah terdaftar") || res.message?.toLowerCase().includes("sudah digunakan")) {
          setShowLoginLink(true);
        }
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || "Gagal mendaftar.";
      setErrorMessage(errMsg);
      if (errMsg.toLowerCase().includes("sudah terdaftar") || errMsg.toLowerCase().includes("sudah digunakan")) {
        setShowLoginLink(true);
      }
    } finally {
      setLoadingRegister(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col justify-center items-center p-4 py-8">
      <a href="/" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-emerald-700 transition-colors">
        <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
        <span>Kembali ke Beranda</span>
      </a>

      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-xl shadow-slate-200/50">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <svg className="w-10 h-10 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <h1 className="text-2xl font-black text-slate-900">PetaniKita</h1>
          </div>
          <h2 className="text-xl font-black text-slate-900 pt-2">Daftar Akun Baru</h2>
          <p className="text-xs text-slate-500 font-medium">Bergabunglah di ekosistem pasokan pangan P2P PetaniKita.</p>
        </div>

        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3.5 rounded-xl font-bold space-y-2">
            <p>⚠️ {errorMessage}</p>
            {showLoginLink && (
              <a href="/auth/login" className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition">
                🔐 Login di sini
              </a>
            )}
          </div>
        )}

        {/* SUCCESS REGISTRATION BOX */}
        {registeredSuccessData ? (
          <div className="bg-emerald-50 border border-emerald-300 p-6 rounded-2xl space-y-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h2 className="text-base font-black text-emerald-950">Pendaftaran Akun Berhasil!</h2>

            {/* Registration Code */}
            <div className="bg-white border-2 border-emerald-400 rounded-xl p-4 space-y-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kode Registrasi Anda</p>
              <p className="text-2xl font-black text-emerald-700 tracking-widest">{registeredSuccessData?.registrationCode}</p>
              <p className="text-[10px] text-slate-500">Simpan kode ini sebagai bukti pendaftaran</p>
            </div>

            <p className="text-xs text-emerald-800 leading-relaxed">
              Akun Anda telah aktif. Untuk menghubungkan WhatsApp Bot dan menerima notifikasi pesanan, klik tombol di bawah:
            </p>

            <a
              href={registeredSuccessData?.botLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-[#25D366] hover:bg-[#1da851] text-white font-extrabold py-3.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-md"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Hubungkan WhatsApp Bot (1-Klik)</span>
            </a>

            <p className="text-[10px] text-slate-500">
              Atau kirim pesan ke <strong>+{registeredSuccessData?.botNumber}</strong> dengan format:<br />
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-emerald-700">DAFTAR {registeredSuccessData?.registrationCode} NamaAnda</code>
            </p>

            <Link className="block text-xs font-bold text-emerald-800 hover:underline pt-2" href="/auth/login">
              Lanjut Masuk ke Akun Saya →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmitRegister} className="space-y-4">
            {/* USERNAME with real-time check */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-1">
                USERNAME (TANPA SPASI)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="contoh: budisantoso88"
                  value={form.username}
                  onChange={handleUsernameChange}
                  className={`w-full text-xs pl-10 pr-10 py-3 bg-slate-50 border focus:bg-white focus:ring-2 text-slate-900 font-medium placeholder-slate-400 rounded-xl transition-all focus:outline-none ${
                    usernameStatus === "available" ? "border-emerald-500 focus:border-emerald-600 focus:ring-emerald-500/20" :
                    usernameStatus === "taken" ? "border-rose-500 focus:border-rose-600 focus:ring-rose-500/20" :
                    "border-slate-300 focus:border-emerald-600 focus:ring-emerald-500/20"
                  }`}
                />
                {usernameStatus === "checking" && (
                  <Loader2 className="w-4 h-4 text-slate-400 absolute right-3 top-3.5 animate-spin" />
                )}
                {usernameStatus === "available" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-3 top-3.5" />
                )}
                {usernameStatus === "taken" && (
                  <span className="absolute right-3 top-3.5 text-rose-500 text-xs font-bold">✗</span>
                )}
              </div>
              {usernameStatus === "available" && (
                <p className="text-[10px] text-emerald-600 mt-1 font-medium">✓ Username tersedia</p>
              )}
              {usernameStatus === "taken" && (
                <div className="mt-1">
                  <p className="text-[10px] text-rose-600 font-medium">✗ Username sudah digunakan</p>
                  {usernameSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-[10px] text-slate-500">Saran:</span>
                      {usernameSuggestions.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setForm({ ...form, username: s })}
                          className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 rounded border border-slate-200 transition"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {usernameStatus === "idle" && (
                <p className="text-[10px] text-slate-500 mt-1 font-medium">Hanya huruf dan angka, tanpa spasi atau karakter spesial</p>
              )}
            </div>

            {/* NAMA LENGKAP */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-1">
                NAMA LENGKAP
              </label>
              <input
                type="text"
                required
                placeholder="Budi Santoso"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full text-xs px-4 py-3 bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-slate-900 font-medium placeholder-slate-400 rounded-xl outline-none"
              />
            </div>

            {/* NOMOR WHATSAPP with real-time check */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-1">
                NOMOR WHATSAPP
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="081234567890 atau 6281234..."
                  value={form.phone}
                  onChange={handlePhoneChange}
                  className={`w-full text-xs pl-10 pr-10 py-3 bg-slate-50 border focus:bg-white focus:ring-2 font-mono font-bold placeholder-slate-400 rounded-xl transition-all focus:outline-none ${
                    phoneStatus === "available" ? "border-emerald-500 focus:border-emerald-600 focus:ring-emerald-500/20 text-emerald-800" :
                    phoneStatus === "registered" ? "border-rose-500 focus:border-rose-600 focus:ring-rose-500/20 text-rose-800" :
                    "border-slate-300 focus:border-emerald-600 focus:ring-emerald-500/20 text-emerald-800"
                  }`}
                />
                {phoneStatus === "checking" && (
                  <Loader2 className="w-4 h-4 text-slate-400 absolute right-3 top-3.5 animate-spin" />
                )}
                {phoneStatus === "available" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-3 top-3.5" />
                )}
                {phoneStatus === "registered" && (
                  <span className="absolute right-3 top-3.5 text-rose-500 text-xs font-bold">✗</span>
                )}
              </div>
              {phoneStatus === "available" && (
                <p className="text-[10px] text-emerald-600 mt-1.5 font-medium">✓ Nomor tersedia ({form.phone})</p>
              )}
              {phoneStatus === "registered" && (
                <p className="text-[10px] text-rose-600 mt-1.5 font-medium">✗ Nomor sudah terdaftar. <a href="/auth/login" className="underline font-bold">Login di sini</a></p>
              )}
              {phoneStatus === "idle" && form.phone && (
                <p className="text-[10px] text-emerald-700 mt-1.5 font-mono">
                  ✓ Format: <strong className="bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">{form.phone}</strong>
                </p>
              )}
            </div>

            {/* LOKASI GEOLOCATION */}
            <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-800">
                LOKASI KEDUDUKAN / LADANG <span className="text-rose-500">*</span>
              </label>

              {!manualRegion ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={gettingLocation}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {gettingLocation ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Mendeteksi Koordinat GPS...</span>
                      </>
                    ) : (
                      <>
                        <Navigation className="w-4 h-4" />
                        <span>Ambil Lokasi Saya (1-Klik GPS)</span>
                      </>
                    )}
                  </button>

                  {locationSuccess && (
                    <div className="bg-emerald-50 border border-emerald-300 p-2 rounded-xl">
                      <p className="text-xs font-bold text-emerald-800 text-center">✓ {form.regionName}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setManualRegion(true)}
                    className="text-[10px] font-bold text-slate-500 hover:text-emerald-700 underline block text-center w-full"
                  >
                    Masukkan Nama Daerah secara manual
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Kabupaten Sleman"
                    value={form.regionName}
                    onChange={(e) => setForm({ ...form, regionName: e.target.value })}
                    className="w-full text-xs px-4 py-3 bg-white border border-slate-300 rounded-xl outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setManualRegion(false)}
                    className="text-[10px] font-bold text-emerald-700 hover:underline block text-right w-full"
                  >
                    Gunakan Deteksi GPS Otomatis
                  </button>
                </div>
              )}
            </div>

            {/* PASSWORD */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-1">
                PASSWORD WEB
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  placeholder="Minimal 6 karakter"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full text-xs pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-slate-900 rounded-xl outline-none"
                />
              </div>
            </div>

            {/* ROLE SELECT */}
            <RoleSelect
              value={form.role}
              onChange={(r: string) => setForm({ ...form, role: r as UserRole })}
            />

            <button
              type="submit"
              disabled={loadingRegister || phoneStatus === "registered"}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingRegister ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memproses Pendaftaran...</span>
                </>
              ) : (
                <>
                  <span>Daftar Sekarang</span>
                  <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>
        )}

        <div className="text-center pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-500 font-medium">
            Sudah punya akun?{" "}
            <a className="font-bold text-emerald-700 hover:text-emerald-800 underline" href="/auth/login">
              Masuk di sini
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
