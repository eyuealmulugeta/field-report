// The screens of slice 1: sign in, first-time profile, Today, Start of day, Attendance and crew, Me,
// and holding pages for Reports and Requests. Each returns { head, body, foot, tab, fab }.

import { countryList } from '../core/countries.js';   // 2.71.0
import { html, icon } from '../core/dom.js';
import * as L from '../core/live.js';
import { dayLabel, dayLetter, addDays, weekday } from '../core/util.js';
import { pdfName } from '../core/names.js';
import { isDemo, APP_VERSION } from '../core/api.js';
/** 2.64.0 (R8): the next 3 days at the site; heavy rain in red. */
const fcBox = c => (c.ui && c.ui.fc && c.ui.fc.length ? html`<div class="box pad fc"><b>Next 3 days</b><div class="fc-days">${c.ui.fc.map(d => html`<span class="pill ${d.heavy ? 'bad' : ''}">${dayLabel(d.date)}: ${d.word}, ${d.tmax}°${d.rain ? `, ${d.rain} mm` : ''}</span>`)}</div>${c.ui.fc.some(d => d.heavy) ? html`<p class="tiny bad">Heavy rain expected: plan covered work and protect materials.</p>` : ''}</div>` : '');
import { doneCount, WEATHER, GROUND, WEATHER_PIC, PPE } from '../model/report.js';
import { inboxLink, monthDays } from '../model/follow.js';
import { inboxOk } from '../model/rules.js';
import { totals, STATES, STATE_LETTER, initials, wageDiffers, CREW_ST_WORD, crewCloses, dayConfirm } from '../model/crew.js';
import { thumb } from './work.js';
import { head, stepHead, nav, chips, stepper, dayList, kpi, isGM, projTop } from './parts.js';

/** 2.4.0: the saved signature, or a button to sign full screen (or choose a PNG). */
const sigLine = p => (p.sig ? html`<div class="box pad sigbox"><img src="${p.sig}" alt="Your signature"><div class="spread small"><span class="muted">Signs every report you send</span><button type="button" class="btn t slim" data-act="sigFull">Change</button></div></div>`
  : html`<div class="box pad sigbox"><span class="muted small">Draw it full screen, or choose a PNG from your phone. It signs every report you send.</span><button type="button" class="btn s slim" data-act="sigFull">Sign</button></div>`);

/** 2.0.1: every notification sent to this person (reviews, alerts, tests, device reports), newest first. 2.37.0: in a floating circle. */
const when = t => { const d = new Date(t); return isNaN(d) ? '' : `${d.toDateString().slice(4, 10)} · ${d.toTimeString().slice(0, 5)}`; };
// 2.39.0 (owner): a message opened is read, so the count goes down
export const inboxItems = c => { const seen = c.s.inboxSeen || '', read = new Set(c.s.inboxRead || []); return inboxOk(c.s.rules, (c.s.inbox || []).filter(x => x.t > seen && !read.has(x.t)), inboxLink); };   // 2.60.0 (G6): hidden pages send no notifications
/** 2.37.0 (owner): a circle with the count, only when there are notifications; it opens the list. Clear empties it and the circle goes. */
export function inboxFab(c) {
  const n = inboxItems(c).length;
  if (!n) return '';
  return html`<button type="button" class="inbox-fab" data-act="inboxToggle" aria-label="Notifications: ${n}">${icon('bell')}<i>${n}</i></button>${c.ui.inboxOpen ? html`<div class="inbox-pop">${inboxBox(c)}</div>` : ''}`;
}
export function inboxBox(c) {
  const items = inboxItems(c);
  if (!items.length) return '';
  const shown = c.ui.inboxAll ? items : items.slice(0, 3);
  return html`<div class="spread inbox-top"><div class="k">Notifications · ${items.length}</div><span><button type="button" class="btn t slim" data-act="inboxClear">Clear</button><button type="button" class="btn t slim" data-act="inboxToggle">Close</button></span></div>
    <div class="box">${shown.map(x => { const inner = html`<span class="ic">${icon('bell')}</span><div class="n"><b>${x.h}</b><span class="pre">${x.m}</span><span class="muted tiny">From ${x.f || 'Field Report'} · ${when(x.t)}</span></div>`;
      const l = inboxLink(x);   // 2.8.1: older notifications open too
      return l ? html`<button type="button" class="li inbox" data-act="inboxGo" data-v="${l}" data-t="${x.t}">${inner}<span class="ch">${icon('chev')}</span></button>` : html`<button type="button" class="li inbox" data-act="inboxRead" data-t="${x.t}">${inner}</button>`; })}
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
    body: html`<div class="center-page signin-page">
      <img class="logo big" src="icon-192.png" alt="Amistad Prefab">
      <div><b class="title">Amistad Prefab</b><div class="muted">Field Report</div></div>
      ${su ? html`<p class="callout ok narrow">Please wait until your request is approved. You get an email when it is, then sign in again.</p>` : ''}
      ${c.ui.error ? html`<p class="callout bad">${c.ui.error}</p>` : ''}
      <button type="button" class="btn o signin-btn" data-act="${su ? 'signupBack' : 'signin'}" ${c.ui.busy ? 'disabled' : ''}>${su ? 'Back' : html`<b class="g">G</b>${c.ui.busy ? 'Signing in…' : 'Sign in with Google'}`}</button>
      ${isDemo() ? html`<div class="center muted small">Demo, nothing is sent</div>` : ''}
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
    foot: html`<button type="button" class="btn o" data-act="refresh" ${c.ui.refreshing ? 'disabled' : ''}>${c.ui.refreshing ? 'Refreshing…' : 'Refresh'}</button>`,
  };
}

/** Mon to Sun of this week: sent, waiting, missing or a day off. */
export function weekStrip(c) {
  const t = c.today, p = c.project;
  const mon = addDays(t, -((weekday(t) + 6) % 7));
  const days = [...Array(7)].map((_, i) => addDays(mon, i));
  // 2.44.1 (owner: CHB showed Monday and Tuesday unsent though Eyob sent them): a report sent from another phone counts,
  // the same rows as Reports (monthDays: this phone's drafts, the project's reports from the script and Central Hub)
  const sentBy = new Map(monthDays(c.realToday || t, p, c.s.drafts, c.s.known || {}, (c.s.others || {})[p.code]).filter(x => ['submitted', 'approved', 'changes'].includes(x.kind)).map(x => [x.date, x]));
  return html`<div class="box pad weekrow">${days.map(d => {
    const r = sentBy.has(d) ? { ...(c.s.drafts[`${p.code}|${d}`] || {}), sentAt: (c.s.drafts[`${p.code}|${d}`] || {}).sentAt || 1 } : c.s.drafts[`${p.code}|${d}`];
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
      body: html`${widget(c)}${sentBox(c)}<div class="bar"><i style="width:${Math.round(n / 9 * 100)}%"></i></div>
        ${c.evening ? html`<p class="callout warn">It is after ${p.remindAt || '17:00'}. Finish steps 8 and 9 and send today's report.</p>` : ''}
        ${c.needs.length && !c.past ? html`<div class="k">Needs you</div>${needsBox(c)}` : ''}${attBox(r)}${dayList(r, READY)}
        <div class="row-links"><button type="button" class="btn t" data-act="go" data-to="att">Office attendance</button><button type="button" class="btn t" data-act="noWork">No work today</button><button type="button" class="btn t" data-act="spotOpen">Spotlight</button><button type="button" class="btn t bad-t" data-act="attOpen">Attention</button>${isGM(c) ? html`<button type="button" class="btn t" data-act="mediaOpen">Dashboard</button>` : ''}</div>`,
    };
  }
  return {
    tab: 'today',
    head: head(p.name, sub, p.code),
    body: html`${widget(c)}${sentBox(c)}${fcBox(c)}<div class="soft">
        <div class="spread"><b class="big-t">Today · ${dayLabel(c.today)}</b><span class="k brand">Report #${no}</span></div>
        <div class="bar gap"><i style="width:0%"></i></div>
        <div class="muted small">${r && r.nowork ? `No work today: ${r.nowork.reason}` : c.dayOff ? 'A day off for this project · you can still report' : 'Not started · about 6 minutes in all'}</div>
      </div>
      <button type="button" class="btn p" data-act="startDay">${icon('sun')}Start today's report</button>
      <div class="grid2">
        <button type="button" class="box pad tile" data-act="startCrew"><b>Attendance</b><span class="muted small">Take it now</span></button>
        <button type="button" class="box pad tile" data-act="noWork"><b>No work today</b><span class="muted small">Give the reason</span></button>
      </div>
      <div class="row2"><button type="button" class="btn o" data-act="spotOpen">${icon('bell')}Spotlight</button><button type="button" class="btn o bad-t" data-act="attOpen">${icon('alert')}Attention</button></div>
      <div class="k">This week</div>${weekStrip(c)}
      <div class="k">Needs you</div>${needsBox(c)}`,   // 2.44.2 (owner): no report file name on Today
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
      ${list.length ? html`<div class="box">${list.map(x => html`<div class="li"><span class="ic bad">${icon('alert')}</span><div class="n"><b class="pre">${x.text}</b><span>${x.at}</span></div>
        <button type="button" class="btn t slim" data-act="attDrop" data-v="${x.id}" aria-label="Remove">Remove</button></div>`)}</div>` : ''}
      <textarea class="fld" rows="3" data-ui="attText" placeholder="What is the issue, and what must the client do?">${c.ui.attText || ''}</textarea>
      <button type="button" class="btn p" data-act="attAdd">${icon('alert')}Add to the report</button>`,
  };
}

/** Reports the office sent back or commented on, newest first; each opens the day, with the comment and a reply box. */
/** 2.44.1 (owner): no report file name (…_MJO_105.pdf) in the text on Today */
export const noPdf = t => String(t || '').replace(/\S+\.pdf[:·,]?\s*/gi, '').replace(/\s{2,}/g, ' ').trim();
function needsBox(c) {
  if (!c.needs.length) return html`<div class="box pad muted small">Nothing from the office.</div>`;
  return html`<div class="box">${c.needs.map(x => html`<button type="button" class="li" data-act="openDay" data-v="${x.date}"><span class="ic bad">${icon('alert')}</span>
    <div class="n"><b>Report #${x.no} ${x.kind === 'changes' ? 'sent back' : 'has a comment'} · ${dayLabel(x.date)}</b><span>${x.comment ? `${x.comment.by || 'Office'}: ${noPdf(x.comment.text)}` : 'Open it to see what to fix'}</span></div><span class="ch">${icon('chev')}</span></button>`)}</div>`;
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

/** 2.39.0 (owner): the Site Engineer is not in the crew attendance (they write the report). */
export const NOT_CREW = /^site engineer$/i;
export function crew(c, inAtt = false) {
  const cr = c.report.crew, s = c.report.start;
  const t = totals(cr, s.start, s.end);
  const trades = [...new Set(cr.rows.filter(r => !NOT_CREW.test(r.trade || '')).map(r => r.trade || 'Other'))];
  const f = c.ui.filter || '';
  const q = (c.ui.q || '').toLowerCase();
  const list = cr.rows.map((r, i) => ({ r, i })).filter(({ r }) => !NOT_CREW.test(r.trade || '')).filter(({ r }) => (!f || (r.trade || 'Other') === f) && (!q || r.name.toLowerCase().includes(q)));
  return {
    head: stepHead('Office attendance', 'Step 2 of 9 · Morning'),
    body: html`<div class="kpis">${kpi(t.present, 'Present')}${kpi(t.away, 'Not here', t.away ? 'warn' : '')}${kpi(html`${t.manHours}<small>h</small>`, 'Man-hours')}</div>
      ${crewPhotoBox(c)}
      ${cr.rows.length ? html`
      <button type="button" class="box pad tog" data-act="allPresent"><b>Everyone present</b><span class="sw ${t.away ? '' : 'on'}"></span></button>
      <div class="chips"><button type="button" class="chip ${f ? '' : 'on'}" data-act="filter" data-v="">All ${cr.rows.filter(r => !NOT_CREW.test(r.trade || '')).length}</button>${trades.map(tr => html`<button type="button" class="chip ${f === tr ? 'on' : ''}" data-act="filter" data-v="${tr}">${tr} ${cr.rows.filter(r => (r.trade || 'Other') === tr).length}</button>`)}</div>
      <div class="fld-ic">${icon('search')}<input class="fld" data-ui="q" value="${c.ui.q || ''}" placeholder="Find a name" aria-label="Find a name"></div>
      ${c.wide ? crewTables(c, list) : html`<div class="box">${list.map(({ r, i }) => html`<div class="li">${av(c, r)}<div class="n"><b>${r.name}</b><span>${r.trade || 'No trade'}${r.ot ? ` · overtime ${r.ot}h` : ''}</span></div>
        ${r.state === 'present' && c.ui.ot === i ? stepper('ot', r.ot, `${r.ot}h`, i) : seg(r, i)}
        <button type="button" class="mini ${r.state === 'present' ? '' : 'off'}" data-act="otOpen" data-i="${i}" aria-label="Overtime for ${r.name}" ${r.state === 'present' ? '' : 'disabled'}>${icon('clock')}</button></div>`)}
        ${list.length ? '' : html`<div class="li muted small">No one matches.</div>`}</div>`}`
      : html`<p class="callout warn">The office has not sent a crew list for this project yet. Add day workers below, or ask the office to add the crew in Central Hub.</p>`}
      <div class="k">Day workers without names</div>
      <div class="box">${cr.extra.map((x, i) => html`<div class="li">${tradeField(c, x.trade, `crew.extra.${i}.trade`)}${stepper('extra', x.qty, x.qty, i)}</div>`)}
        <button type="button" class="li" data-act="addExtra"><span class="ic">${icon('plus')}</span><div class="n"><b>Add day workers</b><span>Trade and count</span></div></button></div>
      ${confirmBox(c)}
      ${inAtt ? '' : crewListBox(c)}`,
    foot: html`<button type="button" class="btn p" data-act="crewDone">Done · ${t.present} present</button>${c.ui.attNote ? html`<div class="center muted small">${c.ui.attNote}</div>` : ''}`,
  };
}

/**
 * 2.10.0: Office attendance, its own tab. The list is the crew allocated to the project in Central Hub (asked again
 * each time the tab opens); labour found on site is sent from here for approval and joins the list once approved.
 */
export function att(c) {
  const staff = c.project.staff || [], started = c.report && c.report.start && !c.report.nowork;
  const sub = `${c.project.name || c.project.code} · crew from Central Hub${c.ui.attAt ? ` · checked ${c.ui.attAt}` : ''}`;
  // 2.44.0 (owner): three tabs, one job each: Today (marking only), Crew (the list, edits, deletes), Add people (labour on site, candidate form)
  const tab = c.ui.attTab || '';
  if (tab === 'emp') return { tab: 'att', head: head('Attendance', `${c.project.name || c.project.code} · add people`), body: html`${attTabs(c)}${crewListBox(c)}<div class="k">Candidate form</div>${empView(c)}` };
  if (tab === 'crew') return {
    tab: 'att',
    head: head('Attendance', sub),
    body: html`${attTabs(c)}${refreshRow(c)}
      ${staff.length ? html`<div class="k">Crew on this project · ${staff.length}</div><div class="box">${staff.map(x => staffRow(c, x))}</div>`
        : html`<p class="callout warn">Central Hub has no crew allocated to this project yet. Add people on site, or ask the office to allocate the crew.</p>`}
      ${crewAdmin(c, false)}`,
  };
  if (started) {
    const v = crew(c, true);
    // the tab bar stays: Done sits at the end of the page
    return { tab: 'att', head: head('Attendance', sub), body: html`${attTabs(c)}${v.body}<div class="att-done">${v.foot}</div>` };
  }
  return {
    tab: 'att',
    head: head('Attendance', sub),
    body: html`${attTabs(c)}
      <div class="box pad att-start"><div class="kpis">${kpi(staff.length, 'On the crew')}${kpi((c.project.crewWait || []).length, 'Waiting approval')}</div>
      ${c.report && c.report.nowork ? html`<p class="callout">Today is marked as no work.</p>` : html`<button type="button" class="btn p" data-act="startCrew">${icon('check')}Take today's attendance</button>`}</div>`,
  };
}
// 2.26.0: was Employee data. 2.38.0 (owner): the project sheet (Crew attendance) is gone; Central Hub keeps it
// 2.44.0 (owner): Today, Crew, Add people ('emp' keeps its key: the candidate form box and the sign-in return use it)
const ATT_TABS = [['', 'Today'], ['crew', 'Crew'], ['emp', 'Add people']];
const attCount = (c, k) => (k === 'crew' ? (c.project.staff || []).length : k === 'emp' ? (c.project.crewWait || []).length : 0);
const attTabs = c => html`<div class="seg wide att-tabs" role="group" aria-label="Attendance">${ATT_TABS.map(([k, t]) => html`<button type="button" class="${(c.ui.attTab || '') === k ? 'on' : ''}" data-act="attTab" data-v="${k}" aria-pressed="${(c.ui.attTab || '') === k}">${t}${attCount(c, k) ? html` <span class="cnt">${attCount(c, k)}</span>` : ''}</button>`)}</div>`;
const SHEET_MARK = { present: 'P', absent: 'A', sick: 'S', leave: 'L' };
const SHEET_WORD = { present: 'Present', absent: 'Absent', sick: 'Sick', leave: 'On leave', none: 'No mark' };
/** 2.16.0: Crew attendance: Central Hub's sheet of the pay period; a tapped day is corrected, and waits for the office. */
function sheetView(c) {
  const r = c.ui.reg;
  if (c.ui.regErr) return html`<p class="callout warn">${c.ui.regErr}</p><button type="button" class="btn t" data-act="regLoad">Try again</button>`;
  if (!r || r.code !== c.project.code) return html`<p class="muted">${c.ui.regBusy ? 'Loading the sheet from Central Hub…' : ''}</p>`;
  const may = c.kind !== 'viewer', off = new Set(r.off), rows = r.groups.flatMap(g => g.rows);
  const cell = (row, d) => {
    const w = r.waiting[`${d}|${row.key}`], x = row.cells[d], on = c.ui.regEdit && c.ui.regEdit.d === d && c.ui.regEdit.k === row.key;
    const mark = w ? SHEET_MARK[w.state] || '' : (x && x.mark) || '', ot = w ? w.ot : x && x.ot;
    return html`<td class="rg-c ${off.has(d) ? 'rg-off' : ''} ${mark ? `rg-${mark}` : ''} ${w ? 'rg-wait' : x && x.fixed ? 'rg-fix' : ''} ${on ? 'rg-on' : ''}" ${may && d <= r.today ? html`data-act="regPick" data-d="${d}" data-k="${row.key}"` : ''}>${mark}${ot ? html`<sup>${ot}</sup>` : ''}</td>`;
  };
  // 2.17.2: a week per table, so the sheet fits the screen (nothing scrolls sideways)
  const weeks = [];
  for (let i = 0; i < r.days.length; i += 7) weeks.push(r.days.slice(i, i + 7));
  const ed = c.ui.regEdit, er = ed && rows.find(x => x.key === ed.k);
  const editor = er ? html`<div class="box pad rg-ed"><div class="spread"><b>${er.name}</b><span class="muted">${dayLabel(ed.d)}</span></div>
    <div class="seg wide" role="group" aria-label="Mark">${Object.entries(SHEET_WORD).filter(([k]) => k !== 'none').map(([k, t]) => html`<button type="button" data-act="regSend" data-v="${k}" ${c.ui.busy ? 'disabled' : ''}>${t}</button>`)}</div>
    <label class="small">Overtime hours, with Present <input class="fld slim" type="number" min="0" max="16" step="0.5" inputmode="decimal" data-ui="regOt" value="${c.ui.regOt || ''}" placeholder="0"></label>
    <p class="muted small">Goes to the office for review. The sheet counts it once they accept it.</p></div>` : '';
  const waiting = Object.values(r.waiting);
  const line = f => html`<div class="li"><div class="n"><b>${f.name}</b><span>${dayLabel(f.date)} · ${SHEET_WORD[f.state] || f.state}${f.ot ? `, ${f.ot} h` : ''} · ${String(f.by || '').replace(/^Site: /, '')}${f.review && f.review !== 'waiting' ? ` · ${f.review === 'accepted' ? 'accepted' : 'rejected'}${f.reviewBy ? ` by ${f.reviewBy}` : ''}` : ''}</span></div></div>`;
  return html`<div class="spread small rg-top"><button type="button" class="btn t slim" data-act="regShift" data-n="-1" aria-label="Previous period">‹</button><b>${r.period.label}</b>
      <button type="button" class="btn t slim" data-act="regShift" data-n="1" ${r.period.to >= r.today ? 'disabled' : ''} aria-label="Next period">›</button>
      <button type="button" class="btn t slim" data-act="regLoad" ${c.ui.regBusy ? 'disabled' : ''}>${c.ui.regBusy ? 'Loading…' : 'Refresh'}</button></div>
    <p class="muted small">${r.reported} ${r.reported === 1 ? 'day' : 'days'} reported.${may ? ' Tap a day to correct it; the office reviews each correction.' : ''}</p>
    ${editor}
    ${rows.length ? html`${weeks.map(w => html`<div class="rg-scroll"><table class="rg"><thead><tr><th class="rg-n">${dayLabel(w[0]).slice(4)} – ${dayLabel(w[w.length - 1]).slice(4)}</th>${w.map(d => html`<th class="${off.has(d) ? 'rg-off' : ''}">${String(+d.slice(8))}<br><span class="muted">${'SMTWTFS'[new Date(`${d}T00:00:00Z`).getUTCDay()]}</span></th>`)}</tr></thead>
      ${r.groups.map(g => html`<tbody><tr class="rg-g"><td colspan="${w.length + 1}">${g.title.replace('Daily crew · ', '')} · ${g.rows.length}</td></tr>
        ${g.rows.map(row => html`<tr><td class="rg-n">${row.name}</td>${w.map(d => cell(row, d))}</tr>`)}</tbody>`)}
      <tfoot><tr><td class="rg-n">Present</td>${w.map(d => html`<td>${r.heads[d] || ''}</td>`)}</tr></tfoot></table></div>`)}
    <div class="k">Totals · ${r.period.label}</div><div class="rg-scroll"><table class="rg"><thead><tr><th class="rg-n">Name</th><th>P</th><th>A</th><th>S</th><th>L</th><th>OT h</th></tr></thead>
      <tbody>${rows.map(row => html`<tr><td class="rg-n">${row.name}</td><td><b>${row.present}</b></td><td>${row.absent || ''}</td><td>${row.sick || ''}</td><td>${row.leave || ''}</td><td>${row.ot || ''}</td></tr>`)}</tbody></table></div>
    <p class="muted small">P present, A absent, S sick, L on leave; a small number is overtime hours. Dotted: waiting for the office. Underlined: corrected by the office.</p>`
    : html`<p class="callout">Nobody is on this sheet yet.</p>`}
    ${waiting.length ? html`<div class="k">Waiting for the office · ${waiting.length}</div><div class="box">${waiting.map(line)}</div>` : ''}
    ${r.answered.length ? html`<div class="k">Answered by the office</div><div class="box">${r.answered.map(line)}</div>` : ''}`;
}
/** 2.16.0: Employee data: the crew form, opened inside the app and filled in by the engineer (nothing to share). */
function empView(c) {
  if (!(crewBoss(c) || linkMaker(c))) return html`<p class="callout">Candidate data is filled in by the project's engineers.</p>`;
  // 2.42.9 (owner): no trip to Me: one tap here signs in to live updates
  if (c.ui.live !== 'on' && !isDemo()) return html`<div class="box pad center"><p class="muted small">Connect to Central Hub to add a candidate.</p>
    <button type="button" class="btn p" data-act="liveConnect" ${c.ui.busy ? 'disabled' : ''}>${c.ui.busy ? 'Connecting…' : 'Connect'}</button></div>`;
  return html`<div class="box pad"><b>Candidate form</b>
    <p class="muted small">The same form as the crew form link: one form per person, with the photo and the Fayda ID or passport. It opens here, nothing to share. Each form goes to Central Hub, Crew forms, for the office to review.</p>
    <button type="button" class="btn p" data-act="empOpen" ${c.ui.busy ? 'disabled' : ''}>${icon('users')}Open the employee form</button>${formLink(c)}</div>`;   // 2.39.0: the crew form link here
}
const crewBoss = c => c.kind === 'reviewer' || /engineer|manager|\bgm\b/i.test((c.s.profile || {}).position || '');   // 2.13.1: GM too
// 2.13.0: made here when live updates are on (no Central Hub sign-in); the old way otherwise
// 2.15.1: crew form links: the GM and the Admin only (owner's decision)
const linkMaker = c => ['admin', 'exec'].includes((c.s.auth || {}).role) || /\bgm\b|general manager/i.test((c.s.profile || {}).position || '');
const formLink = c => (!linkMaker(c) ? '' : c.ui.live === 'on' ? html`<button type="button" class="btn t slim" data-act="crewLink" ${c.ui.busy ? 'disabled' : ''}>${icon('users')}Share a crew form link</button>`
  : html`<a class="btn t slim" href="https://hub.amistadprefab.com/#crewforms" target="_blank" rel="noopener">${icon('users')}Crew form link (Central Hub)</a>`);   // 2.10.1
const stampAt = at => (at && !Number.isNaN(Date.parse(at)) ? new Date(at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
/** 2.13.0: the HR photo from Central Hub, else the initials. */
const av = (c, x) => { const src = x.id && (c.ui.photos || {})[x.id]; return src ? html`<span class="av"><img src="${src}" alt=""></span>` : html`<span class="av">${initials(x.name)}</span>`; };
/** 2.13.0: crew the site added can be corrected or taken off from here (live updates on). */
// 2.17.0: delete from the list: anyone of the site asks, the PE or the GM confirms
const dropOk = c => c.kind === 'reviewer' || isGM(c);   // 2.41.0 (owner): the Project engineer or the GM, not the Site engineer
/** 2.17.1: Office: the project's crew with Delete, and who was deleted, by whom and when (last 30 days). */
function crewAdmin(c, started) {
  const staff = c.project.staff || [], since = Date.now() - 30 * 864e5;
  const gone = (c.ui.teamOf === c.project.code ? c.ui.team || [] : []).filter(m => m.active === false && m.dropOk && Date.parse(m.dropOk.at) > since && L.seenFrom(m.dropOk.at))   // 2.42.0: not before joining
    .sort((a, b) => String(b.dropOk.at).localeCompare(String(a.dropOk.at)));
  return html`${started && staff.length ? html`<div class="k">Crew on this project · ${staff.length}</div><div class="box">${staff.map(x => staffRow(c, x))}</div>` : ''}
    ${gone.length ? html`<div class="k">Deleted from this project</div><div class="box">${gone.map(m => html`<div class="li"><div class="n"><b>${m.name}</b><span>${m.role || 'No trade'} · deleted by ${m.dropOk.byName || m.dropOk.by} · ${stampAt(m.dropOk.at)}${m.dropOk.asked ? ` · asked by ${m.dropOk.asked.byName || m.dropOk.asked.by}` : ''}</span></div></div>`)}</div>` : ''}`;
}
function staffRow(c, x) {
  // 2.36.0 (owner): every crew member of the project, not only those added on site
  // 2.43.0 (owner): every Site engineer renames crew at once, no approval (Central Hub copies it to the directory)
  const may = !!x.id && (crewBoss(c) || c.kind === 'reporter'), mine = may && c.ui.live === 'on', del = c.ui.live === 'on' && crewBoss(c) && !!x.id;
  const ask = x.dropAsk ? html`<div class="li drop-ask"><div class="n"><span class="bad">Delete ${x.name}: asked by ${x.dropAsk.byName || x.dropAsk.by} · ${stampAt(x.dropAsk.at)}</span></div>${dropOk(c) ? html`<button type="button" class="btn t slim" data-act="crewDropOk" data-v="${x.id}" data-n="${x.name}">Confirm delete</button><button type="button" class="btn t slim" data-act="crewDropNo" data-v="${x.id}">Keep</button>` : html`<span class="muted small">Waiting for the Project engineer or the GM</span>`}</div>` : '';
  if (c.ui.cd && c.ui.cd.id === x.id) return cdForm(c, x);
  if (mine && c.ui.crewEdit === x.id) return html`<div class="li">${av(c, x)}<div class="n"><input class="fld slim" data-ui="ceName" value="${c.ui.ceName ?? x.name}" aria-label="Name"><select class="fld slim" data-ui="ceTrade" aria-label="Trade">${tradesOf(c, x.trade).map(n => html`<option ${n === (c.ui.ceTrade ?? x.trade) ? 'selected' : ''}>${n}</option>`)}</select></div>
    <input class="fld slim" data-ui="cePhone" value="${c.ui.cePhone ?? (x.phone || '')}" placeholder="Phone" inputmode="tel" aria-label="Phone"><button type="button" class="btn t slim" data-act="crewSave" data-v="${x.id}">Save</button><button type="button" class="mini" data-act="crewEdit" data-v="${x.id}" aria-label="Cancel">✕</button></div>`;
  const info = c.ui.crewInfo && c.ui.crewInfo.code === c.project.code && c.ui.crewInfo.info[x.id];
  // 2.45.0 (owner): what Central Hub's employee record still misses, under the name
  const tag = info ? (info.missing.length ? html` <span class="pill warn">${info.missing.join(', ')} missing</span>` : html` <span class="pill ok">Complete</span>`) : '';
  return html`<div class="li">${av(c, x)}<div class="n"><b>${x.name}</b><span>${x.trade || 'No trade'}${x.fromSite ? ' · added on site' : ''}${tag}</span></div>
    ${may ? html`<button type="button" class="btn t slim" data-act="${mine ? 'cdOpen' : c.ui.live === 'signin' || !c.ui.live ? 'liveConnect' : 'liveWhy'}" data-v="${x.id}">Edit</button>` : ''}${del && !x.dropAsk ? html`<button type="button" class="mini" data-act="crewOff" data-v="${x.id}" data-n="${x.name}" aria-label="Delete ${x.name}">✕</button>` : ''}</div>${ask}`;
}
/** 2.71.0 (owner, 8 Nov): every country in the world, Ethiopia first; an older value (e.g. "Ethiopian") is kept as it is. */
const nationalities = cur => { const all = countryList().map(([, n]) => n).filter(n => n !== 'Ethiopia'); return ['', 'Ethiopia', ...all, ...(cur && cur !== 'Ethiopia' && !all.includes(cur) ? [cur] : [])]; };
/** 2.45.0: the employee data of one crew member, from and to Central Hub. */
function cdForm(c, x) {
  const cd = c.ui.cd, f = cd.f || {};
  if (cd.busy && !cd.was) return html`<div class="li"><div class="n"><b>${x.name}</b><span>Opening the employee data…</span></div></div>`;
  const pic = (k, label) => html`<div class="cd-pic"><span class="small">${label}</span>${f[k] ? html`<img src="${f[k]}" alt="${label}">` : html`<div class="cd-empty bad-t small">Missing</div>`}
    <div class="row"><button type="button" class="btn t slim" data-act="cdPic" data-k="${k}">Camera</button><button type="button" class="btn t slim" data-act="cdPic" data-k="${k}" data-g="1">Gallery</button></div></div>`;
  const fld = (k, label, attrs = '') => html`<label class="lab">${label}</label><input class="fld ${f[k] ? '' : 'cd-miss'}" data-cd="${k}" value="${f[k] || ''}" ${attrs}>`;
  return html`<div class="box pad cd-form"><div class="spread"><b>Employee data · ${x.name}</b><button type="button" class="mini" data-act="cdClose" aria-label="Close">✕</button></div>
    ${fld('name', 'Full name')}
    <label class="lab">Trade</label><select class="fld" data-cd="title">${tradesOf(c, f.title).map(n => html`<option ${n === f.title ? 'selected' : ''}>${n}</option>`)}</select>
    ${fld('privatePhone', 'Phone', 'type="tel" inputmode="tel"')}
    <label class="lab">Nationality</label><select class="fld ${f.nationality ? '' : 'cd-miss'}" data-cd="nationality">${nationalities(f.nationality).map(n => html`<option value="${n}" ${n === (f.nationality || '') ? 'selected' : ''}>${n || 'Choose the country…'}</option>`)}</select>   <!-- 2.71.0 (owner): every country -->
    ${fld('idNumber', 'Fayda ID number', 'inputmode="numeric"')}
    ${fld('passportNumber', 'Passport number')}
    <div class="cd-pics">${pic('photo', 'Photo')}${pic('idImage', 'ID front')}${pic('idImageBack', 'ID back')}${pic('passportImage', 'Passport')}</div>
    <button type="button" class="btn p" data-act="cdSave" ${cd.busy ? 'disabled' : ''}>${cd.busy ? 'Saving…' : 'Save to Central Hub'}</button></div>`;
}
const refreshRow = c => html`<div class="spread small"><span class="muted">${(c.project.crewWait || []).length ? `${c.project.crewWait.length} waiting for approval` : 'The office keeps this list'}</span><button type="button" class="btn t slim" data-act="attRefresh" ${c.ui.attBusy ? 'disabled' : ''}>${c.ui.attBusy ? 'Refreshing…' : 'Refresh'}</button></div>`;

/** 2.5.0: the morning crew photo: from the camera, with the time and place; as many as needed. */
function crewPhotoBox(c) {
  const list = (c.report.photos || []).filter(p => p.captionKind === 'Crew');
  return html`<div class="crew-photo"><div class="k">Morning crew photo</div>
    <div class="box pad">${list.length ? html`<div class="thumbs">${list.map(p => thumb(p, 'sm'))}</div>
      <ul class="plain small">${list.map(p => html`<li><b>${p.at}</b> · ${p.crew ? html`<span class="pill ${p.crew.st === 'ontime' ? 'ok' : 'warn'}">${CREW_ST_WORD[p.crew.st]}</span>${p.crew.tags.map(x => html` <span class="pill warn">${x}</span>`)}${p.crew.geo ? ' · location kept' : ' · no location'}` : html`<span class="muted">checking the time…</span>`}</li>`)}</ul>` : ''}
      <button type="button" class="btn s" data-act="crewPhoto">${icon('cam')}Take attendance photo</button>
      <p class="muted tiny">On time until ${c.project.defStart || '08:00'}, late attendance until ${crewCloses(c.project.defStart || '08:00')}, closed after. The office's clock decides.</p></div></div>`;
}

/** 2.8.0: the usual trades on site; the project's own (wages, crew) are added to them. */
export const TRADES = ['Foreman', 'Site supervision', 'Site Technician', 'Welder / fitter', 'Rigger / erector', 'Crane operator', 'Mason', 'Carpenter', 'Steel fixer', 'Electrician', 'Plumber', 'Painter', 'Driver', 'Labourer'];
/** 2.54.0 (owner): the trades of Central Hub's Manpower Directory (the built-in list until the phone has it); a value already
 *  given stays choosable. Nothing is typed: a missing trade is added in Central Hub (Manpower Directory, + Add a position). */
export const tradesOf = (c, cur = '') => [...new Set([...(c.s.trades && c.s.trades.length ? c.s.trades : TRADES), cur].filter(Boolean))];
function tradeField(c, v, path) {
  return html`<select class="fld slim" data-f="${path}" aria-label="Trade"><option value="">Trade…</option>${tradesOf(c, v === '+' ? '' : v).map(n => html`<option ${n === v ? 'selected' : ''}>${n}</option>`)}</select>`;
}

/** 2.5.0: names and trades sent for approval as the crew of this project. 2.6.0: only a reviewer sees and gives wages. */
/** 2.33.0: the reporter confirms that today's attendance is correct; Central Hub's sheet shows it. */
function confirmBox(c) {
  if (c.ui.date || c.kind === 'viewer' || !L.liveOn() || !c.report.crew.rows.length) return '';
  const ok = c.ui.dayOk, st = dayConfirm(c.ui.marks, ok);
  const when = ok ? new Date(Number(ok.at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  if (st === 'ok') return html`<p class="callout">${icon('check')} Confirmed correct by ${ok.by || 'the reporter'} at ${when}.</p>`;
  return html`<div class="box pad">${st === 'changed' ? html`<p class="callout warn">Changed since ${ok.by || 'you'} confirmed at ${when}. Confirm again.</p>` : ''}
    <button type="button" class="btn p" data-act="crewConfirm">${icon('check')}Confirm the attendance is correct</button></div>`;
}

function crewListBox(c) {
  const cl = c.ui.cl || { trades: [], people: [] }, wait = c.project.crewWait || [], paid = c.kind === 'reviewer';
  return html`<div class="k">Add labour on site for approval</div>
    <div class="box pad"><p class="muted small">People working here who are not on the list: their name and trade go to the Project engineer and Central Hub. Once approved they are on this attendance list. Until then count them under Day workers without names.</p>
      <div class="lab">${paid ? 'Daily wage by trade' : 'Trades'}</div>
      ${cl.trades.map((x, i) => html`<div class="two">${tradeField(c, x.trade, `cl.trades.${i}.trade`)}
        <div class="flex">${paid ? html`<input class="fld slim" inputmode="decimal" data-f="cl.trades.${i}.wage" value="${x.wage}" placeholder="Daily wage" aria-label="Daily wage of ${x.trade || 'the trade'}">` : ''}<button type="button" class="mini" data-act="clDel" data-k="trades" data-i="${i}" aria-label="Remove">✕</button></div></div>`)}
      <button type="button" class="btn t slim" data-act="clTrade">${icon('plus')}Add a trade</button>
      <div class="lab">People</div>
      ${cl.people.map((x, i) => html`<div class="cl-row"><input class="fld slim" data-f="cl.people.${i}.name" value="${x.name}" placeholder="Full name" aria-label="Name">
        ${tradeField(c, x.trade, `cl.people.${i}.trade`)}
        ${paid ? html`<input class="fld slim" inputmode="decimal" data-f="cl.people.${i}.wage" value="${x.wage}" placeholder="${(cl.trades.find(t => t.trade === x.trade) || {}).wage || 'Wage'}" aria-label="Daily wage of ${x.name || 'the person'}">` : html`<span></span>`}
        <button type="button" class="mini" data-act="clDel" data-k="people" data-i="${i}" aria-label="Remove">✕</button>
        ${paid && wageDiffers(x, cl.trades) ? html`<span class="pill warn">Not the trade wage: the office will check it</span>` : ''}</div>`)}
      <button type="button" class="btn t slim" data-act="clPerson">${icon('plus')}Add a person</button>
      ${cl.people.length ? html`<button type="button" class="btn p" data-act="clSend" ${c.ui.busy ? 'disabled' : ''}>Send ${cl.people.length} for approval</button>` : ''}
      ${wait.length ? html`<div class="lab">Waiting for approval</div><ul class="plain small">${wait.map(x => html`<li>${x.name} <span class="muted">· ${x.trade || 'no trade'}</span>${x.id && c.ui.live === 'on' ? html` <button type="button" class="btn t slim" data-act="waitDrop" data-v="${x.id}" data-e="1" ${c.ui.busy ? 'disabled' : ''}>Edit</button><button type="button" class="mini" data-act="waitDrop" data-v="${x.id}" ${c.ui.busy ? 'disabled' : ''} aria-label="Remove ${x.name}">✕</button>` : ''}</li>`)}</ul>` : ''}</div>`;
}

/** On a computer: one table per trade, side by side, overtime always at hand; arrows and P A S L work from the keyboard. */
function crewTables(c, list) {
  const groups = new Map();
  for (const x of list) { const t = x.r.trade || 'Other'; if (!groups.has(t)) groups.set(t, []); groups.get(t).push(x); }
  if (!list.length) return html`<div class="box pad muted small">No one matches.</div>`;
  return html`<div class="crew-cols">${[...groups].map(([trade, rows]) => html`<div class="box tb">
    <div class="tb-h"><span>${trade} · ${rows.length}</span><span>Today</span><span>Overtime</span></div>
    ${rows.map(({ r, i }) => html`<div class="tb-r ${c.ui.cur === i ? 'cur' : ''}" data-row="${i}"><span class="nm">${r.name}</span>${seg(r, i)}
      ${r.state === 'present' ? stepper('ot', r.ot, r.ot ? `${r.ot}h` : '–', i) : html`<span class="muted small ot-off">–</span>`}</div>`)}
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

/** 2.12.0 (Phase E1): live updates from Central Hub, shown only when the Admin turned them on. */
export function liveLine(ui, why = '', last = null) {
  if (ui.liveRoute !== 'read' && ui.liveRoute !== 'both') return '';
  const st = ui.live || '';
  const say = st === 'on' || st === 'connecting' ? 'On: approvals and comments from the office arrive at once'
    : st === 'none' ? 'This project is not connected to Central Hub yet'
    : st === 'error' ? 'Not available now: the app checks the office the usual way' : 'Off on this phone';
  return html`<div class="k">Live updates</div><div class="box pad spread small"><span class="${st === 'on' ? 'ok' : 'muted'}">${say}</span>${st === 'signin' || st === '' ? html`<button type="button" class="btn t slim" data-act="liveConnect">Turn on</button>` : ''}</div>${why && st !== 'on' ? html`<p class="muted tiny">${why}</p>` : ''}${st === 'on' && last ? html`<p class="muted tiny">Last from the office: ${String(last.at.getHours()).padStart(2, '0')}:${String(last.at.getMinutes()).padStart(2, '0')}:${String(last.at.getSeconds()).padStart(2, '0')} · ${last.what}${last.n > 1 ? ` (+${last.n - 1})` : ''}</p>` : ''}`;
}

export function me(c) {
  const a = c.s.auth || {}, p = c.s.profile, pr = c.project;
  const off = pr ? [(pr.nwDow || [0]).map(d => DOW[d]).join(', '), (pr.nonWorking || []).length ? `${pr.nonWorking.length} holidays` : ''].filter(Boolean).join(' · ') : '';
  return {
    tab: 'me',
    head: head('Me', a.email || ''),
    // 2.37.0 (owner): Review and Crew & Hours live in Me for reviewers
    // 2.42.0 (owner): no Review button here; Crew & Hours where the usual day was; the page is compact
    body: html`<div class="me-page">${c.ui.persisted === false && !c.demo ? html`<p class="box pad warn small" id="keepWarn">This phone may clear Field Report's data when it needs space. Keep Field Report on the home screen, allow its notifications, and do not clean it with a cleaner app.</p>` : ''}<label class="lab" for="mn">Name</label><input id="mn" class="fld" data-f="profile.name" value="${p.name}" ${p.locked ? 'readonly' : ''}>
      <label class="lab" for="mp">Position</label><input id="mp" class="fld" value="${p.position}" readonly>${p.locked ? html`<p class="muted tiny">Confirmed by the office. Ask the office to change your name or position.</p>` : html`<p class="muted tiny">Your position is set by the office in Central Hub (2.20.0).</p>`}
      <div class="k">Signature</div>
      ${p.sig ? html`<div class="box pad sigbox"><img src="${p.sig}" alt="Your signature"><div class="spread small"><span class="muted">Signs every report you send</span><button type="button" class="btn t slim" data-act="sigFull">Sign again</button></div></div>`
        : sigLine(p)}
      <div class="k">Project</div>
      ${isGM(c) ? html`<div class="box pad">${projTop(c)}</div>` : ''}<div class="box ${isGM(c) ? 'hide' : ''}">${c.s.projects.map(x => html`<button type="button" class="li" data-act="pickProject" data-v="${x.code}"><span class="ic ${x.code === c.s.proj ? 'ok' : ''}">${icon(x.code === c.s.proj ? 'check' : 'pin')}</span><div class="n"><b>${x.name}</b><span>${x.code}</span></div></button>`)}</div>
      ${isGM(c) ? html`<button type="button" class="btn o" data-act="mediaOpen">${icon('cam')}Dashboard: photos and videos</button>` : ''}   <!-- 2.54.0 -->
      ${c.kind === 'reviewer' ? html`<div class="k">Crew & Hours</div><button type="button" class="btn o" data-act="go" data-to="crewrev">${icon('users')}Crew & Hours${(pr && pr.crewWait || []).length ? ` · ${pr.crewWait.length} waiting` : ''}</button>
      <p class="muted tiny">Working hours, days off and the crew the site sent. Days off for this project: ${off || 'none'}.</p>` : ''}
      ${liveLine(c.ui, c.ui.liveWhy || '', L.liveLast())}
      <div class="k">Reminders and look</div>
      <p class="muted tiny">The reminder to send the report is set for the whole project with its working hours (Me, Crew & Hours): ${(pr && pr.remindAt) || '17:00'}.</p>
      ${tog('pushOn', '', !!p.push || !!c.ui.pushBusy, 'Notifications', c.ui.pushBusy ? 'Turning on…' : p.push ? 'On: the office\'s answers come to this phone' : 'When the office approves or sends back a report')}
      ${p.push ? html`<button type="button" class="btn t" data-act="pushTest">Send a test notification</button>` : ''}
      ${tog('flipPref', 'dark', !!p.dark, 'Dark mode', 'Easier on the eyes at night')}
      <button type="button" class="btn o" data-act="refresh" ${c.ui.refreshing ? 'disabled' : ''}>${c.ui.refreshing ? 'Refreshing…' : 'Refresh lists from the office'}</button>
      <button type="button" class="btn t" data-act="signout">Sign out</button>
      <div class="muted tiny center">Field Report ${APP_VERSION}${isDemo() ? ' · demo' : ''}</div></div>`,
  };
}

export const later = (tab, title, what) => () => ({
  tab,
  head: head(title, 'Coming in the next builds'),
  body: html`<div class="box pad muted">${what}</div>`,
});
