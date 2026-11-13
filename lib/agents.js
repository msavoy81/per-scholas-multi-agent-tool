// agents.js: the one place that talks to the AI. Every agent gets its
// instructions from a charter file in charters/. If no API key is set, the
// pre-written replies in mock.js are used instead ("mock mode").

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const mock = require('./mock');
const checks = require('./checks');
const intake = require('./intake');

const MODEL = 'claude-sonnet-5-5';
const MOCK_MODE = !process.env.ANTHROPIC_API_KEY;
const client = MOCK_MODE ? null : new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const CHARTER_DIR = path.join(__dirname, '..', 'charters');

function loadCharter(name) {
  const main = fs.readFileSync(path.join(CHARTER_DIR, name + '.md'), 'utf8');
  const safety = fs.readFileSync(path.join(CHARTER_DIR, '_shared-safety.md'), 'utf8');
  return main + '\n\n' + safety;
}

// One call to the model. Returns plain text, or '' if anything goes wrong.
// (Empty text makes checks.safeReply show the friendly fallback.)
async function callModel({ system, messages, maxTokens }) {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens || 1024,
      system,
      messages,
      output_config: { effort: 'low' }, // short chat replies; low effort keeps them quick
    });
    if (response.stop_reason === 'refusal') return '';
    return response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
  } catch (err) {
    console.error('[agents] API error:', err.message || err);
    return '';
  }
}

function recordContext(record) {
  return '\n\n## Admissions interview record (read only, never shown to the learner)\n' + JSON.stringify(record, null, 2);
}

// ---------- Intake agent ----------

async function intakeTurn({ record, answers, skipped, lastAnswer, lastSkipped, nextQuestion, questionIndex }) {
  if (MOCK_MODE) {
    const ack = questionIndex === 0 || !nextQuestion ? '' : mock.intakeAck(lastSkipped, questionIndex, lastAnswer) + ' ';
    const body = nextQuestion ? nextQuestion.mock(record) : intake.WRAP_UP_MOCK;
    return checks.safeReply('intake', ack + body);
  }
  const system = loadCharter('intake') + recordContext(record) + '\n\n## Answers so far\n' + JSON.stringify({ answers, skipped }, null, 2);
  let user;
  if (questionIndex === 0) {
    user = `Start the conversation. Topic: ${nextQuestion.topic}. Write one to three short sentences. Do not greet at length; the learner already saw an intro. Ask one question only.`;
  } else if (nextQuestion) {
    user = (lastSkipped ? 'The learner skipped the last question.' : `The learner replied: "${lastAnswer}"`) +
      `\nNext topic: ${nextQuestion.topic}.\nWrite one to three short sentences: briefly acknowledge, then ask about the next topic in plain, warm words. Ask one question only.`;
  } else {
    user = (lastSkipped ? 'The learner skipped the last question.' : `The learner replied: "${lastAnswer}"`) +
      '\nThere are no more questions. Write a warm two-sentence wrap-up: thank them, say their career coach will read this before they meet, and that next they will pick a meeting time.';
  }
  const text = await callModel({ system, messages: [{ role: 'user', content: user }], maxTokens: 400 });
  return checks.safeReply('intake', text);
}

async function intakeProfile({ record, answers, skipped }) {
  const fallback = intake.buildProfile(record, answers);
  if (MOCK_MODE) return fallback;
  const system = loadCharter('intake') + recordContext(record);
  const user =
    'Using the record and these intake answers, write the learner profile as JSON only, no other text. ' +
    'Keys: summary (two plain sentences), barriers (array of {type, detail}; type is one of childcare, transportation, technology, work schedule, finances, other), ' +
    'worries (string), timing (string), supportPreferences (string). No scores, rankings, or admission recommendations.\n\n' +
    'Answers: ' + JSON.stringify(answers) + '\nSkipped questions: ' + JSON.stringify(skipped);
  const text = await callModel({ system, messages: [{ role: 'user', content: user }], maxTokens: 800 });
  try {
    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    if (!json.summary || !Array.isArray(json.barriers)) throw new Error('missing keys');
    return json;
  } catch (err) {
    console.error('[agents] profile JSON not usable, using code-built profile');
    return fallback;
  }
}

// ---------- Learner coach agent ----------

const FEATURE_GUIDE = {
  checkin: 'The learner tapped Check-in. Ask how things are going and help them name one small next step.',
  project: 'The learner tapped Practice explaining a project. Help them describe something they built or fixed in plain language, then give one or two specific suggestions.',
  interview: 'The learner tapped Mock interview. Ask one common interview question at a time and give short, specific, kind feedback on their answers.',
  networking: 'The learner tapped Networking practice. Play someone they might meet at an event, then step out of the role and give feedback.',
  general: 'Free conversation. Help, and offer one of the four practice options if useful.',
};

async function coachReply({ learner, feature, text }) {
  const planApproved = !!(learner.plan && learner.plan.status === 'Approved');
  const history = learner.coachChat.slice(-20);
  if (MOCK_MODE) {
    const turnsInFeature = history.filter((m) => m.role === 'learner' && m.feature === feature).length;
    return checks.safeReply('learner-coach', mock.coachReply({ feature, text, turnsInFeature, planApproved }));
  }
  const planText = planApproved
    ? '\n\n## Approved plan\n' + JSON.stringify(learner.plan, null, 2)
    : '\n\n## Plan status\nThe plan is still being reviewed by the career coach. If asked, say so.';
  const system =
    loadCharter('learner-coach') +
    '\n\n## Learner profile (from intake)\n' + JSON.stringify(learner.intake.profile, null, 2) +
    planText +
    '\n\n## Current mode\n' + (FEATURE_GUIDE[feature] || FEATURE_GUIDE.general);
  const messages = history.map((m) => ({ role: m.role === 'learner' ? 'user' : 'assistant', content: m.text }));
  messages.push({ role: 'user', content: text });
  // The API requires turns to alternate; merge any repeated roles.
  const merged = [];
  messages.forEach((m) => {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += '\n' + m.content;
    else merged.push({ ...m });
  });
  if (merged[0].role !== 'user') merged.shift();
  const reply = await callModel({ system, messages: merged, maxTokens: 600 });
  return checks.safeReply('learner-coach', reply);
}

module.exports = { MOCK_MODE, MODEL, intakeTurn, intakeProfile, coachReply, loadCharter, callModel };
