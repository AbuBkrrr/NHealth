import React, { useCallback, useEffect, useState } from 'react';
import { api, getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

/** Account security: two-step verification (authenticator app or email code), backup codes, and the admin 2FA rule. */
export function SecurityPage() {
  const { user, refreshSession } = useAuth();
  const [st, setSt] = useState<any>(null);
  const [setup, setSetup] = useState<any>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [msg, setMsg] = useState('');
  const [policy, setPolicy] = useState<any>(null);
  const load = useCallback(() => { api.get('/auth/2fa').then((r) => setSt(r.data)).catch((e) => setMsg(getErrorMessage(e))); }, []);
  useEffect(() => { load(); if (user?.isSuperAdmin) api.get('/auth/security').then((r) => setPolicy(r.data)).catch(() => null); }, [load, user]);

  const start = async (method: 'totp' | 'email') => { setMsg(''); setCode(''); try { setSetup((await api.post('/auth/2fa/setup', { method })).data); } catch (e) { setMsg(getErrorMessage(e)); } };
  const enable = async () => {
    try {
      const r = (await api.post('/auth/2fa/enable', { method: setup.method, code })).data;
      setCodes(r.backupCodes); setSetup(null); setCode('');
      refreshSession(r.token, { twoFactor: r.method, mustSetup2fa: false });
      load();
    } catch (e) { setMsg(getErrorMessage(e)); }
  };
  const withCode = async (path: string, done: (r: any) => void) => {
    try {
      let r = (await api.post(path, { code: code || undefined })).data;
      if (r.codeSent) { setMsg(`We emailed a code to ${r.codeSent}. Enter it and press the button again.`); return; }
      done(r); setCode(''); load();
    } catch (e) { setMsg(getErrorMessage(e)); }
  };
  const download = () => {
    const blob = new Blob([`N-Health backup codes for ${user?.email}\nEach code works once.\n\n${(codes || []).join('\n')}\n`], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'nhealth-backup-codes.txt'; a.click();
  };

  if (!st) return <div className="empty-state">{msg || 'Loading…'}</div>;
  return (
    <div>
      <h1 className="page-title">Account security</h1>
      {(user as any)?.mustSetup2fa && !st.enabled && <div className="card" style={{ borderLeft: '4px solid var(--error)' }}><b>Two-step verification is required for admin accounts.</b> Set it up below to continue using the admin console.</div>}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Two-step verification {st.enabled ? <span className="badge badge-active">ON</span> : <span className="badge badge-inactive">OFF</span>}</h3>
        <p className="page-subtitle">When it's on, signing in needs your password and a 6-digit code, so nobody can get into your account with your password alone.</p>
        {st.enabled ? (
          <>
            <p>Method: <b>{st.method === 'totp' ? 'Authenticator app' : 'Code by email'}</b> · since {new Date(st.since).toLocaleDateString()} · {st.backupCodesLeft} backup codes left</p>
            <label className="field">Current code (from your app, your email, or a backup code)<input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" /></label>
            <div className="row-actions">
              <button className="outline" onClick={() => withCode('/auth/2fa/backup-codes', (r) => setCodes(r.backupCodes))}>New backup codes</button>
              {!st.required && <button className="outline" onClick={() => withCode('/auth/2fa/disable', () => { setMsg('Two-step verification is off'); refreshSession(null, { twoFactor: null }); })}>Turn off</button>}
            </div>
          </>
        ) : !setup ? (
          <div className="row-actions">
            <button onClick={() => start('totp')}>Use an authenticator app (recommended)</button>
            <button className="outline" onClick={() => start('email')}>Get codes by email</button>
          </div>
        ) : setup.method === 'totp' ? (
          <div>
            <p>1. Open Google Authenticator, Microsoft Authenticator or Authy and scan this code:</p>
            <img src={setup.qr} alt="QR code for your authenticator app" width={200} height={200} />
            <p style={{ fontSize: 13 }}>Can't scan? Enter this key: <code style={{ userSelect: 'all' }}>{setup.secret}</code></p>
            <label className="field">2. Enter the 6-digit code the app shows<input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} /></label>
            <div className="row-actions"><button onClick={enable}>Turn on</button><button className="outline" onClick={() => setSetup(null)}>Cancel</button></div>
          </div>
        ) : (
          <div>
            <p>We emailed a 6-digit code to {setup.sentTo}.</p>
            <label className="field">Code<input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} /></label>
            <div className="row-actions"><button onClick={enable}>Turn on</button><button className="outline" onClick={() => start('email')}>Send again</button><button className="outline" onClick={() => setSetup(null)}>Cancel</button></div>
          </div>
        )}
        {msg && <div style={{ fontSize: 13, marginTop: 8 }}>{msg}</div>}
      </div>
      {codes && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Your backup codes</h3>
          <p className="page-subtitle">Each code works once, if you lose your phone or can't get emails. Save them now: they won't be shown again.</p>
          <pre style={{ fontSize: 16, columns: 2 }}>{codes.join('\n')}</pre>
          <div className="row-actions"><button onClick={download}>Download</button><button className="outline" onClick={() => setCodes(null)}>I've saved them</button></div>
        </div>
      )}
      {policy && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Rule for admin accounts</h3>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={!!policy.requireAdmin2fa} style={{ width: 'auto' }} onChange={async (e) => { try { setPolicy((await api.put('/auth/security', { requireAdmin2fa: e.target.checked })).data); } catch (err) { setMsg(getErrorMessage(err)); } }} />
            Require two-step verification for every admin account
          </label>
          <p className="page-subtitle">Admins without it are asked to set it up when they sign in, and can't turn it off.</p>
        </div>
      )}
    </div>
  );
}
