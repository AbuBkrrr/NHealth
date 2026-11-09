// Reusable flows shared by several screens: payment, reviews, emergency numbers.
import { get, post } from '../lib/api.js';
import { state, setState } from '../lib/store.js';
import { esc, $, $$, modal, toast, money, coins, busy } from '../lib/ui.js';
import { go } from '../lib/router.js';

export async function loadBalance() {
  try { const r = await get('/credits/balance'); setState({ balance: r.balance }); return r.balance; } catch { return state.balance ?? 0; }
}

const PURPOSE = { APPOINTMENT: 'appointment', PHARMACY_ORDER: 'pharmacy', LAB_TEST: 'lab', NURSE_REQUEST: 'nurse' };

/**
 * Payment chooser: N-Health coins (instant) or PayScrow escrow (card/transfer, held until the service is confirmed).
 * Resolves true when paid (or escrow checkout opened).
 */
export function payModal({ payableType, payableId, amount, title = 'Complete payment' }) {
  return new Promise((resolve) => {
    loadBalance().then((bal) => {
      const enough = bal >= amount;
      const escrow = state.config?.escrow && PURPOSE[payableType];
      const cash = state.config?.cashEnabled && PURPOSE[payableType];
      const card = PURPOSE[payableType] && (state.config?.gateways || []).some((g) => g === 'paystack' || g === 'flutterwave');
      modal(`<div class="modal-title">💳 ${esc(title)}</div>
        <div class="booking-summary"><div class="total">Amount: ${money(amount)}</div></div>
        <div class="payment-methods mt12">
          <div class="payment-method ${enough ? 'selected' : 'disabled'}" data-m="coins"><div class="icon">🪙</div><div class="name">N-Health Coins</div><div class="desc">Balance ${coins(bal)}</div></div>
          ${card ? '<div class="payment-method" data-m="card"><div class="icon">💳</div><div class="name">Card / Transfer / USSD</div><div class="desc">Paid straight to the provider</div></div>' : ''}
        ${escrow ? '<div class="payment-method" data-m="escrow"><div class="icon">🔒</div><div class="name">Escrow</div><div class="desc">Card / transfer, released after service</div></div>' : ''}
        ${cash ? '<div class="payment-method" data-m="cash"><div class="icon">💵</div><div class="name">Cash</div><div class="desc">Pay the provider directly</div></div>' : ''}
        </div>
        ${!enough ? '<div class="banner warn">Not enough coins. <button class="btn btn-sm btn-primary" data-topup>Top up</button></div>' : ''}
        <button class="btn btn-primary btn-block mt12" id="paynow" ${!enough && !escrow && !cash && !card ? 'disabled' : ''}>Pay ${money(amount)}</button>
        <button class="btn btn-outline btn-block mt8" data-later>Pay later</button>`, (box, close) => {
        let m = enough ? 'coins' : card ? 'card' : escrow ? 'escrow' : cash ? 'cash' : 'coins';
        const sel = () => $$('[data-m]', box).forEach((x) => x.classList.toggle('selected', x.dataset.m === m));
        sel();
        $$('[data-m]', box).forEach((x) => (x.onclick = () => { if (x.classList.contains('disabled')) return; m = x.dataset.m; sel(); }));
        box.querySelector('[data-topup]')?.addEventListener('click', () => { close(); resolve(false); go('/patient/wallet?amount=' + Math.ceil(amount - bal)); });
        box.querySelector('[data-later]').onclick = () => { close(); resolve(false); };
        $('#paynow', box).onclick = (e) => busy(e.target, async () => {
          if (m === 'card') {
          const r = await post('/payments/card', { payableType, payableId, returnUrl: location.origin + '/' });
          sessionStorage.setItem('nh_paid', r.internalRef);
          close(); resolve(true);
          if (r.checkoutUrl) location.href = r.checkoutUrl; else throw new Error('Checkout unavailable');
          return;
        }
        if (m === 'cash') {
          await post('/payments', { payableType, payableId, method: 'CASH' });
          toast('💵 Pay the provider in cash - they will confirm receipt in the app');
          close(); resolve(true); return;
        }
        if (m === 'coins') {
            await post('/payments', { payableType, payableId, method: 'WALLET' });
            loadBalance();
            toast('✅ Paid with coins');
            close(); resolve(true);
          } else {
            const r = await post('/escrow/initiate', { purpose: PURPOSE[payableType], purposeId: payableId, description: title });
            close(); resolve(true);
            if (r.paymentLink) location.href = r.paymentLink;
          }
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
