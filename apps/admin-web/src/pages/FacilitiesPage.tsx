import React, { useCallback, useEffect, useState } from 'react';
import { api, getErrorMessage } from '../api/client';

// Nigerian facility directory: what is listed before facilities join, coverage by state, and fixing / adding listings.
const CATS: [string, string][] = [
  ['TEACHING_HOSPITAL', 'Teaching hospital'], ['FEDERAL_MEDICAL_CENTRE', 'Federal Medical Centre'], ['GENERAL_HOSPITAL', 'General hospital'],
  ['SPECIALIST_HOSPITAL', 'Specialist hospital'], ['HOSPITAL', 'Hospital'], ['CLINIC', 'Clinic'], ['PRIMARY_HEALTH_CENTRE', 'Primary health centre'],
  ['HEALTH_POST', 'Health post'], ['MATERNITY', 'Maternity'], ['DIAGNOSTIC', 'Diagnostic center'], ['BLOOD_BANK', 'Blood bank'], ['PHARMACY', 'Pharmacy'],
  ['DENTAL', 'Dental'], ['EYE', 'Eye care'], ['NURSING_HOME', 'Nursing home'], ['HMO', 'Health insurance (HMO)'], ['OTHER', 'Other facility'],
];
const STATES = ['Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'];
const label = (k: string) => CATS.find((c) => c[0] === k)?.[1] || k;
const EMPTY = { name: '', category: 'HOSPITAL', state: '', lga: '', address: '', phone: '', email: '', website: '', ownership: '', lat: '', lng: '' };

export function FacilitiesPage() {
  const [cov, setCov] = useState<any>(null);
  const [q, setQ] = useState(''); const [state, setState] = useState(''); const [cat, setCat] = useState(''); const [hidden, setHidden] = useState(false);
  const [page, setPage] = useState(1);
  const [list, setList] = useState<any>({ rows: [], count: 0 });
  const [edit, setEdit] = useState<any>(null);
  const [error, setError] = useState(''); const [msg, setMsg] = useState('');
  const loadCov = useCallback(() => { api.get('/admin-ops/facilities/coverage').then((r) => setCov(r.data)).catch((e) => setError(getErrorMessage(e))); }, []);
  const load = useCallback(() => {
    api.get('/admin-ops/facilities', { params: { q: q || undefined, state: state || undefined, category: cat || undefined, hidden: hidden ? '1' : undefined, page } })
      .then((r) => setList(r.data)).catch((e) => setError(getErrorMessage(e)));
  }, [q, state, cat, hidden, page]);
  useEffect(loadCov, [loadCov]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const save = async (force = false) => {
    setError(''); setMsg('');
    const body: any = { ...edit, lat: edit.lat === '' ? null : Number(edit.lat), lng: edit.lng === '' ? null : Number(edit.lng), force };
    try {
      if (edit.id) await api.patch('/admin-ops/facilities/' + edit.id, body); else await api.post('/admin-ops/facilities', body);
      setMsg(edit.id ? 'Listing updated' : 'Facility added'); setEdit(null); load(); loadCov();
    } catch (e: any) {
      const m = getErrorMessage(e);
      if (e?.response?.status === 409 && !edit.id && window.confirm(m + '\n\nAdd it anyway?')) return save(true);
      setError(m);
    }
  };
  const toggleHidden = async (r: any) => { await api.patch('/admin-ops/facilities/' + r.id, { hidden: !r.hidden }); load(); loadCov(); };

  return (
    <div>
      <h1 className="page-title">Facility directory</h1>
      <p className="page-subtitle">Nigerian hospitals, clinics, diagnostic centers, blood banks, pharmacies and HMOs listed before they join. A facility claims its listing when it signs up; patients can already find, call and get directions to the rest.</p>
      {error && <div className="error-text">{error}</div>}
      {msg && <div className="success-text">{msg}</div>}

      {cov && (
        <>
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-number">{cov.total.toLocaleString()}</div><div className="stat-label">Facilities listed</div></div>
            <div className="stat-card"><div className="stat-number">{cov.claimed.toLocaleString()}</div><div className="stat-label">Claimed by a provider on N-Health</div></div>
            <div className="stat-card"><div className="stat-number">{cov.withoutCoordinates.toLocaleString()}</div><div className="stat-label">Without map location</div></div>
            <div className="stat-card"><div className="stat-number">{cov.hidden}</div><div className="stat-label">Hidden by admins</div></div>
          </div>
          <div className="card">
            <h3>By type</h3>
            <div className="fac-cats">{cov.categories.map((c: any) => <button key={c.key} className={`fac-cat ${cat === c.key ? 'active' : ''}`} onClick={() => { setCat(cat === c.key ? '' : c.key); setPage(1); }}><b>{c.count.toLocaleString()}</b><span>{c.label}</span></button>)}</div>
            <p className="page-subtitle" style={{ marginTop: 10 }}>Sources: {cov.sources.map((s: any) => `${s.label}: ${s.count.toLocaleString()}`).join(' • ')}{cov.lastImport ? ` • last loaded ${new Date(cov.lastImport.importedAt).toLocaleString()}` : ''}</p>
          </div>
          <div className="card">
            <h3>By state</h3>
            <table>
              <thead><tr><th>State</th><th>All</th><th>Hospitals</th><th>Teaching</th><th>Clinics &amp; PHCs</th><th>Diagnostic</th><th>Blood banks</th><th>Pharmacies</th><th>HMOs</th></tr></thead>
              <tbody>{cov.states.map((s: any) => (
                <tr key={s.state} onClick={() => { setState(s.state === 'Unknown' ? '' : s.state); setPage(1); }} style={{ cursor: 'pointer' }}>
                  <td><b>{s.state}</b></td><td>{s.total.toLocaleString()}</td><td>{s.hospitals}</td><td>{s.teaching}</td><td>{s.clinics.toLocaleString()}</td>
                  <td className={s.diagnostic ? '' : 'fac-gap'}>{s.diagnostic}</td><td className={s.bloodBanks ? '' : 'fac-gap'}>{s.bloodBanks}</td><td className={s.pharmacies ? '' : 'fac-gap'}>{s.pharmacies}</td><td>{s.hmo}</td>
                </tr>))}</tbody>
            </table>
            <p className="page-subtitle">Red cells: none listed yet in that state. Add the ones you know with "Add facility".</p>
          </div>
        </>
      )}

      <div className="card">
        <div className="toolbar">
          <input placeholder="Search by name" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <select value={state} onChange={(e) => { setState(e.target.value); setPage(1); }}><option value="">All states</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select>
          <select value={cat} onChange={(e) => { setCat(e.target.value); setPage(1); }}><option value="">All types</option>{CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={hidden} onChange={(e) => { setHidden(e.target.checked); setPage(1); }} /> Hidden</label>
          <button onClick={() => setEdit({ ...EMPTY, state })}>+ Add facility</button>
        </div>
        <p className="page-subtitle">{list.count.toLocaleString()} found{list.count > 50 ? ` • page ${page} of ${Math.ceil(list.count / 50)}` : ''}</p>
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Where</th><th>Contact</th><th>Source</th><th>On N-Health</th><th></th></tr></thead>
          <tbody>{list.rows.map((r: any) => (
            <tr key={r.id}>
              <td><b>{r.name}</b>{r.nhfrCode && <div className="page-subtitle">NHFR {r.nhfrCode}</div>}</td>
              <td>{r.categoryLabel}{r.ownership ? <div className="page-subtitle">{r.ownership}</div> : null}</td>
              <td>{[r.lga, r.state].filter(Boolean).join(', ')}{r.lat == null && <div className="page-subtitle">no map location</div>}</td>
              <td>{[r.phone, r.email].filter(Boolean).join(' • ') || '—'}</td>
              <td className="page-subtitle">{r.sourceKey}</td>
              <td>{r.onNhealth ? <span className="badge badge-active">Claimed</span> : '—'}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="outline" onClick={() => setEdit({ ...EMPTY, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? ''])), category: r.category })}>Edit</button>{' '}
                <button className="outline" onClick={() => toggleHidden(r)}>{r.hidden ? 'Show' : 'Hide'}</button>
              </td>
            </tr>))}</tbody>
        </table>
        {list.count > 50 && <div className="toolbar"><button className="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Previous</button><button className="outline" disabled={page * 50 >= list.count} onClick={() => setPage(page + 1)}>Next →</button></div>}
      </div>

      {edit && (
        <div className="modal-backdrop" onClick={() => setEdit(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{edit.id ? 'Edit listing' : 'Add a facility'}</h3>
            {!edit.id && <p className="page-subtitle">Search first to avoid duplicates. Added facilities can be claimed at sign-up like the others.</p>}
            <div className="form-grid">
              <label>Name<input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
              <label>Type<select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>{CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label>State<select value={edit.state} onChange={(e) => setEdit({ ...edit, state: e.target.value })}><option value="">—</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select></label>
              <label>LGA<input value={edit.lga} onChange={(e) => setEdit({ ...edit, lga: e.target.value })} /></label>
              <label>Address<input value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></label>
              <label>Ownership<select value={edit.ownership} onChange={(e) => setEdit({ ...edit, ownership: e.target.value })}><option value="">—</option><option>Public</option><option>Private</option></select></label>
              <label>Phone<input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></label>
              <label>Email<input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></label>
              <label>Website<input value={edit.website} onChange={(e) => setEdit({ ...edit, website: e.target.value })} /></label>
              <label>Latitude<input value={edit.lat} onChange={(e) => setEdit({ ...edit, lat: e.target.value })} placeholder="6.5158" /></label>
              <label>Longitude<input value={edit.lng} onChange={(e) => setEdit({ ...edit, lng: e.target.value })} placeholder="3.3898" /></label>
            </div>
            {edit.id && <p className="page-subtitle">Your changes are kept: later data updates will not overwrite this listing.</p>}
            <div className="toolbar"><button onClick={() => save()}>{edit.id ? 'Save' : 'Add facility'}</button><button className="outline" onClick={() => setEdit(null)}>Cancel</button>
              {edit.id && edit.onNhealth && <button className="outline" onClick={async () => { await api.patch('/admin-ops/facilities/' + edit.id, { unclaim: true }); setEdit(null); load(); loadCov(); }}>Remove claim</button>}</div>
          </div>
        </div>
      )}
    </div>
  );
}
