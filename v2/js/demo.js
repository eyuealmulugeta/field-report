// ?demo: the app with Report #100's project and no server, for checking on a phone or in a browser.
// Nothing leaves the browser. The crew names are placeholders, not the real crew.

export const DEMO_TODAY = '2026-10-20';

const staff = [
  ...['Abebe K.', 'Dawit T.', 'Henok A.', 'Kebede M.', 'Mulugeta S.', 'Tesfaye B.', 'Yonas G.', 'Bereket H.', 'Samuel W.', 'Getachew L.', 'Solomon D.']
    .map((name, i) => ({ id: `W${i + 1}`, name, trade: 'Welder' })),
  ...['Beza Girma', 'Selam M.', 'Tigist A.', 'Meron K.', 'Hana T.', 'Ruth B.', 'Liya S.']
    .map((name, i) => ({ id: `D${i + 1}`, name, trade: 'DL' })),
];

const setup = {
  staff,
  zones: ['Zone C1', 'Zone C2', 'Zone D', 'Fence'],
  activities: ['Wall cladding', 'Roof sheeting', 'Bracing', 'Welding', 'Painting'],
  tasks: [
    { id: 't1', name: 'Steel columns erection', unit: 'pcs', total: 48, done: 30 },
    { id: 't2', name: 'Roof trusses', unit: 'pcs', total: 24, done: 10 },
    { id: 't3', name: 'Wall cladding', unit: 'm²', total: 1800, done: 640 },
    { id: 't4', name: 'Gutters and downpipes', unit: '%', total: 0, done: 0 },
  ],
  milestones: [{ id: 'm1', name: 'Roof structure complete', payment: true }, { id: 'm2', name: 'Cladding complete', payment: false }],
  equipment: ['Mobile crane 25 t', 'Welding machine', 'Scissor lift'],
  materials: ['Roof sheet 0.5 mm', 'Wall panel 50 mm', 'Self-drilling screws', 'Flashing'],
};

const project = {
  key: 'ETH_MJO_CHB', cc: 'ETH', code: 'MJO', pn: 'CHB', name: 'CHB Warehouse', client: 'Demo client', address: 'Modjo',
  siteName: 'Modjo, Ethiopia', location: 'Modjo, Ethiopia', defStart: '08:00', defEnd: '17:00', nwDow: [0], nonWorking: [], day: 99,
};

/** The office's answers in the demo: two approved, one sent back, one waiting. */
const ANSWERS = {
  '2026-10-14': { status: 'approved', comments: [{ at: '2026-10-15T07:40:00Z', by: 'Office', kind: 'approve', text: '' }] },
  '2026-10-15': { status: 'approved', comments: [{ at: '2026-10-16T08:05:00Z', by: 'Office', kind: 'approve', text: '' }] },
  '2026-10-16': { status: 'changes', version: 1, comments: [{ at: '2026-10-17T09:12:00Z', by: 'Office', kind: 'changes', text: 'Add the crane hours under Equipment and a photo of grid 4.' }] },
  '2026-10-17': { status: 'submitted', comments: [] },
};

const sent = new Map();   // file name -> versions sent in this demo session

const wait = ms => new Promise(r => setTimeout(r, ms));

export async function demoServer(action, body) {
  await wait(250);
  switch (action) {
    case 'signin': return { ok: true, token: 'demo', who: 'demo', role: 'engineer', email: 'demo@example.com', name: 'Demo Engineer', days: 30 };
    case 'getconfig': return { ok: true, rev: 1, projects: [project] };
    case 'myProjects': return { ok: true, projects: [{ proj: 'MJO', cc: 'ETH', name: project.name, location: project.location, staff }] };
    case 'getSetup': return { ok: true, proj: body.proj, setup };
    case 'attendance': return { ok: true, proj: body.proj, date: body.date, rows: (body.rows || []).length, at: new Date().toISOString() };
    case 'nowork': return { ok: true, name: `${body.date}_ETH_MJO_CHB_NW.json` };
    case 'upload': {
      // demo only: ?demo&offline (or __demoOffline = true) shows the report waiting in the outbox
      if (globalThis.__demoOffline ?? new URLSearchParams(location.search).has('offline')) return { ok: false, code: 'OFFLINE', error: 'No connection. It is saved on this phone.' };
      const v = (sent.get(body.name) || (ANSWERS[body.name.slice(0, 10)] || {}).version || 0) + 1;
      sent.set(body.name, v);
      return { ok: true, name: body.name, fileName: body.name, version: v, status: 'submitted', size: Math.round((body.data || '').length * 0.75), uploadedAt: new Date().toISOString() };
    }
    case 'status': {
      const a = ANSWERS[String(body.name || '').slice(0, 10)];
      return a ? { ok: true, found: true, report: { name: body.name, status: a.status, version: a.version || 1, comments: a.comments || [] } } : { ok: true, found: false };
    }
    case 'draftGet': return { ok: true, found: false };
    case 'draftPut': return { ok: true, at: Date.now() };
    case 'draftDel': return { ok: true };
    case 'ping': return { ok: true, who: 'DEMO', pushAppId: '' };
    default: return { ok: false, error: `The demo does not do "${action}" yet.` };
  }
}

/** Last week as sent, Monday 19 left missing, so the week strip shows every state. */
export function demoDrafts() {
  const out = {};
  ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'].forEach((d, i) => {
    out[`MJO|${d}`] = { v: 1, proj: 'MJO', date: d, no: 95 + i, sentAt: Date.parse(d + 'T17:30:00Z'), start: { start: '08:00', end: '17:00', cond: 'Windy', tempC: 17, ground: 'Dry', location: 'Modjo, Ethiopia', done: true }, crew: { rows: [], extra: [], done: true }, items: [], equipment: [], received: [], delays: [], photos: [], requests: [], plan: [], safety: {}, done: {} };
  });
  out['MJO|2026-10-17'].equipment = [
    { name: 'Mobile crane 25 t', qty: 1, hrs: 9, status: 'Active' },
    { name: 'Welding machine', qty: 3, hrs: 9, status: 'Active' },
    { name: 'Scissor lift', qty: 1, hrs: 9, status: 'Idle' },
  ];
  out['MJO|2026-10-17'].requests = [{ id: 'rq1', at: '16:20', category: 'Material', text: 'Self-drilling screws 5.5 x 25', qty: 2000, unit: 'pcs', neededBy: '2026-10-19', priority: 'Urgent', location: '' }];
  out['MJO|2026-10-17'].received = [{ id: 'rx1', at: '10:20', name: 'Roof sheet 0.5 mm', qty: 120, unit: 'pcs', note: 'Delivery note 4471', photos: [] }];
  out['MJO|2026-10-17'].plan = [
    { zone: 'Zone C2', taskId: 't1', task: 'Steel columns erection', text: 'Weld the remaining columns on grid 4' },
    { zone: 'Zone D', taskId: 't2', task: 'Roof trusses', text: 'Lift and bolt trusses 7 and 8' },
    { zone: 'Fence', type: 'Painting', text: 'Primer on the east fence posts' },
  ];
  return out;
}
