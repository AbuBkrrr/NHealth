import { get, post, patch, put, del, download, auth, API_BASE } from '../lib/api.js';
import { state, setState } from '../lib/store.js';
import { esc, $, $$, appBar, card, cardHead, item, avatar, badge, empty, skeleton, toast, toastErr, formModal, modal, confirmBox, busy, dt, ago, relDay, dateOnly, timeOnly, money, coins, fileToDataUri, pickFile, field, readForm, tabs, closeModal } from '../lib/ui.js';
import { on, emit } from '../lib/realtime.js';
import { go, home } from '../lib/router.js';
import { enablePush } from '../lib/push.js';
import { logout, refreshMe, refreshUnread } from '../main.js';
import { LANGS } from '../lib/i18n.js';
import { COUNTRIES, BLOOD, GENOTYPES, ROLE_CLS, SPECIALTIES, NG_STATES } from './data.js';
import { legal } from './auth.js';

const roleCls = () => ROLE_CLS[state.user?.role] || '';
const isProvider = () => !['PATIENT', 'ADMIN'].includes(state.user?.role);

// ================= NOTIFICATIONS =================
const N_ICON = { appointment: '📅', payment: '💳', order: '📦', lab: '🔬', emergency: '🚨', message: '💬', system: 'ℹ️', reminder: '💊', kyc: '🪪', donation: '❤️' };
export async function notificationsScreen(el) {
  el.innerHTML = appBar({ title: '🔔 Notifications', back: true, actions: '<button class="action" id="readall">Mark all read</button>' }) + `<div id="list">${skeleton(4)}</div>`;
  const load = async () => {
    const r = await get('/notifications?limit=100');
    $('#list', el).innerHTML = r.items.length ? card(r.items.map((n) => item({
      icon: N_ICON[n.type] || '🔔', title: (n.readAt ? '' : '<b style="color:var(--primary)">● </b>') + esc(n.title), sub: esc(n.body) + ' • ' + ago(n.createdAt), attrs: `data-n="${n.id}" data-type="${n.type}" data-ref='${esc(JSON.stringify(n.data || {}))}'`,
    })).join('')) : empty('🔕', 'No notifications yet');
    setState({ unread: r.unread });
  };
  await load();
  $('#readall', el).onclick = async () => { await post('/notifications/read-all'); setState({ unread: 0 }); load(); };
  el.addEventListener('click', async (e) => {
    const n = e.target.closest('[data-n]');
    if (!n) return;
    post('/notifications/' + n.dataset.n + '/read').then(refreshUnread).catch(() => null);
    const d = JSON.parse(n.dataset.ref || '{}'), r = state.user.role;
    const t = n.dataset.type;
    if (t === 'message' && d.partnerId) return go('/chat/' + d.partnerId);
    if (t === 'appointment') return go(r === 'DOCTOR' ? '/doctor/requests' : r === 'NURSE' ? '/nurse/requests' : r === 'PATIENT' ? '/patient/appointments' : home());
    if (t === 'order') return go(r === 'PHARMACY' ? '/pharmacy/orders' : '/patient/orders');
    if (t === 'lab') return go(r === 'LAB' ? '/lab/tests' : r === 'DOCTOR' ? '/doctor/lab-results' : '/patient/labs?tab=results');
    if (t === 'emergency') return go(r === 'AMBULANCE' ? '/ambulance/requests' : '/patient/emergency');
    if (t === 'payment') return go(r === 'PATIENT' ? '/patient/wallet' : '/provider/earnings');
    if (t === 'kyc') return go('/kyc');
    if (t === 'donation') return go(d.campaignId ? '/donations/campaign/' + d.campaignId : '/patient/donations');
    if (t === 'reminder') return go('/patient/records?tab=reminders');
  });
  return on('notification', load);
}

// ================= MESSAGES =================
export async function messagesScreen(el) {
  el.innerHTML = appBar({ title: '💬 Messages', back: true, roleCls: roleCls(), actions: '<button class="action" id="new">+ New</button>' }) + `<div id="list">${skeleton(4)}</div>`;
  const load = async () => {
    const list = await get('/messages/conversations');
    $('#list', el).innerHTML = list.length ? card(list.map((c) => item({
      avatarHtml: avatar(c.partner.role, c.partner.avatarUrl), title: esc(c.partner.name) + (c.unread ? ' <span class="badge badge-error">new</span>' : ''),
      sub: esc((c.lastMessage || '').slice(0, 60)) + ' • ' + ago(c.lastMessageAt), attrs: `data-go="/chat/${c.partnerId}"`,
    })).join('')) : empty('💬', state.user.role === 'PATIENT' ? 'No conversations yet. Message a provider from their profile.' : 'No conversations yet.');
  };
  await load();
  $('#new', el).onclick = () => go(state.user.role === 'PATIENT' ? '/patient/providers' : state.user.role === 'DOCTOR' ? '/doctor/patients' : '/patient/providers');
  return on('message:new', load);
}

export async function chatScreen(el, { id }) {
  const partner = await get('/directory/' + id).catch(() => null);
  const name = partner?.name || 'Conversation';
  el.innerHTML = appBar({ title: esc(name), back: '/messages', roleCls: roleCls(), actions: partner?.phone ? `<a class="action" href="tel:${esc(partner.phone)}" aria-label="Call">📞</a>` : null }) +
    `<div class="chat" id="chat">${skeleton(3)}</div><div class="thumbs" id="thumbs"></div>
    <form class="composer" id="composer"><button type="button" class="attach" id="attach" aria-label="Attach photo or video">📎</button><input type="text" id="msg" placeholder="Type a message…" autocomplete="off" maxlength="4000"><button type="submit" aria-label="Send">➤</button></form>`;
  const chat = $('#chat', el);
  let pending = [];
  const bubble = (m) => {
    const me = m.senderId === state.user.id;
    const atts = (m.attachments || []).map((a) => String(a.type).startsWith('video') ? `<video src="${esc(a.url)}" controls preload="metadata"></video>` : String(a.type).startsWith('image') ? `<a href="${esc(a.url)}" target="_blank" rel="noopener"><img src="${esc(a.url)}" alt="attachment" loading="lazy"></a>` : `<a href="${esc(a.url)}" target="_blank" rel="noopener">📎 ${esc(a.name || 'file')}</a>`).join('');
    return `<div class="bubble ${me ? 'me' : 'them'}">${esc(m.content)}${atts}<div class="time">${timeOnly(m.createdAt)}${me && m.isRead ? ' ✓✓' : ''}</div></div>`;
  };
  const load = async () => {
    const msgs = await get('/messages/conversations/' + id);
    chat.innerHTML = msgs.length ? msgs.map(bubble).join('') : empty('👋', 'Say hello. You can send photos and short videos (max 25MB).');
    el.scrollTop = el.scrollHeight;
  };
  await load();
  $('#attach', el).onclick = async () => {
    const f = await pickFile('image/*,video/*');
    if (!f) return;
    try { pending.push({ dataUri: await fileToDataUri(f), name: f.name }); $('#thumbs', el).innerHTML = pending.map((p) => `<span>📎 ${esc(p.name.slice(0, 18))}</span>`).join(''); } catch (e) { toastErr(e); }
  };
  let typingAt = 0;
  $('#msg', el).oninput = () => { if (Date.now() - typingAt > 2500) { typingAt = Date.now(); emit('message:typing', { to: id }); } };
  $('#composer', el).onsubmit = async (e) => {
    e.preventDefault();
    const input = $('#msg', el); const content = input.value.trim();
    if (!content && !pending.length) return;
    const btn = e.target.querySelector('[type=submit]');
    await busy(btn, async () => {
      if (pending.length) toast('Uploading…');
      await post('/messages', { receiverId: id, content, attachments: pending.length ? pending : undefined });
      input.value = ''; pending = []; $('#thumbs', el).innerHTML = '';
      await load();
    });
  };
  const offs = [
    on('message:new', (m) => { if (m.senderId === id) { load(); post('/notifications/read-all').catch(() => null); } }),
    on('message:read', (d) => { if (d.by === id) load(); }),
    on('message:typing', (d) => { if (d.from === id) { const t = el.querySelector('.app-bar .title'); t.textContent = 'typing…'; setTimeout(() => (t.textContent = name), 2500); } }),
  ];
  return () => offs.forEach((f) => f());
}

// ================= PROFILE =================
export async function profileScreen(el) {
  const me = await refreshMe().catch(() => state.user);
  const p = me.patientProfile || {};
  const role = state.user.role;
  const kyc = me.kycStatus || 'NOT_STARTED';
  const ver = me.verificationStatus;
  el.innerHTML = appBar({ title: '👤 Profile', back: true, roleCls: roleCls(), actions: '<button class="action" data-go="/settings">⚙️</button>' }) + `
    <div class="card center">
      <div id="av" style="width:84px;height:84px;border-radius:50%;margin:0 auto 8px;background:var(--primary-light);display:flex;align-items:center;justify-content:center;font-size:36px;overflow:hidden;cursor:pointer" title="Change photo">${me.avatarUrl ? `<img src="${esc(me.avatarUrl)}" style="width:100%;height:100%;object-fit:cover" alt="">` : '👤'}</div>
      <button class="link" id="chg">📷 Change Photo</button>
      <div style="font-weight:700;font-size:16px;margin-top:6px">${esc(me.name)}</div>
      <div class="muted">${esc(me.email)}${me.emailVerified ? ' ✅' : ''}</div>
      <div class="row wrap mt8" style="justify-content:center">${badge(role)} ${kyc === 'APPROVED' ? '<span class="badge badge-verified">🪪 ID verified</span>' : badge(kyc === 'NOT_STARTED' ? 'PENDING' : kyc, 'KYC: ' + kyc.replace('_', ' ').toLowerCase())} ${isProvider() ? badge(ver, ver === 'VERIFIED' ? '✓ Verified provider' : 'Provider: ' + String(ver).toLowerCase()) : ''}</div>
    </div>
    ${!me.emailVerified ? `<div class="banner warn">📧 Verify your email to secure your account.<button class="btn btn-sm btn-primary" id="ve">Verify</button></div>` : ''}
    ${kyc !== 'APPROVED' ? `<div class="banner info">🪪 Verify your identity with a government-issued ID (NIN, passport, driver's licence, voter's card).<button class="btn btn-sm btn-primary" data-go="/kyc">Start</button></div>` : ''}
    ${isProvider() && ver !== 'VERIFIED' ? `<div class="banner warn">⚕️ Upload your licence documents so patients can book you.<button class="btn btn-sm btn-primary" data-go="/kyc">Upload</button></div>` : ''}
    ${(me.roles || []).length > 1 ? card(cardHead('🔁 Switch account') + `<div class="row wrap">${me.roles.filter((r) => r !== 'ADMIN' || me.isSuperAdmin || r === role).map((r) => `<span class="chip ${r === role ? 'active' : ''}" data-switch="${r}">${r.toLowerCase()}</span>`).join('')}</div>`) : ''}
    ${card(cardHead('📝 Personal information', '<button class="link" id="editp">Edit</button>') + `
      <div class="kv"><span class="k">Phone</span><span class="v">${esc(me.phone || '—')}${me.phone && !me.phoneVerified ? ' <button class="link" id="vp">verify</button>' : me.phone ? ' ✅' : ''}</span></div>
      <div class="kv"><span class="k">Country</span><span class="v">${esc((COUNTRIES.find((c) => c[0] === me.country) || [])[1] || me.country)}</span></div>
      ${role === 'PATIENT' ? `
      <div class="kv"><span class="k">Date of birth</span><span class="v">${p.dateOfBirth ? dateOnly(p.dateOfBirth) : '—'}</span></div>
      <div class="kv"><span class="k">Gender</span><span class="v">${esc(p.gender || '—')}</span></div>
      <div class="kv"><span class="k">Location</span><span class="v">${esc([p.address, p.city, p.state].filter(Boolean).join(', ') || '—')}</span></div>
      <div class="kv"><span class="k">Occupation</span><span class="v">${esc(p.occupation || '—')}</span></div>
      <div class="kv"><span class="k">National ID</span><span class="v">${p.nationalIdLast4 ? esc((p.nationalIdType || 'ID') + ' •••• ' + p.nationalIdLast4) : '—'}</span></div>` : ''}
    `)}
    ${role === 'PATIENT' ? card(cardHead('🩺 Health information', '<button class="link" id="edith">Edit</button>') + `
      <div class="kv"><span class="k">Blood Group</span><span class="v">${esc(p.bloodType || '—')}</span></div>
      <div class="kv"><span class="k">Genotype</span><span class="v">${esc(p.genotype || '—')}</span></div>
      <div class="kv"><span class="k">Height / Weight</span><span class="v">${p.height ? p.height + ' cm' : '—'} / ${p.weight ? p.weight + ' kg' : '—'}</span></div>
      <div class="kv"><span class="k">Allergies</span><span class="v">${esc(p.allergies || 'None recorded')}</span></div>
      <div class="kv"><span class="k">Chronic conditions</span><span class="v">${esc(p.chronicConditions || '—')}</span></div>
      <div class="kv"><span class="k">Current medications</span><span class="v">${esc(p.currentMedications || '—')}</span></div>
      <div class="kv"><span class="k">NHIS / NHIA no.</span><span class="v">${esc(p.nhisNumber || '—')}</span></div>
      <div class="kv"><span class="k">Emergency contact</span><span class="v">${esc([p.emergencyContact, p.emergencyPhone].filter(Boolean).join(' • ') || '—')}</span></div>
      <label class="check"><input type="checkbox" id="share" ${p.insuranceShareConsent ? 'checked' : ''}> <span>Share my health profile with my insurer and the providers I book</span></label>
      <div class="row mt8"><button class="btn btn-outline btn-sm grow" data-go="/patient/records">📁 Health records</button><button class="btn btn-outline btn-sm grow" data-go="/patient/records?tab=card">🆘 Emergency ID</button></div>
    `) : ''}
    ${isProvider() ? `<div id="provcard">${skeleton(1)}</div>` : ''}
    ${card(`
      ${item({ icon: '🔔', title: 'Notifications', attrs: 'data-go="/notifications"' })}
      ${item({ icon: '💬', title: 'Messages', attrs: 'data-go="/messages"' })}
      ${role === 'PATIENT' ? item({ icon: '💰', title: 'Coins & history', attrs: 'data-go="/patient/wallet"' }) : item({ icon: '💰', title: 'Earnings & payouts', attrs: 'data-go="/provider/earnings"' })}
      ${item({ icon: '🏥', title: 'Affiliations & invitations', attrs: 'data-go="/affiliations"' })}
      ${item({ icon: '🎁', title: 'Invite friends', sub: me.referralCode ? 'Your code: ' + esc(me.referralCode) : '', attrs: 'id="ref"' })}
      ${item({ icon: '📚', title: 'Health tips', attrs: 'data-go="/articles"' })}
      ${item({ icon: '🆘', title: 'Help & support', attrs: 'data-go="/support"' })}
      ${item({ icon: '⚙️', title: 'Settings & privacy', attrs: 'data-go="/settings"' })}
    `)}
    <button class="btn btn-danger btn-block mt8" id="logout">🚪 Logout</button>
    <p class="muted center small mt12">N-Health v2.0 • <a href="#" id="tos">Terms</a> • <a href="#" id="pp">Privacy</a></p>`;

  const changePhoto = async () => {
    const f = await pickFile('image/*'); if (!f) return;
    try { toast('Uploading…'); const dataUri = await fileToDataUri(f, { maxDim: 600 }); const up = await post('/uploads', { dataUri, folder: 'avatars' }); await post('/account/avatar-url', { url: up.url }); toast('✅ Photo updated'); profileScreen(el); } catch (e) { toastErr(e); }
  };
  $('#av', el).onclick = changePhoto; $('#chg', el).onclick = changePhoto;
  $('#logout', el).onclick = async () => { if (await confirmBox('Log out of N-Health?', { ok: 'Logout', danger: true })) logout('👋 Logged out'); };
  $('#tos', el).onclick = (e) => { e.preventDefault(); legal('terms'); };
  $('#pp', el).onclick = (e) => { e.preventDefault(); legal('privacy'); };
  $('#ref', el).onclick = async () => {
    const text = `Join me on N-Health - doctors, pharmacies, labs and emergency help in one app. Use my code ${me.referralCode}: ${location.origin}`;
    if (navigator.share) navigator.share({ title: 'N-Health', text }).catch(() => null); else { await navigator.clipboard?.writeText(text); toast('📋 Invite copied'); }
  };
  $('#ve', el)?.addEventListener('click', verifyEmail);
  $('#vp', el)?.addEventListener('click', verifyPhone);
  $$('[data-switch]', el).forEach((c) => (c.onclick = async () => {
    if (c.dataset.switch === role) return;
    try { const r = await post('/auth/switch-role', { role: c.dataset.switch }); auth.token = r.token; auth.user = r.user; setState({ user: r.user }); location.hash = home(r.user.role); location.reload(); } catch (e) { toastErr(e); }
  }));
  $('#editp', el).onclick = () => formModal('Edit personal information', [
    { name: 'name', label: 'Full name', value: me.name, required: true },
    { name: 'phone', label: 'Phone', type: 'tel', value: me.phone || '' },
    ...(role === 'PATIENT' ? [
      { name: 'dateOfBirth', label: 'Date of birth', type: 'date', value: p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : '' },
      { name: 'gender', label: 'Gender', type: 'select', options: [['', '—'], 'Female', 'Male', 'Other', 'Prefer not to say'], value: p.gender || '' },
      { name: 'maritalStatus', label: 'Marital status', type: 'select', options: [['', '—'], 'Single', 'Married', 'Divorced', 'Widowed'], value: p.maritalStatus || '' },
      { name: 'occupation', label: 'Occupation', value: p.occupation || '' },
      { name: 'address', label: 'Address', value: p.address || '' },
      { name: 'city', label: 'City', value: p.city || '' },
      { name: 'state', label: 'State / Region', value: p.state || '' },
      { name: 'nationalIdType', label: 'ID type', type: 'select', options: [['', '—'], 'NIN', 'Passport', "Driver's licence", "Voter's card", 'Other'], value: p.nationalIdType || '' },
      { name: 'nationalIdNumber', label: 'ID number (only last 4 digits stored)', placeholder: p.nationalIdLast4 ? '•••• ' + p.nationalIdLast4 : '' },
    ] : []),
  ], { onSubmit: async (v) => { await patch('/auth/profile', v); toast('✅ Saved'); profileScreen(el); } });
  $('#edith', el)?.addEventListener('click', () => formModal('Edit health information', [
    { name: 'bloodType', label: `Blood group (changes left: ${2 - (p.bloodTypeChanges || 0)})`, type: 'select', options: [['', '—'], ...BLOOD], value: p.bloodType || '' },
    { name: 'genotype', label: `Genotype (changes left: ${2 - (p.genotypeChanges || 0)})`, type: 'select', options: [['', '—'], ...GENOTYPES], value: p.genotype || '' },
    { name: 'height', label: 'Height (cm)', type: 'number', value: p.height || '' },
    { name: 'weight', label: 'Weight (kg)', type: 'number', value: p.weight || '' },
    { name: 'allergies', label: 'Allergies', type: 'textarea', value: p.allergies || '' },
    { name: 'chronicConditions', label: 'Chronic conditions', type: 'textarea', value: p.chronicConditions || '', placeholder: 'e.g. Hypertension, Asthma' },
    { name: 'currentMedications', label: 'Current medications', type: 'textarea', value: p.currentMedications || '' },
    { name: 'surgeries', label: 'Past surgeries', type: 'textarea', value: p.surgeries || '' },
    { name: 'familyHistory', label: 'Family medical history', type: 'textarea', value: p.familyHistory || '' },
    { name: 'disabilities', label: 'Disabilities / accessibility needs', value: p.disabilities || '' },
    { name: 'nhisNumber', label: 'NHIS / NHIA number', value: p.nhisNumber || '' },
    { name: 'emergencyContact', label: 'Emergency contact name', value: p.emergencyContact || '' },
    { name: 'emergencyPhone', label: 'Emergency contact phone', type: 'tel', value: p.emergencyPhone || '' },
  ], { onSubmit: async (v) => { const b = { ...v }; ['height', 'weight'].forEach((k) => { b[k] = b[k] === '' ? undefined : Number(b[k]); }); if (!b.bloodType) delete b.bloodType; if (!b.genotype) delete b.genotype; await patch('/auth/profile', b); toast('✅ Health profile saved'); profileScreen(el); } }));
  $('#share', el)?.addEventListener('change', (e) => patch('/auth/profile', { insuranceShareConsent: e.target.checked }).then(() => toast('Saved')).catch(toastErr));
  if (isProvider()) providerCard($('#provcard', el), role).catch(() => null);
}

const PROV_FIELDS = {
  DOCTOR: [['specialty', 'Specialty', 'select'], ['hospital', 'Hospital / clinic'], ['consultationFee', 'Consultation fee (₦)', 'number'], ['yearsExperience', 'Years of experience', 'number'], ['qualifications', 'Qualifications', 'text', 'e.g. MBBS, FWACS'], ['languages', 'Languages', 'text', 'English, Yoruba'], ['city', 'City'], ['state', 'State'], ['bio', 'About you', 'textarea'], ['homeVisit', 'I offer home visits', 'checkbox'], ['licenseNumber', 'Licence number (MDCN)']],
  NURSE: [['specialty', 'Specialty', 'select'], ['hourlyRate', 'Hourly rate (₦)', 'number'], ['yearsExperience', 'Years of experience', 'number'], ['city', 'City'], ['state', 'State'], ['bio', 'About you', 'textarea'], ['licenseNumber', 'Licence number (NMCN)']],
  PHARMACY: [['pharmacyName', 'Pharmacy name'], ['address', 'Address'], ['city', 'City'], ['state', 'State'], ['phone', 'Phone', 'tel'], ['operatingHours', 'Opening hours', 'text', 'Mon-Sat 8am-9pm'], ['homeDelivery', 'We deliver', 'checkbox'], ['licenseNumber', 'PCN licence number']],
  LAB: [['labName', 'Lab name'], ['address', 'Address'], ['city', 'City'], ['state', 'State'], ['phone', 'Phone', 'tel'], ['operatingHours', 'Opening hours'], ['homeCollection', 'We do home sample collection', 'checkbox'], ['licenseNumber', 'MLSCN licence number']],
  AMBULANCE: [['operatorName', 'Operator / company'], ['vehicleNumber', 'Vehicle plate'], ['vehicleType', 'Service level', 'select'], ['phone', 'Dispatch phone', 'tel'], ['baseFee', 'Base fee (₦)', 'number'], ['licenseNumber', 'Operating licence']],
};
async function providerCard(host, role) {
  if (role === 'INSTITUTION') { host.innerHTML = card(item({ icon: '🏥', title: 'Institution details', sub: 'Name, beds, address, emergency care', attrs: 'data-go="/institution/profile"' })); return; }
  const prof = await get('/provider-profile');
  const fields = PROV_FIELDS[role] || [];
  host.innerHTML = card(cardHead('⚕️ Practice details', '<button class="link" id="editprov">Edit</button>') + fields.map(([k, l, t]) => `<div class="kv"><span class="k">${l}</span><span class="v">${t === 'checkbox' ? (prof?.[k] ? 'Yes' : 'No') : t === 'number' && /fee|rate/i.test(k) ? money(prof?.[k] || 0) : esc(prof?.[k] ?? '—')}</span></div>`).join('') +
    `<div class="row mt8"><button class="btn btn-outline btn-sm grow" data-go="/kyc">📄 Verification</button>${['DOCTOR', 'NURSE', 'LAB'].includes(role) ? '<button class="btn btn-outline btn-sm grow" data-go="/provider/schedule">🗓️ Availability</button>' : ''}</div>`);
  $('#editprov', host).onclick = () => formModal('Practice details', fields.map(([k, l, t, ph]) => ({ name: k, label: l, type: t || 'text', placeholder: ph, value: prof?.[k] ?? '', options: t === 'select' ? SPECIALTIES[role] : undefined })),
    { onSubmit: async (v) => { await patch('/provider-profile', v); toast('✅ Saved'); providerCard(host, role); } });
}

async function verifyEmail() {
  try { await post('/auth/verify-email/send'); } catch (e) { return toastErr(e); }
  formModal('📧 Verify email', [{ name: 'code', label: 'Code sent to your email', inputmode: 'numeric', required: true }], { submit: 'Verify', onSubmit: async (v) => { await post('/auth/verify-email/confirm', v); toast('✅ Email verified'); go('/profile', { replace: true }); } });
}
async function verifyPhone() {
  try { await post('/auth/verify-phone/send'); } catch (e) { return toastErr(e); }
  formModal('📱 Verify phone', [{ name: 'code', label: 'Code sent by SMS', inputmode: 'numeric', required: true }], { submit: 'Verify', onSubmit: async (v) => { await post('/auth/verify-phone/confirm', v); toast('✅ Phone verified'); go('/profile', { replace: true }); } });
}

// ================= KYC (Didit) & provider documents =================
export async function kycScreen(el) {
  const s = await get('/kyc/status');
  const docs = isProvider() ? await get('/verification/documents') : [];
  const st = s.kycStatus;
  const box = {
    APPROVED: '<div class="eligibility-result success"><div class="icon">✅</div><div class="title">Identity verified</div><div class="details">Your government ID and selfie were verified.</div></div>',
    PENDING: '<div class="banner info">⏳ Verification started. Finish it in the Didit window, then tap "Check status".</div>',
    IN_REVIEW: '<div class="banner warn">🔎 Your documents are being reviewed - usually within a few hours.</div>',
    DECLINED: '<div class="banner err">❌ Verification was declined. Retry with a valid, unexpired ID in good lighting.</div>',
    EXPIRED: '<div class="banner warn">⌛ Your session expired. Start again.</div>',
  };
  const last = s.sessions?.[0];
  el.innerHTML = appBar({ title: '🪪 Verification', back: true, roleCls: roleCls() }) +
    card(cardHead('Identity (KYC)') + `<p class="muted mb8">We use <b>Didit</b> to verify your government-issued ID (NIN slip, international passport, driver's licence, voter's card or national ID card) with a quick selfie liveness check. N-Health stores only the result, document type and last 4 digits.</p>
      ${box[st] || ''}
      ${last?.documentType ? `<div class="kv"><span class="k">Document</span><span class="v">${esc(last.documentType)} ${last.documentLast4 ? '•••• ' + esc(last.documentLast4) : ''} ${esc(last.documentCountry || '')}</span></div>` : ''}
      ${st !== 'APPROVED' ? `<button class="btn btn-primary btn-block mt8" id="start" ${s.configured ? '' : 'disabled'}>${st === 'PENDING' ? 'Continue verification' : 'Verify my identity'}</button>${s.configured ? '' : '<p class="muted small center mt8">Identity verification is being set up - please check back soon.</p>'}
      ${st === 'PENDING' || st === 'IN_REVIEW' ? '<button class="btn btn-outline btn-block mt8" id="refresh">Check status</button>' : ''}` : ''}`) +
    (isProvider() ? card(cardHead('⚕️ Licence & practice documents', badge(s.verificationStatus)) + `
      ${s.verificationNote ? `<div class="banner warn">${esc(s.verificationNote)}</div>` : ''}
      <p class="muted mb8">Upload your practising licence and certificates (PDF or photo). An N-Health compliance officer checks them with the issuing council (MDCN, PCN, MLSCN, NMCN, CAC…) before your profile goes live.</p>
      ${docs.length ? docs.map((d) => item({ icon: '📄', title: esc(d.title), sub: esc(d.type) + ' • ' + dateOnly(d.createdAt) + (d.reviewNote ? ' • ' + esc(d.reviewNote) : ''), trailing: badge(d.status) })).join('') : empty('📄', 'No documents uploaded yet')}
      <button class="btn btn-outline btn-block mt8" id="upload">⬆️ Upload document</button>`) : '');
  $('#start', el)?.addEventListener('click', (e) => busy(e.target, async () => {
    const r = await post('/kyc/session', { returnUrl: location.origin + '/?kyc=done' });
    if (r.url) location.href = r.url; else { toast('✅ Already verified'); kycScreen(el); }
  }));
  $('#refresh', el)?.addEventListener('click', (e) => busy(e.target, async () => { await post('/kyc/refresh'); await refreshMe(); kycScreen(el); }));
  $('#upload', el)?.addEventListener('click', async () => {
    const f = await pickFile('image/*,application/pdf'); if (!f) return;
    let dataUri; try { dataUri = await fileToDataUri(f); } catch (e) { return toastErr(e); }
    formModal('Document details', [
      { name: 'type', label: 'Type', type: 'select', options: [['LICENSE', 'Practising licence'], ['CERTIFICATE', 'Certificate / degree'], ['CAC', 'CAC / business registration'], ['PRACTICE_PERMIT', 'Premises / practice permit'], ['VEHICLE', 'Vehicle documents'], ['INSURANCE', 'Indemnity insurance'], ['OTHER', 'Other']] },
      { name: 'title', label: 'Title', value: f.name.replace(/\.[^.]+$/, '') },
      { name: 'expiresAt', label: 'Expiry date (if any)', type: 'date' },
    ], { submit: 'Upload', onSubmit: async (v) => { await post('/verification/documents', { ...v, dataUri, expiresAt: v.expiresAt || undefined }); toast('✅ Uploaded - we will review it shortly'); kycScreen(el); } });
  });
}

// ================= SETTINGS & PRIVACY =================
export async function settingsScreen(el) {
  const me = state.user;
  const prefs = me.notificationPrefs || {};
  el.innerHTML = appBar({ title: '⚙️ Settings', back: true, roleCls: roleCls() }) +
    card(cardHead('🌍 Region & language') + `<form id="region">
      ${field({ name: 'country', label: 'Country', type: 'select', options: COUNTRIES.map((c) => [c[0], c[1]]), value: me.country })}
      ${field({ name: 'currency', label: 'Display currency', type: 'select', options: (state.config?.currencies || ['NGN']), value: me.currency })}
      ${field({ name: 'locale', label: 'Language', type: 'select', options: LANGS, value: me.locale })}
      ${field({ name: 'timezone', label: 'Time zone', value: me.timezone, hint: 'Appointments show in this time zone' })}
      <button class="btn btn-outline btn-block btn-sm" type="submit">Save region</button></form>
      <p class="muted small mt8">Payments settle in NGN; other currencies are shown at indicative rates.</p>`) +
    card(cardHead('🔔 Notifications') + `
      <label class="check"><input type="checkbox" data-pref="push" ${prefs.push !== false ? 'checked' : ''}> <span>Push notifications on this device</span></label>
      <label class="check"><input type="checkbox" data-pref="email" ${prefs.email !== false ? 'checked' : ''}> <span>Email (receipts, confirmations, results)</span></label>
      <label class="check"><input type="checkbox" data-pref="sms" ${prefs.sms !== false ? 'checked' : ''}> <span>SMS (urgent alerts & reminders)</span></label>
      <label class="check"><input type="checkbox" id="mkt" ${me.marketingOptIn ? 'checked' : ''}> <span>Health tips & product news</span></label>
      <button class="btn btn-outline btn-block btn-sm" id="push">Enable push on this device</button>`) +
    card(cardHead('🔐 Security') + `
      ${item({ icon: '🔑', title: 'Change password', attrs: 'id="pw"' })}
      ${item({ icon: '📵', title: 'Sign out of all devices', attrs: 'id="all"' })}
      ${item({ icon: '🪪', title: 'Identity verification', sub: (me.kycStatus || '').replace('_', ' ').toLowerCase(), attrs: 'data-go="/kyc"' })}`) +
    card(cardHead('🛡️ Privacy & your data') + `
      ${item({ icon: '👁️', title: 'Who viewed my records', attrs: 'id="log"' })}
      ${item({ icon: '⬇️', title: 'Download my data', sub: 'Machine-readable JSON (NDPA / GDPR)', attrs: 'id="export"' })}
      ${item({ icon: '📜', title: 'Terms of Service', attrs: 'id="tos"' })}
      ${item({ icon: '🔒', title: 'Privacy Policy', attrs: 'id="pp"' })}
      ${item({ icon: '🗑️', title: '<span style="color:var(--error)">Delete my account</span>', sub: 'Permanently erase your personal data', attrs: 'id="delete"' })}`);
  $('#region', el).onsubmit = async (e) => { e.preventDefault(); try { await patch('/auth/profile', readForm(e.target)); await refreshMe(); toast('✅ Saved'); } catch (err) { toastErr(err); } };
  $$('[data-pref]', el).forEach((c) => (c.onchange = async () => { const np = { ...(state.user.notificationPrefs || {}), [c.dataset.pref]: c.checked }; await patch('/auth/profile', { notificationPrefs: np }).catch(toastErr); state.user.notificationPrefs = np; }));
  $('#mkt', el).onchange = (e) => patch('/auth/profile', { marketingOptIn: e.target.checked }).catch(toastErr);
  $('#push', el).onclick = (e) => busy(e.target, async () => { await enablePush(); toast('✅ Push notifications enabled'); });
  $('#pw', el).onclick = () => formModal('Change password', [
    { name: 'currentPassword', label: 'Current password', type: 'password' },
    { name: 'newPassword', label: 'New password', type: 'password', autocomplete: 'new-password', required: true, hint: 'At least 8 characters' },
  ], { onSubmit: async (v) => { const r = await post('/auth/change-password', v); if (r.token) auth.token = r.token; toast('✅ Password changed'); } });
  $('#all', el).onclick = async () => { if (await confirmBox('Sign out everywhere, including this device?', { ok: 'Sign out all', danger: true })) { await post('/auth/logout-all').catch(() => null); logout('Signed out on all devices'); } };
  $('#log', el).onclick = async () => {
    const log = await get('/privacy/access-log');
    modal(`<div class="modal-title">👁️ Record access log</div>${log.length ? log.map((l) => item({ icon: '👁️', title: esc(l.actor?.name || 'Provider') + ' (' + esc((l.actor?.role || '').toLowerCase()) + ')', sub: esc(l.resource) + ' • ' + dt(l.createdAt) })).join('') : empty('🔒', 'No one has viewed your records')}`);
  };
  $('#export', el).onclick = () => download('/privacy/export', 'nhealth-my-data.json').then(() => toast('✅ Downloaded')).catch(toastErr);
  $('#tos', el).onclick = () => legal('terms');
  $('#pp', el).onclick = () => legal('privacy');
  $('#delete', el).onclick = () => formModal('🗑️ Delete account', [{ name: 'confirm', label: 'Type DELETE to confirm', required: true }], {
    submit: 'Delete forever', intro: '<div class="banner err">This erases your profile, family members, documents and reminders. Medical and payment records are anonymised (kept without your identity) as required by law. Unused coins are forfeited.</div>',
    onSubmit: async (v) => { await post('/privacy/delete', v); logout('Your account has been deleted'); },
  });
}

// ================= SUPPORT & ARTICLES =================
const FAQ = [
  ['How do coins work?', 'Coins are prepaid credits for healthcare on N-Health. Top up by card, transfer or USSD through Paystack or Flutterwave. 1 coin = ₦1. Coins can only be spent on services, not withdrawn.'],
  ['Are providers verified?', 'Yes. Every provider passes Didit identity verification and an N-Health compliance review of their licence before patients can book them. Look for the ✓ Verified badge.'],
  ['What if my appointment is cancelled?', 'If the provider declines or you cancel 12+ hours ahead, your coins are refunded automatically.'],
  ['Is my medical data safe?', 'Your records are visible only to providers treating you. Every access is logged in Settings → Privacy, and you can download or delete your data at any time.'],
  ['What does the Emergency button do?', 'It alerts the nearest available ambulances and on-call doctors with your live location and notifies your emergency contact. Always also call 112 / 767 in life-threatening situations.'],
];
export async function supportScreen(el) {
  const tickets = await get('/support/tickets').catch(() => []);
  el.innerHTML = appBar({ title: '🆘 Help & Support', back: true, roleCls: roleCls() }) +
    card(cardHead('❓ FAQs') + FAQ.map(([q, a], i) => `<details class="list-item" style="display:block"><summary style="font-weight:500;font-size:13px;cursor:pointer">${q}</summary><p class="muted mt8">${a}</p></details>`).join('')) +
    card(cardHead('📨 Contact us') + `<a class="btn btn-outline btn-block btn-sm" href="mailto:support@nhealth.com.ng">✉️ support@nhealth.com.ng</a><button class="btn btn-primary btn-block mt8" id="ticket">Open a support ticket</button>`) +
    card(cardHead('🎫 My tickets') + (tickets.length ? tickets.map((t) => `${item({ icon: '🎫', title: esc(t.subject), sub: dt(t.createdAt), trailing: badge(t.status === 'open' ? 'PENDING' : t.status === 'answered' ? 'CONFIRMED' : 'COMPLETED', t.status) })}${t.adminReply ? `<div class="banner ok">💬 ${esc(t.adminReply)}</div>` : ''}`).join('') : empty('🎫', 'No tickets')));
  $('#ticket', el).onclick = () => formModal('New support ticket', [
    { name: 'category', label: 'Category', type: 'select', options: [['general', 'General'], ['payment', 'Payment / coins'], ['appointment', 'Appointment'], ['account', 'Account & verification'], ['technical', 'Technical problem'], ['complaint', 'Complaint about a provider']] },
    { name: 'subject', label: 'Subject', required: true },
    { name: 'message', label: 'Message', type: 'textarea', rows: 5, required: true },
    { name: 'priority', label: 'Priority', type: 'select', options: [['normal', 'Normal'], ['high', 'Urgent']] },
  ], { submit: 'Send', onSubmit: async (v) => { await post('/support/tickets', v); toast('✅ Ticket sent - we reply within 24h'); supportScreen(el); } });
}
export async function articlesScreen(el) {
  const list = await get('/articles');
  el.innerHTML = appBar({ title: '📚 Health tips', back: true }) + (list.length ? card(list.map((a) => item({ icon: '📖', title: esc(a.title), sub: esc(a.category) + ' • ' + esc(a.summary), attrs: `data-go="/articles/${a.slug}"` })).join('')) : empty('📚', 'No articles yet'));
}
export async function articleScreen(el, { slug }) {
  const a = await get('/articles/' + slug);
  el.innerHTML = appBar({ title: '📖 ' + esc(a.category), back: '/articles' }) + card(`<h3 style="font-size:16px;margin-bottom:6px">${esc(a.title)}</h3><p class="muted mb8">${dateOnly(a.publishedAt)}</p>${esc(a.body).split('\n').map((p) => `<p style="font-size:13px;line-height:1.6;margin-bottom:8px">${p}</p>`).join('')}<div class="banner info">ℹ️ General information only - not a substitute for professional medical advice.</div>`);
}

// ================= AFFILIATIONS =================
export async function affiliationsScreen(el) {
  const list = await get('/institution/affiliations');
  el.innerHTML = appBar({ title: '🏥 Affiliations', back: true, roleCls: roleCls() }) + (list.length ? card(list.map((s) => `${item({ icon: '🏥', title: esc(s.institution.name), sub: esc(s.staffRole.toLowerCase().replace('_', ' ')) + (s.department ? ' • ' + esc(s.department.name) : '') + ' • ' + esc(s.institution.city || ''), trailing: badge(s.status) })}${s.status === 'INVITED' ? `<div class="row mb8"><button class="btn btn-success btn-sm grow" data-acc="${s.id}">Accept</button><button class="btn btn-outline btn-sm grow" data-dec="${s.id}">Decline</button></div>` : ''}`).join('')) : empty('🏥', 'No invitations. Institutions can invite you using your email.'));
  el.onclick = async (e) => {
    const a = e.target.closest('[data-acc],[data-dec]'); if (!a) return;
    await busy(a, async () => { await post('/institution/affiliations/' + (a.dataset.acc || a.dataset.dec), { accept: !!a.dataset.acc }); toast('✅ Done'); affiliationsScreen(el); });
  };
}

// ================= PROVIDER SCHEDULE (availability) =================
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export async function scheduleScreen(el) {
  const { rules, blocks } = await get('/availability/me');
  const byDay = DAYS.map((_, d) => rules.find((r) => r.dayOfWeek === d));
  const slot = rules[0]?.slotMinutes || 30;
  el.innerHTML = appBar({ title: '🗓️ My Calendar', back: true, roleCls: roleCls() }) +
    card(cardHead('Weekly availability') + `<p class="muted mb8">Patients can only book the times you open here. Times are in ${esc(state.user.timezone || 'Africa/Lagos')}.</p>
      <form id="av">${DAYS.map((d, i) => `<div class="row mb8"><label class="check" style="width:70px;margin:0"><input type="checkbox" name="on${i}" ${byDay[i] ? 'checked' : ''}> ${d}</label><input type="time" name="s${i}" value="${byDay[i]?.startTime || '09:00'}" style="flex:1;padding:6px;border:1px solid #DADCE0;border-radius:8px"><span class="muted">to</span><input type="time" name="e${i}" value="${byDay[i]?.endTime || '17:00'}" style="flex:1;padding:6px;border:1px solid #DADCE0;border-radius:8px"></div>`).join('')}
      ${field({ name: 'slot', label: 'Appointment length', type: 'select', options: [[15, '15 min'], [20, '20 min'], [30, '30 min'], [45, '45 min'], [60, '1 hour'], [90, '1.5 hours'], [120, '2 hours']], value: slot })}
      <button class="btn ${state.user.role === 'DOCTOR' ? 'btn-doctor' : 'btn-primary'} btn-block" type="submit">Save availability</button></form>`) +
    card(cardHead('⛔ Time off', '<button class="link" id="addb">+ Add</button>') + (blocks.length ? blocks.map((b) => item({ icon: '⛔', title: dt(b.startAt) + ' → ' + dt(b.endAt), sub: esc(b.reason || ''), trailing: `<button class="link" data-rb="${b.id}">Remove</button>` })).join('') : empty('🌴', 'No time off scheduled')));
  $('#av', el).onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target; const fd = new FormData(f);
    const rulesOut = DAYS.map((_, i) => fd.get('on' + i) ? { dayOfWeek: i, startTime: fd.get('s' + i), endTime: fd.get('e' + i), slotMinutes: Number(fd.get('slot')) } : null).filter(Boolean);
    try { await put('/availability/me', { rules: rulesOut, timezone: state.user.timezone || 'Africa/Lagos' }); toast('✅ Availability saved'); } catch (err) { toastErr(err); }
  };
  $('#addb', el).onclick = () => formModal('Add time off', [
    { name: 'startAt', label: 'From', type: 'datetime-local', required: true }, { name: 'endAt', label: 'To', type: 'datetime-local', required: true }, { name: 'reason', label: 'Reason (private)' },
  ], { onSubmit: async (v) => { await post('/availability/me/blocks', { ...v, startAt: new Date(v.startAt).toISOString(), endAt: new Date(v.endAt).toISOString() }); scheduleScreen(el); } });
  el.onclick = async (e) => { const b = e.target.closest('[data-rb]'); if (b) { await del('/availability/me/blocks/' + b.dataset.rb); scheduleScreen(el); } };
}

// ================= PROVIDER EARNINGS (Bolt-style) =================
const ENTRY = { EARNING: ['💰', 'Earning'], COMMISSION: ['🏷️', 'Commission'], CASH_COMMISSION: ['💵', 'Cash job commission'], PAYOUT: ['🏦', 'Payout'], PAYOUT_REVERSAL: ['↩️', 'Payout returned'], SETTLEMENT: ['✅', 'Balance payment'], ADJUSTMENT: ['⚙️', 'Adjustment'], ESCROW_SETTLED: ['🔒', 'Escrow (paid by PayScrow)'], REFUND_CLAWBACK: ['↩️', 'Refund'] };
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export async function earningsScreen(el, _p, q) {
  const settleRef = sessionStorage.getItem('nh_settle');
  if (settleRef) {
    sessionStorage.removeItem('nh_settle');
    try { await post('/credits/purchase/confirm', { internalRef: settleRef }); toast('✅ Balance payment received'); } catch (e) { toast(e.status === 402 ? '⏳ Payment still confirming - your balance updates automatically' : '⚠️ ' + e.message); }
  }
  const e = await get('/earnings');
  const pol = e.policy;
  const sched = pol.payoutSchedule === 'MANUAL' ? 'Paid out by N-Health finance' : pol.payoutSchedule === 'DAILY' ? `Daily at ${pol.payoutHour}:00` : `Every ${DAYS_LONG[pol.payoutDay]} at ${pol.payoutHour}:00`;
  const rate = pol.commission[{ DOCTOR: 'APPOINTMENT', NURSE: 'NURSE_REQUEST', LAB: 'LAB_TEST', PHARMACY: 'PHARMACY_ORDER', AMBULANCE: 'EMERGENCY' }[state.user.role]] ?? null;
  el.innerHTML = appBar({ title: '💰 Earnings', back: true, roleCls: roleCls() }) +
    `<div class="balance-card"><div class="balance-label">${e.owed ? 'You owe N-Health' : 'Available to pay out'}</div><div class="balance-amount">${money(e.owed || e.available)}</div>
      <div class="small" style="opacity:.85">${e.pending ? money(e.pending) + ' pending (released ' + pol.holdHours + 'h after each service) • ' : ''}${e.inFlight ? money(e.inFlight) + ' on its way to your bank • ' : ''}${sched}</div>
      <div class="balance-actions">${e.owed ? '<button class="btn-primary" id="settle">💳 Pay balance</button>' : '<button class="btn-primary" id="cashout">🏦 Cash out now</button>'}<button class="btn-outline" id="how">ℹ️ How it works</button></div></div>
    ${e.owed > pol.cashDebtLimit ? `<div class="banner err">Cash payments are paused because you owe more than ${money(pol.cashDebtLimit)}. Pay your balance, or keep doing in-app jobs - commission is deducted automatically.</div>` : ''}
    ${!e.bank ? '<div class="banner warn">🏦 Add your bank account to receive payouts.<button class="btn btn-sm btn-primary" id="addbank2">Add</button></div>' : ''}
    <div class="provider-stats">${['earned', 'commission', 'cashCollected'].map((k, i) => `<div class="provider-stat"><div class="number">${money(e.thisWeek[k]).replace(/\.00$/, '')}</div><div class="label">${['Earned (7d)', 'Commission (7d)', 'Cash collected (7d)'][i]}</div></div>`).join('')}<div class="provider-stat"><div class="number">${rate ?? '—'}%</div><div class="label">Commission</div></div></div>
    ${e.cashDue.length ? card(cardHead('💵 Cash to collect') + e.cashDue.map((p) => `${item({ icon: '💵', title: money(p.amount) + ' from ' + esc(p.payer.name), sub: esc(String(p.payableType).replace('_', ' ').toLowerCase()) + ' • ' + dt(p.createdAt), trailing: `<button class="btn btn-success btn-sm" data-got="${p.id}">Received</button>` })}`).join('')) : ''}
    ${card(cardHead('🏦 Payout account', `<button class="link" id="addbank">${e.bank ? 'Change' : 'Add'}</button>`) + (e.bank ? `<div class="kv"><span class="k">Bank</span><span class="v">${esc(e.bank.bankName)}</span></div><div class="kv"><span class="k">Account</span><span class="v">${esc(e.bank.accountName)} • ${esc(e.bank.accountNumber)} ${e.bank.verified ? '✅' : ''}</span></div>` : empty('🏦', 'No payout account yet')))}
    ${card(cardHead('📒 Activity') + (e.entries.length ? e.entries.map((x) => { const [ic, lb] = ENTRY[x.type] || ['•', x.type]; const amt = Number(x.amount); return item({ icon: ic, title: esc(x.description || lb), sub: dt(x.createdAt) + (x.gross ? ' • job ' + money(x.gross) : ''), trailing: amt ? `<b style="color:${amt >= 0 ? 'var(--success)' : 'var(--error)'}">${amt >= 0 ? '+' : '−'}${money(Math.abs(amt))}</b>` : '' }); }).join('') : empty('📒', 'Completed jobs appear here')))}
    ${card(cardHead('🗂️ Payouts') + (e.payouts.length ? e.payouts.map((p) => item({ icon: '🏦', title: money(p.amount) + ' → ' + esc(p.bankName) + ' ••' + esc(p.accountNumber.slice(-4)), sub: dt(p.createdAt) + (p.failureReason ? ' • ' + esc(p.failureReason) : ''), trailing: badge(p.status === 'PAID' ? 'COMPLETED' : p.status === 'PROCESSING' || p.status === 'PENDING' ? 'PENDING' : 'FAILED', p.status.toLowerCase()) })).join('') : empty('🏦', 'No payouts yet')))}`;
  const addBank = async () => {
    const banks = await get('/earnings/banks').catch(() => []);
    formModal('🏦 Payout bank account', [
      banks.length ? { name: 'bankCode', label: 'Bank', type: 'select', options: banks.map((b) => [b.code, b.name]), required: true } : { name: 'bankCode', label: 'Bank code', required: true },
      { name: 'accountNumber', label: 'Account number (10 digits)', inputmode: 'numeric', required: true },
    ], { submit: 'Verify & save', intro: '<p class="muted mb8">We confirm the account name with your bank. It must match your verified identity.</p>', onSubmit: async (v) => {
      const b = banks.find((x) => x.code === v.bankCode);
      const r = await post('/earnings/bank', { ...v, bankName: b ? b.name : v.bankCode });
      toast('✅ ' + r.accountName + ' saved'); earningsScreen(el, _p, q);
    } });
  };
  $('#addbank', el).onclick = addBank; $('#addbank2', el)?.addEventListener('click', addBank);
  $('#cashout', el)?.addEventListener('click', (ev) => busy(ev.target, async () => {
    if (!(await confirmBox(`Send ${money(e.available)} to your bank now?`, { ok: 'Cash out' }))) return;
    const p = await post('/earnings/cash-out'); toast(p.status === 'FAILED' ? '⚠️ ' + (p.failureReason || 'Payout failed') : '🏦 Payout started'); earningsScreen(el, _p, q);
  }));
  $('#settle', el)?.addEventListener('click', () => formModal('💳 Pay your balance', [{ name: 'amount', label: 'Amount (₦)', type: 'number', value: Math.ceil(e.owed), required: true }, ...(e.settleGateways.length > 1 ? [{ name: 'gateway', label: 'Pay with', type: 'select', options: e.settleGateways }] : [])], {
    submit: 'Continue to payment', intro: '<p class="muted mb8">This covers commission on cash jobs. You can also just keep working - commission on in-app jobs is deducted automatically.</p>',
    onSubmit: async (v) => { const r = await post('/earnings/settle', { amount: Number(v.amount), gateway: v.gateway, returnUrl: location.origin + '/' }); sessionStorage.setItem('nh_settle', r.internalRef); if (r.checkoutUrl) location.href = r.checkoutUrl; else throw new Error('Checkout unavailable'); },
  }));
  $('#how', el).onclick = () => modal(`<div class="modal-title">How earnings work</div><div class="muted" style="line-height:1.6">
    <p><b>In-app payments</b> (coins): the patient pays N-Health. When you complete the job, your fee minus ${rate ?? ''}% commission is added to your balance and becomes available after ${pol.holdHours}h.</p>
    <p><b>Cash payments</b>: you collect the money. Tap <i>Received</i>, complete the job, and the commission is deducted from your balance. Above ${money(pol.cashDebtLimit)} owed, cash jobs pause until you pay.</p>
    <p><b>Escrow</b> payments go straight to your bank through PayScrow when the patient releases them.</p>
    <p><b>Payouts</b>: ${sched}, when your available balance is at least ${money(pol.minPayout)}. You can also cash out once a day.</p></div>`);
  el.onclick = async (ev) => { const b = ev.target.closest('[data-got]'); if (b) await busy(b, async () => { await post('/payments/' + b.dataset.got + '/confirm'); toast('✅ Cash receipt confirmed'); earningsScreen(el, _p, q); }); };
}
