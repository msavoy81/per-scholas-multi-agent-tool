// store.js: reads and writes the JSON files that hold all prototype data.
//
// Two folders:
//   data/sample/    fictional sample records, committed to git, READ ONLY
//   data/sessions/  everything created while using the prototype, ignored by git
//
// The one rule enforced here: nothing is ever written outside data/sessions/.
// That is how we guarantee the original admissions records are never changed.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SAMPLE_DIR = path.join(ROOT, 'data', 'sample');
const SESSION_DIR = path.join(ROOT, 'data', 'sessions');
const LEARNER_DIR = path.join(SESSION_DIR, 'learners');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return fallback;
  }
}

function writeJson(file, data) {
  const resolved = path.resolve(file);
  if (!resolved.startsWith(SESSION_DIR + path.sep)) {
    // This is a code check, not an AI rule: sample data can never be overwritten.
    throw new Error('Refusing to write outside data/sessions/: ' + resolved);
  }
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(data, null, 2));
}

// Freeze an object and everything inside it so no code path can change it by accident.
function deepFreeze(obj) {
  if (obj && typeof obj === 'object') {
    Object.values(obj).forEach(deepFreeze);
    Object.freeze(obj);
  }
  return obj;
}

// ---------- Sample data (read only) ----------

function listSample() {
  const file = readJson(path.join(SAMPLE_DIR, 'learners.json'), { learners: [] });
  return file.learners;
}

function getSample(id) {
  return listSample().find((l) => l.id === id) || null;
}

// What an AI agent is allowed to see: a frozen copy of the record. Read, never edit.
function getRecordForAgents(id) {
  const sample = getSample(id);
  if (!sample) return null;
  return deepFreeze(structuredClone(sample.record));
}

// ---------- Session data (read and write) ----------

function learnerFile(id) {
  return path.join(LEARNER_DIR, id + '.json');
}

function getLearner(id) {
  return readJson(learnerFile(id), null);
}

function saveLearner(learner) {
  learner.updatedAt = new Date().toISOString();
  writeJson(learnerFile(learner.id), learner);
  return learner;
}

function listLearners() {
  if (!fs.existsSync(LEARNER_DIR)) return [];
  return fs
    .readdirSync(LEARNER_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson(path.join(LEARNER_DIR, f), null))
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// Create the session copy for a learner when staff click "Send welcome".
// S4 comes with preloaded activity so the watcher has something to review.
function createSession(id) {
  const sample = getSample(id);
  if (!sample) return null;
  const existing = getLearner(id);
  if (existing) return existing;

  const learner = {
    id: sample.id,
    label: sample.label,
    shortDescription: sample.shortDescription,
    record: structuredClone(sample.record), // a copy; the original stays untouched
    status: 'invited', // invited -> intake -> booking -> active
    welcomeSentAt: new Date().toISOString(),
    intake: { started: false, step: 0, answers: {}, skipped: [], messages: [], profile: null },
    meeting: null,
    coachChat: [],
    activity: [],
    notes: [], // notes for the coach, e.g. "learner asked to talk"
    flags: [],
    plan: null,
    brief: null,
    coachNotes: { nextSteps: ['', '', ''], firstMeetingMet: false },
    demoWeek: 0,
  };

  const pre = sample.preload;
  if (pre) {
    learner.welcomeSentAt = daysAgoIso(pre.welcomeDaysAgo || 7);
    learner.status = 'active';
    learner.intake = {
      started: true,
      step: 99,
      answers: pre.intake.answers,
      skipped: pre.intake.skipped,
      messages: [],
      profile: pre.intake.profile,
      completedAt: daysAgoIso(pre.welcomeDaysAgo || 7),
    };
    learner.meeting = { slot: pre.meeting.slot, bookedAt: daysAgoIso(pre.meeting.bookedDaysAgo || 6) };
    learner.coachChat = pre.coachChat.map((m) => ({
      role: m.role,
      text: m.text,
      feature: m.feature || null,
      at: daysAgoIso(m.daysAgo),
    }));
    learner.activity = pre.activity.map((a) => ({ type: a.type, detail: a.detail, at: daysAgoIso(a.daysAgo) }));
    learner.demoWeek = 1;
  }

  return saveLearner(learner);
}

// Remove everything in data/sessions/ (demo control).
function resetAll() {
  if (fs.existsSync(LEARNER_DIR)) fs.rmSync(LEARNER_DIR, { recursive: true, force: true });
  const log = path.join(SESSION_DIR, 'usage-log.json');
  if (fs.existsSync(log)) fs.rmSync(log);
}

module.exports = {
  SESSION_DIR,
  readJson,
  writeJson,
  listSample,
  getSample,
  getRecordForAgents,
  getLearner,
  saveLearner,
  listLearners,
  createSession,
  resetAll,
};
