import { get, post, patch, del, download } from '../lib/api.js';
import { state } from '../lib/store.js';
import { esc, $, $$, appBar, brandTitle, card, cardHead, item, avatar, badge, verifiedBadge, empty, skeleton, tabs, toast, toastErr, modal, formModal, confirmBox, busy, money, coins, dt, relDay, dateOnly, timeOnly, ago, locate, field, readForm, fileToDataUri, pickFile } from '../lib/ui.js';
import { on } from '../lib/realtime.js';
import { go } from '../lib/router.js';
import { createMap } from '../lib/map.js';
import { t } from '../lib/i18n.js';
import { loadBalance, payModal, reviewModal, emergencyNumbers } from './common.js';
import { BLOOD, ORGANS, GENOTYPES } from './data.js';

const upcoming = (a) => ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(a.status) && new Date(a.scheduledAt).getTime() > Date.now() - 2 * 3600e3;
let myPos = null;
async function pos() { if (myPos) return myPos; try { myPos = await locate({ timeout: 6000 }); } catch { myPos = null; } return myPos; }

// ================= HOME =================
export async function homeScreen(el) {
  const u = state.user;
  el.innerHTML = appBar({ title: brandTitle() }) + `
    <div class="welcome-text">${t('Hello')}, 👋 ${esc(u.name.split(' ')[0])}</div>
    <div class="welcome-sub">Your complete health companion</div>
    <div class="balance-card"><div class="balance-label">Coins Balance</div><div class="balance-amount" id="bal">…</div>
      <div style="font-size:11px;opacity:.85;margin-top:2px" id="ins"></div>
      <div class="balance-actions"><button class="btn-primary" data-go="/patient/wallet">💰 Coins</button><button class="btn-outline" data-go="/patient/wallet?tab=history">📊 History</button></div></div>
    ${u.kycStatus !== 'APPROVED' ? '<div class="banner info">🪪 Verify your identity to unlock emergency dispatch, insurance and donations.<button class="btn btn-sm btn-primary" data-go="/kyc">Verify</button></div>' : ''}
    <div class="quick-actions">
      <div class="quick-action emergency" data-go="/patient/emergency" tabindex="0"><span class="icon">🚨</span><span class="label">${t('Emergency')}</span></div>
      <div class="quick-action" data-go="/patient/appointments" tabindex="0"><span class="icon">📅</span><span class="label">${t('Appointments')}</span></div>
      <div class="quick-action pharmacy-action" data-go="/patient/pharmacy" tabindex="0"><span class="icon">💊</span><span class="label">${t('Pharmacy')}</span></div>
      <div class="quick-action lab-action" data-go="/patient/labs" tabindex="0"><span class="icon">🔬</span><span class="label">${t('Labs')}</span></div>
      <div class="quick-action" data-go="/patient/providers" tabindex="0"><span class="icon">🏥</span><span class="label">${t('Providers')}</span></div>
      <div class="quick-action" data-go="/patient/donations" tabindex="0"><span class="icon">❤️</span><span class="label">${t('Donate')}</span></div>
      <div class="quick-action" data-go="/patient/insurance" tabindex="0"><span class="icon">🛡️</span><span class="label">${t('Insurance')}</span></div>
      <div class="quick-action" data-go="/messages" tabindex="0"><span class="icon">💬</span><span class="label">${t('Messages')}</span></div>
      <div class="quick-action nurse-action" data-go="/patient/providers?type=NURSE" tabindex="0"><span class="icon">👩‍⚕️</span><span class="label">Home care</span></div>
      <div class="quick-action" data-go="/patient/records" tabindex="0"><span class="icon">📁</span><span class="label">${t('Records')}</span></div>
      <div class="quick-action" data-go="/patient/records?tab=reminders" tabindex="0"><span class="icon">⏰</span><span class="label">Reminders</span></div>
      <div class="quick-action institution-action" data-go="/patient/institutions" tabindex="0"><span class="icon">🏨</span><span class="label">Facilities</span></div>
    </div>
    <div id="up">${skeleton(1)}</div><div id="rem"></div><div id="rx"></div><div id="fac"></div><div id="tip"></div>`;
  loadBalance().then((b) => { $('#bal', el) && ($('#bal', el).textContent = '🪙 ' + coins(b)); });
  get('/patient/insurance').then((p) => { const a = p.find((x) => x.status === 'ACTIVE'); $('#ins', el) && ($('#ins', el).innerHTML = a ? `<span class="badge" style="background:rgba(255,255,255,.2);color:#fff">✓ ${esc(a.plan?.name || a.provider)} Active</span>` : ''); }).catch(() => null);
  get('/patient/appointments').then((list) => {
    const up = list.filter(upcoming).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)).slice(0, 3);
    $('#up', el).innerHTML = card(cardHead('📋 Upcoming', '<a class="link" data-go="/patient/appointments">See All</a>') + (up.length ? up.map((a) => item({ avatarHtml: avatar('DOCTOR', a.doctor.user.avatarUrl), title: 'Dr. ' + esc(a.doctor.user.name), sub: esc(a.doctor.specialty) + ' • ' + relDay(a.scheduledAt), trailing: badge(a.status), attrs: 'data-go="/patient/appointments"' })).join('') : empty('📅', 'No upcoming appointments', '<button class="btn btn-primary btn-sm" data-go="/patient/appointments?tab=book">Book now</button>')));
  }).catch(() => { $('#up', el).innerHTML = ''; });
  get('/health/reminders').then((r) => {
    const act = r.filter((x) => x.isActive);
    if (act.length) $('#rem', el).innerHTML = card(cardHead('⏰ Today\'s medication', '<a class="link" data-go="/patient/records?tab=reminders">Manage</a>') + act.slice(0, 3).map((x) => item({ icon: '💊', title: esc(x.medication), sub: esc(x.dosage || '') + ' • ' + x.times.join(', ') })).join(''));
  }).catch(() => null);
  get('/patient/prescriptions').then((rx) => {
    const a = rx.filter((x) => x.status === 'ACTIVE').slice(0, 2);
    if (a.length) $('#rx', el).innerHTML = card(cardHead('💊 Prescriptions', '<a class="link" data-go="/patient/pharmacy?tab=rx" style="color:var(--pharmacy-color)">Order</a>') + a.map((x) => item({ avatarHtml: '<div class="avatar pharmacy-avatar">💊</div>', title: esc((x.medications || []).map((m) => m.name).join(', ')), sub: 'Dr. ' + esc(x.doctor?.user?.name || '') + ' • ' + dateOnly(x.issuedAt), attrs: 'data-go="/patient/pharmacy?tab=rx"' })).join(''), 'style="border:2px solid var(--pharmacy-color)"');
  }).catch(() => null);
  pos().then((p) => get('/directory?type=INSTITUTION&sort=distance' + (p ? `&lat=${p.lat}&lng=${p.lng}` : ''))).then((f) => {
    if (f.length) $('#fac', el).innerHTML = card(cardHead('🏥 Find Facility', '<a class="link" data-go="/patient/institutions" style="color:var(--institution-color)">Search</a>') + f.slice(0, 2).map((x) => item({ avatarHtml: '<div class="avatar institution-avatar">🏥</div>', title: esc(x.name), sub: (x.distanceKm != null ? '📍 ' + x.distanceKm + ' km • ' : '') + (x.rating ? '⭐ ' + x.rating : esc(x.title)), trailing: verifiedBadge(x.verified), attrs: `data-go="/provider/${x.userId}"` })).join(''), 'style="border:2px solid var(--institution-color)"');
  }).catch(() => null);
  get('/articles').then((a) => { if (a[0]) $('#tip', el).innerHTML = card(item({ icon: '💡', title: esc(a[0].title), sub: esc(a[0].summary), attrs: `data-go="/articles/${a[0].slug}"` })); }).catch(() => null);
}

// ================= COINS (wallet) =================
export async function walletScreen(el, _p, q) {
  const cfg = state.config || {};
  const gws = cfg.gateways || [];
  const pending = sessionStorage.getItem('nh_topup');
  el.innerHTML = appBar({ title: '💰 Coins', back: '/patient/home' }) + `
    <div class="balance-card"><div class="balance-label">Available coins</div><div class="balance-amount" id="bal">…</div><div class="small" style="opacity:.8">1 coin = ₦1 • for healthcare services on N-Health</div></div>
    ${pending ? '<div class="banner info" id="pend">⏳ Confirming your payment…</div>' : ''}
    ${tabs([['fund', '💰 Top up'], ['history', '📊 History']], q.tab === 'history' ? 'history' : 'fund')}
    <div id="fund" class="${q.tab === 'history' ? 'hidden' : ''}">${card(`
      <div class="form-group"><label>Amount (₦)</label><input type="number" id="amt" min="100" max="500000" inputmode="numeric" placeholder="e.g. 5000" value="${esc(q.amount || '')}"></div>
      <div class="row wrap mb8">${[2000, 5000, 10000, 20000, 50000].map((v) => `<span class="chip" data-amt="${v}">${money(v, { convert: false })}</span>`).join('')}</div>
      <div class="card-title" style="font-size:13px;margin-bottom:6px">Payment gateway</div>
      ${gws.length ? `<div class="payment-options">${gws.map((g, i) => `<div class="payment-option ${i === 0 ? 'selected' : ''}" data-gw="${g}"><div class="icon">${g === 'paystack' ? '🟦' : g === 'flutterwave' ? '🟧' : '💳'}</div><div class="label">${g[0].toUpperCase() + g.slice(1)}</div></div>`).join('')}</div>` : '<div class="banner warn">Online top-up is being activated. Please check back shortly.</div>'}
      <div class="card-title" style="font-size:13px;margin:8px 0 6px">Payment method</div>
      <div class="payment-options">${[['card', '💳', 'Card'], ['bank_transfer', '🏦', 'Transfer'], ['ussd', '📱', 'USSD']].map(([k, i, l], n) => `<div class="payment-option ${n === 0 ? 'selected' : ''}" data-pm="${k}"><div class="icon">${i}</div><div class="label">${l}</div></div>`).join('')}</div>
      <button class="btn btn-primary btn-block mt8" id="pay" ${gws.length ? '' : 'disabled'}>Proceed to Pay</button>
      <p class="muted small center mt8">🔒 Secured by licensed payment partners. N-Health never sees your card.</p>`)}</div>
    <div id="history" class="${q.tab === 'history' ? '' : 'hidden'}">${skeleton(3)}</div>`;
  const refresh = async () => {
    const b = await loadBalance(); $('#bal', el).textContent = '🪙 ' + coins(b);
    const tx = await get('/credits/transactions').catch(() => []);
    $('#history', el).innerHTML = card(cardHead('📊 Transaction History') + (tx.length ? tx.map((x) => item({
      avatarHtml: `<div class="avatar" style="background:${Number(x.amount) >= 0 ? '#E6F4EA;color:var(--success)' : '#FCE8E6;color:var(--error)'}">${Number(x.amount) >= 0 ? '📥' : '📤'}</div>`,
      title: esc(x.description), sub: dt(x.createdAt) + ' • ' + esc(x.reference), trailing: `<span style="color:${Number(x.amount) >= 0 ? 'var(--success)' : 'var(--error)'};font-weight:600">${Number(x.amount) >= 0 ? '+' : ''}${coins(x.amount)}</span>`,
    })).join('') : empty('📊', 'No transactions yet')));
  };
  refresh();
  let gw = gws[0], pm = 'card';
  $$('[data-tab]', el).forEach((tb) => (tb.onclick = () => { $$('[data-tab]', el).forEach((x) => x.classList.toggle('active', x === tb)); $('#fund', el).classList.toggle('hidden', tb.dataset.tab !== 'fund'); $('#history', el).classList.toggle('hidden', tb.dataset.tab !== 'history'); }));
  $$('[data-amt]', el).forEach((c) => (c.onclick = () => { $('#amt', el).value = c.dataset.amt; }));
  $$('[data-gw]', el).forEach((c) => (c.onclick = () => { gw = c.dataset.gw; $$('[data-gw]', el).forEach((x) => x.classList.toggle('selected', x === c)); }));
  $$('[data-pm]', el).forEach((c) => (c.onclick = () => { pm = c.dataset.pm; $$('[data-pm]', el).forEach((x) => x.classList.toggle('selected', x === c)); }));
  $('#pay', el).onclick = (e) => busy(e.target, async () => {
    const amount = Number($('#amt', el).value);
    if (!(amount >= 100)) throw new Error('Minimum top-up is ₦100');
    const r = await post('/credits/purchase/initiate', { amount, gateway: gw, currency: 'NGN', channel: pm, returnUrl: location.origin + '/' });
    sessionStorage.setItem('nh_topup', r.internalRef);
    if (r.checkoutUrl) location.href = r.checkoutUrl;
    else throw new Error('Checkout is unavailable for this gateway right now');
  });
  if (pending) {
    // Returning from the gateway: the server verifies with the gateway before adding coins.
    for (let i = 0; i < 8; i++) {
      try { await post('/credits/purchase/confirm', { internalRef: pending }); sessionStorage.removeItem('nh_topup'); $('#pend', el)?.remove(); toast('✅ Coins added'); refresh(); break; }
      catch (err) { if (err.status !== 402 || i === 7) { $('#pend', el) && ($('#pend', el).innerHTML = '⏳ Payment not confirmed yet. If you were debited, coins will appear automatically within minutes.'); if (err.status !== 402) sessionStorage.removeItem('nh_topup'); break; } await new Promise((r) => setTimeout(r, 3000)); }
    }
  }
}

// ================= EMERGENCY =================
const NUM_LABEL = { 112: 'National Emergency', 767: 'Lagos State Emergency', 199: 'Police / Fire', 911: 'Emergency Services', 999: 'Emergency Services', 10177: 'Ambulance', 193: 'Ambulance' };
export async function emergencyScreen(el) {
  const nums = emergencyNumbers();
  el.innerHTML = appBar({ title: '🚨 Emergency', back: '/patient/home', danger: true, actions: null }) + `<div id="body">${skeleton(2)}</div>
    ${card(cardHead('📞 Emergency Contacts') + nums.map((n) => `<a href="tel:${n}" style="text-decoration:none;color:inherit">${item({ icon: '📞', title: NUM_LABEL[n] || 'Emergency line', sub: n + ' • Toll free, 24/7', trailing: '<span style="color:var(--primary)">Call</span>' })}</a>`).join(''))}
    ${card(item({ icon: '🆘', title: 'My Emergency Medical ID', sub: 'QR card with blood group, allergies & contacts for first responders', attrs: 'data-go="/patient/records?tab=card"' }) + item({ icon: '🩹', title: 'First aid while help is on the way', attrs: 'data-go="/articles/first-aid-emergencies"' }))}`;
  let map = null, offs = [];
  const draw = async () => {
    const list = await get('/patient/emergency').catch(() => []);
    const active = list.find((r) => ['REQUESTED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED'].includes(r.status));
    const body = $('#body', el);
    if (!active) {
      const bal = await loadBalance();
      const min = state.config?.emergencyMinBalance ?? 5000;
      body.innerHTML = card(`<div style="text-align:center;font-size:40px">🚨</div><h3 style="text-align:center;color:var(--emergency-red);font-size:16px">Emergency Service</h3>
        <p class="center muted">Alerts the nearest ambulances & on-call doctors with your live location, and texts your emergency contact.</p>
        <p class="center small ${bal < min ? '' : 'muted'}" style="${bal < min ? 'color:var(--error)' : ''}">Minimum balance of ${money(min)} required • You have 🪙 ${coins(bal)}</p>
        <div class="form-group mt8"><select id="etype"><option value="MEDICAL">🩺 Medical emergency</option><option value="ACCIDENT">🚗 Accident / injury</option><option value="MATERNITY">🤰 Labour / maternity</option><option value="CARDIAC">❤️ Chest pain / cardiac</option><option value="BREATHING">🫁 Breathing difficulty</option><option value="OTHER">Other</option></select></div>
        <div class="form-group"><input id="enotes" placeholder="What's happening? (optional)"></div>
        <button class="btn btn-danger btn-block pulse" id="req" style="font-size:14px;padding:14px">🚨 Request Emergency Help</button>
        ${bal < min ? '<button class="btn btn-outline btn-block mt8" data-go="/patient/wallet">Top up coins</button>' : ''}`, 'style="border:2px solid var(--emergency-red);background:#FFF5F5"');
      $('#req', body).onclick = (e) => busy(e.target, async () => {
        toast('📍 Getting your location…');
        const p = await locate({ timeout: 12000 }).catch((err) => { throw new Error(err.message + '. Call ' + nums[0] + ' now.'); });
        await post('/patient/emergency', { lat: p.lat, lng: p.lng, type: $('#etype', body).value, notes: $('#enotes', body).value || undefined, contactPhone: state.user.phone || undefined });
        if (navigator.vibrate) navigator.vibrate(200);
        toast('🚑 Help requested - nearby ambulances alerted');
        draw();
      });
      return;
    }
    const steps = ['REQUESTED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED'];
    const idx = steps.indexOf(active.status);
    body.innerHTML = card(`<div class="row"><div style="font-size:28px">${active.status === 'REQUESTED' ? '⏳' : '🚑'}</div><div class="grow">
        <div style="font-weight:600;font-size:14px">${active.status === 'REQUESTED' ? 'Finding the nearest ambulance…' : active.status === 'ARRIVED' ? 'Ambulance has arrived' : 'Ambulance on the way'}</div>
        <div class="muted">Requested ${ago(active.requestedAt)}${active.etaMinutes ? ' • ⏱️ ETA ' + active.etaMinutes + ' min' : ''}</div></div></div>
        <div class="progress-bar mt8"><div class="fill success" style="width:${((idx + 1) / steps.length) * 100}%"></div></div>
        <div class="row between small muted mt8">${['Sent', 'Accepted', 'En route', 'Arrived'].map((s, i) => `<span style="${i <= idx ? 'color:var(--success);font-weight:600' : ''}">${s}</span>`).join('')}</div>
        <div class="map" id="emap"></div>
        <div class="row"><a class="btn btn-danger btn-sm grow" href="tel:${nums[0]}">📞 Call ${nums[0]}</a><button class="btn btn-outline btn-sm grow" id="cancel" style="border-color:var(--error);color:var(--error)">Cancel request</button></div>`, 'style="border:2px solid var(--success)"');
    $('#cancel', body).onclick = async () => { if (await confirmBox('Cancel the emergency request?', { ok: 'Yes, cancel', danger: true })) { await post('/patient/emergency/' + active.id + '/cancel').catch(toastErr); draw(); } };
    try {
      map?.destroy();
      map = await createMap($('#emap', body), [active.lat, active.lng], 14);
      map.setMarker('me', active.lat, active.lng, '📍', 'You');
      map.fit();
    } catch { /* map optional */ }
  };
  await draw();
  offs = [
    on('emergency:accepted', (d) => { toast('🚑 Ambulance accepted' + (d.etaMinutes ? ' - ETA ' + d.etaMinutes + ' min' : '')); draw().then(() => d.ambulance?.lat && map?.setMarker('amb', d.ambulance.lat, d.ambulance.lng, '🚑', d.ambulance.vehicleNumber)); }),
    on('emergency:status', () => draw()),
    on('ambulance:location', (d) => { map?.setMarker('amb', d.lat, d.lng, '🚑', 'Ambulance'); map?.fit(); }),
  ];
  return () => { offs.forEach((f) => f()); map?.destroy(); };
}

// ================= APPOINTMENTS =================
export async function appointmentsScreen(el, _p, q) {
  let tab = q.tab || 'upcoming';
  el.innerHTML = appBar({ title: '📅 Appointments', back: '/patient/home', actions: '<button class="action" id="new">+ New</button>' }) + tabs([['upcoming', 'Upcoming'], ['book', 'Book'], ['history', 'History']], tab) + '<div id="tb"></div>';
  $('#new', el).onclick = () => switchTab('book');
  const switchTab = (k) => { tab = k; $$('[data-tab]', el).forEach((x) => x.classList.toggle('active', x.dataset.tab === k)); draw(); };
  $$('[data-tab]', el).forEach((x) => (x.onclick = () => switchTab(x.dataset.tab)));
  const draw = async () => {
    const tb = $('#tb', el);
    tb.innerHTML = skeleton(3);
    if (tab === 'book') return bookList(tb);
    const list = await get('/patient/appointments');
    const shown = tab === 'upcoming' ? list.filter(upcoming).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)) : list.filter((a) => !upcoming(a));
    tb.innerHTML = shown.length ? shown.map((a) => card(`${item({ avatarHtml: avatar('DOCTOR', a.doctor.user.avatarUrl), title: 'Dr. ' + esc(a.doctor.user.name), sub: esc(a.doctor.specialty) + ' • ' + relDay(a.scheduledAt), trailing: badge(a.status) })}
      ${a.reason ? `<div class="muted small">Reason: ${esc(a.reason)}</div>` : ''}${a.notes ? `<div class="banner info">📝 ${esc(a.notes)}</div>` : ''}${a.cancelReason ? `<div class="muted small">Cancelled: ${esc(a.cancelReason)}</div>` : ''}
      <div class="kv"><span class="k">Fee</span><span class="v">${money(Number(a.fee) + Number(a.serviceFee) || a.doctor.consultationFee)} • ${badge(a.paymentStatus === 'UNPAID' ? 'UNPAID' : 'PAID', a.paymentStatus.replace('_', ' ').toLowerCase())}</span></div>
      <div class="row wrap mt8">
        ${tab === 'upcoming' && a.paymentStatus === 'UNPAID' && a.status !== 'CANCELLED' ? `<button class="btn btn-primary btn-sm" data-pay="${a.id}" data-amt="${Number(a.fee) + Number(a.serviceFee) || a.doctor.consultationFee}">💳 Pay</button>` : ''}
        <button class="btn btn-outline btn-sm" data-go="/chat/${a.doctor.userId}">💬 Message</button>
        ${tab === 'upcoming' ? `<button class="btn btn-outline btn-sm" data-resch="${a.id}" data-doc="${a.doctor.userId}">🔁 Reschedule</button><button class="btn btn-danger btn-sm" data-cancel="${a.id}">✕ Cancel</button>` : ''}
        ${a.status === 'COMPLETED' ? `<button class="btn btn-outline btn-sm" data-rev="${a.id}" data-name="Dr. ${esc(a.doctor.user.name)}">⭐ Review</button><button class="btn btn-outline btn-sm" data-go="/provider/${a.doctor.userId}">Book again</button>` : ''}
      </div>`)).join('') : empty(tab === 'upcoming' ? '📅' : '📋', tab === 'upcoming' ? 'No upcoming appointments' : 'No past appointments', tab === 'upcoming' ? '<button class="btn btn-primary btn-sm" id="gob">Book an appointment</button>' : '');
    $('#gob', tb)?.addEventListener('click', () => switchTab('book'));
  };
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-pay],[data-cancel],[data-resch],[data-rev]');
    if (!b) return;
    if (b.dataset.pay) { if (await payModal({ payableType: 'APPOINTMENT', payableId: b.dataset.pay, amount: Number(b.dataset.amt), title: 'Consultation' })) draw(); }
    if (b.dataset.cancel) formModal('Cancel appointment', [{ name: 'reason', label: 'Reason', type: 'select', options: ['Schedule conflict', 'Feeling better', 'Found another provider', 'Cost', 'Other'] }], { submit: 'Cancel appointment', intro: '<p class="muted mb8">Cancelling 12+ hours before the visit refunds your coins in full.</p>', onSubmit: async (v) => { await post('/patient/appointments/' + b.dataset.cancel + '/cancel', v); toast('Appointment cancelled'); draw(); } });
    if (b.dataset.resch) slotPicker(b.dataset.doc, async (iso) => { await post('/patient/appointments/' + b.dataset.resch + '/reschedule', { scheduledAt: iso }); toast('✅ Rescheduled'); draw(); });
    if (b.dataset.rev) reviewModal({ contextType: 'APPOINTMENT', contextId: b.dataset.rev, name: b.dataset.name });
  });
  draw();
}

async function bookList(tb) {
  tb.innerHTML = card(cardHead('📍 Find a Provider') + `<div class="form-group"><input id="bq" placeholder="🔍 Search by name, specialty, hospital…"></div><div id="bl">${skeleton(3)}</div>`);
  const load = async (qv = '') => {
    const p = await pos();
    const list = await get('/directory?type=DOCTOR&q=' + encodeURIComponent(qv) + (p ? `&lat=${p.lat}&lng=${p.lng}` : ''));
    $('#bl', tb).innerHTML = list.length ? list.map((d) => item({ avatarHtml: avatar('DOCTOR', d.avatarUrl), title: 'Dr. ' + esc(d.name), sub: `${esc(d.title)} • ${money(d.fee)} • ⭐ ${d.rating || 'New'}${d.distanceKm != null ? ' • ' + d.distanceKm + ' km' : ''}`, trailing: verifiedBadge(d.verified), attrs: `data-go="/book/${d.userId}"` })).join('') : empty('🔍', 'No doctors found');
  };
  let tmr; $('#bq', tb).oninput = (e) => { clearTimeout(tmr); tmr = setTimeout(() => load(e.target.value), 300); };
  load();
}

/** Calendar (mockup calendar-grid) + time slots for a provider. Calls onPick(isoStart). */
function slotPicker(userId, onPick) {
  modal(`<div class="modal-title">📅 Pick a new time</div><div id="sp"></div>`, (box, close) => calendar($('#sp', box), userId, async (iso) => { try { await onPick(iso); close(); } catch (e) { toastErr(e); } }));
}
async function calendar(host, userId, onPick, { button = 'Confirm time' } = {}) {
  let month = new Date(); month.setDate(1);
  let days = [], sel = null, slot = null;
  const today = new Date().toISOString().slice(0, 10);
  const r = await get(`/availability/${userId}/days?from=${today}&days=60`).catch(() => ({ days: [] }));
  days = r.days || [];
  const draw = async () => {
    const y = month.getFullYear(), m = month.getMonth();
    const first = new Date(y, m, 1).getDay(), n = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first; i++) cells.push('<div></div>');
    for (let d = 1; d <= n; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const has = days.includes(ds), past = ds < today;
      cells.push(`<div class="day ${past || !has ? 'disabled' : 'has-slots'} ${sel === ds ? 'selected' : ''}" data-d="${ds}">${d}</div>`);
    }
    host.innerHTML = `<div class="row between mb8"><button class="link" id="pm">‹</button><b style="font-size:13px">${month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</b><button class="link" id="nm">›</button></div>
      <div class="calendar-grid">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => `<div class="day-header">${d}</div>`).join('')}${cells.join('')}</div>
      ${!days.length ? '<div class="banner warn mt8">This provider hasn\'t opened their calendar yet. Message them to arrange a time.</div>' : ''}
      <div id="ts" class="mt12"></div>`;
    $('#pm', host).onclick = () => { month.setMonth(month.getMonth() - 1); draw(); };
    $('#nm', host).onclick = () => { month.setMonth(month.getMonth() + 1); draw(); };
    $$('.day.has-slots', host).forEach((c) => (c.onclick = () => { sel = c.dataset.d; slot = null; draw(); }));
    if (sel) {
      const s = await get(`/availability/${userId}/slots?date=${sel}`);
      const free = s.slots.filter((x) => x.available);
      $('#ts', host).innerHTML = `<div style="font-size:13px;font-weight:500;margin-bottom:4px">Available Times</div><div class="time-slots">${free.map((x) => `<div class="slot ${slot === x.start ? 'selected' : ''}" data-s="${x.start}">${timeOnly(x.start)}</div>`).join('') || '<span class="muted">Fully booked</span>'}</div>${slot ? `<button class="btn btn-primary btn-block mt12" id="ok">${button}</button>` : ''}`;
      $$('[data-s]', host).forEach((c) => (c.onclick = () => { slot = c.dataset.s; draw(); }));
      $('#ok', host)?.addEventListener('click', (e) => busy(e.target, () => onPick(slot)));
    }
  };
  draw();
}

export async function bookScreen(el, { userId }) {
  const d = await get('/directory/' + userId);
  const fee = d.fee || 0, pct = state.config?.serviceFeePercent ?? 5;
  el.innerHTML = appBar({ title: '📅 Book Appointment', back: true }) + card(`<div class="provider-confirmation">${avatar('DOCTOR', d.avatarUrl)}<div class="info"><div class="name">Dr. ${esc(d.name)} ${verifiedBadge(d.verified)}</div><div class="detail">${esc(d.title)} • ⭐ ${d.rating || 'New'} (${d.reviewCount || 0}) • ${esc(d.location || '')}</div></div></div>`) +
    card(cardHead('📅 Select Date & Time') + '<div id="cal"></div>') + '<div id="sum"></div>';
  calendar($('#cal', el), userId, async (iso) => {
    $('#sum', el).innerHTML = card(`<div class="booking-summary">
      <div class="item"><span class="label">Provider</span><span class="value">Dr. ${esc(d.name)}</span></div>
      <div class="item"><span class="label">Specialty</span><span class="value">${esc(d.title)}</span></div>
      <div class="item"><span class="label">Date</span><span class="value">${dateOnly(iso)}</span></div>
      <div class="item"><span class="label">Time</span><span class="value">${timeOnly(iso)}</span></div>
      <div class="item"><span class="label">Consultation Fee</span><span class="value">${money(fee)}</span></div>
      <div class="item"><span class="label">Service Fee (${pct}%)</span><span class="value">${money(fee * pct / 100)}</span></div>
      <div class="total">Total: ${money(fee * (1 + pct / 100))}</div></div>
      <div class="form-group mt8"><label>Reason for visit</label><textarea id="reason" rows="2" placeholder="Briefly describe your symptoms"></textarea></div>
      <button class="btn btn-primary btn-block" id="confirm">Proceed to Payment</button>`);
    $('#confirm', el).onclick = (e) => busy(e.target, async () => {
      const a = await post('/patient/appointments', { doctorId: d.profileId, scheduledAt: iso, reason: $('#reason', el).value || undefined });
      toast('✅ Appointment requested');
      await payModal({ payableType: 'APPOINTMENT', payableId: a.id, amount: Number(a.fee) + Number(a.serviceFee), title: 'Consultation with Dr. ' + d.name });
      go('/patient/appointments', { replace: true });
    });
    $('#sum', el).scrollIntoView({ behavior: 'smooth' });
  }, { button: 'Continue' });
}

// ================= PROVIDERS & FACILITIES =================
const TYPES = [['ALL', 'All'], ['DOCTOR', '👨‍⚕️ Doctors'], ['NURSE', '👩‍⚕️ Nurses'], ['PHARMACY', '💊 Pharmacies'], ['LAB', '🔬 Labs'], ['AMBULANCE', '🚑 Ambulance'], ['INSTITUTION', '🏥 Facilities']];
export async function providersScreen(el, _p, q, facilitiesOnly = false) {
  let type = facilitiesOnly ? 'INSTITUTION' : q.type || 'ALL', sort = 'rating', qv = '';
  el.innerHTML = appBar({ title: facilitiesOnly ? '🏥 Facilities' : '🏥 Providers', back: '/patient/home' }) +
    `<div class="form-group"><input id="pq" placeholder="🔍 Search name, specialty, hospital…"></div>
    ${facilitiesOnly ? '' : `<div class="hscroll">${TYPES.map(([k, l]) => `<span class="chip ${k === type ? 'active' : ''}" data-t="${k}">${l}</span>`).join('')}</div>`}
    <div class="row between mb8"><span class="muted" id="cnt"></span><select id="sort" style="border:none;background:none;font-size:12px;color:var(--primary)"><option value="rating">Top rated</option><option value="distance">Nearest</option><option value="fee">Lowest fee</option></select></div>
    <div id="pl">${skeleton(4)}</div>`;
  const load = async () => {
    const p = sort === 'distance' ? await pos() : myPos;
    const list = await get(`/directory?type=${type}&q=${encodeURIComponent(qv)}&sort=${sort}` + (p ? `&lat=${p.lat}&lng=${p.lng}` : ''));
    $('#cnt', el).textContent = list.length + ' found';
    $('#pl', el).innerHTML = list.length ? list.map((x) => x.role === 'INSTITUTION'
      ? `<div class="facility-card" data-go="/provider/${x.userId}"><div class="facility-header"><div><div class="facility-name">${esc(x.name)}</div><div class="facility-type">${esc(x.title)}</div></div>${verifiedBadge(x.verified)}</div><div class="facility-stats"><span>📍 ${esc(x.location || '—')}</span>${x.distanceKm != null ? `<span>${x.distanceKm} km</span>` : ''}<span>⭐ ${x.rating || 'New'}</span>${x.beds != null ? `<span>🛏️ ${x.beds} beds free</span>` : ''}${x.emergencyCare ? '<span>🚨 24h emergency</span>' : ''}</div></div>`
      : `<div class="provider-detail-card" data-go="/provider/${x.userId}"><div class="row">${avatar(x.role, x.avatarUrl)}<div class="grow"><div class="provider-name">${x.role === 'DOCTOR' ? 'Dr. ' : ''}${esc(x.name)} ${verifiedBadge(x.verified)}</div><div class="provider-specialty">${esc(x.title || '')}</div></div></div>
        <div class="provider-info"><div><span class="label">Rating</span> ⭐ ${x.rating || 'New'} (${x.reviewCount || 0})</div>${x.experience ? `<div><span class="label">Experience</span> ${x.experience} yrs</div>` : ''}${x.fee ? `<div><span class="label">Fee</span> ${money(x.fee)}</div>` : ''}${x.distanceKm != null ? `<div><span class="label">Distance</span> ${x.distanceKm} km</div>` : x.location ? `<div><span class="label">Location</span> ${esc(x.location)}</div>` : ''}</div></div>`).join('') : empty('🔍', 'No providers match your search');
  };
  $$('[data-t]', el).forEach((c) => (c.onclick = () => { type = c.dataset.t; $$('[data-t]', el).forEach((x) => x.classList.toggle('active', x === c)); load(); }));
  $('#sort', el).onchange = (e) => { sort = e.target.value; load(); };
  let tmr; $('#pq', el).oninput = (e) => { clearTimeout(tmr); qv = e.target.value; tmr = setTimeout(load, 300); };
  load();
}
export const institutionsScreen = (el, p, q) => providersScreen(el, p, q, true);

export async function providerDetailScreen(el, { userId }) {
  const d = await get('/directory/' + userId);
  const r = d.role;
  const call = d.phone ? `<a class="btn btn-outline btn-sm grow" href="tel:${esc(d.phone)}">📞 Call</a>` : '';
  const actions = {
    DOCTOR: `<button class="btn btn-primary btn-sm grow" data-go="/book/${d.userId}">📅 Book appointment</button>`,
    NURSE: `<button class="btn btn-nurse btn-sm grow" id="nurse">🩺 Request home care</button>`,
    PHARMACY: `<button class="btn btn-pharmacy btn-sm grow" data-go="/patient/pharmacy/${d.profileId}">💊 Shop</button>`,
    LAB: `<button class="btn btn-lab btn-sm grow" data-go="/patient/labs?lab=${d.profileId}">🔬 Book a test</button>`,
    AMBULANCE: `<button class="btn btn-danger btn-sm grow" data-go="/patient/emergency">🚨 Emergency</button>`,
    INSTITUTION: d.doctors?.length ? '<button class="btn btn-institution btn-sm grow" id="docs">👨‍⚕️ Our doctors</button>' : '',
  }[r] || '';
  el.innerHTML = appBar({ title: esc(d.name), back: true }) + card(`<div class="center">${avatar(r, d.avatarUrl).replace('class="avatar', 'style="width:72px;height:72px;font-size:32px;margin:0 auto 8px" class="avatar')}
      <div style="font-weight:700;font-size:16px">${r === 'DOCTOR' ? 'Dr. ' : ''}${esc(d.name)} ${verifiedBadge(d.verified)}</div><div class="muted">${esc(d.title || '')}</div>
      <div class="muted mt8">⭐ ${d.rating || 'New'} (${d.reviewCount || 0} reviews)${d.experience ? ' • ' + d.experience + ' yrs exp.' : ''}</div></div>
      ${d.bio || d.description ? `<p class="muted mt8">${esc(d.bio || d.description)}</p>` : ''}
      ${d.fee ? `<div class="kv"><span class="k">${r === 'NURSE' ? 'Hourly rate' : r === 'AMBULANCE' ? 'Base fee' : 'Consultation'}</span><span class="v">${money(d.fee)}</span></div>` : ''}
      ${d.qualifications ? `<div class="kv"><span class="k">Qualifications</span><span class="v">${esc(d.qualifications)}</span></div>` : ''}
      ${d.languages ? `<div class="kv"><span class="k">Languages</span><span class="v">${esc(d.languages)}</span></div>` : ''}
      ${d.location ? `<div class="kv"><span class="k">Location</span><span class="v">${esc(d.location)}</span></div>` : ''}
      ${d.hours ? `<div class="kv"><span class="k">Hours</span><span class="v">${esc(d.hours)}</span></div>` : ''}
      ${d.homeDelivery ? '<div class="kv"><span class="k">Delivery</span><span class="v">🛵 Available</span></div>' : ''}${d.homeCollection ? '<div class="kv"><span class="k">Home sample collection</span><span class="v">✅</span></div>' : ''}${d.homeVisit ? '<div class="kv"><span class="k">Home visits</span><span class="v">✅</span></div>' : ''}
      ${d.beds != null ? `<div class="kv"><span class="k">Beds available</span><span class="v">${d.beds}</span></div>` : ''}${d.emergencyCare ? '<div class="kv"><span class="k">Emergency care</span><span class="v">🚨 24 hours</span></div>' : ''}
      ${d.lat != null ? `<a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}">🧭 Get directions</a>` : ''}
      <div class="row wrap mt12">${actions}<button class="btn btn-outline btn-sm grow" data-go="/chat/${d.userId}">💬 Message</button>${call}</div>`) +
    (d.departments?.length ? card(cardHead('🏢 Departments') + d.departments.map((x) => item({ icon: '🏢', title: esc(x.name), sub: x.headName ? 'Head: ' + esc(x.headName) : '' })).join('')) : '') +
    (d.catalog?.length ? card(cardHead('🧪 Tests offered') + d.catalog.map((c) => item({ icon: '🧪', title: esc(c.name), sub: `${money(c.price)} • ⏱️ ${c.turnaroundHours}h${c.sampleType ? ' • ' + esc(c.sampleType) : ''}`, attrs: `data-go="/patient/labs?lab=${d.profileId}"` })).join('')) : '') +
    card(cardHead('⭐ Reviews') + (d.reviews?.length ? d.reviews.map((rv) => item({ icon: '⭐'.repeat(rv.rating).slice(0, 10), title: esc(rv.author?.name || 'Patient'), sub: esc(rv.comment || '') + ' • ' + ago(rv.createdAt) })).join('') : empty('⭐', 'No reviews yet')));
  $('#nurse', el)?.addEventListener('click', () => formModal('🩺 Request home care', [
    { name: 'serviceType', label: 'Service', type: 'select', options: ['Home nursing visit', 'Wound dressing', 'Injection / IV therapy', 'Post-surgery care', 'Elderly care', 'Newborn & mother care', 'Vital signs check', 'Other'] },
    { name: 'scheduledAt', label: 'When', type: 'datetime-local', required: true },
    { name: 'durationHours', label: 'Hours needed', type: 'number', value: 1, min: 1 },
    { name: 'address', label: 'Address', value: state.user.patientProfile?.address || '', required: true },
    { name: 'notes', label: 'Notes for the nurse', type: 'textarea' },
  ], { submit: 'Send request', onSubmit: async (v) => { await post('/patient/nurse-requests', { nurseId: d.profileId, serviceType: v.serviceType, scheduledAt: new Date(v.scheduledAt).toISOString(), notes: v.notes || undefined, address: v.address, durationHours: v.durationHours }); toast('✅ Request sent - the nurse will confirm'); } }));
  $('#docs', el)?.addEventListener('click', () => modal('<div class="modal-title">👨‍⚕️ Doctors</div>' + d.doctors.map((x) => item({ avatarHtml: avatar('DOCTOR', x.user.avatarUrl), title: 'Dr. ' + esc(x.user.name), sub: esc(x.specialty), attrs: `data-go="/book/${x.user.id}"` })).join('')));
}

// ================= PHARMACY =================
export async function pharmacyScreen(el, _p, q) {
  let tab = q.tab || 'shop';
  el.innerHTML = appBar({ title: '💊 Pharmacy', back: '/patient/home', actions: '<button class="action" data-go="/patient/orders" style="color:var(--pharmacy-color)">Orders</button>' }) + tabs([['shop', '🏪 Pharmacies'], ['rx', '📄 Prescriptions'], ['orders', '📦 Orders']], tab) + '<div id="tb"></div>';
  const draw = async () => {
    const tb = $('#tb', el); tb.innerHTML = skeleton(3);
    if (tab === 'shop') {
      const p = await pos();
      const list = await get('/directory?type=PHARMACY&sort=' + (p ? 'distance' : 'rating') + (p ? `&lat=${p.lat}&lng=${p.lng}` : ''));
      tb.innerHTML = `<div class="banner info">💡 Over-the-counter drugs can be bought directly. Prescription-only medicines need a prescription from your doctor.</div>` + (list.length ? card(list.map((x) => item({ avatarHtml: avatar('PHARMACY', x.avatarUrl), title: esc(x.name) + ' ' + verifiedBadge(x.verified), sub: `${x.distanceKm != null ? x.distanceKm + ' km • ' : ''}${esc(x.location || '')}${x.homeDelivery ? ' • 🛵 Delivery' : ''}`, trailing: '⭐ ' + (x.rating || 'New'), attrs: `data-go="/patient/pharmacy/${x.profileId}"` })).join('')) : empty('💊', 'No pharmacies yet in your area'));
    } else if (tab === 'rx') {
      const rx = await get('/patient/prescriptions');
      tb.innerHTML = rx.length ? rx.map((r) => card(`${item({ icon: '📄', title: 'Dr. ' + esc(r.doctor?.user?.name || ''), sub: dateOnly(r.issuedAt), trailing: badge(r.status) })}${(r.medications || []).map((m) => `<div class="kv"><span class="k">💊 ${esc(m.name)}</span><span class="v">${esc(m.dosage)} • ${esc(m.frequency)} • ${m.durationDays}d</span></div>`).join('')}
        <div class="row mt8"><button class="btn btn-pharmacy btn-sm grow" data-rxorder="${r.id}" data-ph="${r.pharmacyId || ''}">🛒 Order</button><button class="btn btn-outline btn-sm grow" data-rxpdf="${r.id}">⬇️ PDF</button><button class="btn btn-outline btn-sm grow" data-rxrem='${esc(JSON.stringify(r.medications || []))}' data-rx="${r.id}">⏰ Remind me</button></div>`)).join('') : empty('📄', 'No prescriptions yet');
    } else {
      const orders = await get('/patient/orders');
      tb.innerHTML = orders.length ? orders.map(orderCard).join('') : empty('📦', 'No orders yet');
    }
  };
  $$('[data-tab]', el).forEach((x) => (x.onclick = () => { tab = x.dataset.tab; $$('[data-tab]', el).forEach((y) => y.classList.toggle('active', y === x)); draw(); }));
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-rxorder],[data-rxpdf],[data-rxrem],[data-paor],[data-inv],[data-revo]');
    if (!b) return;
    if (b.dataset.rxpdf) download('/patient/prescriptions/' + b.dataset.rxpdf + '/pdf', 'prescription.pdf').catch(toastErr);
    if (b.dataset.rxorder) b.dataset.ph ? go(`/patient/pharmacy/${b.dataset.ph}?rx=${b.dataset.rxorder}`) : (toast('Choose a pharmacy, then add your prescribed items'), sessionStorage.setItem('nh_rx', b.dataset.rxorder), tab = 'shop', draw());
    if (b.dataset.rxrem) { const meds = JSON.parse(b.dataset.rxrem); for (const m of meds) await post('/health/reminders', { medication: m.name, dosage: m.dosage, times: /twice|bd|12/i.test(m.frequency) ? ['08:00', '20:00'] : /three|tds|8/i.test(m.frequency) ? ['07:00', '14:00', '21:00'] : ['08:00'], endDate: new Date(Date.now() + m.durationDays * 86400e3).toISOString(), prescriptionId: b.dataset.rx }).catch(toastErr); toast('⏰ Reminders created'); }
    if (b.dataset.paor) { if (await payModal({ payableType: 'PHARMACY_ORDER', payableId: b.dataset.paor, amount: Number(b.dataset.amt), title: 'Pharmacy order' })) draw(); }
    if (b.dataset.inv) download('/patient/orders/' + b.dataset.inv + '/invoice.pdf', 'invoice.pdf').catch(toastErr);
    if (b.dataset.revo) reviewModal({ contextType: 'PHARMACY_ORDER', contextId: b.dataset.revo, name: b.dataset.name });
  });
  draw();
}
const orderCard = (o) => card(`${item({ avatarHtml: '<div class="avatar pharmacy-avatar">📦</div>', title: esc(o.pharmacy?.pharmacyName || 'Pharmacy'), sub: dt(o.createdAt) + ' • ' + (o.deliveryMethod === 'DELIVERY' ? '🛵 Delivery' : '🏪 Pickup'), trailing: badge(o.status) })}
  ${(o.items || []).map((i) => `<div class="kv"><span class="k">${esc(i.name)} × ${i.qty}</span><span class="v">${money(i.qty * i.price)}</span></div>`).join('')}
  <div class="kv"><span class="k"><b>Total</b></span><span class="v"><b>${money(o.total)}</b> ${badge(o.paymentStatus)}</span></div>${o.declineReason ? `<div class="muted small">Reason: ${esc(o.declineReason)}</div>` : ''}
  <div class="row mt8">${o.paymentStatus !== 'PAID' && o.status === 'PENDING' ? `<button class="btn btn-pharmacy btn-sm grow" data-paor="${o.id}" data-amt="${o.total}">💳 Pay</button>` : ''}<button class="btn btn-outline btn-sm grow" data-inv="${o.id}">⬇️ Invoice</button>${o.status === 'DELIVERED' ? `<button class="btn btn-outline btn-sm grow" data-revo="${o.id}" data-name="${esc(o.pharmacy?.pharmacyName || '')}">⭐ Review</button>` : ''}<button class="btn btn-outline btn-sm grow" data-go="/chat/${o.pharmacy?.userId}">💬</button></div>`);

export async function ordersScreen(el) {
  el.innerHTML = appBar({ title: '📦 My Orders', back: '/patient/pharmacy' }) + `<div id="ol">${skeleton(3)}</div>`;
  const orders = await get('/patient/orders');
  $('#ol', el).innerHTML = orders.length ? orders.map(orderCard).join('') : empty('📦', 'No orders yet');
  el.onclick = async (e) => {
    const b = e.target.closest('[data-paor],[data-inv],[data-revo]'); if (!b) return;
    if (b.dataset.paor && await payModal({ payableType: 'PHARMACY_ORDER', payableId: b.dataset.paor, amount: Number(b.dataset.amt), title: 'Pharmacy order' })) ordersScreen(el);
    if (b.dataset.inv) download('/patient/orders/' + b.dataset.inv + '/invoice.pdf', 'invoice.pdf').catch(toastErr);
    if (b.dataset.revo) reviewModal({ contextType: 'PHARMACY_ORDER', contextId: b.dataset.revo, name: b.dataset.name });
  };
}

export async function storeScreen(el, { id }, q) {
  const [inv, rxList] = await Promise.all([get('/providers/pharmacies/' + id + '/inventory'), get('/patient/prescriptions').catch(() => [])]);
  const rxId = q.rx || sessionStorage.getItem('nh_rx') || '';
  sessionStorage.removeItem('nh_rx');
  const cartKey = 'nh_cart_' + id;
  let cart = {}; try { cart = JSON.parse(localStorage.getItem(cartKey) || '{}'); } catch { /* */ }
  const save = () => { try { localStorage.setItem(cartKey, JSON.stringify(cart)); } catch { /* */ } };
  const items = (Array.isArray(inv) ? inv : inv.items || []).filter((i) => !i.expiryDate || new Date(i.expiryDate) > new Date());
  el.innerHTML = appBar({ title: '💊 Shop', back: '/patient/pharmacy' }) + `<div class="form-group"><input id="sq" placeholder="🔍 Search drugs, brands…"></div><div id="pl"></div><div id="cart"></div>`;
  const stockBadge = (i) => (i.stock <= 0 ? '<span class="badge badge-outofstock">Out of Stock</span>' : i.stock <= (i.reorderLevel || 10) ? '<span class="badge badge-lowstock">Low Stock</span>' : '<span class="badge badge-instock">In Stock</span>');
  const drawList = (qv = '') => {
    const f = items.filter((i) => !qv || (i.name + ' ' + (i.brand || '') + ' ' + (i.category || '')).toLowerCase().includes(qv.toLowerCase()));
    $('#pl', el).innerHTML = f.length ? f.map((i) => `<div class="product-detail-card"><div class="row between"><div class="grow"><div class="product-name">${esc(i.name)} ${i.requiresPrescription ? '<span class="badge badge-warning">Rx</span>' : ''}</div><div class="product-generic">${esc(i.category || '')}</div></div>${stockBadge(i)}</div>
      <div class="product-details"><div><span class="label">Brand:</span> ${esc(i.brand || '—')}</div><div><span class="label">Manufacturer:</span> ${esc(i.manufacturer || '—')}</div><div><span class="label">Batch:</span> ${esc(i.batchNumber || '—')}</div><div><span class="label">Expiry:</span> ${i.expiryDate ? dateOnly(i.expiryDate) : '—'}</div></div>
      <div class="row between mt8"><span class="product-price">${money(i.price)}</span><span class="product-stock">${i.stock} ${esc(i.unit || 'units')}</span>${i.stock > 0 ? `<button class="btn btn-pharmacy btn-sm" data-add="${i.id}">+ Add</button>` : ''}</div></div>`).join('') : empty('💊', 'No products found');
  };
  const drawCart = () => {
    const lines = Object.entries(cart).map(([iid, qty]) => ({ i: items.find((x) => x.id === iid), qty })).filter((l) => l.i);
    if (!lines.length) { $('#cart', el).innerHTML = ''; return; }
    const total = lines.reduce((s, l) => s + l.qty * Number(l.i.price), 0);
    const needsRx = lines.some((l) => l.i.requiresPrescription);
    $('#cart', el).innerHTML = card(cardHead('🛒 Cart') + lines.map((l) => `<div class="pos-cart-item"><div class="item-info"><div class="item-name">${esc(l.i.name)}</div><div class="item-price">${money(l.i.price)}</div></div><div class="item-qty"><button data-dec="${l.i.id}">−</button><span class="qty">${l.qty}</span><button data-inc="${l.i.id}">+</button></div></div>`).join('') + `
      <div class="receipt-total">Total: ${money(total)}</div>
      ${needsRx ? `<div class="form-group mt8"><label>Prescription <span style="color:var(--error)">*</span></label><select id="rxsel"><option value="">— Select a prescription —</option>${rxList.map((r) => `<option value="${r.id}" ${r.id === rxId ? 'selected' : ''}>Dr. ${esc(r.doctor?.user?.name || '')} • ${dateOnly(r.issuedAt)} • ${esc((r.medications || []).map((m) => m.name).join(', ').slice(0, 40))}</option>`).join('')}</select></div>` : ''}
      <div class="form-group"><label>Delivery</label><select id="dm"><option value="PICKUP">🏪 Pick up at pharmacy</option><option value="DELIVERY">🛵 Deliver to me</option></select></div>
      <div class="form-group hidden" id="addrg"><input id="addr" placeholder="Delivery address" value="${esc(state.user.patientProfile?.address || '')}"></div>
      <button class="btn btn-pharmacy btn-block" id="checkout">Checkout ${money(total)}</button>`);
    $('#dm', el).onchange = (e) => $('#addrg', el).classList.toggle('hidden', e.target.value !== 'DELIVERY');
    $('#checkout', el).onclick = (e) => busy(e.target, async () => {
      const rx = $('#rxsel', el)?.value;
      if (needsRx && !rx) throw new Error('Select the prescription for prescription-only items');
      const o = await post('/patient/orders', { pharmacyId: id, prescriptionId: rx || undefined, deliveryMethod: $('#dm', el).value, deliveryAddress: $('#addr', el)?.value, items: lines.map((l) => ({ inventoryId: l.i.id, name: l.i.name, qty: l.qty, price: Number(l.i.price) })) });
      cart = {}; save();
      toast('✅ Order placed');
      await payModal({ payableType: 'PHARMACY_ORDER', payableId: o.id, amount: Number(o.total), title: 'Pharmacy order' });
      go('/patient/orders', { replace: true });
    });
  };
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-add],[data-inc],[data-dec]'); if (!a) return;
    const iid = a.dataset.add || a.dataset.inc || a.dataset.dec;
    const it = items.find((x) => x.id === iid);
    cart[iid] = Math.max(0, Math.min(it?.stock || 0, (cart[iid] || 0) + (a.dataset.dec ? -1 : 1)));
    if (!cart[iid]) delete cart[iid];
    save(); drawCart(); if (a.dataset.add) toast('🛒 Added ' + it.name);
  });
  let tmr; $('#sq', el).oninput = (e) => { clearTimeout(tmr); tmr = setTimeout(() => drawList(e.target.value), 200); };
  drawList(); drawCart();
}

// ================= LABS =================
export async function labsScreen(el, _p, q) {
  let tab = q.tab || 'book';
  el.innerHTML = appBar({ title: '🔬 Labs', back: '/patient/home' }) + tabs([['book', '🧪 Book a test'], ['results', '📋 My tests & results']], tab) + '<div id="tb"></div>';
  const draw = async () => {
    const tb = $('#tb', el); tb.innerHTML = skeleton(3);
    if (tab === 'book') {
      tb.innerHTML = `<div class="form-group"><input id="lq" placeholder="🔍 Search tests: CBC, Malaria, Lipid profile, Genotype…"></div><div class="hscroll mb8">${['CBC', 'Malaria', 'Lipid', 'Genotype', 'Blood group', 'HbA1c', 'Typhoid', 'Urinalysis', 'Pregnancy', 'COVID'].map((c) => `<span class="chip" data-lq="${c}">${c}</span>`).join('')}</div><div id="ll"></div>`;
      const load = async (qv = '') => {
        const list = await get('/labs/catalog?q=' + encodeURIComponent(qv) + (q.lab ? '&labId=' + q.lab : ''));
        $('#ll', tb).innerHTML = list.length ? list.map((c) => card(`${item({ avatarHtml: '<div class="avatar lab-avatar">🧪</div>', title: esc(c.name), sub: `${esc(c.lab.labName)} • ⏱️ ${c.turnaroundHours}h${c.lab.homeCollection ? ' • 🏠 home collection' : ''}`, trailing: `<b>${money(c.price)}</b>` })}${c.preparation ? `<div class="muted small">ℹ️ ${esc(c.preparation)}</div>` : ''}<button class="btn btn-lab btn-sm btn-block mt8" data-book='${esc(JSON.stringify({ id: c.id, labId: c.lab.id, name: c.name, price: c.price, home: c.lab.homeCollection, lab: c.lab.labName }))}'>Book test</button>`)).join('') : empty('🔬', 'No tests found');
      };
      let tmr; $('#lq', tb).oninput = (e) => { clearTimeout(tmr); tmr = setTimeout(() => load(e.target.value), 300); };
      $$('[data-lq]', tb).forEach((c) => (c.onclick = () => { $('#lq', tb).value = c.dataset.lq; load(c.dataset.lq); }));
      load();
    } else {
      const tests = await get('/patient/lab-tests');
      tb.innerHTML = tests.length ? tests.map((x) => card(`${item({ avatarHtml: '<div class="avatar lab-avatar">🔬</div>', title: esc(x.testType), sub: esc(x.lab?.labName || '') + ' • ' + dt(x.scheduledAt || x.createdAt), trailing: badge(x.status) })}
        ${x.result ? `<div class="banner ok">✅ Result ready</div>${(x.result.resultData?.results || []).map((r) => `<div class="kv"><span class="k">${esc(r.parameter)}</span><span class="v" style="color:${r.flag === 'HIGH' || r.flag === 'LOW' ? 'var(--error)' : 'inherit'}">${esc(r.value)} ${esc(r.unit || '')} ${r.referenceRange ? '<span class="muted">(' + esc(r.referenceRange) + ')</span>' : ''} ${r.flag && r.flag !== 'NORMAL' ? badge('FAILED', r.flag) : ''}</span></div>`).join('')}${x.result.resultData?.notes ? `<div class="muted small">${esc(x.result.resultData.notes)}</div>` : ''}` : ''}
        <div class="row mt8">${x.paymentStatus === 'UNPAID' && x.status !== 'CANCELLED' ? `<button class="btn btn-lab btn-sm grow" data-paylab="${x.id}" data-amt="${x.fee}">💳 Pay ${money(x.fee)}</button>` : ''}${x.result ? `<button class="btn btn-outline btn-sm grow" data-pdf="${x.id}">⬇️ Result PDF</button>` : ''}${x.status === 'COMPLETED' ? `<button class="btn btn-outline btn-sm grow" data-revl="${x.id}">⭐</button>` : ''}</div>`)).join('') : empty('🔬', 'No lab tests yet');
    }
  };
  $$('[data-tab]', el).forEach((x) => (x.onclick = () => { tab = x.dataset.tab; $$('[data-tab]', el).forEach((y) => y.classList.toggle('active', y === x)); draw(); }));
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-book],[data-paylab],[data-pdf],[data-revl]'); if (!b) return;
    if (b.dataset.book) {
      const c = JSON.parse(b.dataset.book);
      formModal('🔬 Book ' + esc(c.name), [
        { name: 'scheduledAt', label: 'Preferred date & time', type: 'datetime-local', required: true },
        ...(c.home ? [{ name: 'homeCollection', label: '🏠 Collect the sample at my home', type: 'checkbox' }, { name: 'address', label: 'Address (for home collection)', value: state.user.patientProfile?.address || '' }] : []),
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ], { submit: 'Book • ' + money(c.price), intro: `<p class="muted mb8">${esc(c.lab)}</p>`, onSubmit: async (v) => {
        const tst = await post('/patient/lab-tests', { labId: c.labId, catalogId: c.id, testType: c.name, scheduledAt: new Date(v.scheduledAt).toISOString(), homeCollection: !!v.homeCollection, address: v.address || undefined, notes: v.notes || undefined });
        toast('✅ Test booked');
        setTimeout(() => payModal({ payableType: 'LAB_TEST', payableId: tst.id, amount: Number(tst.fee), title: c.name }).then(() => { tab = 'results'; draw(); }), 50);
      } });
    }
    if (b.dataset.paylab && await payModal({ payableType: 'LAB_TEST', payableId: b.dataset.paylab, amount: Number(b.dataset.amt), title: 'Lab test' })) draw();
    if (b.dataset.pdf) download('/lab-results/' + b.dataset.pdf + '/pdf', 'lab-result.pdf').catch(toastErr);
    if (b.dataset.revl) reviewModal({ contextType: 'LAB_TEST', contextId: b.dataset.revl, name: 'the lab' });
  });
  draw();
}

// ================= DONATIONS =================
export async function donationsScreen(el, _p, q) {
  let tab = q.tab || 'blood';
  el.innerHTML = appBar({ title: '❤️ Donations', back: '/patient/home', actions: '<button class="action" id="start">+ Request</button>' }) +
    `<div class="hscroll">${[['blood', '🩸 Blood'], ['organ', '🫀 Organs'], ['fund', '💰 Funds'], ['patients', '🧒 Patients'], ['mine', '📋 My pledges']].map(([k, l]) => `<span class="chip ${k === tab ? 'active' : ''}" data-dt="${k}">${l}</span>`).join('')}</div><div id="tb"></div>`;
  const campaignCard = (c) => {
    const pct = Number(c.goalAmount) ? Math.min(100, Math.round((Number(c.raisedAmount) / Number(c.goalAmount)) * 100)) : 0;
    if (c.type === 'BLOOD' || c.type === 'ORGAN') return `<div class="blood-request-item" data-go="/donations/campaign/${c.id}"><div class="header"><span class="patient-name">${esc(c.title)}</span><span class="blood-type">${esc(c.bloodType || c.organ || '')}</span></div><div class="muted small">${esc(c.location || '')}${c.distanceKm != null ? ' • ' + c.distanceKm + ' km' : ''} • ${c.unitsPledged}/${c.unitsNeeded || '?'} pledged</div>${c.urgency !== 'NORMAL' ? badge('FAILED', c.urgency.toLowerCase()) : ''}</div>`;
    return card(`<div class="row between"><b style="font-size:14px">${esc(c.title)}</b>${c.urgency !== 'NORMAL' ? badge('FAILED', c.urgency.toLowerCase()) : ''}</div><div class="muted small">${esc(c.beneficiaryName || c.institution?.name || c.organizer?.name || '')}</div>
      <div class="progress-bar mt8"><div class="fill ${pct >= 100 ? 'success' : 'primary'}" style="width:${pct}%"></div></div><div class="row between small mt8"><span><b>${money(c.raisedAmount)}</b> raised</span><span class="muted">of ${money(c.goalAmount)} • ${c.donorCount} donors</span></div>
      <div class="row mt8"><button class="btn btn-primary btn-sm grow" data-don="${c.id}" data-title="${esc(c.title)}">❤️ Donate</button><button class="btn btn-outline btn-sm grow" data-go="/donations/campaign/${c.id}">Details</button></div>`, 'style="cursor:default"');
  };
  const draw = async () => {
    const tb = $('#tb', el); tb.innerHTML = skeleton(3);
    const p = myPos || (tab === 'blood' ? await pos() : null);
    const ll = p ? `&lat=${p.lat}&lng=${p.lng}` : '';
    if (tab === 'blood') {
      const [reqs, centers] = await Promise.all([get('/donations/campaigns?type=BLOOD' + ll), get('/donations/centers?type=BLOOD' + ll)]);
      tb.innerHTML = card(cardHead('✅ Check eligibility') + '<p class="muted mb8">Healthy adults 18-65 weighing 50kg+ can donate every 8 weeks.</p><button class="btn btn-danger btn-block btn-sm" id="elig">Am I eligible?</button><div id="er"></div>') +
        card(cardHead('🩸 Urgent blood requests') + (reqs.length ? reqs.map(campaignCard).join('') : empty('🩸', 'No open requests nearby'))) +
        card(cardHead('📍 Donation centers') + (centers.length ? centers.map((c) => `<div class="donation-location"><div class="name">${esc(c.name)}</div><div class="address">${esc(c.address)}${c.city ? ', ' + esc(c.city) : ''} • ${esc(c.hours || '')}</div><div class="row between"><span class="distance">${c.distanceKm != null ? c.distanceKm + ' km' : ''}</span><span><a class="link" href="tel:${esc(c.phone || '')}">📞</a> <button class="link" data-pledge-center="${c.id}" data-name="${esc(c.name)}">Book visit</button></span></div></div>`).join('') : empty('📍', 'No centers listed')));
      $('#elig', tb).onclick = () => formModal('🩸 Eligibility check', [
        { name: 'age', label: 'Age', type: 'number', required: true }, { name: 'weight', label: 'Weight (kg)', type: 'number', required: true },
        { name: 'gender', label: 'Sex', type: 'select', options: [['male', 'Male'], ['female', 'Female']] },
        { name: 'recentIllness', label: 'I was ill in the last 2 weeks', type: 'checkbox' }, { name: 'recentTattoo', label: 'Tattoo / piercing in the last 6 months', type: 'checkbox' }, { name: 'pregnant', label: 'Pregnant or gave birth in last 6 months', type: 'checkbox' },
      ], { submit: 'Check', onSubmit: async (v) => { const r = await post('/donations/eligibility', v); $('#er', tb).innerHTML = `<div class="eligibility-result ${r.eligible ? 'success' : ''} mt8"><div class="icon">${r.eligible ? '✅' : '⚠️'}</div><div class="title">${r.eligible ? 'You can donate!' : 'Not eligible right now'}</div><div class="details">${r.eligible ? 'Book a visit at a center below or answer an urgent request.' : r.reasons.map(esc).join('<br>')}</div></div>`; } });
    } else if (tab === 'organ') {
      const [reg, reqs] = await Promise.all([get('/donations/organ-registry'), get('/donations/campaigns?type=ORGAN' + ll)]);
      tb.innerHTML = card(cardHead('🫀 Organ donor registry') + (reg && reg.status === 'ACTIVE' ? `<div class="eligibility-result success"><div class="icon">💚</div><div class="title">You are a registered donor</div><div class="details">Card no. <b>${esc(reg.donorCardNo)}</b> • ${esc((reg.organs || []).join(', '))}${reg.livingDonor ? ' • living donor' : ''}</div></div><div class="row mt8"><button class="btn btn-outline btn-sm grow" id="orgedit">Update</button><button class="btn btn-outline btn-sm grow" id="orgw" style="color:var(--error)">Withdraw</button></div>` : `<p class="muted mb8">One donor can save up to 8 lives. Registering records your wishes - tell your family too.</p><button class="btn btn-success btn-block" id="orgedit">Register as a donor</button>`)) +
        card(cardHead('🔎 Organ requests') + (reqs.length ? reqs.map(campaignCard).join('') : empty('🫀', 'No open organ requests')));
      $('#orgedit', tb).onclick = () => formModal('🫀 Organ donation', [
        ...ORGANS.map((o) => ({ name: 'o_' + o, label: o, type: 'checkbox', value: (reg?.organs || []).includes(o) })),
        { name: 'livingDonor', label: 'I am willing to be a living donor (kidney / liver portion / bone marrow)', type: 'checkbox', value: reg?.livingDonor },
        { name: 'nextOfKinName', label: 'Next of kin', value: reg?.nextOfKinName || '' }, { name: 'nextOfKinPhone', label: 'Next of kin phone', type: 'tel', value: reg?.nextOfKinPhone || '' },
        { name: 'consent', label: 'I consent to be registered as an organ donor and understand I can withdraw at any time', type: 'checkbox' },
      ], { submit: 'Save', onSubmit: async (v) => { await post('/donations/organ-registry', { organs: ORGANS.filter((o) => v['o_' + o]), livingDonor: v.livingDonor, nextOfKinName: v.nextOfKinName, nextOfKinPhone: v.nextOfKinPhone, consent: v.consent }); toast('💚 Registered'); draw(); } });
      $('#orgw', tb)?.addEventListener('click', async () => { if (await confirmBox('Withdraw from the organ donor registry?', { danger: true, ok: 'Withdraw' })) { await del('/donations/organ-registry'); draw(); } });
    } else if (tab === 'fund' || tab === 'patients') {
      const list = await get('/donations/campaigns?type=' + (tab === 'fund' ? 'FUND' : 'PATIENT_CASE'));
      tb.innerHTML = list.length ? list.map(campaignCard).join('') : empty(tab === 'fund' ? '💰' : '🧒', 'No active campaigns');
    } else {
      const [pl, mine] = await Promise.all([get('/donations/pledges'), get('/donations/campaigns?mine=1')]);
      tb.innerHTML = card(cardHead('🗓️ My pledges & appointments') + (pl.length ? pl.map((x) => `${item({ icon: x.type === 'BLOOD' ? '🩸' : '🫀', title: esc(x.campaign?.title || x.centerName || 'Donation'), sub: (x.scheduledAt ? dt(x.scheduledAt) : 'Time to be arranged') + (x.campaign?.contactPhone ? ' • 📞 ' + esc(x.campaign.contactPhone) : ''), trailing: badge(x.status) })}${x.status === 'SCHEDULED' ? `<div class="row mb8">${x.campaign?.organizerId ? `<button class="btn btn-outline btn-sm grow" data-go="/chat/${x.campaign.organizerId}">💬 Contact</button>` : ''}<button class="btn btn-outline btn-sm grow" data-plc="${x.id}">Cancel</button></div>` : ''}`).join('') : empty('🗓️', 'No pledges yet'))) +
        card(cardHead('📣 Campaigns I started') + (mine.length ? mine.map((c) => item({ icon: '📣', title: esc(c.title), sub: esc(c.type) + ' • ' + money(c.raisedAmount) + ' • ' + c.unitsPledged + ' pledges', trailing: badge(c.status), attrs: `data-go="/donations/campaign/${c.id}"` })).join('') : empty('📣', 'None')));
    }
  };
  $$('[data-dt]', el).forEach((c) => (c.onclick = () => { tab = c.dataset.dt; $$('[data-dt]', el).forEach((x) => x.classList.toggle('active', x === c)); draw(); }));
  $('#start', el).onclick = () => createCampaign(draw);
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-don],[data-pledge-center],[data-plc]'); if (!b) return;
    if (b.dataset.don) donateModal(b.dataset.don, b.dataset.title, draw);
    if (b.dataset.pledgeCenter) formModal('🩸 Book a donation visit', [{ name: 'scheduledAt', label: 'Date & time', type: 'datetime-local', required: true }], { intro: `<p class="muted mb8">${esc(b.dataset.name)}</p>`, submit: 'Book', onSubmit: async (v) => { const r = await post('/donations/pledges', { type: 'BLOOD', centerId: b.dataset.pledgeCenter, scheduledAt: new Date(v.scheduledAt).toISOString() }); toast('✅ Booked' + (r.contact?.phone ? ' • Contact ' + r.contact.phone : '')); } });
    if (b.dataset.plc) { await patch('/donations/pledges/' + b.dataset.plc, { status: 'CANCELLED' }).catch(toastErr); draw(); }
  });
  draw();
}
function donateModal(id, title, after) {
  formModal('❤️ Donate to ' + esc(title), [
    { name: 'amount', label: 'Amount (coins)', type: 'number', required: true, min: 100, placeholder: '1000' },
    { name: 'message', label: 'Message of support (optional)' }, { name: 'anonymous', label: 'Donate anonymously', type: 'checkbox' },
  ], { submit: 'Donate', intro: '<p class="muted mb8">Paid from your coins. 100% goes to the cause.</p>', onSubmit: async (v) => { await post('/donations/campaigns/' + id + '/donate', v); toast('💚 Thank you for your donation!'); loadBalance(); after?.(); } });
}
function createCampaign(after) {
  formModal('📣 Request donations', [
    { name: 'type', label: 'Type', type: 'select', options: [['BLOOD', '🩸 Blood request'], ['ORGAN', '🫀 Organ request'], ['PATIENT_CASE', '🧒 Patient medical bill'], ['FUND', '💰 Community fund']] },
    { name: 'title', label: 'Title', required: true, placeholder: 'e.g. O- blood needed for surgery at LUTH' },
    { name: 'description', label: 'Story / details', type: 'textarea', rows: 4, required: true },
    { name: 'beneficiaryName', label: 'Beneficiary' },
    { name: 'bloodType', label: 'Blood group needed', type: 'select', options: [['', '—'], ...BLOOD] }, { name: 'organ', label: 'Organ needed', type: 'select', options: [['', '—'], ...ORGANS] },
    { name: 'unitsNeeded', label: 'Units / donors needed', type: 'number' }, { name: 'goalAmount', label: 'Goal amount (₦) - for money campaigns', type: 'number' },
    { name: 'urgency', label: 'Urgency', type: 'select', options: ['NORMAL', 'URGENT', 'CRITICAL'] }, { name: 'location', label: 'Hospital / location' },
    { name: 'contactName', label: 'Contact person' }, { name: 'contactPhone', label: 'Contact phone', type: 'tel' }, { name: 'deadline', label: 'Needed by', type: 'date' },
  ], { submit: 'Submit for review', intro: '<div class="banner info">To protect donors, campaigns are reviewed by N-Health before going live (usually within 24h). Institutions go live instantly.</div>', onSubmit: async (v) => {
    const b = { ...v }; Object.keys(b).forEach((k) => b[k] === '' && delete b[k]);
    if (b.deadline) b.deadline = new Date(b.deadline).toISOString();
    const p = await pos(); if (p) Object.assign(b, { lat: p.lat, lng: p.lng });
    const c = await post('/donations/campaigns', b); toast(c.status === 'ACTIVE' ? '✅ Campaign is live' : '✅ Submitted for review'); after?.();
  } });
}
export async function campaignScreen(el, { id }) {
  const c = await get('/donations/campaigns/' + id);
  const mine = c.organizerId === state.user.id;
  const pct = Number(c.goalAmount) ? Math.min(100, Math.round((Number(c.raisedAmount) / Number(c.goalAmount)) * 100)) : 0;
  const money_ = c.type === 'FUND' || c.type === 'PATIENT_CASE';
  el.innerHTML = appBar({ title: '❤️ ' + esc(c.type.replace('_', ' ').toLowerCase()), back: '/patient/donations' }) + card(`${c.imageUrl ? `<img src="${esc(c.imageUrl)}" style="width:100%;border-radius:12px;margin-bottom:8px" alt="">` : ''}<h3 style="font-size:16px">${esc(c.title)}</h3><div class="muted">${esc(c.beneficiaryName || '')} ${c.institution ? '• ' + esc(c.institution.name) : ''} ${badge(c.status)} ${c.urgency !== 'NORMAL' ? badge('FAILED', c.urgency) : ''}</div>
    <p style="font-size:13px;line-height:1.6;margin:8px 0">${esc(c.description)}</p>
    ${money_ ? `<div class="progress-bar"><div class="fill primary" style="width:${pct}%"></div></div><div class="row between small mt8"><b>${money(c.raisedAmount)} raised</b><span class="muted">of ${money(c.goalAmount)} • ${c.donorCount} donors</span></div>` : `<div class="kv"><span class="k">Needed</span><span class="v">${esc(c.bloodType || c.organ || '')} • ${c.unitsPledged}/${c.unitsNeeded || '?'} pledged</span></div>`}
    ${c.location ? `<div class="kv"><span class="k">Location</span><span class="v">${esc(c.location)}</span></div>` : ''}${c.deadline ? `<div class="kv"><span class="k">Needed by</span><span class="v">${dateOnly(c.deadline)}</span></div>` : ''}
    <div class="kv"><span class="k">Contact</span><span class="v">${esc(c.contactName || c.organizer?.name || '')} ${c.contactPhone || c.organizer?.phone ? `• <a href="tel:${esc(c.contactPhone || c.organizer.phone)}">${esc(c.contactPhone || c.organizer.phone)}</a>` : ''}</span></div>
    <div class="row mt12">${c.status === 'ACTIVE' && !mine ? (money_ ? '<button class="btn btn-primary grow" id="give">❤️ Donate</button>' : '<button class="btn btn-danger grow" id="pledge">🩸 I can donate</button>') : ''}${!mine ? `<button class="btn btn-outline grow" data-go="/chat/${c.organizerId}">💬 Contact</button>` : ''}<button class="btn btn-outline" id="share">↗️</button></div>`) +
    (c.donations?.length ? card(cardHead('💚 Recent donations') + c.donations.map((d) => item({ icon: '💚', title: esc(d.donor) + ' • ' + money(d.amount), sub: esc(d.message || '') + ' ' + ago(d.createdAt) })).join('')) : '') + (mine ? '<div id="pl"></div>' : '');
  $('#give', el)?.addEventListener('click', () => donateModal(c.id, c.title, () => campaignScreen(el, { id })));
  $('#pledge', el)?.addEventListener('click', () => formModal('🩸 Pledge to donate', [{ name: 'scheduledAt', label: 'When can you come?', type: 'datetime-local', required: true }], { submit: 'Pledge', onSubmit: async (v) => { const r = await post('/donations/pledges', { type: c.type, campaignId: c.id, scheduledAt: new Date(v.scheduledAt).toISOString() }); modal(`<div class="eligibility-result success"><div class="icon">💚</div><div class="title">Thank you!</div><div class="details">Contact <b>${esc(r.contact?.name || '')}</b>${r.contact?.phone ? ` on <a href="tel:${esc(r.contact.phone)}">${esc(r.contact.phone)}</a>` : ''} at ${esc(r.contact?.location || '')} to confirm.</div></div>`); } }));
  $('#share', el).onclick = () => { const text = `${c.title} - help via N-Health: ${location.origin}/#/donations/campaign/${c.id}`; navigator.share ? navigator.share({ text }).catch(() => null) : navigator.clipboard?.writeText(text).then(() => toast('📋 Link copied')); };
  if (mine) {
    const pl = await get('/donations/campaigns/' + id + '/pledges');
    $('#pl', el).innerHTML = card(cardHead('🙋 Donors who pledged') + (pl.length ? pl.map((x) => `${item({ icon: '🙋', title: esc(x.donor.name), sub: (x.scheduledAt ? dt(x.scheduledAt) : '') + (x.donor.phone ? ' • ' + esc(x.donor.phone) : ''), trailing: badge(x.status) })}${x.status === 'SCHEDULED' ? `<div class="row mb8"><button class="btn btn-success btn-sm grow" data-done="${x.id}">✓ Donated</button><button class="btn btn-outline btn-sm grow" data-go="/chat/${x.donor.id}">💬</button></div>` : ''}`).join('') : empty('🙋', 'No pledges yet')));
    el.onclick = async (e) => { const b = e.target.closest('[data-done]'); if (b) { await patch('/donations/pledges/' + b.dataset.done, { status: 'COMPLETED' }).catch(toastErr); campaignScreen(el, { id }); } };
  }
}

// ================= INSURANCE =================
export async function insuranceScreen(el) {
  const [mine, plans] = await Promise.all([get('/patient/insurance'), get('/insurance/plans')]);
  const p = state.user.patientProfile || {};
  el.innerHTML = appBar({ title: '🛡️ Insurance', back: '/patient/home' }) +
    card(cardHead('🇳🇬 NHIS / NHIA status') + (p.nhisNumber ? `<div class="banner ok">✅ NHIA number on file: <b>${esc(p.nhisNumber)}</b></div>` : '<div class="banner warn">No NHIA number on file. Add it in Profile → Health information.</div>')) +
    card(cardHead('📋 My policies', '<button class="link" id="addp">+ Add existing</button>') + (mine.length ? mine.map((x) => `${item({ icon: '🛡️', title: esc(x.plan?.name || x.provider), sub: esc(x.policyNumber) + (x.premiumAmount ? ' • ' + money(x.premiumAmount) + '/mo' : '') + (x.expiresAt ? ' • expires ' + dateOnly(x.expiresAt) : ''), trailing: badge(x.status) })}${x.status === 'PENDING' && x.premiumAmount ? `<button class="btn btn-primary btn-sm btn-block mb8" data-prem="${x.id}" data-amt="${x.premiumAmount}">Pay first premium ${money(x.premiumAmount)}</button>` : ''}`).join('') : empty('🛡️', 'No policies yet'))) +
    card(cardHead('🏥 Health schemes') + plans.map((pl) => `<div class="provider-detail-card"><div class="row between"><div><div class="provider-name">${esc(pl.name)}</div><div class="provider-specialty">${esc(pl.provider)} • ${esc(pl.type)}</div></div><div class="provider-fee">${Number(pl.monthlyPremium) ? money(pl.monthlyPremium) + '/mo' : 'Free'}</div></div><p class="muted small mt8">${esc(pl.description || '')}</p><div class="row wrap mt8">${(pl.coverage || []).map((c) => `<span class="chip">✓ ${esc(c)}</span>`).join('')}</div><button class="btn btn-primary btn-sm btn-block mt8" data-enrol="${pl.id}" data-name="${esc(pl.name)}" data-fam="${/family/i.test(pl.name) ? 1 : 0}">Enroll</button></div>`).join(''));
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-enrol],[data-prem],#addp'); if (!b) return;
    if (b.id === 'addp') return formModal('Add an existing policy', [{ name: 'provider', label: 'Insurer / HMO', required: true }, { name: 'policyNumber', label: 'Policy / member number', required: true }, { name: 'coverageDetails', label: 'Coverage notes' }, { name: 'expiresAt', label: 'Expiry date', type: 'date' }], { onSubmit: async (v) => { await post('/patient/insurance', { ...v, expiresAt: v.expiresAt ? new Date(v.expiresAt).toISOString() : undefined }); insuranceScreen(el); } });
    if (b.dataset.enrol) formModal('Enroll in ' + esc(b.dataset.name), [{ name: 'memberCount', label: 'Members covered', type: 'number', value: b.dataset.fam === '1' ? 4 : 1, min: 1 }, { name: 'share', label: 'Share my health profile with the insurer', type: 'checkbox', value: true }], { submit: 'Enroll', onSubmit: async (v) => { if (v.share) await patch('/auth/profile', { insuranceShareConsent: true }).catch(() => null); const pol = await post('/patient/insurance', { planId: b.dataset.enrol, memberCount: Number(v.memberCount) || 1 }); toast('✅ Enrollment started'); if (Number(pol.premiumAmount) > 0) setTimeout(() => premium(pol.id, pol.premiumAmount), 50); else insuranceScreen(el); } });
    if (b.dataset.prem) premium(b.dataset.prem, b.dataset.amt);
  });
  const premium = async (id, amt) => { if (await confirmBox(`Pay ${money(amt)} premium from your coins?`, { ok: 'Pay' })) { try { await post('/insurance/policies/' + id + '/pay'); toast('🛡️ Policy active'); insuranceScreen(el); } catch (err) { toastErr(err); } } };
}

// ================= HEALTH RECORDS =================
export async function recordsScreen(el, _p, q) {
  let tab = q.tab || 'timeline';
  el.innerHTML = appBar({ title: '📁 Health Records', back: '/patient/home' }) + `<div class="hscroll">${[['timeline', '🕒 Timeline'], ['reminders', '⏰ Reminders'], ['family', '👨‍👩‍👧 Family'], ['vaccines', '💉 Vaccines'], ['docs', '📄 Documents'], ['card', '🆘 Emergency ID']].map(([k, l]) => `<span class="chip ${k === tab ? 'active' : ''}" data-rt="${k}">${l}</span>`).join('')}</div><div id="tb"></div>`;
  const ICONS = { appointment: '📅', prescription: '💊', lab: '🔬', order: '📦', emergency: '🚨', vaccination: '💉', document: '📄' };
  const draw = async () => {
    const tb = $('#tb', el); tb.innerHTML = skeleton(3);
    if (tab === 'timeline') {
      const ev = await get('/health/timeline');
      tb.innerHTML = ev.length ? card(ev.map((x) => item({ icon: ICONS[x.type], title: esc(x.title), sub: dateOnly(x.at) + (x.sub ? ' • ' + esc(x.sub) : ''), trailing: x.url ? `<a class="link" href="${esc(x.url)}" target="_blank" rel="noopener">Open</a>` : badge(x.status), attrs: x.type === 'lab' ? 'data-go="/patient/labs?tab=results"' : x.type === 'prescription' ? 'data-go="/patient/pharmacy?tab=rx"' : '' })).join('')) : empty('🕒', 'Your medical history will appear here');
    } else if (tab === 'reminders') {
      const r = await get('/health/reminders');
      tb.innerHTML = `<button class="btn btn-primary btn-block btn-sm mb8" id="addr">+ Add medication reminder</button>` + (r.length ? r.map((x) => card(`${item({ icon: '💊', title: esc(x.medication), sub: esc(x.dosage || '') + ' • ⏰ ' + x.times.join(', ') + (x.endDate ? ' • until ' + dateOnly(x.endDate) : ''), trailing: x.isActive ? badge('ACTIVE') : badge('CANCELLED', 'paused') })}<div class="row"><button class="btn btn-success btn-sm grow" data-taken="${x.id}">✓ Taken</button><button class="btn btn-outline btn-sm grow" data-skip="${x.id}">Skip</button><button class="btn btn-outline btn-sm" data-delr="${x.id}">🗑️</button></div>${(x.takenLog || []).length ? `<div class="muted small mt8">Last: ${x.takenLog[0].status} ${ago(x.takenLog[0].at)}</div>` : ''}`)).join('') : empty('⏰', 'No reminders. You will get a notification at each dose time.'));
      $('#addr', tb).onclick = () => formModal('⏰ Medication reminder', [
        { name: 'medication', label: 'Medication', required: true }, { name: 'dosage', label: 'Dosage', placeholder: '1 tablet' },
        { name: 'times', label: 'Times (comma separated, 24h)', value: '08:00, 20:00', required: true }, { name: 'endDate', label: 'Until', type: 'date' }, { name: 'refillAt', label: 'Refill reminder date', type: 'date' },
      ], { onSubmit: async (v) => { await post('/health/reminders', { ...v, times: v.times.split(',').map((s) => s.trim()).filter(Boolean), endDate: v.endDate ? new Date(v.endDate).toISOString() : undefined, refillAt: v.refillAt ? new Date(v.refillAt + 'T09:00').toISOString() : undefined }); draw(); } });
    } else if (tab === 'family') {
      const f = await get('/health/family');
      tb.innerHTML = `<button class="btn btn-primary btn-block btn-sm mb8" id="addf">+ Add family member</button>` + (f.length ? card(f.map((x) => item({ icon: '👤', title: esc(x.name), sub: esc(x.relationship) + (x.dateOfBirth ? ' • ' + dateOnly(x.dateOfBirth) : '') + (x.bloodType ? ' • ' + esc(x.bloodType) : '') + (x.genotype ? ' • ' + esc(x.genotype) : ''), trailing: `<button class="link" data-delf="${x.id}">Remove</button>` })).join('')) : empty('👨‍👩‍👧', 'Manage care for children, parents and dependants'));
      $('#addf', tb).onclick = () => formModal('Add family member', [
        { name: 'name', label: 'Name', required: true }, { name: 'relationship', label: 'Relationship', type: 'select', options: ['Child', 'Spouse', 'Parent', 'Sibling', 'Grandparent', 'Other'] },
        { name: 'dateOfBirth', label: 'Date of birth', type: 'date' }, { name: 'gender', label: 'Sex', type: 'select', options: [['', '—'], 'Female', 'Male'] },
        { name: 'bloodType', label: 'Blood group', type: 'select', options: [['', '—'], ...BLOOD] }, { name: 'genotype', label: 'Genotype', type: 'select', options: [['', '—'], ...GENOTYPES] },
        { name: 'allergies', label: 'Allergies' }, { name: 'conditions', label: 'Conditions' },
      ], { onSubmit: async (v) => { await post('/health/family', v); draw(); } });
    } else if (tab === 'vaccines') {
      const v = await get('/health/vaccinations');
      tb.innerHTML = `<button class="btn btn-primary btn-block btn-sm mb8" id="addv">+ Record vaccination</button>` + (v.length ? card(v.map((x) => item({ icon: '💉', title: esc(x.vaccine) + (x.dose ? ' • ' + esc(x.dose) : ''), sub: (x.givenAt ? 'Given ' + dateOnly(x.givenAt) : '') + (x.nextDueAt ? ' • Next due ' + dateOnly(x.nextDueAt) : '') + (x.provider ? ' • ' + esc(x.provider) : ''), trailing: `<button class="link" data-delv="${x.id}">🗑️</button>` })).join('')) : empty('💉', 'Keep track of immunisations (BCG, Polio, Hep B, Yellow fever, HPV, COVID-19…)'));
      $('#addv', tb).onclick = () => formModal('💉 Vaccination', [{ name: 'vaccine', label: 'Vaccine', required: true }, { name: 'dose', label: 'Dose', placeholder: 'Dose 1 / Booster' }, { name: 'givenAt', label: 'Date given', type: 'date' }, { name: 'nextDueAt', label: 'Next dose due', type: 'date' }, { name: 'provider', label: 'Where' }], { onSubmit: async (val) => { await post('/health/vaccinations', { ...val, givenAt: val.givenAt || undefined, nextDueAt: val.nextDueAt || undefined }); draw(); } });
    } else if (tab === 'docs') {
      const d = await get('/health/documents');
      tb.innerHTML = `<button class="btn btn-primary btn-block btn-sm mb8" id="addd">⬆️ Upload document</button>` + (d.length ? card(d.map((x) => item({ icon: '📄', title: esc(x.title), sub: esc(x.category) + ' • ' + dateOnly(x.createdAt), trailing: `<a class="link" href="${esc(x.fileUrl)}" target="_blank" rel="noopener">Open</a> <button class="link" data-deld="${x.id}">🗑️</button>` })).join('')) : empty('📄', 'Store scans, discharge summaries, old results and insurance cards'));
      $('#addd', tb).onclick = async () => {
        const f = await pickFile('image/*,application/pdf'); if (!f) return;
        let dataUri; try { dataUri = await fileToDataUri(f); } catch (err) { return toastErr(err); }
        formModal('Document', [{ name: 'title', label: 'Title', value: f.name.replace(/\.[^.]+$/, ''), required: true }, { name: 'category', label: 'Category', type: 'select', options: ['LAB', 'SCAN', 'PRESCRIPTION', 'DISCHARGE', 'INSURANCE', 'OTHER'] }], { submit: 'Upload', onSubmit: async (v) => { const up = await post('/uploads', { dataUri, folder: 'health', private: true }); await post('/health/documents', { ...v, fileUrl: up.url, fileId: up.fileId, mimeType: up.mimeType }); draw(); } });
      };
    } else {
      const { token } = await get('/health/emergency-card');
      const url = `${location.origin}/#/e/${token}`;
      const p = state.user.patientProfile || {};
      tb.innerHTML = card(`<div class="center"><div style="font-weight:700">🆘 Emergency Medical ID</div><div class="muted small">First responders scan this to see only what saves your life</div></div><div class="qr" id="qr"></div>
        <div class="kv"><span class="k">Name</span><span class="v">${esc(state.user.name)}</span></div><div class="kv"><span class="k">Blood group</span><span class="v">${esc(p.bloodType || '—')}</span></div><div class="kv"><span class="k">Genotype</span><span class="v">${esc(p.genotype || '—')}</span></div><div class="kv"><span class="k">Allergies</span><span class="v">${esc(p.allergies || '—')}</span></div><div class="kv"><span class="k">Emergency contact</span><span class="v">${esc([p.emergencyContact, p.emergencyPhone].filter(Boolean).join(' • ') || '—')}</span></div>
        <div class="row mt8"><button class="btn btn-outline btn-sm grow" id="dlqr">⬇️ Save image</button><button class="btn btn-outline btn-sm grow" id="rot">🔄 New link</button></div><p class="muted small mt8">Tip: save the image as your phone's lock-screen wallpaper.</p>`);
      const QR = (await import('qrcode')).default;
      const canvas = document.createElement('canvas');
      await QR.toCanvas(canvas, url, { width: 200, margin: 1, color: { dark: '#D32F2F' } });
      $('#qr', tb).appendChild(canvas);
      $('#dlqr', tb).onclick = () => { const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = 'nhealth-emergency-id.png'; a.click(); };
      $('#rot', tb).onclick = async () => { if (await confirmBox('Create a new link? Old QR codes will stop working.')) { await post('/health/emergency-card/rotate'); draw(); } };
    }
  };
  $$('[data-rt]', el).forEach((c) => (c.onclick = () => { tab = c.dataset.rt; $$('[data-rt]', el).forEach((x) => x.classList.toggle('active', x === c)); draw(); }));
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-taken],[data-skip],[data-delr],[data-delf],[data-delv],[data-deld]'); if (!b) return;
    if (b.dataset.taken || b.dataset.skip) { await post('/health/reminders/' + (b.dataset.taken || b.dataset.skip) + '/log', { status: b.dataset.taken ? 'taken' : 'skipped' }); toast(b.dataset.taken ? '✓ Logged' : 'Skipped'); }
    if (b.dataset.delr) await del('/health/reminders/' + b.dataset.delr);
    if (b.dataset.delf) await del('/health/family/' + b.dataset.delf);
    if (b.dataset.delv) await del('/health/vaccinations/' + b.dataset.delv);
    if (b.dataset.deld) await del('/health/documents/' + b.dataset.deld);
    draw();
  });
  draw();
}

/** Public page a first responder sees after scanning the QR (no login). */
export async function publicCardScreen(el, { token }) {
  el.innerHTML = `<div class="app-bar" style="background:var(--emergency-red);color:#fff"><div class="title" style="color:#fff">🆘 Emergency Medical ID</div></div><div id="c">${skeleton(2)}</div>`;
  try {
    const c = await get('/public/emergency-card/' + token);
    $('#c', el).innerHTML = card(`<div style="font-size:18px;font-weight:700">${esc(c.name)}</div>
      <div class="kv"><span class="k">🩸 Blood group</span><span class="v" style="font-size:16px;color:var(--emergency-red)"><b>${esc(c.bloodType || 'Unknown')}</b></span></div>
      <div class="kv"><span class="k">🧬 Genotype</span><span class="v">${esc(c.genotype || 'Unknown')}</span></div>
      <div class="kv"><span class="k">⚠️ Allergies</span><span class="v">${esc(c.allergies || 'None recorded')}</span></div>
      <div class="kv"><span class="k">🩺 Conditions</span><span class="v">${esc(c.chronicConditions || '—')}</span></div>
      <div class="kv"><span class="k">💊 Medications</span><span class="v">${esc(c.currentMedications || '—')}</span></div>
      <div class="kv"><span class="k">🫀 Organ donor</span><span class="v">${c.organDonor ? 'Yes' : 'No'}</span></div>
      ${c.emergencyPhone ? `<a class="btn btn-danger btn-block mt12" href="tel:${esc(c.emergencyPhone)}">📞 Call ${esc(c.emergencyContact || 'emergency contact')}</a>` : ''}
      <a class="btn btn-outline btn-block mt8" href="tel:112">📞 Call 112</a>`, 'style="border:2px solid var(--emergency-red)"');
  } catch { $('#c', el).innerHTML = empty('❓', 'This emergency card is not valid.'); }
}
