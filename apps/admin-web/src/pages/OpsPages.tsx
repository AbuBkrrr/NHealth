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
  const [q, setQ] = useState('');
  const [qd, setQd] = useState('');
  useEffect(() => { const t = setTimeout(() => setQd(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  const { items, error, reload } = useList<any>('/admin-ops/verifications?status=' + status + (qd ? '&q=' + encodeURIComponent(qd) : ''));
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
      <p className="page-subtitle">Every provider must upload a government ID, proof of address and a health licence before approval. Check the licence with the issuing council (MDCN, PCN, MLSCN, NMCN…); identity is also checked by Didit.</p>
      <div className="toolbar">{['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED', 'UNVERIFIED'].map((s) => <button key={s} className={s === status ? '' : 'outline'} onClick={() => setStatus(s)}>{s}</button>)}<input placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <p className="page-subtitle">{items.length} {status.toLowerCase()} • oldest first</p>
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
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['Government-issued ID', 'Proof of address', 'Health / practising licence'].map((label) => {
                    const missing = (u.missingDocuments || []).includes(label);
                    return <span key={label} className={`badge ${missing ? 'badge-inactive' : 'badge-active'}`}>{missing ? '✗' : '✓'} {label}</span>;
                  })}
                </div>
                {u.missingDocuments?.length > 0 && <div style={{ fontSize: 12, marginTop: 4, color: 'var(--error)' }}>Approve unlocks when all three documents are uploaded.</div>}
                {u.claimedListing && <div style={{ fontSize: 12, marginTop: 4 }}>📍 Claims directory listing: <b>{u.claimedListing.name}</b> ({[u.claimedListing.lga, u.claimedListing.state].filter(Boolean).join(', ')}{u.claimedListing.nhfrCode ? ' • NHFR ' + u.claimedListing.nhfrCode : ''}). Check it matches their documents.</div>}
              </div>
              <div className="row-actions">
                <button disabled={!!u.missingDocuments?.length} title={u.missingDocuments?.length ? 'Missing: ' + u.missingDocuments.join(', ') : 'Approve'} onClick={() => decide(u.id, 'VERIFIED', u.kycStatus === 'APPROVED')}>Approve</button>
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
  const [status, setStatus] = useState('In Review');
  const { items, error, reload } = useList<any>('/admin-ops/kyc' + (status ? '?status=' + encodeURIComponent(status) : ''));
  const [open, setOpen] = useState<any>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const show = async (id: string) => { try { setOpen((await api.get('/admin-ops/kyc/' + id)).data); setNote(''); } catch (e) { alert(getErrorMessage(e)); } };
  const decide = async (decision: string) => {
    if (decision === 'DECLINED' && !note.trim()) return alert('Tell the person why (they see this note), e.g. "The ID photo is blurry".');
    setBusy(true);
    try { await api.post(`/admin-ops/kyc/${open.id}/decide`, { decision, note }); setOpen(null); reload(); } catch (e) { alert(getErrorMessage(e)); } finally { setBusy(false); }
  };
  const f = open?.form;
  const FILES: [string, string][] = [['idFront', 'ID - front'], ['idBack', 'ID - back'], ['selfie', 'Selfie with ID'], ['proofOfAddress', 'Proof of address']];
  return (
    <div>
      <h1 className="page-title">Identity verifications (KYC)</h1>
      <p className="page-subtitle">In-app submissions wait here for review: check the name, date of birth and ID number against the photos, and that the selfie matches the ID. Didit checks are decided automatically.</p>
      <div className="toolbar">{[['In Review', 'To review'], ['Approved', 'Approved'], ['Declined', 'Declined'], ['', 'All']].map(([k, l]) => <button key={l} className={k === status ? '' : 'outline'} onClick={() => setStatus(k)}>{l}</button>)}</div>
      {error && <div className="error-text">{error}</div>}
      <div className="card" style={{ padding: 0 }}>
        <table><thead><tr><th>When</th><th>User</th><th>Role</th><th>Method</th><th>Document</th><th>Name on ID</th><th>Status</th><th></th></tr></thead>
          <tbody>{items.map((k) => <tr key={k.id}><td>{fmt(k.createdAt)}</td><td>{k.user?.name}<br /><small>{k.user?.email}</small></td><td>{k.user?.role}</td><td>{k.provider === 'manual' ? 'Form + documents' : 'Didit'}</td><td>{k.documentType} {k.documentCountry}</td><td>{k.fullName}</td><td><Status text={k.status} /></td>
            <td>{k.provider === 'manual' && <button className={k.status === 'In Review' ? '' : 'outline'} onClick={() => show(k.id)}>{k.status === 'In Review' ? 'Review' : 'View'}</button>}</td></tr>)}</tbody></table>
        {!items.length && <div className="empty-state" style={{ padding: 20 }}>Nothing here.</div>}
      </div>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 820 }}>
            <h3>{open.user?.name} <small style={{ fontWeight: 400 }}>{open.user?.email} • {open.user?.role}</small></h3>
            {f ? (
              <>
                <table><tbody>
                  {[['Full name', f.fullName], ['Date of birth', f.dateOfBirth], ['Sex', f.gender], ['Phone', f.phone], ['Address', [f.address, f.city, f.lga, f.state].filter(Boolean).join(', ')], ['ID', `${open.documentType} • ${f.idNumber}`], ['ID expiry', f.idExpiry]].filter(([, v]) => v).map(([k, v]) => <tr key={k}><td style={{ width: 140, color: 'var(--text-secondary)' }}>{k}</td><td><b>{v}</b></td></tr>)}
                </tbody></table>
                <div className="kyc-files">{FILES.filter(([k]) => f.files?.[k]).map(([k, l]) => (
                  <a key={k} href={f.files[k]} target="_blank" rel="noreferrer" className="kyc-file">
                    {/\.pdf($|\?)/i.test(f.files[k]) ? <div className="kyc-pdf">📄 PDF</div> : <img src={f.files[k]} alt={l} />}<span>{l}</span>
                  </a>))}
                </div>
              </>
            ) : <p className="page-subtitle">No form data.</p>}
            {open.status === 'In Review' ? (
              <>
                <label style={{ display: 'block', marginTop: 10, fontSize: 13 }}>Note to the person (required when declining)<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} style={{ width: '100%' }} placeholder='e.g. "The ID photo is blurry - please retake it in good light"' /></label>
                <div className="toolbar"><button disabled={busy} onClick={() => decide('APPROVED')}>✓ Approve identity</button><button className="danger" disabled={busy} onClick={() => decide('DECLINED')}>Decline</button><button className="outline" onClick={() => setOpen(null)}>Close</button></div>
              </>
            ) : <div className="toolbar"><span className="page-subtitle">Decided: {open.status}</span><button className="outline" onClick={() => setOpen(null)}>Close</button></div>}
          </div>
        </div>
      )}
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
      <p className="page-subtitle">Verify the story, beneficiary and hospital before a campaign goes live. Donations are paid straight to the partner NGO (or the hospital), never to N-Health.</p>
      <DonationPartnerCard />
      <CoinDonations />
      <PendingDonations />
      <QuestsCard />
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

/** The registered NGO that receives all money donations directly (super admins edit it). */
function DonationPartnerCard() {
  const [p, setP] = useState<any>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api.get('/admin-ops/donation-partner').then((r) => setP(r.data)).catch((e) => setMsg(getErrorMessage(e))); }, []);
  if (!p) return msg ? <div className="error-text">{msg}</div> : null;
  const f = (k: string, label: string, ph = '') => <label className="field" key={k}>{label}<input value={p[k] || ''} placeholder={ph} onChange={(e) => setP({ ...p, [k]: e.target.value })} /></label>;
  const save = async () => { setMsg('Saving…'); try { setP((await api.put('/admin-ops/donation-partner', p)).data); setMsg('Saved ✓'); } catch (e) { setMsg(getErrorMessage(e)); } };
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Donation partner (registered NGO)</h3>
      <p className="page-subtitle">When switched on, every money donation goes straight into this NGO's account: by card through its Paystack/Flutterwave subaccount (create one for the NGO's bank account in your Paystack or Flutterwave dashboard), or by bank transfer, which you confirm below from the NGO's statement.</p>
      <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={!!p.enabled} onChange={(e) => setP({ ...p, enabled: e.target.checked })} style={{ width: 'auto' }} /> Send all donations to this NGO</label>
      <div className="mk-form">
        {f('name', 'NGO name')}{f('regNumber', 'CAC registration (IT) number', 'IT-123456')}{f('email', 'Contact email')}{f('website', 'Website')}
        {f('bankName', 'Bank')}{f('accountNumber', 'Account number')}{f('accountName', 'Account name')}
        {f('paystackSubaccount', 'Paystack subaccount code', 'ACCT_xxxxxxxx')}{f('flutterwaveSubaccount', 'Flutterwave subaccount ID', 'RS_xxxxxxxx')}
      </div>
      <div className="row-actions"><button onClick={save}>Save</button> <span>{msg}</span></div>
    </div>
  );
}

/** Coins patients donated to the NGO: N-Health pays their value to the NGO each month from its own funds. */
function CoinDonations() {
  const [r, setR] = useState<any>(null);
  useEffect(() => { api.get('/admin-ops/coin-donations').then((x) => setR(x.data)).catch(() => null); }, []);
  if (!r?.months?.length) return null;
  return (
    <div className="card" style={{ padding: 0 }}>
      <h3 style={{ margin: 12 }}>Coin donations to pay {r.ngo || 'the NGO'}</h3>
      <table><thead><tr><th>Month</th><th>Donations</th><th>Coins</th><th>N-Health pays the NGO</th></tr></thead>
        <tbody>{r.months.map((m: any) => <tr key={m.month}><td>{m.month}</td><td>{m.donations}</td><td>{Math.round(m.coins).toLocaleString()}</td><td>{naira(m.naira)}</td></tr>)}</tbody></table>
    </div>
  );
}

/** Health quests: coins per quest, the daily limit, on/off (super admins edit). */
function QuestsCard() {
  const [q, setQ] = useState<any>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api.get('/admin-ops/quests').then((r) => setQ(r.data)).catch((e) => setMsg(getErrorMessage(e))); }, []);
  if (!q) return msg ? <div className="error-text">{msg}</div> : null;
  const save = async () => { setMsg('Saving…'); try { const r = await api.put('/admin-ops/quests', q); setQ({ ...q, ...r.data }); setMsg('Saved ✓'); } catch (e) { setMsg(getErrorMessage(e)); } };
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Health quests (how patients earn reward coins)</h3>
      <p className="page-subtitle">Coins are never sold. Patients earn them for these actions (like Muslim Pro's Quests), then use them towards care or donate them to the NGO. Each coin used costs N-Health ₦{q.coinValue}. Set a quest to 0 to switch it off.</p>
      <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={!!q.enabled} onChange={(e) => setQ({ ...q, enabled: e.target.checked })} style={{ width: 'auto' }} /> Quests switched on</label>
      <label className="field">Most coins one person can earn from quests per day<input type="number" min={0} value={q.dailyCap} onChange={(e) => setQ({ ...q, dailyCap: e.target.value })} /></label>
      <div className="mk-form">
        {q.quests.map((d: any) => <label className="field" key={d.key}>{d.icon} {d.title} ({d.repeat === 'daily' ? 'daily' : d.repeat === 'each' ? 'each time' : 'once'})<input type="number" min={0} value={q.coins[d.key]} onChange={(e) => setQ({ ...q, coins: { ...q.coins, [d.key]: e.target.value } })} /></label>)}
      </div>
      <div className="row-actions"><button onClick={save}>Save</button> <span>{msg}</span></div>
    </div>
  );
}

/** Bank-transfer donations waiting to be matched against the receiver's statement. */
function PendingDonations() {
  const { items, reload } = useList<any>('/admin-ops/donations/pending');
  const confirm = async (id: string) => { try { await api.post('/donations/' + id + '/received'); reload(); } catch (e) { alert(getErrorMessage(e)); } };
  if (!items.length) return null;
  return (
    <div className="card" style={{ padding: 0 }}>
      <h3 style={{ margin: 12 }}>Bank transfers to confirm</h3>
      <table><thead><tr><th>Reference</th><th>Amount</th><th>Campaign</th><th>Donor</th><th>Date</th><th /></tr></thead>
        <tbody>{items.map((d) => <tr key={d.id}><td>{d.reference}</td><td>{naira(d.amount)}</td><td>{d.campaign}</td><td>{d.patient?.user?.name}</td><td>{new Date(d.createdAt).toLocaleDateString()}</td><td><button onClick={() => confirm(d.id)}>Received</button></td></tr>)}</tbody></table>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function PayoutsPage() {
  const { items, error } = useList<any>('/admin-ops/payouts');
  return (
    <div>
      <h1 className="page-title">Provider payouts</h1>
      <p className="page-subtitle">What N-Health owes providers for services patients paid with reward coins. Card payments settle straight to providers' banks; escrow payments settle through PayScrow.</p>
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
