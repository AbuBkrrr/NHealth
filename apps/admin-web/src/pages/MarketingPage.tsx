import React, { useCallback, useEffect, useState } from 'react';
import { api, getErrorMessage } from '../api/client';

/**
 * Super admin → Marketing.
 * Tracking links & QR codes, "same device or shared?" per link, every open with device/location,
 * leads, signups per link, share kit in several languages, email/SMS broadcasts and ad pixels.
 */
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString() : '—');
const CHANNELS = ['qr', 'whatsapp', 'instagram', 'facebook', 'tiktok', 'x', 'linkedin', 'youtube', 'email', 'sms', 'flyer', 'radio', 'tv', 'partner', 'event', 'other'];
const ROLES = ['PATIENT', 'DOCTOR', 'NURSE', 'PHARMACY', 'LAB', 'AMBULANCE', 'INSTITUTION'];
const INTERESTS = [...ROLES, 'PARTNER', 'INVESTOR'];
const TEMPLATES: Record<string, { lang: string; patient: string; provider: string }> = {
  en: { lang: 'English', patient: 'See a verified doctor, order medicines, book lab tests or call an ambulance - all in one app. Join N-Health free: {link}', provider: 'Doctors, nurses, pharmacies, labs and hospitals: get more patients and get paid directly with N-Health. Join free: {link}' },
  fr: { lang: 'Français', patient: 'Consultez un médecin vérifié, commandez vos médicaments, réservez vos analyses ou appelez une ambulance - tout dans une seule application. Rejoignez N-Health gratuitement : {link}', provider: 'Médecins, infirmiers, pharmacies, laboratoires et hôpitaux : plus de patients et des paiements directs avec N-Health. Inscription gratuite : {link}' },
  es: { lang: 'Español', patient: 'Consulta a un médico verificado, pide medicamentos, reserva análisis o llama a una ambulancia, todo en una app. Únete gratis a N-Health: {link}', provider: 'Médicos, enfermeras, farmacias, laboratorios y hospitales: más pacientes y pagos directos con N-Health. Únete gratis: {link}' },
  pt: { lang: 'Português', patient: 'Consulte um médico verificado, peça medicamentos, marque exames ou chame uma ambulância - tudo num só app. Entre no N-Health grátis: {link}', provider: 'Médicos, enfermeiros, farmácias, laboratórios e hospitais: mais pacientes e pagamentos diretos com o N-Health. Cadastre-se grátis: {link}' },
  ar: { lang: 'العربية', patient: 'استشر طبيبًا موثّقًا، واطلب الأدوية، واحجز التحاليل أو اطلب سيارة إسعاف - كل ذلك في تطبيق واحد. انضم إلى N-Health مجانًا: {link}', provider: 'الأطباء والممرضون والصيدليات والمختبرات والمستشفيات: مرضى أكثر ومدفوعات مباشرة مع N-Health. سجّل مجانًا: {link}' },
  sw: { lang: 'Kiswahili', patient: 'Muone daktari aliyethibitishwa, agiza dawa, weka miadi ya vipimo au ita gari la wagonjwa - yote katika programu moja. Jiunge na N-Health bure: {link}', provider: 'Madaktari, wauguzi, maduka ya dawa, maabara na hospitali: pata wagonjwa zaidi na ulipwe moja kwa moja na N-Health. Jiunge bure: {link}' },
};

function useLoad<T>(path: string, init: T) {
  const [data, setData] = useState<T>(init);
  const [error, setError] = useState('');
  const reload = useCallback(() => { api.get(path).then((r) => { setData(r.data); setError(''); }).catch((e) => setError(getErrorMessage(e))); }, [path]);
  useEffect(reload, [reload]);
  return { data, error, reload, setData };
}

const Bars = ({ title, rows }: { title: string; rows: { name: string; n: number }[] }) => {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="card mk-bars">
      <h3>{title}</h3>
      {rows.length === 0 && <div className="page-subtitle">No data yet</div>}
      {rows.map((r) => (
        <div key={r.name} className="mk-bar"><span className="mk-bar-name" title={r.name}>{r.name}</span><span className="mk-bar-track"><span style={{ width: `${(r.n / max) * 100}%` }} /></span><b>{r.n}</b></div>
      ))}
    </div>
  );
};

export function MarketingPage() {
  const [tab, setTab] = useState('overview');
  const [days, setDays] = useState(30);
  const [linkId, setLinkId] = useState('');
  const ov = useLoad<any>(`/admin-ops/marketing/overview?days=${days}${linkId ? '&linkId=' + linkId : ''}`, null);
  const links = useLoad<any[]>('/admin-ops/marketing/links', []);
  const TABS: [string, string][] = [['overview', 'Overview'], ['opens', 'Recent opens'], ['links', 'Links, QR & share kit'], ['leads', 'Leads'], ['broadcast', 'Broadcast'], ['settings', 'Ads & page settings']];
  return (
    <div>
      <h1 className="page-title">Marketing</h1>
      <p className="page-subtitle">Who opened your links and QR codes, on which device and where; whether a link was reopened on the same phone or shared; and who signed up.</p>
      <div className="mk-tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {(tab === 'overview' || tab === 'opens' || tab === 'leads') && (
        <div className="toolbar">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>{[1, 7, 30, 90, 365].map((d) => <option key={d} value={d}>Last {d === 1 ? '24 hours' : d + ' days'}</option>)}</select>
          <select value={linkId} onChange={(e) => setLinkId(e.target.value)}><option value="">All links</option><option value="none">(no label)</option>{links.data.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
          <button className="outline" onClick={() => { ov.reload(); links.reload(); }}>Refresh</button>
        </div>
      )}
      {ov.error && <div className="error-text">{ov.error}</div>}
      {tab === 'overview' && <Overview ov={ov.data} />}
      {tab === 'opens' && <Opens ov={ov.data} />}
      {tab === 'links' && <Links links={links} />}
      {tab === 'leads' && <Leads ov={ov.data} reload={ov.reload} />}
      {tab === 'broadcast' && <Broadcast links={links.data} />}
      {tab === 'settings' && <Settings />}
    </div>
  );
}

function Overview({ ov }: { ov: any }) {
  if (!ov) return <div className="empty-state">Loading…</div>;
  const t = ov.totals;
  const maxDay = Math.max(1, ...ov.series.map((s: any) => s.opens));
  const maxHour = Math.max(1, ...ov.hours.map((h: any) => h.n));
  return (
    <>
      <div className="stat-grid">
        <div className="stat-card mk-hero"><div className="stat-number">{t.opens}</div><div className="stat-label">Opens</div>
          <div className="mk-sub">Different devices: <b>{t.devices}</b><br />Repeat opens (same device): <b>{t.repeatOpens}</b></div></div>
        <div className="stat-card"><div className="stat-number">{t.leads}</div><div className="stat-label">Leads (talk-to-us form)</div></div>
        <div className="stat-card"><div className="stat-number">{t.signups}</div><div className="stat-label">Sign-ups from links</div>
          <div className="mk-sub">{t.signupsByRole.map((r: any) => `${r.name}: ${r.n}`).join(' · ') || '—'}</div></div>
        <div className="stat-card"><div className="stat-number">{t.conversionRate}%</div><div className="stat-label">Devices that signed up</div></div>
        <div className="stat-card"><div className="stat-number">{t.preciseOpens}</div><div className="stat-label">Opens with precise location</div>
          <div className="mk-sub">Within 10 m: <b>{t.within10m}</b> · others city-level only</div></div>
      </div>

      <div className="card">
        <h3>Same device or shared?</h3>
        <p className="page-subtitle">For each link: how many times it was opened, by how many different devices, and how many opens were the same device coming back.</p>
        <table><thead><tr><th>Link</th><th>Channel</th><th>Opens</th><th>Different devices</th><th>Same device again</th><th>Verdict</th><th>Leads</th><th>Sign-ups</th><th>Last open</th></tr></thead>
          <tbody>{ov.perLink.map((l: any) => (
            <tr key={l.id}><td><b>{l.label}</b>{l.campaign && <div className="mk-sub">{l.campaign}</div>}</td><td>{l.channel}</td><td>{l.opens}</td><td>{l.devices}</td><td>{l.repeatOpens}</td>
              <td><span className={`mk-pill ${l.shared ? 'shared' : l.opens ? 'same' : ''}`}>{l.verdict}</span></td><td>{l.leads}</td><td>{l.signups}{l.devices ? <span className="mk-sub"> ({l.conversionRate}%)</span> : null}</td><td>{fmt(l.lastOpen)}</td></tr>
          ))}</tbody></table>
        {t.fallbackIds > 0 && <p className="mk-sub">{t.fallbackIds} open(s) came from browsers that block storage; they were matched by a device signature (phone model, screen, timezone, language), which cannot tell identical phones apart.</p>}
      </div>

      <div className="card">
        <h3>Opens per day</h3>
        <div className="mk-chart">{ov.series.map((s: any) => <div key={s.day} title={`${s.day}: ${s.opens} opens, ${s.devices} devices`}><span style={{ height: `${(s.opens / maxDay) * 100}%` }} /><small>{s.day.slice(5)}</small></div>)}</div>
        <h3 style={{ marginTop: 16 }}>Best hours (UTC) to post or advertise</h3>
        <div className="mk-chart mk-hours">{ov.hours.map((h: any) => <div key={h.hour} title={`${h.hour}:00 UTC - ${h.n} opens`}><span style={{ height: `${(h.n / maxHour) * 100}%` }} /><small>{h.hour}</small></div>)}</div>
      </div>

      <div className="mk-grid">
        <Bars title="Countries" rows={ov.breakdown.countries} />
        <Bars title="Cities" rows={ov.breakdown.cities} />
        <Bars title="Opened inside app" rows={ov.breakdown.inApp} />
        <Bars title="Channels" rows={ov.breakdown.channels} />
        <Bars title="Device type" rows={ov.breakdown.deviceTypes} />
        <Bars title="Phone models" rows={ov.breakdown.models} />
        <Bars title="Operating system" rows={ov.breakdown.os} />
        <Bars title="Browser" rows={ov.breakdown.browsers} />
        <Bars title="Language" rows={ov.breakdown.languages} />
        <Bars title="Referring websites" rows={ov.breakdown.referrerSites} />
        <Bars title="UTM source" rows={ov.breakdown.utmSources} />
        <Bars title="Top referrers (users inviting users)" rows={ov.topReferrers.map((r: any) => ({ name: `${r.name} (${r.role || ''})`, n: r.referrals }))} />
      </div>
    </>
  );
}

function Opens({ ov }: { ov: any }) {
  if (!ov) return <div className="empty-state">Loading…</div>;
  return (
    <div className="card">
      <h3>Recent opens</h3>
      <p className="page-subtitle">Each device gets a number per link (#1, #2…) in the order it first appeared. "Same device · open #3" means that phone came back a third time. 📍 shows the exact position when the visitor allowed location, with the accuracy their phone reported (green when within 10 m); otherwise the location is city-level from the network.</p>
      <table><thead><tr><th>When</th><th>Link</th><th>Device</th><th>Open</th><th>Phone / browser</th><th>Opened in</th><th>Location</th><th>Language / timezone</th><th>Signed up</th></tr></thead>
        <tbody>{ov.recentOpens.map((o: any) => (
          <tr key={o.id}><td>{fmt(o.at)}</td><td>{o.link || '(no label)'}</td><td><b>#{o.deviceNo}</b>{o.idSource === 'signature' && <span className="mk-sub" title="Matched by signature, not ID"> ~</span>}</td>
            <td><span className={`mk-pill ${o.newDevice ? 'new' : 'same'}`}>{o.newDevice ? 'New device' : `Same device · open #${o.openNo}`}</span></td>
            <td>{[o.model, o.os, o.browser].filter(Boolean).join(' · ')}<div className="mk-sub">{o.deviceType}{o.screen ? ' · ' + o.screen : ''}</div></td>
            <td>{o.inApp || 'Browser'}</td><td>{[o.city, o.region, o.country].filter(Boolean).join(', ') || '—'}
              {o.lat != null ? <div><a href={`https://www.openstreetmap.org/?mlat=${o.lat}&mlon=${o.lng}#map=18/${o.lat}/${o.lng}`} target="_blank" rel="noreferrer">📍 {o.lat.toFixed(5)}, {o.lng.toFixed(5)}</a> <span className={`mk-pill ${o.accuracyM != null && o.accuracyM <= 10 ? 'new' : 'same'}`}>±{Math.round(o.accuracyM ?? 0)} m</span></div> : <div className="mk-sub">City only (location not shared)</div>}</td>
            <td>{o.language || '—'}<div className="mk-sub">{o.timezone}</div></td><td>{o.registered ? '✅' : ''}</td></tr>
        ))}</tbody></table>
      {ov.recentOpens.length === 0 && <div className="empty-state">No opens yet. Create a link and share it.</div>}
    </div>
  );
}

function QrPreview({ id }: { id: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let url = '';
    api.get(`/admin-ops/marketing/links/${id}/qr.svg`, { responseType: 'blob' }).then((r) => { url = URL.createObjectURL(r.data); setSrc(url); }).catch(() => null);
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [id]);
  return src ? <img src={src} alt="QR code" width={140} height={140} /> : <div style={{ width: 140, height: 140 }} />;
}
async function download(path: string, name: string) {
  const r = await api.get(path, { responseType: 'blob' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(r.data); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function Links({ links }: { links: { data: any[]; reload: () => void } }) {
  const [f, setF] = useState<any>({ label: '', channel: 'qr', campaign: '', audience: 'ALL', landing: 'pitch', country: '' });
  const [msg, setMsg] = useState('');
  const [lang, setLang] = useState('en');
  const create = async () => {
    try { await api.post('/admin-ops/marketing/links', f); setMsg('✅ Link created'); setF({ ...f, label: '' }); links.reload(); } catch (e) { setMsg(getErrorMessage(e)); }
  };
  const toggle = async (l: any) => { await api.patch(`/admin-ops/marketing/links/${l.id}`, { active: !l.active }); links.reload(); };
  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => setMsg('🔗 Copied')).catch(() => setMsg(t));
  return (
    <>
      <div className="card">
        <h3>New tracking link / QR code</h3>
        <p className="page-subtitle">Make one link per place you advertise (each flyer batch, influencer, WhatsApp group, radio ad…). Then you can compare which one brings sign-ups.</p>
        <div className="mk-form">
          <label className="field">Name<input value={f.label} placeholder="e.g. Ikeja flyers - December" onChange={(e) => setF({ ...f, label: e.target.value })} /></label>
          <label className="field">Channel<select value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field">Campaign (optional)<input value={f.campaign} placeholder="e.g. Launch 2026" onChange={(e) => setF({ ...f, campaign: e.target.value })} /></label>
          <label className="field">Audience<select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}><option value="ALL">Everyone</option><option value="PATIENT">Patients</option><option value="PROVIDER">Health providers</option><option value="INSTITUTION">Hospitals & clinics</option></select></label>
          <label className="field">Opens<select value={f.landing} onChange={(e) => setF({ ...f, landing: e.target.value })}><option value="pitch">Pitch page (recommended)</option><option value="signup">Straight to sign-up</option></select></label>
          <label className="field">Target country (optional)<input value={f.country} maxLength={2} placeholder="NG" onChange={(e) => setF({ ...f, country: e.target.value.toUpperCase() })} /></label>
        </div>
        <button onClick={create}>Create link</button> {msg && <span className="mk-sub">{msg}</span>}
      </div>
      <div className="toolbar">Share messages in: <select value={lang} onChange={(e) => setLang(e.target.value)}>{Object.entries(TEMPLATES).map(([k, v]) => <option key={k} value={k}>{v.lang}</option>)}</select></div>
      {links.data.map((l) => {
        const share = (ch: string) => `${l.url}?utm_source=${ch}&utm_medium=share`;
        const msgText = (ch: string) => (l.audience === 'PROVIDER' || l.audience === 'INSTITUTION' ? TEMPLATES[lang].provider : TEMPLATES[lang].patient).replace('{link}', share(ch));
        const enc = encodeURIComponent;
        return (
          <div className="card mk-link" key={l.id}>
            <QrPreview id={l.id} />
            <div style={{ flex: 1, minWidth: 260 }}>
              <h3>{l.label} {!l.active && <span className="badge badge-inactive">paused</span>}</h3>
              <div className="mk-sub">{l.channel} · {l.audience} · {l.landing === 'signup' ? 'straight to sign-up' : 'pitch page'}{l.campaign ? ' · ' + l.campaign : ''}</div>
              <div className="mk-url"><code>{l.url}</code> <button className="outline" onClick={() => copy(l.url)}>Copy</button></div>
              <div className="row-actions">
                <button className="outline" onClick={() => download(`/admin-ops/marketing/links/${l.id}/qr.png?size=1200`, `qr-${l.slug}.png`)}>QR PNG (print)</button>
                <button className="outline" onClick={() => download(`/admin-ops/marketing/links/${l.id}/qr.svg`, `qr-${l.slug}.svg`)}>QR SVG (designers)</button>
                <a className="mk-btn" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${enc(msgText('whatsapp'))}`}>WhatsApp</a>
                <a className="mk-btn" target="_blank" rel="noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${enc(share('facebook'))}`}>Facebook</a>
                <a className="mk-btn" target="_blank" rel="noreferrer" href={`https://twitter.com/intent/tweet?text=${enc(msgText('x'))}`}>X</a>
                <a className="mk-btn" target="_blank" rel="noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${enc(share('linkedin'))}`}>LinkedIn</a>
                <a className="mk-btn" target="_blank" rel="noreferrer" href={`https://t.me/share/url?url=${enc(share('telegram'))}&text=${enc(msgText('telegram'))}`}>Telegram</a>
                <a className="mk-btn" href={`mailto:?subject=${enc('N-Health')}&body=${enc(msgText('email'))}`}>Email</a>
                <a className="mk-btn" href={`sms:?&body=${enc(msgText('sms'))}`}>SMS</a>
                <button className="outline" onClick={() => copy(msgText('copy'))}>Copy message</button>
                <button className="outline" onClick={() => toggle(l)}>{l.active ? 'Pause' : 'Resume'}</button>
              </div>
            </div>
          </div>
        );
      })}
      {links.data.length === 0 && <div className="card empty-state">No links yet.</div>}
    </>
  );
}

function Leads({ ov, reload }: { ov: any; reload: () => void }) {
  if (!ov) return <div className="empty-state">Loading…</div>;
  const setStatus = async (id: string, status: string) => { await api.patch(`/admin-ops/marketing/leads/${id}`, { status }); reload(); };
  return (
    <div className="card">
      <div className="toolbar"><h3 style={{ margin: 0, flex: 1 }}>Leads from the pitch page</h3><button className="outline" onClick={() => download('/admin-ops/marketing/leads.csv', 'nhealth-leads.csv')}>Export CSV</button></div>
      <table><thead><tr><th>When</th><th>Name</th><th>Contact</th><th>Interest</th><th>From link</th><th>Location</th><th>Opens before form</th><th>Message</th><th>Status</th></tr></thead>
        <tbody>{ov.leads.map((l: any) => (
          <tr key={l.id}><td>{fmt(l.createdAt)}</td><td><b>{l.name}</b>{l.organization && <div className="mk-sub">{l.organization}</div>}</td>
            <td>{l.email}<div className="mk-sub">{l.phone}</div>{!l.consent && <div className="mk-sub">no marketing consent</div>}</td><td>{l.interest}</td><td>{l.link}</td>
            <td>{[l.city, l.country].filter(Boolean).join(', ') || '—'}</td><td>{l.opensBefore ? `opened ${l.opensBefore}×` : '—'}</td><td className="mk-sub">{l.message}</td>
            <td><select value={l.status} onChange={(e) => setStatus(l.id, e.target.value)}>{['NEW', 'CONTACTED', 'REGISTERED', 'LOST'].map((s) => <option key={s}>{s}</option>)}</select></td></tr>
        ))}</tbody></table>
      {ov.leads.length === 0 && <div className="empty-state">No leads yet.</div>}
    </div>
  );
}

function Broadcast({ links }: { links: any[] }) {
  const past = useLoad<any[]>('/admin-ops/marketing/broadcasts', []);
  const [f, setF] = useState<any>({ channel: 'email', subject: '', body: 'Hello {{name}},\n\n', linkId: '', users: true, leads: true, roles: [] as string[], countries: '', leadInterests: [] as string[] });
  const [msg, setMsg] = useState('');
  const payload = (dryRun: boolean) => ({ channel: f.channel, subject: f.subject, body: f.body, linkId: f.linkId || undefined, dryRun,
    audience: { users: f.users, leads: f.leads, roles: f.roles, leadInterests: f.leadInterests, countries: f.countries.split(',').map((c: string) => c.trim()).filter(Boolean) } });
  const tog = (k: string, v: string) => setF({ ...f, [k]: f[k].includes(v) ? f[k].filter((x: string) => x !== v) : [...f[k], v] });
  const count = async () => { try { const r = await api.post('/admin-ops/marketing/broadcasts', payload(true)); setMsg(`${r.data.recipients} people will receive it.`); } catch (e) { setMsg(getErrorMessage(e)); } };
  const send = async () => {
    try {
      const n = (await api.post('/admin-ops/marketing/broadcasts', payload(true))).data.recipients;
      if (!window.confirm(`Send this ${f.channel} to ${n} people?`)) return;
      await api.post('/admin-ops/marketing/broadcasts', payload(false)); setMsg(`📤 Sending to ${n} people…`); past.reload();
    } catch (e) { setMsg(getErrorMessage(e)); }
  };
  return (
    <>
      <div className="card">
        <h3>Send a campaign</h3>
        <p className="page-subtitle">Goes only to users who ticked "marketing messages" and to leads who gave consent. Every email has an unsubscribe link; SMS includes "Reply STOP". Use {'{{name}}'} and {'{{link}}'} (the tracking link you pick, so you see who opened it).</p>
        <div className="mk-form">
          <label className="field">Channel<select value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}><option value="email">Email (Resend)</option><option value="sms">SMS (Termii)</option></select></label>
          {f.channel === 'email' && <label className="field">Subject<input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></label>}
          <label className="field">Tracking link for {'{{link}}'}<select value={f.linkId} onChange={(e) => setF({ ...f, linkId: e.target.value })}><option value="">Home page (untracked)</option>{links.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
          <label className="field">Countries (codes, comma-separated, empty = all)<input value={f.countries} placeholder="NG, GH, KE" onChange={(e) => setF({ ...f, countries: e.target.value })} /></label>
        </div>
        <label className="field">Message<textarea rows={6} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></label>
        <div className="mk-checks">
          <label><input type="checkbox" checked={f.users} onChange={(e) => setF({ ...f, users: e.target.checked })} /> Registered users (opted in)</label>
          {f.users && <span>Roles: {ROLES.map((r) => <label key={r}><input type="checkbox" checked={f.roles.includes(r)} onChange={() => tog('roles', r)} /> {r}</label>)} <span className="mk-sub">(none = all)</span></span>}
        </div>
        <div className="mk-checks">
          <label><input type="checkbox" checked={f.leads} onChange={(e) => setF({ ...f, leads: e.target.checked })} /> Leads who consented (not yet registered)</label>
          {f.leads && <span>Interest: {INTERESTS.map((r) => <label key={r}><input type="checkbox" checked={f.leadInterests.includes(r)} onChange={() => tog('leadInterests', r)} /> {r}</label>)}</span>}
        </div>
        <button className="outline" onClick={count}>Count recipients</button> <button onClick={send}>Send</button> {msg && <span className="mk-sub">{msg}</span>}
      </div>
      <div className="card">
        <h3>Past campaigns</h3>
        <table><thead><tr><th>When</th><th>Channel</th><th>Subject / message</th><th>Recipients</th><th>Sent</th><th>Failed</th><th>Status</th></tr></thead>
          <tbody>{past.data.map((b) => <tr key={b.id}><td>{fmt(b.createdAt)}</td><td>{b.channel}</td><td>{b.subject || b.body.slice(0, 60)}</td><td>{b.total}</td><td>{b.sent}</td><td>{b.failed}</td><td>{b.status}</td></tr>)}</tbody></table>
      </div>
    </>
  );
}

function Settings() {
  const s = useLoad<any>('/admin-ops/marketing/settings', null);
  const [msg, setMsg] = useState('');
  if (!s.data) return <div className="empty-state">{s.error || 'Loading…'}</div>;
  const set = (k: string, v: string) => s.setData({ ...s.data, [k]: v });
  const save = async () => { try { s.setData((await api.put('/admin-ops/marketing/settings', s.data)).data); setMsg('✅ Saved'); } catch (e) { setMsg(getErrorMessage(e)); } };
  return (
    <div className="card">
      <h3>Pitch page</h3>
      <label className="field">Headline<input value={s.data.headline} onChange={(e) => set('headline', e.target.value)} /></label>
      <label className="field">Sub-headline<textarea rows={3} value={s.data.subheadline} onChange={(e) => set('subheadline', e.target.value)} /></label>
      <label className="field">WhatsApp number for "WhatsApp us" (international format)<input value={s.data.whatsappNumber} placeholder="+2348012345678" onChange={(e) => set('whatsappNumber', e.target.value)} /></label>
      <h3>Ad pixels (retargeting & ad conversion tracking)</h3>
      <p className="page-subtitle">Visitors are asked for consent first; pixels load only if they accept. Sign-ups and form leads are reported to the ad platforms as conversions.</p>
      <div className="mk-form">
        <label className="field">Meta (Facebook/Instagram) Pixel ID<input value={s.data.metaPixelId} placeholder="123456789012345" onChange={(e) => set('metaPixelId', e.target.value)} /></label>
        <label className="field">Google tag ID (GA4 / Ads)<input value={s.data.googleTagId} placeholder="G-XXXXXXX or AW-XXXXXXX" onChange={(e) => set('googleTagId', e.target.value)} /></label>
        <label className="field">TikTok Pixel ID<input value={s.data.tiktokPixelId} onChange={(e) => set('tiktokPixelId', e.target.value)} /></label>
      </div>
      <button onClick={save}>Save</button> {msg && <span className="mk-sub">{msg}</span>}
    </div>
  );
}
