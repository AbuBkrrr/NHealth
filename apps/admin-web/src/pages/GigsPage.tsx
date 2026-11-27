import React, { useCallback, useEffect, useState } from 'react';
import { api, getErrorMessage } from '../api/client';

// Health jobs posted by providers: totals, reported posts first, pause / reopen / close.
export function GigsPage() {
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState('');
  const [reported, setReported] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    api.get('/admin-ops/gigs', { params: { status: status || undefined, reported: reported ? '1' : undefined } })
      .then((r) => setData(r.data)).catch((e) => setError(getErrorMessage(e)));
  }, [status, reported]);
  useEffect(load, [load]);
  const set = async (id: string, s: string) => { try { await api.patch('/admin-ops/gigs/' + id, { status: s }); load(); } catch (e) { setError(getErrorMessage(e)); } };
  const t = data?.totals || {};
  return (
    <div>
      <h1 className="page-title">Health jobs</h1>
      <p className="page-subtitle">Jobs and shifts posted by verified providers. Reported posts come first; a post is paused automatically after 5 reports.</p>
      {error && <div className="error-text">{error}</div>}
      {data && (
        <div className="stat-grid">
          <div className="stat-card"><div className="stat-number">{t.OPEN || 0}</div><div className="stat-label">Open jobs</div></div>
          <div className="stat-card"><div className="stat-number">{data.applications}</div><div className="stat-label">Applications</div></div>
          <div className="stat-card"><div className="stat-number">{data.hired}</div><div className="stat-label">People hired</div></div>
          <div className="stat-card"><div className="stat-number">{data.workersOpenToWork}</div><div className="stat-label">Health workers open to work</div></div>
        </div>
      )}
      <div className="card">
        <div className="toolbar">
          <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{['OPEN', 'PAUSED', 'FILLED', 'CLOSED'].map((s) => <option key={s}>{s}</option>)}</select>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={reported} onChange={(e) => setReported(e.target.checked)} /> Reported only</label>
          <button className="outline" onClick={load}>Refresh</button>
        </div>
        <table>
          <thead><tr><th>Job</th><th>Employer</th><th>Where</th><th>Pay</th><th>Status</th><th>Reports</th><th></th></tr></thead>
          <tbody>{(data?.gigs || []).map((g: any) => (
            <tr key={g.id}>
              <td><b>{g.title}</b><div className="page-subtitle">{g.professionLabel} • {g.typeLabel} • {g.positions} position{g.positions > 1 ? 's' : ''}</div></td>
              <td>{g.orgName}<div className="page-subtitle">{g.orgType}</div></td>
              <td>{[g.city, g.state].filter(Boolean).join(', ') || '—'}</td>
              <td>{g.payMin != null || g.payMax != null ? `₦${Number(g.payMin ?? g.payMax).toLocaleString()}${g.payMax != null && g.payMin != null && Number(g.payMax) !== Number(g.payMin) ? ' – ₦' + Number(g.payMax).toLocaleString() : ''} ${g.periodLabel}` : '—'}</td>
              <td><span className={`badge ${g.status === 'OPEN' ? 'badge-active' : 'badge-inactive'}`}>{g.status}</span></td>
              <td style={{ color: g.reports ? 'var(--error)' : undefined, fontWeight: g.reports ? 700 : undefined }}>{g.reports}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {g.status !== 'OPEN' && <button className="outline" onClick={() => set(g.id, 'OPEN')}>Reopen</button>}{' '}
                {g.status === 'OPEN' && <button className="outline" onClick={() => set(g.id, 'PAUSED')}>Pause</button>}{' '}
                {g.status !== 'CLOSED' && <button className="danger" onClick={() => window.confirm('Close this job for good?') && set(g.id, 'CLOSED')}>Close</button>}
              </td>
            </tr>))}</tbody>
        </table>
        {data && !data.gigs.length && <p className="page-subtitle">No jobs match.</p>}
      </div>
    </div>
  );
}
