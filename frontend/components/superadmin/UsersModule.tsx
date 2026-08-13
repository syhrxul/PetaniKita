'use client';

import React from 'react';

interface UsersModuleProps {
  users: any[];
  selectedUser: any;
  setSelectedUser: (user: any) => void;
  customPassword: string;
  setCustomPassword: (pass: string) => void;
  handleResetPass: (userId: number) => void;
  handlePromoteRole: (userId: number, role: string) => void;
  handleDeleteUser: (userId: number) => void;
}

export default function UsersModule({
  users,
  selectedUser,
  setSelectedUser,
  customPassword,
  setCustomPassword,
  handleResetPass,
  handlePromoteRole,
  handleDeleteUser,
}: UsersModuleProps) {
  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
      <h2 className="text-base font-black text-slate-900">Daftar Pengguna Ecosystem ({users.length})</h2>

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
                <td className="p-3 font-mono font-bold text-slate-900">{u.phone_number}</td>
                <td className="p-3 text-right space-x-1.5">
                  <button onClick={() => setSelectedUser(u)} className="bg-slate-200 hover:bg-slate-300 text-slate-900 px-2.5 py-1 rounded-lg font-bold text-[10px]">
                    Reset Pass
                  </button>
                  <button onClick={() => handlePromoteRole(u.id, u.role === 'SUPERADMIN' ? 'PETANI' : 'SUPERADMIN')} className="bg-emerald-200 hover:bg-emerald-300 text-emerald-950 px-2.5 py-1 rounded-lg font-extrabold text-[10px]">
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
  );
}