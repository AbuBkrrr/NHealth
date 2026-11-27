import { get, post, auth, ApiError } from '../lib/api.js';
import { state } from '../lib/store.js';
import { esc, $, $$, toast, toastErr, field, readForm, formModal, modal } from '../lib/ui.js';
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
        <div class="auth-header"><div class="icon">🏥</div><h2>Welcome to N-Health</h2><p>Who are you signing in as?</p></div>
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
        try { const r = await post('/auth/google', { credential: resp.credential, role }); startSession(r.token, r.user); } catch (e) { toastErr(e); }
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
    submit: 'Send code', intro: '<p class="muted mb8">We will email (and SMS, if your phone is on file) a 6-digit code.</p>',
    onSubmit: async (v) => { email = v.email; await post('/auth/forgot-password', { email }); },
  }) && formModal('Enter code & new password', [
    { name: 'code', label: '6-digit code', inputmode: 'numeric', required: true },
    { name: 'password', label: 'New password', type: 'password', autocomplete: 'new-password', required: true, hint: 'At least 8 characters' },
  ], {
    submit: 'Reset password',
    onSubmit: async (v) => { await post('/auth/reset-password', { email, code: v.code, password: v.password }); toast('✅ Password reset - sign in with your new password'); },
  });
}

export function legal(kind) {
  const terms = `<div class="modal-title">📜 Terms of Service</div><div class="muted" style="line-height:1.6">
    <p><b>1. Service.</b> N-Health connects patients with independent, verified healthcare providers. N-Health does not itself practise medicine. In an emergency always call your local emergency number (112 / 767 in Nigeria).</p>
    <p><b>2. Accounts.</b> You must give accurate information. Providers must hold valid licences and pass identity (KYC) and licence verification before serving patients.</p>
    <p><b>3. Coins.</b> N-Health coins are a closed-loop prepaid credit for healthcare services on the platform. They are not money, cannot be transferred between users and cannot be withdrawn as cash. Top-ups are processed by licensed payment partners.</p>
    <p><b>4. Escrow & refunds.</b> Some payments are held in escrow until you confirm the service. Appointments cancelled 12+ hours ahead, or declined by the provider, are refunded in coins.</p>
    <p><b>5. Conduct.</b> No harassment, fraud, fake campaigns or misuse of medical information. Fundraising campaigns are reviewed before going live.</p>
    <p><b>Marketing measurement.</b> When you open an N-Health link or QR code, we record the open with a random ID your browser keeps (no name or contact details), your device type and approximate city, to see which campaigns work. If you choose to allow location, we also record your precise position at that moment; you can refuse, and the page works the same. Ad cookies load only if you accept them. Your IP address is stored only as a one-way hash.</p>
    <p><b>6. Liability.</b> Providers are responsible for the care they deliver. N-Health is liable only to the extent required by law.</p></div>`;
  const privacy = `<div class="modal-title">🔒 Privacy Policy</div><div class="muted" style="line-height:1.6">
    <p>We follow the Nigeria Data Protection Act (NDPA 2023) and GDPR principles.</p>
    <p><b>What we collect:</b> account details, health profile, bookings, prescriptions, lab results, messages, location during emergencies, and identity verification results from our KYC partner Didit (we store the outcome and the last 4 digits of your ID, not your document images).</p>
    <p><b>Why:</b> to deliver care you request, keep you safe, prevent fraud and meet legal duties. Providers see your records only when you book or are treated by them; every access is logged and visible to you in Settings → Privacy.</p>
    <p><b>Your rights:</b> access and download your data, correct it, withdraw consent, or delete your account at any time from Settings. Contact: privacy@nhealth.com.ng.</p>
    <p><b>We never sell your data.</b> Payment card details are handled only by our PCI-DSS certified payment partners.</p></div>`;
  modal(kind === 'terms' ? terms : privacy);
}
