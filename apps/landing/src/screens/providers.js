import { get, post, patch, del, download } from '../lib/api.js';
import { state } from '../lib/store.js';
import { field as fld, readForm, esc, $, $$, appBar, brandTitle, card, cardHead, item, avatar, badge, empty, skeleton, tabs, toast, toastErr, modal, formModal, confirmBox, busy, money, dt, relDay, dateOnly, timeOnly, ago, locate, fileToDataUri, pickFile } from '../lib/ui.js';
import { on, emit } from '../lib/realtime.js';
import { go } from '../lib/router.js';
import { createMap } from '../lib/map.js';
import { t } from '../lib/i18n.js';

const verifyBanner = () => (state.user.verificationStatus !== 'VERIFIED'
  ? `<div class="banner warn">⚕️ ${state.user.verificationStatus === 'PENDING' ? 'Your account is under review. You can set up your profile meanwhile.' : 'Verify your identity and upload your licence to start serving patients.'}<button class="btn btn-sm btn-primary" data-go="/kyc">${state.user.kycStatus === 'APPROVED' ? 'Documents' : 'Verify'}</button></div>` : '');
const stat = (n, l) => `<div class="provider-stat"><div class="number">${n}</div><div class="label">${l}</div></div>`;
const welcome = (sub) => `<div class="welcome-text">${t('Hello')}, 👋 ${esc(state.user.name.split(' ')[0])}</div><div class="welcome-sub">${sub}</div>`;

// =====================================================================
// DOCTOR
// =====================================================================
export async function doctorHome(el) {
  el.innerHTML = appBar({ title: brandTitle(), roleCls: 'doctor-title' }) + welcome('Your practice at a glance') + verifyBanner() + `<div class="provider-stats" id="st">${stat('…', 'Patients')}${stat('…', 'Requests')}${stat('…', 'Rating')}${stat('…', 'Earnings')}</div><div id="today">${skeleton(2)}</div>
    <div class="quick-actions">
      <div class="quick-action doctor-action" data-go="/doctor/requests" tabindex="0"><span class="icon">📋</span><span class="label">Requests</span></div>
      <div class="quick-action doctor-action" data-go="/doctor/patients" tabindex="0"><span class="icon">👥</span><span class="label">Patients</span></div>
      <div class="quick-action doctor-action" data-go="/doctor/schedule" tabindex="0"><span class="icon">🗓️</span><span class="label">My calendar</span></div>
      <div class="quick-action doctor-action" data-go="/doctor/lab-results" tabindex="0"><span class="icon">🔬</span><span class="label">Lab results</span></div>
      <div class="quick-action doctor-action" data-go="/referrals" tabindex="0"><span class="icon">↗️</span><span class="label">Referrals</span></div>
      <div class="quick-action doctor-action" data-go="/messages" tabindex="0"><span class="icon">💬</span><span class="label">Messages</span></div>
      <div class="quick-action doctor-action" data-go="/provider/earnings" tabindex="0"><span class="icon">💰</span><span class="label">Earnings</span></div>
      <div class="quick-action emergency" data-go="/doctor/emergencies" tabindex="0"><span class="icon">🚨</span><span class="label">Emergencies</span></div>
    </div>`;
  const [s, appts] = await Promise.all([get('/doctor-ops/stats').catch(() => ({})), get('/doctor/appointments').catch(() => [])]);
  $('#st', el).innerHTML = stat(s.patients ?? 0, 'Patients') + stat(s.requests ?? 0, 'Requests') + stat(s.rating ? s.rating.toFixed(1) : '—', 'Rating') + stat(money(s.monthEarnings || 0).replace(/\.00$/, ''), 'This month');
  const key = (d) => new Date(d).toDateString();
  const today = appts.filter((a) => key(a.scheduledAt) === new Date().toDateString() && ['CONFIRMED', 'IN_PROGRESS'].includes(a.status)).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  $('#today', el).innerHTML = card(cardHead('📅 Today\'s schedule', '<a class="link" data-go="/doctor/requests">All</a>') + (today.length ? today.map((a) => item({ avatarHtml: avatar('PATIENT', a.patient.user.avatarUrl), title: esc(a.patient.user.name), sub: timeOnly(a.scheduledAt) + ' • ' + esc(a.reason || 'Consultation'), trailing: badge(a.status), attrs: `data-go="/doctor/patient/${a.patientId}"` })).join('') : empty('☕', 'No confirmed appointments today')));
}

export async function doctorRequests(el, _p, q) {
  let tab = q.tab || 'pending';
  el.innerHTML = appBar({ title: '📋 Appointments', back: '/doctor/home', roleCls: 'doctor-title' }) + tabs([['pending', 'Requests'], ['upcoming', 'Confirmed'], ['past', 'Past']], tab) + '<div id="tb"></div>';
  const draw = async () => {
    const tb = $('#tb', el); tb.innerHTML = skeleton(3);
    const all = await get('/doctor/appointments');
    const list = all.filter((a) => (tab === 'pending' ? a.status === 'PENDING' : tab === 'upcoming' ? ['CONFIRMED', 'IN_PROGRESS'].includes(a.status) : ['COMPLETED', 'CANCELLED'].includes(a.status)))
      .sort((a, b) => (tab === 'past' ? -1 : 1) * (new Date(a.scheduledAt) - new Date(b.scheduledAt)));
    tb.innerHTML = list.length ? list.map((a) => `<div class="service-request"><div class="header"><span class="patient-name">${esc(a.patient.user.name)}</span>${badge(a.status)}</div>
      <div class="service-type">📅 ${relDay(a.scheduledAt)} • ${esc(a.type === 'VIDEO' ? 'Remote' : 'In person')} • ${esc(a.paymentStatus.replace('_', ' ').toLowerCase())}</div>${a.reason ? `<div class="muted small">${esc(a.reason)}</div>` : ''}
      <div class="actions">${a.status === 'PENDING' ? `<button class="accept" data-act="CONFIRM" data-id="${a.id}">✓ Accept</button><button class="refer" data-refer="${a.id}">↗ Refer</button><button class="decline" data-act="CANCEL" data-id="${a.id}">✕ Decline</button>` : ''}
      ${['CONFIRMED', 'IN_PROGRESS'].includes(a.status) ? `<button class="accept" data-act="COMPLETE" data-id="${a.id}">✓ Complete</button><button class="refer" data-go="/doctor/patient/${a.patientId}">📋 Record</button>` : ''}
      <button class="refer" data-go="/chat/${a.patient.user.id}">💬</button></div></div>`).join('') : empty('📋', tab === 'pending' ? 'No pending requests' : 'Nothing here');
  };
  $$('[data-tab]', el).forEach((x) => (x.onclick = () => { tab = x.dataset.tab; $$('[data-tab]', el).forEach((y) => y.classList.toggle('active', y === x)); draw(); }));
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act],[data-refer]'); if (!b) return;
    if (b.dataset.act) {
      const action = b.dataset.act;
      const opts = action === 'COMPLETE' ? [{ name: 'notes', label: 'Consultation summary / diagnosis (shared with patient)', type: 'textarea', rows: 4 }] : action === 'CANCEL' ? [{ name: 'notes', label: 'Reason for declining (shared with patient)', type: 'textarea' }] : [{ name: 'notes', label: 'Note to patient (optional)', placeholder: 'e.g. Please bring previous results' }];
      formModal(action === 'CONFIRM' ? '✓ Accept appointment' : action === 'CANCEL' ? '✕ Decline appointment' : '✓ Complete consultation', opts, { submit: action === 'CONFIRM' ? 'Accept' : action === 'CANCEL' ? 'Decline & refund' : 'Mark completed', onSubmit: async (v) => { await post('/doctor/appointments/' + b.dataset.id + '/respond', { action, notes: v.notes || undefined }); toast('✅ Updated'); draw(); } });
    }
    if (b.dataset.refer) {
      const docs = await get('/directory?type=DOCTOR');
      formModal('↗ Refer patient', [{ name: 'to', label: 'Refer to', type: 'select', options: docs.filter((d) => d.userId !== state.user.id).map((d) => [d.userId, 'Dr. ' + d.name + ' • ' + d.title]) }, { name: 'notes', label: 'Reason', type: 'textarea', required: true }], { submit: 'Refer', onSubmit: async (v) => { await post('/doctor/appointments/' + b.dataset.refer + '/respond', { action: 'CANCEL', notes: 'Referred: ' + v.notes, referToUserId: v.to }); toast('↗ Referred'); draw(); } });
    }
  });
  draw();
  return on('appointment:new', draw);
}

export async function doctorPatients(el) {
  el.innerHTML = appBar({ title: '👥 My Patients', back: '/doctor/home', roleCls: 'doctor-title' }) + `<div class="form-group"><input id="q" placeholder="🔍 Search patients"></div><div id="pl">${skeleton(4)}</div>`;
  const list = await get('/doctor/patients');
  const draw = (qv = '') => { const f = list.filter((p) => !qv || p.user.name.toLowerCase().includes(qv.toLowerCase())); $('#pl', el).innerHTML = f.length ? card(f.map((p) => item({ avatarHtml: avatar('PATIENT', p.user.avatarUrl), title: esc(p.user.name), sub: [p.bloodType, p.genotype, p.allergies ? '⚠️ ' + p.allergies : ''].filter(Boolean).map(esc).join(' • ') || 'View record', attrs: `data-go="/doctor/patient/${p.id}"` })).join('')) : empty('👥', 'Patients appear here after they book you'); };
  $('#q', el).oninput = (e) => draw(e.target.value);
  draw();
}

export async function doctorPatientDetail(el, { id }) {
  const d = await get('/doctor/patients/' + id);
  const p = d.patient;
  el.innerHTML = appBar({ title: esc(p.user.name), back: '/doctor/patients', roleCls: 'doctor-title' }) +
    card(`<div class="row">${avatar('PATIENT', p.user.avatarUrl)}<div class="grow"><b>${esc(p.user.name)}</b><div class="muted">${p.dateOfBirth ? Math.floor((Date.now() - new Date(p.dateOfBirth)) / 3.156e10) + ' yrs • ' : ''}${esc(p.gender || '')}</div></div><button class="btn btn-outline btn-sm" data-go="/chat/${p.user.id}">💬</button></div>
      <div class="kv"><span class="k">Blood / Genotype</span><span class="v">${esc(p.bloodType || '—')} / ${esc(p.genotype || '—')}</span></div>
      <div class="kv"><span class="k">Allergies</span><span class="v" style="color:${p.allergies ? 'var(--error)' : 'inherit'}">${esc(p.allergies || 'None recorded')}</span></div>
      <div class="kv"><span class="k">Conditions</span><span class="v">${esc(p.chronicConditions || '—')}</span></div><div class="kv"><span class="k">Medications</span><span class="v">${esc(p.currentMedications || '—')}</span></div>
      <div class="kv"><span class="k">Height / Weight</span><span class="v">${p.height || '—'} cm / ${p.weight || '—'} kg</span></div><div class="kv"><span class="k">Emergency contact</span><span class="v">${esc([p.emergencyContact, p.emergencyPhone].filter(Boolean).join(' • ') || '—')}</span></div>
      <div class="row mt12"><button class="btn btn-doctor btn-sm grow" id="rx">💊 Prescribe</button><button class="btn btn-lab btn-sm grow" id="lab">🔬 Order test</button></div>
      <p class="muted small mt8">🔒 This access is logged and visible to the patient.</p>`) +
    card(cardHead('📅 Visits') + (d.appointments.length ? d.appointments.map((a) => item({ icon: '📅', title: dt(a.scheduledAt), sub: esc(a.notes || a.reason || ''), trailing: badge(a.status) })).join('') : empty('📅', 'No visits'))) +
    card(cardHead('💊 Prescriptions') + (d.prescriptions.length ? d.prescriptions.map((r) => item({ icon: '💊', title: esc((r.medications || []).map((m) => m.name).join(', ')), sub: dateOnly(r.issuedAt), trailing: `<button class="link" data-pdf="${r.id}">PDF</button>` })).join('') : empty('💊', 'None')));
  $('#rx', el).onclick = async () => {
    const pharms = await get('/directory?type=PHARMACY').catch(() => []);
    formModal('💊 New prescription', [
      ...[1, 2, 3].flatMap((n) => [{ name: 'name' + n, label: `Medication ${n}${n > 1 ? ' (optional)' : ''}`, required: n === 1 }, { name: 'dosage' + n, label: 'Dosage', placeholder: '500mg' }, { name: 'freq' + n, label: 'Frequency', placeholder: 'Twice daily' }, { name: 'days' + n, label: 'Days', type: 'number', value: n === 1 ? 5 : '' }]),
      { name: 'notes', label: 'Instructions', type: 'textarea' },
      { name: 'pharmacyId', label: 'Send to pharmacy (optional)', type: 'select', options: [['', 'Patient chooses'], ...pharms.map((x) => [x.profileId, x.name])] },
    ], { submit: 'Issue prescription', onSubmit: async (v) => {
      const medications = [1, 2, 3].filter((n) => v['name' + n]).map((n) => ({ name: v['name' + n], dosage: v['dosage' + n] || 'As directed', frequency: v['freq' + n] || 'As directed', durationDays: Number(v['days' + n]) || 1 }));
      await post('/doctor/prescriptions', { patientId: p.id, medications, notes: v.notes || undefined, pharmacyId: v.pharmacyId || undefined }); toast('✅ Prescription sent'); doctorPatientDetail(el, { id });
    } });
  };
  $('#lab', el).onclick = async () => {
    const cat = await get('/labs/catalog');
    formModal('🔬 Order a lab test', [{ name: 'c', label: 'Test & lab', type: 'select', options: cat.map((c) => [c.id + '|' + c.lab.id, `${c.name} • ${c.lab.labName} • ${money(c.price)}`]), required: true }, { name: 'notes', label: 'Clinical notes for the lab', type: 'textarea' }], { submit: 'Order', onSubmit: async (v) => { const [catalogId, labId] = v.c.split('|'); await post('/doctor-ops/lab-requests', { patientId: p.id, labId, catalogId, notes: v.notes || undefined }); toast('✅ Test ordered - the result will come back to you'); } });
  };
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-pdf]'); if (b) download('/doctor/prescriptions/' + b.dataset.pdf + '/pdf', 'prescription.pdf').catch(toastErr); });
}

export async function doctorLabResults(el) {
  el.innerHTML = appBar({ title: '🔬 Lab results', back: '/doctor/home', roleCls: 'doctor-title' }) + `<div id="l">${skeleton(3)}</div>`;
  const list = await get('/doctor-ops/lab-requests');
  $('#l', el).innerHTML = list.length ? list.map((x) => card(`${item({ avatarHtml: '<div class="avatar lab-avatar">🔬</div>', title: esc(x.testType) + ' • ' + esc(x.patient.user.name), sub: esc(x.lab.labName) + ' • ' + dt(x.createdAt), trailing: badge(x.status) })}${x.result ? (x.result.resultData?.results || []).map((r) => `<div class="kv"><span class="k">${esc(r.parameter)}</span><span class="v">${esc(r.value)} ${esc(r.unit || '')} ${r.flag && r.flag !== 'NORMAL' ? badge('FAILED', r.flag) : ''}</span></div>`).join('') + `<button class="btn btn-outline btn-sm btn-block mt8" data-pdf="${x.id}">⬇️ PDF</button>` : ''}`)).join('') : empty('🔬', 'Tests you order appear here with their results');
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-pdf]'); if (b) download('/lab-results/' + b.dataset.pdf + '/pdf', 'lab-result.pdf').catch(toastErr); });
}

export async function doctorEmergencies(el) {
  el.innerHTML = appBar({ title: '🚨 Emergency alerts', back: '/doctor/home', danger: true, actions: null }) + '<div class="banner info">Live emergency alerts near you appear here. Coordinate with the responding ambulance via the patient chat.</div><div id="l"></div>';
  const list = [];
  const draw = () => { $('#l', el).innerHTML = list.length ? list.map((x) => card(item({ icon: '🚨', title: 'Emergency ' + ago(x.at), sub: esc(x.notes || 'No details'), trailing: `<a class="link" target="_blank" rel="noopener" href="https://maps.google.com/?q=${x.lat},${x.lng}">Map</a>` }))).join('') : empty('✅', 'No active alerts right now'); };
  draw();
  return on('emergency:alert', (d) => { list.unshift({ ...d, at: new Date() }); draw(); });
}

export async function referralsScreen(el) {
  const r = await get('/referrals');
  el.innerHTML = appBar({ title: '↗️ Referrals', back: true }) + card(cardHead('📥 Received') + (r.received.length ? r.received.map((x) => `${item({ icon: '📥', title: esc(x.patient?.name || 'Patient') + ' from ' + esc(x.from.name), sub: esc(x.reason) + ' • ' + ago(x.createdAt), trailing: badge(x.status) })}${x.status === 'PENDING' ? `<div class="row mb8"><button class="btn btn-success btn-sm grow" data-rr="${x.id}" data-s="ACCEPTED">Accept</button><button class="btn btn-outline btn-sm grow" data-rr="${x.id}" data-s="DECLINED">Decline</button><button class="btn btn-outline btn-sm" data-go="/chat/${x.patientUserId}">💬</button></div>` : ''}`).join('') : empty('📥', 'None'))) +
    card(cardHead('📤 Sent') + (r.sent.length ? r.sent.map((x) => item({ icon: '📤', title: esc(x.patient?.name || 'Patient') + ' → ' + esc(x.to.name), sub: esc(x.reason), trailing: badge(x.status) })).join('') : empty('📤', 'None')));
  el.onclick = async (e) => { const b = e.target.closest('[data-rr]'); if (b) { await post('/referrals/' + b.dataset.rr + '/respond', { status: b.dataset.s }).catch(toastErr); referralsScreen(el); } };
}

// =====================================================================
// PHARMACY
// =====================================================================
export async function pharmacyHome(el) {
  el.innerHTML = appBar({ title: brandTitle(), roleCls: 'pharmacy-title' }) + welcome('Pharmacy dashboard') + verifyBanner() + `<div class="provider-stats" id="st"></div><div id="al">${skeleton(2)}</div>
    <div class="quick-actions">
      <div class="quick-action pharmacy-action" data-go="/pharmacy/pos" tabindex="0"><span class="icon">🧾</span><span class="label">POS</span></div>
      <div class="quick-action pharmacy-action" data-go="/pharmacy/inventory" tabindex="0"><span class="icon">📦</span><span class="label">Inventory</span></div>
      <div class="quick-action pharmacy-action" data-go="/pharmacy/intake" tabindex="0"><span class="icon">📥</span><span class="label">Stock intake</span></div>
      <div class="quick-action pharmacy-action" data-go="/pharmacy/audit" tabindex="0"><span class="icon">📝</span><span class="label">Audit</span></div>
      <div class="quick-action pharmacy-action" data-go="/pharmacy/orders" tabindex="0"><span class="icon">🛒</span><span class="label">Orders</span></div>
      <div class="quick-action pharmacy-action" data-go="/pharmacy/orders?tab=rx" tabindex="0"><span class="icon">📄</span><span class="label">Prescriptions</span></div>
      <div class="quick-action pharmacy-action" data-go="/pharmacy/customers" tabindex="0"><span class="icon">👥</span><span class="label">Customers</span></div>
      <div class="quick-action pharmacy-action" data-go="/provider/earnings" tabindex="0"><span class="icon">💰</span><span class="label">Earnings</span></div>
    </div>`;
  const [s, a, sales, cust] = await Promise.all([get('/pharmacy/stats'), get('/pharmacy-ops/alerts'), get('/pharmacy-ops/pos/sales'), get('/pharmacy-ops/customers').catch(() => [])]);
  const today = sales.sales.filter((x) => new Date(x.createdAt).toDateString() === new Date().toDateString()).reduce((t2, x) => t2 + Number(x.total), 0);
  $('#st', el).innerHTML = stat(s.totalItems, 'Products') + stat(cust.length, 'Customers') + stat(s.pendingOrders, 'New orders') + stat(money(today + (s.todayRevenue || 0)).replace(/\.00$/, ''), 'Today');
  $('#al', el).innerHTML = (a.expired.length || a.lowStock.length || a.expiring.length) ? card(cardHead('⚠️ Stock alerts', '<a class="link" data-go="/pharmacy/inventory">Manage</a>') +
    a.expired.slice(0, 3).map((i) => item({ icon: '⛔', title: esc(i.name), sub: 'Expired ' + dateOnly(i.expiryDate), trailing: '<span class="badge badge-outofstock">Expired</span>' })).join('') +
    a.lowStock.slice(0, 3).map((i) => item({ icon: '📦', title: esc(i.name), sub: i.stock + ' left (reorder at ' + i.reorderLevel + ')', trailing: '<span class="badge badge-lowstock">Low Stock</span>' })).join('') +
    a.expiring.slice(0, 3).map((i) => item({ icon: '⏳', title: esc(i.name), sub: 'Expires ' + dateOnly(i.expiryDate), trailing: badge('PENDING', 'Expiring') })).join('') + `<div class="kv mt8"><span class="k">Stock value (cost / retail)</span><span class="v">${money(a.stockValue)} / ${money(a.retailValue)}</span></div>`) : card(empty('✅', 'Stock levels look healthy'));
}

const invFields = (i = {}) => [
  { name: 'name', label: 'Product name (generic)', value: i.name || '', required: true }, { name: 'brand', label: 'Brand', value: i.brand || '' }, { name: 'manufacturer', label: 'Manufacturer', value: i.manufacturer || '' },
  { name: 'category', label: 'Category', type: 'select', options: ['Analgesic', 'Antibiotic', 'Antimalarial', 'Antihypertensive', 'Antidiabetic', 'Vitamins & supplements', 'Cough & cold', 'Gastro', 'Dermatology', 'Medical devices', 'Personal care', 'Other'], value: i.category || 'Other' },
  { name: 'batchNumber', label: 'Batch number', value: i.batchNumber || '' }, { name: 'barcode', label: 'Barcode / SKU', value: i.barcode || '' },
  { name: 'stock', label: 'Stock quantity', type: 'number', value: i.stock ?? 0, required: true }, { name: 'unit', label: 'Unit', value: i.unit || 'packs' },
  { name: 'costPrice', label: 'Cost price (₦)', type: 'number', value: i.costPrice ?? '' }, { name: 'price', label: 'Selling price (₦)', type: 'number', value: i.price ?? '', required: true },
  { name: 'reorderLevel', label: 'Reorder level', type: 'number', value: i.reorderLevel ?? 10 }, { name: 'expiryDate', label: 'Expiry date', type: 'date', value: i.expiryDate ? i.expiryDate.slice(0, 10) : '' },
  { name: 'requiresPrescription', label: 'Prescription-only medicine (POM)', type: 'checkbox', value: i.requiresPrescription },
];
const invBody = (v) => ({ ...v, stock: Math.round(Number(v.stock) || 0), price: Number(v.price), costPrice: v.costPrice === '' ? null : Number(v.costPrice), reorderLevel: Math.round(Number(v.reorderLevel) || 0), expiryDate: v.expiryDate ? new Date(v.expiryDate).toISOString() : null });

export async function pharmacyInventory(el) {
  el.innerHTML = appBar({ title: '📦 Inventory', back: '/pharmacy/home', roleCls: 'pharmacy-title', actions: '<button class="action" id="add" style="color:var(--pharmacy-color)">+ Add</button>' }) +
    `<div class="row mb8"><button class="btn btn-outline btn-sm grow" data-go="/pharmacy/intake">📥 Stock intake</button><button class="btn btn-outline btn-sm grow" data-go="/pharmacy/audit">📝 Audit</button></div><div class="form-group"><input id="q" placeholder="🔍 Search products, brand, batch, barcode"></div><div class="hscroll mb8">${['All', 'Low', 'Expiring', 'Expired', 'POM'].map((f, i) => `<span class="chip ${i === 0 ? 'active' : ''}" data-f="${f}">${f}</span>`).join('')}</div><div id="il">${skeleton(4)}</div>`;
  let items = [], f = 'All', qv = '';
  const load = async () => { items = await get('/pharmacy/inventory'); draw(); };
  const draw = () => {
    const now = Date.now();
    const list = items.filter((i) => (!qv || [i.name, i.brand, i.batchNumber, i.barcode].join(' ').toLowerCase().includes(qv)) && (f === 'All' || (f === 'Low' && i.stock <= i.reorderLevel) || (f === 'Expired' && i.expiryDate && new Date(i.expiryDate) < now) || (f === 'Expiring' && i.expiryDate && new Date(i.expiryDate) > now && new Date(i.expiryDate) < now + 90 * 864e5) || (f === 'POM' && i.requiresPrescription)));
    $('#il', el).innerHTML = list.length ? list.map((i) => {
      const exp = i.expiryDate && new Date(i.expiryDate) < now;
      return `<div class="product-detail-card" data-edit="${i.id}"><div class="row between"><div class="grow"><div class="product-name">${esc(i.name)} ${i.requiresPrescription ? '<span class="badge badge-warning">POM</span>' : ''}</div><div class="product-generic">${esc(i.brand || '')} ${i.manufacturer ? '• ' + esc(i.manufacturer) : ''}</div></div>${exp ? '<span class="badge badge-outofstock">Expired</span>' : i.stock <= 0 ? '<span class="badge badge-outofstock">Out</span>' : i.stock <= i.reorderLevel ? '<span class="badge badge-lowstock">Low Stock</span>' : '<span class="badge badge-instock">In Stock</span>'}</div>
        <div class="product-details"><div><span class="label">Stock:</span> ${i.stock} ${esc(i.unit || '')}</div><div><span class="label">Price:</span> ${money(i.price)}</div><div><span class="label">Batch:</span> ${esc(i.batchNumber || '—')}</div><div><span class="label">Expiry:</span> ${i.expiryDate ? dateOnly(i.expiryDate) : '—'}</div></div></div>`;
    }).join('') : empty('📦', items.length ? 'No matching products' : 'No products yet - add items or record a stock intake');
  };
  $$('[data-f]', el).forEach((c) => (c.onclick = () => { f = c.dataset.f; $$('[data-f]', el).forEach((x) => x.classList.toggle('active', x === c)); draw(); }));
  $('#q', el).oninput = (e) => { qv = e.target.value.toLowerCase(); draw(); };
  $('#add', el).onclick = () => formModal('➕ New product', invFields(), { onSubmit: async (v) => { await post('/pharmacy/inventory', invBody(v)); toast('✅ Added'); load(); } });
  el.addEventListener('click', (e) => {
    const c = e.target.closest('[data-edit]'); if (!c) return;
    const i = items.find((x) => x.id === c.dataset.edit);
    formModal('✏️ ' + esc(i.name), invFields(i), { onSubmit: async (v) => { await patch('/pharmacy/inventory/' + i.id, invBody(v)); toast('✅ Saved'); load(); } }).then(() => null);
    setTimeout(() => { const box = $('#modal .modal-content'); box?.insertAdjacentHTML('beforeend', '<button class="btn btn-outline btn-block mt8" id="delinv" style="color:var(--error)">🗑️ Delete product</button>'); $('#delinv')?.addEventListener('click', async () => { if (await confirmBox('Delete ' + i.name + '?', { danger: true, ok: 'Delete' })) { await del('/pharmacy/inventory/' + i.id).catch(toastErr); load(); } }); }, 30);
  });
  load();
}

/** Parses pasted invoice text: one line per item - "name, qty, cost, price, batch, expiry(YYYY-MM-DD)". */
function parseInvoice(text) {
  return text.split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const p = l.split(/[,;\t|]/).map((x) => x.trim());
    return { name: p[0], qty: Number(p[1]) || 0, costPrice: p[2] ? Number(p[2]) : undefined, price: p[3] ? Number(p[3]) : p[2] ? Math.round(Number(p[2]) * 1.25) : undefined, batchNumber: p[4] || undefined, expiryDate: p[5] || undefined };
  }).filter((x) => x.name && x.qty > 0);
}
export async function pharmacyIntake(el) {
  const [sup, hist] = await Promise.all([get('/pharmacy/suppliers').catch(() => []), get('/pharmacy-ops/intake')]);
  let rows = [], fileUrl = null;
  el.innerHTML = appBar({ title: '📥 Stock intake', back: '/pharmacy/inventory', roleCls: 'pharmacy-title' }) + card(cardHead('Receive stock') + `
    <p class="muted mb8">Upload the supplier invoice/receipt for your records, then add the lines (or paste them from the invoice). Existing products are matched by barcode or name + batch and their stock is increased.</p>
    <div class="row mb8"><button class="btn btn-outline btn-sm grow" id="up">📎 Attach invoice</button><span class="muted small" id="fn"></span></div>
    <div class="form-row"><div class="form-group"><label>Supplier</label><select id="sup"><option value="">—</option>${sup.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div><div class="form-group"><label>Invoice no.</label><input id="inv"></div></div>
    <div class="form-group"><label>Paste lines: name, qty, cost, price, batch, expiry</label><textarea id="paste" rows="4" placeholder="Paracetamol 500mg, 50, 300, 400, B123, 2027-06-30&#10;Amoxicillin 250mg, 20, 900, 1200, AX77, 2026-12-01"></textarea></div>
    <div class="row"><button class="btn btn-outline btn-sm grow" id="parse">Read lines</button><button class="btn btn-outline btn-sm grow" id="addl">+ Add line</button></div>
    <div id="lines" class="mt8"></div><button class="btn btn-pharmacy btn-block mt8 hidden" id="save">Receive stock</button>`) +
    card(cardHead('🗂️ Recent intakes') + (hist.length ? hist.map((h) => item({ icon: '📥', title: (h.invoiceNumber ? '#' + esc(h.invoiceNumber) : 'Intake') + ' • ' + (h.items || []).length + ' items', sub: dt(h.createdAt) + ' • cost ' + money(h.totalCost), trailing: h.fileUrl ? `<a class="link" href="${esc(h.fileUrl)}" target="_blank" rel="noopener">Invoice</a>` : '' })).join('') : empty('🗂️', 'No intakes yet')));
  const drawLines = () => {
    $('#lines', el).innerHTML = rows.length ? `<table class="tbl"><tr><th>Item</th><th>Qty</th><th>Cost</th><th>Price</th><th></th></tr>${rows.map((r, i) => `<tr><td>${esc(r.name)}<div class="muted small">${esc(r.batchNumber || '')} ${esc(r.expiryDate || '')}</div></td><td>${r.qty}</td><td>${r.costPrice ?? '—'}</td><td>${r.price ?? '—'}</td><td><button class="link" data-rm="${i}">✕</button></td></tr>`).join('')}</table>` : '';
    $('#save', el).classList.toggle('hidden', !rows.length);
  };
  $('#up', el).onclick = async () => { const f = await pickFile('image/*,application/pdf'); if (!f) return; try { toast('Uploading…'); const up = await post('/uploads', { dataUri: await fileToDataUri(f), folder: 'invoices', private: true }); fileUrl = up.url; $('#fn', el).textContent = '✅ ' + f.name; } catch (e) { toastErr(e); } };
  $('#parse', el).onclick = () => { const r = parseInvoice($('#paste', el).value); if (!r.length) return toast('No valid lines found'); rows.push(...r); $('#paste', el).value = ''; drawLines(); };
  $('#addl', el).onclick = () => formModal('Add line', invFields().filter((f) => ['name', 'brand', 'batchNumber', 'barcode', 'costPrice', 'price', 'expiryDate', 'requiresPrescription', 'category'].includes(f.name)).concat([{ name: 'qty', label: 'Quantity received', type: 'number', required: true }]), { onSubmit: async (v) => { rows.push({ ...v, qty: Number(v.qty), costPrice: v.costPrice === '' ? undefined : Number(v.costPrice), price: v.price === '' ? undefined : Number(v.price) }); drawLines(); } });
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) { rows.splice(+b.dataset.rm, 1); drawLines(); } });
  $('#save', el).onclick = (e) => busy(e.target, async () => { await post('/pharmacy-ops/intake', { supplierId: $('#sup', el).value || undefined, invoiceNumber: $('#inv', el).value || undefined, fileUrl, items: rows }); toast('✅ Stock received'); pharmacyIntake(el); });
}

export async function pharmacyAudit(el) {
  const [items, audits] = await Promise.all([get('/pharmacy/inventory'), get('/pharmacy-ops/audit')]);
  el.innerHTML = appBar({ title: '📝 Stock audit', back: '/pharmacy/inventory', roleCls: 'pharmacy-title' }) + card(cardHead('Count your shelves') + `<p class="muted mb8">Enter the physical count. Variances are recorded; tick "apply" to correct system stock.</p>
    <div class="form-group"><input id="q" placeholder="🔍 Filter"></div><table class="tbl" id="t"><tr><th>Product</th><th>System</th><th>Counted</th></tr>${items.map((i) => `<tr data-row="${esc(i.name.toLowerCase())}"><td>${esc(i.name)}<div class="muted small">${esc(i.batchNumber || '')}</div></td><td>${i.stock}</td><td><input type="number" min="0" data-c="${i.id}" style="width:70px;padding:4px;border:1px solid #DADCE0;border-radius:6px"></td></tr>`).join('')}</table>
    <div class="form-group mt8"><input id="note" placeholder="Note (e.g. monthly count)"></div><label class="check"><input type="checkbox" id="apply" checked> <span>Apply counts to stock</span></label><button class="btn btn-pharmacy btn-block" id="save">Submit audit</button>`) +
    card(cardHead('🗂️ Audit history') + (audits.length ? audits.map((a) => item({ icon: '📝', title: dt(a.createdAt) + ' • ' + (a.items || []).length + ' products', sub: 'Variance value ' + money(a.varianceValue) + (a.note ? ' • ' + esc(a.note) : ''), trailing: Number(a.varianceValue) < 0 ? badge('FAILED', 'Loss') : badge('CONFIRMED', 'OK') })).join('') : empty('📝', 'No audits yet')));
  $('#q', el).oninput = (e) => $$('[data-row]', el).forEach((r) => r.classList.toggle('hidden', !r.dataset.row.includes(e.target.value.toLowerCase())));
  $('#save', el).onclick = (e) => busy(e.target, async () => {
    const counts = $$('[data-c]', el).filter((i) => i.value !== '').map((i) => ({ inventoryId: i.dataset.c, counted: Number(i.value) }));
    if (!counts.length) throw new Error('Enter at least one count');
    const a = await post('/pharmacy-ops/audit', { items: counts, note: $('#note', el).value, apply: $('#apply', el).checked });
    toast(`✅ Audit saved • variance ${money(a.varianceValue)}`); pharmacyAudit(el);
  });
}

export async function pharmacyPos(el) {
  const items = (await get('/pharmacy/inventory')).filter((i) => i.stock > 0 && (!i.expiryDate || new Date(i.expiryDate) > new Date()));
  const taxPct = state.config?.posTaxPercent ?? 5;
  const cart = new Map();
  el.innerHTML = appBar({ title: '🧾 Point of Sale', back: '/pharmacy/home', roleCls: 'pharmacy-title' }) + `<div class="form-group"><input id="q" placeholder="🔍 Search or scan barcode, then Enter" autocomplete="off"></div><div id="res"></div><div id="cart"></div>`;
  const search = (qv) => {
    const v = qv.toLowerCase();
    const r = v ? items.filter((i) => [i.name, i.brand, i.barcode].join(' ').toLowerCase().includes(v)).slice(0, 8) : [];
    $('#res', el).innerHTML = r.length ? card(r.map((i) => item({ icon: '💊', title: esc(i.name) + (i.requiresPrescription ? ' <span class="badge badge-warning">POM</span>' : ''), sub: money(i.price) + ' • ' + i.stock + ' in stock', trailing: '<button class="btn btn-pharmacy btn-sm">+</button>', attrs: `data-add="${i.id}"` })).join('')) : '';
  };
  const drawCart = () => {
    const lines = [...cart.entries()].map(([id, qty]) => ({ i: items.find((x) => x.id === id), qty }));
    const sub = lines.reduce((s, l) => s + l.qty * Number(l.i.price), 0);
    const tax = Math.round(sub * taxPct) / 100;
    const pom = lines.some((l) => l.i.requiresPrescription);
    $('#cart', el).innerHTML = card(cardHead('🛒 Cart', lines.length ? '<button class="link" id="clr">Clear</button>' : '') + (lines.length ? lines.map((l) => `<div class="pos-cart-item"><div class="item-info"><div class="item-name">${esc(l.i.name)}</div><div class="item-price">${money(l.i.price)} × ${l.qty} = ${money(l.qty * l.i.price)}</div></div><div class="item-qty"><button data-dec="${l.i.id}">−</button><span class="qty">${l.qty}</span><button data-inc="${l.i.id}">+</button></div></div>`).join('') + `
      <div class="receipt-item"><span>Subtotal</span><span>${money(sub)}</span></div><div class="receipt-item"><span>Tax (${taxPct}%)</span><span>${money(tax)}</span></div><div class="receipt-total"><span>Total</span><span>${money(sub + tax)}</span></div>
      <div class="form-row mt8"><div class="form-group"><label>Customer</label><input id="cn" placeholder="Walk-in"></div><div class="form-group"><label>Phone</label><input id="cp" type="tel"></div></div>
      <div class="form-group"><label>Payment</label><select id="pm"><option value="CASH">💵 Cash</option><option value="CARD">💳 Card (terminal)</option><option value="TRANSFER">🏦 Transfer</option><option value="CREDITS">🪙 Patient's N-Health coins</option></select></div>
      <div class="form-group hidden" id="pe"><input id="email" type="email" placeholder="Patient's N-Health email"></div>
      ${pom ? '<label class="check"><input type="checkbox" id="rxok"> <span>I have checked a valid prescription for the POM items</span></label>' : ''}
      <button class="btn btn-pharmacy btn-block" id="co">Checkout & Deduct Stock</button>` : empty('🧾', 'Search a product to start a sale')));
    $('#clr', el)?.addEventListener('click', () => { cart.clear(); drawCart(); });
    $('#pm', el)?.addEventListener('change', (e) => $('#pe', el).classList.toggle('hidden', e.target.value !== 'CREDITS'));
    $('#co', el)?.addEventListener('click', (e) => busy(e.target, async () => {
      if (pom && !$('#rxok', el).checked) throw new Error('Confirm the prescription for POM items');
      const sale = await post('/pharmacy-ops/pos/checkout', { items: lines.map((l) => ({ inventoryId: l.i.id, qty: l.qty })), paymentMethod: $('#pm', el).value, customerName: $('#cn', el).value || undefined, customerPhone: $('#cp', el).value || undefined, patientEmail: $('#email', el)?.value || undefined, prescriptionChecked: pom ? true : undefined });
      lines.forEach((l) => { l.i.stock -= l.qty; });
      cart.clear(); drawCart();
      modal(`<div class="modal-title">🧾 Receipt ${esc(sale.receiptNo)}</div>${(sale.items || []).map((x) => `<div class="receipt-item"><span>${esc(x.name)} × ${x.qty}</span><span>${money(x.qty * x.price)}</span></div>`).join('')}<div class="receipt-item"><span>Tax</span><span>${money(sale.tax)}</span></div><div class="receipt-total"><span>Total</span><span>${money(sale.total)}</span></div><div class="muted small center mt8">${dt(sale.createdAt)} • ${esc(sale.paymentMethod)}</div><button class="btn btn-outline btn-block mt8" onclick="window.print()">🖨️ Print</button>`);
    }));
  };
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-add],[data-inc],[data-dec]'); if (!a) return;
    const id = a.dataset.add || a.dataset.inc || a.dataset.dec; const it = items.find((x) => x.id === id);
    const q = (cart.get(id) || 0) + (a.dataset.dec ? -1 : 1);
    if (q > it.stock) return toast('Only ' + it.stock + ' in stock');
    q > 0 ? cart.set(id, q) : cart.delete(id);
    if (a.dataset.add) { $('#q', el).value = ''; search(''); $('#q', el).focus(); }
    drawCart();
  });
  $('#q', el).oninput = (e) => search(e.target.value);
  $('#q', el).onkeydown = (e) => { if (e.key === 'Enter') { const b = items.find((i) => i.barcode && i.barcode === e.target.value.trim()); if (b) { cart.set(b.id, (cart.get(b.id) || 0) + 1); e.target.value = ''; search(''); drawCart(); } } };
  drawCart();
}

export async function pharmacyOrders(el, _p, q) {
  let tab = q.tab || 'orders';
  el.innerHTML = appBar({ title: '🛒 Orders', back: '/pharmacy/home', roleCls: 'pharmacy-title' }) + tabs([['orders', 'Incoming'], ['done', 'Completed'], ['rx', 'Prescriptions']], tab) + '<div id="tb"></div>';
  const NEXT = { PENDING: [['PROCESSING', '✓ Accept'], ['CANCELLED', '✕ Decline']], PROCESSING: [['READY', '📦 Ready']], READY: [['OUT_FOR_DELIVERY', '🛵 Dispatch'], ['DELIVERED', '✓ Collected']], OUT_FOR_DELIVERY: [['DELIVERED', '✓ Delivered']] };
  const draw = async () => {
    const tb = $('#tb', el); tb.innerHTML = skeleton(3);
    if (tab === 'rx') {
      const rx = await get('/pharmacy-ops/prescriptions');
      tb.innerHTML = rx.length ? rx.map((r) => card(`${item({ icon: '📄', title: esc(r.patient.user.name), sub: 'Dr. ' + esc(r.doctor.user.name) + ' • ' + dateOnly(r.issuedAt), trailing: `<button class="link" data-go="/chat/${r.patient.user.id}">💬</button>` })}${(r.medications || []).map((m) => `<div class="kv"><span class="k">${esc(m.name)}</span><span class="v">${esc(m.dosage)} • ${esc(m.frequency)} • ${m.durationDays}d</span></div>`).join('')}${r.notes ? `<div class="muted small">${esc(r.notes)}</div>` : ''}`)).join('') : empty('📄', 'Prescriptions sent to your pharmacy appear here');
      return;
    }
    const all = await get('/pharmacy/orders');
    const list = all.filter((o) => (tab === 'orders' ? !['DELIVERED', 'CANCELLED'].includes(o.status) : ['DELIVERED', 'CANCELLED'].includes(o.status)));
    tb.innerHTML = list.length ? list.map((o) => `<div class="service-request"><div class="header"><span class="patient-name">${esc(o.patient.user.name)}</span>${badge(o.status)}</div><div class="service-type">${dt(o.createdAt)} • ${o.deliveryMethod === 'DELIVERY' ? '🛵 ' + esc(o.deliveryAddress || '') : '🏪 Pickup'} • ${badge(o.paymentStatus)}</div>
      ${o.prescription ? `<div class="muted small">📄 Rx by Dr. ${esc(o.prescription.doctor?.user?.name || '')}</div>` : ''}${(o.items || []).map((i) => `<div class="kv"><span class="k">${esc(i.name)} × ${i.qty}</span><span class="v">${money(i.qty * i.price)}</span></div>`).join('')}<div class="kv"><span class="k"><b>Total</b></span><span class="v"><b>${money(o.total)}</b></span></div>
      <div class="actions">${(NEXT[o.status] || []).map(([s, l]) => `<button class="${s === 'CANCELLED' ? 'decline' : 'accept'}" data-os="${s}" data-id="${o.id}">${l}</button>`).join('')}<button class="refer" data-go="/chat/${o.patient.user.id}">💬</button>${o.patient.user.phone ? `<a class="refer" href="tel:${esc(o.patient.user.phone)}" style="text-align:center;text-decoration:none">📞</a>` : ''}</div></div>`).join('') : empty('🛒', 'No orders');
  };
  $$('[data-tab]', el).forEach((x) => (x.onclick = () => { tab = x.dataset.tab; $$('[data-tab]', el).forEach((y) => y.classList.toggle('active', y === x)); draw(); }));
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-os]'); if (!b) return;
    if (b.dataset.os === 'CANCELLED') return formModal('Decline order', [{ name: 'reason', label: 'Reason (sent to patient)', type: 'select', options: ['Out of stock', 'Prescription required', 'Prescription invalid', 'Outside delivery area', 'Other'] }], { submit: 'Decline & refund', onSubmit: async (v) => { await post('/pharmacy/orders/' + b.dataset.id + '/status', { status: 'CANCELLED', reason: v.reason }); draw(); } });
    await busy(b, async () => { await post('/pharmacy/orders/' + b.dataset.id + '/status', { status: b.dataset.os }); toast('✅ Updated'); draw(); });
  });
  draw();
  return on('order:new', () => { toast('🛒 New order'); draw(); });
}

export async function pharmacyCustomers(el) {
  el.innerHTML = appBar({ title: '👥 Customers', back: '/pharmacy/home', roleCls: 'pharmacy-title' }) + `<div id="l">${skeleton(4)}</div>`;
  const c = await get('/pharmacy-ops/customers');
  $('#l', el).innerHTML = c.length ? card(c.map((x) => item({ icon: x.userId ? '👤' : '🚶', title: esc(x.name), sub: `${x.orders} purchases • ${money(x.spent)} • last ${dateOnly(x.last)}${x.phone ? ' • ' + esc(x.phone) : ''}`, trailing: x.userId ? `<button class="link" data-go="/chat/${x.userId}">💬</button>` : '' })).join('')) : empty('👥', 'Customers appear after orders and POS sales');
}

// =====================================================================
// LAB
// =====================================================================
export async function labHome(el) {
  el.innerHTML = appBar({ title: brandTitle(), roleCls: 'lab-title' }) + welcome('Diagnostics dashboard') + verifyBanner() + `<div class="provider-stats" id="st"></div><div id="q">${skeleton(2)}</div>
    <div class="quick-actions">
      <div class="quick-action lab-action" data-go="/lab/tests" tabindex="0"><span class="icon">🧪</span><span class="label">Test queue</span></div>
      <div class="quick-action lab-action" data-go="/lab/catalog" tabindex="0"><span class="icon">📋</span><span class="label">Catalog & prices</span></div>
      <div class="quick-action lab-action" data-go="/provider/schedule" tabindex="0"><span class="icon">🗓️</span><span class="label">Hours</span></div>
      <div class="quick-action lab-action" data-go="/provider/earnings" tabindex="0"><span class="icon">💰</span><span class="label">Earnings</span></div>
    </div>`;
  const [s, tests] = await Promise.all([get('/lab/stats'), get('/lab/tests')]);
  $('#st', el).innerHTML = stat(s.awaitingSample, 'Awaiting sample') + stat(s.inProgress, 'Processing') + stat(s.completedCount, 'Completed') + stat(money(s.todayRevenue || 0).replace(/\.00$/, ''), 'Today');
  const open = tests.filter((x) => ['REQUESTED', 'SAMPLE_COLLECTED', 'PROCESSING'].includes(x.status)).slice(0, 5);
  $('#q', el).innerHTML = card(cardHead('🧪 Next in queue', '<a class="link" data-go="/lab/tests">All</a>') + (open.length ? open.map((x) => item({ avatarHtml: '<div class="avatar lab-avatar">🧪</div>', title: esc(x.testType) + ' • ' + esc(x.patient.user.name), sub: (x.scheduledAt ? relDay(x.scheduledAt) : ago(x.createdAt)) + (x.homeCollection ? ' • 🏠 home' : '') + (x.requestedByDoctorId ? ' • 👨‍⚕️ doctor order' : ''), trailing: badge(x.status), attrs: 'data-go="/lab/tests"' })).join('') : empty('✅', 'Queue is clear')));
}

export async function labTests(el, _p, q) {
  let tab = q.tab || 'open';
  el.innerHTML = appBar({ title: '🧪 Tests', back: '/lab/home', roleCls: 'lab-title' }) + tabs([['open', 'Open'], ['done', 'Completed']], tab) + '<div id="tb"></div>';
  const NEXT = { REQUESTED: [['SAMPLE_COLLECTED', '🧫 Sample collected'], ['CANCELLED', '✕ Cancel']], SAMPLE_COLLECTED: [['PROCESSING', '⚙️ Processing'], ['RESULT', '📄 Upload result']], PROCESSING: [['RESULT', '📄 Upload result']] };
  const draw = async () => {
    const tb = $('#tb', el); tb.innerHTML = skeleton(3);
    const all = await get('/lab/tests');
    const list = all.filter((x) => (tab === 'open' ? !['COMPLETED', 'CANCELLED'].includes(x.status) : ['COMPLETED', 'CANCELLED'].includes(x.status)));
    tb.innerHTML = list.length ? list.map((x) => `<div class="service-request"><div class="header"><span class="patient-name">${esc(x.patient.user.name)}</span>${badge(x.status)}</div><div class="service-type">🧪 ${esc(x.testType)} • ${x.scheduledAt ? relDay(x.scheduledAt) : 'Walk-in'} • ${esc(x.paymentStatus.toLowerCase())}</div>
      ${x.homeCollection ? `<div class="muted small">🏠 Home collection: ${esc(x.address || '')}</div>` : ''}${x.notes ? `<div class="muted small">📝 ${esc(x.notes)}</div>` : ''}${x.requestedByDoctorId ? '<div class="muted small">👨‍⚕️ Ordered by a doctor - result returns to them automatically</div>' : ''}
      <div class="actions">${(NEXT[x.status] || []).map(([s, l]) => `<button class="${s === 'CANCELLED' ? 'decline' : 'accept'}" data-ts="${s}" data-id="${x.id}">${l}</button>`).join('')}${x.status === 'COMPLETED' ? `<button class="refer" data-pdf="${x.id}">⬇️ PDF</button>` : ''}<button class="refer" data-go="/chat/${x.patient.user.id}">💬</button></div></div>`).join('') : empty('🧪', 'No tests');
  };
  $$('[data-tab]', el).forEach((x) => (x.onclick = () => { tab = x.dataset.tab; $$('[data-tab]', el).forEach((y) => y.classList.toggle('active', y === x)); draw(); }));
  el.addEventListener('click', async (e) => {
    const p = e.target.closest('[data-pdf]'); if (p) return download('/lab-results/' + p.dataset.pdf + '/pdf', 'lab-result.pdf').catch(toastErr);
    const b = e.target.closest('[data-ts]'); if (!b) return;
    if (b.dataset.ts !== 'RESULT') return busy(b, async () => { await post('/lab/tests/' + b.dataset.id + '/status', { status: b.dataset.ts }); draw(); });
    let fileUrl;
    modal(`<div class="modal-title">📄 Upload result</div><div id="rows"></div><button class="btn btn-outline btn-sm btn-block" id="addrow">+ Parameter</button><div class="form-group mt8"><label>Comments</label><textarea id="notes" rows="2"></textarea></div><button class="btn btn-outline btn-sm btn-block" id="att">📎 Attach report (PDF/image)</button><span class="muted small" id="attn"></span><button class="btn btn-lab btn-block mt8" id="sub">Release result</button>`, (box, close) => {
      const addRow = () => $('#rows', box).insertAdjacentHTML('beforeend', `<div class="form-row mb8" data-r><input placeholder="Parameter" data-k="parameter" style="padding:8px;border:1px solid #DADCE0;border-radius:8px"><input placeholder="Value" data-k="value" style="padding:8px;border:1px solid #DADCE0;border-radius:8px"><input placeholder="Unit" data-k="unit" style="padding:8px;border:1px solid #DADCE0;border-radius:8px"><input placeholder="Ref range" data-k="referenceRange" style="padding:8px;border:1px solid #DADCE0;border-radius:8px"><select data-k="flag" style="padding:8px;border:1px solid #DADCE0;border-radius:8px"><option>NORMAL</option><option>LOW</option><option>HIGH</option></select></div>`);
      addRow(); addRow();
      $('#addrow', box).onclick = addRow;
      $('#att', box).onclick = async () => { const f = await pickFile('application/pdf,image/*'); if (!f) return; try { const up = await post('/uploads', { dataUri: await fileToDataUri(f), folder: 'lab-results', private: true }); fileUrl = up.url; $('#attn', box).textContent = '✅ ' + f.name; } catch (err) { toastErr(err); } };
      $('#sub', box).onclick = (ev) => busy(ev.target, async () => {
        const results = $$('[data-r]', box).map((r) => Object.fromEntries($$('[data-k]', r).map((i) => [i.dataset.k, i.value.trim()]))).filter((r) => r.parameter && r.value).map((r) => ({ ...r, unit: r.unit || undefined, referenceRange: r.referenceRange || undefined }));
        if (!results.length) throw new Error('Add at least one parameter and value');
        await post('/lab/tests/' + b.dataset.id + '/result', { results, notes: $('#notes', box).value || undefined, fileUrl });
        toast('✅ Result released to patient' ); close(); draw();
      });
    });
  });
  draw();
}

export async function labCatalog(el) {
  el.innerHTML = appBar({ title: '📋 Test catalog', back: '/lab/home', roleCls: 'lab-title', actions: '<button class="action" id="add" style="color:var(--lab-color)">+ Add</button>' }) + `<div id="l">${skeleton(3)}</div>`;
  const fields = (c = {}) => [{ name: 'name', label: 'Test name', value: c.name || '', required: true, placeholder: 'Full Blood Count (CBC)' }, { name: 'code', label: 'Code', value: c.code || '' }, { name: 'category', label: 'Category', type: 'select', options: ['Haematology', 'Chemistry', 'Microbiology', 'Serology', 'Hormones', 'Imaging', 'Molecular', 'Other'], value: c.category || 'Other' }, { name: 'price', label: 'Price (₦)', type: 'number', value: c.price ?? '', required: true }, { name: 'turnaroundHours', label: 'Turnaround (hours)', type: 'number', value: c.turnaroundHours ?? 24 }, { name: 'sampleType', label: 'Sample', value: c.sampleType || '', placeholder: 'Blood / Urine / Swab' }, { name: 'preparation', label: 'Patient preparation', value: c.preparation || '', placeholder: 'e.g. Fast 8-12 hours' }];
  const load = async () => {
    const list = await get('/lab-ops/catalog');
    $('#l', el).innerHTML = list.length ? card(list.map((c) => item({ avatarHtml: '<div class="avatar lab-avatar">🧪</div>', title: esc(c.name) + (c.isActive ? '' : ' <span class="muted">(hidden)</span>'), sub: `${esc(c.category || '')} • ${money(c.price)} • ⏱️ ${c.turnaroundHours}h`, attrs: `data-c='${esc(JSON.stringify(c))}'` })).join('')) : empty('📋', 'Add the tests you offer so patients and doctors can book them', '<button class="btn btn-lab btn-sm" id="seed">Add common tests</button>');
    $('#seed', el)?.addEventListener('click', (e) => busy(e.target, async () => {
      for (const [name, price, h, sample, cat] of [['Full Blood Count (CBC)', 5000, 24, 'Blood', 'Haematology'], ['Malaria Parasite (MP)', 2500, 4, 'Blood', 'Microbiology'], ['Lipid Profile', 10000, 24, 'Blood (fasting)', 'Chemistry'], ['Genotype', 3000, 24, 'Blood', 'Haematology'], ['Blood Group', 2000, 2, 'Blood', 'Haematology'], ['Fasting Blood Sugar', 2000, 2, 'Blood (fasting)', 'Chemistry'], ['HbA1c', 8000, 24, 'Blood', 'Chemistry'], ['Widal (Typhoid)', 3000, 4, 'Blood', 'Serology'], ['Urinalysis', 2500, 4, 'Urine', 'Chemistry'], ['Pregnancy Test', 1500, 1, 'Urine', 'Hormones'], ['HIV Screening', 3000, 2, 'Blood', 'Serology'], ['Hepatitis B (HBsAg)', 3000, 2, 'Blood', 'Serology']]) await post('/lab-ops/catalog', { name, price, turnaroundHours: h, sampleType: sample, category: cat });
      load();
    }));
  };
  $('#add', el).onclick = () => formModal('➕ New test', fields(), { onSubmit: async (v) => { await post('/lab-ops/catalog', v); load(); } });
  el.addEventListener('click', (e) => { const c = e.target.closest('[data-c]'); if (!c) return; const x = JSON.parse(c.dataset.c); formModal('✏️ ' + esc(x.name), [...fields(x), { name: 'isActive', label: 'Visible to patients', type: 'checkbox', value: x.isActive }], { onSubmit: async (v) => { await patch('/lab-ops/catalog/' + x.id, v); load(); } }); });
  load();
}

// =====================================================================
// NURSE
// =====================================================================
export async function nurseHome(el) {
  const prof = await get('/provider-profile').catch(() => ({}));
  el.innerHTML = appBar({ title: brandTitle(), roleCls: 'nurse-title' }) + welcome('Home-care dashboard') + verifyBanner() +
    card(`<div class="row between"><div><b>Availability</b><div class="muted">${prof.isAvailable ? 'You are receiving new requests' : 'You are offline'}</div></div><label class="check" style="margin:0"><input type="checkbox" id="av" ${prof.isAvailable ? 'checked' : ''}> Available</label></div>`) +
    `<div class="provider-stats" id="st"></div><div id="rq">${skeleton(2)}</div>
    <div class="quick-actions"><div class="quick-action nurse-action" data-go="/nurse/requests" tabindex="0"><span class="icon">📋</span><span class="label">Requests</span></div><div class="quick-action nurse-action" data-go="/provider/schedule" tabindex="0"><span class="icon">🗓️</span><span class="label">Schedule</span></div><div class="quick-action nurse-action" data-go="/messages" tabindex="0"><span class="icon">💬</span><span class="label">Messages</span></div><div class="quick-action nurse-action" data-go="/provider/earnings" tabindex="0"><span class="icon">💰</span><span class="label">Earnings</span></div></div>`;
  $('#av', el).onchange = (e) => patch('/nurse/availability', { isAvailable: e.target.checked }).then(() => toast(e.target.checked ? '🟢 Available' : '⚪ Offline')).catch(toastErr);
  const s = await get('/nurse/stats');
  $('#st', el).innerHTML = stat(s.awaitingCount, 'Open requests') + stat(s.activeCount, 'Active') + stat(s.completedToday, 'Done today') + stat(money(s.todayRevenue || 0).replace(/\.00$/, ''), 'Today');
  const mine = await get('/nurse/requests/mine');
  const act = mine.filter((x) => ['ACCEPTED', 'IN_PROGRESS'].includes(x.status));
  $('#rq', el).innerHTML = card(cardHead('🩺 Active visits', '<a class="link" data-go="/nurse/requests">All</a>') + (act.length ? act.map((x) => item({ avatarHtml: avatar('PATIENT', x.patient.user.avatarUrl), title: esc(x.patient.user.name), sub: esc(x.serviceType) + ' • ' + (x.scheduledAt ? relDay(x.scheduledAt) : ''), trailing: badge(x.status), attrs: 'data-go="/nurse/requests?tab=mine"' })).join('') : empty('🩺', 'No active visits')));
}

export async function nurseRequests(el, _p, q) {
  let tab = q.tab || 'open';
  el.innerHTML = appBar({ title: '📋 Requests', back: '/nurse/home', roleCls: 'nurse-title' }) + tabs([['open', 'Available'], ['mine', 'My visits']], tab) + '<div id="tb"></div>';
  const draw = async () => {
    const tb = $('#tb', el); tb.innerHTML = skeleton(3);
    const list = await get(tab === 'open' ? '/nurse/requests/available' : '/nurse/requests/mine');
    tb.innerHTML = list.length ? list.map((x) => `<div class="service-request"><div class="header"><span class="patient-name">${esc(x.patient.user.name)}</span>${badge(x.status)}</div><div class="service-type">🩺 ${esc(x.serviceType)} • ${x.scheduledAt ? relDay(x.scheduledAt) : 'ASAP'} • ${x.durationHours || 1}h</div>${x.address ? `<div class="muted small">📍 ${esc(x.address)}</div>` : ''}${x.notes ? `<div class="muted small">${esc(x.notes)}</div>` : ''}
      <div class="actions">${x.status === 'REQUESTED' ? `<button class="accept" data-acc="${x.id}">✓ Accept</button>` : ''}${x.status === 'ACCEPTED' ? `<button class="accept" data-ns="IN_PROGRESS" data-id="${x.id}">▶ Start visit</button>` : ''}${x.status === 'IN_PROGRESS' ? `<button class="accept" data-ns="COMPLETED" data-id="${x.id}">✓ Complete</button>` : ''}${['ACCEPTED', 'IN_PROGRESS'].includes(x.status) ? `<button class="decline" data-ns="CANCELLED" data-id="${x.id}">✕</button>` : ''}
      ${x.address ? `<a class="refer" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(x.address)}" style="text-align:center;text-decoration:none">🧭</a>` : ''}<button class="refer" data-go="/chat/${x.patient.user.id}">💬</button>${x.patient.user.phone ? `<a class="refer" href="tel:${esc(x.patient.user.phone)}" style="text-align:center;text-decoration:none">📞</a>` : ''}</div></div>`).join('') : empty('📋', tab === 'open' ? 'No open requests right now' : 'No visits yet');
  };
  $$('[data-tab]', el).forEach((x) => (x.onclick = () => { tab = x.dataset.tab; $$('[data-tab]', el).forEach((y) => y.classList.toggle('active', y === x)); draw(); }));
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-acc],[data-ns]'); if (!b) return;
    await busy(b, async () => { if (b.dataset.acc) await post('/nurse/requests/' + b.dataset.acc + '/accept'); else await post('/nurse/requests/' + b.dataset.id + '/status', { status: b.dataset.ns }); toast('✅ Updated'); draw(); });
  });
  draw();
  const offs = [on('nurse:new', () => { toast('🩺 New home-care request'); draw(); }), on('nurse:claimed', draw)];
  return () => offs.forEach((f) => f());
}

// =====================================================================
// AMBULANCE
// =====================================================================
let watchId = null;
function startSharing() {
  if (watchId != null || !navigator.geolocation) return;
  watchId = navigator.geolocation.watchPosition((p) => emit('ambulance:location', { lat: p.coords.latitude, lng: p.coords.longitude }), () => null, { enableHighAccuracy: true, maximumAge: 5000 });
}
function stopSharing() { if (watchId != null) navigator.geolocation.clearWatch(watchId); watchId = null; }

export async function ambulanceHome(el) {
  const prof = await get('/provider-profile').catch(() => ({}));
  el.innerHTML = appBar({ title: brandTitle(), roleCls: 'ambulance-title' }) + welcome('Emergency response') + verifyBanner() +
    card(`<div class="row between"><div><b>🚑 ${esc(prof.vehicleNumber || 'Vehicle')}</b><div class="muted">${prof.isAvailable ? 'On duty - receiving emergencies' : 'Off duty'}</div></div><label class="check" style="margin:0"><input type="checkbox" id="av" ${prof.isAvailable ? 'checked' : ''}> On duty</label></div><div class="muted small mt8">📍 Live location is shared only with patients you are responding to.</div>`, prof.isAvailable ? 'style="border:2px solid var(--ambulance-color)"' : '') +
    `<div class="provider-stats" id="st"></div><div id="ac">${skeleton(1)}</div><button class="btn btn-ambulance btn-block" data-go="/ambulance/requests">🚨 Open emergencies</button>`;
  if (prof.isAvailable) startSharing();
  $('#av', el).onchange = async (e) => {
    try {
      await patch('/ambulance/availability', { isAvailable: e.target.checked });
      if (e.target.checked) { const p = await locate().catch(() => null); if (p) await post('/ambulance/location', p).catch(() => null); startSharing(); toast('🟢 On duty'); } else { stopSharing(); toast('⚪ Off duty'); }
    } catch (err) { toastErr(err); }
  };
  const s = await get('/ambulance/stats');
  $('#st', el).innerHTML = stat(s.availableCount, 'Open calls') + stat(s.activeCount, 'Active') + stat(s.completedToday, 'Today') + stat(s.completedTotal, 'All time');
  const mine = await get('/ambulance/requests/mine');
  const act = mine.filter((x) => ['ACCEPTED', 'EN_ROUTE', 'ARRIVED'].includes(x.status));
  $('#ac', el).innerHTML = act.length ? card(cardHead('🚨 Active trip') + act.map((x) => item({ icon: '🚨', title: esc(x.patient?.user?.name || 'Patient'), sub: esc(x.type || '') + ' • ' + ago(x.requestedAt), trailing: badge(x.status), attrs: 'data-go="/ambulance/requests?tab=mine"' })).join(''), 'style="border:2px solid var(--emergency-red)"') : '';
}

export async function ambulanceRequests(el, _p, q) {
  let tab = q.tab || 'open', map = null;
  el.innerHTML = appBar({ title: '🚨 Emergencies', back: '/ambulance/home', roleCls: 'ambulance-title' }) + tabs([['open', 'Open calls'], ['mine', 'My trips']], tab) + '<div id="tb"></div>';
  const NEXT = { ACCEPTED: [['EN_ROUTE', '🚑 En route']], EN_ROUTE: [['ARRIVED', '📍 Arrived']], ARRIVED: [['COMPLETED', '✓ Complete']] };
  const draw = async () => {
    const tb = $('#tb', el); tb.innerHTML = skeleton(2);
    const list = await get(tab === 'open' ? '/ambulance/requests/available' : '/ambulance/requests/mine');
    const active = tab === 'mine' && list.find((x) => ['ACCEPTED', 'EN_ROUTE', 'ARRIVED'].includes(x.status));
    tb.innerHTML = (active ? '<div class="map" id="amap"></div>' : '') + (list.length ? list.map((x) => `<div class="service-request" ${['REQUESTED', 'ACCEPTED', 'EN_ROUTE'].includes(x.status) ? 'style="border-left:4px solid var(--emergency-red)"' : ''}><div class="header"><span class="patient-name">🚨 ${esc(x.patient?.user?.name || 'Emergency')}</span>${badge(x.status)}</div>
      <div class="service-type">${esc(x.type || 'MEDICAL')} • ${ago(x.requestedAt)}${x.distanceKm != null ? ' • ' + x.distanceKm + ' km' : ''}</div>${x.notes ? `<div class="muted small">${esc(x.notes)}</div>` : ''}${x.address ? `<div class="muted small">📍 ${esc(x.address)}</div>` : ''}
      <div class="actions">${x.status === 'REQUESTED' ? `<button class="accept" data-acc="${x.id}">✓ Accept</button>` : ''}${(NEXT[x.status] || []).map(([s, l]) => `<button class="accept" data-as="${s}" data-id="${x.id}">${l}</button>`).join('')}${['ACCEPTED', 'EN_ROUTE', 'ARRIVED'].includes(x.status) ? `<button class="decline" data-as="CANCELLED" data-id="${x.id}">✕</button>` : ''}
      <a class="refer" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${x.lat},${x.lng}" style="text-align:center;text-decoration:none">🧭 Navigate</a>${x.contactPhone || x.patient?.user?.phone ? `<a class="refer" href="tel:${esc(x.contactPhone || x.patient.user.phone)}" style="text-align:center;text-decoration:none">📞</a>` : ''}${x.patient?.user?.id ? `<button class="refer" data-go="/chat/${x.patient.user.id}">💬</button>` : ''}</div></div>`).join('') : empty('✅', tab === 'open' ? 'No open emergencies' : 'No trips yet'));
    if (active) { try { map?.destroy(); map = await createMap($('#amap', tb), [active.lat, active.lng], 14); map.setMarker('p', active.lat, active.lng, '🆘', 'Patient'); const me = await locate({ timeout: 5000 }).catch(() => null); if (me) map.setMarker('me', me.lat, me.lng, '🚑', 'You'); map.fit(); startSharing(); } catch { /* */ } }
  };
  $$('[data-tab]', el).forEach((x) => (x.onclick = () => { tab = x.dataset.tab; $$('[data-tab]', el).forEach((y) => y.classList.toggle('active', y === x)); draw(); }));
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-acc],[data-as]'); if (!b) return;
    await busy(b, async () => {
      if (b.dataset.acc) { const p = await locate({ timeout: 6000 }).catch(() => null); if (p) await post('/ambulance/location', p).catch(() => null); await post('/ambulance/requests/' + b.dataset.acc + '/accept'); toast('🚑 Accepted - navigate to the patient'); tab = 'mine'; $$('[data-tab]', el).forEach((y) => y.classList.toggle('active', y.dataset.tab === 'mine')); startSharing(); }
      else await post('/ambulance/requests/' + b.dataset.id + '/status', { status: b.dataset.as });
      draw();
    });
  });
  draw();
  const offs = [on('emergency:new', () => { if (navigator.vibrate) navigator.vibrate([400, 100, 400]); toast('🚨 New emergency!'); if (tab === 'open') draw(); }), on('emergency:claimed', () => tab === 'open' && draw()), on('emergency:cancelled', () => { toast('Emergency was cancelled by the patient'); draw(); })];
  return () => { offs.forEach((f) => f()); map?.destroy(); };
}

// =====================================================================
// INSTITUTION
// =====================================================================
const istat = (n, l) => `<div class="institution-stat"><div class="number">${n}</div><div class="label">${l}</div></div>`;
export async function institutionHome(el) {
  el.innerHTML = appBar({ title: brandTitle(), roleCls: 'institution-title' }) + verifyBanner() + `<div id="hd">${skeleton(1)}</div><div class="institution-stats" id="st"></div><div id="td"></div>
    <div class="quick-actions">
      <div class="quick-action institution-action" data-go="/institution/departments" tabindex="0"><span class="icon">🏢</span><span class="label">Departments</span></div>
      <div class="quick-action institution-action" data-go="/institution/staff" tabindex="0"><span class="icon">👥</span><span class="label">Staff</span></div>
      <div class="quick-action institution-action" data-go="/institution/patients" tabindex="0"><span class="icon">🛏️</span><span class="label">Patients</span></div>
      <div class="quick-action institution-action" data-go="/institution/reports" tabindex="0"><span class="icon">📊</span><span class="label">Reports</span></div>
      <div class="quick-action institution-action" data-go="/patient/donations?tab=mine" tabindex="0"><span class="icon">❤️</span><span class="label">Campaigns</span></div>
      <div class="quick-action institution-action" data-go="/messages" tabindex="0"><span class="icon">💬</span><span class="label">Messages</span></div>
      <div class="quick-action institution-action" data-go="/institution/profile" tabindex="0"><span class="icon">⚙️</span><span class="label">Facility info</span></div>
      <div class="quick-action institution-action" data-go="/provider/earnings" tabindex="0"><span class="icon">💰</span><span class="label">Finance</span></div>
    </div>`;
  const [p, s] = await Promise.all([get('/institution/profile'), get('/institution/stats')]);
  $('#hd', el).innerHTML = `<div class="welcome-text">🏥 ${esc(p.name)}</div><div class="welcome-sub">${esc([p.type, p.city, p.state].filter(Boolean).join(' • '))}</div>`;
  $('#st', el).innerHTML = istat(s.departments, 'Departments') + istat(s.doctors, 'Doctors') + istat(s.staff, 'Staff') + istat(`${s.bedsAvailable}/${s.beds}`, 'Beds free') + istat(s.occupancy + '%', 'Occupancy') + istat(s.patientsTotal, 'Patients');
  $('#td', el).innerHTML = card(cardHead('📅 Today') + `<div class="kv"><span class="k">🛏️ Admissions</span><span class="v">${s.admissionsToday}</span></div><div class="kv"><span class="k">🏠 Discharges</span><span class="v">${s.dischargesToday}</span></div><div class="kv"><span class="k">🚶 Outpatients</span><span class="v">${s.outpatientsToday}</span></div><div class="kv"><span class="k">📅 Appointments</span><span class="v">${s.appointmentsToday}</span></div><div class="kv"><span class="k">🛏️ Currently admitted</span><span class="v">${s.admitted}</span></div>`);
}

export async function institutionProfile(el) {
  const p = await get('/institution/profile');
  el.innerHTML = appBar({ title: '⚙️ Facility info', back: '/institution/home', roleCls: 'institution-title' }) + card(`<form id="f"></form>`);
  const F = [['name', 'Institution name'], ['type', 'Type'], ['licenseNumber', 'Licence / registration no.'], ['email', 'Email'], ['phone', 'Phone'], ['address', 'Address'], ['city', 'City'], ['state', 'State'], ['country', 'Country (ISO code)'], ['bedsTotal', 'Total beds', 'number'], ['bedsAvailable', 'Beds available', 'number'], ['description', 'About', 'textarea']];
  $('#f', el).innerHTML = F.map(([k, l, ty]) => fld({ name: k, label: l, type: ty || 'text', value: p[k] ?? '' })).join('') + fld({ name: 'emergencyCare', label: '🚨 24-hour emergency care', type: 'checkbox', value: p.emergencyCare }) + '<button class="btn btn-outline btn-sm btn-block mb8" type="button" id="loc">📍 Use my current location for the map</button><button class="btn btn-institution btn-block" type="submit">Save</button>';
  let ll = {};
  $('#loc', el).onclick = async () => { try { const g = await locate(); ll = { lat: g.lat, lng: g.lng }; toast('📍 Location captured'); } catch (e) { toastErr(e); } };
  $('#f', el).onsubmit = async (e) => { e.preventDefault(); try { await patch('/institution/profile', { ...readForm(e.target), ...ll }); toast('✅ Saved'); } catch (err) { toastErr(err); } };
}

export async function institutionDepartments(el) {
  el.innerHTML = appBar({ title: '🏢 Departments', back: '/institution/home', roleCls: 'institution-title', actions: '<button class="action" id="add" style="color:var(--institution-color)">+ Add</button>' }) + `<div id="l">${skeleton(3)}</div>`;
  const fields = (d = {}) => [{ name: 'name', label: 'Department', value: d.name || '', required: true, placeholder: 'Cardiology' }, { name: 'headName', label: 'Head of Department', value: d.headName || '' }, { name: 'beds', label: 'Beds', type: 'number', value: d.beds ?? 0 }, { name: 'bedsOccupied', label: 'Beds occupied', type: 'number', value: d.bedsOccupied ?? 0 }, { name: 'description', label: 'Description', type: 'textarea', value: d.description || '' }];
  const load = async () => {
    const list = await get('/institution/departments');
    $('#l', el).innerHTML = list.length ? list.map((d) => `<div class="facility-card" data-d='${esc(JSON.stringify(d))}'><div class="facility-header"><div><div class="facility-name">${esc(d.name)}</div><div class="facility-type">HOD: ${esc(d.headName || '—')}</div></div><span class="badge badge-institution">${d._count?.staff || 0} staff</span></div><div class="facility-stats"><span>🛏️ ${d.bedsOccupied}/${d.beds} beds</span><span>🧑‍🤝‍🧑 ${d._count?.patients || 0} patients</span></div>${d.beds ? `<div class="progress-bar mt8"><div class="fill ${d.bedsOccupied / d.beds > 0.9 ? 'warning' : 'success'}" style="width:${Math.min(100, Math.round((d.bedsOccupied / d.beds) * 100))}%"></div></div>` : ''}</div>`).join('') : empty('🏢', 'Add departments such as Cardiology, Paediatrics, Orthopaedics');
  };
  $('#add', el).onclick = () => formModal('➕ New department', fields(), { onSubmit: async (v) => { await post('/institution/departments', v); load(); } });
  el.addEventListener('click', (e) => { const c = e.target.closest('[data-d]'); if (!c) return; const d = JSON.parse(c.dataset.d); formModal('✏️ ' + esc(d.name), fields(d), { onSubmit: async (v) => { await patch('/institution/departments/' + d.id, v); load(); } }); });
  load();
}

export async function institutionStaff(el) {
  const depts = await get('/institution/departments');
  el.innerHTML = appBar({ title: '👥 Staff', back: '/institution/home', roleCls: 'institution-title', actions: '<button class="action" id="add" style="color:var(--institution-color)">+ Enrol</button>' }) + `<div id="l">${skeleton(3)}</div>`;
  const load = async () => {
    const list = await get('/institution/staff');
    $('#l', el).innerHTML = list.length ? list.map((s) => `<div class="staff-card"><div class="row">${avatar(s.staffRole === 'NURSE' ? 'NURSE' : s.staffRole === 'DOCTOR' ? 'DOCTOR' : 'INSTITUTION', s.user?.avatarUrl)}<div class="staff-info grow"><div class="staff-name">${esc(s.name)} ${s.user?.verificationStatus === 'VERIFIED' ? '✅' : ''}</div><div class="staff-role">${esc(s.title || s.staffRole.replace('_', ' ').toLowerCase())}${s.department ? ' • ' + esc(s.department.name) : ''}</div></div><div class="staff-status">${badge(s.status)}</div></div>
      <div class="row mt8">${s.status === 'ACTIVE' ? `<button class="btn btn-outline btn-sm grow" data-ss="SUSPENDED" data-id="${s.id}">Suspend</button>` : s.status === 'SUSPENDED' ? `<button class="btn btn-outline btn-sm grow" data-ss="ACTIVE" data-id="${s.id}">Reactivate</button>` : ''}${s.status !== 'LEFT' ? `<button class="btn btn-outline btn-sm grow" data-ss="LEFT" data-id="${s.id}">Remove</button>` : ''}${s.user ? `<button class="btn btn-outline btn-sm" data-go="/chat/${s.user.id}">💬</button>` : ''}</div></div>`).join('') : empty('👥', 'Enrol doctors, nurses and staff by email. They join with their N-Health account.');
  };
  $('#add', el).onclick = () => formModal('➕ Enrol staff', [{ name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'phone', label: 'Phone', type: 'tel' }, { name: 'staffRole', label: 'Role', type: 'select', options: [['DOCTOR', 'Doctor'], ['NURSE', 'Nurse'], ['PHARMACIST', 'Pharmacist'], ['LAB_SCIENTIST', 'Lab scientist'], ['ADMIN', 'Administrator'], ['OTHER', 'Other']] }, { name: 'title', label: 'Title', placeholder: 'Consultant Cardiologist' }, { name: 'departmentId', label: 'Department', type: 'select', options: [['', '—'], ...depts.map((d) => [d.id, d.name])] }], { submit: 'Send invitation', onSubmit: async (v) => { await post('/institution/staff', { ...v, departmentId: v.departmentId || undefined }); toast('✉️ Invitation sent'); load(); } });
  el.addEventListener('click', async (e) => { const b = e.target.closest('[data-ss]'); if (b && (b.dataset.ss !== 'LEFT' || await confirmBox('Remove this staff member?', { danger: true, ok: 'Remove' }))) { await patch('/institution/staff/' + b.dataset.id, { status: b.dataset.ss }).catch(toastErr); load(); } });
  load();
}

export async function institutionPatients(el, _p, q) {
  const depts = await get('/institution/departments');
  let status = q.status || '', qv = '';
  el.innerHTML = appBar({ title: '🛏️ Patients', back: '/institution/home', roleCls: 'institution-title', actions: '<button class="action" id="add" style="color:var(--institution-color)">+ Register</button>' }) + `<div class="form-group"><input id="q" placeholder="🔍 Name or MRN"></div><div class="hscroll mb8">${[['', 'All'], ['ADMITTED', 'Admitted'], ['OUTPATIENT', 'Outpatient'], ['DISCHARGED', 'Discharged'], ['REFERRED', 'Referred']].map(([k, l]) => `<span class="chip ${k === status ? 'active' : ''}" data-s="${k}">${l}</span>`).join('')}</div><div id="l">${skeleton(3)}</div>`;
  const load = async () => {
    const list = await get(`/institution/patients?status=${status}&q=${encodeURIComponent(qv)}`);
    $('#l', el).innerHTML = list.length ? card(list.map((p) => item({ icon: p.status === 'ADMITTED' ? '🛏️' : '🧑', title: esc(p.name) + ' <span class="muted small">' + esc(p.mrn) + '</span>', sub: [p.department?.name, p.bed ? 'Bed ' + p.bed : '', p.admittedAt ? 'Admitted ' + dateOnly(p.admittedAt) : '', p.dischargedAt ? 'Discharged ' + dateOnly(p.dischargedAt) : ''].filter(Boolean).map(esc).join(' • '), trailing: badge(p.status), attrs: `data-p='${esc(JSON.stringify(p))}'` })).join('')) : empty('🛏️', 'Register walk-ins, admissions and N-Health patients');
  };
  const deptOpts = [['', '—'], ...depts.map((d) => [d.id, d.name])];
  $('#add', el).onclick = () => formModal('➕ Register patient', [{ name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'N-Health email (links their app account)', type: 'email' }, { name: 'phone', label: 'Phone', type: 'tel' }, { name: 'mrn', label: 'MRN (blank = auto)' }, { name: 'status', label: 'Type', type: 'select', options: [['OUTPATIENT', 'Outpatient'], ['ADMITTED', 'Admit now']] }, { name: 'departmentId', label: 'Department', type: 'select', options: deptOpts }, { name: 'bed', label: 'Bed' }, { name: 'notes', label: 'Notes', type: 'textarea' }], { submit: 'Register', onSubmit: async (v) => { await post('/institution/patients', { ...v, departmentId: v.departmentId || undefined }); toast('✅ Registered'); load(); } });
  $$('[data-s]', el).forEach((c) => (c.onclick = () => { status = c.dataset.s; $$('[data-s]', el).forEach((x) => x.classList.toggle('active', x === c)); load(); }));
  let tmr; $('#q', el).oninput = (e) => { clearTimeout(tmr); qv = e.target.value; tmr = setTimeout(load, 300); };
  el.addEventListener('click', (e) => { const c = e.target.closest('[data-p]'); if (!c) return; const p = JSON.parse(c.dataset.p); formModal('🛏️ ' + esc(p.name), [{ name: 'status', label: 'Status', type: 'select', options: ['OUTPATIENT', 'ADMITTED', 'DISCHARGED', 'REFERRED'], value: p.status }, { name: 'departmentId', label: 'Department', type: 'select', options: deptOpts, value: p.departmentId || '' }, { name: 'bed', label: 'Bed', value: p.bed || '' }, { name: 'notes', label: 'Notes', type: 'textarea', value: p.notes || '' }], { onSubmit: async (v) => { await patch('/institution/patients/' + p.id, v); toast('✅ Updated'); load(); } }); });
  load();
}

export async function institutionReports(el) {
  let days = 30;
  el.innerHTML = appBar({ title: '📊 Reports', back: '/institution/home', roleCls: 'institution-title' }) + `<div class="hscroll mb8">${[7, 30, 90, 365].map((d) => `<span class="chip ${d === days ? 'active' : ''}" data-d="${d}">${d === 365 ? '1 year' : d + ' days'}</span>`).join('')}</div><div id="r">${skeleton(3)}</div>`;
  const load = async () => {
    const r = await get('/institution/reports?days=' + days);
    const max = Math.max(1, ...r.series.map((s) => s.admissions + s.outpatients + s.appointments));
    const sum = (k) => r.series.reduce((s, x) => s + x[k], 0);
    $('#r', el).innerHTML = `<div class="institution-stats">${istat(sum('admissions'), 'Admissions')}${istat(sum('discharges'), 'Discharges')}${istat(sum('outpatients'), 'Outpatients')}${istat(sum('appointments'), 'Appointments')}${istat(r.avgLengthOfStayDays + 'd', 'Avg stay')}${istat(money(r.appointmentRevenue).replace(/\.00$/, ''), 'Consult revenue')}</div>` +
      card(cardHead('📈 Daily activity') + (r.series.length ? `<div class="bars" role="img" aria-label="Daily activity">${r.series.map((s) => `<div title="${s.date}: ${s.admissions + s.outpatients + s.appointments}" style="height:${((s.admissions + s.outpatients + s.appointments) / max) * 100}%"></div>`).join('')}</div><div class="row between small muted"><span>${dateOnly(r.series[0].date)}</span><span>${dateOnly(r.series[r.series.length - 1].date)}</span></div>` : empty('📈', 'No activity in this period'))) +
      card(cardHead('🏢 Department occupancy') + (r.departments.length ? r.departments.map((d) => `<div class="mb8"><div class="row between small"><span>${esc(d.name)}</span><span>${d.occupancy}% • ${d.patients} patients</span></div><div class="progress-bar"><div class="fill ${d.occupancy > 90 ? 'warning' : 'success'}" style="width:${d.occupancy}%"></div></div></div>`).join('') : empty('🏢', 'No departments')));
  };
  $$('[data-d]', el).forEach((c) => (c.onclick = () => { days = +c.dataset.d; $$('[data-d]', el).forEach((x) => x.classList.toggle('active', x === c)); load(); }));
  load();
}

// =====================================================================
// ADMIN (quick view; the full console is the admin web app)
// =====================================================================
export async function adminHome(el) {
  const s = await get('/admin-ops/stats').catch(() => null);
  el.innerHTML = appBar({ title: brandTitle(), roleCls: 'admin-title' }) + welcome('Platform administration') + (s ? `<div class="provider-stats">${stat(s.users, 'Users')}${stat(s.pendingVerifications, 'To verify')}${stat(s.pendingCampaigns, 'Campaigns')}${stat(s.openTickets, 'Tickets')}</div>` : '') +
    card(`<p class="muted">Use the admin console for verification, KYC review, campaigns, payouts and catalogs.</p><a class="btn btn-admin btn-block mt8" href="${esc(import.meta.env.VITE_ADMIN_URL || 'https://admin.nhealth.com.ng')}" target="_blank" rel="noopener">Open admin console</a>`);
}
