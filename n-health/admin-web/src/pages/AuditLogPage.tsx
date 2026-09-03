import React, { useEffect, useState } from 'react';
import { adminApi, AuditLogEntry } from '../api/admin';

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    adminApi.listAuditLog().then(setLogs).catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="page-title">Audit Log</h1>
      <p className="page-subtitle">Recent admin actions across the platform.</p>

      <div className="card" style={{ padding: 0 }}>
        {logs.length === 0 ? (
          <div className="empty-state">No admin actions recorded yet.</div>
        ) : (
          <table>
            <thead>
              <tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.createdAt).toLocaleString()}</td>
                  <td>{l.actor.name}</td>
                  <td>{l.action}</td>
                  <td>{l.targetType} · {l.targetId.slice(0, 8)}</td>
                  <td>{l.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
