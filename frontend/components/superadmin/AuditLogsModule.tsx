'use client';

import React from 'react';

interface AuditLogsModuleProps {
  auditLogs: any[];
}

export default function AuditLogsModule({ auditLogs }: AuditLogsModuleProps) {
  return (
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
  );
}