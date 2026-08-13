'use client';

import React from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Minus, Brain, CheckCircle2, XCircle } from 'lucide-react';

interface RegionalPricesModuleProps {
  regionalPrices: any[];
  priceProposals: any[];
  proposalsLoading: boolean;
  fetchProposals: () => void;
  handleProposalAction: (
    regionName: string,
    commodity: string,
    action: 'APPROVE' | 'REJECT',
    overridePrice?: number
  ) => void;
}

export default function RegionalPricesModule({
  regionalPrices,
  priceProposals,
  proposalsLoading,
  fetchProposals,
  handleProposalAction,
}: RegionalPricesModuleProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <h2 className="text-base font-black text-slate-900">Tabel Harga Acuan Regional & HAP</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-800">
            <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
              <tr>
                <th className="p-3">Wilayah</th>
                <th className="p-3">Komoditas</th>
                <th className="p-3 text-right">Harga Petani</th>
                <th className="p-3 text-right">HAP</th>
                <th className="p-3 text-center">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {regionalPrices.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-700 text-[11px]">{p.region}</td>
                  <td className="p-3 font-black text-slate-900">{p.commodity}</td>
                  <td className="p-3 text-right font-black text-emerald-800">Rp {Number(p.farmerPrice).toLocaleString()}</td>
                  <td className="p-3 text-right font-bold text-slate-600">Rp {Number(p.hapPrice).toLocaleString()}</td>
                  <td className="p-3 text-center">
                    {p.trend === 'UP' ? <TrendingUp className="w-4 h-4 text-rose-500 mx-auto"/> :
                     p.trend === 'DOWN' ? <TrendingDown className="w-4 h-4 text-emerald-600 mx-auto"/> :
                     <Minus className="w-4 h-4 text-slate-400 mx-auto"/>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h2 className="text-base font-black text-slate-900">
            Pengajuan Harga dari Petani
            {priceProposals.length > 0 && (
              <span className="ml-2 bg-rose-100 text-rose-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">{priceProposals.length} grup aktif</span>
            )}
          </h2>
          <button onClick={fetchProposals} disabled={proposalsLoading}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold">
            <RefreshCw className={`w-3.5 h-3.5 ${proposalsLoading ? 'animate-spin' : ''}`}/>
            {proposalsLoading ? 'AI sedang menganalisis...' : 'Refresh & Analisis AI'}
          </button>
        </div>

        {priceProposals.length === 0 ? (
          <p className="text-xs text-slate-400 font-semibold text-center py-8">
            {proposalsLoading ? 'AI Hervest sedang menganalisis proposal...' : 'Belum ada pengajuan harga yang menunggu.'}
          </p>
        ) : (
          <div className="space-y-5">
            {priceProposals.map((group: any, idx: number) => {
              const diff = group.avgProposedPrice - group.currentPrice;
              const diffPct = group.currentPrice > 0 ? ((diff / group.currentPrice) * 100).toFixed(1) : '0';
              const isUp = diff > 0;
              return (
                <div key={idx} className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="bg-slate-50 px-5 py-3 flex justify-between items-center flex-wrap gap-3">
                    <div>
                      <span className="font-black text-slate-900 text-sm">{group.commodity}</span>
                      <span className="ml-2 text-[11px] text-slate-500 font-semibold">{group.regionName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-100 text-amber-900 font-extrabold text-[10px] px-2.5 py-1 rounded-full">
                        {group.totalProposals} petani mengajukan
                      </span>
                      {isUp
                        ? <span className="bg-rose-100 text-rose-800 font-extrabold text-[10px] px-2.5 py-1 rounded-full">+{diffPct}% naik</span>
                        : <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-2.5 py-1 rounded-full">{diffPct}% turun</span>
                      }
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Harga Saat Ini', val: group.currentPrice, color: 'text-slate-700' },
                        { label: 'Rata-rata Pengajuan', val: group.avgProposedPrice, color: 'text-amber-700' },
                        { label: 'Terendah Diajukan', val: group.minProposedPrice, color: 'text-emerald-700' },
                        { label: 'Tertinggi Diajukan', val: group.maxProposedPrice, color: 'text-rose-700' },
                      ].map((s) => (
                        <div key={s.label} className="bg-slate-50 rounded-xl p-3 space-y-0.5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{s.label}</p>
                          <p className={`font-black text-sm ${s.color}`}>Rp {Number(s.val).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>

                    {group.aiAnalysis && (
                      <div className="bg-violet-50 border border-violet-200/80 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center gap-2 text-violet-800 font-extrabold text-xs">
                          <Brain className="w-4 h-4"/>
                          <span>Analisis AI Hervest (9Router)</span>
                          <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                            group.aiAnalysis.impactLevel === 'HIGH' ? 'bg-rose-100 text-rose-800' :
                            group.aiAnalysis.impactLevel === 'MEDIUM' ? 'bg-amber-100 text-amber-800' :
                            'bg-emerald-100 text-emerald-800'
                          }`}>
                            Dampak {group.aiAnalysis.impactLevel}
                          </span>
                        </div>
                        <p className="text-xs text-violet-900 font-semibold leading-relaxed">{group.aiAnalysis.rationale}</p>
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[10px] font-bold text-violet-600">Rekomendasi AI:</span>
                          <span className="font-black text-violet-900 text-sm">Rp {Number(group.aiAnalysis.recommendedPrice).toLocaleString()}/Kg</span>
                        </div>
                      </div>
                    )}

                    {group.reasons?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase">Alasan dari Petani</p>
                        <div className="flex flex-wrap gap-2">
                          {group.reasons.map((r: string, i: number) => (
                            <span key={i} className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2.5 py-1 rounded-lg">
                              "{r}"
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <details className="cursor-pointer">
                      <summary className="text-[11px] font-bold text-slate-500 hover:text-slate-700">
                        Lihat {group.proposals.length} detail pengajuan petani →
                      </summary>
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-[11px] text-slate-700">
                          <thead className="text-[10px] font-extrabold uppercase text-slate-400 border-b border-slate-200">
                            <tr>
                              <th className="pb-2 text-left">Petani</th>
                              <th className="pb-2 text-right">Harga Diajukan</th>
                              <th className="pb-2 text-left pl-3">Alasan</th>
                              <th className="pb-2 text-right">Tanggal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {group.proposals.map((p: any) => (
                              <tr key={p.id} className="hover:bg-slate-50">
                                <td className="py-2 font-bold text-slate-900">{p.farmerName} <span className="font-normal text-slate-400">({p.farmerRegion || '-'})</span></td>
                                <td className="py-2 text-right font-black text-emerald-800">Rp {Number(p.proposedPrice).toLocaleString()}</td>
                                <td className="py-2 pl-3 text-slate-600 max-w-xs truncate">{p.reason || '-'}</td>
                                <td className="py-2 text-right font-mono text-[10px] text-slate-400">{new Date(p.createdAt).toLocaleDateString('id-ID')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>

                    <div className="flex gap-2 pt-1 flex-wrap">
                      <button
                        onClick={() => {
                          const price = prompt(`Setujui dengan harga berapa? (Rekomendasi AI: Rp ${Number(group.aiAnalysis?.recommendedPrice || group.avgProposedPrice).toLocaleString()})`, String(group.aiAnalysis?.recommendedPrice || group.avgProposedPrice));
                          if (price) handleProposalAction(group.regionName, group.commodity, 'APPROVE', Number(price));
                        }}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-extrabold shadow-sm shadow-emerald-200"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5"/>
                        Setujui & Terapkan Harga Baru
                      </button>
                      <button
                        onClick={() => handleProposalAction(group.regionName, group.commodity, 'REJECT')}
                        className="flex items-center gap-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 px-4 py-2 rounded-xl text-xs font-extrabold"
                      >
                        <XCircle className="w-3.5 h-3.5"/>
                        Tolak Semua Pengajuan
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}