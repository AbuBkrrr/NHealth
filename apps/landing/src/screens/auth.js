import { get, post, auth, ApiError } from '../lib/api.js';
import { state } from '../lib/store.js';
import { esc, $, $$, toast, toastErr, field, readForm, formModal, modal, logo } from '../lib/ui.js';
import { startSession } from '../main.js';
import { signupAttribution, adEvent } from '../lib/marketing.js';
import { SPECIALTIES, PROVIDER_ROLES, INSTITUTION_TYPES, COUNTRIES, NG_STATES } from './data.js';

// Accounts that can find and claim their facility in the national directory at sign-up.
const FINDABLE = {
  INSTITUTION: 'TEACHING_HOSPITAL,FEDERAL_MEDICAL_CENTRE,GENERAL_HOSPITAL,SPECIALIST_HOSPITAL,HOSPITAL,CLINIC,PRIMARY_HEALTH_CENTRE,HEALTH_POST,MATERNITY,DENTAL,EYE,NURSING_HOME,BLOOD_BANK,DIAGNOSTIC,OTHER',
  LAB: 'DIAGNOSTIC,BLOOD_BANK', PHARMACY: 'PHARMACY',
};

const guessCountry = () => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (COUNTRIES.find((c) => c[3] === tz) || COUNTRIES[0])[0];
};

export function authScreen(el, _params = {}, query = {}) {
  // Nothing is picked at first: the person chooses Patient or Health Provider, then only that card stays, above its form.
  const s = { side: query.side === 'PROVIDER' || query.side === 'PATIENT' ? query.side : null, role: 'DOCTOR', mode: query.mode === 'register' ? 'register' : 'login' };
  const referral = (() => { try { return query.ref || localStorage.getItem('nh_ref') || ''; } catch { return query.ref || ''; } })();
  const CARDS = {
    PATIENT: '<div class="icon">👤</div><div class="txt"><div class="name">Patient</div><div class="desc">Access healthcare services</div></div>',
    PROVIDER: '<div class="icon">⚕️</div><div class="txt"><div class="name">Health Provider</div><div class="desc">Doctors, hospitals, pharmacies, diagnostic centers & more</div></div>',
  };
  const draw = () => {
    if (!s.side) {
      el.innerHTML = `<div class="auth-screen">
        <div class="auth-header"><div class="icon">${logo(64)}</div><h2>Welcome to N-Health</h2><p>Who are you signing in as?</p></div>
        <div class="auth-choose">
          <button type="button" class="role-card role-card-big" data-side="PATIENT">${CARDS.PATIENT}<span class="go">Continue as a patient →</span></button>
          <button type="button" class="role-card role-card-big provider" data-side="PROVIDER">${CARDS.PROVIDER}<span class="go">Continue as a provider →</span></button>
        </div>
        <p class="muted center mt12 small">🔒 Your data is encrypted in transit and never sold.</p>
      </div>`;
      $$('[data-side]', el).forEach((c) => (c.onclick = () => { s.side = c.dataset.side; draw(); }));
      return;
    }
    const provider = s.side === 'PROVIDER';
    const role = provider ? s.role : 'PATIENT';
    const isInst = role === 'INSTITUTION';
    const login = s.mode === 'login';
    const country = guessCountry();
    el.innerHTML = `<div class="auth-screen">
      <div class="auth-header compact"><h2>${login ? 'Sign in' : 'Create your account'}</h2></div>
      <div class="role-card selected picked ${provider ? 'provider' : ''}">${CARDS[s.side]}<button type="button" class="link change" id="change">Change</button></div>
      ${provider ? `<div class="form-group"><label>Provider type</label><select id="prov-role">${PROVIDER_ROLES.map(([k, i, n]) => `<option value="${k}" ${k === s.role ? 'selected' : ''}>${i} ${n}</option>`).join('')}</select></div>` : ''}
      <div class="tab-container"><div class="tab ${login ? 'active' : ''}" data-mode="login" tabindex="0">Sign In</div><div class="tab ${!login ? 'active' : ''}" data-mode="register" tabindex="0">Create Account</div></div>
      <form id="auth-form" novalidate ${isInst && !login ? 'class="institution-register-form" style="max-height:none"' : ''}>
        ${!login && FINDABLE[role] ? `<div class="form-group fac-find"><label>Find your ${role === 'PHARMACY' ? 'pharmacy' : role === 'LAB' ? 'diagnostic center' : 'facility'} in our directory</label>
          <input id="fsearch" autocomplete="off" placeholder="Start typing its name, e.g. ${role === 'PHARMACY' ? 'HealthPlus' : role === 'LAB' ? 'Clina-Lancet' : 'Lagos University Teaching Hospital'}">
          <div id="fres" class="fac-results"></div><div id="fpick"></div>
          <div class="hint">Over 72,000 Nigerian facilities are already listed. Pick yours and we fill in the address and map location. Not listed? Just fill in the form.</div>
          <input type="hidden" name="listingId"></div>` : ''}
        ${login ? `
          ${field({ name: 'email', label: 'Email', type: 'email', autocomplete: 'email', required: true, placeholder: 'you@example.com' })}
          ${field({ name: 'password', label: 'Password', type: 'password', required: true })}
          <div class="row between"><span></span><button type="button" class="link" id="forgot">Forgot password?</button></div>
        ` : isInst ? `
          ${field({ name: 'instName', label: 'Institution Name', required: true, placeholder: 'Lagos University Teaching Hospital' })}
          ${field({ name: 'instType', label: 'Institution Type', type: 'select', options: INSTITUTION_TYPES, required: true })}
          ${field({ name: 'licenseNumber', label: 'Registration / Licence Number', required: true, hint: 'Verified against your uploaded documents' })}
          ${field({ name: 'name', label: 'Administrator full name', required: true })}
          ${field({ name: 'email', label: 'Official Email', type: 'email', required: true, autocomplete: 'email' })}
          ${field({ name: 'phone', label: 'Phone', type: 'tel', required: true, autocomplete: 'tel' })}
          ${field({ name: 'address', label: 'Address', required: true })}
          <div class="form-row">${field({ name: 'country', label: 'Country', type: 'select', options: COUNTRIES.map((c) => [c[0], c[1]]), value: country })}${field({ name: 'state', label: 'State / Region', type: country === 'NG' ? 'select' : 'text', options: NG_STATES })}</div>
          ${field({ name: 'password', label: 'Password', type: 'password', required: true, autocomplete: 'new-password', hint: 'At least 8 characters' })}
          ${field({ name: 'password2', label: 'Confirm Password', type: 'password', required: true, autocomplete: 'new-password' })}
        ` : `
          ${field({ name: 'name', label: role === 'PHARMACY' ? 'Pharmacy name' : role === 'LAB' ? 'Diagnostic center name' : role === 'AMBULANCE' ? 'Operator / Company name' : 'Full Name', required: true, autocomplete: 'name' })}
          ${field({ name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email' })}
          ${field({ name: 'phone', label: 'Phone', type: 'tel', autocomplete: 'tel', required: provider, placeholder: '+234 801 234 5678' })}
          ${provider ? `
            ${field({ name: 'specialty', label: role === 'AMBULANCE' ? 'Service level' : role === 'PHARMACY' || role === 'LAB' ? 'Category' : 'Specialty', type: 'select', options: SPECIALTIES[role], required: true })}
            ${field({ name: 'licenseNumber', label: role === 'AMBULANCE' ? 'Operating licence number' : 'Licence / Registration number', required: true, hint: 'e.g. MDCN, PCN, MLSCN or NMCN number - checked before you can serve patients' })}
            ${role === 'AMBULANCE' ? field({ name: 'vehicleNumber', label: 'Vehicle plate number', required: true }) : ''}
            ${role === 'PHARMACY' || role === 'LAB' ? field({ name: 'address', label: 'Address', required: true }) : ''}
          ` : ''}
          ${field({ name: 'country', label: 'Country', type: 'select', options: COUNTRIES.map((c) => [c[0], c[1]]), value: country })}
          ${field({ name: 'password', label: 'Password', type: 'password', required: true, autocomplete: 'new-password', hint: 'At least 8 characters' })}
          ${field({ name: 'password2', label: 'Confirm Password', type: 'password', required: true, autocomplete: 'new-password' })}
          ${field({ name: 'referralCode', label: 'Referral code (optional)', placeholder: 'NHXXXXXX', value: referral })}
        `}
        ${!login ? `<label class="check"><input type="checkbox" name="acceptTerms"> <span>I agree to the <a href="#" data-terms>Terms of Service</a> and <a href="#" data-privacy>Privacy Policy</a>, and consent to processing of my health data to provide care.</span></label>
          <label class="check"><input type="checkbox" name="marketingOptIn"> <span>Send me health tips and product updates (optional)</span></label>` : ''}
        <button class="btn ${provider ? 'btn-doctor' : 'btn-primary'} btn-block mt8" type="submit">${login ? 'Sign In' : 'Create Account'}</button>
      </form>
      ${state.config?.googleClientId && (!provider || login) ? `<div class="divider">or</div><div id="gsi" class="center"></div>` : ''}
      <p class="muted center mt12 small">🔒 Your data is encrypted in transit and never sold.</p>
    </div>`;
    wire(role, login);
  };

  const wire = (role, login) => {
    $('#change', el).onclick = () => { s.side = null; draw(); };
    $$('[data-mode]', el).forEach((c) => (c.onclick = () => { s.mode = c.dataset.mode; draw(); }));
    const pr = $('#prov-role', el);
    if (pr) pr.onchange = () => { s.role = pr.value; draw(); };
    $('[data-terms]', el)?.addEventListener('click', (e) => { e.preventDefault(); legal('terms'); });
    $('[data-privacy]', el)?.addEventListener('click', (e) => { e.preventDefault(); legal('privacy'); });
    $('#forgot', el)?.addEventListener('click', forgot);
    const form = $('#auth-form', el);
    const fs = $('#fsearch', el);
    if (fs) {
      let tmr = null, seq = 0;
      const nameField = role === 'INSTITUTION' ? 'instName' : 'name';
      fs.oninput = () => {
        clearTimeout(tmr);
        const q = fs.value.trim();
        if (q.length < 3) { $('#fres', el).innerHTML = ''; return; }
        tmr = setTimeout(async () => {
          const my = ++seq;
          const list = await get(`/facilities/search?claimable=1&limit=8&category=${FINDABLE[role]}&q=${encodeURIComponent(q)}`).catch(() => []);
          if (my !== seq) return;
          $('#fres', el).innerHTML = list.length ? list.map((x, i) => `<button type="button" class="fac-hit" data-i="${i}"><b>${esc(x.name)}</b><span>${esc([x.categoryLabel, x.lga, x.state].filter(Boolean).join(' • '))}</span></button>`).join('') : '<div class="small muted" style="padding:6px 2px">Not found. Fill in the form below and we will add it.</div>';
          $$('.fac-hit', el).forEach((b) => (b.onclick = () => {
            const x = list[Number(b.dataset.i)];
            form.listingId.value = x.id;
            if (form[nameField]) form[nameField].value = x.name;
            if (form.address && !form.address.value) form.address.value = [x.address, x.lga].filter(Boolean).join(', ');
            if (form.state && x.state) form.state.value = x.state;
            $('#fres', el).innerHTML = ''; fs.value = '';
            $('#fpick', el).innerHTML = `<div class="fac-picked">✓ <b>${esc(x.name)}</b> <span class="small muted">${esc([x.lga, x.state].filter(Boolean).join(', '))}</span> <button type="button" class="link" id="funpick">Change</button></div>`;
            $('#funpick', el).onclick = () => { form.listingId.value = ''; $('#fpick', el).innerHTML = ''; fs.focus(); };
          }));
        }, 300);
      };
    }
    form.onsubmit = async (e) => {
      e.preventDefault();
      const v = readForm(form);
      const btn = form.querySelector('[type=submit]');
      try {
        btn.disabled = true; btn.textContent = 'Please wait…';
        if (login) {
          if (!v.email || !v.password) throw new Error('Enter your email and password');
          const r = await post('/auth/login', { email: v.email, password: v.password, role: s.side === 'PROVIDER' ? role : 'PATIENT' });
          if (s.side === 'PROVIDER' && r.user.role === 'PATIENT') toast('No ' + role.toLowerCase() + ' profile on this account - signed in as patient');
          return startSession(r.token, r.user);
        }
        if (!v.acceptTerms) throw new Error('Please accept the Terms and Privacy Policy');
        if (!v.email || !/^\S+@\S+\.\S+$/.test(v.email)) throw new Error('Enter a valid email');
        if (!v.name && !v.instName) throw new Error('Enter your name');
        if ((v.password || '').length < 8) throw new Error('Password must be at least 8 characters');
        if (v.password !== v.password2) throw new Error('Passwords do not match');
        const c = COUNTRIES.find((x) => x[0] === v.country) || COUNTRIES[0];
        const profile = role === 'INSTITUTION'
          ? { name: v.instName, type: v.instType, licenseNumber: v.licenseNumber, email: v.email, phone: v.phone, address: v.address, state: v.state, country: v.country }
          : { specialty: v.specialty, licenseNumber: v.licenseNumber, vehicleNumber: v.vehicleNumber, address: v.address, pharmacyName: role === 'PHARMACY' ? v.name : undefined, labName: role === 'LAB' ? v.name : undefined, operatorName: role === 'AMBULANCE' ? v.name : undefined };
        if (role !== 'PATIENT' && !profile.licenseNumber) throw new Error('Licence number is required');
        const r = await post('/auth/register', {
          email: v.email, password: v.password, name: role === 'INSTITUTION' ? v.name : v.name, phone: v.phone || undefined, role,
          profile: role === 'PATIENT' ? {} : profile, country: c[0], currency: c[2], timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || c[3],
          locale: (navigator.language || 'en').slice(0, 2), acceptTerms: true, marketingOptIn: !!v.marketingOptIn, referralCode: v.referralCode || undefined, mkt: signupAttribution(),
        });
        adEvent('CompleteRegistration');
        if (v.listingId) { auth.token = r.token; await post('/facilities/' + v.listingId + '/claim').catch((err) => toast('⚠️ ' + err.message)); }
        toast('🎉 Account created! Check your email for a verification code.');
        startSession(r.token, r.user);
      } catch (err) {
        toastErr(err instanceof ApiError && err.data?.details ? new Error(err.data.details[0]?.message || err.message) : err);
        btn.disabled = false; btn.textContent = login ? 'Sign In' : 'Create Account';
      }
    };
    if ($('#gsi', el)) googleButton($('#gsi', el), s.side === 'PROVIDER' ? role : 'PATIENT');
  };
  draw();
}

function googleButton(host, role) {
  const init = () => {
    window.google.accounts.id.initialize({
      client_id: state.config.googleClientId,
      callback: async (resp) => {
        try { const r = await post('/auth/google', { credential: resp.credential, role, referralCode: (() => { try { return localStorage.getItem('nh_ref') || undefined; } catch { return undefined; } })() }); startSession(r.token, r.user); } catch (e) { toastErr(e); }
      },
    });
    window.google.accounts.id.renderButton(host, { theme: 'outline', size: 'large', width: 300, text: 'continue_with', shape: 'pill' });
  };
  if (window.google?.accounts?.id) return init();
  const sc = document.createElement('script');
  sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true; sc.onload = init;
  document.head.appendChild(sc);
}

async function forgot() {
  let email = '';
  await formModal('🔑 Reset password', [{ name: 'email', label: 'Account email', type: 'email', required: true }], {
    submit: 'Send code', intro: '<p class="muted mb8">We will email a 6-digit code (and send it on WhatsApp if your phone is on file).</p>',
    onSubmit: async (v) => { email = v.email; await post('/auth/forgot-password', { email }); },
  }) && formModal('Enter code & new password', [
    { name: 'code', label: '6-digit code', inputmode: 'numeric', required: true },
    { name: 'password', label: 'New password', type: 'password', autocomplete: 'new-password', required: true, hint: 'At least 8 characters' },
  ], {
    submit: 'Reset password',
    onSubmit: async (v) => { await post('/auth/reset-password', { email, code: v.code, password: v.password }); toast('✅ Password reset - sign in with your new password'); },
  });
}

export function legalHtml(kind) {
  const co = state.config?.company || {};
  const name = esc(co.name || 'N-Health');
  const id = `${name}${co.rc ? ', RC ' + esc(co.rc) : ''}${co.address ? ', ' + esc(co.address) : ''}`;
  const dpo = esc(co.dpoEmail || 'privacy@nhealth.com.ng');
  const support = esc(co.supportEmail || 'support@nhealth.com.ng');
  const ngo = state.config?.donationPartner;
  const terms = `<div class="modal-title">📜 Terms of Service</div><div class="muted" style="line-height:1.6">
    <p><b>Who we are.</b> N-Health is operated by ${id}. Contact: ${support}.</p>
    <p><b>1. Service.</b> N-Health is a technology marketplace that connects patients with independent, licensed and verified healthcare providers (doctors, nurses, pharmacies, diagnostic centres, hospitals and ambulance operators). Each provider is responsible for the care, medicines and tests they provide and holds its own licences. N-Health does not practise medicine, sell medicines, run laboratories or operate ambulances. In an emergency always call 112 (or 767 in Lagos).</p>
    <p><b>2. Accounts.</b> You must give accurate information. Providers must hold valid licences and pass identity and licence verification before serving patients.</p>
    <p><b>3. Payments.</b> You pay providers directly: by card, transfer or USSD through our licensed payment partners (Paystack, Flutterwave), which settle the money into the provider's own account, through our licensed escrow partner, or in cash at the service. N-Health does not hold your money or the provider's money. N-Health's fee is shown before you pay.</p>
    <p><b>4. Reward coins.</b> Coins are a free loyalty reward from N-Health (for example for inviting friends). They cannot be bought, sold, moved into another person's balance or exchanged for cash, and they have no cash value. You can use them towards services on N-Health for yourself, or offer them towards another member's bill (they apply it to one of their own bills; unused coins come back to you). N-Health pays the provider for the part paid with coins. N-Health may change or end the reward programme with notice.</p>
    <p><b>5. Refunds.</b> If a provider declines or you cancel 12+ hours ahead, card payments are refunded to your card or account by the payment partner, and coins used are returned to your coin balance.</p>
    <p><b>6. Donations.</b> Money donations go straight into the account of ${ngo ? esc(ngo.name) + ' (a registered NGO' + (ngo.regNumber ? ', ' + esc(ngo.regNumber) : '') + ')' : 'the hospital treating the patient'}, never to N-Health or to individuals. N-Health takes no fee on donations. Campaigns are reviewed before going live. Blood and organs are never bought or sold: the organ register records your wishes only, and transplants are arranged by licensed hospitals.</p>
    <p><b>7. Health insurance.</b> N-Health lists health plans and accredited HMOs and passes your enrolment request to the HMO. The HMO enrols you and you pay premiums to the HMO directly.</p>
    <p><b>8. Health jobs.</b> Posting and applying for jobs is free. N-Health never charges job seekers and is not a recruitment agency: employers choose and hire.</p>
    <p><b>9. Conduct.</b> No harassment, fraud, fake campaigns or misuse of medical information.</p>
    <p><b>Marketing measurement.</b> When you open an N-Health link, flyer or QR code, we record the open with a random ID your browser keeps (no name or contact details), your device type and approximate city, to see which campaigns work. If you choose to allow location, we also record your precise position at that moment; you can refuse, and the page works the same. Ad cookies load only if you accept them. Your IP address is stored only as a one-way hash.</p>
    <p><b>10. Liability.</b> Providers are responsible for the care they deliver. N-Health is liable only to the extent required by law. These terms are governed by the laws of the Federal Republic of Nigeria.</p></div>`;
  const privacy = `<div class="modal-title">🔒 Privacy Policy</div><div class="muted" style="line-height:1.6">
    <p><b>Data controller.</b> ${id}. Data Protection Officer: ${dpo}. We comply with the Nigeria Data Protection Act 2023 (NDPA) and the NDPC's General Application and Implementation Directive.</p>
    <p><b>What we collect:</b> account details (name, email, phone), health profile and records you add, bookings, prescriptions, test results, messages, your location during emergencies and when you search nearby, payment references (never your card number), and identity checks: the result from our verification partner Didit, or, if you use the in-app identity form, the details and ID, selfie and proof-of-address images you upload, kept in private storage that only authorised staff can open.</p>
    <p><b>Why and on what basis:</b> to provide the care you ask for (contract), to keep you safe in emergencies (vital interest), to prevent fraud and meet legal duties (legal obligation), and, only with your consent, for health data sharing and marketing. You can withdraw consent at any time in Settings.</p>
    <p><b>Who sees it:</b> providers see your records only when you book with or are treated by them, and every access is logged and visible to you in Settings → Privacy. Our processors: Paystack and Flutterwave (payments), PayScrow (escrow), Didit (identity), Resend (email), Meta WhatsApp Business (messages and codes), Cloudinary (file storage) and our hosting provider. Some of them process data outside Nigeria under the safeguards the NDPA requires.</p>
    <p><b>Messages:</b> we contact you in the app, by email and on WhatsApp. We do not send SMS.</p>
    <p><b>How long we keep it:</b> while your account is open. When you delete your account we erase your profile, documents and reminders; medical and payment records are kept without your identity for as long as the law requires.</p>
    <p><b>Your rights:</b> access and download your data, correct it, object, restrict, withdraw consent, or delete your account at any time from Settings, or write to ${dpo}. You can also complain to the Nigeria Data Protection Commission (ndpc.gov.ng).</p>
    <p><b>We never sell your data.</b> Card details are handled only by our PCI-DSS certified payment partners.</p></div>`;
  return kind === 'terms' ? terms : privacy;
}
export const legal = (kind) => modal(legalHtml(kind));
/** Public pages for the app stores and links: /#/legal/privacy and /#/legal/terms (also /privacy and /terms). */
export function legalScreen(el, { kind }) {
  el.innerHTML = `<div class="pp-hero">${logo(36)}<b>N-Health</b></div><div class="card legal-page">${legalHtml(kind === 'terms' ? 'terms' : 'privacy')}</div>`;
}
