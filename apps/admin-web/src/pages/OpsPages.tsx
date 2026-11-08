import React, { useCallback, useEffect, useState } from 'react';
import { api, getErrorMessage } from '../api/client';

/** Small hook: load a list from the API and expose reload + error. */
function useList<T>(path: string) {
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    api.get(path).then((r) => { setItems(r.data); setError(''); }).catch((e) => setError(getErrorMessage(e))).finally(() => setLoading(false));
  }, [path]);
  useEffect(reload, [reload]);
  return { items, error, loading, reload };
}

const fmt = (d?: string) => (d ? new Date(d).toLocaleString() : '—');
const naira = (n: number | string) => '₦' + Number(n || 0).toLocaleString();

function Status({ text }: { text: string }) {
  return <span className={`badge ${/VERIFIED|APPROVED|ACTIVE|Approved|answered|closed/.test(text) ? 'badge-active' : /REJECT|DECLIN|SUSPEND|Declined/.test(text) ? 'badge-inactive' : 'badge-role'}`}>{text}</span>;
}

// ---------------------------------------------------------------------------
export function OpsDashboardPage() {
  const [s, setS] = useState<any>(null);
  useEffect(() => { api.get('/admin-ops/stats').then((r) => setS(r.data)).catch(() => {}); }, []);
  if (!s) return <div className="empty-state">Loading…</div>;
  const tiles: [string, string | number][] = [
    ['Users', s.users], ['Pending verifications', s.pendingVerifications], ['Campaigns to review', s.pendingCampaigns], ['Open tickets', s.openTickets],
    ['Appointments (30d)', s.last30.appointments], ['Orders (30d)', s.last30.orders], ['Emergencies (30d)', s.last30.emergencies], ['Top-ups (30d)', naira(s.last30.topups)],
    ['Outstanding coins (liability)', naira(s.outstandingCoins)],
  ];
  return (
    <div>
      <h1 className="page-title">Operations</h1>
      <p className="page-subtitle">Platform health and work queues.</p>
      <div className="stat-grid">{tiles.map(([l, v]) => <div className="stat-card" key={l}><div className="stat-number">{v}</div><div className="stat-label">{l}</div></div>)}</div>
      <div className="card"><h3>Users by role</h3><table><tbody>{Object.entries(s.byRole).map(([r, n]) => <tr key={r}><td>{r}</td><td>{String(n)}</td></tr>)}</tbody></table></div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function VerificationsPage() {
  const [status, setStatus] = useState('PENDING');
  const { items, error, reload } = useList<any>('/admin-ops/verifications?status=' + status);
  const decide = async (id: string, decision: string, kycOk: boolean) => {
    const note = decision === 'VERIFIED' ? '' : window.prompt('Reason (sent to the provider):') || '';
    let overrideKyc = false;
    if (decision === 'VERIFIED' && !kycOk) {
      if (!window.confirm('Identity (Didit KYC) is not approved. Override after manual ID checks?')) return;
      overrideKyc = true;
    }
    try { await api.post('/admin-ops/verifications/' + id, { decision, note, overrideKyc }); reload(); } catch (e) { alert(getErrorMessage(e)); }
  };
  return (
    <div>
      <h1 className="page-title">Provider verification</h1>
      <p className="page-subtitle">Check licences with the issuing council (MDCN, PCN, MLSCN, NMCN, CAC…) before approving. Identity is verified by Didit.</p>
      <div className="toolbar">{['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED', 'UNVERIFIED'].map((s) => <button key={s} className={s === status ? '' : 'outline'} onClick={() => setStatus(s)}>{s}</button>)}</div>
      {error && <div className="error-text">{error}</div>}
      {items.length === 0 ? <div className="card empty-state">Queue is empty.</div> : items.map((u) => {
        const prof = u.doctorProfile || u.nurseProfile || u.pharmacyProfile || u.labProfile || u.ambulanceProfile || u.institutionProfile || {};
        const kyc = u.kycVerifications?.[0];
        return (
          <div className="card" key={u.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ margin: 0 }}>{u.name} <span className="badge badge-role">{u.role}</span></h3>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{u.email} · {u.phone || 'no phone'} · {u.country} · joined {fmt(u.createdAt)}</div>
                <div style={{ marginTop: 6, fontSize: 13 }}>Licence: <b>{prof.licenseNumber || '—'}</b> {prof.specialty || prof.pharmacyName || prof.labName || prof.vehicleNumber || prof.name || ''} {prof.address || prof.hospital || ''}</div>
                <div style={{ marginTop: 6, fontSize: 13 }}>KYC: <Status text={u.kycStatus} /> {kyc && <span>{kyc.fullName} · {kyc.documentType} · {kyc.documentCountry} · DOB {kyc.dateOfBirth}</span>}</div>
                {u.verificationNote && <div style={{ fontSize: 12, marginTop: 4 }}>Note: {u.verificationNote}</div>}
              </div>
              <div className="row-actions">
                <button onClick={() => decide(u.id, 'VERIFIED', u.kycStatus === 'APPROVED')}>Approve</button>
                <button className="outline" onClick={() => decide(u.id, 'REJECTED', true)}>Reject</button>
                <button className="outline" onClick={() => decide(u.id, 'SUSPENDED', true)}>Suspend</button>
              </div>
            </div>
            <table style={{ marginTop: 10 }}>
              <thead><tr><th>Document</th><th>Type</th><th>Expires</th><th>Status</th><th /></tr></thead>
              <tbody>{(u.providerDocuments || []).map((d: any) => <tr key={d.id}><td>{d.title}</td><td>{d.type}</td><td>{d.expiresAt ? new Date(d.expiresAt).toLocaleDateString() : '—'}</td><td><Status text={d.status} /></td><td><a href={d.fileUrl} target="_blank" rel="noreferrer">Open</a></td></tr>)}
                {!u.providerDocuments?.length && <tr><td colSpan={5}>No documents uploaded yet.</td></tr>}</tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function KycPage() {
  const { items, error } = useList<any>('/admin-ops/kyc');
  return (
    <div>
      <h1 className="page-title">Identity verifications (Didit)</h1>
      <p className="page-subtitle">Latest KYC sessions. Decisions arrive by signed webhook.</p>
      {error && <div className="error-text">{error}</div>}
      <div className="card" style={{ padding: 0 }}>
        <table><thead><tr><th>When</th><th>User</th><th>Role</th><th>Purpose</th><th>Document</th><th>Name on ID</th><th>Status</th></tr></thead>
          <tbody>{items.map((k) => <tr key={k.id}><td>{fmt(k.createdAt)}</td><td>{k.user?.name}<br /><small>{k.user?.email}</small></td><td>{k.user?.role}</td><td>{k.purpose}</td><td>{k.documentType} {k.documentCountry}</td><td>{k.fullName}</td><td><Status text={k.status} /></td></tr>)}</tbody></table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function CampaignsPage() {
  const [status, setStatus] = useState('PENDING_REVIEW');
  const { items, error, reload } = useList<any>('/admin-ops/campaigns?status=' + status);
  const decide = async (id: string, s: string) => { try { await api.post('/admin-ops/campaigns/' + id, { status: s }); reload(); } catch (e) { alert(getErrorMessage(e)); } };
  return (
    <div>
      <h1 className="page-title">Donation campaigns</h1>
      <p className="page-subtitle">Verify the story, beneficiary and hospital before a campaign goes live.</p>
      <div className="toolbar">{['PENDING_REVIEW', 'ACTIVE', 'COMPLETED', 'REJECTED', 'CLOSED'].map((s) => <button key={s} className={s === status ? '' : 'outline'} onClick={() => setStatus(s)}>{s}</button>)}</div>
      {error && <div className="error-text">{error}</div>}
      {items.length === 0 ? <div className="card empty-state">Nothing here.</div> : items.map((c) => (
        <div className="card" key={c.id}>
          <h3 style={{ margin: 0 }}>{c.title} <span className="badge badge-role">{c.type}</span> {c.urgency !== 'NORMAL' && <span className="badge badge-inactive">{c.urgency}</span>}</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{c.description}</p>
          <div style={{ fontSize: 13 }}>Organizer: {c.organizer?.name} ({c.organizer?.email}, {c.organizer?.phone}) · KYC {c.organizer?.kycStatus}</div>
          <div style={{ fontSize: 13 }}>Beneficiary: {c.beneficiaryName || '—'} · Location: {c.location || '—'} · Goal: {naira(c.goalAmount)} · Raised: {naira(c.raisedAmount)} · Needs: {c.bloodType || c.organ || '—'} x{c.unitsNeeded || '—'}</div>
          <div className="row-actions" style={{ marginTop: 10 }}>
            {status !== 'ACTIVE' && <button onClick={() => decide(c.id, 'ACTIVE')}>Approve & publish</button>}
            {status === 'PENDING_REVIEW' && <button className="outline" onClick={() => decide(c.id, 'REJECTED')}>Reject</button>}
            {status === 'ACTIVE' && <button className="outline" onClick={() => decide(c.id, 'CLOSED')}>Close</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function PayoutsPage() {
  const { items, error } = useList<any>('/admin-ops/payouts');
  return (
    <div>
      <h1 className="page-title">Provider payouts</h1>
      <p className="page-subtitle">Coins paid to providers for services. Settle to their bank account on the weekly cycle (escrow payments settle automatically through PayScrow).</p>
      {error && <div className="error-text">{error}</div>}
      <div className="card" style={{ padding: 0 }}>
        <table><thead><tr><th>Provider</th><th>Role</th><th>Payments</th><th>Amount</th><th>Bank account</th></tr></thead>
          <tbody>{items.map((p, i) => <tr key={i}><td>{p.provider?.name}</td><td>{p.provider?.role}</td><td>{p.payments}</td><td>{naira(p.amount)}</td><td>{p.provider?.bankAccounts?.[0] ? `${p.provider.bankAccounts[0].bankName} · ${p.provider.bankAccounts[0].accountNumber} · ${p.provider.bankAccounts[0].accountName}` : <span className="error-text">No bank account</span>}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function TicketsPage() {
  const [status, setStatus] = useState('open');
  const { items, error, reload } = useList<any>('/admin-ops/tickets?status=' + status);
  const reply = async (id: string, close: boolean) => {
    const text = window.prompt('Reply to the user:');
    if (!text) return;
    try { await api.post('/admin-ops/tickets/' + id + '/reply', { reply: text, close }); reload(); } catch (e) { alert(getErrorMessage(e)); }
  };
  return (
    <div>
      <h1 className="page-title">Support tickets</h1>
      <div className="toolbar">{['open', 'answered', 'closed'].map((s) => <button key={s} className={s === status ? '' : 'outline'} onClick={() => setStatus(s)}>{s}</button>)}</div>
      {error && <div className="error-text">{error}</div>}
      {items.length === 0 ? <div className="card empty-state">No tickets.</div> : items.map((t) => (
        <div className="card" key={t.id}>
          <h3 style={{ margin: 0 }}>{t.subject} <span className="badge badge-role">{t.category}</span> {t.priority === 'high' && <span className="badge badge-inactive">URGENT</span>}</h3>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.userName} · {t.userEmail} · {fmt(t.createdAt)}</div>
          <p style={{ whiteSpace: 'pre-wrap' }}>{t.message}</p>
          {t.adminReply && <p style={{ background: '#f5f7fa', padding: 8, borderRadius: 8 }}>Reply: {t.adminReply}</p>}
          <div className="row-actions"><button onClick={() => reply(t.id, false)}>Reply</button><button className="outline" onClick={() => reply(t.id, true)}>Reply & close</button></div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
const CATALOG_FIELDS: Record<string, string[]> = {
  'insurance-plans': ['name', 'provider', 'type', 'monthlyPremium', 'description'],
  'donation-centers': ['name', 'type', 'address', 'city', 'state', 'country', 'phone', 'hours'],
  articles: ['slug', 'title', 'category', 'summary', 'body', 'imageUrl'],
};
export function CatalogPage() {
  const [kind, setKind] = useState('insurance-plans');
  const { items, error, reload } = useList<any>('/admin-ops/catalog/' + kind);
  const [edit, setEdit] = useState<any | null>(null);
  const save = async () => {
    try {
      const body = { ...edit };
      if (kind === 'insurance-plans' && typeof body.coverage === 'string') body.coverage = body.coverage.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (kind === 'insurance-plans' && !body.coverage) body.coverage = [];
      await api.post('/admin-ops/catalog/' + kind, body); setEdit(null); reload();
    } catch (e) { alert(getErrorMessage(e)); }
  };
  const remove = async (id: string) => { if (window.confirm('Delete?')) { await api.delete(`/admin-ops/catalog/${kind}/${id}`).catch((e) => alert(getErrorMessage(e))); reload(); } };
  const fields = CATALOG_FIELDS[kind].concat(kind === 'insurance-plans' ? ['coverage'] : []);
  return (
    <div>
      <h1 className="page-title">Catalogs</h1>
      <p className="page-subtitle">Reference data shown in the app.</p>
      <div className="toolbar">{Object.keys(CATALOG_FIELDS).map((k) => <button key={k} className={k === kind ? '' : 'outline'} onClick={() => { setKind(k); setEdit(null); }}>{k}</button>)}<button onClick={() => setEdit({})}>+ New</button></div>
      {error && <div className="error-text">{error}</div>}
      {edit && (
        <div className="card">
          {fields.map((f) => (
            <div className="field" key={f}><label>{f}</label>
              {f === 'body' || f === 'description' ? <textarea rows={4} value={edit[f] ?? ''} onChange={(e) => setEdit({ ...edit, [f]: e.target.value })} />
                : <input value={Array.isArray(edit[f]) ? edit[f].join(', ') : edit[f] ?? ''} onChange={(e) => setEdit({ ...edit, [f]: e.target.value })} />}
            </div>
          ))}
          <div className="row-actions"><button onClick={save}>Save</button><button className="outline" onClick={() => setEdit(null)}>Cancel</button></div>
        </div>
      )}
      <div className="card" style={{ padding: 0 }}>
        <table><thead><tr>{CATALOG_FIELDS[kind].slice(0, 4).map((f) => <th key={f}>{f}</th>)}<th /></tr></thead>
          <tbody>{items.map((it) => <tr key={it.id}>{CATALOG_FIELDS[kind].slice(0, 4).map((f) => <td key={f}>{String(it[f] ?? '')}</td>)}<td className="row-actions"><button className="outline" onClick={() => setEdit(it)}>Edit</button><button className="outline" onClick={() => remove(it.id)}>Delete</button></td></tr>)}</tbody></table>
      </div>
      <div className="card">
        <h3>Display exchange rates</h3>
        <p className="page-subtitle">Units of a currency per ₦1 (e.g. USD 0.00065).</p>
        <RateForm />
      </div>
    </div>
  );
}
function RateForm() {
  const [code, setCode] = useState('USD');
  const [rate, setRate] = useState('');
  return (
    <div className="toolbar">
      <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} style={{ width: 80 }} />
      <input value={rate} onChange={(e) => setRate(e.target.value)} placeholder="perNgn" />
      <button onClick={() => api.post('/admin-ops/rates', { code, perNgn: Number(rate) }).then(() => alert('Saved')).catch((e) => alert(getErrorMessage(e)))}>Save rate</button>
    </div>
  );
}
