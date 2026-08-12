"use client";

import React, { useState } from "react";
import { X, Sprout, Store, ArrowRight, CheckCircle2, Phone, Compass, Handshake, Truck } from "lucide-react";

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GuideModal({ isOpen, onClose }: GuideModalProps) {
  const [activeTab, setActiveTab] = useState<"FARMER" | "UMKM">("FARMER");

  if (!isOpen) return null;

  const farmerSteps = [
    {
      step: "01",
      title: "Pendaftaran Cepat & OTP WA",
      desc: 'Daftar akun via Web atau kirim pesan "Halo" ke WhatsApp Bot PetaniKita. Lakukan verifikasi OTP 1-klik.',
      icon: Phone,
    },
    {
      step: "02",
      title: "Posting Panen (Web / Chat WA)",
      desc: 'Input detail panen melalui Form Web atau cukup ketik chat WA: "Ada panen cabai rawit 100 kg harga 25rb siap besok". AI akan membacanya otomatis.',
      icon: Sprout,
    },
    {
      step: "03",
      title: "Konfirmasi Order & Nego",
      desc: 'Saat UMKM memesan/menawar harga, Bot WA mengirimkan rinciannya. Balas "ACC" untuk menyetujui atau "TOLAK#Alasan" jika stok habis.',
      icon: Handshake,
    },
    {
      step: "04",
      title: "Pengiriman & Pembayaran",
      desc: "Pilih diantar langsung ke lokasi UMKM (ongkir adil terhitung otomatis) atau tunggu UMKM mengambil sendiri ke ladang (COD).",
      icon: Truck,
    },
  ];

  const umkmSteps = [
    {
      step: "01",
      title: "Registrasi & Deteksi GPS",
      desc: "Daftar akun UMKM Kuliner Anda dan aktifkan GPS 1-Klik agar sistem dapat mencocokkan petani dalam radius <100 km.",
      icon: Compass,
    },
    {
      step: "02",
      title: "Cari & Prediksi AI Restock",
      desc: "Pilih bahan baku segar dari Radar Petani. Manfaatkan fitur AI Restock untuk mengetahui estimasi kebutuhan harian dapur Anda.",
      icon: Store,
    },
    {
      step: "03",
      title: "Nego Harga & Opsi Pengiriman",
      desc: "Ajukan penawaran harga per Kg (opsional) beserta catatan nego. Pilih metode Diantar Petani atau Ambil Sendiri (COD).",
      icon: Handshake,
    },
    {
      step: "04",
      title: "Penerimaan Bahan Baku",
      desc: "Pantau status pesanan secara real-time. Jika petani menolak, alasan riil akan diteruskan ke WA Anda dan stok/dana otomatis disesuaikan.",
      icon: CheckCircle2,
    },
  ];

  const currentSteps = activeTab === "FARMER" ? farmerSteps : umkmSteps;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors"
          aria-label="Tutup Panduan"
        >
          <X className="w-5 h-5" strokeWidth={2.5} />
        </button>

        {/* Header */}
        <div className="space-y-1 pr-8">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            📖 Panduan Penggunaan Sistem
          </span>
          <h2 className="text-xl font-black text-slate-900 pt-1">Cara Kerja Platform PetaniKita</h2>
          <p className="text-xs text-slate-500">
            PetaniKita menghubungkan langsung Petani dan UMKM Kuliner secara transparan tanpa tengkulak.
          </p>
        </div>

        {/* Role Tab Switcher */}
        <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
          <button
            onClick={() => setActiveTab("FARMER")}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === "FARMER"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                : "text-slate-600 hover:bg-slate-200/60"
            }`}
          >
            <Sprout className="w-4 h-4" />
            <span>Panduan Untuk Petani</span>
          </button>

          <button
            onClick={() => setActiveTab("UMKM")}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === "UMKM"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                : "text-slate-600 hover:bg-slate-200/60"
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Panduan Untuk UMKM Kuliner</span>
          </button>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {currentSteps.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2 hover:border-emerald-300 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200">
                    <Icon className="w-4 h-4" strokeWidth={2.5} />
                  </div>
                  <span className="text-xs font-black text-slate-300 font-mono">LANGKAH {item.step}</span>
                </div>
                <h3 className="font-extrabold text-slate-900 text-xs">{item.title}</h3>
                <p className="text-[11px] text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-[11px] text-slate-500 text-center sm:text-left">
            Butuh pendampingan langsung? Tim kami siap membantu pendaftaran via WhatsApp.
          </p>
          <button
            onClick={onClose}
            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition"
          >
            Paham, Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  );
}
