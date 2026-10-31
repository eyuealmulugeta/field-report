// The screens of slice 1: sign in, first-time profile, Today, Start of day, Attendance and crew, Me,
// and holding pages for Reports and Requests. Each returns { head, body, foot, tab, fab }.

import { html, icon } from '../core/dom.js';
import { dayLabel, dayLetter, addDays, weekday } from '../core/util.js';
import { pdfName } from '../core/names.js';
import { isDemo, APP_VERSION } from '../core/api.js';
import { doneCount, WEATHER, GROUND } from '../model/report.js';
import { totals, STATES, STATE_LETTER, initials } from '../model/crew.js';
import { head, stepHead, nav, chips, stepper, dayList, kpi } from './parts.js';
import { devBanner, devicesBox } from './devices.js';

/** 2.0.1: every notification sent to this person (reviews, alerts, tests, device reports), newest first, at the top of Today. */
const when = t => { const d = new Date(t); return isNaN(d) ? '' : `${d.toDateString().slice(4, 10)} · ${d.toTimeString().slice(0, 5)}`; };
export function inboxBox(c) {
  const seen = c.s.inboxSeen || '', items = (c.s.inbox || []).filter(x => x.t > seen);
  if (!items.length) return '';
  const shown = c.ui.inboxAll ? items : items.slice(0, 3);
  return html`<div class="spread"><div class="k">Notifications · ${items.length}</div><button type="button" class="btn t slim" data-act="inboxClear">Clear</button></div>
    <div class="box">${shown.map(x => html`<div class="li inbox"><span class="ic">${icon('bell')}</span><div class="n"><b>${x.h}</b><span class="pre">${x.m}</span><span class="muted tiny">From ${x.f || 'Field Report'} · ${when(x.t)}</span></div></div>`)}
    ${items.length > 3 ? html`<button type="button" class="li more" data-act="inboxMore">${c.ui.inboxAll ? 'Show fewer' : `Show all ${items.length}`}</button>` : ''}</div>`;
}

/** The steps that can be opened in this build. */
export const READY = new Set(['start', 'crew', 'work', 'equipment', 'materials', 'safety', 'photos', 'end', 'send']);

export function signin(c) {
  return {
    body: html`<div class="center-page">
      <img class="logo big" src="icon-192.png" alt="Amistad Prefab">
      <div><b class="title">Field Report</b><div class="muted">Amistad Prefab</div></div>
      <p class="muted narrow">Sign in with the Google account the office gave access to.</p>
      ${c.ui.error ? html`<p class="callout bad">${c.ui.error}</p>` : ''}
    </div>`,
    foot: html`<button type="button" class="btn o" data-act="signin" ${c.ui.busy ? 'disabled' : ''}><b class="g">G</b>${c.ui.busy ? 'Signing in…' : 'Sign in with Google'}</button>
      <div class="center muted small">Works offline after the first sign-in${isDemo() ? ' · demo, nothing is sent' : ''}</div>`,
  };
}

export function profile(c) {
  const p = c.s.profile;
  return {
    head: head('Welcome', 'Asked once, then saved'),
    body: html`<p class="muted">Your name and position go on every report you sign.</p>
      <label class="lab" for="pn">Your name</label><input id="pn" class="fld" data-f="profile.name" value="${p.name}" autocomplete="name" ${p.locked ? 'readonly' : ''}>
      <label class="lab" for="pp">Position</label><input id="pp" class="fld" data-f="profile.position" value="${p.position}" placeholder="Site engineer" ${p.locked ? 'readonly' : ''}>${p.locked ? html`<p class="muted tiny">Confirmed by the office. Ask the office to change your name or position.</p>` : ''}`,
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

export function today(c) {
  const p = c.project, r = c.report, no = r ? r.no : c.nextNo;
  const n = r && !r.nowork ? doneCount(r) : 0;
  const sub = `${p.location || p.address || p.code} · Day ${no}`;
  if (r && !r.nowork) {
    return {
      tab: 'today', fab: true,
      head: head(`Report #${no}`, `${dayLabel(c.today)} · saved on this phone`, `${n} of 9`),
      body: html`${inboxBox(c)}<div class="bar"><i style="width:${Math.round(n / 9 * 100)}%"></i></div>
        ${c.evening ? html`<p class="callout warn">It is after 17:00. Finish steps 8 and 9 and send today's report.</p>` : ''}
        ${devBanner(c)}${c.needs.length && !c.past ? html`<div class="k">Needs you</div>${needsBox(c)}` : ''}${dayList(r, READY)}
        <div class="row-links"><button type="button" class="btn t" data-act="go" data-to="crew">Attendance</button><button type="button" class="btn t" data-act="noWork">No work today</button></div>`,
    };
  }
  return {
    tab: 'today',
    head: head(p.name, sub, p.code),
    body: html`${inboxBox(c)}<div class="soft">
        <div class="spread"><b class="big-t">Today · ${dayLabel(c.today)}</b><span class="k brand">Report #${no}</span></div>
        <div class="bar gap"><i style="width:0%"></i></div>
        <div class="muted small">${r && r.nowork ? `No work today: ${r.nowork.reason}` : c.dayOff ? 'A day off for this project · you can still report' : 'Not started · about 6 minutes in all'}</div>
      </div>
      <button type="button" class="btn p" data-act="startDay">${icon('sun')}Start today's report</button>
      <div class="grid2">
        <button type="button" class="box pad tile" data-act="startCrew"><b>Attendance</b><span class="muted small">Take it now</span></button>
        <button type="button" class="box pad tile" data-act="noWork"><b>No work today</b><span class="muted small">Give the reason</span></button>
      </div>
      <div class="k">This week</div>${weekStrip(c)}
      ${devBanner(c)}<div class="k">Needs you</div>${needsBox(c)}
      <div class="muted tiny center">File name: ${pdfName(p, c.today, no)}</div>`,
  };
}

/** Reports the office sent back, newest first; each opens the day to correct it. */
function needsBox(c) {
  if (!c.needs.length) return html`<div class="box pad muted small">Nothing from the office.</div>`;
  return html`<div class="box">${c.needs.map(x => html`<button type="button" class="li" data-act="openPast" data-v="${x.date}"><span class="ic bad">${icon('alert')}</span>
    <div class="n"><b>Report #${x.no} sent back · ${dayLabel(x.date)}</b><span>${x.comment ? `${x.comment.by || 'Office'}: ${x.comment.text}` : 'Open it to see what to fix'}</span></div><span class="ch">${icon('chev')}</span></button>`)}</div>`;
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
      ${chips('start.cond', WEATHER, s.cond)}
      <div class="two"><input class="fld" inputmode="decimal" data-f="start.tempC" value="${s.tempC}" placeholder="°C" aria-label="Temperature in °C"><input class="fld" data-f="start.wind" value="${s.wind}" placeholder="Wind, rain…" aria-label="Weather note"></div>
      <div class="lab">Ground</div>${chips('start.ground', GROUND, s.ground)}
      <label class="lab" for="loc">Location</label>
      <div class="fld-ic">${icon('pin')}<input id="loc" class="fld" data-f="start.location" value="${s.location}"></div>`,
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
        <button type="button" class="li" data-act="addExtra"><span class="ic">${icon('plus')}</span><div class="n"><b>Add day workers</b><span>Trade and count</span></div></button></div>`,
    foot: html`<button type="button" class="btn p" data-act="crewDone">Done · ${t.present} present</button>${c.ui.attNote ? html`<div class="center muted small">${c.ui.attNote}</div>` : ''}`,
  };
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
  const acts = [['check', 'Work done', '', 'logWork'], ['cam', 'Photo', '', 'logPhoto'], ['clock', 'Delay', 'warn', 'logDelay'], ['truck', 'Delivery', '', 'logDelivery'], ['box', 'Request', '', 'logReq'], ['alert', 'Incident', 'bad', 'logIncident']];
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
      ${p.sig ? html`<div class="box pad sigbox"><img src="${p.sig}" alt="Your signature"><div class="spread small"><span class="muted">Signs every report you send</span><button type="button" class="btn t slim" data-act="clearSig">Sign again</button></div></div>`
        : html`<div class="box pad muted small">Not signed yet. You sign once, on Review and send.</div>`}
      <div class="k">Project</div>
      <div class="box">${c.s.projects.map(x => html`<button type="button" class="li" data-act="pickProject" data-v="${x.code}"><span class="ic ${x.code === c.s.proj ? 'ok' : ''}">${icon(x.code === c.s.proj ? 'check' : 'pin')}</span><div class="n"><b>${x.name}</b><span>${x.code}</span></div></button>`)}</div>
      <div class="k">Your usual day</div>
      <div class="two"><label class="small">Start<input class="fld" type="time" data-f="profile.defStart" value="${p.defStart || (pr && pr.defStart) || '08:00'}"></label>
        <label class="small">End<input class="fld" type="time" data-f="profile.defEnd" value="${p.defEnd || (pr && pr.defEnd) || '17:00'}"></label></div>
      <p class="muted tiny">Used when there is no report from yesterday to copy. Days off for this project (set by the office): ${off || 'none'}.</p>
      ${devicesBox(c)}
      <div class="k">Reminders and look</div>
      ${tog('flipPref', 'remind', p.remind !== false, 'Reminder at 17:00', "When today's report is not sent yet")}
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
