import { get, getFresh, post, postLater, patch, del, download } from '../lib/api.js';
import { state } from '../lib/store.js';
import { esc, $, $$, appBar, brandTitle, card, cardHead, item, avatar, badge, verifiedBadge, empty, skeleton, tabs, toast, toastErr, modal, formModal, confirmBox, busy, money, coins, dt, relDay, dateOnly, timeOnly, ago, locate, field, readForm, fileToDataUri, pickFile, coinValue, webOrigin } from '../lib/ui.js';
import { on } from '../lib/realtime.js';
import { go } from '../lib/router.js';
import { createMap } from '../lib/map.js';
import { t } from '../lib/i18n.js';
import { loadBalance, payModal, reviewModal, emergencyNumbers, inviteCard, loadInviteStats } from './common.js';
import { BLOOD, ORGANS, GENOTYPES, NG_STATES } from './data.js';

const upcoming = (a) => ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(a.status) && new Date(a.scheduledAt).getTime() > Date.now() - 2 * 3600e3;
let myPos = null;
async function pos() { if (myPos) return myPos; try { myPos = await locate({ timeout: 6000 }); } catch { myPos = null; } return myPos; }

// ================= HOME =================
export async function homeScreen(el) {
  const u = state.user;
  el.innerHTML = appBar({ title: brandTitle() }) + `
    <div class="welcome-text">${t('Hello')}, 👋 ${esc(u.name.split(' ')[0])}</div>
    <div class="welcome-sub">Your complete health companion</div>
    <div class="balance-card"><div class="balance-label">Reward coins</div><div class="balance-amount" id="bal">…</div>
      <div style="font-size:11px;opacity:.85;margin-top:2px" id="ins"></div>
      <div class="balance-actions"><button class="btn-primary" id="checkin">📅 Check in +1 🪙</button><button class="btn-outline" data-go="/patient/wallet">🎯 Quests</button></div></div>
    ${!u.emailVerified && !u.phoneVerified ? `<div class="banner info" id="vemail">📧 Confirm your email to secure your account. We sent a 6-digit code to ${esc(u.email || '')}. <button class="btn btn-sm btn-primary" id="vemailb">Confirm</button></div>` : ''}
    ${u.kycStatus === 'IN_REVIEW' ? '<div class="banner info" data-go="/kyc">⏳ Your identity documents are being checked. We will notify you when it is done.</div>' : u.kycStatus !== 'APPROVED' ? '<div class="banner info">🪪 Verify your identity to unlock emergency dispatch, insurance and donations.<button class="btn btn-sm btn-primary" data-go="/kyc">Verify</button></div>' : ''}
    <div class="quick-actions">
      <div class="quick-action emergency" data-go="/patient/emergency" tabindex="0"><span class="icon">🚨</span><span class="label">${t('Emergency')}</span></div>
      <div class="quick-action" data-go="/patient/appointments" tabindex="0"><span class="icon">📅</span><span class="label">${t('Appointments')}</span></div>
      <div class="quick-action pharmacy-action" data-go="/patient/pharmacy" tabindex="0"><span class="icon">💊</span><span class="label">${t('Pharmacy')}</span></div>
      <div class="quick-action lab-action" data-go="/patient/labs" tabindex="0"><span class="icon">🔬</span><span class="label">${t('Diagnostics')}</span></div>
      <div class="quick-action" data-go="/patient/providers" tabindex="0"><span class="icon">🏥</span><span class="label">${t('Providers')}</span></div>
      <div class="quick-action" data-go="/patient/donations" tabindex="0"><span class="icon">❤️</span><span class="label">${t('Donate')}</span></div>
      <div class="quick-action" data-go="/patient/insurance" tabindex="0"><span class="icon">🛡️</span><span class="label">${t('Insurance')}</span></div>
      <div class="quick-action" data-go="/messages" tabindex="0"><span class="icon">💬</span><span class="label">${t('Messages')}</span></div>
      <div class="quick-action nurse-action" data-go="/patient/providers?type=NURSE" tabindex="0"><span class="icon">👩‍⚕️</span><span class="label">Home care</span></div>
      <div class="quick-action" data-go="/patient/records" tabindex="0"><span class="icon">📁</span><span class="label">${t('Records')}</span></div>
      <div class="quick-action" data-go="/patient/records?tab=reminders" tabindex="0"><span class="icon">⏰</span><span class="label">Reminders</span></div>
      <div class="quick-action institution-action" data-go="/patient/institutions" tabindex="0"><span class="icon">🏨</span><span class="label">Facilities</span></div>
      <div class="quick-action" data-go="/jobs" tabindex="0"><span class="icon">💼</span><span class="label">Health jobs</span></div>
    </div>
    <div id="fhp"></div>${inviteCard()}<div id="up">${skeleton(1)}</div><div id="rem"></div><div id="rx"></div><div id="fac"></div><div id="tip"></div>`;
  loadBalance().then((b) => { $('#bal', el) && ($('#bal', el).textContent = '🪙 ' + coins(b)); });
  loadInviteStats(el);
  $('#vemailb', el)?.addEventListener('click', () => import('./shared.js').then((m) => m.verifyEmail(() => $('#vemail', el)?.remove())));
  const ci = $('#checkin', el);
  const doneCi = () => { ci.textContent = '✓ Checked in today'; ci.disabled = true; };
  ci?.addEventListener('click', async () => {
    let done = false;
    await busy(ci, async () => {
      try { const r = await post('/quests/checkin/claim'); done = true; toast(`📅 Checked in: +${r.coins} 🪙${r.streak > 1 ? ' • 🔥 ' + r.streak + '-day streak' : ''}`); loadBalance().then((b) => { const x = $('#bal', el); if (x) x.textContent = '🪙 ' + coins(b); }); }
      catch (err) { if (err.status === 409) { done = true; toast('You already checked in today. See you tomorrow!'); } else throw err; }
    });
    if (done) doneCi();
  });
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
  get('/directory?verified=1&sort=rating').then((list) => {
    const top = list.filter((x) => ['DOCTOR', 'NURSE'].includes(x.role)).slice(0, 2);
    $('#fhp', el) && ($('#fhp', el).innerHTML = `<div class="card find-providers"><div class="card-header"><span class="card-title">🔍 Find Health Providers</span><a class="link" data-go="/patient/providers">Search</a></div>
      <div class="fp-chips">${[['DOCTOR', '👨‍⚕️ Doctors'], ['NURSE', '👩‍⚕️ Nurses'], ['PHARMACY', '💊 Pharmacists'], ['AMBULANCE', '🚑 Ambulance'], ['LAB', '🔬 Diagnostics']].map(([k, l]) => `<span class="badge badge-provider" data-go="/patient/providers?type=${k}" tabindex="0">${l}</span>`).join('')}${[['BLOOD', '🩸 Blood banks'], ['MEDICINE', '💊 Medicines'], ['HMO', '🛡️ Insurance'], ['HOSPITAL', '🏥 Hospitals']].map(([k, l]) => `<span class="badge badge-provider" data-go="/patient/find?type=${k}" tabindex="0">${l}</span>`).join('')}</div>
      ${top.map((x) => item({ avatarHtml: avatar(x.role, x.avatarUrl), title: (x.role === 'DOCTOR' ? 'Dr. ' : x.role === 'NURSE' ? 'Nurse ' : '') + esc(x.name), sub: [x.title || x.specialty, x.hospital, x.rating ? '⭐ ' + Number(x.rating).toFixed(1) : ''].filter(Boolean).map(esc).join(' • '), trailing: x.verified ? '<span class="badge badge-success">Verified</span>' : '', attrs: `data-go="/provider/${x.userId}"` })).join('')}</div>`);
  }).catch(() => null);
  get('/articles').then((a) => { if (a[0]) $('#tip', el).innerHTML = card(item({ icon: '💡', title: esc(a[0].title), sub: esc(a[0].summary), attrs: `data-go="/articles/${a[0].slug}"` })); }).catch(() => null);
}

// ================= COINS (wallet) =================
export async function walletScreen(el, _p, q) {
  const cfg = state.config || {};
  if (!cfg.coinSales) return rewardsScreen(el);
  const gws = cfg.gateways || [];
  const pending = sessionStorage.getItem('nh_topup');
  el.innerHTML = appBar({ title: '💰 Coins', back: '/patient/home' }) + `
    <div class="balance-card"><div class="balance-label">Available coins</div><div class="balance-amount" id="bal">…</div><div class="small" style="opacity:.8">For healthcare services and products on N-Health</div></div>
    ${pending ? '<div class="banner info" id="pend">⏳ Confirming your payment…</div>' : ''}
    ${tabs([['fund', '💰 Top up'], ['history', '📊 History']], q.tab === 'history' ? 'history' : 'fund')}
    <div id="fund" class="${q.tab === 'history' ? 'hidden' : ''}">${card(`
      <div class="form-group"><label>Coins to buy</label><input type="number" id="amt" min="10" max="50000" step="1" inputmode="numeric" placeholder="e.g. 500" value="${esc(q.amount || '')}"><div class="hint" id="price">&nbsp;</div></div>
      <div class="row wrap mb8">${[200, 500, 1000, 2000, 5000].map((v) => `<span class="chip" data-amt="${v}">🪙 ${v.toLocaleString()}</span>`).join('')}</div>
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
  // The price of coins in naira is shown before paying (buyers must see what they will be charged).
  const showPrice = () => { const n = Math.floor(Number($('#amt', el).value) || 0); $('#price', el).textContent = n > 0 ? `You pay ${money(n * coinValue(), { naira: true, convert: false })} by card, transfer or USSD` : '\u00a0'; };
  $('#amt', el).oninput = showPrice; showPrice();
  $$('[data-amt]', el).forEach((c) => (c.onclick = () => { $('#amt', el).value = c.dataset.amt; showPrice(); }));
  $$('[data-gw]', el).forEach((c) => (c.onclick = () => { gw = c.dataset.gw; $$('[data-gw]', el).forEach((x) => x.classList.toggle('selected', x === c)); }));
  $$('[data-pm]', el).forEach((c) => (c.onclick = () => { pm = c.dataset.pm; $$('[data-pm]', el).forEach((x) => x.classList.toggle('selected', x === c)); }));
  $('#pay', el).onclick = (e) => busy(e.target, async () => {
    const coinsWanted = Math.floor(Number($('#amt', el).value));
    if (!(coinsWanted >= 10)) throw new Error('Minimum top-up is 10 coins');
    const amount = coinsWanted * coinValue();
    const r = await post('/credits/purchase/initiate', { amount, gateway: gw, currency: 'NGN', channel: pm, returnUrl: webOrigin() + '/' });
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

/** The quest board: health actions that earn reward coins (claim when done). */
async function drawQuests(box, refresh) {
  if (!box) return;
  const qb = await get('/quests').catch(() => null);
  if (!qb?.enabled) { box.innerHTML = ''; return; }
  box.innerHTML = card(cardHead('🎯 Health quests', `<span class="small muted">Today ${qb.earnedToday}/${qb.dailyCap} 🪙${qb.streak ? ' • 🔥 ' + qb.streak + '-day streak' : ''}</span>`) +
    qb.quests.map((q) => item({ icon: q.icon, title: `${esc(q.title)} <span class="badge badge-provider">+${q.coins} 🪙</span>`, sub: esc(q.hint) + (q.repeat === 'daily' ? ' • every day' : q.repeat === 'each' ? ` • each time${q.doneCount ? ' (' + q.doneCount + ' so far)' : ''}` : ''),
      trailing: q.done ? '<span style="color:var(--success)">✓ Done</span>' : q.claimable ? `<button class="btn btn-primary btn-sm" data-claim="${q.key}">Claim</button>` : (q.go ? `<button class="btn btn-outline btn-sm" data-go="${q.go}">Go</button>` : '') })).join(''));
  box.onclick = async (e) => {
    const b = e.target.closest('[data-claim]'); if (!b) return;
    await busy(b, async () => { const r = await post('/quests/' + b.dataset.claim + '/claim'); toast(`🪙 +${r.coins} coin${r.coins === 1 ? '' : 's'}${r.streak > 1 ? ' • 🔥 ' + r.streak + '-day streak' : ''}`); loadBalance(); refresh?.(); });
  };
}

/** Coins are free rewards (like loyalty points): earned by inviting friends and in promotions, never bought or cashed out. */
async function rewardsScreen(el) {
  const reward = state.config?.inviteRewardCoins || 1;
  el.innerHTML = appBar({ title: '🪙 My coins', back: '/patient/home' }) + `
    <div class="balance-card"><div class="balance-label">Reward coins</div><div class="balance-amount" id="bal">…</div><div class="small" style="opacity:.85">Use them towards care on N-Health</div></div>
    <div id="quests">${skeleton(2)}</div>
    ${card(cardHead('More ways to earn') + `
      ${item({ icon: '👥', title: `Invite friends: ${reward} coin${reward > 1 ? 's' : ''} each`, sub: 'When a friend joins with your link and confirms their email or phone', attrs: 'data-go="/patient/home"' })}
      ${item({ icon: '🎁', title: 'Promotions', sub: 'Watch your notifications for N-Health offers' })}`)}
    ${state.config?.donationPartner ? card(cardHead('💚 Donate your coins') + `<p class="small muted">Give coins to ${esc(state.config.donationPartner.name)}, our registered NGO partner. N-Health turns them into a real donation from its own funds.</p><button class="btn btn-success btn-block btn-sm" id="givecoins">Donate coins</button>`) : ''}
    ${card(cardHead('How coins work') + `<div class="small muted" style="line-height:1.6">
      • When you pay for a booking, order or test, choose <b>Use my coins</b> if you have enough.<br>
      • Coins are a free reward from N-Health. They can't be bought, sold, sent to someone else or exchanged for cash.<br>
      • Using or donating coins is final. Coins don't expire, but N-Health may change the programme with notice.<br>
      • You pay for care by card (the money goes straight to the provider) or in cash at the service.</div>`)}
    <div id="history">${skeleton(3)}</div>`;
  const b = await loadBalance(); $('#bal', el).textContent = '🪙 ' + coins(b);
  drawQuests($('#quests', el), () => rewardsScreen(el));
  $('#givecoins', el)?.addEventListener('click', () => formModal('💚 Donate coins', [{ name: 'coins', label: `Coins to give (you have ${coins(state.balance || 0)})`, type: 'number', min: 1, required: true }], { submit: 'Donate', intro: `<p class="muted mb8">To ${esc(state.config.donationPartner.name)}. This can't be undone.</p>`, onSubmit: async (v) => { await post('/coins/donate', { coins: Math.floor(Number(v.coins)) }); toast('💚 Thank you for giving!'); rewardsScreen(el); } }));
  const tx = await get('/credits/transactions').catch(() => []);
  $('#history', el).innerHTML = card(cardHead('📊 Coin history') + (tx.length ? tx.map((x) => item({
    avatarHtml: `<div class="avatar" style="background:${Number(x.amount) >= 0 ? '#E6F4EA;color:var(--success)' : '#FCE8E6;color:var(--error)'}">${Number(x.amount) >= 0 ? '🎁' : '🪙'}</div>`,
    title: esc(x.description), sub: dt(x.createdAt), trailing: `<span style="color:${Number(x.amount) >= 0 ? 'var(--success)' : 'var(--error)'};font-weight:600">${Number(x.amount) >= 0 ? '+' : ''}${coins(x.amount)}</span>`,
  })).join('') : empty('🎁', 'No coins yet. Invite friends to earn your first coins.')));
}

// ================= EMERGENCY =================
const NUM_LABEL = { 112: 'National Emergency', 767: 'Lagos State Emergency', 199: 'Police / Fire', 911: 'Emergency Services', 999: 'Emergency Services', 10177: 'Ambulance', 193: 'Ambulance' };
export async function emergencyScreen(el) {
  const nums = emergencyNumbers();
  el.innerHTML = appBar({ title: '🚨 Emergency', back: '/patient/home', danger: true, actions: null }) + `<div id="body">${skeleton(2)}</div>
    ${card(cardHead('📞 Emergency Contacts') + nums.map((n) => `<a href="tel:${n}" style="text-decoration:none;color:inherit">${item({ icon: '📞', title: NUM_LABEL[n] || 'Emergency line', sub: n + ' • Toll free, 24/7', trailing: '<span style="color:var(--primary)">Call</span>' })}</a>`).join(''))}
    ${card(item({ icon: '🆘', title: 'My Emergency Medical ID', sub: 'QR card with blood group, allergies & contacts for first responders', attrs: 'data-go="/patient/records?tab=card"' }) + item({ icon: '🩹', title: 'First aid while help is on the way', attrs: 'data-go="/articles/first-aid-emergencies"' }))}`;
  let map = null, offs = [];
  const ambulanceForm = async (body) => {
      body.innerHTML = card(`<div style="text-align:center;font-size:40px">🚨</div><h3 style="text-align:center;color:var(--emergency-red);font-size:16px">Emergency Service</h3>
        <p class="center muted">Alerts the nearest ambulances & on-call doctors with your live location, and messages your emergency contact on WhatsApp.</p>
        <p class="center small muted">No payment needed now. Pay the crew in cash or by card after the trip.</p>
        <div class="form-group mt8"><select id="etype"><option value="MEDICAL">🩺 Medical emergency</option><option value="ACCIDENT">🚗 Accident / injury</option><option value="MATERNITY">🤰 Labour / maternity</option><option value="CARDIAC">❤️ Chest pain / cardiac</option><option value="BREATHING">🫁 Breathing difficulty</option><option value="OTHER">Other</option></select></div>
        <div class="form-group"><input id="enotes" placeholder="What's happening? (optional)"></div>
        <button class="btn btn-danger btn-block pulse" id="req" style="font-size:14px;padding:14px">🚨 Request Emergency Help</button>
`, 'style="border:2px solid var(--emergency-red);background:#FFF5F5"');
      $('#req', body).onclick = (e) => busy(e.target, async () => {
        toast('📍 Getting your location…');
        const p = await locate({ timeout: 12000 }).catch((err) => { throw new Error(err.message + '. Call ' + nums[0] + ' now.'); });
        const er = await post('/patient/emergency', { lat: p.lat, lng: p.lng, type: $('#etype', body).value, notes: $('#enotes', body).value || undefined, contactPhone: state.user.phone || undefined });
        // One tap to also message the emergency contact from the patient's own WhatsApp.
        if (er?.contactLink) sessionStorage.setItem('nh_em_contact', er.contactLink);
        if (navigator.vibrate) navigator.vibrate(200);
        toast('🚑 Help requested - nearby ambulances alerted');
        draw();
      });
  };
  const draw = async () => {
    const [list, trips] = await Promise.all([getFresh('/patient/emergency').catch(() => []), getFresh('/er/arrivals').catch(() => [])]);
    const active = list.find((r) => ['REQUESTED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED'].includes(r.status));
    const body = $('#body', el);
    const trip = !active && trips.find((t) => ['REQUESTED', 'ACCEPTED'].includes(t.status) || (t.status === 'ARRIVED' && Date.now() - new Date(t.arrivedAt || t.createdAt).getTime() < 3 * 3600e3 && !sessionStorage.getItem('nh_er_seen_' + t.id)) || (t.status === 'DECLINED' && Date.now() - new Date(t.closedAt || t.createdAt).getTime() < 30 * 60e3 && !sessionStorage.getItem('nh_er_seen_' + t.id)));
    if (trip) { cur = null; return erTrip(body, trip, nums, draw, (m) => { map?.destroy(); map = m; }); }
    if (!active) {
      cur = null;
      const mode = sessionStorage.getItem('nh_em_mode') || 'amb';
      body.innerHTML = `<div class="em-choice" role="tablist">
          <button class="em-opt ${mode === 'amb' ? 'active' : ''}" data-mode="amb" role="tab" aria-selected="${mode === 'amb'}"><span class="i">🚑</span><b>Send an ambulance</b><span>Help comes to you</span></button>
          <button class="em-opt ${mode === 'self' ? 'active' : ''}" data-mode="self" role="tab" aria-selected="${mode === 'self'}"><span class="i">🚗</span><b>I'll go to a hospital</b><span>The hospital gets ready before you arrive</span></button>
        </div><div id="emc"></div>`;
      $$('.em-opt', body).forEach((x) => (x.onclick = () => { sessionStorage.setItem('nh_em_mode', x.dataset.mode); draw(); }));
      const box = $('#emc', body);
      if (mode === 'self') return erChooser(box, nums, draw);
      await ambulanceForm(box);
      return;
    }
    const steps = ['REQUESTED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED'];
    const idx = steps.indexOf(active.status);
    cur = active;
    const amb = active.ambulance && active.status !== 'REQUESTED' ? active.ambulance : null;
    body.innerHTML = card(`<div class="row"><div style="font-size:28px">${active.status === 'REQUESTED' ? '⏳' : '🚑'}</div><div class="grow">
        <div style="font-weight:600;font-size:14px">${active.status === 'REQUESTED' ? 'Finding the nearest ambulance…' : active.status === 'ARRIVED' ? 'Your ambulance has arrived' : 'Ambulance on the way'}</div>
        <div class="muted" id="eline">Requested ${ago(active.requestedAt)}</div></div></div>
        <div class="progress-bar mt8"><div class="fill success" style="width:${((idx + 1) / steps.length) * 100}%"></div></div>
        <div class="row between small muted mt8">${['Sent', 'Accepted', 'En route', 'Arrived'].map((s, i) => `<span style="${i <= idx ? 'color:var(--success);font-weight:600' : ''}">${s}</span>`).join('')}</div>
        ${amb ? `<div class="live-eta" id="live" aria-live="polite"></div>` : ''}
        ${(() => { const l = sessionStorage.getItem('nh_em_contact'); return l && /^https:\/\/wa\.me\//.test(l) ? `<a class="btn btn-outline btn-block mt8" target="_blank" rel="noopener" href="${esc(l)}">💬 Message my emergency contact on WhatsApp</a>` : ''; })()}
        <div class="map" id="emap"></div>
        ${amb ? `<div class="crew">
          <div class="avatar ambulance-avatar">🚑</div>
          <div class="grow"><div style="font-weight:600">${esc(amb.operatorName || amb.name || 'Ambulance crew')}</div>
            <div class="small muted">${esc(amb.vehicleType || 'Ambulance')}${amb.rating ? ' • ⭐ ' + Number(amb.rating).toFixed(1) : ''}</div></div>
          <span class="plate">${esc(amb.vehicleNumber)}</span></div>
          <div class="row mt8">${amb.phone ? `<a class="btn btn-success btn-sm grow" href="tel:${esc(amb.phone)}">📞 Call crew</a>` : ''}<button class="btn btn-outline btn-sm grow" data-go="/chat/${amb.userId}">💬 Message</button></div>` : ''}
        <div class="row mt8"><a class="btn btn-danger btn-sm grow" href="tel:${nums[0]}">📞 Call ${nums[0]}</a>${active.status === 'ARRIVED' ? '' : '<button class="btn btn-outline btn-sm grow" id="cancel" style="border-color:var(--error);color:var(--error)">Cancel request</button>'}</div>`, 'style="border:2px solid var(--success)"');
    $('#cancel', body) && ($('#cancel', body).onclick = async () => { if (await confirmBox('Cancel the emergency request?', { ok: 'Yes, cancel', danger: true })) { await post('/patient/emergency/' + active.id + '/cancel').catch(toastErr); draw(); } });
    try {
      map?.destroy();
      map = await createMap($('#emap', body), [active.lat, active.lng], 14);
      map.setMarker('me', active.lat, active.lng, '📍', 'You');
      if (amb && amb.lat != null) { track.reset(); placeAmbulance(amb.lat, amb.lng, amb.locatedAt ? new Date(amb.locatedAt).getTime() : Date.now(), true); }
      else map.fit();
    } catch { /* map optional */ }
    showLive();
  };

  // ---- Live tracking (like a ride app): position, distance, arrival time, last update ----
  let cur = null;
  const track = {
    last: null, speed: null, at: null,
    reset() { this.last = null; this.speed = null; this.at = null; },
    add(lat, lng, at) {
      if (this.last && at - this.last.at >= 4000) {
        const km = distKm(this.last, { lat, lng });
        const kmh = km / ((at - this.last.at) / 3600e3);
        if (kmh > 3 && kmh < 140) this.speed = this.speed ? this.speed * 0.6 + kmh * 0.4 : kmh; // smoothed
      }
      this.last = { lat, lng, at }; this.at = at;
    },
  };
  const placeAmbulance = (lat, lng, at = Date.now(), first = false) => {
    if (!map || !cur) return;
    track.add(lat, lng, at);
    if (first) map.setMarker('amb', lat, lng, '🚑', 'Ambulance'); else map.moveMarker('amb', lat, lng, '🚑', 'Ambulance');
    map.setLine('route', [lat, lng], [cur.lat, cur.lng]);
    if (first) map.fit(); else if (!map.inView(lat, lng)) map.fit(true);
    showLive();
  };
  const showLive = () => {
    const box = $('#live', el);
    if (!box || !cur) return;
    if (cur.status === 'ARRIVED') { box.innerHTML = `<b>The crew is here.</b> Look out for vehicle <span class="plate">${esc(cur.ambulance?.vehicleNumber || '')}</span>`; return; }
    if (!track.last) { box.innerHTML = `<b>${cur.etaMinutes ? 'Arriving in about ' + cur.etaMinutes + ' min' : 'Ambulance accepted'}</b><div class="small muted">Waiting for the ambulance's live location…</div>`; return; }
    const km = distKm(track.last, cur);
    const speed = Math.max(track.speed || 30, 15); // city driving when we have no speed yet
    const min = Math.max(1, Math.round((km * 1.3 / speed) * 60)); // roads are ~30% longer than a straight line
    const age = Math.round((Date.now() - track.at) / 1000);
    const stale = age > 90;
    box.innerHTML = `<b>${km < 0.15 ? 'Arriving now' : `${km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1) + ' km'} away • about ${min} min`}</b>
      <div class="small ${stale ? '' : 'muted'}" style="${stale ? 'color:var(--warning)' : ''}">${stale ? '⚠️ ' : '📡 '}Location updated ${age < 10 ? 'just now' : age < 60 ? age + ' s ago' : Math.round(age / 60) + ' min ago'}</div>`;
    const line = $('#eline', el); if (line) line.textContent = `Requested ${ago(cur.requestedAt)} • ETA ${min} min`;
  };
  await draw();
  // Keep the "updated X s ago" line moving, and check the server every 15 s in case live updates are blocked (weak network).
  const tick = setInterval(showLive, 5000);
  const poll = setInterval(async () => {
    if (!cur || !navigator.onLine) return;
    try {
      const list = await getFresh('/patient/emergency');
      const now = list.find((r) => r.id === cur.id);
      if (!now || now.status !== cur.status) return draw();
      const a = now.ambulance;
      if (a?.lat != null && a.locatedAt && (!track.at || new Date(a.locatedAt).getTime() > track.at)) placeAmbulance(a.lat, a.lng, new Date(a.locatedAt).getTime());
    } catch { /* offline: keep the last position */ }
  }, 15000);
  offs = [
    on('emergency:accepted', (d) => { toast('🚑 Ambulance accepted' + (d.etaMinutes ? ' - ETA ' + d.etaMinutes + ' min' : '')); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); draw(); }),
    on('emergency:status', (d) => { if (d?.status === 'ARRIVED') { toast('🚑 The ambulance has arrived'); if (navigator.vibrate) navigator.vibrate([300, 100, 300]); } draw(); }),
    on('ambulance:location', (d) => { if (!d.requestId || d.requestId === cur?.id) placeAmbulance(d.lat, d.lng, d.at || Date.now()); }),

    on('er:updated', (d) => { if (d.status === 'ACCEPTED') { toast('✅ The hospital is ready for you'); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } else if (d.status === 'DECLINED') toast('❌ The hospital cannot take you - choose another'); draw(); }),
  ];
  return () => { offs.forEach((f) => f()); clearInterval(tick); clearInterval(poll); stopErTrip(); map?.destroy(); };
}

/** Straight-line distance in km between two {lat, lng} points. */
function distKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---------------- Going to a hospital yourself ----------------
const ER_TYPES = [['MEDICAL', '🩺 Medical emergency'], ['ACCIDENT', '🚗 Accident / injury'], ['MATERNITY', '🤰 Labour / maternity'], ['CARDIAC', '❤️ Chest pain / heart'], ['STROKE', '🧠 Stroke signs'], ['BREATHING', '🫁 Breathing difficulty'], ['CHILD', '👶 Sick child'], ['BURN', '🔥 Burns'], ['POISONING', '☠️ Poisoning'], ['MENTAL', '💬 Mental health crisis']];
const TRANSPORTS = [['CAR', '🚗 Car'], ['TAXI', '🚕 Taxi / ride'], ['BIKE', '🏍️ Okada / bike'], ['WALK', '🚶 Walking'], ['OTHER', 'Other']];
let erStop = () => {};
/** Stops sharing the patient's position with the hospital (screen closed or trip over). */
export const stopErTrip = () => { erStop(); erStop = () => {}; };

function erChooser(box, nums, redraw) {
  const last = (() => { try { return JSON.parse(sessionStorage.getItem('nh_er_form') || '{}'); } catch { return {}; } })();
  box.innerHTML = card(`<p class="muted small" style="margin-top:0">Pick your emergency. We show the nearest hospitals open for emergencies right now, with doctors, nurses and beds free. The hospital you choose is told you are coming so the team is ready when you arrive.</p>
    ${field({ name: 'type', label: 'What is happening?', type: 'select', options: ER_TYPES, value: last.type || 'MEDICAL' })}
    ${field({ name: 'transport', label: 'How are you getting there?', type: 'select', options: TRANSPORTS, value: last.transport || 'CAR' })}
    ${field({ name: 'notes', label: 'Anything the team should know? (optional)', placeholder: 'e.g. bleeding from the head, 34 weeks pregnant', value: last.notes || '' })}
    <label class="check"><input type="checkbox" id="else" ${last.forSomeoneElse ? 'checked' : ''}> <span>This is for someone else (I am taking them)</span></label>
    <button class="btn btn-danger btn-block mt8" id="find">🏥 Find the nearest emergency units</button>`, 'style="border:2px solid var(--emergency-red)"') + '<div id="hl"></div>';
  const form = () => ({ type: $('[name=type]', box).value, transport: $('[name=transport]', box).value, notes: $('[name=notes]', box).value.trim() || undefined, forSomeoneElse: $('#else', box).checked });
  const list = async (pos) => {
    const f = form();
    sessionStorage.setItem('nh_er_form', JSON.stringify(f));
    const hl = $('#hl', box); hl.innerHTML = skeleton(3);
    const hs = await get(`/er/hospitals?lat=${pos.lat}&lng=${pos.lng}&type=${f.type}`);
    // Hospitals in the national directory that are not on N-Health yet: they cannot be alerted, so call first.
    const unlisted = () => get(`/er/unlisted?lat=${pos.lat}&lng=${pos.lng}`).then((us) => {
      if (!us.length || !$('#hl', box)) return;
      hl.insertAdjacentHTML('beforeend', `<div class="section-title" style="margin:14px 4px 6px">Other hospitals nearby <span class="small muted">(not on N-Health yet - call before you go)</span></div>` + us.map(listingCard).join(''));
    }).catch(() => null);
    if (!hs.length) {
      hl.innerHTML = card(empty('🏥', 'No emergency units on N-Health near you yet.', `<a class="btn btn-danger btn-sm" href="tel:${nums[0]}">📞 Call ${nums[0]}</a> <button class="btn btn-outline btn-sm" id="toamb">🚑 Request an ambulance</button>`));
      $('#toamb', hl).onclick = () => { sessionStorage.setItem('nh_em_mode', 'amb'); redraw(); };
      unlisted();
      return;
    }
    const typeLabel = (ER_TYPES.find((t) => t[0] === f.type) || ER_TYPES[0])[1].replace(/^\S+\s/, '').toLowerCase();
    hl.innerHTML = `<div class="section-title" style="margin:10px 4px 6px">Nearest emergency units</div>` + hs.map((h) => {
      const fresh = h.erUpdatedAt && Date.now() - new Date(h.erUpdatedAt).getTime() < 12 * 3600e3;
      return card(`<div class="row"><div class="avatar institution-avatar">🏥</div><div class="grow"><div style="font-weight:600">${esc(h.name)}</div>
          <div class="small muted">${esc([h.address, h.city].filter(Boolean).join(', '))}</div></div>
          <div style="text-align:right"><b>${h.distanceKm} km</b><div class="small muted">~${h.etaMinutes} min</div></div></div>
        <div class="er-chips">
          ${h.erOpen ? '<span class="er-chip ok">🟢 Taking emergencies</span>' : '<span class="er-chip bad">🔴 Not taking patients now</span>'}
          <span class="er-chip ${h.erDoctorsOnDuty ? 'ok' : 'warn'}">👨‍⚕️ ${h.erDoctorsOnDuty} doctor${h.erDoctorsOnDuty === 1 ? '' : 's'} on duty</span>
          <span class="er-chip ${h.erNursesOnDuty ? 'ok' : 'warn'}">👩‍⚕️ ${h.erNursesOnDuty} nurse${h.erNursesOnDuty === 1 ? '' : 's'}</span>
          <span class="er-chip ${h.bedsAvailable ? 'ok' : 'warn'}">🛏️ ${h.bedsAvailable} bed${h.bedsAvailable === 1 ? '' : 's'} free</span>
          ${h.needs ? (h.handlesType ? `<span class="er-chip ok">✓ Handles ${esc(typeLabel)}</span>` : `<span class="er-chip warn">⚠️ ${esc(typeLabel)} not listed</span>`) : ''}
          ${h.incoming ? `<span class="er-chip warn">${h.incoming} patient${h.incoming > 1 ? 's' : ''} on the way</span>` : ''}
        </div>
        <div class="small muted">${fresh ? 'Updated ' + ago(h.erUpdatedAt) : '⚠️ Not updated recently - call to confirm'}</div>
        <div class="row mt8">${h.erOpen ? `<button class="btn btn-danger btn-sm grow" data-goto="${h.id}" data-name="${esc(h.name)}">🚨 Go here - tell them I'm coming</button>` : ''}${h.phone ? `<a class="btn btn-outline btn-sm" href="tel:${esc(h.phone)}">📞</a>` : ''}</div>`, h.erOpen ? '' : 'style="opacity:.7"');
    }).join('');
    unlisted();
    hl.onclick = async (e) => {
      const b = e.target.closest('[data-goto]'); if (!b) return;
      if (!(await confirmBox(`Tell ${b.dataset.name} you are coming? Their emergency team will see your location and medical summary so they can get ready.`, { ok: 'Yes, tell them' }))) return;
      await busy(b, async () => {
        const now = await locate({ timeout: 8000 }).catch(() => pos);
        await post('/er/arrivals', { institutionId: b.dataset.goto, ...form(), lat: now.lat, lng: now.lng, contactPhone: state.user.phone || undefined });
        if (navigator.vibrate) navigator.vibrate(200);
        toast('🏥 Hospital alerted - start your journey');
        redraw();
      });
    };
  };
  $('#find', box).onclick = (e) => busy(e.target, async () => {
    toast('📍 Getting your location…');
    const pos = await locate({ timeout: 12000 }).catch((err) => { throw new Error(err.message + '. Call ' + nums[0] + ' now.'); });
    await list(pos);
  });
}

async function erTrip(body, t, nums, redraw, setMap) {
  stopErTrip();
  const h = t.institution;
  const head = {
    REQUESTED: ['⏳', `Waiting for ${esc(h.name)} to confirm…`, 'They have been alerted. Start your journey - you do not need to wait.'],
    ACCEPTED: ['✅', `${esc(h.name)} is ready for you`, 'The emergency team knows you are coming.'],
    DECLINED: ['❌', `${esc(h.name)} cannot take you now`, esc(t.declineReason || '')],
    ARRIVED: ['🏥', `You are at ${esc(h.name)}`, 'The emergency team has been told you are here.'],
  }[t.status];
  body.innerHTML = card(`<div class="row"><div style="font-size:28px">${head[0]}</div><div class="grow"><div style="font-weight:600;font-size:14px">${head[1]}</div><div class="muted small">${head[2]}</div></div></div>
      ${t.status === 'ACCEPTED' && t.readyNote ? `<div class="banner success mt8">📋 ${esc(t.readyNote)}</div>` : ''}
      ${t.status === 'REQUESTED' ? '<div class="banner warn mt8 hidden" id="slow">No answer yet. Call them, or choose another hospital.</div>' : ''}
      ${['REQUESTED', 'ACCEPTED'].includes(t.status) ? `<div class="live-eta" id="erlive">Getting your position…</div><div class="map" id="ermap"></div>
      <div class="row mt8"><a class="btn btn-primary btn-sm grow" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}&travelmode=${t.transport === 'WALK' ? 'walking' : 'driving'}">🧭 Directions</a>${h.phone ? `<a class="btn btn-success btn-sm grow" href="tel:${esc(h.phone)}">📞 Call hospital</a>` : ''}</div>
      <div class="row mt8"><button class="btn btn-outline btn-sm grow" id="here">📍 I've arrived</button><button class="btn btn-outline btn-sm grow" id="other">Choose another</button><button class="btn btn-outline btn-sm" id="cx" style="border-color:var(--error);color:var(--error)">Cancel</button></div>` : ''}
      ${t.status === 'DECLINED' ? '<button class="btn btn-danger btn-block mt8" id="other">🏥 Choose another hospital</button>' : ''}
      ${t.status === 'ARRIVED' ? '<button class="btn btn-outline btn-block mt8" id="done">Done</button>' : ''}
      <a class="btn btn-danger btn-sm btn-block mt8" href="tel:${nums[0]}">📞 Call ${nums[0]}</a>`, `style="border:2px solid ${t.status === 'DECLINED' ? 'var(--error)' : 'var(--success)'}"`);
  const seen = () => sessionStorage.setItem('nh_er_seen_' + t.id, '1');
  $('#other', body) && ($('#other', body).onclick = async () => {
    if (t.status !== 'DECLINED') await post('/er/arrivals/' + t.id + '/cancel').catch(() => null);
    seen(); sessionStorage.setItem('nh_em_mode', 'self'); redraw();
  });
  $('#done', body) && ($('#done', body).onclick = () => { seen(); redraw(); });
  $('#cx', body) && ($('#cx', body).onclick = async () => { if (await confirmBox(`Tell ${h.name} you are not coming?`, { ok: 'Yes, cancel', danger: true })) { await post('/er/arrivals/' + t.id + '/cancel').catch(toastErr); seen(); redraw(); } });
  $('#here', body) && ($('#here', body).onclick = async () => { await post('/er/arrivals/' + t.id + '/arrived').catch(toastErr); redraw(); });
  if (!['REQUESTED', 'ACCEPTED'].includes(t.status)) return;
  // Map: you and the hospital; your position is shared with the hospital while you travel.
  let map = null;
  try {
    map = await createMap($('#ermap', body), [h.lat, h.lng], 14);
    setMap(map);
    map.setMarker('h', h.lat, h.lng, '🏥', h.name);
    if (t.lat != null) { map.setMarker('me', t.lat, t.lng, '📍', 'You'); map.setLine('to', [t.lat, t.lng], [h.lat, h.lng]); }
    map.fit();
  } catch { /* map optional */ }
  const show = (lat, lng) => {
    const box = $('#erlive', body); if (!box) return;
    const km = distKm({ lat, lng }, h);
    const speed = t.transport === 'WALK' ? 5 : t.transport === 'BIKE' ? 25 : 30;
    const min = Math.max(1, Math.round((km * 1.3 / speed) * 60));
    box.innerHTML = `<b>${km < 0.15 ? 'You are almost there' : `${km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1) + ' km'} to go • about ${min} min`}</b><div class="small muted">📡 ${esc(h.name)} can see you on the way</div>`;
  };
  if (t.lat != null) show(t.lat, t.lng);
  let lastSent = 0;
  const watch = navigator.geolocation?.watchPosition((p) => {
    const lat = p.coords.latitude, lng = p.coords.longitude;
    map?.moveMarker('me', lat, lng, '📍', 'You'); map?.setLine('to', [lat, lng], [h.lat, h.lng]);
    show(lat, lng);
    if (Date.now() - lastSent > 15000 && navigator.onLine) { lastSent = Date.now(); post('/er/arrivals/' + t.id + '/location', { lat, lng }).catch(() => null); }
  }, () => null, { enableHighAccuracy: true, maximumAge: 5000 });
  const slow = t.status === 'REQUESTED' ? setTimeout(() => $('#slow', body)?.classList.remove('hidden'), Math.max(0, 3 * 60e3 - (Date.now() - new Date(t.createdAt).getTime()))) : null;
  erStop = () => { if (watch != null) navigator.geolocation.clearWatch(watch); clearTimeout(slow); };
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
      ${a.coinsApplied ? `<div class="kv"><span class="k">🪙 ${a.coinsApplied} coins used</span><span class="v">−${money(a.coinsValue)} • ${a.paymentStatus === 'CASH_DUE' ? 'pay' : 'left'} <b>${money((Number(a.fee) + Number(a.serviceFee)) - a.coinsValue)}</b>${a.paymentStatus === 'CASH_DUE' ? ' in cash' : ''}</span></div>` : ''}
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

// Facilities from the national directory that have not joined N-Health yet.
const LISTING_CATS = {
  ALL: 'TEACHING_HOSPITAL,FEDERAL_MEDICAL_CENTRE,GENERAL_HOSPITAL,SPECIALIST_HOSPITAL,HOSPITAL,CLINIC,MATERNITY,DIAGNOSTIC,BLOOD_BANK,PHARMACY,EYE,DENTAL',
  INSTITUTION: 'TEACHING_HOSPITAL,FEDERAL_MEDICAL_CENTRE,GENERAL_HOSPITAL,SPECIALIST_HOSPITAL,HOSPITAL,CLINIC,PRIMARY_HEALTH_CENTRE,MATERNITY,EYE,DENTAL,BLOOD_BANK',
  LAB: 'DIAGNOSTIC,BLOOD_BANK', PHARMACY: 'PHARMACY',
};
const LISTING_ICON = { TEACHING_HOSPITAL: '🏛️', FEDERAL_MEDICAL_CENTRE: '🏥', GENERAL_HOSPITAL: '🏥', SPECIALIST_HOSPITAL: '🏥', HOSPITAL: '🏥', CLINIC: '🩺', PRIMARY_HEALTH_CENTRE: '🩺', HEALTH_POST: '🩺', MATERNITY: '🤱', DIAGNOSTIC: '🔬', BLOOD_BANK: '🩸', PHARMACY: '💊', DENTAL: '🦷', EYE: '👁️', NURSING_HOME: '🛏️', HMO: '🛡️', OTHER: '🏥' };
export function listingCard(x, opts = {}) {
  const where = [x.address, x.lga, x.state].filter(Boolean).join(', ');
  const invite = `Hello ${x.name}, patients are looking for you on N-Health. Join free and receive bookings: ${webOrigin()}/?ref=${encodeURIComponent(state.user?.referralCode || '')}`;
  return `<div class="card listing-card"><div class="row"><div class="avatar institution-avatar">${LISTING_ICON[x.category] || '🏥'}</div><div class="grow"><div style="font-weight:600">${esc(x.name)}</div>
      <div class="small muted">${esc(x.categoryLabel)}${x.ownership ? ' • ' + esc(x.ownership) : ''}${where ? ' • ' + esc(where) : ''}</div></div>${x.distanceKm != null ? `<div class="small" style="white-space:nowrap"><b>${x.distanceKm} km</b></div>` : ''}</div>
    ${x.bloodService === 'HOSPITAL' && opts.blood ? '<div class="small" style="color:#B71C1C;margin-top:4px">🩸 Hospital blood bank - call to confirm blood is available</div>' : x.bloodService === 'BLOOD_BANK' ? '<div class="small" style="color:#B71C1C;margin-top:4px">🩸 Blood bank / donation centre</div>' : ''}
    <div class="row mt8 wrap">${x.onNhealth ? `<span class="badge badge-success">On N-Health ✓</span><span class="grow"></span><button class="btn btn-primary btn-sm" data-go="/provider/${x.userId}">Open</button>` : '<span class="badge" style="background:#f1f3f4;color:#555">Not on N-Health yet</span><span class="grow"></span>'}
      ${x.lat != null ? `<a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${x.lat},${x.lng}">🧭 Directions</a>` : ''}
      ${x.phone ? `<a class="btn btn-outline btn-sm" href="tel:${esc(String(x.phone).split(',')[0].trim())}">📞 Call</a>` : ''}
      ${x.website ? `<a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="${esc(x.website)}">🌐</a>` : ''}
      <a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(invite)}" title="Invite them to N-Health">📨 Invite</a></div></div>`;
}

// ================= FIND: blood banks, insurance, medicines, hospitals, diagnostics =================
const FIND = {
  BLOOD: { chip: '🩸 Blood banks', title: '🩸 Blood banks & donation centres', cats: 'BLOOD', hint: 'Blood banks, donation centres and the hospitals that run their own blood bank. Call before you go.' },
  HMO: { chip: '🛡️ Insurance', title: '🛡️ Health insurance (HMOs)', cats: 'HMO', hint: 'All HMOs accredited by NHIA, with their contacts.' },
  MEDICINE: { chip: '💊 Medicines', title: '💊 Medicines', hint: 'Medicines in stock at pharmacies on N-Health. Prescription-only medicines need a prescription from your doctor.' },
  HOSPITAL: { chip: '🏥 Hospitals', title: '🏥 Hospitals & clinics', cats: 'TEACHING_HOSPITAL,FEDERAL_MEDICAL_CENTRE,GENERAL_HOSPITAL,SPECIALIST_HOSPITAL,HOSPITAL,CLINIC,MATERNITY' },
  DIAGNOSTIC: { chip: '🔬 Diagnostics', title: '🔬 Diagnostic centers', cats: 'DIAGNOSTIC' },
};
export async function findScreen(el, _p, q) {
  let type = FIND[q.type] ? q.type : 'BLOOD', qv = q.q || '', st = '';
  el.innerHTML = appBar({ title: '🔍 Find', back: '/patient/home' }) + `<div class="hscroll">${Object.entries(FIND).map(([k, v]) => `<span class="chip ${k === type ? 'active' : ''}" data-ft="${k}">${v.chip}</span>`).join('')}</div>
    <div class="form-group"><input id="fq" placeholder="🔍 Search by name" value="${esc(qv)}"></div>
    <div class="row mb8"><select id="fst" class="grow"><option value="">📍 Near me</option>${NG_STATES.map((x) => `<option>${x}</option>`).join('')}</select></div>
    <div class="small muted" id="fh" style="margin:0 4px 8px"></div><div id="fl">${skeleton(3)}</div>`;
  const load = async () => {
    const f = FIND[type];
    $('#fh', el).textContent = f.hint || '';
    $('#fq', el).placeholder = type === 'MEDICINE' ? '🔍 Medicine name, e.g. Amoxicillin' : '🔍 Search by name';
    const box = $('#fl', el); box.innerHTML = skeleton(3);
    const p = st ? null : await pos();
    if (type === 'MEDICINE') {
      if (qv.trim().length < 2) { box.innerHTML = empty('💊', 'Type the name of a medicine to see which pharmacies have it in stock.'); return; }
      const list = await get(`/medicines/search?q=${encodeURIComponent(qv.trim())}` + (p ? `&lat=${p.lat}&lng=${p.lng}` : '')).catch(() => []);
      box.innerHTML = list.length ? list.map((m) => card(`<div class="row"><div class="avatar pharmacy-avatar">💊</div><div class="grow"><div style="font-weight:600">${esc(m.name)}${m.brand ? ' <span class="small muted">(' + esc(m.brand) + ')</span>' : ''}</div>
          <div class="small muted">${esc(m.pharmacy.name)}${m.pharmacy.address ? ' • ' + esc(m.pharmacy.address) : ''}${m.distanceKm != null ? ' • ' + m.distanceKm + ' km' : ''}</div>
          ${m.requiresPrescription ? '<div class="small" style="color:var(--warning)">℞ Prescription required</div>' : ''}</div><div style="text-align:right"><b>${money(m.price)}</b><div class="small muted">${m.inStock} in stock</div></div></div>
          <div class="row mt8"><span class="grow small muted">${m.pharmacy.homeDelivery ? '🛵 Home delivery' : ''}</span><button class="btn btn-primary btn-sm" data-go="/patient/pharmacy/${m.pharmacy.id}">Order</button></div>`)).join('')
        : empty('💊', 'No pharmacy on N-Health has this in stock yet. Try another name or brand.');
      return;
    }
    if (!p && !st && qv.trim().length < 2 && type !== 'HMO') { box.innerHTML = empty('📍', 'Share your location or choose a state to see what is near you.'); return; }
    const url = `/facilities/search?limit=40&category=${f.cats}` + (qv.trim().length >= 2 ? '&q=' + encodeURIComponent(qv.trim()) : '') + (st ? '&state=' + encodeURIComponent(st) : '') + (p ? `&lat=${p.lat}&lng=${p.lng}` : '');
    const list = await get(url).catch(() => []);
    box.innerHTML = (type === 'BLOOD' ? `<div class="banner info" data-go="/patient/donations">❤️ Need blood urgently? Post a blood request and nearby donors are alerted.</div>` : '')
      + (list.length ? list.map((x) => listingCard(x, { blood: type === 'BLOOD' })).join('') + '<p class="small muted center">Data: GRID3 (CC BY 4.0), © OpenStreetMap contributors, NHIA, NBSA</p>' : empty('🔍', 'Nothing found here yet.'));
  };
  $$('[data-ft]', el).forEach((c) => (c.onclick = () => { type = c.dataset.ft; $$('[data-ft]', el).forEach((x) => x.classList.toggle('active', x === c)); load(); }));
  let t; $('#fq', el).oninput = (e) => { clearTimeout(t); qv = e.target.value; t = setTimeout(load, 350); };
  $('#fst', el).onchange = (e) => { st = e.target.value; load(); };
  await load();
}

// ================= PROVIDERS & FACILITIES =================
const TYPES = [['ALL', 'All'], ['DOCTOR', '👨‍⚕️ Doctors'], ['NURSE', '👩‍⚕️ Nurses'], ['PHARMACY', '💊 Pharmacies'], ['LAB', '🔬 Diagnostic centers'], ['AMBULANCE', '🚑 Ambulance'], ['INSTITUTION', '🏥 Facilities']];
export async function providersScreen(el, _p, q, facilitiesOnly = false) {
  let type = facilitiesOnly ? 'INSTITUTION' : q.type || 'ALL', sort = 'rating', qv = '';
  el.innerHTML = appBar({ title: facilitiesOnly ? '🏥 Facilities' : '🏥 Providers', back: '/patient/home' }) +
    `<div class="form-group"><input id="pq" placeholder="🔍 Search name, specialty, hospital…"></div>
    ${facilitiesOnly ? '' : `<div class="hscroll">${TYPES.map(([k, l]) => `<span class="chip ${k === type ? 'active' : ''}" data-t="${k}">${l}</span>`).join('')}</div>`}
    <div class="row between mb8"><span class="muted" id="cnt"></span><select id="sort" style="border:none;background:none;font-size:12px;color:var(--primary)"><option value="rating">Top rated</option><option value="distance">Nearest</option><option value="fee">Lowest fee</option></select></div>
    <div id="pl">${skeleton(4)}</div><div id="unl"></div>`;
  const load = async () => {
    const p = sort === 'distance' || ['INSTITUTION', 'LAB', 'PHARMACY'].includes(type) ? await pos() : myPos;
    const list = await get(`/directory?type=${type}&q=${encodeURIComponent(qv)}&sort=${sort}` + (p ? `&lat=${p.lat}&lng=${p.lng}` : ''));
    $('#cnt', el).textContent = list.length + ' found';
    $('#pl', el).innerHTML = list.length ? list.map((x) => x.role === 'INSTITUTION'
      ? `<div class="facility-card" data-go="/provider/${x.userId}"><div class="facility-header"><div><div class="facility-name">${esc(x.name)}</div><div class="facility-type">${esc(x.title)}</div></div>${verifiedBadge(x.verified)}</div><div class="facility-stats"><span>📍 ${esc(x.location || '—')}</span>${x.distanceKm != null ? `<span>${x.distanceKm} km</span>` : ''}<span>⭐ ${x.rating || 'New'}</span>${x.beds != null ? `<span>🛏️ ${x.beds} beds free</span>` : ''}${x.emergencyCare ? '<span>🚨 24h emergency</span>' : ''}</div></div>`
      : `<div class="provider-detail-card" data-go="/provider/${x.userId}"><div class="row">${avatar(x.role, x.avatarUrl)}<div class="grow"><div class="provider-name">${x.role === 'DOCTOR' ? 'Dr. ' : ''}${esc(x.name)} ${verifiedBadge(x.verified)}</div><div class="provider-specialty">${esc(x.title || '')}</div></div></div>
        <div class="provider-info"><div><span class="label">Rating</span> ⭐ ${x.rating || 'New'} (${x.reviewCount || 0})</div>${x.experience ? `<div><span class="label">Experience</span> ${x.experience} yrs</div>` : ''}${x.fee ? `<div><span class="label">Fee</span> ${money(x.fee)}</div>` : ''}${x.distanceKm != null ? `<div><span class="label">Distance</span> ${x.distanceKm} km</div>` : x.location ? `<div><span class="label">Location</span> ${esc(x.location)}</div>` : ''}</div></div>`).join('') : empty('🔍', 'No providers on N-Health match your search yet');
    // Facilities in Nigeria that are not on N-Health yet (public registries): still findable, with directions.
    const cats = LISTING_CATS[type];
    const box = $('#unl', el);
    if (!box) return;
    if (!cats || (!p && qv.trim().length < 2)) { box.innerHTML = ''; return; }
    const ls = await get(`/facilities/search?claimable=1&limit=10&category=${cats}` + (qv.trim().length >= 2 ? '&q=' + encodeURIComponent(qv.trim()) : '') + (p ? `&lat=${p.lat}&lng=${p.lng}` : '')).catch(() => []);
    box.innerHTML = ls.length ? `<div class="section-title" style="margin:14px 4px 6px">${qv.trim() ? 'Also in Nigeria' : 'Also near you'} <span class="small muted">(not on N-Health yet)</span></div>` + ls.map(listingCard).join('') + `<p class="small muted center">Facility data: GRID3 (CC BY 4.0), © OpenStreetMap contributors, NHIA, NBSA</p>` : '';
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
  <div class="kv"><span class="k"><b>Total</b></span><span class="v"><b>${money(o.total)}</b> ${badge(o.paymentStatus)}</span></div>${o.coinsApplied ? `<div class="kv"><span class="k">🪙 ${o.coinsApplied} coins used</span><span class="v">−${money(o.coinsValue)} • left <b>${money(Number(o.total) - o.coinsValue)}</b></span></div>` : ''}${o.declineReason ? `<div class="muted small">Reason: ${esc(o.declineReason)}</div>` : ''}
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
  el.innerHTML = appBar({ title: '🔬 Diagnostics', back: '/patient/home' }) + tabs([['book', '🧪 Book a test'], ['results', '📋 My tests & results']], tab) + '<div id="tb"></div>';
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
        <div class="row mt8">${x.paymentStatus === 'UNPAID' && x.status !== 'CANCELLED' ? `<button class="btn btn-lab btn-sm grow" data-paylab="${x.id}" data-amt="${x.fee}">💳 Pay ${money(Number(x.fee) - (x.coinsValue || 0))}${x.coinsApplied ? ' + ' + x.coinsApplied + ' 🪙' : ''}</button>` : ''}${x.result ? `<button class="btn btn-outline btn-sm grow" data-pdf="${x.id}">⬇️ Result PDF</button>` : ''}${x.status === 'COMPLETED' ? `<button class="btn btn-outline btn-sm grow" data-revl="${x.id}">⭐</button>` : ''}</div>`)).join('') : empty('🔬', 'No tests or scans yet');
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
    if (b.dataset.paylab && await payModal({ payableType: 'LAB_TEST', payableId: b.dataset.paylab, amount: Number(b.dataset.amt), title: 'Diagnostic test' })) draw();
    if (b.dataset.pdf) download('/lab-results/' + b.dataset.pdf + '/pdf', 'lab-result.pdf').catch(toastErr);
    if (b.dataset.revl) reviewModal({ contextType: 'LAB_TEST', contextId: b.dataset.revl, name: 'the diagnostic center' });
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
      tb.innerHTML = '<div class="banner info small">🩸 Blood is never bought or sold on N-Health. Donate free at a hospital or blood bank, and never pay or accept money for blood.</div>' + card(cardHead('✅ Check eligibility') + '<p class="muted mb8">Healthy adults 18-65 weighing 50kg+ can donate every 8 weeks.</p><button class="btn btn-danger btn-block btn-sm" id="elig">Am I eligible?</button><div id="er"></div>') +
        card(cardHead('🩸 Urgent blood requests') + (reqs.length ? reqs.map(campaignCard).join('') : empty('🩸', 'No open requests nearby'))) +
        card(cardHead('📍 Donation centers') + (centers.length ? centers.map((c) => `<div class="donation-location"><div class="name">${esc(c.name)}</div><div class="address">${esc(c.address)}${c.city ? ', ' + esc(c.city) : ''} • ${esc(c.hours || '')}</div><div class="row between"><span class="distance">${c.distanceKm != null ? c.distanceKm + ' km' : ''}</span><span><a class="link" href="tel:${esc(c.phone || '')}">📞</a> <button class="link" data-pledge-center="${c.id}" data-name="${esc(c.name)}">Book visit</button></span></div></div>`).join('') : empty('📍', 'No centers listed')));
      $('#elig', tb).onclick = () => formModal('🩸 Eligibility check', [
        { name: 'age', label: 'Age', type: 'number', required: true }, { name: 'weight', label: 'Weight (kg)', type: 'number', required: true },
        { name: 'gender', label: 'Sex', type: 'select', options: [['male', 'Male'], ['female', 'Female']] },
        { name: 'recentIllness', label: 'I was ill in the last 2 weeks', type: 'checkbox' }, { name: 'recentTattoo', label: 'Tattoo / piercing in the last 6 months', type: 'checkbox' }, { name: 'pregnant', label: 'Pregnant or gave birth in last 6 months', type: 'checkbox' },
      ], { submit: 'Check', onSubmit: async (v) => { const r = await post('/donations/eligibility', v); $('#er', tb).innerHTML = `<div class="eligibility-result ${r.eligible ? 'success' : ''} mt8"><div class="icon">${r.eligible ? '✅' : '⚠️'}</div><div class="title">${r.eligible ? 'You can donate!' : 'Not eligible right now'}</div><div class="details">${r.eligible ? 'Book a visit at a center below or answer an urgent request.' : r.reasons.map(esc).join('<br>')}</div></div>`; } });
    } else if (tab === 'organ') {
      const [reg, reqs] = await Promise.all([get('/donations/organ-registry'), get('/donations/campaigns?type=ORGAN' + ll)]);
      tb.innerHTML = card(cardHead('🫀 Organ donor registry') + (reg && reg.status === 'ACTIVE' ? `<div class="eligibility-result success"><div class="icon">💚</div><div class="title">You are a registered donor</div><div class="details">Card no. <b>${esc(reg.donorCardNo)}</b> • ${esc((reg.organs || []).join(', '))}${reg.livingDonor ? ' • living donor' : ''}</div></div><div class="row mt8"><button class="btn btn-outline btn-sm grow" id="orgedit">Update</button><button class="btn btn-outline btn-sm grow" id="orgw" style="color:var(--error)">Withdraw</button></div>` : `<p class="muted mb8">One donor can save up to 8 lives. Registering records your wishes - tell your family too.</p><p class="small muted mb8">This is a pledge register only. N-Health never matches donors with recipients: transplants are arranged by licensed hospitals under the National Health Act, and organs are never paid for.</p><button class="btn btn-success btn-block" id="orgedit">Register as a donor</button>`)) +
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
/** Who receives donations: the partner NGO when set, otherwise the campaign's hospital. */
const receiverText = (c) => { const ngo = state.config?.donationPartner; return ngo ? `${esc(ngo.name)}${ngo.regNumber ? ' (registered NGO, ' + esc(ngo.regNumber) + ')' : ' (registered NGO)'}` : esc(c?.institution?.name || 'the hospital'); };
function donateModal(c, after) {
  formModal('❤️ Donate to ' + esc(c.title), [
    { name: 'amount', label: 'Amount (₦)', type: 'number', required: true, min: 100, placeholder: '5000' },
    { name: 'message', label: 'Message of support (optional)' }, { name: 'anonymous', label: 'Donate anonymously', type: 'checkbox' },
  ], { submit: 'Continue', intro: `<p class="muted mb8">Your donation goes straight to ${receiverText(c)}. N-Health never holds donated money and takes no fee.</p>`, onSubmit: async (v) => {
    const r = await post('/donations/campaigns/' + c.id + '/donate', { ...v, amount: Math.floor(Number(v.amount)) });
    setTimeout(() => payDonation(r, after), 50);
  } });
}
/** Pay the receiver directly: card (settled 100% to their account) or bank transfer they confirm. */
function payDonation(r, after) {
  const who = `${esc(r.receiver.name)}${r.receiver.kind === 'NGO' ? ' (registered NGO' + (r.receiver.regNumber ? ', ' + esc(r.receiver.regNumber) : '') + ')' : ''}`;
  modal(`<div class="modal-title">💚 Pay ${money(r.amount, { naira: true })} to ${who}</div>
    ${r.card ? '<button class="btn btn-primary btn-block" id="dcard">💳 Pay by card, transfer or USSD</button><p class="small muted center mt8">Paid straight into their account by our licensed payment partner.</p>' : ''}
    ${r.bank ? `<div class="card mt8" style="background:var(--surface)"><div class="card-title" style="font-size:13px">🏦 Or send a bank transfer</div>
      <div class="kv"><span class="k">Bank</span><span class="v">${esc(r.bank.bankName)}</span></div>
      <div class="kv"><span class="k">Account number</span><span class="v"><b>${esc(r.bank.accountNumber)}</b></span></div>
      <div class="kv"><span class="k">Account name</span><span class="v">${esc(r.bank.accountName)}</span></div>
      <div class="kv"><span class="k">Reference</span><span class="v"><b>${esc(r.reference)}</b></span></div>
      <p class="small muted">Use the reference so your donation can be matched. It shows on the campaign once the receiver confirms it.</p>
      <button class="btn btn-outline btn-block" id="dsent">I've sent it</button></div>` : ''}
    ${!r.card && !r.bank ? '<div class="banner warn">The receiver hasn\'t added a bank account yet. Please try again later.</div>' : ''}`, (box, close) => {
    $('#dcard', box)?.addEventListener('click', (e) => busy(e.target, async () => {
      const p = await post('/payments/card', { payableType: 'DONATION', payableId: r.donationId, returnUrl: webOrigin() + '/' });
      sessionStorage.setItem('nh_paid', p.internalRef);
      if (p.checkoutUrl) location.href = p.checkoutUrl; else throw new Error('Checkout unavailable');
    }));
    $('#dsent', box)?.addEventListener('click', () => { close(); toast('💚 Thank you! It will show once the receiver confirms it.'); after?.(); });
  });
}
async function createCampaign(after) {
  // Money raised goes straight to the treating hospital (or the partner NGO), so patients pick the hospital.
  const ngo = state.config?.donationPartner;
  const hospitals = state.user.role === 'PATIENT' ? await get('/directory?type=INSTITUTION&q=&sort=rating').catch(() => []) : [];
  formModal('📣 Request donations', [
    { name: 'type', label: 'Type', type: 'select', options: [['BLOOD', '🩸 Blood request'], ['ORGAN', '🫀 Organ request'], ['PATIENT_CASE', '🧒 Patient medical bill'], ['FUND', '💰 Community fund']] },
    { name: 'title', label: 'Title', required: true, placeholder: 'e.g. O- blood needed for surgery at LUTH' },
    { name: 'description', label: 'Story / details', type: 'textarea', rows: 4, required: true },
    { name: 'beneficiaryName', label: 'Beneficiary' },
    ...(state.user.role === 'PATIENT' ? [{ name: 'hospitalId', label: ngo ? 'Treating hospital (optional)' : 'Treating hospital - required for money campaigns', type: 'select', options: [['', '—'], ...hospitals.filter((h) => h.profileId).map((h) => [h.profileId, h.name + (h.city ? ' - ' + h.city : '')])] }] : []),
    { name: 'bloodType', label: 'Blood group needed', type: 'select', options: [['', '—'], ...BLOOD] }, { name: 'organ', label: 'Organ needed', type: 'select', options: [['', '—'], ...ORGANS] },
    { name: 'unitsNeeded', label: 'Units / donors needed', type: 'number' }, { name: 'goalAmount', label: 'Goal amount (₦) - for money campaigns', type: 'number' },
    { name: 'urgency', label: 'Urgency', type: 'select', options: ['NORMAL', 'URGENT', 'CRITICAL'] }, { name: 'location', label: 'Hospital / location' },
    { name: 'contactName', label: 'Contact person' }, { name: 'contactPhone', label: 'Contact phone', type: 'tel' }, { name: 'deadline', label: 'Needed by', type: 'date' },
  ], { submit: 'Submit for review', intro: `<div class="banner info">To protect donors, campaigns are reviewed by N-Health before going live (usually within 24h). Institutions go live instantly.<br>Money donations are paid straight to ${ngo ? esc(ngo.name) + ' (our registered NGO partner)' : 'the treating hospital'}, never to individuals or N-Health. Blood and organs are never bought or sold.</div>`, onSubmit: async (v) => {
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
    ${money_ ? `<div class="banner info small">💚 Donations go straight to ${receiverText(c)}. N-Health takes no fee and never holds the money.</div>` : '<div class="banner info small">🩸 Donating blood or organs is always free: never pay or accept money for them.</div>'}
    ${money_ ? `<div class="progress-bar"><div class="fill primary" style="width:${pct}%"></div></div><div class="row between small mt8"><b>${money(c.raisedAmount)} raised</b><span class="muted">of ${money(c.goalAmount)} • ${c.donorCount} donors</span></div>` : `<div class="kv"><span class="k">Needed</span><span class="v">${esc(c.bloodType || c.organ || '')} • ${c.unitsPledged}/${c.unitsNeeded || '?'} pledged</span></div>`}
    ${c.location ? `<div class="kv"><span class="k">Location</span><span class="v">${esc(c.location)}</span></div>` : ''}${c.deadline ? `<div class="kv"><span class="k">Needed by</span><span class="v">${dateOnly(c.deadline)}</span></div>` : ''}
    <div class="kv"><span class="k">Contact</span><span class="v">${esc(c.contactName || c.organizer?.name || '')} ${c.contactPhone || c.organizer?.phone ? `• <a href="tel:${esc(c.contactPhone || c.organizer.phone)}">${esc(c.contactPhone || c.organizer.phone)}</a>` : ''}</span></div>
    <div class="row mt12">${c.status === 'ACTIVE' && !mine ? (money_ ? '<button class="btn btn-primary grow" id="give">❤️ Donate</button>' : '<button class="btn btn-danger grow" id="pledge">🩸 I can donate</button>') : ''}${!mine ? `<button class="btn btn-outline grow" data-go="/chat/${c.organizerId}">💬 Contact</button>` : ''}<button class="btn btn-outline" id="share">↗️</button></div>`) +
    (money_ && c.institution?.userId === state.user.id && !state.config?.donationPartner ? '<div id="tr"></div>' : '') +
    (c.donations?.length ? card(cardHead('💚 Recent donations') + c.donations.map((d) => item({ icon: '💚', title: esc(d.donor) + ' • ' + money(d.amount), sub: esc(d.message || '') + ' ' + ago(d.createdAt) })).join('')) : '') + (mine ? '<div id="pl"></div>' : '');
  $('#give', el)?.addEventListener('click', () => donateModal(c, () => campaignScreen(el, { id })));
  $('#pledge', el)?.addEventListener('click', () => formModal('🩸 Pledge to donate', [{ name: 'scheduledAt', label: 'When can you come?', type: 'datetime-local', required: true }], { submit: 'Pledge', onSubmit: async (v) => { const r = await post('/donations/pledges', { type: c.type, campaignId: c.id, scheduledAt: new Date(v.scheduledAt).toISOString() }); modal(`<div class="eligibility-result success"><div class="icon">💚</div><div class="title">Thank you!</div><div class="details">Contact <b>${esc(r.contact?.name || '')}</b>${r.contact?.phone ? ` on <a href="tel:${esc(r.contact.phone)}">${esc(r.contact.phone)}</a>` : ''} at ${esc(r.contact?.location || '')} to confirm.</div></div>`); } }));
  $('#share', el).onclick = () => { const text = `${c.title} - help via N-Health: ${webOrigin()}/#/donations/campaign/${c.id}`; navigator.share ? navigator.share({ text }).catch(() => null) : navigator.clipboard?.writeText(text).then(() => toast('📋 Link copied')); };
  // The receiving hospital confirms bank transfers that reached its account.
  if ($('#tr', el)) {
    const tr = await get('/donations/campaigns/' + id + '/transfers').catch(() => []);
    $('#tr', el).innerHTML = card(cardHead('🏦 Transfers to confirm') + (tr.length ? tr.map((x) => item({ icon: '🏦', title: money(x.amount, { naira: true }) + ' • ' + esc(x.reference), sub: (x.anonymous ? 'Anonymous' : esc(x.patient?.user?.name || '')) + ' • ' + ago(x.createdAt), trailing: `<button class="btn btn-success btn-sm" data-rcv="${x.id}">Received</button>` })).join('') : '<p class="muted small">No transfers waiting. Card donations confirm automatically.</p>'));
    $('#tr', el).onclick = async (e) => { const b = e.target.closest('[data-rcv]'); if (b) await busy(b, async () => { await post('/donations/' + b.dataset.rcv + '/received'); toast('✅ Confirmed'); campaignScreen(el, { id }); }); };
  }
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
    card(cardHead('📋 My policies', '<button class="link" id="addp">+ Add existing</button>') + (mine.length ? mine.map((x) => `${item({ icon: '🛡️', title: esc(x.plan?.name || x.provider), sub: esc(x.policyNumber) + (x.premiumAmount ? ' • ' + money(x.premiumAmount) + '/mo' : '') + (x.expiresAt ? ' • expires ' + dateOnly(x.expiresAt) : ''), trailing: badge(x.status) })}${x.status === 'REQUESTED' ? `<p class="small muted mb8">Sent to ${esc(x.provider)}. They will contact you to complete enrolment; you pay the HMO directly.</p>` : ''}`).join('') : empty('🛡️', 'No policies yet'))) +
    card(cardHead('🛡️ Accredited HMOs in Nigeria', '<button class="link" id="hmos">See all</button>') + '<p class="small muted" style="margin:0">All health maintenance organisations accredited by NHIA, with their contacts. Source: NHIA.</p>') +
        card(cardHead('🏥 Health schemes') + plans.map((pl) => `<div class="provider-detail-card"><div class="row between"><div><div class="provider-name">${esc(pl.name)}</div><div class="provider-specialty">${esc(pl.provider)} • ${esc(pl.type)}</div></div><div class="provider-fee">${Number(pl.monthlyPremium) ? money(pl.monthlyPremium) + '/mo' : 'Free'}</div></div><p class="muted small mt8">${esc(pl.description || '')}</p><div class="row wrap mt8">${(pl.coverage || []).map((c) => `<span class="chip">✓ ${esc(c)}</span>`).join('')}</div><button class="btn btn-primary btn-sm btn-block mt8" data-enrol="${pl.id}" data-name="${esc(pl.name)}" data-fam="${/family/i.test(pl.name) ? 1 : 0}">Request enrolment</button></div>`).join(''));
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-enrol],#addp'); if (!b) return;
    if (b.id === 'addp') return formModal('Add an existing policy', [{ name: 'provider', label: 'Insurer / HMO', required: true }, { name: 'policyNumber', label: 'Policy / member number', required: true }, { name: 'coverageDetails', label: 'Coverage notes' }, { name: 'expiresAt', label: 'Expiry date', type: 'date' }], { onSubmit: async (v) => { await post('/patient/insurance', { ...v, expiresAt: v.expiresAt ? new Date(v.expiresAt).toISOString() : undefined }); insuranceScreen(el); } });
    if (b.dataset.enrol) formModal('Join ' + esc(b.dataset.name), [{ name: 'memberCount', label: 'People to cover', type: 'number', value: b.dataset.fam === '1' ? 4 : 1, min: 1 }, { name: 'note', label: 'Anything the HMO should know (optional)' }, { name: 'share', label: 'Share my health profile with the HMO', type: 'checkbox', value: true }], { submit: 'Send request', intro: '<p class="muted mb8">N-Health passes your request to the HMO. The HMO enrols you and you pay your premium to the HMO directly.</p>', onSubmit: async (v) => { if (v.share) await patch('/auth/profile', { insuranceShareConsent: true }).catch(() => null); await post('/insurance/plans/' + b.dataset.enrol + '/enrol', { memberCount: Number(v.memberCount) || 1, note: v.note || undefined }); toast('✅ Request sent - the HMO will contact you'); insuranceScreen(el); } });
  });
  $('#hmos', el).onclick = async () => {
    const all = await get('/facilities/search?category=HMO&limit=100');
    modal(`<div class="modal-title">🛡️ NHIA-accredited HMOs (${all.length})</div><input id="hq" placeholder="🔍 Search HMO or state" class="mb8" style="width:100%"><div id="hl" style="max-height:60vh;overflow:auto"></div>`, (root) => {
      const draw = (q = '') => { const ql = q.toLowerCase(); $('#hl', root).innerHTML = all.filter((h) => !ql || (h.name + ' ' + (h.state || '') + ' ' + (h.address || '')).toLowerCase().includes(ql)).map(listingCard).join('') || empty('🛡️', 'No HMO matches'); };
      draw(); $('#hq', root).oninput = (e) => draw(e.target.value);
    });
  };
}

// ================= HEALTH RECORDS =================
const savedOrQueued = (r) => { if (r?.queued) toast('📤 Saved offline - it will appear here once you are back online'); return r; };
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
      ], { onSubmit: async (v) => { savedOrQueued(await postLater('/health/reminders', { ...v, times: v.times.split(',').map((s) => s.trim()).filter(Boolean), endDate: v.endDate ? new Date(v.endDate).toISOString() : undefined, refillAt: v.refillAt ? new Date(v.refillAt + 'T09:00').toISOString() : undefined })); draw(); } });
    } else if (tab === 'family') {
      const f = await get('/health/family');
      tb.innerHTML = `<button class="btn btn-primary btn-block btn-sm mb8" id="addf">+ Add family member</button>` + (f.length ? card(f.map((x) => item({ icon: '👤', title: esc(x.name), sub: esc(x.relationship) + (x.dateOfBirth ? ' • ' + dateOnly(x.dateOfBirth) : '') + (x.bloodType ? ' • ' + esc(x.bloodType) : '') + (x.genotype ? ' • ' + esc(x.genotype) : ''), trailing: `<button class="link" data-delf="${x.id}">Remove</button>` })).join('')) : empty('👨‍👩‍👧', 'Manage care for children, parents and dependants'));
      $('#addf', tb).onclick = () => formModal('Add family member', [
        { name: 'name', label: 'Name', required: true }, { name: 'relationship', label: 'Relationship', type: 'select', options: ['Child', 'Spouse', 'Parent', 'Sibling', 'Grandparent', 'Other'] },
        { name: 'dateOfBirth', label: 'Date of birth', type: 'date' }, { name: 'gender', label: 'Sex', type: 'select', options: [['', '—'], 'Female', 'Male'] },
        { name: 'bloodType', label: 'Blood group', type: 'select', options: [['', '—'], ...BLOOD] }, { name: 'genotype', label: 'Genotype', type: 'select', options: [['', '—'], ...GENOTYPES] },
        { name: 'allergies', label: 'Allergies' }, { name: 'conditions', label: 'Conditions' },
      ], { onSubmit: async (v) => { savedOrQueued(await postLater('/health/family', v)); draw(); } });
    } else if (tab === 'vaccines') {
      const v = await get('/health/vaccinations');
      tb.innerHTML = `<button class="btn btn-primary btn-block btn-sm mb8" id="addv">+ Record vaccination</button>` + (v.length ? card(v.map((x) => item({ icon: '💉', title: esc(x.vaccine) + (x.dose ? ' • ' + esc(x.dose) : ''), sub: (x.givenAt ? 'Given ' + dateOnly(x.givenAt) : '') + (x.nextDueAt ? ' • Next due ' + dateOnly(x.nextDueAt) : '') + (x.provider ? ' • ' + esc(x.provider) : ''), trailing: `<button class="link" data-delv="${x.id}">🗑️</button>` })).join('')) : empty('💉', 'Keep track of immunisations (BCG, Polio, Hep B, Yellow fever, HPV, COVID-19…)'));
      $('#addv', tb).onclick = () => formModal('💉 Vaccination', [{ name: 'vaccine', label: 'Vaccine', required: true }, { name: 'dose', label: 'Dose', placeholder: 'Dose 1 / Booster' }, { name: 'givenAt', label: 'Date given', type: 'date' }, { name: 'nextDueAt', label: 'Next dose due', type: 'date' }, { name: 'provider', label: 'Where' }], { onSubmit: async (val) => { savedOrQueued(await postLater('/health/vaccinations', { ...val, givenAt: val.givenAt || undefined, nextDueAt: val.nextDueAt || undefined })); draw(); } });
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
      const url = `${webOrigin()}/#/e/${token}`;
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
    if (b.dataset.taken || b.dataset.skip) { const r = await postLater('/health/reminders/' + (b.dataset.taken || b.dataset.skip) + '/log', { status: b.dataset.taken ? 'taken' : 'skipped' }); toast(r?.queued ? '📤 Saved offline - will sync when online' : b.dataset.taken ? '✓ Logged' : 'Skipped'); }
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
