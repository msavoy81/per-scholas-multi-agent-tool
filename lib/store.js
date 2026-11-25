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
  // Code check: the session copy of the admissions record is always restored
  // from the original before saving, so no code path can change it.
  const sample = getSample(learner.id);
  if (sample) learner.record = structuredClone(sample.record);
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
    flags: [], // accepted watcher flags
    rejectedFlags: [], // watcher proposals that failed the evidence check
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

// ---------- Archive (nothing is deleted without a copy) ----------
// Saved chats are evidence-informed test conversations: grounded in the
// research, not research evidence. They live inside data/sessions/, so git ignores them.
const ARCHIVE_DIR = path.join(SESSION_DIR, 'archive');
const TRANSCRIPT_LABEL = 'Evidence-informed test conversation: grounded in the research, not research evidence. Fictional learner.';
const SAVE_TAGS = ['Great conversation', 'Bug', 'Test'];

// Same guard as writeJson, for plain-text files.
function writeText(file, text) {
  const resolved = path.resolve(file);
  if (!resolved.startsWith(SESSION_DIR + path.sep)) {
    throw new Error('Refusing to write outside data/sessions/: ' + resolved);
  }
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, text);
}

// Local date and time, safe for file names, like 2026-11-24_16-05-09.
function fileStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + '-' + p(d.getMinutes()) + '-' + p(d.getSeconds());
}

// Turns a learner's AI coach chat into plain text a person can read. Touches no files.
function formatTranscript(learner, extra = {}) {
  const lines = [TRANSCRIPT_LABEL, ''];
  lines.push('Sample learner: ' + learner.id + (learner.label ? ' (' + learner.label + ')' : ''));
  if (extra.testSession) lines.push('Test session: T' + extra.testSession);
  if (extra.savedAt) lines.push('Saved: ' + extra.savedAt);
  if (extra.tag) lines.push('Tag: ' + extra.tag);
  if (extra.note) lines.push('Note: ' + extra.note);
  lines.push('');
  const chat = learner.coachChat || [];
  if (!chat.length) lines.push('(No messages in the AI coach chat.)');
  chat.forEach((m) => {
    const who = m.role === 'learner' ? 'Learner' : 'AI coach';
    const feature = m.role === 'learner' && m.feature && m.feature !== 'general' ? ' [' + m.feature + ']' : '';
    lines.push(who + feature + ': ' + m.text);
    if (m.crisis) lines.push('(988 crisis information was shown here.)');
  });
  return lines.join('\n') + '\n';
}

// Copies every learner file into data/sessions/archive/<date-time>-T<session>/:
// an exact copy of the JSON plus a readable transcript. Returns the folder, or null if there was nothing to copy.
function archiveLearners(testSession) {
  if (!fs.existsSync(LEARNER_DIR)) return null;
  const files = fs.readdirSync(LEARNER_DIR).filter((f) => f.endsWith('.json'));
  if (!files.length) return null;
  const dir = path.join(ARCHIVE_DIR, fileStamp() + '-T' + testSession);
  const savedAt = new Date().toISOString();
  files.forEach((f) => {
    const source = path.join(LEARNER_DIR, f);
    writeText(path.join(dir, f), fs.readFileSync(source, 'utf8')); // exact copy, even if the file is damaged
    const learner = readJson(source, null);
    if (learner) writeText(path.join(dir, f.replace(/\.json$/, '.txt')), formatTranscript(learner, { testSession, savedAt }));
  });
  return dir;
}

// Copies the usage log into data/sessions/archive/usage-logs/ before it is cleared.
function archiveUsageLog() {
  const file = path.join(SESSION_DIR, 'usage-log.json');
  if (!fs.existsSync(file)) return null;
  const dest = path.join(ARCHIVE_DIR, 'usage-logs', fileStamp() + '-T' + getMeta().testSession + '-usage-log.json');
  writeText(dest, fs.readFileSync(file, 'utf8'));
  return dest;
}

// "Save this chat" demo control: a JSON copy plus a transcript in data/sessions/archive/starred/.
function saveStarredChat(learner, tag, note) {
  const testSession = getMeta().testSession;
  const savedAt = new Date().toISOString();
  const slug = tag.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const base = path.join(ARCHIVE_DIR, 'starred', fileStamp() + '-T' + testSession + '-' + learner.id + '-' + slug);
  writeJson(base + '.json', { savedAt, testSession, tag, note, learner });
  writeText(base + '.txt', formatTranscript(learner, { testSession, savedAt, tag, note }));
  return path.basename(base);
}

// ---------- Test sessions (demo controls) ----------
const META_FILE = path.join(SESSION_DIR, 'meta.json');

function getMeta() {
  let meta = readJson(META_FILE, null);
  if (!meta) {
    meta = { testSession: 1, startedAt: new Date().toISOString() };
    writeJson(META_FILE, meta);
  }
  return meta;
}

// Start a new test session: archives every learner file first, then clears them. Keeps the usage log.
function newTestSession() {
  const meta = getMeta();
  archiveLearners(meta.testSession); // copy first; if this throws, nothing is deleted
  if (fs.existsSync(LEARNER_DIR)) fs.rmSync(LEARNER_DIR, { recursive: true, force: true });
  const next = { testSession: meta.testSession + 1, startedAt: new Date().toISOString() };
  writeJson(META_FILE, next);
  return next;
}

// Move every timestamp in a learner's session by `days` (used by "Skip ahead one week").
// The admissions record is left alone.
function shiftDates(obj, days) {
  if (Array.isArray(obj)) return obj.forEach((o) => shiftDates(o, days));
  if (!obj || typeof obj !== 'object') return;
  Object.entries(obj).forEach(([k, v]) => {
    if (k === 'record') return;
    if (typeof v === 'string' && (k === 'at' || k.endsWith('At')) && !isNaN(Date.parse(v))) {
      const d = new Date(v);
      d.setDate(d.getDate() + days);
      obj[k] = d.toISOString();
    } else if (v && typeof v === 'object') {
      shiftDates(v, days);
    }
  });
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
  getMeta,
  newTestSession,
  shiftDates,
  SAVE_TAGS,
  formatTranscript,
  archiveUsageLog,
  saveStarredChat,
};
