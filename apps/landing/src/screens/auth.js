import { post, ApiError } from '../lib/api.js';
import { state } from '../lib/store.js';
import { esc, $, $$, toast, toastErr, field, readForm, formModal, modal } from '../lib/ui.js';
import { startSession } from '../main.js';
import { SPECIALTIES, PROVIDER_ROLES, INSTITUTION_TYPES, COUNTRIES, NG_STATES } from './data.js';

const guessCountry = () => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (COUNTRIES.find((c) => c[3] === tz) || COUNTRIES[0])[0];
};

export function authScreen(el) {
  const s = { side: 'PATIENT', role: 'DOCTOR', mode: 'login' };
  const draw = () => {
    const provider = s.side === 'PROVIDER';
    const role = provider ? s.role : 'PATIENT';
    const isInst = role === 'INSTITUTION';
    const login = s.mode === 'login';
    const country = guessCountry();
    el.innerHTML = `<div class="auth-screen">
      <div class="auth-header"><div class="icon">🏥</div><h2>Welcome to N-Health</h2><p>${login ? 'Sign in to continue' : 'Create your account'}</p></div>
      <div class="auth-role-selector" style="grid-template-columns:1fr 1fr">
        <div class="role-card ${!provider ? 'selected' : ''}" data-side="PATIENT" tabindex="0"><div class="icon">👤</div><div class="name">Patient</div><div class="desc">Access healthcare services</div></div>
        <div class="role-card ${provider ? 'selected' : ''}" data-side="PROVIDER" tabindex="0"><div class="icon">⚕️</div><div class="name">Health Provider</div><div class="desc">Doctors, pharmacies, labs & more</div></div>
      </div>
      ${provider ? `<div class="form-group"><label>Provider type</label><select id="prov-role">${PROVIDER_ROLES.map(([k, i, n]) => `<option value="${k}" ${k === s.role ? 'selected' : ''}>${i} ${n}</option>`).join('')}</select></div>` : ''}
      <div class="tab-container"><div class="tab ${login ? 'active' : ''}" data-mode="login" tabindex="0">Sign In</div><div class="tab ${!login ? 'active' : ''}" data-mode="register" tabindex="0">Create Account</div></div>
      <form id="auth-form" novalidate ${isInst && !login ? 'class="institution-register-form" style="max-height:none"' : ''}>
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
          ${field({ name: 'name', label: role === 'PHARMACY' ? 'Pharmacy name' : role === 'LAB' ? 'Lab / Centre name' : role === 'AMBULANCE' ? 'Operator / Company name' : 'Full Name', required: true, autocomplete: 'name' })}
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
          ${field({ name: 'referralCode', label: 'Referral code (optional)', placeholder: 'NHXXXXXX' })}
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
    $$('[data-side]', el).forEach((c) => (c.onclick = () => { s.side = c.dataset.side; draw(); }));
    $$('[data-mode]', el).forEach((c) => (c.onclick = () => { s.mode = c.dataset.mode; draw(); }));
    const pr = $('#prov-role', el);
    if (pr) pr.onchange = () => { s.role = pr.value; draw(); };
    $('[data-terms]', el)?.addEventListener('click', (e) => { e.preventDefault(); legal('terms'); });
    $('[data-privacy]', el)?.addEventListener('click', (e) => { e.preventDefault(); legal('privacy'); });
    $('#forgot', el)?.addEventListener('click', forgot);
    const form = $('#auth-form', el);
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
          locale: (navigator.language || 'en').slice(0, 2), acceptTerms: true, marketingOptIn: !!v.marketingOptIn, referralCode: v.referralCode || undefined,
        });
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
    <p><b>6. Liability.</b> Providers are responsible for the care they deliver. N-Health is liable only to the extent required by law.</p></div>`;
  const privacy = `<div class="modal-title">🔒 Privacy Policy</div><div class="muted" style="line-height:1.6">
    <p>We follow the Nigeria Data Protection Act (NDPA 2023) and GDPR principles.</p>
    <p><b>What we collect:</b> account details, health profile, bookings, prescriptions, lab results, messages, location during emergencies, and identity verification results from our KYC partner Didit (we store the outcome and the last 4 digits of your ID, not your document images).</p>
    <p><b>Why:</b> to deliver care you request, keep you safe, prevent fraud and meet legal duties. Providers see your records only when you book or are treated by them; every access is logged and visible to you in Settings → Privacy.</p>
    <p><b>Your rights:</b> access and download your data, correct it, withdraw consent, or delete your account at any time from Settings. Contact: privacy@nhealth.com.ng.</p>
    <p><b>We never sell your data.</b> Payment card details are handled only by our PCI-DSS certified payment partners.</p></div>`;
  modal(kind === 'terms' ? terms : privacy);
}
