"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginUser, saveSession, roleRedirect } from "@/lib/api";
import { ArrowRight, ArrowLeft, User, Lock, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await loginUser({ identifier, password });
      saveSession(user);
      router.push(roleRedirect(user.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login gagal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col justify-center items-center p-4">
      {/* Back Link */}
      <a href="/" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-emerald-700 transition-colors">
        <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
        <span>Kembali ke Beranda</span>
      </a>

      {/* Main Light Form Container */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-xl shadow-slate-200/50">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <svg className="w-10 h-10 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <h1 className="text-2xl font-black text-slate-900">PetaniKita</h1>
          </div>
          <h2 className="text-xl font-black text-slate-900 pt-2">Masuk ke Akun Anda</h2>
          <p className="text-xs text-slate-500 font-medium">Gunakan username, nama, atau nomor WhatsApp terdaftar.</p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3.5 rounded-xl font-bold">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* IDENTIFIER */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-1">
              USERNAME / NAMA / NO. WHATSAPP
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                required
                placeholder="contoh: Arul Superadmin"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full text-xs pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 text-slate-900 font-medium placeholder-slate-400 rounded-xl transition-all focus:outline-none"
              />
            </div>
          </div>

          {/* PASSWORD */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-1">
              PASSWORD
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                placeholder="Masukkan password Anda"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-xs pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 text-slate-900 font-medium placeholder-slate-400 rounded-xl transition-all focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold py-3.5 rounded-xl text-xs transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <span>Masuk</span>
                <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
              </>
            )}
          </button>

          <p className="text-center text-xs text-slate-500 pt-2">
            Belum punya akun?{" "}
            <a href="/auth/register" className="font-bold text-emerald-700 hover:text-emerald-800 underline underline-offset-4 transition-colors">
              Daftar di sini
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
