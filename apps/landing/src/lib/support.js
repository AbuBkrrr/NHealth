// Help bubble: live chat with the N-Health team (signed in or not), email, and WhatsApp when configured.
// Visitors keep a private chat key in this browser so they can come back to the conversation.
import { getFresh, post } from './api.js';
import { state } from './store.js';
import { esc, $, toastErr, dt } from './ui.js';

const KEY = 'nh_chat_token';
let open = false, timer = null, view = 'menu';
const token = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
const hideOn = () => /^#\/(chat\/|patient\/emergency|ambulance|institution\/er|e\/)/.test(location.hash) || location.hash.startsWith('#/admin');

function ensure() {
  if (document.getElementById('help-fab')) return;
  document.body.insertAdjacentHTML('beforeend', `<button id="help-fab" class="help-fab" aria-label="Help and support" title="Help & support">💬</button>
    <div id="help-panel" class="help-panel hidden" role="dialog" aria-label="Help and support"></div>`);
  $('#help-fab').onclick = () => (open ? close() : openPanel('menu'));
}
function place() {
  const fab = document.getElementById('help-fab'); if (!fab) return;
  fab.classList.toggle('hidden', hideOn());
  fab.classList.toggle('with-nav', !!document.querySelector('#nav-host nav'));
  if (hideOn() && open) close();
}
function close() { open = false; clearInterval(timer); $('#help-panel')?.classList.add('hidden'); }

export function openPanel(v = 'menu') {
  ensure(); open = true; view = v;
  $('#help-panel').classList.remove('hidden');
  v === 'chat' ? drawChat() : drawMenu();
}

function drawMenu() {
  clearInterval(timer);
  const s = state.config?.support || {};
  const email = s.email || state.config?.company?.supportEmail || 'support@nhealth.com.ng';
  $('#help-panel').innerHTML = `<div class="hp-head"><b>Help & support</b><button class="hp-x" aria-label="Close">×</button></div>
    <div class="hp-body"><p class="small muted">Hi${state.user ? ' ' + esc(state.user.name.split(' ')[0]) : ''} 👋 How can we help?</p>
      <button class="hp-opt" id="hp-chat"><span>💬</span><span><b>Chat with us</b><small>Our team replies here and by email</small></span></button>
      <a class="hp-opt" href="mailto:${esc(email)}?subject=${encodeURIComponent('N-Health help')}"><span>✉️</span><span><b>Email us</b><small>${esc(email)}</small></span></a>
      ${s.whatsapp ? `<a class="hp-opt" target="_blank" rel="noopener" href="https://wa.me/${esc(s.whatsapp)}?text=${encodeURIComponent('Hello N-Health, I need help with ')}"><span>🟢</span><span><b>WhatsApp us</b><small>Chat on WhatsApp</small></span></a>` : ''}
      <a class="hp-opt" href="#/support" ${state.user ? '' : 'hidden'}><span>❓</span><span><b>FAQs & my tickets</b><small>Common questions</small></span></a>
      <p class="small muted center mt8">In an emergency call <b>112</b>.</p></div>`;
  $('#help-panel .hp-x').onclick = close;
  $('#hp-chat').onclick = () => openPanel('chat');
  $('#help-panel a[href="#/support"]')?.addEventListener('click', close);
}

async function drawChat() {
  const p = $('#help-panel');
  if (!p.querySelector('.hp-chat')) {
    p.innerHTML = `<div class="hp-head"><button class="hp-back" aria-label="Back">←</button><b>Chat with N-Health</b><button class="hp-x" aria-label="Close">×</button></div>
      <div class="hp-chat" id="hp-msgs"><div class="small muted center">Loading…</div></div>
      <form class="hp-form" id="hp-form">
        ${state.user || token() ? '' : '<div class="hp-who"><input name="name" placeholder="Your name" required autocomplete="name"><input name="email" type="email" placeholder="Your email (for our reply)" required autocomplete="email"></div>'}
        <div class="hp-send"><textarea name="message" rows="2" placeholder="Type your message…" required></textarea><button class="btn btn-primary btn-sm" type="submit">Send</button></div></form>`;
    p.querySelector('.hp-x').onclick = close;
    p.querySelector('.hp-back').onclick = () => openPanel('menu');
    $('#hp-form').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target; const b = f.querySelector('[type=submit]');
      const body = { message: f.message.value.trim(), name: f.name?.value?.trim(), email: f.email?.value?.trim(), token: token() || undefined };
      if (!body.message) return;
      b.disabled = true;
      try {
        const r = await post('/support/chat', body);
        if (r.token) { try { localStorage.setItem(KEY, r.token); } catch { /* */ } f.querySelector('.hp-who')?.remove(); }
        f.message.value = '';
        render(r);
      } catch (err) { toastErr(err); } finally { b.disabled = false; }
    };
  }
  await refresh();
  clearInterval(timer);
  timer = setInterval(() => { if (open && view === 'chat' && !document.hidden) refresh(); }, 8000);
}
async function refresh() {
  if (!state.user && !token()) return render({ messages: [] });
  try { render(await getFresh('/support/chat' + (state.user ? '' : '?token=' + encodeURIComponent(token())))); } catch { /* offline: keep what is shown */ }
}
function render(t) {
  const box = $('#hp-msgs'); if (!box) return;
  const msgs = t.messages || [];
  box.innerHTML = msgs.length
    ? msgs.map((m) => `<div class="hp-msg ${m.fromStaff ? 'staff' : 'me'}">${m.fromStaff ? '<div class="hp-by">N-Health team</div>' : ''}${esc(m.body).replace(/\n/g, '<br>')}<div class="hp-time">${dt(m.createdAt)}</div></div>`).join('')
      + (t.status === 'open' ? '<div class="small muted center">We usually reply within a few hours. We also email you the reply.</div>' : '')
    : '<div class="small muted center">Send us a message and our team will reply here and by email.</div>';
  box.scrollTop = box.scrollHeight;
}

/** Shows the bubble on every screen except emergency, chats and the admin area. */
export function initSupport() {
  ensure(); place();
  window.addEventListener('hashchange', () => setTimeout(place, 50));
  new MutationObserver(place).observe(document.getElementById('nav-host') || document.body, { childList: true });
  if (new URLSearchParams(location.search).get('help')) setTimeout(() => openPanel('chat'), 1200);
  import('./realtime.js').then(({ on }) => on?.('support:message', () => { if (open && view === 'chat') refresh(); })).catch(() => null);
}
