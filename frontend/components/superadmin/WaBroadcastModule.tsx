'use client';

import React from 'react';
import { Settings, ToggleLeft, ToggleRight, AlertTriangle, RefreshCw, Send, CheckCircle2 } from 'lucide-react';

interface WaBroadcastModuleProps {
  waEngine: any;
  templates: Record<string, string>;
  templateKey: string;
  setTemplateKey: (key: string) => void;
  broadcastText: string;
  setBroadcastText: (text: string) => void;
  broadcastTarget: 'ALL' | 'PETANI' | 'UMKM';
  setBroadcastTarget: (target: 'ALL' | 'PETANI' | 'UMKM') => void;
  broadcastSending: boolean;
  broadcastJob: any;
  fetchWaStatus: () => void;
  handleUpdateWaConfig: (delay: number, typing: boolean) => void;
  handleSendBroadcast: () => void;
  resetBroadcast: () => void;
  setBroadcastSending: (val: boolean) => void;
  setBroadcastJob: (val: any) => void;
  api: any;
}

export default function WaBroadcastModule({
  waEngine,
  templates,
  templateKey,
  setTemplateKey,
  broadcastText,
  setBroadcastText,
  broadcastTarget,
  setBroadcastTarget,
  broadcastSending,
  broadcastJob,
  fetchWaStatus,
  handleUpdateWaConfig,
  handleSendBroadcast,
  resetBroadcast,
  setBroadcastSending,
  setBroadcastJob,
  api,
}: WaBroadcastModuleProps) {
  return (
    <div className="space-y-6">
      <div className={`rounded-3xl p-6 text-center space-y-3 shadow-sm border ${
        waEngine.status === 'CONNECTED'
          ? 'bg-emerald-50/70 border-emerald-200/90'
          : 'bg-amber-50/70 border-amber-200/90'
      }`}>
        {waEngine.status === 'CONNECTED' ? (
          <>
            <div className="flex justify-center items-center gap-2 text-emerald-900 font-extrabold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600"/>
              <span>WhatsApp Bot TERHUBUNG</span>
              <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px]">CONNECTED</span>
            </div>
            <p className="text-xs font-bold text-emerald-800">
              Nomor aktif: <span className="font-mono">{waEngine.botPhone || '-'}</span>
            </p>
            <p className="text-xs font-semibold text-emerald-700">
              ✓ Bot siap mengirim notifikasi pesanan &amp; broadcast.
            </p>
            <button
              onClick={async () => {
                await api.post('/api/v1/superadmin/wa-reconnect', {});
                setTimeout(fetchWaStatus, 2000);
              }}
              className="mx-auto flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-extrabold"
            >
              <RefreshCw className="w-3.5 h-3.5"/>
              Putuskan &amp; Scan Ulang (Ganti Nomor)
            </button>
          </>
        ) : (
          <>
            <div className="flex justify-center items-center gap-2 text-amber-900 font-extrabold text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600"/>
              <span>WhatsApp Bot {waEngine.status === 'CONNECTING' ? 'MENGHUBUNGKAN...' : 'BELUM TERHUBUNG'}</span>
            </div>

            {waEngine.qrCodeBase64 ? (
              <div className="relative w-52 h-52 mx-auto bg-white p-2 rounded-2xl border-2 border-amber-400 shadow-md">
                <img src={waEngine.qrCodeBase64} alt="WA QR Code" className="w-full h-full object-contain" />
              </div>
            ) : (
              <p className="text-xs font-bold text-amber-800">Menunggu QR Code dari server... Pastikan WhatsApp Bot aktif di backend.</p>
            )}
            <p className="text-[11px] font-semibold text-amber-700">
              Buka WhatsApp → Perangkat Tertaut → Tautkan Perangkat → Scan QR ini.
            </p>
            <button
              onClick={async () => {
                await api.post('/api/v1/superadmin/wa-reconnect', {});
                setTimeout(fetchWaStatus, 2000);
              }}
              className="mx-auto flex items-center gap-2 bg-amber-700 hover:bg-amber-800 text-white px-4 py-2 rounded-xl text-xs font-extrabold"
            >
              <RefreshCw className="w-3.5 h-3.5"/>
              Force Re-scan (Hapus Sesi &amp; Generate QR Baru)
            </button>
          </>
        )}
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-emerald-600"/>
          <span>Pengaturan Engine WA</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-800">Delay Antar Pesan (Detik)</label>
            <input
              type="number"
              min="0"
              max="60"
              value={waEngine.sendDelaySeconds ?? 2}
              onChange={(e) => handleUpdateWaConfig(Number(e.target.value), waEngine.enableTypingEffect)}
              className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-black text-slate-900 bg-white focus:border-emerald-600 outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-800 block">Efek Pengetikan (Typing Presence)</label>
            <button
              onClick={() => handleUpdateWaConfig(waEngine.sendDelaySeconds, !waEngine.enableTypingEffect)}
              className={`w-full py-3 px-4 rounded-xl text-xs font-black flex items-center justify-between border ${
                waEngine.enableTypingEffect ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-slate-100 border-slate-300 text-slate-700'
              }`}
            >
              <span>{waEngine.enableTypingEffect ? 'Efek Ketik AKTIF' : 'Efek Ketik NONAKTIF'}</span>
              {waEngine.enableTypingEffect ? <ToggleRight className="w-6 h-6 text-emerald-600"/> : <ToggleLeft className="w-6 h-6 text-slate-400"/>}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <h2 className="text-base font-black text-slate-900">Kirim Broadcast</h2>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {Object.keys(templates).map((key) => (
            <button
              key={key}
              onClick={() => { setTemplateKey(key); setBroadcastText(templates[key]); }}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase transition whitespace-nowrap ${
                templateKey === key ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-extrabold text-slate-800">Target Penerima</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'ALL', label: '🛡️ Semua Mitra' },
              { value: 'PETANI', label: '🌾 Petani' },
              { value: 'UMKM', label: '👨‍🍳 UMKM' },
            ] as const).map((t) => (
              <button
                key={t.value}
                onClick={() => setBroadcastTarget(t.value)}
                className={`py-2.5 rounded-xl text-xs font-extrabold border transition ${
                  broadcastTarget === t.value
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          rows={4}
          value={broadcastText}
          onChange={(e) => setBroadcastText(e.target.value)}
          className="w-full border border-slate-300 rounded-2xl p-4 text-xs font-bold text-slate-900 bg-white outline-none focus:border-emerald-600 leading-relaxed"
        />

        <button
          onClick={handleSendBroadcast}
          disabled={broadcastSending}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold px-6 py-3.5 rounded-xl text-xs transition flex items-center gap-2 shadow-md shadow-emerald-200 w-full justify-center"
        >
          {broadcastSending ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
          <span>{broadcastSending ? 'Mengirim Broadcast...' : 'Kirim Broadcast'}</span>
        </button>

        {broadcastJob && (
          <div className={`rounded-2xl border p-4 space-y-3 ${
            broadcastJob.status === 'COMPLETED'
              ? 'bg-emerald-50 border-emerald-200'
              : broadcastJob.status === 'FAILED'
              ? 'bg-rose-50 border-rose-200'
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex justify-between items-center flex-wrap gap-2">
              <span className="font-black text-xs text-slate-900">
                Progres Broadcast{' '}
                {broadcastJob.status === 'COMPLETED' && <span className="text-emerald-700 font-extrabold">✓ Selesai</span>}
                {broadcastJob.status === 'FAILED' && <span className="text-rose-700 font-extrabold">✗ Gagal</span>}
                {broadcastJob.status === 'RUNNING' && <span className="text-slate-500 font-bold">(berjalan...)</span>}
              </span>
              <span className="text-[10px] font-extrabold bg-white border border-slate-200 px-2 py-0.5 rounded-full text-slate-700">
                {broadcastJob.sent}/{broadcastJob.totalRecipients} terkirim · {broadcastJob.failed} gagal
              </span>
            </div>

            <div className="h-2.5 bg-white rounded-full overflow-hidden border border-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  broadcastJob.status === 'COMPLETED' ? 'bg-emerald-500' : broadcastJob.status === 'FAILED' ? 'bg-rose-500' : 'bg-emerald-600 animate-pulse'
                }`}
                style={{ width: `${broadcastJob.progress}%` }}
              />
            </div>
            <p className="text-[10px] font-bold text-slate-500 text-right">{broadcastJob.progress}%</p>

            <div className="flex justify-end">
              {broadcastJob.status === 'COMPLETED' || broadcastJob.status === 'FAILED' ? (
                <button onClick={resetBroadcast} className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 px-3 py-1.5 rounded-xl text-[10px] font-extrabold">
                  Tutup
                </button>
              ) : (
                <button
                  onClick={() => { setBroadcastSending(false); setBroadcastJob(null); }}
                  className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 px-3 py-1.5 rounded-xl text-[10px] font-extrabold"
                >
                  Batalkan
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}