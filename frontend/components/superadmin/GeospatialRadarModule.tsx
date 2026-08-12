'use client';

import React from 'react';
import { MapPin } from 'lucide-react';

interface GeospatialRadarModuleProps {
  geospatialUsers: any[];
}

export default function GeospatialRadarModule({ geospatialUsers }: GeospatialRadarModuleProps) {
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

  type GeoGroup = {
    regionKey: string;
    label: string;
    centerLat: number;
    centerLng: number;
    members: any[];
    petaniCount: number;
    umkmCount: number;
    adminCount: number;
  };

  const groups: GeoGroup[] = [];

  for (const g of geospatialUsers) {
    const nameKey = normalize(g.regionName || '');
    const lat = Number(g.latitude) || 0;
    const lng = Number(g.longitude) || 0;

    const match = groups.find(gr => {
      const sameName = nameKey && gr.regionKey === nameKey;
      const nearby = Math.abs(gr.centerLat - lat) < 0.15 && Math.abs(gr.centerLng - lng) < 0.15;
      return sameName || (!nameKey && nearby);
    });

    if (match) {
      match.members.push(g);
      const n = match.members.length;
      match.centerLat = match.members.reduce((s, m) => s + Number(m.latitude || 0), 0) / n;
      match.centerLng = match.members.reduce((s, m) => s + Number(m.longitude || 0), 0) / n;
      if (g.role === 'PETANI') match.petaniCount++;
      else if (g.role === 'UMKM') match.umkmCount++;
      else match.adminCount++;
    } else {
      groups.push({
        regionKey: nameKey,
        label: g.regionName || `Cluster ${lat.toFixed(2)}, ${lng.toFixed(2)}`,
        centerLat: lat,
        centerLng: lng,
        members: [g],
        petaniCount: g.role === 'PETANI' ? 1 : 0,
        umkmCount: g.role === 'UMKM' ? 1 : 0,
        adminCount: !['PETANI','UMKM'].includes(g.role) ? 1 : 0,
      });
    }
  }

  groups.sort((a, b) => b.members.length - a.members.length);

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-base font-black text-slate-900">Radar Geospasial — {groups.length} Region, {geospatialUsers.length} User</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-800">
          <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
            <tr>
              <th className="p-3">Wilayah / Cluster</th>
              <th className="p-3 text-center">Petani</th>
              <th className="p-3 text-center">UMKM</th>
              <th className="p-3 text-center">Admin</th>
              <th className="p-3 text-center">Total</th>
              <th className="p-3">Koordinat Pusat</th>
              <th className="p-3">Anggota</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groups.map((gr, idx) => (
              <tr key={idx} className="hover:bg-slate-50 align-top">
                <td className="p-3">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0"/>
                    <span className="font-black text-slate-900">{gr.label}</span>
                  </div>
                </td>
                <td className="p-3 text-center">
                  {gr.petaniCount > 0 ? (
                    <span className="bg-emerald-100 text-emerald-900 font-extrabold px-2 py-0.5 rounded-full text-[10px]">{gr.petaniCount}</span>
                  ) : <span className="text-slate-300">—</span>}
                </td>
                <td className="p-3 text-center">
                  {gr.umkmCount > 0 ? (
                    <span className="bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded-full text-[10px]">{gr.umkmCount}</span>
                  ) : <span className="text-slate-300">—</span>}
                </td>
                <td className="p-3 text-center">
                  {gr.adminCount > 0 ? (
                    <span className="bg-purple-100 text-purple-900 font-extrabold px-2 py-0.5 rounded-full text-[10px]">{gr.adminCount}</span>
                  ) : <span className="text-slate-300">—</span>}
                </td>
                <td className="p-3 text-center">
                  <span className="font-black text-slate-900">{gr.members.length}</span>
                </td>
                <td className="p-3 font-mono text-[10px] text-slate-500">
                  {gr.centerLat.toFixed(4)}, {gr.centerLng.toFixed(4)}
                </td>
                <td className="p-3 max-w-xs">
                  <div className="flex flex-wrap gap-1">
                    {gr.members.map((m) => (
                      <span key={m.id} title={`${m.name} (${m.role}) — ${m.phone_number || ''}`}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          m.role === 'PETANI' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
                          m.role === 'UMKM' ? 'bg-amber-50 border-amber-200 text-amber-900' :
                          'bg-purple-50 border-purple-200 text-purple-900'
                        }`}>
                        {m.name}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}