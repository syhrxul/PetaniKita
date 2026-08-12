'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { 
  Users, Radio, Clock, Key, ShieldCheck, Trash2, 
  Settings, ToggleLeft, ToggleRight, CheckCircle2, 
  AlertTriangle, RefreshCw, MapPin, TrendingUp, Sprout, Send
} from 'lucide-react';

export default function SuperadminDashboardPage() {
  const [activeTab, setActiveTab] = useState<'LOGS' | 'USERS' | 'PRICES' | 'RADAR' | 'WA_ENGINE'>('WA_ENGINE');

  // Data States
  const [users, setUsers] = useState<any[]>([]);
  const [regionalPrices, setRegionalPrices] = useState<any[]>([]);
  const [activeCommodities, setActiveCommodities] = useState<any[]>([]);
  const [geospatialUsers, setGeospatialUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [waEngine, setWaEngine] = useState<any>({ status: 'OFFLINE', qrCodeBase64: '', sendDelaySeconds: 2, enableTypingEffect: true });
  const [waLogs, setWaLogs] = useState<any[]>([]);

  // Form States
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [customPassword, setCustomPassword] = useState('');
  const [templateKey, setTemplateKey] = useState('PENDAFTARAN');
  const [broadcastText, setBroadcastText] = useState('🎉 *SELAMAT DATANG DI PETANIKITA*\n\nAkun Anda telah terverifikasi.');

  const templates: Record<string, string> = {
    PENGUMUMAN: '📣 *PENGUMUMAN RESMI PETANIKITA*\n\nHalo Mitra,\n[Isi Pengumuman]',
    PEMESANAN: '📦 *NOTIFIKASI PESANAN BARU*\n\nPesanan Anda telah diteruskan ke Petani.',
    PENDAFTARAN: '🎉 *SELAMAT DATANG DI PETANIKITA*\n\nAkun Anda telah terverifikasi.',
    PETANI: '🌾 *INFO PETANI*: Pastikan stok panen Anda selalu terbarui di sistem.',
    UMKM: '👨‍🍳 *INFO UMKM*: Dapatkan bahan baku segar langsung dari lokasi terdekat.'
  };

  const fetchWaStatus = async () => {
    try {
      const res = await api.get('/api/v1/superadmin/wa-status');
      if (res.data.success) {
        setWaEngine(res.data.engine || { status: 'OFFLINE', qrCodeBase64: '' });
        setWaLogs(res.data.logs || []);
      }
    } catch (e) {}
  };

  const fetchAllData = async () => {
    try {
      const [uRes, pRes, gRes, aRes] = await Promise.all([
        api.get('/api/v1/superadmin/users'),
        api.get('/api/v1/superadmin/regional-prices'),
        api.get('/api/v1/superadmin/geospatial'),
        api.get('/api/v1/superadmin/audit-logs')
      ]);

      if (uRes.data?.success) setUsers(uRes.data.data);
      if (pRes.data?.success) {
        setRegionalPrices(pRes.data.data.prices || []);
        setActiveCommodities(pRes.data.data.commodities || []);
      }
      if (gRes.data?.success) setGeospatialUsers(gRes.data.data);
      if (aRes.data?.success) setAuditLogs(aRes.data.data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchAllData();
    fetchWaStatus();
    const interval = setInterval(fetchWaStatus, 3000); // Polling status WA & QR Code
    return () => clearInterval(interval);
  }, []);

  const handleResetPass = async (userId: number) => {
    if (!customPassword || customPassword.length < 6) return alert('Password minimal 6 karakter');
    try {
      await api.post('/api/v1/superadmin/reset-password', { userId, newPassword: customPassword });
      alert('✓ Password berhasil diubah!');
      setCustomPassword('');
      setSelectedUser(null);
      fetchAllData();
    } catch { alert('Gagal mereset password'); }
  };

  const handlePromoteRole = async (userId: number, role: string) => {
    try {
      await api.post('/api/v1/superadmin/promote-role', { userId, role });
      alert(`✓ Role user diubah menjadi ${role}`);
      fetchAllData();
    } catch { alert('Gagal mengubah role'); }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('⚠️ Hapus user ini secara permanen dari database?')) return;
    try {
      await api.post('/api/v1/superadmin/delete-user', { userId });
      alert('✓ User berhasil dihapus!');
      fetchAllData();
    } catch { alert('Gagal menghapus user'); }
  };

  const handleUpdateWaConfig = async (delay: number, typing: boolean) => {
    try {
      await api.post('/api/v1/superadmin/wa-settings', { sendDelaySeconds: delay, enableTypingEffect: typing });
      setWaEngine((prev: any) => ({ ...prev, sendDelaySeconds: delay, enableTypingEffect: typing }));
    } catch {}
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      
      {/* HEADER STATUS */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">Panel Eksekutif Superadmin</h1>
          <p className="text-xs font-semibold text-slate-500">Pusat kendali ekosistem, aktivitas user, dan jaringan P2P PetaniKita.</p>
        </div>
        <div className="flex gap-2">
          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5">
            ● Backend Aktif
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-extrabold border flex items-center gap-1.5 ${
            waEngine.status === 'CONNECTED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}>
            ● WA {waEngine.status || 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* TOP NAVIGATION TABS (SINGLE CONTAINER, NO DOUBLE SIDEBAR) */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-sm overflow-x-auto">
        <button
          onClick={() => setActiveTab('USERS')}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition whitespace-nowrap ${
            activeTab === 'USERS' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          👥 Manajemen User ({users.length})
        </button>

        <button
          onClick={() => setActiveTab('WA_ENGINE')}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition whitespace-nowrap ${
            activeTab === 'WA_ENGINE' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          📢 WA Broadcast &amp; Engine
        </button>

        <button
          onClick={() => setActiveTab('PRICES')}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition whitespace-nowrap ${
            activeTab === 'PRICES' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          📈 Kontrol Harga Regional
        </button>

        <button
          onClick={() => setActiveTab('RADAR')}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition whitespace-nowrap ${
            activeTab === 'RADAR' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          🗺️ Radar Geospasial
        </button>

        <button
          onClick={() => setActiveTab('LOGS')}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition whitespace-nowrap ${
            activeTab === 'LOGS' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          📜 Audit Log Aktivitas
        </button>
      </div>

      {/* TAB 1: MANAJEMEN USER */}
      {activeTab === 'USERS' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <h2 className="text-base font-black text-slate-900">Daftar Pengguna Ecosystem</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-800">
              <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
                <tr>
                  <th className="p-3">User / Username</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Telepon WA</th>
                  <th className="p-3 text-right">Aksi Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{u.name} <span className="text-slate-400 font-normal">(@{u.username})</span></td>
                    <td className="p-3">
                      <span className={`font-extrabold px-2.5 py-1 rounded-full text-[10px] ${
                        u.role === 'SUPERADMIN' ? 'bg-purple-100 text-purple-950' : u.role === 'FARMER' ? 'bg-emerald-100 text-emerald-950' : 'bg-amber-100 text-amber-950'
                      }`}>{u.role}</span>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-900">{u.phone}</td>
                    <td className="p-3 text-right space-x-1.5">
                      <button onClick={() => setSelectedUser(u)} className="bg-slate-200 hover:bg-slate-300 text-slate-900 px-2.5 py-1 rounded-lg font-bold text-[10px]">
                        Reset Pass
                      </button>
                      <button onClick={() => handlePromoteRole(u.id, u.role === 'SUPERADMIN' ? 'FARMER' : 'SUPERADMIN')} className="bg-emerald-200 hover:bg-emerald-300 text-emerald-950 px-2.5 py-1 rounded-lg font-extrabold text-[10px]">
                        {u.role === 'SUPERADMIN' ? 'Demote' : '+ Admin'}
                      </button>
                      <button onClick={() => handleDeleteUser(u.id)} className="bg-rose-100 hover:bg-rose-200 text-rose-900 px-2.5 py-1 rounded-lg font-bold text-[10px]">
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MODAL RESET PASS */}
          {selectedUser && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
                <h3 className="font-black text-sm text-slate-900">Atur Password Baru: {selectedUser.name}</h3>
                <input
                  type="text"
                  placeholder="Masukkan Password Baru..."
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600"
                />
                <div className="flex space-x-2">
                  <button onClick={() => setSelectedUser(null)} className="flex-1 bg-slate-100 text-slate-700 font-bold py-2.5 rounded-xl text-xs">Batal</button>
                  <button onClick={() => handleResetPass(selectedUser.id)} className="flex-1 bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-xs">Simpan</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WA ENGINE & BROADCAST (HIGH CONTRAST & RELIABLE QR CODE) */}
      {activeTab === 'WA_ENGINE' && (
        <div className="space-y-6">
          
          {/* QR CODE DISPLAY BOX */}
          <div className="bg-amber-50/70 border border-amber-200/90 rounded-3xl p-6 text-center space-y-3 shadow-sm">
            <div className="flex justify-center items-center gap-2 text-amber-900 font-extrabold text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600"/>
              <span>WhatsApp Bot Offline - Scan QR Code di Bawah Ini:</span>
            </div>

            {waEngine.qrCodeBase64 ? (
              <div className="relative w-52 h-52 mx-auto bg-white p-2 rounded-2xl border-2 border-amber-400 shadow-md">
                <img src={waEngine.qrCodeBase64} alt="WA QR Code" className="w-full h-full object-contain" />
              </div>
            ) : (
              <p className="text-xs font-bold text-amber-800">Menunggu QR Code dari server... Pastikan WhatsApp Bot aktif di backend.</p>
            )}
          </div>

          {/* ENGINE CONFIGURATION (HIGH CONTRAST FORM INPUTS) */}
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

          {/* BROADCAST TEMPLATES & FORM */}
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

            <textarea
              rows={4}
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value)}
              className="w-full border border-slate-300 rounded-2xl p-4 text-xs font-bold text-slate-900 bg-white outline-none focus:border-emerald-600 leading-relaxed"
            />

            <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-6 py-3.5 rounded-xl text-xs transition flex items-center gap-2 shadow-md shadow-emerald-200">
              <Send className="w-4 h-4"/>
              <span>Kirim Broadcast</span>
            </button>
          </div>

          {/* LOGS */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-black text-slate-900">Log Pesan Keluar ({waLogs.length})</h2>
              <button onClick={fetchWaStatus} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700">
                <RefreshCw className="w-4 h-4"/>
              </button>
            </div>

            {waLogs.length === 0 ? (
              <p className="text-xs text-slate-400 font-semibold text-center py-6">Belum ada log pesan.</p>
            ) : (
              <div className="space-y-2">
                {waLogs.map((l) => (
                  <div key={l.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex justify-between items-center text-xs">
                    <div>
                      <span className="font-extrabold text-slate-900">{l.recipientPhone}</span>
                      <span className="ml-2 font-mono text-[10px] bg-slate-200 px-2 py-0.5 rounded font-bold text-slate-800">{l.messageType}</span>
                      <p className="text-[11px] text-slate-600 mt-0.5 font-medium">{l.contentSnippet}</p>
                    </div>
                    <span className={`font-extrabold text-[10px] px-2.5 py-1 rounded-full ${l.status === 'SENT' ? 'bg-emerald-100 text-emerald-950' : 'bg-rose-100 text-rose-950'}`}>
                      {l.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 3: KONTROL HARGA REGIONAL */}
      {activeTab === 'PRICES' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="text-base font-black text-slate-900">Daftar Harga Acuan Regional &amp; HAP</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {regionalPrices.map((p) => (
                <div key={p.id} className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase">{p.region}</span>
                  <p className="font-black text-slate-900 text-sm">{p.commodity}</p>
                  <p className="text-xs font-black text-emerald-800">Rp {Number(p.farmerPrice).toLocaleString()}/Kg <span className="text-[10px] text-slate-500 font-normal">(HAP: Rp {Number(p.hapPrice).toLocaleString()})</span></p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: RADAR GEOSPASIAL */}
      {activeTab === 'RADAR' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <h2 className="text-base font-black text-slate-900">Sebaran Geospasial User Terdaftar</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {geospatialUsers.map((g) => (
              <div key={g.id} className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-black text-slate-900 text-xs">{g.name}</span>
                  <span className="text-[10px] font-extrabold bg-slate-200 text-slate-800 px-2 py-0.5 rounded">{g.role}</span>
                </div>
                <p className="text-xs text-slate-700 flex items-center gap-1 font-semibold">
                  <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0"/>
                  <span>{g.regionName || 'Koordinat Lahan'}</span>
                </p>
                <p className="text-[10px] font-mono text-slate-500 font-bold">Lat: {g.latitude}, Lng: {g.longitude}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT LOGS */}
      {activeTab === 'LOGS' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <h2 className="text-base font-black text-slate-900">Audit Log Aktivitas Sistem</h2>
          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex justify-between items-center text-xs">
                <div>
                  <span className="font-extrabold text-slate-900">{log.user?.name || 'Sistem'}</span>
                  <span className="ml-2 font-mono text-slate-600 font-bold">[{log.action}]</span>
                  <p className="text-[11px] text-slate-600 mt-0.5 font-medium">{log.description}</p>
                </div>
                <span className="text-[10px] text-slate-500 font-mono font-bold">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
