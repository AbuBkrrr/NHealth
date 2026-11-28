// Reusable flows shared by several screens: payment, reviews, emergency numbers.
import { get, getFresh, post, del } from '../lib/api.js';
import { state, setState } from '../lib/store.js';
import { esc, $, $$, modal, toast, money, coins, busy, webOrigin } from '../lib/ui.js';
import { go } from '../lib/router.js';

export async function loadBalance() {
  try { const r = await get('/credits/balance'); setState({ balance: r.balance }); return r.balance; } catch { return state.balance ?? 0; }
}

const PURPOSE = { APPOINTMENT: 'appointment', PHARMACY_ORDER: 'pharmacy', LAB_TEST: 'lab', NURSE_REQUEST: 'nurse' };

/**
 * Payment chooser. Money always goes straight to the provider: card/transfer/USSD through a licensed gateway that
 * settles to the provider's own account, PayScrow escrow (a licensed escrow partner), or cash at the service.
 * Reward coins (free, never sold) can pay the whole bill, or part of it with the rest paid by card or cash.
 * Resolves true when paid (or checkout opened).
 */
export function payModal({ payableType, payableId, amount, title = 'Complete payment' }) {
  return new Promise((resolve) => {
    const coinable = !!PURPOSE[payableType];
    Promise.all([loadBalance(), coinable ? getFresh('/coins/bill?payableType=' + payableType + '&payableId=' + payableId).catch(() => null) : null]).then(([bal, bill]) => {
      const cv = bill?.coinValue || state.config?.coinValue || 10;
      const total = bill?.total ?? amount;
      const applied = bill?.applied || 0;
      const owed = Math.max(0, total - applied); // left after coins already applied
      const myCoins = Math.floor((bal || 0) / cv);
      const cash = state.config?.cashEnabled && coinable;
      const card = coinable && (state.config?.gateways || []).some((g) => g === 'paystack' || g === 'flutterwave');
      // Coins for part of the bill: at most what they have, leaving at least ₦1 to pay by card or cash.
      const capCoins = bill?.maxCoins ?? Infinity; // pharmacy orders: delivery fee + over-the-counter items only
      const maxPart = Math.min(myCoins, capCoins, Math.ceil(owed / cv) - 1);
      const canPart = coinable && !applied && maxPart >= 1 && (card || cash);
      const canAll = myCoins * cv >= owed && owed > 0 && capCoins * cv >= total;
      const naira = (n) => money(n, { naira: true, convert: false });
      modal(`<div class="modal-title">💳 ${esc(title)}</div>
        <div class="booking-summary"><div class="total">Bill: ${naira(total)}</div>
          ${applied ? `<div class="small mt8">🪙 ${bill.appliedCoins} coins applied (−${naira(applied)}) <button class="link" id="unapply">Remove</button></div>` : ''}
          <div class="small" id="topay" style="font-weight:600;margin-top:4px">${applied ? 'Left to pay: ' + naira(owed) : ''}</div></div>
        ${canPart ? `<label class="check mt12"><input type="checkbox" id="usepart"> <span>Use some of my coins (you have ${myCoins}) and pay the rest</span></label>
          ${bill?.coinNote ? `<div class="small muted">${esc(bill.coinNote)}.</div>` : ''}
          <div class="row mt8 hidden" id="partbox"><input type="number" id="partn" min="1" max="${maxPart}" value="${maxPart}" inputmode="numeric" style="max-width:110px"> <span class="small muted">coins (up to ${maxPart})</span></div>` : ''}
        <div class="payment-methods mt12" id="pm"></div>
        <button class="btn btn-primary btn-block mt12" id="paynow">Continue</button>
        <button class="btn btn-outline btn-block mt8" data-later>Pay later</button>`, (box, close) => {
        let m = null;
        const part = () => ($('#usepart', box)?.checked ? Math.max(1, Math.min(maxPart, Math.floor(Number($('#partn', box).value) || 0))) : 0);
        const draw = () => {
          const k = part();
          const left = owed - k * cv;
          const opts = [
            card && ['card', '💳', 'Card / Transfer / USSD', 'Paid straight to the provider\'s account'],
            cash && ['cash', '💵', 'Cash', 'Pay the provider at the service'],
            state.config?.escrow && coinable && !applied && !k && ['escrow', '🔒', 'Escrow', 'Held by our licensed escrow partner until the service is done'],
            canAll && !k && ['coins', '🪙', applied ? 'Pay the rest with coins' : 'Pay it all with my coins', `You have ${myCoins} coins`],
          ].filter(Boolean);
          if (!opts.some((o) => o[0] === m)) m = opts[0]?.[0];
          $('#pm', box).innerHTML = opts.map(([key, i, n, d]) => `<div class="payment-method ${key === m ? 'selected' : ''}" data-m="${key}"><div class="icon">${i}</div><div class="name">${n}</div><div class="desc">${d}</div></div>`).join('')
            || '<div class="banner warn">Payment isn\'t available for this provider yet. Please contact them.</div>';
          $('#paynow', box).disabled = !opts.length;
          if (k) $('#topay', box).textContent = `${k} coins (−${naira(k * cv)}) • you pay ${naira(left)} by ${m === 'cash' ? 'cash' : 'card'}`;
          else if (!applied) $('#topay', box).textContent = '';
          $$('[data-m]', box).forEach((x) => (x.onclick = () => { m = x.dataset.m; draw(); }));
        };
        draw();
        $('#usepart', box)?.addEventListener('change', (e) => { $('#partbox', box).classList.toggle('hidden', !e.target.checked); draw(); });
        $('#partn', box)?.addEventListener('input', draw);
        $('#unapply', box)?.addEventListener('click', (e) => busy(e.target, async () => {
          await del('/coins/bill', { payableType, payableId }); await loadBalance(); toast('🪙 Coins returned'); close(); payModal({ payableType, payableId, amount, title }).then(resolve);
        }));
        box.querySelector('[data-later]').onclick = () => { close(); resolve(false); };
        $('#paynow', box).onclick = (e) => busy(e.target, async () => {
          const k = part();
          if (k && m !== 'coins') { await post('/coins/bill', { payableType, payableId, coins: k }); loadBalance(); }
          if (m === 'card') {
            const r = await post('/payments/card', { payableType, payableId, returnUrl: webOrigin() + '/' });
            sessionStorage.setItem('nh_paid', r.internalRef);
            close(); resolve(true);
            if (r.checkoutUrl) location.href = r.checkoutUrl; else throw new Error('Checkout unavailable');
            return;
          }
          if (m === 'cash') {
            await post('/payments', { payableType, payableId, method: 'CASH' });
            toast(`💵 Pay the provider ${naira(owed - k * cv)} in cash - they will confirm receipt in the app`);
            close(); resolve(true); return;
          }
          if (m === 'coins') {
            await post('/payments', { payableType, payableId, method: 'WALLET' });
            loadBalance();
            toast('✅ Paid with your reward coins');
            close(); resolve(true); return;
          }
          const r = await post('/escrow/initiate', { purpose: PURPOSE[payableType], purposeId: payableId, description: title });
          close(); resolve(true);
          if (r.paymentLink) location.href = r.paymentLink;
        });
      });
    });
  });
}

export function reviewModal({ contextType, contextId, name }) {
  modal(`<div class="modal-title">⭐ Rate ${esc(name || 'your provider')}</div><div class="stars center">${[1, 2, 3, 4, 5].map((n) => `<span data-s="${n}">★</span>`).join('')}</div>
    <div class="form-group mt8"><textarea id="rc" rows="3" placeholder="Share your experience (optional)"></textarea></div><button class="btn btn-primary btn-block" id="rs">Submit review</button>`, (box, close) => {
    let r = 0;
    $$('[data-s]', box).forEach((s) => (s.onclick = () => { r = +s.dataset.s; $$('[data-s]', box).forEach((x) => x.classList.toggle('on', +x.dataset.s <= r)); }));
    $('#rs', box).onclick = (e) => busy(e.target, async () => {
      if (!r) throw new Error('Choose a rating');
      await post('/reviews', { contextType, contextId, rating: r, comment: $('#rc', box).value });
      toast('🙏 Thanks for your review'); close();
    });
  });
}

export function emergencyNumbers() {
  const n = state.config?.emergencyNumbers || {};
  return n[state.user?.country] || n.DEFAULT || ['112'];
}

// ---------------------------------------------------------------- invite friends (home pages)
/** Card inviting friends and family (patients) or colleagues (providers) with the person's own link. */
export function inviteCard() {
  const u = state.user; if (!u?.referralCode) return '';
  const patient = u.role === 'PATIENT';
  return `<div class="card invite-card"><div class="row"><div style="font-size:30px">🎁</div><div class="grow">
      <div style="font-weight:700">${patient ? 'Invite friends & family' : 'Invite colleagues & patients'}</div>
      <div class="small muted">${patient ? 'Help someone you love get care faster - doctors, pharmacies and emergency help in one app.' : 'Bring other providers and your patients to N-Health.'} Your code: <b>${esc(u.referralCode)}</b></div>
      ${(state.config?.inviteRewardCoins ?? 1) > 0 ? `<div class="small" style="margin-top:2px">🪙 Earn ${state.config?.inviteRewardCoins ?? 1} coin for every friend who joins. <span class="invite-stats"></span></div>` : ''}</div></div>
    <div class="row mt8"><button class="btn btn-primary btn-sm grow" data-invite="share">📤 Share invite</button><button class="btn btn-outline btn-sm" data-invite="wa" aria-label="Share on WhatsApp">WhatsApp</button><button class="btn btn-outline btn-sm" data-invite="copy" aria-label="Copy invite link">Copy</button></div></div>`;
}
/** Fills "3 joined • 3 coins earned" into any invite card on screen. */
export function loadInviteStats(root = document) {
  get('/invites/summary').then((r) => {
    root.querySelectorAll('.invite-stats').forEach((x) => { x.textContent = r.joined ? `${r.joined} joined • ${r.coinsEarned.toLocaleString()} coin${r.coinsEarned === 1 ? '' : 's'} earned` : ''; });
  }).catch(() => null);
}
export function inviteText() {
  const u = state.user || {};
  const link = `${webOrigin()}/?ref=${encodeURIComponent(u.referralCode || '')}`;
  const text = u.role === 'PATIENT'
    ? `Join me on N-Health: book doctors, order medicines, get test results and emergency help in one app. Sign up with my code ${u.referralCode}: ${link}`
    : `I use N-Health to see patients, take payments and manage my practice. Join with my code ${u.referralCode}: ${link}`;
  return { text, link };
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-invite]'); if (!b) return;
  const { text } = inviteText();
  if (b.dataset.invite === 'wa') { window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener'); return; }
  if (b.dataset.invite === 'share' && navigator.share) { navigator.share({ title: 'N-Health', text }).catch(() => null); return; }
  try { await navigator.clipboard.writeText(text); toast('📋 Invite copied - paste it in any chat'); } catch { toast(text); }
});
