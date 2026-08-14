"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sprout,
  Store,
  Truck,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  LayoutDashboard,
  MessageCircle,
  ShoppingBag,
  Bot,
  Zap,
  Bell,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { isLoggedIn, getSession, roleRedirect, getRegionalPrices } from "@/lib/api";
import GuideModal from "@/components/GuideModal";
import { formatRupiah } from "@/lib/format";

interface CommodityItem {
  commodity: string;
  farmerPrice: number;
  umkmPrice: number;
  trend?: string;
}

export default function HomePage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [dashboardUrl, setDashboardUrl] = useState("/auth/login");
  const [isHydrated, setIsHydrated] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [commodities, setCommodities] = useState<CommodityItem[]>([]);
  const [loadingCommodities, setLoadingCommodities] = useState(true);

  useEffect(() => {
    const user = getSession();
    const nextLoggedIn = isLoggedIn();

    setLoggedIn(nextLoggedIn);
    setDashboardUrl(user ? roleRedirect(user.role) : "/auth/login");
    setIsHydrated(true);

    getRegionalPrices()
      .then((res) => {
        if (res?.prices && Array.isArray(res.prices)) {
          const uniqueMap = new Map<string, CommodityItem>();
          res.prices.forEach((p) => {
            const key = (p.commodity || "").trim().toLowerCase();
            if (key && !uniqueMap.has(key)) {
              uniqueMap.set(key, {
                commodity: p.commodity,
                farmerPrice: p.farmer_price,
                umkmPrice: p.umkm_price,
                trend: p.trend === "UP" ? "Naik" : p.trend === "DOWN" ? "Turun" : "Stabil",
              });
            }
          });
          // Ambil 4 hingga 6 komoditas utama
          const list = Array.from(uniqueMap.values());
          setCommodities(list.length >= 4 ? list.slice(0, 6) : getFallbackCommodities());
        } else {
          setCommodities(getFallbackCommodities());
        }
      })
      .catch(() => {
        setCommodities(getFallbackCommodities());
      })
      .finally(() => setLoadingCommodities(false));
  }, []);

  function getFallbackCommodities(): CommodityItem[] {
    return [
      { commodity: "Cabai Merah Keriting", farmerPrice: 32000, umkmPrice: 38000, trend: "Stabil" },
      { commodity: "Bawang Merah", farmerPrice: 28000, umkmPrice: 34000, trend: "Naik" },
      { commodity: "Beras Medium", farmerPrice: 13500, umkmPrice: 15000, trend: "Stabil" },
      { commodity: "Tomat Segar", farmerPrice: 8000, umkmPrice: 11000, trend: "Turun" },
      { commodity: "Jagung Manis", farmerPrice: 7000, umkmPrice: 9500, trend: "Stabil" },
      { commodity: "Kentang Dieng", farmerPrice: 14000, umkmPrice: 17500, trend: "Stabil" },
    ];
  }

  const botPhone = "62895637383173";
  const botWaUrl = `https://wa.me/${botPhone}?text=${encodeURIComponent("Halo Bot PetaniKita! Saya ingin transaksi dan cek harga panen.")}`;

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-x-hidden font-sans text-slate-800">
      {/* NAVBAR */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex justify-between items-center gap-2">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/petani kita logo.svg"
              alt="PetaniKita"
              className="h-7 w-auto sm:h-9"
            />
          </Link>

          <div className="flex gap-2 sm:gap-3 shrink-0 items-center">
            <a
              href={botWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs sm:text-sm transition shadow-sm"
            >
              <Bot className="w-4 h-4" />
              <span>Chat Bot WA</span>
            </a>
            {isHydrated && loggedIn ? (
              <Link
                href={dashboardUrl}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 font-semibold text-xs sm:text-base transition min-h-[40px]"
              >
                <LayoutDashboard className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2} />
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="px-3.5 sm:px-5 py-2 text-emerald-800 border-2 border-emerald-800 rounded-lg hover:bg-emerald-50 font-semibold text-xs sm:text-base transition min-h-[40px] flex items-center justify-center"
                >
                  Masuk
                </Link>
                <Link
                  href="/auth/register"
                  className="px-3.5 sm:px-5 py-2 bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 font-semibold text-xs sm:text-base transition min-h-[40px] flex items-center justify-center"
                >
                  Daftar
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* HERO SECTION - FITUR BOT WA DIUNGGULKAN */}
      <section className="bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-700 text-white py-10 sm:py-16 md:py-20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="max-w-3xl">
            {/* BADGE UNGGULAN WA BOT */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-700/90 border border-emerald-500/40 rounded-full text-xs sm:text-sm font-semibold text-amber-300 mb-4 sm:mb-6 shadow-sm">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
              <span>Fitur Utama: AI WhatsApp Bot Otomatis 24/7</span>
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-4 sm:mb-6 tracking-tight">
              Jual Beli Panen Serba Praktis Langsung Lewat <span className="text-amber-400 underline decoration-amber-400/50">WhatsApp</span>
            </h2>
            <p className="text-sm sm:text-base md:text-xl text-emerald-100 leading-relaxed mb-6 sm:mb-8">
              Tanpa ribet instal aplikasi! Cukup kirim pesan WhatsApp ke Bot AI PetaniKita untuk cek harga pasar terkini, lapor hasil panen, hingga cari pembeli UMKM terdekat secara instan.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <a
                href={botWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-3 px-6 sm:px-8 py-3.5 sm:py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-base sm:text-lg rounded-xl shadow-xl transition min-h-[48px] group"
              >
                <MessageCircle className="w-6 h-6 text-slate-950 fill-current" />
                <span>Chat Bot WhatsApp SEKARANG</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
              <Link
                href="/farmer/input"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm sm:text-base rounded-xl transition min-h-[48px]"
              >
                <span>Akses Lewat Web</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* SHOWCASE WA BOT AI */}
      <section className="py-10 sm:py-14 bg-emerald-50/60 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-200 text-emerald-900 rounded-full text-xs font-semibold mb-2">
              <Bot className="w-4 h-4 text-emerald-800" /> WhatsApp Bot AI PetaniKita
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Keunggulan WhatsApp Bot AI</h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">Solusi praktis bertransaksi pertanian tanpa hambatan aplikasi.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white p-5 sm:p-6 rounded-xl border border-emerald-100 shadow-sm">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-4 text-emerald-800">
                <Zap className="w-5 h-5" />
              </div>
              <h4 className="text-base sm:text-lg font-bold text-slate-900 mb-1.5">Cek Harga Realtime AI</h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Ketik nama komoditas & lokasi via WhatsApp, Bot AI langsung berikan acuan harga pasar terkini.
              </p>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-xl border border-emerald-100 shadow-sm">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mb-4 text-amber-800">
                <Bell className="w-5 h-5" />
              </div>
              <h4 className="text-base sm:text-lg font-bold text-slate-900 mb-1.5">Notifikasi Pesanan Langsung</h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Setiap kali UMKM memesan panen Anda, pesan WhatsApp notifikasi otomatis langsung masuk ke nomor HP Anda.
              </p>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-xl border border-emerald-100 shadow-sm">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4 text-blue-800">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-base sm:text-lg font-bold text-slate-900 mb-1.5">Ramah Semua Jenis HP</h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Tidak makan memori HP atau kuota besar. Dapat dipakai di HP jadul maupun smartphone terbaru.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* KOMODITAS YANG TERSEDIA (DITAMPILKAN 4 - 6 KOMODITAS SAJA) */}
      <section className="py-10 sm:py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-6 sm:mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold mb-2">
              <ShoppingBag className="w-3.5 h-3.5" /> Hasil Panen Mitra
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900">Komoditas yang Tersedia</h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">Menampilkan 4-6 komoditas utama hasil panen petani mitra siap pesan.</p>
          </div>

          {loadingCommodities ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-xl border border-slate-200" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {commodities.map((item, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-emerald-300 transition flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-800 shrink-0">
                        <Sprout className="w-5 h-5" />
                      </div>
                      {item.trend && (
                        <span className="text-[11px] px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-semibold rounded-full shrink-0">
                          {item.trend}
                        </span>
                      )}
                    </div>
                    <h4 className="text-base sm:text-lg font-bold text-slate-900 mb-2 truncate">{item.commodity}</h4>
                  </div>
                  <div className="space-y-1 text-xs sm:text-sm pt-2 border-t border-slate-200/60">
                    <div className="flex justify-between text-slate-700 gap-2">
                      <span className="min-w-0 truncate">Harga Petani:</span>
                      <span className="font-bold text-emerald-800 shrink-0 whitespace-nowrap">{formatRupiah(item.farmerPrice)}/kg</span>
                    </div>
                    {item.umkmPrice > 0 && (
                      <div className="flex justify-between text-slate-500 text-[11px] gap-2">
                        <span className="min-w-0 truncate">Estimasi UMKM:</span>
                        <span className="shrink-0 whitespace-nowrap">{formatRupiah(item.umkmPrice)}/kg</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CARA KERJA */}
      <section className="py-10 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Cara Kerja Simpel</h3>
          <p className="text-xs sm:text-base text-slate-600 mb-8 leading-relaxed">
            Tiga langkah mudah menghubungkan langsung Petani dan Pembeli UMKM.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-4 shrink-0">
                <Sprout className="w-5 h-5 text-emerald-800" strokeWidth={2} />
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">1. Petani Lapor Panen</h4>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                Isi jumlah panen via WA Bot atau Web. Sistem otomatis mencari pembeli terdekat.
              </p>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4 shrink-0">
                <Store className="w-5 h-5 text-blue-800" strokeWidth={2} />
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">2. UMKM Pesan Langsung</h4>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                UMKM mendapatkan bahan baku segar langsung dari petani lokal dengan harga transparan.
              </p>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mb-4 shrink-0">
                <Truck className="w-5 h-5 text-amber-800" strokeWidth={2} />
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">3. Pengiriman Hemat</h4>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                Lokasi dihitung otomatis untuk menekan ongkir agar hasil panen cepat sampai dan tetap segar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* KEUNGGULAN SISTEM */}
      <section className="py-10 sm:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Keunggulan PetaniKita</h3>
          <p className="text-xs sm:text-base text-slate-600 mb-8 leading-relaxed">
            Fitur dirancang ramah penggunaan untuk semua perangkat.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {[
              { title: "Diutamakan via Bot WA", desc: "Praktis lapor panen, cek harga, dan terima notifikasi via WhatsApp." },
              { title: "Harga Transparan & Jelas", desc: "Harga langsung tertera tanpa perlu negosiasi bertele-tele." },
              { title: "Tanpa Aplikasi Berat", desc: "Website & WhatsApp Bot ramah memori di semua tipe HP." },
              { title: "Pembayaran Escrow Aman", desc: "Uang aman sampai barang diterima oleh pembeli." },
              { title: "Pemberdayaan Petani Lokal", desc: "Meningkatkan keuntungan petani langsung tanpa potong perantara." },
              { title: "Teknologi Prediksi AI", desc: "Perkiraan tren harga komoditas terkini menggunakan kecerdasan buatan." },
            ].map((benefit, i) => (
              <div key={i} className="flex gap-3">
                <div className="shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-800" strokeWidth={2} />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 mb-0.5">{benefit.title}</h4>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{benefit.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION BANTUAN */}
      <section className="py-10 sm:py-14 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="bg-emerald-900 text-white p-6 sm:p-8 rounded-2xl shadow-lg relative overflow-hidden">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start relative z-10">
              <div className="shrink-0 w-10 h-10 bg-emerald-800 rounded-lg flex items-center justify-center text-emerald-300">
                <Bot className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg sm:text-xl font-bold mb-2">Langsung Chat Bot WhatsApp Sekarang</h4>
                <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed mb-5">
                  Cukup kirim pesan ke nomor WA Bot kami (0895-6373-83173) untuk langsung cek harga dan transaksi.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href={botWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm transition min-h-[44px]"
                  >
                    <MessageCircle className="w-4 h-4 fill-current" />
                    Chat Bot WA Sekarang
                  </a>
                  <button
                    onClick={() => setIsGuideOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 border border-emerald-400/40 text-emerald-100 hover:bg-emerald-800 rounded-xl font-semibold text-xs sm:text-sm transition min-h-[44px]"
                  >
                    <HelpCircle className="w-4 h-4" />
                    Baca Panduan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FLOATING BOT WA BUTTON (RESPONSIF & PERSISTEN DI SEMUA DEVICE) */}
      <a
        href={botWaUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat WhatsApp Bot AI"
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-3 rounded-full shadow-2xl transition hover:scale-105 border-2 border-white ring-2 ring-emerald-500/40"
      >
        <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse shrink-0 fill-current" />
        <span className="font-extrabold text-xs sm:text-sm">Chat Bot WA AI</span>
      </a>

      <GuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
}