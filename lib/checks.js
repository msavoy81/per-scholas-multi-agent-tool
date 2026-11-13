// checks.js: simple code checks that run before anything is saved or shown.
// These are plain code, not AI, so they always behave the same way.

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
function hasCrisisWords(text) {
  const lower = String(text || '').toLowerCase();
  return CRISIS_WORDS.some((w) => lower.includes(w));
}

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

// A plan can only leave "Draft" when the coach clicks approve.
function canChangePlanStatus(current, next, actor) {
  if (next === 'Draft') return true; // anyone can send it back to draft
  return current === 'Draft' && next === 'Approved' && actor === 'coach';
}

// A flag is only accepted if its quoted evidence appears word for word in the
// learner's chat or activity log, and it has a confidence level and another explanation.
function validateFlag(flag, learner) {
  if (!flag || typeof flag !== 'object') return { ok: false, reason: 'Flag is not an object.' };
  const evidence = String(flag.evidence || '').trim();
  if (!evidence) return { ok: false, reason: 'Flag has no quoted evidence.' };
  const confidence = String(flag.confidence || '').toLowerCase();
  if (!['high', 'medium', 'low'].includes(confidence)) return { ok: false, reason: 'Confidence must be high, medium, or low.' };
  if (!String(flag.otherExplanation || '').trim()) return { ok: false, reason: 'Flag needs one possible other explanation.' };

  const haystack = []
    .concat((learner.coachChat || []).map((m) => m.text))
    .concat((learner.activity || []).map((a) => a.detail))
    .concat((learner.activity || []).map((a) => a.type));
  const found = haystack.some((h) => String(h).includes(evidence));
  if (!found) return { ok: false, reason: 'Quoted evidence was not found word for word in chat or activity.' };
  return { ok: true };
}

module.exports = { CRISIS_WORDS, CRISIS_MESSAGE, hasCrisisWords, safeReply, canChangePlanStatus, validateFlag };
