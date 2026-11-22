// server.js: a small web server. It serves the pages in public/ and answers
// the /api/... requests those pages make. No database, no login.
//
// Start it with:  npm start        (live mode if .env has a key)
//             or:  npm run mock     (always mock mode, no API credit used)
// Then open http://localhost:3000

const http = require('http');
const fs = require('fs');
const path = require('path');
const store = require('./lib/store');
const log = require('./lib/log');
const checks = require('./lib/checks');
const agents = require('./lib/agents');
const intake = require('./lib/intake');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// ---------- tiny router ----------
const routes = [];
function route(method, pattern, handler) {
  const keys = [];
  const regex = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, regex, keys, handler });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { resolve({}); }
    });
  });
}

// The learner never sees the admissions record, flags, brief, or coach notes,
// and only sees the plan once the coach has approved it.
function learnerView(l) {
  const { record, flags, rejectedFlags, brief, coachNotes, notes, plan, ...rest } = l;
  const approved = plan && plan.status === 'Approved';
  return { ...rest, planStatus: plan ? plan.status : 'none', plan: approved ? plan : null };
}

function sampleSlots() {
  // Four fictional meeting times on the next four weekdays, before training starts.
  const slots = [];
  const times = ['10:00 AM', '1:30 PM', '11:00 AM', '3:00 PM'];
  const day = new Date();
  day.setDate(day.getDate() + 1);
  while (slots.length < 4) {
    day.setDate(day.getDate() + 1);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    const label = day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    slots.push(`${label}, ${times[slots.length]}`);
  }
  return slots;
}

// ---------- status ----------
route('GET', '/api/status', (req, res) => {
  sendJson(res, 200, { mockMode: agents.MOCK_MODE, forcedMock: agents.FORCED_MOCK, model: agents.MODEL });
});

// ---------- admissions (staff only) ----------
route('GET', '/api/admissions', (req, res) => {
  const list = store.listSample().map((s) => {
    const session = store.getLearner(s.id);
    return { id: s.id, label: s.label, shortDescription: s.shortDescription, welcomeSent: !!session, status: session ? session.status : 'not started' };
  });
  sendJson(res, 200, list);
});

route('GET', '/api/admissions/:id', (req, res, params) => {
  const s = store.getSample(params.id);
  if (!s) return sendJson(res, 404, { error: 'No such learner' });
  const session = store.getLearner(s.id);
  sendJson(res, 200, {
    id: s.id,
    label: s.label,
    shortDescription: s.shortDescription,
    record: s.record,
    welcomeSent: !!session,
    status: session ? session.status : 'not started',
    sharedWith: [
      { who: 'Career coach', access: 'Can read' },
      { who: 'AI agents', access: 'Can read. Cannot edit.' },
      { who: 'Learner', access: 'Not shown' },
    ],
  });
});

route('POST', '/api/admissions/:id/send-welcome', (req, res, params) => {
  const learner = store.createSession(params.id);
  if (!learner) return sendJson(res, 404, { error: 'No such learner' });
  log.logEvent('welcome_sent', { learnerId: learner.id });
  if (learner.intake.profile && !learner.plan) draftInBackground(learner.id); // S4 arrives with a finished intake
  sendJson(res, 200, { ok: true, status: learner.status });
});

// ---------- learner view ----------
route('GET', '/api/learners', (req, res) => {
  sendJson(res, 200, store.listLearners().map((l) => ({ id: l.id, label: l.label, shortDescription: l.shortDescription, status: l.status })));
});

route('GET', '/api/learners/:id/me', (req, res, params) => {
  const l = store.getLearner(params.id);
  if (!l) return sendJson(res, 404, { error: 'Welcome not sent yet' });
  sendJson(res, 200, learnerView(l));
});

route('POST', '/api/learners/:id/intake/start', async (req, res, params) => {
  const l = store.getLearner(params.id);
  if (!l) return sendJson(res, 404, { error: 'Welcome not sent yet' });
  if (!l.intake.started) {
    l.intake.started = true;
    l.status = 'intake';
    l.intake.messages.push({ role: 'agent', text: intake.INTRO, at: new Date().toISOString() });
    const record = store.getRecordForAgents(l.id);
    const text = await agents.intakeTurn({ record, answers: {}, skipped: [], nextQuestion: intake.QUESTIONS[0], questionIndex: 0 });
    l.intake.messages.push({ role: 'agent', text, at: new Date().toISOString(), questionId: intake.QUESTIONS[0].id });
    store.saveLearner(l);
    log.logEvent('intake_started', { learnerId: l.id });
  }
  sendJson(res, 200, { messages: l.intake.messages, step: l.intake.step, total: intake.QUESTIONS.length, done: !!l.intake.profile });
});

route('POST', '/api/learners/:id/intake/answer', async (req, res, params) => {
  const l = store.getLearner(params.id);
  if (!l) return sendJson(res, 404, { error: 'Welcome not sent yet' });
  const body = await readBody(req);
  const q = intake.QUESTIONS[l.intake.step];
  if (!q) return sendJson(res, 400, { error: 'Intake already finished' });

  const skipped = !!body.skip;
  const text = String(body.text || '').trim();
  const now = new Date().toISOString();
  if (skipped) {
    l.intake.skipped.push(q.id);
    l.intake.messages.push({ role: 'learner', text: '(skipped)', at: now, questionId: q.id });
    log.logEvent('intake_skipped', { learnerId: l.id, detail: q.id });
  } else {
    l.intake.answers[q.id] = text;
    l.intake.messages.push({ role: 'learner', text, at: now, questionId: q.id });
    log.logEvent('intake_answered', { learnerId: l.id, detail: q.id });
  }
  l.intake.step += 1;

  const record = store.getRecordForAgents(l.id);
  const next = intake.QUESTIONS[l.intake.step] || null;
  const reply = await agents.intakeTurn({
    record, answers: l.intake.answers, skipped: l.intake.skipped,
    lastAnswer: text, lastSkipped: skipped, nextQuestion: next, questionIndex: l.intake.step,
  });
  const crisis = checks.hasCrisisWords(text);
  l.intake.messages.push({ role: 'agent', text: reply, at: new Date().toISOString(), questionId: next ? next.id : null, crisis });
  if (crisis) {
    l.notes.push({ at: now, type: 'crisis_words', text: 'Crisis words came up during intake. 988 information was shown.', open: true });
    log.logEvent('crisis_shown', { learnerId: l.id, detail: 'intake' });
  }

  let done = false;
  if (!next) {
    l.intake.profile = await agents.intakeProfile({ record, answers: l.intake.answers, skipped: l.intake.skipped });
    l.intake.completedAt = new Date().toISOString();
    l.status = 'booking';
    done = true;
    log.logEvent('intake_completed', { learnerId: l.id, detail: `skipped: ${l.intake.skipped.join(' ') || 'none'}` });
  }
  store.saveLearner(l);
  if (done) draftInBackground(l.id); // plan and prep agent drafts for the coach
  sendJson(res, 200, { messages: l.intake.messages, step: l.intake.step, total: intake.QUESTIONS.length, done, crisis });
});

route('GET', '/api/learners/:id/slots', (req, res) => {
  sendJson(res, 200, { slots: sampleSlots() });
});

route('POST', '/api/learners/:id/book', async (req, res, params) => {
  const l = store.getLearner(params.id);
  if (!l) return sendJson(res, 404, { error: 'Welcome not sent yet' });
  const body = await readBody(req);
  l.meeting = { slot: String(body.slot || ''), bookedAt: new Date().toISOString() };
  l.status = 'active';
  l.activity.push({ type: 'meeting_booked', detail: l.meeting.slot, at: l.meeting.bookedAt });
  store.saveLearner(l);
  log.logEvent('meeting_booked', { learnerId: l.id, detail: l.meeting.slot });
  sendJson(res, 200, { ok: true, meeting: l.meeting });
});

route('POST', '/api/learners/:id/chat', async (req, res, params) => {
  const l = store.getLearner(params.id);
  if (!l) return sendJson(res, 404, { error: 'Welcome not sent yet' });
  const body = await readBody(req);
  const feature = ['checkin', 'project', 'interview', 'networking'].includes(body.feature) ? body.feature : 'general';
  const text = String(body.text || '').trim();
  if (!text) return sendJson(res, 400, { error: 'Empty message' });
  const now = new Date().toISOString();

  const reply = await agents.coachReply({ learner: l, feature, text });
  const crisis = checks.hasCrisisWords(text); // code check, runs even if the AI misses it

  l.coachChat.push({ role: 'learner', text, feature, at: now });
  l.coachChat.push({ role: 'agent', text: reply, at: new Date().toISOString(), crisis });
  l.activity.push({ type: feature === 'general' ? 'chat_message' : feature, detail: text, at: now });
  if (crisis) {
    l.notes.push({ at: now, type: 'crisis_words', text: 'Crisis words came up in the AI coach chat. 988 information was shown.', open: true });
    log.logEvent('crisis_shown', { learnerId: l.id, detail: 'coach chat' });
  }
  store.saveLearner(l);
  log.logEvent('coach_feature_used', { learnerId: l.id, detail: feature });
  sendJson(res, 200, { reply, crisis, crisisMessage: crisis ? checks.CRISIS_MESSAGE : null });
});

route('POST', '/api/learners/:id/coach-request', async (req, res, params) => {
  const l = store.getLearner(params.id);
  if (!l) return sendJson(res, 404, { error: 'Welcome not sent yet' });
  const body = await readBody(req);
  const now = new Date().toISOString();
  l.notes.push({ at: now, type: 'coach_request', text: 'Learner tapped "Talk to my career coach"' + (body.from ? ` (from ${body.from})` : '') + '.', open: true });
  l.activity.push({ type: 'coach_request', detail: 'Tapped "Talk to my career coach"', at: now });
  store.saveLearner(l);
  log.logEvent('coach_button_clicked', { learnerId: l.id, detail: body.from || '' });
  sendJson(res, 200, { ok: true });
});

// ---------- plan and prep agent ----------
const drafting = new Set(); // learner ids with a draft in progress

async function generateDraft(id) {
  const l = store.getLearner(id);
  if (!l || !l.intake.profile) return { ok: false, reason: 'Intake is not finished yet.' };
  const current = l.plan ? l.plan.status : 'none';
  if (!checks.canChangePlanStatus(current, 'Draft', 'agent')) return { ok: false, reason: 'The plan is approved. Reopen it as a draft first.' };
  const record = store.getRecordForAgents(id); // frozen, read-only copy
  const out = await agents.planPrep({ record, profile: l.intake.profile, skipped: l.intake.skipped, notes: l.notes });
  const fresh = store.getLearner(id); // reload: the learner may have chatted meanwhile
  if (!checks.canChangePlanStatus(fresh.plan ? fresh.plan.status : 'none', 'Draft', 'agent')) return { ok: false, reason: 'The plan was approved meanwhile.' };
  fresh.plan = out.plan;
  fresh.brief = out.brief;
  store.saveLearner(fresh);
  log.logEvent('plan_drafted', { learnerId: id, detail: out.plan.source });
  return { ok: true };
}

function draftInBackground(id) {
  if (drafting.has(id)) return;
  drafting.add(id);
  generateDraft(id)
    .catch((err) => console.error('[draft]', err))
    .finally(() => drafting.delete(id));
}

// ---------- watcher agent ----------
async function runWatcherFor(id) {
  const l = store.getLearner(id);
  if (!l) return { created: 0, rejected: 0 };
  const proposals = await agents.runWatcher(l);
  const fresh = store.getLearner(id);
  fresh.flags = fresh.flags || [];
  fresh.rejectedFlags = fresh.rejectedFlags || [];
  const seen = new Set(fresh.flags.concat(fresh.rejectedFlags).map((f) => f.key));
  let created = 0;
  let rejected = 0;
  for (const p of Array.isArray(proposals) ? proposals : []) {
    const key = p && p.key;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const now = new Date().toISOString();
    const result = checks.validateFlag(p, fresh); // code check: evidence must match word for word
    if (result.ok) {
      const confidence = String(p.confidence).toLowerCase();
      fresh.flags.push({
        id: 'F' + Date.now().toString(36) + created,
        key,
        createdAt: now,
        summary: String(p.summary || 'Something to look at').slice(0, 200),
        evidence: String(p.evidence).trim(),
        confidence,
        otherExplanation: String(p.otherExplanation).slice(0, 300),
        status: 'open',
      });
      created++;
      log.logEvent('flag_created', { learnerId: id, detail: `${confidence}: ${p.summary}` });
    } else {
      fresh.rejectedFlags.push({ key, at: now, summary: String(p.summary || ''), evidence: String(p.evidence || ''), reason: result.reason });
      rejected++;
      log.logEvent('flag_rejected', { learnerId: id, detail: result.reason });
    }
  }
  store.saveLearner(fresh);
  log.logEvent('watcher_run', { learnerId: id, detail: `${created} created, ${rejected} rejected` });
  return { created, rejected };
}

// ---------- coach dashboard ----------
route('GET', '/api/coach/learners', (req, res) => {
  const list = store.listSample().map((s) => {
    const l = store.getLearner(s.id);
    return {
      id: s.id,
      label: s.label,
      shortDescription: s.shortDescription,
      welcomeSent: !!l,
      status: l ? l.status : 'not started',
      meeting: l && l.meeting ? l.meeting.slot : null,
      planStatus: l && l.plan ? l.plan.status : 'none',
      openFlags: l ? (l.flags || []).filter((f) => f.status === 'open').length : 0,
      openNotes: l ? l.notes.filter((n) => n.open).length : 0,
      firstMeetingMet: !!(l && l.coachNotes.firstMeetingMet),
      demoWeek: l ? l.demoWeek : 0,
    };
  });
  sendJson(res, 200, list);
});

route('GET', '/api/coach/learners/:id', (req, res, params) => {
  const l = store.getLearner(params.id);
  if (!l) return sendJson(res, 404, { error: 'Welcome not sent yet' });
  sendJson(res, 200, { ...l, drafting: drafting.has(l.id) });
});

route('POST', '/api/coach/learners/:id/draft', async (req, res, params) => {
  if (drafting.has(params.id)) return sendJson(res, 409, { error: 'A draft is already being prepared.' });
  drafting.add(params.id);
  try {
    const r = await generateDraft(params.id);
    if (!r.ok) return sendJson(res, 400, { error: r.reason });
    sendJson(res, 200, { ok: true });
  } finally {
    drafting.delete(params.id);
  }
});

function cleanEditedWeeks(body, plan) {
  if (!Array.isArray(body.weeks)) return null;
  return plan.weeks.map((w, i) => ({ label: w.label, goal: String((body.weeks[i] && body.weeks[i].goal) || '').trim().slice(0, 400) || w.goal }));
}

function applyEdits(l, body) {
  const weeks = cleanEditedWeeks(body, l.plan);
  if (!weeks) return false;
  const changed = JSON.stringify(weeks) !== JSON.stringify(l.plan.weeks);
  if (changed) {
    l.plan.weeks = weeks;
    l.plan.editedByCoach = true;
    l.plan.editedAt = new Date().toISOString();
    log.logEvent('plan_edited', { learnerId: l.id });
  }
  return changed;
}

route('POST', '/api/coach/learners/:id/plan/save', async (req, res, params) => {
  const l = store.getLearner(params.id);
  if (!l || !l.plan) return sendJson(res, 404, { error: 'No plan yet' });
  if (l.plan.status !== 'Draft') return sendJson(res, 400, { error: 'Reopen the plan as a draft to edit it.' });
  const changed = applyEdits(l, await readBody(req));
  store.saveLearner(l);
  sendJson(res, 200, { ok: true, changed });
});

route('POST', '/api/coach/learners/:id/plan/approve', async (req, res, params) => {
  const l = store.getLearner(params.id);
  if (!l || !l.plan) return sendJson(res, 404, { error: 'No plan yet' });
  // Code check: only the coach's approve button can move a plan out of Draft.
  if (!checks.canChangePlanStatus(l.plan.status, 'Approved', 'coach')) return sendJson(res, 400, { error: 'Only a draft plan can be approved.' });
  applyEdits(l, await readBody(req));
  l.plan.status = 'Approved';
  l.plan.approvedAt = new Date().toISOString();
  store.saveLearner(l);
  log.logEvent('plan_approved', { learnerId: l.id, detail: l.plan.editedByCoach ? 'with coach edits' : 'as drafted' });
  sendJson(res, 200, { ok: true });
});

route('POST', '/api/coach/learners/:id/plan/reopen', (req, res, params) => {
  const l = store.getLearner(params.id);
  if (!l || !l.plan) return sendJson(res, 404, { error: 'No plan yet' });
  if (!checks.canChangePlanStatus(l.plan.status, 'Draft', 'coach')) return sendJson(res, 400, { error: 'Cannot reopen.' });
  l.plan.status = 'Draft';
  l.plan.approvedAt = null;
  store.saveLearner(l);
  log.logEvent('plan_reopened', { learnerId: l.id });
  sendJson(res, 200, { ok: true });
});

const FLAG_DECISIONS = { reach_out: "I'll reach out", watch: 'Keep an eye on it', dismiss: 'Dismissed' };
route('POST', '/api/coach/learners/:id/flags/:flagId', async (req, res, params) => {
  const l = store.getLearner(params.id);
  const flag = l && (l.flags || []).find((f) => f.id === params.flagId);
  if (!flag) return sendJson(res, 404, { error: 'No such flag' });
  const body = await readBody(req);
  if (!FLAG_DECISIONS[body.decision]) return sendJson(res, 400, { error: 'Unknown decision' });
  flag.status = 'decided';
  flag.decision = body.decision;
  flag.decidedAt = new Date().toISOString();
  store.saveLearner(l);
  log.logEvent('flag_decided', { learnerId: l.id, detail: `${body.decision}: ${flag.summary}` });
  sendJson(res, 200, { ok: true });
});

route('POST', '/api/coach/learners/:id/notes/:index/done', (req, res, params) => {
  const l = store.getLearner(params.id);
  const note = l && l.notes[Number(params.index)];
  if (!note) return sendJson(res, 404, { error: 'No such note' });
  note.open = false;
  note.handledAt = new Date().toISOString();
  store.saveLearner(l);
  log.logEvent('note_handled', { learnerId: l.id, detail: note.type });
  sendJson(res, 200, { ok: true });
});

route('POST', '/api/coach/learners/:id/coach-notes', async (req, res, params) => {
  const l = store.getLearner(params.id);
  if (!l) return sendJson(res, 404, { error: 'Welcome not sent yet' });
  const body = await readBody(req);
  const steps = [0, 1, 2].map((i) => String((body.nextSteps || [])[i] || '').trim().slice(0, 300));
  const met = !!body.firstMeetingMet;
  if (met && !l.coachNotes.firstMeetingMet) log.logEvent('first_meeting_met', { learnerId: l.id });
  l.coachNotes = { nextSteps: steps, firstMeetingMet: met, savedAt: new Date().toISOString() };
  store.saveLearner(l);
  log.logEvent('coach_notes_saved', { learnerId: l.id, detail: `${steps.filter(Boolean).length} next steps` });
  sendJson(res, 200, { ok: true });
});

route('POST', '/api/coach/learners/:id/watch', async (req, res, params) => {
  if (!store.getLearner(params.id)) return sendJson(res, 404, { error: 'Welcome not sent yet' });
  sendJson(res, 200, await runWatcherFor(params.id));
});

route('GET', '/api/log.csv', (req, res) => {
  log.logEvent('log_exported', {});
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="usage-log.csv"',
  });
  res.end(log.toCsv());
});

// ---------- demo controls ----------
// "Skip ahead one week": moves every learner's timeline back seven days, adds
// what a quiet week looks like (three missed check-ins for active learners;
// an unfinished step for everyone else), then runs the watcher.
// With a learnerId in the body (the guided demo), only that learner moves ahead.
route('POST', '/api/demo/skip-week', async (req, res) => {
  const body = await readBody(req);
  let learners = store.listLearners();
  if (body.learnerId) {
    learners = learners.filter((l) => l.id === String(body.learnerId));
    if (!learners.length) return sendJson(res, 404, { error: 'Welcome not sent yet' });
  }
  let flagsCreated = 0;
  const daysAgo = (d) => new Date(Date.now() - d * 864e5).toISOString();
  for (const l of learners) {
    store.shiftDates(l, -7);
    l.demoWeek = (l.demoWeek || 0) + 1;
    if (l.status === 'active') {
      [6, 4, 2].forEach((d) => l.activity.push({ type: 'checkin_missed', detail: 'No check-in', at: daysAgo(d) }));
    } else if (l.status === 'booking') {
      l.activity.push({ type: 'booking_pending', detail: 'First coach meeting not booked a week after intake', at: daysAgo(1) });
    } else {
      l.activity.push({ type: 'intake_pending', detail: 'Intake not finished a week after welcome', at: daysAgo(1) });
    }
    store.saveLearner(l);
    flagsCreated += (await runWatcherFor(l.id)).created;
  }
  log.logEvent('demo_skip_week', { detail: `${learners.length} learners, ${flagsCreated} new flags` });
  sendJson(res, 200, { learners: learners.length, flagsCreated });
});

route('GET', '/api/demo/session', (req, res) => {
  sendJson(res, 200, store.getMeta());
});

route('POST', '/api/demo/new-session', (req, res) => {
  const meta = store.newTestSession();
  log.logEvent('test_session_started', {});
  sendJson(res, 200, meta);
});

route('POST', '/api/demo/clear-log', (req, res) => {
  log.clearLog();
  sendJson(res, 200, { ok: true });
});

// ---------- static files ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };
function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];
  for (const r of routes) {
    const m = urlPath.match(r.regex);
    if (m && r.method === req.method) {
      const params = {};
      r.keys.forEach((k, i) => (params[k] = m[i + 1]));
      try {
        return await r.handler(req, res, params);
      } catch (err) {
        console.error(err);
        return sendJson(res, 500, { error: 'Something went wrong on the server.' });
      }
    }
  }
  if (urlPath.startsWith('/api/')) return sendJson(res, 404, { error: 'Unknown route' });
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log('');
  console.log('  Per Scholas Multi-Agent Tool (prototype, fictional data)');
  console.log('  Open  http://localhost:' + PORT);
  const why = agents.FORCED_MOCK ? 'started with npm run mock' : 'no ANTHROPIC_API_KEY set';
  console.log('  Mode  ' + (agents.MOCK_MODE ? 'MOCK (' + why + ', pre-written replies)' : 'LIVE (' + agents.MODEL + ')'));
  console.log('');
});
