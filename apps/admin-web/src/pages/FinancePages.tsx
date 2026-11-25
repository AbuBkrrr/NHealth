import React, { useCallback, useEffect, useState } from 'react';
import { api, getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

const naira = (n: number | string) => '₦' + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString() : '—');
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SERVICES: [string, string][] = [['APPOINTMENT', 'Doctor consultations'], ['NURSE_REQUEST', 'Nurse home care'], ['LAB_TEST', 'Lab tests'], ['PHARMACY_ORDER', 'Pharmacy orders & coin POS sales'], ['EMERGENCY', 'Ambulance trips']];

function useLoad<T>(path: string, init: T) {
  const [data, setData] = useState<T>(init);
  const [error, setError] = useState('');
  const reload = useCallback(() => { api.get(path).then((r) => { setData(r.data); setError(''); }).catch((e) => setError(getErrorMessage(e))); }, [path]);
  useEffect(reload, [reload]);
  return { data, error, reload, setData };
}

// ---------------------------------------------------------------------------
/** Fees & payout policy (super admin), provider balances and payout runs. */
export function FinancePage() {
  const { user } = useAuth();
  const sa = !!user?.isSuperAdmin;
  const { data: s, error, setData } = useLoad<any>('/admin-ops/finance', null);
  const bal = useLoad<any[]>('/admin-ops/balances', []);
  const [status, setStatus] = useState('');
  const pay = useLoad<any[]>('/admin-ops/payout-runs' + (status ? '?status=' + status : ''), []);
  const [msg, setMsg] = useState('');
  if (!s) return <div className="empty-state">{error || 'Loading…'}</div>;
  const set = (k: string, v: any) => setData({ ...s, [k]: v });
  const setC = (k: string, v: any) => setData({ ...s, commission: { ...s.commission, [k]: v } });
  const save = async () => { try { const r = await api.put('/admin-ops/finance', s); setData(r.data); setMsg('Saved ✓'); } catch (e) { setMsg(getErrorMessage(e)); } };
  const run = async (providerUserId?: string) => {
    if (!window.confirm(providerUserId ? 'Pay this provider now?' : 'Run payouts for every provider with an available balance now?')) return;
    try { const r = await api.post('/admin-ops/payout-runs', providerUserId ? { providerUserId } : {}); setMsg(`Processed ${r.data.length} provider(s)`); bal.reload(); pay.reload(); } catch (e) { alert(getErrorMessage(e)); }
  };
  const mark = async (id: string, st: string) => { const note = window.prompt(st === 'PAID' ? 'Bank reference / note:' : 'Reason:') ?? ''; try { await api.post(`/admin-ops/payout-runs/${id}/status`, { status: st, note }); pay.reload(); bal.reload(); } catch (e) { alert(getErrorMessage(e)); } };
  const adjust = async (id: string) => { const a = window.prompt('Amount (+ credit to provider, − debit):'); if (!a) return; const d = window.prompt('Reason (shown to provider):'); if (!d) return; try { await api.post('/admin-ops/ledger/adjust', { providerUserId: id, amount: Number(a), description: d }); bal.reload(); } catch (e) { alert(getErrorMessage(e)); } };
  const num = (k: string, v: any, label: string, help = '', isC = false) => (
    <div className="field" key={k}><label>{label}</label><input type="number" disabled={!sa} value={v} onChange={(e) => (isC ? setC(k, e.target.value) : set(k, e.target.value))} />{help && <small style={{ color: 'var(--text-secondary)' }}>{help}</small>}</div>
  );
  return (
    <div>
      <h1 className="page-title">Fees & payouts</h1>
      <p className="page-subtitle">How N-Health earns and how providers get paid. In-app payments are collected by the platform and paid out minus commission; for cash jobs the provider keeps the money and the commission is deducted from their balance.</p>
      {!sa && <div className="error-text">Only super admins can change fees.</div>}
      <div className="card">
        <h3>Commission per service (%)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>{SERVICES.map(([k, l]) => num(k, s.commission[k], l, '', true))}</div>
        <h3>Patient & POS</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
          {num('patientServiceFeePercent', s.patientServiceFeePercent, 'Patient booking fee (%)', 'Added on top of consultation fees')}
          {num('posTaxPercent', s.posTaxPercent, 'POS tax (%)')}
        </div>
        <h3>Cash</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
          <div className="field"><label>Allow cash payments</label><select disabled={!sa} value={String(s.cashEnabled)} onChange={(e) => set('cashEnabled', e.target.value === 'true')}><option value="true">Yes</option><option value="false">No</option></select></div>
          {num('cashDebtLimit', s.cashDebtLimit, 'Cash debt limit (₦)', 'Providers owing more cannot take cash jobs')}
        </div>
        <h3>Payouts</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
          <div className="field"><label>Schedule</label><select disabled={!sa} value={s.payoutSchedule} onChange={(e) => set('payoutSchedule', e.target.value)}><option value="WEEKLY">Weekly</option><option value="DAILY">Daily</option><option value="MANUAL">Manual only</option></select></div>
          <div className="field"><label>Payout day</label><select disabled={!sa || s.payoutSchedule !== 'WEEKLY'} value={s.payoutDay} onChange={(e) => set('payoutDay', Number(e.target.value))}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>
          {num('payoutHour', s.payoutHour, 'Payout hour (0-23, Lagos time)')}
          {num('minPayout', s.minPayout, 'Minimum payout (₦)')}
          {num('holdHours', s.holdHours, 'Hold period (hours)', 'Earnings become payable after this dispute window')}
          <div className="field"><label>Transfer provider</label><select disabled={!sa} value={s.payoutGateway} onChange={(e) => set('payoutGateway', e.target.value)}><option value="paystack">Paystack Transfers</option><option value="flutterwave">Flutterwave Transfers</option><option value="manual">Manual (finance team pays)</option></select></div>
        </div>
        {sa && <div className="row-actions"><button onClick={save}>Save settings</button><span>{msg}</span></div>}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="toolbar" style={{ padding: 12 }}><h3 style={{ margin: 0, flex: 1 }}>Provider balances</h3>{sa && <button onClick={() => run()}>Run payouts now</button>}</div>
        <table><thead><tr><th>Provider</th><th>Balance</th><th>Available</th><th>Pending</th><th>Owes</th><th>Bank</th><th /></tr></thead>
          <tbody>{bal.data.map((b) => (
            <tr key={b.provider.id}><td>{b.provider.name}<br /><small>{b.provider.role} · {b.provider.email}</small></td><td>{naira(b.balance)}</td><td>{naira(b.available)}</td><td>{naira(b.pending)}</td><td style={{ color: b.owed ? 'var(--error)' : undefined }}>{b.owed ? naira(b.owed) : '—'}</td>
              <td>{b.provider.bankAccounts?.[0] ? `${b.provider.bankAccounts[0].bankName} ••${b.provider.bankAccounts[0].accountNumber.slice(-4)} ${b.provider.bankAccounts[0].isVerified ? '✓' : ''}` : <span className="error-text">none</span>}</td>
              <td className="row-actions">{sa && b.available > 0 && <button className="outline" onClick={() => run(b.provider.id)}>Pay now</button>}{sa && <button className="outline" onClick={() => adjust(b.provider.id)}>Adjust</button>}</td></tr>
          ))}{!bal.data.length && <tr><td colSpan={7}>No provider earnings yet.</td></tr>}</tbody></table>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="toolbar" style={{ padding: 12 }}><h3 style={{ margin: 0, flex: 1 }}>Payouts</h3>{['', 'PENDING', 'PROCESSING', 'PAID', 'FAILED'].map((x) => <button key={x} className={x === status ? '' : 'outline'} onClick={() => setStatus(x)}>{x || 'ALL'}</button>)}</div>
        <table><thead><tr><th>When</th><th>Provider</th><th>Amount</th><th>Bank</th><th>Via</th><th>Status</th><th /></tr></thead>
          <tbody>{pay.data.map((p) => (
            <tr key={p.id}><td>{fmt(p.createdAt)}</td><td>{p.provider?.name}</td><td>{naira(p.amount)}</td><td>{p.bankName} · {p.accountNumber} · {p.accountName}</td><td>{p.gateway}</td>
              <td><span className={`badge ${p.status === 'PAID' ? 'badge-active' : p.status === 'FAILED' || p.status === 'REVERSED' ? 'badge-inactive' : 'badge-role'}`}>{p.status}</span>{p.failureReason && <div><small>{p.failureReason}</small></div>}</td>
              <td className="row-actions">{sa && ['PENDING', 'PROCESSING'].includes(p.status) && <><button className="outline" onClick={() => mark(p.id, 'PAID')}>Mark paid</button><button className="outline" onClick={() => mark(p.id, 'FAILED')}>Mark failed</button></>}</td></tr>
          ))}</tbody></table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function RevenuePage() {
  const [days, setDays] = useState(30);
  const { data: r } = useLoad<any>('/admin-ops/revenue?days=' + days, null);
  return (
    <div>
      <h1 className="page-title">Revenue</h1>
      <div className="toolbar">{[7, 30, 90, 365].map((d) => <button key={d} className={d === days ? '' : 'outline'} onClick={() => setDays(d)}>{d === 365 ? '1 year' : d + ' days'}</button>)}</div>
      {r && <div className="stat-grid">{([
        ['Gross service value', r.gmv], ['Commission (in-app)', r.commissionInApp], ['Commission (cash jobs)', r.commissionCash], ['Patient booking fees', r.patientFees],
        ['Commission (card, split)', r.directRevenue], ['Commission (escrow)', r.escrowRevenue],
        ['Platform revenue', r.commissionInApp + r.commissionCash + r.patientFees + (r.directRevenue || 0) + (r.escrowRevenue || 0)], ['Coins topped up', r.topups], ['Payouts sent', r.payoutsPaid], ['Owed to providers now', r.netProviderBalance],
      ] as [string, number][]).map(([l, v]) => <div className="stat-card" key={l}><div className="stat-number">{naira(v)}</div><div className="stat-label">{l}</div></div>)}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function IntegrationsPage() {
  const { data, error, reload } = useLoad<any>('/admin-ops/integrations', null);
  const [to, setTo] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');
  const test = async (kind: 'email' | 'sms') => {
    setMsg('Sending…');
    try { const r = await api.post('/admin-ops/integrations/test-' + kind, kind === 'email' ? { to: to || undefined } : { to: phone }); setMsg(`Sent to ${r.data.to} ✓ - check that it arrived`); } catch (e) { setMsg(getErrorMessage(e)); }
  };
  return (
    <div>
      <h1 className="page-title">Integration status</h1>
      <p className="page-subtitle">Live checks with the production keys. Copy each webhook URL into the provider's dashboard.</p>
      {error && <div className="error-text">{error}</div>}
      <div className="toolbar"><button onClick={reload}>Re-run checks</button>{data && <span>Checked {fmt(data.checkedAt)} · {data.environment}</span>}</div>
      <div className="card" style={{ padding: 0 }}>
        <table><thead><tr><th>Service</th><th>Status</th><th>Details</th><th>Webhook URL</th><th>Last webhook</th></tr></thead>
          <tbody>{(data?.checks || []).map((c: any) => (
            <tr key={c.name}><td>{c.name}</td><td><span className={`badge ${c.ok ? 'badge-active' : 'badge-inactive'}`}>{c.ok ? 'OK' : c.configured ? 'ATTENTION' : 'NOT SET'}</span></td><td>{c.detail}</td>
              <td>{c.webhookUrl && <code style={{ fontSize: 11, cursor: 'copy' }} onClick={() => navigator.clipboard?.writeText(c.webhookUrl)} title="Click to copy">{c.webhookUrl}</code>}</td><td>{c.webhookUrl ? fmt(c.lastWebhookAt) : ''}</td></tr>
          ))}{!data && !error && <tr><td colSpan={5}>Checking…</td></tr>}</tbody></table>
      </div>
      <div className="card">
        <h3>Send a test</h3>
        <div className="toolbar"><input placeholder="email (defaults to yours)" value={to} onChange={(e) => setTo(e.target.value)} /><button onClick={() => test('email')}>Test email (Resend)</button></div>
        <div className="toolbar"><input placeholder="+2348012345678" value={phone} onChange={(e) => setPhone(e.target.value)} /><button onClick={() => test('sms')}>Test SMS (Termii)</button></div>
        <div>{msg}</div>
      </div>
    </div>
  );
}
