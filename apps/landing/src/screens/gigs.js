// Health jobs ("gigs"): health workers find jobs and shifts; verified providers recruit.
// Pay is a salary or shift rate paid by the employer outside N-Health, so it is shown in naira.
import { get, getFresh, post, patch, put } from '../lib/api.js';
import { state } from '../lib/store.js';
import { esc, $, $$, appBar, card, cardHead, item, badge, empty, skeleton, tabs, toast, toastErr, formModal, confirmBox, busy, money, dateOnly, ago, field, readForm, fileToDataUri, pickFile } from '../lib/ui.js';
import { go } from '../lib/router.js';
import { NG_STATES } from './data.js';

const ORG = ['INSTITUTION', 'PHARMACY', 'LAB', 'AMBULANCE', 'DOCTOR', 'NURSE'];
let OPTS = null;
const options = async () => (OPTS = OPTS || (await get('/gigs/options')));
const naira = (v) => money(v, { naira: true, convert: false });
export function payText(g) {
  if (g.payMin == null && g.payMax == null) return g.payNegotiable ? 'Pay negotiable' : 'Pay not stated';
  const r = g.payMin != null && g.payMax != null && Number(g.payMin) !== Number(g.payMax) ? `${naira(g.payMin)} – ${naira(g.payMax)}` : naira(g.payMin ?? g.payMax);
  return `${r} ${g.periodLabel || ''}${g.payNegotiable ? ' (negotiable)' : ''}`;
}
const STATUS_LABEL = { APPLIED: 'Applied', SHORTLISTED: 'Shortlisted', INTERVIEW: 'Interview', OFFERED: 'Offer', HIRED: 'Hired', NOT_SELECTED: 'Not selected', WITHDRAWN: 'Withdrawn' };
const statusBadge = (s) => badge({ APPLIED: 'PENDING', SHORTLISTED: 'CONFIRMED', INTERVIEW: 'CONFIRMED', OFFERED: 'ACCEPTED', HIRED: 'COMPLETED', NOT_SELECTED: 'CANCELLED', WITHDRAWN: 'CANCELLED', OPEN: 'ACTIVE', PAUSED: 'PENDING', FILLED: 'COMPLETED', CLOSED: 'CANCELLED' }[s] || s, STATUS_LABEL[s] || s.charAt(0) + s.slice(1).toLowerCase());

function gigCard(g, href) {
  const where = [g.city, g.state].filter(Boolean).join(', ');
  return `<div class="card gig-card" data-go="${href}" tabindex="0">
    <div class="row"><div class="grow"><div style="font-weight:700">${g.urgent ? '<span class="gig-urgent">⚡ Urgent</span> ' : ''}${esc(g.title)}</div>
      <div class="small muted">${esc(g.orgName)}${where ? ' • 📍 ' + esc(where) : ''}${g.distanceKm != null ? ' • ' + g.distanceKm + ' km' : ''}</div></div>
      ${g.myStatus ? statusBadge(g.myStatus) : ''}</div>
    <div class="gig-tags"><span>${esc(g.typeLabel)}</span>${g.positions > 1 ? `<span>${g.positions} positions</span>` : ''}<span>${esc((g.experienceLabel || '').split(' (')[0])}</span>${(g.shifts || []).map((s) => `<span>${esc(s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' '))}</span>`).join('')}</div>
    <div class="row between"><b class="gig-pay">${payText(g)}</b><span class="small muted">${ago(g.createdAt)}</span></div></div>`;
}

// ================= HEALTH WORKERS =================
export async function jobsScreen(el, _p, q) {
  let tab = q.tab || 'find';
  el.innerHTML = appBar({ title: '💼 Health jobs', back: true }) + tabs([['find', 'Find jobs'], ['mine', 'My applications'], ['profile', 'Work profile']], tab) + '<div id="tb"></div>';
  const o = await options();
  const filt = { profession: q.profession || '', state: q.state || '', type: '' };
  const drawFind = async (tb) => {
    const wp = await get('/work-profile').catch(() => null);
    if (!filt.profession && wp?.profession && !wp.draft) filt.profession = wp.profession;
    tb.innerHTML = (!wp || wp.draft ? `<div class="banner info">Set up your work profile once (profession, licence, experience, CV) to apply in one tap and get alerts for new jobs.<button class="btn btn-sm btn-primary" id="setup">Set up</button></div>` : '')
      + `<div class="gig-filters">
        <select id="fp"><option value="">All professions</option>${Object.entries(o.professions).map(([k, v]) => `<option value="${k}" ${k === filt.profession ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select>
        <select id="fs"><option value="">All states</option>${NG_STATES.map((s) => `<option ${s === filt.state ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <select id="ft"><option value="">Any type</option>${Object.entries(o.types).map(([k, v]) => `<option value="${k}" ${k === filt.type ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
      </div><div id="gl">${skeleton(3)}</div>`;
    $('#setup', tb) && ($('#setup', tb).onclick = () => switchTab('profile'));
    const list = async () => {
      const qs = new URLSearchParams(Object.entries(filt).filter(([, v]) => v)).toString();
      const gs = await get('/gigs' + (qs ? '?' + qs : ''));
      $('#gl', tb).innerHTML = gs.length ? gs.map((g) => gigCard(g, '/jobs/' + g.id)).join('') : empty('💼', 'No open jobs match yet. Turn on job alerts in your work profile and we will tell you when one is posted.');
    };
    $('#fp', tb).onchange = (e) => { filt.profession = e.target.value; list(); };
    $('#fs', tb).onchange = (e) => { filt.state = e.target.value; list(); };
    $('#ft', tb).onchange = (e) => { filt.type = e.target.value; list(); };
    await list();
  };
  const drawMine = async (tb) => {
    const apps = await getFresh('/gigs/applications/mine');
    tb.innerHTML = apps.length ? apps.map((a) => `<div class="card" data-go="/jobs/${a.gigId}" tabindex="0"><div class="row"><div class="grow"><div style="font-weight:600">${esc(a.gig.title)}</div><div class="small muted">${esc(a.gig.orgName)} • applied ${ago(a.createdAt)}</div></div>${statusBadge(a.status)}</div>${a.employerNote ? `<div class="banner info mt8">💬 ${esc(a.employerNote)}</div>` : ''}</div>`).join('') : empty('📄', 'You have not applied for any job yet.');
  };
  const drawProfile = async (tb) => {
    const wp = (await get('/work-profile').catch(() => null)) || {};
    tb.innerHTML = card(`<form id="wpf" novalidate>
      ${field({ name: 'profession', label: 'Profession', type: 'select', required: true, options: [['', 'Choose…'], ...Object.entries(o.professions).map(([k, v]) => [k, v.label])], value: wp.profession || '' })}
      ${field({ name: 'specialty', label: 'Specialty (optional)', value: wp.specialty || '', placeholder: 'e.g. ICU nursing, paediatrics, retail pharmacy' })}
      <div class="form-row">${field({ name: 'licenseBody', label: 'Licensing body', value: wp.licenseBody || '', placeholder: 'MDCN, NMCN, PCN, MLSCN…' })}${field({ name: 'licenseNumber', label: 'Licence number', value: wp.licenseNumber || '' })}</div>
      ${field({ name: 'yearsExperience', label: 'Years of experience', type: 'number', min: 0, value: wp.yearsExperience ?? '' })}
      ${field({ name: 'skills', label: 'Skills', type: 'textarea', rows: 2, value: wp.skills || '', placeholder: 'e.g. IV cannulation, ACLS, dispensing, phlebotomy' })}
      ${field({ name: 'summary', label: 'About you', type: 'textarea', rows: 3, value: wp.summary || '' })}
      <div class="form-group"><label>CV (PDF or photo)</label><div class="row"><button type="button" class="btn btn-outline btn-sm" id="cv">📎 ${wp.cvUrl ? 'Replace CV' : 'Upload CV'}</button><span class="small muted" id="cvn">${wp.cvUrl ? '✓ CV uploaded' : ''}</span></div></div>
      <div class="form-group"><label>Job types you want</label><div class="chk-grid">${Object.entries(o.types).map(([k, v]) => `<label class="check"><input type="checkbox" name="et_${k}" ${(wp.employmentTypes || []).includes(k) ? 'checked' : ''}> <span>${esc(v)}</span></label>`).join('')}</div></div>
      <div class="form-group"><label>States you can work in (none = anywhere)</label><select id="wst" multiple size="5">${NG_STATES.map((s) => `<option ${(wp.states || []).includes(s) ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="form-row">${field({ name: 'expectedPay', label: 'Expected pay (₦)', type: 'number', min: 0, value: wp.expectedPay ?? '' })}${field({ name: 'payPeriod', label: 'Per', type: 'select', options: Object.entries(o.periods).map(([k, v]) => [k, v.replace('per ', '')]), value: wp.payPeriod || 'MONTH' })}</div>
      ${field({ name: 'openToWork', label: 'Open to work (employers can find me)', type: 'checkbox', value: wp.openToWork !== false })}
      ${field({ name: 'alerts', label: 'Alert me when a matching job is posted', type: 'checkbox', value: wp.alerts !== false })}
      <button class="btn btn-primary btn-block mt8" type="submit">Save work profile</button></form>`);
    let cv = { cvUrl: wp.cvUrl, cvFileId: wp.cvFileId };
    $('#cv', tb).onclick = async (e) => {
      const f = await pickFile('application/pdf,image/*'); if (!f) return;
      await busy(e.target, async () => { const up = await post('/uploads', { dataUri: await fileToDataUri(f), folder: 'documents', private: true }); cv = { cvUrl: up.url, cvFileId: up.fileId }; $('#cvn', tb).textContent = '✓ ' + f.name; });
    };
    $('#wpf', tb).onsubmit = async (e) => {
      e.preventDefault();
      const v = readForm(e.target);
      if (!v.profession) return toast('⚠️ Choose your profession');
      const body = { ...v, ...cv, employmentTypes: Object.keys(o.types).filter((k) => v['et_' + k]), states: $$('#wst option', tb).filter((x) => x.selected).map((x) => x.value) };
      await busy(e.target.querySelector('[type=submit]'), async () => { await put('/work-profile', body); toast('✅ Work profile saved'); switchTab('find'); });
    };
  };
  const draw = async () => {
    const tb = $('#tb', el); tb.innerHTML = skeleton(3);
    if (tab === 'find') return drawFind(tb);
    if (tab === 'mine') return drawMine(tb);
    return drawProfile(tb);
  };
  const switchTab = (k) => { tab = k; $$('[data-tab]', el).forEach((x) => x.classList.toggle('active', x.dataset.tab === k)); draw(); };
  $$('[data-tab]', el).forEach((x) => (x.onclick = () => switchTab(x.dataset.tab)));
  await draw();
}

export async function jobScreen(el, { id }) {
  const g = await getFresh('/gigs/' + id);
  const where = [g.address, g.city, g.state].filter(Boolean).join(', ');
  const a = g.myApplication && g.myApplication.status !== 'WITHDRAWN' ? g.myApplication : null;
  el.innerHTML = appBar({ title: '💼 Job', back: g.isPoster ? '/hiring' : '/jobs' }) + card(`
    <div style="font-size:17px;font-weight:700">${g.urgent ? '<span class="gig-urgent">⚡ Urgent</span> ' : ''}${esc(g.title)}</div>
    <div class="muted">${esc(g.orgName)}</div>
    <div class="gig-pay mt8" style="font-size:16px">${payText(g)}</div>
    <div class="kv"><span class="k">Role</span><span class="v">${esc(g.professionLabel)}${g.specialty ? ' • ' + esc(g.specialty) : ''}</span></div>
    <div class="kv"><span class="k">Positions</span><span class="v">${g.positions}</span></div>
    <div class="kv"><span class="k">Type</span><span class="v">${esc(g.typeLabel)}${g.hoursPerWeek ? ' • ' + g.hoursPerWeek + ' h/week' : ''}</span></div>
    <div class="kv"><span class="k">Experience</span><span class="v">${esc(g.experienceLabel)}</span></div>
    ${g.shifts?.length ? `<div class="kv"><span class="k">Shifts</span><span class="v">${g.shifts.map((s) => s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' ')).join(', ')}</span></div>` : ''}
    ${g.startDate ? `<div class="kv"><span class="k">Starts</span><span class="v">${dateOnly(g.startDate)}${g.endDate ? ' → ' + dateOnly(g.endDate) : ''}</span></div>` : ''}
    ${where ? `<div class="kv"><span class="k">Location</span><span class="v">📍 ${esc(where)}</span></div>` : ''}
    ${g.licenseRequired && g.licence ? `<div class="kv"><span class="k">Licence</span><span class="v">Current ${esc(g.licence)} licence required</span></div>` : ''}
    ${g.deadline ? `<div class="kv"><span class="k">Apply by</span><span class="v">${dateOnly(g.deadline)}</span></div>` : ''}
    ${g.benefits?.length ? `<div class="gig-tags mt8">${g.benefits.map((b) => `<span>✓ ${esc(b)}</span>`).join('')}</div>` : ''}
    <div class="mt8" style="white-space:pre-wrap">${esc(g.description)}</div>
    ${g.qualifications ? `<div class="mt8"><b>Requirements</b><div style="white-space:pre-wrap">${esc(g.qualifications)}</div></div>` : ''}
    <p class="small muted mt8">Posted ${ago(g.createdAt)}. N-Health never asks job seekers for money; report any employer who does.</p>`)
    + (g.isPoster ? `<button class="btn btn-primary btn-block" data-go="/hiring/${g.id}">👥 See applicants (${g.applicants})</button>`
      : a ? card(`<div class="row"><div class="grow"><b>Your application</b><div class="small muted">Sent ${ago(a.createdAt)}</div></div>${statusBadge(a.status)}</div>${a.employerNote ? `<div class="banner info mt8">💬 ${esc(a.employerNote)}</div>` : ''}
          <div class="row mt8"><button class="btn btn-outline btn-sm grow" data-go="/chat/${g.posterId}">💬 Message employer</button>${['APPLIED', 'SHORTLISTED', 'INTERVIEW', 'OFFERED'].includes(a.status) ? '<button class="btn btn-outline btn-sm" id="wd">Withdraw</button>' : ''}</div>`)
      : g.closed ? '<div class="banner warn">This job is no longer taking applications.</div>'
      : '<button class="btn btn-primary btn-block" id="apply">Apply now</button>')
    + (g.isPoster ? '' : '<button class="link center mt12" id="rep" style="display:block;margin:12px auto">🚩 Report this job</button>');
  $('#apply', el) && ($('#apply', el).onclick = async () => {
    const wp = await get('/work-profile').catch(() => null);
    if (!wp || wp.draft) { toast('Set up your work profile first'); return go('/jobs?tab=profile'); }
    formModal('Apply: ' + esc(g.title), [
      { name: 'coverNote', label: 'Short note to the employer', type: 'textarea', rows: 4, placeholder: 'Why you are a good fit, when you can start' },
      { name: 'expectedPay', label: `Your expected pay (₦ ${esc(g.periodLabel || '')})`, type: 'number', min: 0, value: wp.expectedPay ?? '' },
      { name: 'availableFrom', label: 'Available from', type: 'date' },
    ], { submit: 'Send application', intro: `<p class="small muted">The employer sees your work profile${wp.cvUrl ? ' and CV' : ''}. Your phone and email are shared only if they shortlist you.</p>`, onSubmit: async (v) => { await post('/gigs/' + g.id + '/apply', { ...v, expectedPay: v.expectedPay === '' ? undefined : v.expectedPay, availableFrom: v.availableFrom || undefined }); toast('✅ Application sent'); jobScreen(el, { id }); } });
  });
  $('#wd', el) && ($('#wd', el).onclick = async () => { if (await confirmBox('Withdraw your application?', { ok: 'Withdraw', danger: true })) { await post('/gigs/applications/' + a.id + '/withdraw').catch(toastErr); jobScreen(el, { id }); } });
  $('#rep', el) && ($('#rep', el).onclick = () => formModal('Report this job', [{ name: 'reason', label: 'What is wrong?', type: 'select', options: ['Asks applicants for money', 'Fake or misleading job', 'Unsafe or illegal', 'Discriminatory', 'Other'] }, { name: 'details', label: 'Details (optional)', type: 'textarea' }], { submit: 'Report', onSubmit: async (v) => { await post('/gigs/' + g.id + '/report', { reason: v.reason + (v.details ? ': ' + v.details : '') }); toast('Thank you. Our team will review it.'); } }));
}

// ================= EMPLOYERS =================
export async function hiringScreen(el) {
  el.innerHTML = appBar({ title: '💼 Hiring', back: true }) + `<button class="btn btn-primary btn-block mb8" data-go="/hiring/new">+ Post a job</button>
    <p class="small muted" style="margin:0 4px 8px">Health workers open to work near you get an alert the moment you post.</p><div id="hl">${skeleton(3)}</div>`;
  const posts = await getFresh('/gigs/mine/posted');
  $('#hl', el).innerHTML = posts.length ? posts.map((g) => `<div class="card"><div class="row" data-go="/hiring/${g.id}" tabindex="0"><div class="grow"><div style="font-weight:700">${esc(g.title)}</div><div class="small muted">${esc(g.typeLabel)} • ${g.positions} position${g.positions > 1 ? 's' : ''} • posted ${ago(g.createdAt)}</div></div>${statusBadge(g.status)}</div>
      <div class="gig-stats"><span><b>${g.applicants}</b> applicants</span><span><b>${g.newApplicants}</b> new</span><span><b>${g.hired}</b> hired</span><span><b>${g.views}</b> views</span></div>
      <div class="row wrap mt8"><button class="btn btn-primary btn-sm grow" data-go="/hiring/${g.id}">👥 Applicants</button>
        ${g.status === 'OPEN' ? `<button class="btn btn-outline btn-sm" data-st="PAUSED" data-id="${g.id}">Pause</button><button class="btn btn-outline btn-sm" data-st="FILLED" data-id="${g.id}">Filled</button>` : ''}
        ${g.status === 'PAUSED' ? `<button class="btn btn-outline btn-sm" data-st="OPEN" data-id="${g.id}">Reopen</button>` : ''}
        ${g.status !== 'CLOSED' ? `<button class="btn btn-outline btn-sm" data-st="CLOSED" data-id="${g.id}">Close</button>` : ''}</div></div>`).join('')
    : empty('💼', 'No job posts yet. Post one to reach nurses, doctors, pharmacists and other health workers near you.');
  el.onclick = async (e) => {
    const b = e.target.closest('[data-st]'); if (!b) return;
    if (['FILLED', 'CLOSED'].includes(b.dataset.st) && !(await confirmBox(b.dataset.st === 'FILLED' ? 'Mark as filled? Applicants still waiting will be told.' : 'Close this job? Applicants still waiting will be told.'))) return;
    await busy(b, async () => { await patch('/gigs/' + b.dataset.id, { status: b.dataset.st }); hiringScreen(el); });
  };
}

export async function postJobScreen(el) {
  const o = await options();
  const role = state.user.role;
  const roles = (o.hires[role] || []).map((k) => [k, o.professions[k].label]);
  if (!ORG.includes(role) || !roles.length) { el.innerHTML = appBar({ title: 'Post a job', back: '/hiring' }) + empty('💼', 'Only providers can post jobs.'); return; }
  const p = await get('/provider-profile').catch(() => ({}));
  el.innerHTML = appBar({ title: '+ Post a job', back: '/hiring' }) + card(`<form id="pj" novalidate>
    ${field({ name: 'profession', label: 'Who are you recruiting?', type: 'select', required: true, options: [['', 'Choose…'], ...roles] })}
    ${field({ name: 'title', label: 'Job title', placeholder: 'e.g. Night shift ICU nurse' })}
    ${field({ name: 'specialty', label: 'Specialty (optional)', placeholder: 'e.g. Paediatrics, theatre, retail pharmacy' })}
    <div class="form-row">${field({ name: 'positions', label: 'Number needed', type: 'number', min: 1, value: 1, required: true })}${field({ name: 'experience', label: 'Experience level', type: 'select', options: Object.entries(o.experience) })}</div>
    ${field({ name: 'employmentType', label: 'Job type', type: 'select', options: Object.entries(o.types) })}
    <div class="form-group"><label>Shifts</label><div class="chk-grid">${Object.entries(o.shifts).map(([k, v]) => `<label class="check"><input type="checkbox" name="sh_${k}"> <span>${esc(v)}</span></label>`).join('')}</div></div>
    <div class="form-row">${field({ name: 'hoursPerWeek', label: 'Hours per week', type: 'number', min: 1 })}${field({ name: 'startDate', label: 'Start date', type: 'date' })}</div>
    ${field({ name: 'endDate', label: 'End date (locum / contract)', type: 'date' })}
    <div class="form-row">${field({ name: 'payMin', label: 'Pay from (₦)', type: 'number', min: 0, placeholder: '150000' })}${field({ name: 'payMax', label: 'Pay up to (₦)', type: 'number', min: 0, placeholder: '250000' })}</div>
    ${field({ name: 'payPeriod', label: 'Pay is', type: 'select', options: Object.entries(o.periods), value: 'MONTH' })}
    ${field({ name: 'payNegotiable', label: 'Negotiable', type: 'checkbox' })}
    <div class="form-group"><label>Benefits</label><div class="chk-grid">${o.benefits.map((b) => `<label class="check"><input type="checkbox" name="bn_${esc(b)}"> <span>${esc(b)}</span></label>`).join('')}</div></div>
    ${field({ name: 'licenseRequired', label: 'Current professional licence required', type: 'checkbox', value: true })}
    ${field({ name: 'qualifications', label: 'Requirements', type: 'textarea', rows: 3, placeholder: 'e.g. RN/RM, BLS certificate, 2 years ICU experience' })}
    ${field({ name: 'description', label: 'About the job', type: 'textarea', rows: 5, required: true, placeholder: 'Duties, team, what a normal shift looks like…' })}
    <div class="form-row">${field({ name: 'state', label: 'State', type: 'select', options: [['', '—'], ...NG_STATES], value: p.state || '' })}${field({ name: 'city', label: 'City / area', value: p.city || '' })}</div>
    ${field({ name: 'deadline', label: 'Apply by', type: 'date' })}
    ${field({ name: 'urgent', label: '⚡ Urgent (shown first)', type: 'checkbox' })}
    <p class="small muted">Do not ask applicants to pay anything. Posts that do are removed.</p>
    <button class="btn btn-primary btn-block mt8" type="submit">Post job</button></form>`);
  const f = $('#pj', el);
  f.profession.onchange = () => { if (!f.title.value) f.title.placeholder = (roles.find((r) => r[0] === f.profession.value) || [, ''])[1]; };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const v = readForm(f);
    if (!v.profession) return toast('⚠️ Choose who you are recruiting');
    if (!v.description || v.description.length < 20) return toast('⚠️ Describe the job (a sentence or two)');
    const body = { ...v, shifts: Object.keys(o.shifts).filter((k) => v['sh_' + k]), benefits: o.benefits.filter((b) => v['bn_' + b]) };
    for (const k of ['payMin', 'payMax', 'hoursPerWeek']) if (body[k] === '') delete body[k];
    for (const k of ['startDate', 'endDate', 'deadline']) if (!body[k]) delete body[k];
    await busy(f.querySelector('[type=submit]'), async () => {
      const g = await post('/gigs', body);
      toast(g.alerted ? `✅ Posted - ${g.alerted} health worker${g.alerted > 1 ? 's' : ''} alerted` : '✅ Job posted');
      go('/hiring/' + g.id, { replace: true });
    });
  };
}

export async function applicantsScreen(el, { id }) {
  const [g, list] = await Promise.all([getFresh('/gigs/' + id), getFresh('/gigs/' + id + '/applicants')]);
  el.innerHTML = appBar({ title: '👥 Applicants', back: '/hiring' }) + card(`<div class="row"><div class="grow"><b>${esc(g.title)}</b><div class="small muted">${esc(g.typeLabel)} • ${g.positions} position${g.positions > 1 ? 's' : ''} • ${payText(g)}</div></div>${statusBadge(g.status)}</div><button class="link mt8" data-go="/jobs/${g.id}">View the post</button>`)
    + (list.length ? list.map((a) => {
      const p = a.profile || {}, u = a.applicant;
      return card(`<div class="row"><div class="avatar">${u.avatarUrl ? `<img src="${esc(u.avatarUrl)}" alt="">` : '👤'}</div><div class="grow"><div style="font-weight:700">${esc(u.name)} ${u.idVerified ? '<span class="badge badge-success">ID verified</span>' : ''} ${u.providerVerified ? '<span class="badge badge-success">Licence verified</span>' : ''}</div>
          <div class="small muted">${esc(p.professionLabel || '')}${p.specialty ? ' • ' + esc(p.specialty) : ''} • ${p.yearsExperience ?? 0} yrs • applied ${ago(a.createdAt)}</div></div>${statusBadge(a.status)}</div>
        ${p.licenseNumber ? `<div class="kv"><span class="k">Licence</span><span class="v">${esc(p.licenseBody || '')} ${esc(p.licenseNumber)}</span></div>` : '<div class="small" style="color:var(--warning)">⚠️ No licence number given</div>'}
        ${a.expectedPay ? `<div class="kv"><span class="k">Expects</span><span class="v">${money(a.expectedPay, { naira: true, convert: false })} ${esc(g.periodLabel || '')}</span></div>` : ''}
        ${a.availableFrom ? `<div class="kv"><span class="k">Available from</span><span class="v">${dateOnly(a.availableFrom)}</span></div>` : ''}
        ${p.skills ? `<div class="small mt8"><b>Skills:</b> ${esc(p.skills)}</div>` : ''}
        ${a.coverNote ? `<div class="banner info mt8">💬 ${esc(a.coverNote)}</div>` : ''}
        ${u.phone || u.email ? `<div class="small mt8">📞 ${esc(u.phone || '—')} • ✉️ ${esc(u.email || '—')}</div>` : '<div class="small muted mt8">Phone and email appear once you shortlist.</div>'}
        <div class="row wrap mt8">${p.cvUrl ? `<a class="btn btn-outline btn-sm" href="${esc(p.cvUrl)}" target="_blank" rel="noopener">📄 CV</a>` : ''}<button class="btn btn-outline btn-sm" data-go="/chat/${u.id}">💬 Message</button>${u.phone ? `<a class="btn btn-outline btn-sm" href="tel:${esc(u.phone)}">📞 Call</a>` : ''}</div>
        <div class="row wrap mt8">${[['SHORTLISTED', 'Shortlist'], ['INTERVIEW', 'Invite to interview'], ['OFFERED', 'Make offer'], ['HIRED', 'Hired ✓'], ['NOT_SELECTED', 'Not selected']].filter(([s]) => s !== a.status).map(([s, l]) => `<button class="btn ${s === 'NOT_SELECTED' ? 'btn-outline' : s === 'HIRED' ? 'btn-success' : 'btn-primary'} btn-sm" data-dec="${s}" data-id="${a.id}">${l}</button>`).join('')}</div>`);
    }).join('') : card(empty('👥', 'No applicants yet. Health workers who match get an alert; share the job to reach more.')));
  el.onclick = async (e) => {
    const b = e.target.closest('[data-dec]'); if (!b) return;
    const s = b.dataset.dec;
    const ask = { INTERVIEW: 'When and where is the interview?', OFFERED: 'Offer details (pay, start date)', SHORTLISTED: 'Message to the applicant (optional)' }[s];
    const send = async (note) => { await patch('/gigs/applications/' + b.dataset.id, { status: s, employerNote: note || undefined }); toast('✅ Applicant told'); applicantsScreen(el, { id }); };
    if (ask) return formModal(b.textContent, [{ name: 'note', label: ask, type: 'textarea', rows: 3, required: s !== 'SHORTLISTED' }], { submit: 'Send', onSubmit: (v) => send(v.note) });
    if (await confirmBox(s === 'HIRED' ? 'Mark as hired? The applicant is told in the app and on WhatsApp.' : 'Tell the applicant they were not selected?')) await busy(b, () => send());
  };
}
