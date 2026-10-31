// The report PDF, drawn with jsPDF (the same library and address the old app uses). A4 portrait:
// summary, information, work done by zone, manpower and equipment, safety and delays, materials, requests,
// tomorrow, sign-off; photos 6 to a page, 2 in a row; the office-only attendance page last.
// buildPdf takes the jsPDF class, so the layout also runs in node for checking.

import { dayLabel } from './core/util.js';
import { totals } from './model/crew.js';
import { summary, byZone, requestReady, planReady, planLine } from './model/end.js';

export const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

/** Loads jsPDF once; fails when there is no connection and it was never loaded. */
export function loadPdfLib() {
  if (globalThis.jspdf) return Promise.resolve(globalThis.jspdf.jsPDF);
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = JSPDF_URL;
    s.onload = () => (globalThis.jspdf ? ok(globalThis.jspdf.jsPDF) : fail(new Error('PDF library missing')));
    s.onerror = () => { s.remove(); fail(new Error('No connection to make the PDF')); };
    document.head.appendChild(s);
  });
}

const BRAND = [11, 79, 156], INK = [27, 36, 48], MUTED = [123, 133, 149], LINE = [227, 231, 238], SOFT = [232, 240, 251];
const W = 595.28, H = 841.89, M = 36, CW = W - 2 * M;
const FOOT = 30;

/**
 * d: { r, project, profile, file, photos: [{ data, w, h, cap }], sig, sentAt }.
 * Returns the jsPDF document (doc.output('blob') in the browser, doc.output('arraybuffer') in node).
 */
export function buildPdf(JsPDF, d) {
  const { r, project, profile } = d;
  const doc = new JsPDF({ unit: 'pt', format: 'a4', compress: true });
  let y = M;
  const color = (c, kind = 'text') => (kind === 'text' ? doc.setTextColor(...c) : kind === 'fill' ? doc.setFillColor(...c) : doc.setDrawColor(...c));
  const font = (size, style = 'normal', c = INK) => { doc.setFont('helvetica', style); doc.setFontSize(size); color(c); };
  const newPage = () => { doc.addPage(); y = M; };
  const room = h => { if (y + h > H - M - FOOT) newPage(); };
  const lines = (text, width) => doc.splitTextToSize(String(text ?? ''), width);

  const section = title => {
    room(40);
    y += 12;
    font(10, 'bold', BRAND);
    doc.text(title.toUpperCase(), M, y);
    color(BRAND, 'draw'); doc.setLineWidth(1); doc.line(M, y + 4, M + CW, y + 4);
    y += 18;
  };
  const para = (text, { size = 9.5, indent = 0, c = INK, style = 'normal', gap = 3 } = {}) => {
    font(size, style, c);
    for (const ln of lines(text, CW - indent)) { room(size + 2); doc.text(ln, M + indent, y); y += size + 2.5; }
    y += gap;
  };
  const empty = text => para(text, { c: MUTED, style: 'italic' });

  /** A table with a header row; widths in fractions of the content width. Rows break across pages. */
  const table = (cols, rows, { x = M, width = CW } = {}) => {
    const ws = cols.map(c => c.w * width);
    const head = () => {
      color(SOFT, 'fill'); doc.rect(x, y - 10, width, 15, 'F');
      font(8, 'bold', MUTED);
      let cx = x; cols.forEach((c, i) => { doc.text(c.t.toUpperCase(), cx + 4, y); cx += ws[i]; });
      y += 15;
    };
    room(30); head();
    for (const row of rows) {
      font(9, 'normal');
      const cells = row.map((v, i) => lines(v, ws[i] - 8));
      const h = Math.max(...cells.map(c => c.length)) * 11.5 + 5;
      if (y + h > H - M - FOOT) { newPage(); y += 10; head(); }
      let cx = x;
      cells.forEach((c, i) => { font(9, cols[i].b ? 'bold' : 'normal', cols[i].c || INK); doc.text(c, cx + 4, y + 2); cx += ws[i]; });
      y += h;
      color(LINE, 'draw'); doc.setLineWidth(0.5); doc.line(x, y - 8, x + width, y - 8);
    }
    y += 4;
  };

  /* header */
  color(BRAND, 'fill'); doc.roundedRect(M, y, 34, 34, 6, 6, 'F');
  font(13, 'bold', [255, 255, 255]); doc.text('AP', M + 17, y + 22, { align: 'center' });
  font(15, 'bold'); doc.text('Daily Site Report', M + 44, y + 14);
  font(9, 'normal', MUTED); doc.text(`Amistad Prefab · ${project.name || ''}`, M + 44, y + 28);
  font(15, 'bold', BRAND); doc.text(`Report #${r.no}`, M + CW, y + 14, { align: 'right' });
  font(9, 'normal', MUTED); doc.text(`${dayLabel(r.date)} ${r.date.slice(0, 4)}`, M + CW, y + 28, { align: 'right' });
  y += 50;

  /* summary figures */
  const s = summary(r);
  const figs = [[s.present, 'Present'], [s.manHours, 'Man-hours'], [s.items, 'Work items'], [s.machines, 'Machines'], [s.delayHours ? `${s.delayHours} h` : '0', 'Delays'], [s.photos, 'Photos']];
  const fw = CW / figs.length;
  figs.forEach(([v, label], i) => {
    const x = M + i * fw;
    color(SOFT, 'fill'); doc.roundedRect(x + 2, y, fw - 4, 40, 5, 5, 'F');
    font(14, 'bold', BRAND); doc.text(String(v), x + fw / 2, y + 19, { align: 'center' });
    font(7.5, 'normal', MUTED); doc.text(label.toUpperCase(), x + fw / 2, y + 32, { align: 'center' });
  });
  y += 52;
  if (r.safety.incident) para(`Safety: ${s.safety}${r.safety.note ? ` - ${r.safety.note}` : ''}`, { style: 'bold', c: [180, 35, 24] });

  /* information */
  section('Information');
  const st = r.start;
  const info = [
    ['Project', `${project.name || ''}${project.code ? ` (${project.code})` : ''}`], ['Client', project.client || '-'],
    ['Location', st.location || '-'], ['Working hours', `${st.start} - ${st.end}`],
    ['Weather', [st.cond, st.tempC !== '' && st.tempC != null ? `${st.tempC} °C` : '', st.wind].filter(Boolean).join(', ') || '-'], ['Ground', st.ground || '-'],
    ['Prepared by', [profile.name, profile.position].filter(Boolean).join(', ') || '-'], ['File', d.file || ''],
  ];
  for (let i = 0; i < info.length; i += 2) {
    room(14);
    info.slice(i, i + 2).forEach(([k, v], j) => {
      const x = M + j * (CW / 2);
      font(8, 'bold', MUTED); doc.text(k.toUpperCase(), x, y);
      font(9.5, 'normal'); doc.text(lines(v, CW / 2 - 90)[0] || '', x + 82, y);
    });
    y += 15;
  }

  /* work done */
  section('Work done by zone');
  const zones = byZone(r.items);
  if (!zones.length) empty('No work logged.');
  for (const z of zones) {
    room(28);
    para(z.zone, { style: 'bold', size: 10, gap: 0 });
    for (const ln of z.lines) para(`•  ${ln}`, { indent: 10, gap: 0 });
    y += 4;
  }

  /* manpower and equipment */
  section('Manpower and equipment');
  const t = totals(r.crew, st.start, st.end);
  const top = y;
  table([{ t: 'Trade', w: 0.55 }, { t: 'People', w: 0.2 }, { t: 'Man-h', w: 0.25 }],
    [...t.byTrade.map(x => [x.trade, String(x.qty), String(x.hrs)]), ['Total', String(t.present), String(t.manHours)]], { width: CW * 0.44 });
  const yLeft = y; y = top;
  table([{ t: 'Equipment', w: 0.46 }, { t: 'Qty', w: 0.12 }, { t: 'Hours', w: 0.16 }, { t: 'Status', w: 0.26 }],
    r.equipment.length ? r.equipment.map(e => [e.name, String(e.qty), String(e.hrs), e.status]) : [['None', '', '', '']], { x: M + CW * 0.48, width: CW * 0.52 });
  y = Math.max(y, yLeft);

  /* safety and delays */
  section('Safety and delays');
  para(`Toolbox talk: ${r.safety.toolbox ? 'held' : 'not held'}  ·  ${r.safety.incident ? `${s.safety}: ${r.safety.note || 'no description'}` : 'No incidents'}`);
  if (r.delays.length) {
    table([{ t: 'Time', w: 0.1 }, { t: 'Cause', w: 0.2 }, { t: 'Responsible', w: 0.17 }, { t: 'Hours', w: 0.1 }, { t: 'Idle', w: 0.18 }, { t: 'Details', w: 0.25 }],
      r.delays.map(x => [x.at, x.cause, x.party || '-', String(x.hours), [x.idlePeople ? `${x.idlePeople} people` : '', x.idleEquipment].filter(Boolean).join(', ') || '-', x.note || '']));
  } else empty('No delays.');

  /* materials */
  section('Materials received');
  if (r.received.length) table([{ t: 'Time', w: 0.1 }, { t: 'Material', w: 0.38 }, { t: 'Amount', w: 0.17 }, { t: 'Note', w: 0.35 }],
    r.received.map(x => [x.at, x.name, x.qty != null && x.qty !== '' ? `${x.qty} ${x.unit}` : '-', x.note || '']));
  else empty('Nothing received.');

  /* requests */
  section('Requests');
  const reqs = (r.requests || []).filter(requestReady);
  if (reqs.length) table([{ t: 'Priority', w: 0.13 }, { t: 'Type', w: 0.15 }, { t: 'Item', w: 0.4 }, { t: 'Amount', w: 0.14 }, { t: 'Needed by', w: 0.18 }],
    reqs.map(q => [q.priority, q.category, q.text, q.qty != null && q.qty !== '' ? `${q.qty} ${q.unit}` : '-', q.neededBy ? dayLabel(q.neededBy) : '-']));
  else empty('No requests.');

  /* tomorrow */
  section('Plan for tomorrow');
  const plan = (r.plan || []).filter(planReady);
  if (plan.length) for (const x of plan) para(`•  ${planLine(x)}`, { indent: 4, gap: 0 }); else empty('No plan given.');
  if (String(r.notes || '').trim()) { y += 4; para('Notes', { style: 'bold', gap: 0 }); para(r.notes); }
  if (String(r.instructions || '').trim()) { y += 4; para("Client engineer's instructions", { style: 'bold', gap: 0 }); para(r.instructions); }

  /* sign-off */
  room(100);
  section('Sign-off');
  const sy = y;
  font(8, 'bold', MUTED); doc.text('PREPARED BY', M, sy); doc.text('CHECKED BY (OFFICE)', M + CW / 2, sy);
  font(10, 'bold'); doc.text(profile.name || '', M, sy + 14);
  font(9, 'normal', MUTED); doc.text(profile.position || '', M, sy + 26);
  if (d.sig) { try { doc.addImage(d.sig, 'PNG', M, sy + 30, 130, 44); } catch { /* a bad signature image leaves the line blank */ } }
  color(LINE, 'draw'); doc.setLineWidth(0.7); doc.line(M, sy + 76, M + 200, sy + 76); doc.line(M + CW / 2, sy + 76, M + CW / 2 + 200, sy + 76);
  font(8, 'normal', MUTED);
  doc.text(`Signed ${dayLabel(r.date)} ${d.signedAt || ''}`.trim(), M, sy + 88);
  doc.text('Name, signature and date', M + CW / 2, sy + 88);
  y = sy + 96;

  /* photos: 6 to a page, 2 in a row */
  const pics = d.photos || [];
  if (pics.length) {
    const gw = (CW - 14) / 2, gh = 200;
    pics.forEach((p, i) => {
      if (i % 6 === 0) {
        newPage();
        font(10, 'bold', BRAND); doc.text(`PHOTOS ${pics.length > 6 ? `${Math.floor(i / 6) + 1} of ${Math.ceil(pics.length / 6)}` : ''}`.trim(), M, y);
        color(BRAND, 'draw'); doc.setLineWidth(1); doc.line(M, y + 4, M + CW, y + 4);
        y += 16;
      }
      const k = i % 6, x = M + (k % 2) * (gw + 14), py = y + Math.floor(k / 2) * (gh + 40);
      const scale = Math.min(gw / p.w, gh / p.h), iw = p.w * scale, ih = p.h * scale;
      color([245, 247, 250], 'fill'); doc.rect(x, py, gw, gh, 'F');
      try { doc.addImage(p.data, 'JPEG', x + (gw - iw) / 2, py + (gh - ih) / 2, iw, ih); } catch { /* unreadable photo: the frame stays empty */ }
      font(8.5, 'normal');
      doc.text(lines(p.cap, gw).slice(0, 2), x, py + gh + 12);
    });
  }

  /* 2.1.1: no attendance-by-name page. The PDF can reach the client; the names go to Central Hub's attendance
     sheet through the report file (meta.attendance) only. */

  /* footer on every page */
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    color(LINE, 'draw'); doc.setLineWidth(0.5); doc.line(M, H - M - 12, M + CW, H - M - 12);
    font(7.5, 'normal', MUTED);
    doc.text(`${d.file || ''} · Amistad Prefab Field Report`, M, H - M);
    doc.text(`Page ${i} of ${n}`, M + CW, H - M, { align: 'right' });
  }
  return doc;
}

/** "10:20 · Zone C2 · Progress: roof sheets" */
export const photoCaption = (p, items = []) => {
  const it = items.find(i => i.id === p.itemId);
  const what = p.caption || (it ? `${p.captionKind}: ${it.task || it.type || it.text || 'work'}` : p.captionKind);
  return [p.at, p.zone, what].filter(Boolean).join(' · ');
};
