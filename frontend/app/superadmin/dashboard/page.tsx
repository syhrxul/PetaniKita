'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import api, { sendAdminWaBroadcast, getAdminBroadcastProgress } from '@/lib/api';

import UsersModule from '@/components/superadmin/UsersModule';
import WaBroadcastModule from '@/components/superadmin/WaBroadcastModule';
import RegionalPricesModule from '@/components/superadmin/RegionalPricesModule';
import GeospatialRadarModule from '@/components/superadmin/GeospatialRadarModule';
import AuditLogsModule from '@/components/superadmin/AuditLogsModule';

function SuperadminDashboardContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'USERS';

  const [users, setUsers] = useState<any[]>([]);
  const [regionalPrices, setRegionalPrices] = useState<any[]>([]);
  const [priceProposals, setPriceProposals] = useState<any[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  const [geospatialUsers, setGeospatialUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [waEngine, setWaEngine] = useState<any>({ status: 'OFFLINE', qrCodeBase64: '', sendDelaySeconds: 2, enableTypingEffect: true });
  const [waLogs, setWaLogs] = useState<any[]>([]);

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [customPassword, setCustomPassword] = useState('');
  const [templateKey, setTemplateKey] = useState('PENDAFTARAN');
  const [broadcastText, setBroadcastText] = useState('🎉 *SELAMAT DATANG DI PETANIKITA*\n\nAkun Anda telah terverifikasi.');
  const [broadcastTarget, setBroadcastTarget] = useState<'ALL' | 'PETANI' | 'UMKM'>('ALL');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastJob, setBroadcastJob] = useState<{
    jobId: string;
    status: 'RUNNING' | 'COMPLETED' | 'FAILED';
    totalRecipients: number;
    sent: number;
    failed: number;
    progress: number;
    recipients: any[];
  } | null>(null);

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

  const fetchProposals = async () => {
    setProposalsLoading(true);
    try {
      const res = await api.get('/api/v1/superadmin/price-proposals');
      if (res.data.success) setPriceProposals(res.data.data || []);
    } catch (e) {} finally {
      setProposalsLoading(false);
    }
  };

  const handleProposalAction = async (regionName: string, commodity: string, action: 'APPROVE' | 'REJECT', overridePrice?: number) => {
    try {
      await api.post('/api/v1/superadmin/price-proposals/action', { regionName, commodity, action, overridePrice });
      alert(`✓ Proposal ${commodity} di ${regionName} telah di-${action === 'APPROVE' ? 'setujui' : 'tolak'}.`);
      fetchProposals();
    } catch { alert('Gagal memproses proposal.'); }
  };

  const fetchAllData = async () => {
    try {
      const [uRes, pRes, gRes, aRes] = await Promise.all([
        api.get('/api/v1/superadmin/users').catch(() => ({ data: { success: false, data: [] } })),
        api.get('/api/v1/superadmin/regional-prices').catch(() => ({ data: { success: false, data: { prices: [] } } })),
        api.get('/api/v1/superadmin/geospatial').catch(() => ({ data: { success: false, data: [] } })),
        api.get('/api/v1/superadmin/audit-logs').catch(() => ({ data: { success: false, data: [] } }))
      ]);

      if (uRes.data?.success) setUsers(uRes.data.data);
      if (pRes.data?.success) setRegionalPrices(pRes.data.data.prices || []);
      if (gRes.data?.success) setGeospatialUsers(gRes.data.data);
      if (aRes.data?.success) setAuditLogs(aRes.data.data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchAllData();
    fetchWaStatus();
    fetchProposals();
    const interval = setInterval(fetchWaStatus, 3000);
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

  const handleSendBroadcast = async () => {
    if (broadcastSending) return;
    const text = broadcastText.trim();
    if (!text) return alert('Pesan pengumuman tidak boleh kosong.');
    if (waEngine.status !== 'CONNECTED') return alert('WhatsApp Bot belum terhubung. Scan QR terlebih dahulu.');

    setBroadcastSending(true);
    setBroadcastJob(null);
    try {
      const res = await sendAdminWaBroadcast({ targetRole: broadcastTarget, message: text });
      if (!res.success || !res.data?.jobId) {
        alert(res.message || 'Gagal memulai broadcast.');
        setBroadcastSending(false);
        return;
      }
      setBroadcastJob({
        jobId: res.data.jobId,
        status: 'RUNNING',
        totalRecipients: res.data.totalRecipients || 0,
        sent: 0,
        failed: 0,
        progress: 0,
        recipients: [],
      });

      const poll = async () => {
        try {
          const pRes = await getAdminBroadcastProgress(res.data!.jobId);
          if (pRes.success && pRes.data) {
            const j = pRes.data;
            setBroadcastJob({
              jobId: j.jobId,
              status: j.status,
              totalRecipients: j.totalRecipients,
              sent: j.sent,
              failed: j.failed,
              progress: j.progress,
              recipients: j.recipients || [],
            });
            if (j.status === 'COMPLETED' || j.status === 'FAILED') {
              setBroadcastSending(false);
              return;
            }
            setTimeout(poll, 2000);
          } else {
            setBroadcastSending(false);
          }
        } catch {
          setBroadcastSending(false);
        }
      };
      setTimeout(poll, 1000);
    } catch (e: any) {
      alert(e?.message || 'Gagal mengirim broadcast.');
      setBroadcastSending(false);
    }
  };

  const resetBroadcast = () => {
    setBroadcastJob(null);
    setBroadcastSending(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-8">

      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">Panel Eksekutif Superadmin</h1>
          <p className="text-xs font-semibold text-slate-500">Pusat kendali ekosistem, aktivitas user, dan jaringan P2P PetaniKita.</p>
        </div>
        <div className="flex gap-2">
          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full text-xs font-extrabold">
            ● Backend Aktif
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
            waEngine.status === 'CONNECTED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}>
            ● WA {waEngine.status || 'OFFLINE'}
          </span>
        </div>
      </div>

      {activeTab === 'USERS' && (
        <UsersModule
          users={users}
          selectedUser={selectedUser}
          setSelectedUser={setSelectedUser}
          customPassword={customPassword}
          setCustomPassword={setCustomPassword}
          handleResetPass={handleResetPass}
          handlePromoteRole={handlePromoteRole}
          handleDeleteUser={handleDeleteUser}
        />
      )}

      {activeTab === 'WA_BROADCAST' && (
        <WaBroadcastModule
          api={api}
          waEngine={waEngine}
          templates={templates}
          templateKey={templateKey}
          setTemplateKey={setTemplateKey}
          broadcastText={broadcastText}
          setBroadcastText={setBroadcastText}
          broadcastTarget={broadcastTarget}
          setBroadcastTarget={setBroadcastTarget}
          broadcastSending={broadcastSending}
          broadcastJob={broadcastJob}
          fetchWaStatus={fetchWaStatus}
          handleUpdateWaConfig={handleUpdateWaConfig}
          handleSendBroadcast={handleSendBroadcast}
          resetBroadcast={resetBroadcast}
          setBroadcastSending={setBroadcastSending}
          setBroadcastJob={setBroadcastJob}
        />
      )}

      {activeTab === 'REGIONAL_PRICES' && (
        <RegionalPricesModule
          regionalPrices={regionalPrices}
          priceProposals={priceProposals}
          proposalsLoading={proposalsLoading}
          fetchProposals={fetchProposals}
          handleProposalAction={handleProposalAction}
        />
      )}

      {activeTab === 'GEOSPATIAL_RADAR' && (
        <GeospatialRadarModule geospatialUsers={geospatialUsers} />
      )}

      {activeTab === 'AUDIT_LOGS' && (
        <AuditLogsModule auditLogs={auditLogs} />
      )}

    </div>
  );
}

export default function SuperadminDashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs font-bold text-slate-500">Memuat Dashboard...</div>}>
      <SuperadminDashboardContent />
    </Suspense>
  );
}