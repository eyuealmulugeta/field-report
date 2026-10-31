// The screens of slice 1: sign in, first-time profile, Today, Start of day, Attendance and crew, Me,
// and holding pages for Reports and Requests. Each returns { head, body, foot, tab, fab }.

import { html, icon } from '../core/dom.js';
import { dayLabel, dayLetter, addDays, weekday } from '../core/util.js';
import { pdfName } from '../core/names.js';
import { isDemo, APP_VERSION } from '../core/api.js';
import { doneCount, WEATHER, GROUND, WEATHER_PIC, PPE } from '../model/report.js';
import { inboxLink } from '../model/follow.js';
import { totals, STATES, STATE_LETTER, initials, wageDiffers, CREW_ST_WORD, crewCloses } from '../model/crew.js';
import { thumb } from './work.js';
import { head, stepHead, nav, chips, stepper, dayList, kpi } from './parts.js';

/** 2.4.0: the saved signature, or a button to sign full screen (or choose a PNG). */
const sigLine = p => (p.sig ? html`<div class="box pad sigbox"><img src="${p.sig}" alt="Your signature"><div class="spread small"><span class="muted">Signs every report you send</span><button type="button" class="btn t slim" data-act="sigFull">Change</button></div></div>`
  : html`<div class="box pad sigbox"><span class="muted small">Draw it full screen, or choose a PNG from your phone. It signs every report you send.</span><button type="button" class="btn s slim" data-act="sigFull">Sign</button></div>`);

/** 2.0.1: every notification sent to this person (reviews, alerts, tests, device reports), newest first, at the top of Today. */
const when = t => { const d = new Date(t); return isNaN(d) ? '' : `${d.toDateString().slice(4, 10)} · ${d.toTimeString().slice(0, 5)}`; };
export function inboxBox(c) {
  const seen = c.s.inboxSeen || '', items = (c.s.inbox || []).filter(x => x.t > seen);
  if (!items.length) return '';
  const shown = c.ui.inboxAll ? items : items.slice(0, 3);
  return html`<div class="spread"><div class="k">Notifications · ${items.length}</div><button type="button" class="btn t slim" data-act="inboxClear">Clear</button></div>
    <div class="box">${shown.map(x => { const inner = html`<span class="ic">${icon('bell')}</span><div class="n"><b>${x.h}</b><span class="pre">${x.m}</span><span class="muted tiny">From ${x.f || 'Field Report'} · ${when(x.t)}</span></div>`;
      const l = inboxLink(x);   // 2.8.1: older notifications open too
      return l ? html`<button type="button" class="li inbox" data-act="inboxGo" data-v="${l}">${inner}<span class="ch">${icon('chev')}</span></button>` : html`<div class="li inbox">${inner}</div>`; })}
    ${items.length > 3 ? html`<button type="button" class="li more" data-act="inboxMore">${c.ui.inboxAll ? 'Show fewer' : `Show all ${items.length}`}</button>` : ''}</div>`;
}

/** The steps that can be opened in this build. */
export const READY = new Set(['start', 'crew', 'work', 'equipment', 'materials', 'safety', 'photos', 'end', 'send']);

export function signin(c) {
  const su = c.ui.signup;
  // 2.4.0: a Google account without access signs up: full name and phone, then waits for the office
  if (su && !su.sent) return {
    head: head('Sign up', su.email || 'Your Google account'),
    body: html`<p class="muted">This Google account has no access to Field Report yet. Send your details to the office to ask for it.</p>
      <label class="lab" for="sun">Full name</label><input id="sun" class="fld" autocomplete="name" value="${c.s.profile.name || ''}">
      <label class="lab" for="sup">Phone</label><input id="sup" class="fld" type="tel" autocomplete="tel" placeholder="+251 …">
      <p class="muted small">You sign once your request is approved.</p>
      ${c.ui.error ? html`<p class="callout bad">${c.ui.error}</p>` : ''}`,
    foot: html`<button type="button" class="btn p" data-act="signUp" ${c.ui.busy ? 'disabled' : ''}>${c.ui.busy ? 'Sending…' : 'Send the request'}</button>
      <button type="button" class="btn t" data-act="signupBack">Use another account</button>`,
  };
  return {
    body: html`<div class="center-page">
      <img class="logo big" src="icon-192.png" alt="Amistad Prefab">
      <div><b class="title">Field Report</b><div class="muted">Amistad Prefab</div></div>
      ${su ? html`<p class="callout ok narrow">Please wait until your request is approved. You get an email when it is, then sign in again.</p>`
        : html`<p class="muted narrow">Sign in with your Google account. New here? Sign in, then send the sign-up form.</p>`}
      ${c.ui.error ? html`<p class="callout bad">${c.ui.error}</p>` : ''}
      <button type="button" class="btn o signin-btn" data-act="${su ? 'signupBack' : 'signin'}" ${c.ui.busy ? 'disabled' : ''}>${su ? 'Back' : html`<b class="g">G</b>${c.ui.busy ? 'Signing in…' : 'Sign in with Google'}`}</button>
      <div class="center muted small">Works offline after the first sign-in${isDemo() ? ' · demo, nothing is sent' : ''}</div>
    </div>`,
  };
}

export function profile(c) {
  const p = c.s.profile;
  return {
    head: head('Welcome', 'Asked once, then saved'),
    body: html`<p class="muted">Your name and position go on every report you sign.</p>
      <label class="lab" for="pn">Your name</label><input id="pn" class="fld" data-f="profile.name" value="${p.name}" autocomplete="name" ${p.locked ? 'readonly' : ''}>
      <label class="lab" for="pp">Position</label><input id="pp" class="fld" data-f="profile.position" value="${p.position}" placeholder="Site engineer" ${p.locked ? 'readonly' : ''}>
      <div class="k">Your signature</div>${sigLine(p)}${p.locked ? html`<p class="muted tiny">Confirmed by the office. Ask the office to change your name or position.</p>` : ''}`,
    foot: html`<button type="button" class="btn p" data-act="saveProfile">Continue</button>`,
  };
}

export function chooseProject(c) {
  return {
    head: head('Your projects', 'Pick the one you report on'),
    body: c.s.projects.length ? html`<div class="box">${c.s.projects.map(p => html`
      <button type="button" class="li" data-act="pickProject" data-v="${p.code}"><span class="ic">${icon('pin')}</span><div class="n"><b>${p.name}</b><span>${[p.location || p.address, p.code].filter(Boolean).join(' · ')}</span></div>${icon('chev')}</button>`)}</div>`
      : html`<p class="callout warn">No project is linked to your account yet. Ask the office to link you in Central Hub.</p>`,
    foot: html`<button type="button" class="btn o" data-act="refresh">Check again</button>`,
  };
}

/** Mon to Sun of this week: sent, waiting, missing or a day off. */
export function weekStrip(c) {
  const t = c.today, p = c.project;
  const mon = addDays(t, -((weekday(t) + 6) % 7));
  const days = [...Array(7)].map((_, i) => addDays(mon, i));
  return html`<div class="box pad weekrow">${days.map(d => {
    const r = c.s.drafts[`${p.code}|${d}`];
    const off = (p.nwDow || [0]).includes(weekday(d)) || (p.nonWorking || []).includes(d);
    const cls = r && r.sentAt ? 'ok' : r && r.nowork ? 'no' : d === t ? 'half' : off ? 'no' : d < t ? 'warn' : 'no';
    const mark = r && r.sentAt ? icon('check') : r && r.nowork ? '–' : d === t ? '•' : off ? '–' : d < t ? '!' : '';
    return html`<div title="${dayLabel(d)}">${dayLetter(d)}<span class="dot ${cls}">${mark}</span></div>`;
  })}</div>`;
}

/** 2.8.0: the day at a glance, at the top of Today: steps done, crew present, what needs you, Attention items. */
export function widget(c) {
  const r = c.report, rows = r && !r.nowork ? r.crew.rows || [] : [];
  const steps = r && !r.nowork ? doneCount(r) : 0, here = rows.filter(x => x.state === 'present').length, att = (r && r.attention || []).length;
  const k = (v, t, cls = '') => html`<div class="kpi ${cls}"><b>${v}</b><span>${t}</span></div>`;
  return html`<div class="wdg">${k(r && r.sentAt ? '✓' : r && r.nowork ? '–' : `${steps}/9`, r && r.sentAt ? 'Sent' : 'Steps')}${k(rows.length ? `${here}/${rows.length}` : '–', 'Crew in')}${k(c.needs.length, 'Needs you', c.needs.length ? 'bad' : '')}${k(att, 'Attention', att ? 'bad' : '')}</div>`;
}

/** 2.9.0: today's report was already sent from another phone of the project. */
const sentBox = c => (c.sentToday && !(c.report && c.report.sentAt) ? html`<p class="callout ok">${icon('check')} Report No. ${Number(c.sentToday.no) || c.sentToday.no} for today was sent by ${c.sentToday.by || 'another phone'} · ${c.sentToday.status === 'approved' ? 'Approved' : c.sentToday.status === 'changes' ? 'Sent back' : 'Submitted'}.</p>` : '');

export function today(c) {
  const p = c.project, r = c.report, no = r ? r.no : c.nextNo;
  const n = r && !r.nowork ? doneCount(r) : 0;
  const sub = `${p.location || p.address || p.code} · Day ${no}`;
  if (r && !r.nowork) {
    return {
      tab: 'today', fab: true,
      head: head(`Report #${no}`, `${dayLabel(c.today)} · saved on this phone`, `${n} of 9`),
      body: html`${widget(c)}${sentBox(c)}${inboxBox(c)}<div class="bar"><i style="width:${Math.round(n / 9 * 100)}%"></i></div>
        ${c.evening ? html`<p class="callout warn">It is after ${p.remindAt || '17:00'}. Finish steps 8 and 9 and send today's report.</p>` : ''}
        ${c.needs.length && !c.past ? html`<div class="k">Needs you</div>${needsBox(c)}` : ''}${attBox(r)}${dayList(r, READY)}
        <div class="row-links"><button type="button" class="btn t" data-act="go" data-to="crew">Attendance</button><button type="button" class="btn t" data-act="noWork">No work today</button><button type="button" class="btn t" data-act="spotOpen">Spotlight</button><button type="button" class="btn t bad-t" data-act="attOpen">Attention</button></div>`,
    };
  }
  return {
    tab: 'today',
    head: head(p.name, sub, p.code),
    body: html`${widget(c)}${sentBox(c)}${inboxBox(c)}<div class="soft">
        <div class="spread"><b class="big-t">Today · ${dayLabel(c.today)}</b><span class="k brand">Report #${no}</span></div>
        <div class="bar gap"><i style="width:0%"></i></div>
        <div class="muted small">${r && r.nowork ? `No work today: ${r.nowork.reason}` : c.dayOff ? 'A day off for this project · you can still report' : 'Not started · about 6 minutes in all'}</div>
      </div>
      <button type="button" class="btn p" data-act="startDay">${icon('sun')}Start today's report</button>
      <div class="grid2">
        <button type="button" class="box pad tile" data-act="startCrew"><b>Attendance</b><span class="muted small">Take it now</span></button>
        <button type="button" class="box pad tile" data-act="noWork"><b>No work today</b><span class="muted small">Give the reason</span></button>
      </div>
      <button type="button" class="btn o" data-act="spotOpen">${icon('bell')}Spotlight: share an observation</button>
      <button type="button" class="btn o bad-t" data-act="attOpen">${icon('alert')}Attention: a serious issue for the client</button>
      <div class="k">This week</div>${weekStrip(c)}
      <div class="k">Needs you</div>${needsBox(c)}
      <div class="muted tiny center">File name: ${pdfName(p, c.today, no)}</div>`,
  };
}

/** 2.7.0: today's Attention items, in red, on Today. */
const attBox = r => ((r.attention || []).length ? html`<button type="button" class="callout bad li" data-act="attOpen"><span class="ic bad">${icon('alert')}</span><div class="n"><b>Attention · ${r.attention.length} for the client</b><span>${r.attention[0].text}</span></div></button>` : '');

/** 2.7.0: an Attention item: a serious issue the client must know about. It goes in the report's red box and to Central Hub. */
export function attention(c) {
  const list = c.report.attention || [];
  return {
    head: stepHead('Attention', 'A serious issue for the client'),
    body: html`<p class="muted small">Only for a serious issue that needs the client's urgent attention (for example a safety risk, a design problem, or work stopped by the client). It is printed in a red box at the top of the report, and Central Hub lists it under Needs attention.</p>
      ${list.length ? html`<div class="box">${list.map(x => html`<div class="li"><span class="ic bad">${icon('alert')}</span><div class="n"><b>${x.text}</b><span>${x.at}</span></div>
        <button type="button" class="btn t" data-act="attDrop" data-v="${x.id}" aria-label="Remove">Remove</button></div>`)}</div>` : ''}
      <textarea class="fld" rows="3" data-ui="attText" placeholder="What is the issue, and what must the client do?">${c.ui.attText || ''}</textarea>
      <button type="button" class="btn p" data-act="attAdd">${icon('alert')}Add to the report</button>`,
  };
}

/** Reports the office sent back or commented on, newest first; each opens the day, with the comment and a reply box. */
function needsBox(c) {
  if (!c.needs.length) return html`<div class="box pad muted small">Nothing from the office.</div>`;
  return html`<div class="box">${c.needs.map(x => html`<button type="button" class="li" data-act="openDay" data-v="${x.date}"><span class="ic bad">${icon('alert')}</span>
    <div class="n"><b>Report #${x.no} ${x.kind === 'changes' ? 'sent back' : 'has a comment'} · ${dayLabel(x.date)}</b><span>${x.comment ? `${x.comment.by || 'Office'}: ${x.comment.text}` : 'Open it to see what to fix'}</span></div><span class="ch">${icon('chev')}</span></button>`)}</div>`;
}

export function start(c) {
  const s = c.report.start;
  return {
    head: stepHead('Start of day', 'Step 1 of 9 · Morning'),
    body: html`${s.carried ? html`<div class="soft flex"><span class="ic">${icon('copy')}</span><div class="small"><b>Filled in from yesterday</b><br><span class="muted">Change only what is different today.</span></div></div>` : ''}
      <div class="lab">Report number</div><div class="soft small"><b>No. ${c.report.no}</b> <span class="muted">· given by the office's server: one number per day for everyone</span></div>
      <div class="lab">Working hours</div>
      <div class="two"><input class="fld" type="time" data-f="start.start" value="${s.start}" aria-label="Start"><input class="fld" type="time" data-f="start.end" value="${s.end}" aria-label="End"></div>
      <div class="lab">Weather ${c.ui.wx ? html`<span class="muted thin">· ${c.ui.wx}</span>` : ''}</div>
      <div class="chips wx" role="group">${WEATHER.map(w => html`<button type="button" class="chip pic ${w === s.cond ? 'on' : ''}" data-act="pick" data-f="start.cond" data-v="${w}" aria-pressed="${w === s.cond}"><span class="big" aria-hidden="true">${WEATHER_PIC[w]}</span>${w}</button>`)}</div>
      <div class="two"><input class="fld" inputmode="decimal" data-f="start.tempC" value="${s.tempC}" placeholder="°C" aria-label="Temperature in °C"><input class="fld" data-f="start.wind" value="${s.wind}" placeholder="Wind, rain…" aria-label="Weather note"></div>
      <div class="lab">Ground</div>${chips('start.ground', GROUND, s.ground)}
      <div class="lab">Safety gear checked on the crew <span class="muted thin">· tick each one you saw</span></div>
      <div class="chips" role="group">${PPE.map(g => { const on = (s.ppe || []).includes(g); return html`<button type="button" class="chip ${on ? 'on' : ''}" data-act="ppe" data-v="${g}" aria-pressed="${on}">${on ? '✓ ' : ''}${g}</button>`; })}</div>
      <div class="lab">Location</div>
      <div class="soft small flex"><span class="ic">${icon('pin')}</span><div><b>${c.project.location || s.location || 'Not set yet'}</b><br><span class="muted">Set by the office in Central Hub</span></div></div>`,
    foot: html`<button type="button" class="btn p" data-act="startDone">${icon('check')}Looks right</button>`,
  };
}

const seg = (r, i) => html`<div class="seg" role="group" aria-label="${r.name}">${STATES.map(st => html`
  <button type="button" class="${r.state === st ? STATE_LETTER[st] : ''}" data-act="mark" data-i="${i}" data-v="${st}" aria-pressed="${r.state === st}" title="${st}">${STATE_LETTER[st]}</button>`)}</div>`;

export function crew(c) {
  const cr = c.report.crew, s = c.report.start;
  const t = totals(cr, s.start, s.end);
  const trades = [...new Set(cr.rows.map(r => r.trade || 'Other'))];
  const f = c.ui.filter || '';
  const q = (c.ui.q || '').toLowerCase();
  const list = cr.rows.map((r, i) => ({ r, i })).filter(({ r }) => (!f || (r.trade || 'Other') === f) && (!q || r.name.toLowerCase().includes(q)));
  return {
    head: stepHead('Attendance and crew', 'Step 2 of 9 · Morning'),
    body: html`<div class="kpis">${kpi(t.present, 'Present')}${kpi(t.away, 'Not here', t.away ? 'warn' : '')}${kpi(html`${t.manHours}<small>h</small>`, 'Man-hours')}</div>
      ${crewPhotoBox(c)}
      ${cr.rows.length ? html`
      <button type="button" class="box pad tog" data-act="allPresent"><b>Everyone present</b><span class="sw ${t.away ? '' : 'on'}"></span></button>
      <div class="chips"><button type="button" class="chip ${f ? '' : 'on'}" data-act="filter" data-v="">All ${cr.rows.length}</button>${trades.map(tr => html`<button type="button" class="chip ${f === tr ? 'on' : ''}" data-act="filter" data-v="${tr}">${tr} ${cr.rows.filter(r => (r.trade || 'Other') === tr).length}</button>`)}</div>
      <div class="fld-ic">${icon('search')}<input class="fld" data-ui="q" value="${c.ui.q || ''}" placeholder="Find a name" aria-label="Find a name"></div>
      ${c.wide ? crewTables(c, list) : html`<div class="box">${list.map(({ r, i }) => html`<div class="li"><span class="av">${initials(r.name)}</span><div class="n"><b>${r.name}</b><span>${r.trade || 'No trade'}${r.ot ? ` · overtime ${r.ot}h` : ''}</span></div>
        ${r.state === 'present' && c.ui.ot === i ? stepper('ot', r.ot, `${r.ot}h`, i) : seg(r, i)}
        ${r.state === 'present' ? html`<button type="button" class="mini" data-act="otOpen" data-i="${i}" aria-label="Overtime for ${r.name}">${icon('clock')}</button>` : ''}</div>`)}
        ${list.length ? '' : html`<div class="li muted small">No one matches.</div>`}</div>`}`
      : html`<p class="callout warn">The office has not sent a crew list for this project yet. Add day workers below, or ask the office to add the crew in Central Hub.</p>`}
      <div class="k">Day workers without names</div>
      <div class="box">${cr.extra.map((x, i) => html`<div class="li"><input class="fld slim" data-f="crew.extra.${i}.trade" value="${x.trade}" placeholder="Trade" aria-label="Trade">${stepper('extra', x.qty, x.qty, i)}</div>`)}
        <button type="button" class="li" data-act="addExtra"><span class="ic">${icon('plus')}</span><div class="n"><b>Add day workers</b><span>Trade and count</span></div></button></div>
      ${crewListBox(c)}`,
    foot: html`<button type="button" class="btn p" data-act="crewDone">Done · ${t.present} present</button>${c.ui.attNote ? html`<div class="center muted small">${c.ui.attNote}</div>` : ''}`,
  };
}

/** 2.5.0: the morning crew photo: from the camera, with the time and place; as many as needed. */
function crewPhotoBox(c) {
  const list = (c.report.photos || []).filter(p => p.captionKind === 'Crew');
  return html`<div class="k">Morning crew photo</div>
    <div class="box pad">${list.length ? html`<div class="thumbs">${list.map(p => thumb(p, 'sm'))}</div>
      <ul class="plain small">${list.map(p => html`<li><b>${p.at}</b> · ${p.crew ? html`<span class="pill ${p.crew.st === 'ontime' ? 'ok' : 'warn'}">${CREW_ST_WORD[p.crew.st]}</span>${p.crew.tags.map(x => html` <span class="pill warn">${x}</span>`)}${p.crew.geo ? ' · location kept' : ' · no location'}` : html`<span class="muted">checking the time…</span>`}</li>`)}</ul>` : ''}
      <button type="button" class="btn s" data-act="crewPhoto">${icon('cam')}Take crew photo</button>
      <p class="muted tiny">On time until ${c.project.defStart || '08:00'}, late attendance until ${crewCloses(c.project.defStart || '08:00')}, closed after. The office's clock decides.</p></div>`;
}

/** 2.8.0: the usual trades on site; the project's own (wages, crew) are added to them. */
export const TRADES = ['Foreman', 'Site supervision', 'Site Technician', 'Welder / fitter', 'Rigger / erector', 'Crane operator', 'Mason', 'Carpenter', 'Steel fixer', 'Electrician', 'Plumber', 'Painter', 'Driver', 'Labourer'];
/** A trade picked from the list; "Add a trade not listed" turns it into a box to type a new one. */
function tradeField(c, v, path) {
  const list = [...new Set([...TRADES, ...Object.keys(c.project.tradeWages || {}), ...(c.report.crew.rows || []).map(r => r.trade).filter(Boolean)])];
  if (v === '+' || (v && !list.includes(v))) return html`<input class="fld slim" data-f="${path}" value="${v === '+' ? '' : v}" placeholder="New trade" aria-label="New trade" autofocus>`;
  return html`<select class="fld slim" data-f="${path}" aria-label="Trade"><option value="">Trade…</option>${list.map(n => html`<option ${n === v ? 'selected' : ''}>${n}</option>`)}<option value="+">+ Add a trade not listed</option></select>`;
}

/** 2.5.0: names and trades sent for approval as the crew of this project. 2.6.0: only a reviewer sees and gives wages. */
function crewListBox(c) {
  const cl = c.ui.cl || { trades: [], people: [] }, wait = c.project.crewWait || [], paid = c.kind === 'reviewer';
  const names = [...new Set([...cl.trades.map(x => x.trade).filter(Boolean), ...c.report.crew.rows.map(r => r.trade).filter(Boolean)])];
  return html`<div class="k">Crew list for the office</div>
    <div class="box pad"><p class="muted small">Add the people who work here, with their trade. The Project engineer gives the wages and approves them as the crew of this project; then they are on the attendance list.</p>
      <div class="lab">${paid ? 'Daily wage by trade' : 'Trades'}</div>
      ${cl.trades.map((x, i) => html`<div class="two">${tradeField(c, x.trade, `cl.trades.${i}.trade`)}
        <div class="flex">${paid ? html`<input class="fld slim" inputmode="decimal" data-f="cl.trades.${i}.wage" value="${x.wage}" placeholder="Daily wage" aria-label="Daily wage of ${x.trade || 'the trade'}">` : ''}<button type="button" class="mini" data-act="clDel" data-k="trades" data-i="${i}" aria-label="Remove">✕</button></div></div>`)}
      <button type="button" class="btn t slim" data-act="clTrade">${icon('plus')}Add a trade</button>
      <div class="lab">People</div>
      ${cl.people.map((x, i) => html`<div class="cl-row"><input class="fld slim" data-f="cl.people.${i}.name" value="${x.name}" placeholder="Full name" aria-label="Name">
        <select class="fld slim" data-f="cl.people.${i}.trade" aria-label="Trade of ${x.name || 'the person'}"><option value="">Trade…</option>${names.map(n => html`<option ${n === x.trade ? 'selected' : ''}>${n}</option>`)}</select>
        ${paid ? html`<input class="fld slim" inputmode="decimal" data-f="cl.people.${i}.wage" value="${x.wage}" placeholder="${(cl.trades.find(t => t.trade === x.trade) || {}).wage || 'Wage'}" aria-label="Daily wage of ${x.name || 'the person'}">` : html`<span></span>`}
        <button type="button" class="mini" data-act="clDel" data-k="people" data-i="${i}" aria-label="Remove">✕</button>
        ${paid && wageDiffers(x, cl.trades) ? html`<span class="pill warn">Not the trade wage: the office will check it</span>` : ''}</div>`)}
      <button type="button" class="btn t slim" data-act="clPerson">${icon('plus')}Add a person</button>
      ${cl.people.length ? html`<button type="button" class="btn p" data-act="clSend" ${c.ui.busy ? 'disabled' : ''}>Send ${cl.people.length} for approval</button>` : ''}
      ${wait.length ? html`<div class="lab">Waiting for approval</div><ul class="plain small">${wait.map(x => html`<li>${x.name} <span class="muted">· ${x.trade || 'no trade'}</span></li>`)}</ul>` : ''}</div>`;
}

/** On a computer: one table per trade, side by side, overtime always at hand; arrows and P A S L work from the keyboard. */
function crewTables(c, list) {
  const groups = new Map();
  for (const x of list) { const t = x.r.trade || 'Other'; if (!groups.has(t)) groups.set(t, []); groups.get(t).push(x); }
  if (!list.length) return html`<div class="box pad muted small">No one matches.</div>`;
  return html`<div class="crew-cols">${[...groups].map(([trade, rows]) => html`<div class="box tb">
    <div class="tb-h"><span>${trade} · ${rows.length}</span><span>Today</span><span>Overtime</span></div>
    ${rows.map(({ r, i }) => html`<div class="tb-r ${c.ui.cur === i ? 'cur' : ''}" data-row="${i}"><span class="nm">${r.name}</span>${seg(r, i)}
      ${r.state === 'present' ? stepper('ot', r.ot, r.ot ? `${r.ot}h` : '–', i) : html`<span class="muted small">–</span>`}</div>`)}
  </div>`)}</div>
  <p class="muted tiny">Keyboard: ↑ ↓ move · P A S L mark · + − overtime · Ctrl S done</p>`;
}

export function noWorkSheet(c) {
  const reasons = ['Rain', 'Holiday', 'No materials', 'Client stopped work', 'Other'];
  return html`<div class="dim" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-label="No work today">
    <div class="grab"></div><b class="big-t">No work today</b>
    ${chips('ui.nwReason', reasons, c.ui.nwReason)}
    <input class="fld" data-ui="nwNote" value="${c.ui.nwNote || ''}" placeholder="A short note (optional)" aria-label="Note">
    <button type="button" class="btn p" data-act="noWorkSend" ${c.ui.nwReason && !c.ui.busy ? '' : 'disabled'}>${c.ui.busy ? 'Sending…' : 'Send to the office'}</button>
    <button type="button" class="btn t" data-act="closeSheet">Close</button></div>`;
}

export function logSheet(c) {
  const acts = [['check', 'Work done', '', 'logWork'], ['cam', 'Activity photo', '', 'logPhoto'], ['clock', 'Delay', 'warn', 'logDelay'], ['truck', 'Delivery', '', 'logDelivery'], ['box', 'Request', '', 'logReq'], ['alert', 'Incident', 'bad', 'logIncident']];
  return html`<div class="dim" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-label="Log now">
    <div class="grab"></div><b class="big-t">Log now <span class="muted thin small">· ${c.now}</span></b>
    <div class="grid3">${acts.map(([ic, t, cls, act]) => html`<button type="button" class="act" data-act="${act}"><span class="ic ${cls}">${icon(ic)}</span>${t}</button>`)}</div>
    <button type="button" class="box pad flex" data-act="sayIt"><span class="ic">${icon('mic')}</span><div class="small left"><b>Say it</b><br><span class="muted">"Zone C2, welded 4 beams and 5 columns"</span></div></button>
    <button type="button" class="btn t" data-act="closeSheet">Close</button></div>`;
}

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const tog = (act, f, on, title, sub) => html`<button type="button" class="box pad tog" data-act="${act}" data-f="${f}"><span><b>${title}</b><br><span class="muted small">${sub}</span></span><span class="sw ${on ? 'on' : ''}"></span></button>`;

export function me(c) {
  const a = c.s.auth || {}, p = c.s.profile, pr = c.project;
  const off = pr ? [(pr.nwDow || [0]).map(d => DOW[d]).join(', '), (pr.nonWorking || []).length ? `${pr.nonWorking.length} holidays` : ''].filter(Boolean).join(' · ') : '';
  return {
    tab: 'me',
    head: head('Me', a.email || ''),
    body: html`<label class="lab" for="mn">Name</label><input id="mn" class="fld" data-f="profile.name" value="${p.name}" ${p.locked ? 'readonly' : ''}>
      <label class="lab" for="mp">Position</label><input id="mp" class="fld" data-f="profile.position" value="${p.position}" ${p.locked ? 'readonly' : ''}>${p.locked ? html`<p class="muted tiny">Confirmed by the office. Ask the office to change your name or position.</p>` : ''}
      <div class="k">Signature</div>
      ${p.sig ? html`<div class="box pad sigbox"><img src="${p.sig}" alt="Your signature"><div class="spread small"><span class="muted">Signs every report you send</span><button type="button" class="btn t slim" data-act="sigFull">Sign again</button></div></div>`
        : sigLine(p)}
      <div class="k">Project</div>
      <div class="box">${c.s.projects.map(x => html`<button type="button" class="li" data-act="pickProject" data-v="${x.code}"><span class="ic ${x.code === c.s.proj ? 'ok' : ''}">${icon(x.code === c.s.proj ? 'check' : 'pin')}</span><div class="n"><b>${x.name}</b><span>${x.code}</span></div></button>`)}</div>
      <div class="k">Your usual day</div>
      <div class="two"><label class="small">Start<input class="fld" type="time" data-f="profile.defStart" value="${p.defStart || (pr && pr.defStart) || '08:00'}"></label>
        <label class="small">End<input class="fld" type="time" data-f="profile.defEnd" value="${p.defEnd || (pr && pr.defEnd) || '17:00'}"></label></div>
      <p class="muted tiny">Used when there is no report from yesterday to copy. Days off for this project (set by the office): ${off || 'none'}.</p>
      <div class="k">Reminders and look</div>
      <p class="muted tiny">The reminder to send the report is set for the whole project with its working hours (Review, Crew and working hours): ${(pr && pr.remindAt) || '17:00'}.</p>
      ${tog('pushOn', '', !!p.push || !!c.ui.pushBusy, 'Notifications', c.ui.pushBusy ? 'Turning on…' : p.push ? 'On: the office\'s answers come to this phone' : 'When the office approves or sends back a report')}
      ${p.push ? html`<button type="button" class="btn t" data-act="pushTest">Send a test notification</button>` : ''}
      ${tog('flipPref', 'dark', !!p.dark, 'Dark mode', 'Easier on the eyes at night')}
      <button type="button" class="btn o" data-act="refresh">Refresh lists from the office</button>
      <button type="button" class="btn t" data-act="showNew">What's new</button>
      <button type="button" class="btn t" data-act="signout">Sign out</button>
      <div class="muted tiny center">Field Report ${APP_VERSION}${isDemo() ? ' · demo' : ''}</div>`,
  };
}

export const later = (tab, title, what) => () => ({
  tab,
  head: head(title, 'Coming in the next builds'),
  body: html`<div class="box pad muted">${what}</div>`,
});
