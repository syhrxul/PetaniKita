"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sprout, Store, Truck, CheckCircle2, Phone, HelpCircle, ArrowRight, LayoutDashboard } from "lucide-react";
import { isLoggedIn, getSession, roleRedirect } from "@/lib/api";
import GuideModal from "@/components/GuideModal";

export default function HomePage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [dashboardUrl, setDashboardUrl] = useState("/auth/login");
  const [isHydrated, setIsHydrated] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  useEffect(() => {
    const user = getSession();
    const nextLoggedIn = isLoggedIn();

    setLoggedIn(nextLoggedIn);
    setDashboardUrl(user ? roleRedirect(user.role) : "/auth/login");
    setIsHydrated(true);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <Sprout className="w-8 h-8 text-emerald-800" strokeWidth={2} />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">PetaniKita</h1>
              <p className="text-xs text-slate-500">Pertanian untuk Semua</p>
            </div>
          </Link>

          <div className="flex gap-4">
            {isHydrated && loggedIn ? (
              <Link
                href={dashboardUrl}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 font-semibold text-base transition"
              >
                <LayoutDashboard className="w-5 h-5" strokeWidth={2} />
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="px-6 py-2.5 text-emerald-800 border-2 border-emerald-800 rounded-lg hover:bg-emerald-50 font-semibold text-base transition"
                >
                  Masuk
                </Link>
                <Link
                  href="/auth/register"
                  className="px-6 py-2.5 bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 font-semibold text-base transition"
                >
                  Daftar
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="bg-gradient-to-b from-emerald-800 to-emerald-700 text-white py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl">
            <h2 className="text-5xl md:text-6xl font-bold leading-tight mb-8">
              Solusi Jual Beli Hasil Panen Langsung Tanpa Perantara
            </h2>
            <p className="text-xl text-emerald-100 leading-relaxed mb-12">
              Menghubungkan petani lokal dengan warung makan, restoran, dan hotel secara efisien. 
              Jual hasil panen dengan harga lebih tinggi. Beli bahan baku dengan harga lebih murah.
            </p>
            <div className="flex flex-col md:flex-row gap-6">
              <Link href="/farmer/input"
                className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-amber-500 text-slate-900 rounded-xl hover:bg-amber-600 font-bold text-lg transition">
                Lapor Panen
                <ArrowRight className="w-5 h-5" strokeWidth={2} />
              </Link>
              <Link href="/auth/login"
                className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-white text-emerald-800 rounded-xl hover:bg-slate-100 font-bold text-lg transition">
                Beli Bahan Baku
                <ArrowRight className="w-5 h-5" strokeWidth={2} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h3 className="text-4xl font-bold text-slate-900 mb-4">Cara Kerja Simpel</h3>
          <p className="text-xl text-slate-600 mb-16 leading-relaxed">
            Tiga langkah sederhana untuk mengoptimalkan jual beli hasil pertanian Anda.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 hover:shadow-lg transition">
              <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mb-6">
                <Sprout className="w-8 h-8 text-emerald-800" strokeWidth={2} />
              </div>
              <h4 className="text-2xl font-bold text-slate-900 mb-4">Petani</h4>
              <p className="text-lg text-slate-700 leading-relaxed">
                Cukup isi jumlah panen dan lokasi lahan Anda. Sistem kami langsung mencari pembeli 
                terdekat yang membutuhkan produk Anda dengan harga terbaik.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 hover:shadow-lg transition">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                <Store className="w-8 h-8 text-blue-800" strokeWidth={2} />
              </div>
              <h4 className="text-2xl font-bold text-slate-900 mb-4">UMKM & Restoran</h4>
              <p className="text-lg text-slate-700 leading-relaxed">
                Dapatkan bahan baku berkualitas langsung dari petani terdekat dengan harga lebih 
                murah. Tidak perlu lagi ke pasar atau distributor.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 hover:shadow-lg transition">
              <div className="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center mb-6">
                <Truck className="w-8 h-8 text-amber-800" strokeWidth={2} />
              </div>
              <h4 className="text-2xl font-bold text-slate-900 mb-4">Pengiriman Hemat</h4>
              <p className="text-lg text-slate-700 leading-relaxed">
                Jarak dihitung otomatis ke pembeli terdekat agar biaya pengiriman lebih hemat. 
                Hasil pertanian sampai lebih segar, untung semua.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h3 className="text-4xl font-bold text-slate-900 mb-4">Keunggulan PetaniKita</h3>
          <p className="text-xl text-slate-600 mb-16 leading-relaxed">
            Bergabunglah dengan ribuan pengguna yang sudah merasakan manfaatnya.
          </p>

          <div className="grid md:grid-cols-2 gap-10">
            {[
              { title: "Harga Transparan & Pasti", desc: "Tidak ada negosiasi bertele-tele. Harga sudah jelas sebelum transaksi." },
              { title: "Tanpa Aplikasi Rumit", desc: "Gunakan melalui website di browser dan aplikasi chat bot whatsApp. Tidak perlu download aplikasi." },
              { title: "Pembayaran Aman & Terjamin", desc: "Sistem escrow memastikan uang aman hingga barang diterima dengan baik." },
              { title: "Membantu Ekonomi Lokal", desc: "Dukungan penuh untuk UMKM lokal dan petani di sekitar Anda." },
              { title: "Prediksi Kebutuhan AI", desc: "Tahu berapa banyak barang yang dibutuhkan setiap hari tanpa khawatir kelebihan stok." },
              { title: "Hubungan Langsung Petani-Pembeli", desc: "Tidak ada perantara. Semua keuntungan langsung ke petani dan pembeli." },
            ].map((benefit, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex-shrink-0 mt-1">
                  <CheckCircle2 className="w-6 h-6 text-emerald-800" strokeWidth={2} />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-slate-900 mb-2">{benefit.title}</h4>
                  <p className="text-lg text-slate-700 leading-relaxed">{benefit.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-blue-50 border-l-4 border-blue-800 p-10 rounded-xl">
            <div className="flex gap-6">
              <div className="flex-shrink-0">
                <HelpCircle className="w-10 h-10 text-blue-800 flex-shrink-0" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <h4 className="text-2xl font-bold text-slate-900 mb-3">Butuh Bantuan?</h4>
                <p className="text-lg text-slate-700 leading-relaxed mb-6">
                  Jika Anda merasa kesulitan menggunakan website ini, kami siap membantu. 
                  Tim kami telah terlatih khusus untuk mendampingi pengguna berusia lanjut.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <a
                    href="https://wa.me/6281229411387?text=Halo%20Tim%20PetaniKita,%20saya%20butuh%20bantuan%20penggunaan%20website"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-blue-800 text-white rounded-lg hover:bg-blue-900 font-semibold text-base transition"
                  >
                    <Phone className="w-5 h-5" strokeWidth={2} />
                    Hubungi Bantuan
                  </a>
                  <button
                    onClick={() => setIsGuideOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-8 py-3 border-2 border-blue-800 text-blue-800 rounded-lg hover:bg-blue-50 font-semibold text-base transition"
                  >
                    Baca Panduan Lengkap
                    <ArrowRight className="w-5 h-5" strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <GuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
}
