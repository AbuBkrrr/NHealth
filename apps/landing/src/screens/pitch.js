// Public pitch page opened from tracking links / QR codes: /go/<slug>
import { get, post } from '../lib/api.js';
import { state } from '../lib/store.js';
import { go, home } from '../lib/router.js';
import { esc, $, toast, toastErr, field, readForm, modal, closeModal, webOrigin } from '../lib/ui.js';
import { trackOpen, adPixels, adEvent, deviceId, sharePreciseLocation, locationWasAsked } from '../lib/marketing.js';
import { COUNTRIES } from './data.js';

// Mockup components: quick-action tiles in role colours, list items with role avatars.
const PATIENT = [
  ['🩺', 'Doctors', 'doctor-action', 'doctor-avatar', 'See a verified doctor', 'Book in-person visits on real calendars. Every provider is licence- and ID-checked.'],
  ['💊', 'Pharmacy', 'pharmacy-action', 'pharmacy-avatar', 'Medicines delivered', 'Order from nearby pharmacies. Prescription drugs only with a valid prescription.'],
  ['🔬', 'Diagnostics', 'lab-action', 'lab-avatar', 'Tests, X-rays & scans', 'Book tests and get results straight to you and your doctor.'],
  ['👩‍⚕️', 'Nurses', 'nurse-action', 'nurse-avatar', 'Nurse at home', 'Home care visits, paid in cash or in the app.'],
  ['🚑', 'Ambulance', 'ambulance-action', 'ambulance-avatar', 'Emergency help fast', 'One tap sends the nearest ambulance your location.'],
  ['🏥', 'Facilities', 'institution-action', 'institution-avatar', 'Hospitals & clinics', 'Find verified facilities near you with their departments.'],
  ['📁', 'Records', '', '', 'Your health, one place', 'Records, prescriptions, insurance and an emergency ID card.'],
  ['❤️', 'Donate', '', '', 'Give & get help', 'Blood, organ and fundraising campaigns, reviewed before going live.'],
];
const PROVIDER = [
  ['💰', 'doctor-avatar', 'Get paid directly', 'Card payments split to your own bank account; cash jobs settle like ride-hailing apps.'],
  ['📅', 'nurse-avatar', 'Fill your calendar', 'Patients book your free slots; reminders cut no-shows.'],
  ['✅', 'pharmacy-avatar', 'Verified badge', 'Stand out with licence and identity verification.'],
  ['🏥', 'institution-avatar', 'For hospitals & clinics', 'Departments, staff, admissions, stock and POS in one dashboard.'],
];

export async function pitchScreen(el, { slug } = {}) {
  el.classList.add('screen-flush');
  el.innerHTML = '<div class="pitch"><div class="pitch-hero"><div class="skeleton" style="height:120px"></div></div></div>';
  let cfg = {};
  let open = null;
  try { [cfg, open] = await Promise.all([get('/mkt/config').catch(() => ({})), trackOpen(slug).catch(() => null)]); } catch { /* still show the page */ }
  adPixels(cfg);
  const audience = open?.link?.audience || 'ALL';
  if (open?.link?.landing === 'signup' && !state.user) return go('/auth?mode=register&side=' + (audience === 'PROVIDER' || audience === 'INSTITUTION' ? 'PROVIDER' : 'PATIENT'), { replace: true });

  const showProviders = audience !== 'PATIENT';
  const showPatients = audience !== 'PROVIDER' && audience !== 'INSTITUTION';
  const wa = cfg.whatsappNumber ? `https://wa.me/${String(cfg.whatsappNumber).replace(/\D/g, '')}?text=${encodeURIComponent('Hello N-Health, I would like to know more.')}` : null;

  el.innerHTML = `<div class="pitch">
    <div class="app-bar"><div class="title">N-<span>Health</span></div>
      <div class="app-bar-actions">${state.user ? '<button data-go-app title="Open app">👤</button>' : '<button data-login title="Sign in">Sign in</button>'}</div></div>
    <div class="splash-screen pitch-hero">
      <div class="logo">🏥</div>
      <h1>${esc(cfg.headline || 'Healthcare in your pocket')}</h1>
      <p>${esc(cfg.subheadline || 'Complete Health Ecosystem')}</p>
    </div>
    <div class="pitch-body">
      ${open ? `<div class="card pitch-loc" id="loc"><div class="list-item"><div class="avatar institution-avatar">📍</div><div class="content"><div class="title">Find verified care near you</div><div class="pitch-desc">Allow your location to see the nearest doctors, pharmacies and ambulances.</div></div><div class="trailing"><button class="btn btn-institution btn-sm" data-loc>Allow</button></div></div></div>` : ''}
      ${state.user ? '<button class="btn btn-primary btn-block" data-go-app>Open my N-Health</button>' : `
      <div class="auth-role-selector">
        ${showPatients ? '<div class="role-card selected" data-signup="PATIENT" tabindex="0"><div class="icon">👤</div><div class="name">I need care</div><div class="desc">Create a free patient account</div></div>' : ''}
        ${showProviders ? `<div class="role-card ${showPatients ? '' : 'selected'} ${audience === 'INSTITUTION' ? 'institution-card' : ''}" data-signup="PROVIDER" tabindex="0"><div class="icon">${audience === 'INSTITUTION' ? '🏥' : '⚕️'}</div><div class="name">I provide care</div><div class="desc">Doctors, nurses, pharmacies, labs, ambulances & hospitals</div></div>` : ''}
      </div>`}
      ${showPatients ? `<div class="welcome-text">Everything you need</div><div class="welcome-sub">Verified providers, secure payments, your records in one place</div>
      <div class="quick-actions">${PATIENT.map(([i, l, c]) => `<div class="quick-action ${c}" data-signup="PATIENT" tabindex="0"><span class="icon">${i}</span><span class="label">${l}</span></div>`).join('')}</div>
      <div class="card"><div class="card-header"><span class="card-title">🩺 For patients & families</span></div>
        ${PATIENT.map(([i, , , av, t, d]) => `<div class="list-item"><div class="avatar ${av}">${i}</div><div class="content"><div class="title">${esc(t)}</div><div class="pitch-desc">${esc(d)}</div></div></div>`).join('')}</div>` : ''}
      ${showProviders ? `<div class="card" style="border:2px solid var(--institution-color)"><div class="card-header"><span class="card-title">⚕️ For health providers</span><span class="badge badge-institution">Free to join</span></div>
        ${PROVIDER.map(([i, av, t, d]) => `<div class="list-item"><div class="avatar ${av}">${i}</div><div class="content"><div class="title">${esc(t)}</div><div class="pitch-desc">${esc(d)}</div></div></div>`).join('')}
        ${!state.user ? '<button class="btn btn-institution btn-block mt8" data-signup="PROVIDER">Join as a health provider</button>' : ''}</div>` : ''}
      <div class="card" style="border:2px solid var(--primary)">
        <div class="card-header"><span class="card-title">💬 Questions? Talk to us</span></div>
        <div class="card-subtitle" style="margin-bottom:10px">Leave your details and our team will reach out - or start right away, it takes 2 minutes.</div>
        ${!state.user && showPatients ? '<button class="btn btn-primary btn-block" data-signup="PATIENT">Create a free account</button>' : ''}
        <div class="pitch-row">
          <button class="btn btn-outline" data-lead>📝 Talk to our team</button>
          ${wa ? `<a class="btn btn-success" href="${wa}" target="_blank" rel="noopener" data-wa>💬 WhatsApp</a>` : ''}
          <button class="btn btn-outline" data-share>📤 Share</button>
        </div>
      </div>
      <div class="pitch-foot">🔒 Your data is encrypted and never sold · <a href="#/auth" data-terms-link>Terms & Privacy</a></div>
    </div>
  </div>`;

  el.onclick = async (e) => {
    const t = e.target.closest('button,a,[data-signup]');
    if (!t) return;
    if (t.dataset.loc !== undefined) {
      t.disabled = true; t.textContent = 'Locating…';
      const acc = await sharePreciseLocation();
      $('#loc', el).innerHTML = acc != null ? `<div class="list-item"><div class="avatar pharmacy-avatar">✅</div><div class="content"><div class="title">Location shared</div><div class="pitch-desc">Accurate to about ${acc} m. We'll show you care nearby.</div></div></div>` : '<div class="list-item"><div class="avatar">📍</div><div class="content"><div class="title">Location not shared</div><div class="pitch-desc">You can still sign up and search by city.</div></div></div>';
      return;
    }
    if (t.dataset.goApp !== undefined) return go(home());
    if (t.dataset.signup) { if (!locationWasAsked()) sharePreciseLocation(); return go('/auth?mode=register&side=' + t.dataset.signup); }
    if (t.dataset.login !== undefined) return go('/auth');
    if (t.dataset.wa !== undefined) return adEvent('Contact');
    if (t.dataset.share !== undefined) {
      const url = webOrigin() + '/go/' + (slug || '');
      const data = { title: 'N-Health', text: 'I found N-Health - doctors, medicines, labs and ambulances in one app:', url };
      if (navigator.share) { try { await navigator.share(data); } catch { /* cancelled */ } }
      else { try { await navigator.clipboard.writeText(url); toast('🔗 Link copied'); } catch { toast(url); } }
      return;
    }
    if (t.dataset.lead !== undefined) return leadForm(slug);
  };
}

function leadForm(slug) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const guess = (COUNTRIES.find((c) => c[3] === tz) || COUNTRIES[0])[0];
  modal(`<div class="modal-title">Talk to our team</div>
    <form id="lead-form" novalidate>
      ${field({ name: 'name', label: 'Your name', required: true, autocomplete: 'name' })}
      ${field({ name: 'email', label: 'Email', type: 'email', autocomplete: 'email' })}
      ${field({ name: 'phone', label: 'Phone / WhatsApp', type: 'tel', autocomplete: 'tel' })}
      ${field({ name: 'interest', label: 'I am', type: 'select', options: [['PATIENT', 'A patient / family member'], ['DOCTOR', 'A doctor'], ['NURSE', 'A nurse'], ['PHARMACY', 'A pharmacy'], ['LAB', 'A diagnostic center'], ['AMBULANCE', 'An ambulance service'], ['INSTITUTION', 'A hospital / clinic'], ['PARTNER', 'A partner / HMO / NGO'], ['INVESTOR', 'An investor']] })}
      ${field({ name: 'organization', label: 'Organisation (optional)' })}
      ${field({ name: 'country', label: 'Country', type: 'select', options: COUNTRIES.map((c) => [c[0], c[1]]), value: guess })}
      ${field({ name: 'message', label: 'Message (optional)', type: 'textarea' })}
      <label class="check"><input type="checkbox" name="consent"> <span>Yes, N-Health may contact me about its services (you can unsubscribe any time).</span></label>
      <button class="btn btn-primary btn-block mt8" type="submit">Send</button>
    </form>`, (root) => {
    $('#lead-form', root).onsubmit = async (e) => {
      e.preventDefault();
      const v = readForm(e.target);
      try {
        await post('/mkt/lead', { ...v, consent: !!v.consent, slug: slug || undefined, deviceId: deviceId() || undefined });
        adEvent('Lead');
        closeModal();
        toast('✅ Thanks! Our team will contact you soon.');
      } catch (err) { toastErr(err); }
    };
  });
}
