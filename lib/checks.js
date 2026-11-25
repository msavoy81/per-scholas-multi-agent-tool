// checks.js: simple code checks that run before anything is saved or shown.
// These are plain code, not AI, so they always behave the same way.
// Run `npm test` to see them pass.

// ---------- Crisis words ----------
const CRISIS_WORDS = [
  'suicide', 'suicidal', 'kill myself', 'end my life', 'want to die', 'wanna die',
  'hurt myself', 'harm myself', 'self harm', 'self-harm', 'no reason to live',
  "can't go on", 'cant go on', 'better off dead', 'end it all',
];

const CRISIS_MESSAGE =
  'It sounds like things are really heavy right now. You deserve support from a person. ' +
  'You can call or text 988 (the Suicide & Crisis Lifeline in the US) any time, day or night. ' +
  'Your career coach is also here for you. Use the "Talk to my career coach" button and they will reach out.';

// Returns true if the text contains any crisis word. Case does not matter.
// The 988 card and coach button are shown whenever this is true, even if the AI misses it.
function hasCrisisWords(text) {
  const lower = String(text || '').toLowerCase();
  return CRISIS_WORDS.some((w) => lower.includes(w));
}

// ---------- Friendly fallback ----------
const FALLBACKS = {
  intake: "Sorry, I lost my train of thought for a second. Could you tell me that again, or tap Skip to move on?",
  'learner-coach': "Sorry, something went wrong on my end. Could you say that again? If this keeps happening, your career coach can help.",
  'plan-prep': 'The draft could not be generated this time. Try again, or write the plan by hand.',
  watcher: 'The watcher could not review activity this time. Try again later.',
};

// If an agent reply is empty, not text, or looks broken, swap in a friendly message.
function safeReply(agentName, text) {
  const t = typeof text === 'string' ? text.trim() : '';
  const looksBroken = t.length < 2 || t.length > 4000;
  return looksBroken ? FALLBACKS[agentName] || FALLBACKS['learner-coach'] : t;
}

// ---------- Plans ----------
// A plan can only leave "Draft" when the coach clicks approve.
// Agents may draft or redraft, but never touch a plan the coach approved.
function canChangePlanStatus(current, next, actor) {
  if (next === 'Approved') return current === 'Draft' && actor === 'coach';
  if (next === 'Draft') return actor === 'coach' || current !== 'Approved';
  return false;
}

// Whatever an agent produces, the code stamps it as a Draft.
function enforceDraft(plan) {
  return { ...plan, status: 'Draft', approvedAt: null };
}

// Keep only well-formed weeks. Returns null if there are fewer than three.
function cleanWeeks(weeks) {
  if (!Array.isArray(weeks)) return null;
  const clean = weeks
    .map((w) => ({ label: String((w && w.label) || '').trim().slice(0, 60), goal: String((w && w.goal) || '').trim().slice(0, 400) }))
    .filter((w) => w.label && w.goal)
    .slice(0, 12);
  return clean.length >= 3 ? clean : null;
}

// Meeting briefs always have 3 to 5 questions. Tops up from `extras` if short.
function clampQuestions(list, extras) {
  const q = (Array.isArray(list) ? list : []).map((s) => String(s).trim()).filter(Boolean);
  for (const e of extras || []) {
    if (q.length >= 3) break;
    if (!q.includes(e)) q.push(e);
  }
  return q.slice(0, 5);
}

// Resources are always placeholders built by code, so no real organization
// name can ever appear, whatever the AI writes.
function placeholderResources(barriers) {
  return (barriers || []).map((b) => ({
    barrier: b.type,
    label: `Sample ${b.type} resource`,
    note: 'Placeholder only. Per Scholas would match a real resource here.',
  }));
}

// ---------- Flags ----------
// A flag is only accepted if its quoted evidence appears word for word in the
// learner's chat or activity log, and it has a confidence level and another explanation.
function validateFlag(flag, learner) {
  if (!flag || typeof flag !== 'object') return { ok: false, reason: 'Flag is not an object.' };
  const evidence = String(flag.evidence || '').trim();
  if (evidence.length < 3) return { ok: false, reason: 'Flag has no quoted evidence.' };
  const confidence = String(flag.confidence || '').toLowerCase();
  if (!['high', 'medium', 'low'].includes(confidence)) return { ok: false, reason: 'Confidence must be high, medium, or low.' };
  if (!String(flag.otherExplanation || '').trim()) return { ok: false, reason: 'Flag needs one possible other explanation.' };

  const haystack = []
    .concat((learner.coachChat || []).filter((m) => m.role === 'learner').map((m) => m.text))
    .concat((learner.activity || []).map((a) => a.detail));
  const found = haystack.some((h) => String(h).includes(evidence));
  if (!found) return { ok: false, reason: 'Quoted evidence was not found word for word in the chat or activity log.' };
  return { ok: true };
}

// ---------- Watcher on open ----------
// True when the learner has written something since the watcher last reviewed them.
function needsWatcherReview(learner) {
  const times = (learner.coachChat || []).filter((m) => m.role === 'learner' && m.at).map((m) => Date.parse(m.at));
  if (!times.length) return false;
  const newest = Math.max(...times);
  return !learner.watcherReviewedAt || newest > Date.parse(learner.watcherReviewedAt);
}

// ---------- Handoff summary ----------
// A handoff quote is kept only if it is the learner's own words, word for word.
function learnerSaid(quote, learner) {
  const q = String(quote || '').trim();
  if (q.length < 3) return false;
  return (learner.coachChat || []).some((m) => m.role === 'learner' && String(m.text).includes(q));
}

module.exports = {
  CRISIS_WORDS, CRISIS_MESSAGE, hasCrisisWords, safeReply,
  canChangePlanStatus, enforceDraft, cleanWeeks, clampQuestions, placeholderResources,
  validateFlag, needsWatcherReview, learnerSaid,
};
