// mock.js: pre-written replies used in mock mode (no API key, or `npm run mock`).
// They are realistic enough to click through every screen without the AI.

const checks = require('./checks');
const { BARRIER_KEYWORDS, hasWord } = require('./intake');

// ======================= Intake agent =======================

const ACKS = ['Thanks for sharing that.', 'Got it, thank you.', 'That helps, thanks.', 'Thank you. That makes sense.'];

function intakeAck(skipped, index, lastAnswer) {
  if (skipped) return 'No problem, we can skip that.';
  if (checks.hasCrisisWords(lastAnswer)) {
    return "Thank you for trusting me with that. I'm an AI, and you deserve a person right now: please call or text 988 (the Suicide & Crisis Lifeline in the US). Your career coach will see this and reach out. We can keep going if you'd like.";
  }
  return ACKS[index % ACKS.length];
}

// ======================= Learner coach agent =======================

const COACH = {
  checkin: [
    "Good to see you. How is this week going so far, somewhere between 'rough' and 'great'? One sentence is plenty.",
    'Thanks for being honest. What is one small thing that would make tomorrow a little easier?',
    "That sounds doable. I'll check in again soon. If you'd like your career coach to know any of this, tap the button at the top.",
  ],
  project: [
    "Let's practice. Pick one thing you built or fixed, even something small. In two or three sentences: what was the problem, what did you do, and what happened?",
    "Nice. You named the problem clearly, which is the part most people skip. One tweak: end with the result, even a small one, like 'and it worked the first time' or 'and my manager started using it'. Try saying the whole thing out loud once.",
    "That's tighter already. Want to add one line about what you'd do differently next time? Interviewers love that.",
  ],
  interview: [
    "Here's a common one: 'Tell me about a time you solved a problem with limited information.' Take your time and answer in a few sentences.",
    'Good answer. Two things worked: you named the problem and the action you took. One tweak: finish with what happened after. Want another question?',
    "Next one: 'Why do you want to work in tech?' Keep it to three sentences and make one of them about something you actually did.",
  ],
  networking: [
    "Let's practice a conversation at a meetup. I'll play someone who works in IT support. 'Hi, I'm new here too. What brings you tonight?' Your turn.",
    "(Still in role) 'Oh nice, what are you learning right now?' Try answering with one specific thing, not the whole program.",
    "Stepping out of the role: that was natural. You asked me a question back, which keeps it going. Next time, end with 'Could I stay in touch?' That one line is where introductions come from.",
  ],
  general: [
    "I'm here. Tell me more, or pick one of the practice options below.",
    'Okay. What would be most useful right now: a quick check-in, practicing how you describe a project, a mock interview question, or a networking conversation?',
  ],
};

const INTRO_WORDS = ['introduce', 'introduction', 'vouch', 'reference', 'recommend me', 'refer me', 'connect me', 'put in a word'];
const PAUSE_WORDS = ['pause', 'pausing', 'quit', 'quitting', 'drop out', 'dropping out', 'leave the program', 'leaving the program', 'give up', 'giving up', 'withdraw'];
const PLAN_WORDS = ['my plan', 'the plan', 'weekly goals', 'this week'];

const CRISIS_REPLY =
  "I'm really glad you told me, and I'm sorry things feel this heavy. I'm an AI, and you deserve a person right now. " +
  'Please call or text 988 (the Suicide & Crisis Lifeline in the US). Your career coach is here for you too; the button at the top lets them know. ' +
  "I'm still here if you want to keep talking.";

function coachReply({ feature, text, turnsInFeature, plan, demoWeek }) {
  const planApproved = !!(plan && plan.status === 'Approved');
  if (checks.hasCrisisWords(text)) return CRISIS_REPLY;
  if (INTRO_WORDS.some((w) => hasWord(text, w))) {
    return 'I can help you prepare for that conversation, but an introduction or someone vouching for you comes from a person. Your career coach can help with that. Tap "Talk to my career coach" and I can also help you draft what you want to ask for.';
  }
  if (PAUSE_WORDS.some((w) => hasWord(text, w))) {
    return "Thank you for telling me. Pausing or leaving is a real decision, and you deserve a person for it. Your career coach can talk through options with you, including ones you may not know about. Would you like to reach them now with the button at the top? In the meantime, what is making this feel hard right now?";
  }
  if (PLAN_WORDS.some((w) => hasWord(text, w))) {
    if (!planApproved) {
      return 'Your plan is being reviewed by your career coach right now. Once they approve it, I can walk through it with you week by week. In the meantime, want to practice something?';
    }
    const week = plan.weeks[Math.min(demoWeek || 0, plan.weeks.length - 1)];
    return `Your plan is approved. Right now you're in "${week.label}": ${week.goal} Want to pick one small step for today?`;
  }
  const list = COACH[feature] || COACH.general;
  return list[Math.min(turnsInFeature, list.length - 1)];
}

// ======================= Plan and prep agent =======================

const TRACK_PROJECT = {
  'IT Support': 'a tech problem you solved, like a support ticket',
  Cybersecurity: 'a security lab you completed',
  'Software Engineering': 'an app or feature you built',
};

const BARRIER_PREP = {
  childcare: 'Line up a backup plan for sick days and pickup days.',
  transportation: 'Plan your route to class and a backup way to get there.',
  technology: 'Test your laptop with the course tools. Tell your coach if it struggles.',
  'work schedule': 'Share your work schedule with your coach so the plan fits around it.',
  finances: 'Bring any money questions to your career coach early.',
};

const BARRIER_QUESTIONS = {
  childcare: 'What is your backup plan if your kids are sick on a class day? Could we plan that together?',
  transportation: 'How will you get to class on days your usual ride is not available?',
  technology: 'Is your laptop holding up? What happens when it acts up during a lesson?',
  'work schedule': 'How do your work shifts fit around class and homework?',
  finances: 'What would make the money side of the program feel more manageable?',
};

const GENERAL_QUESTIONS = [
  'What does a good week in the program look like for you?',
  'Who is cheering you on, and who could you call on a hard week?',
  'When you picture your first tech job, what does it look like?',
  'How would you like me to check in with you?',
];

const SKIP_LABELS = {
  confirm: 'where they are coming from',
  barriers: 'what could get in the way',
  worries: 'worries',
  timing: 'whether now is a good time',
  support: 'how they like to be supported',
};

function draftWeeks(record, profile) {
  const barriers = (profile.barriers || []).map((b) => b.type);
  const prep = ['Meet your career coach.'].concat(barriers.map((b) => BARRIER_PREP[b]).filter(Boolean)).join(' ');
  const project = TRACK_PROJECT[record.track] || 'something you built or fixed';
  return [
    { label: 'Before training starts', goal: prep },
    { label: 'Week 1', goal: 'Settle into the routine. Check in with your AI coach at least three times.' },
    { label: 'Week 2', goal: 'Name one thing going well and one thing that is hard. Talk it through with your career coach.' },
    { label: 'Weeks 3 to 4', goal: `Practice explaining ${project}, out loud and in plain language.` },
    { label: 'Middle of the program', goal: 'Start networking practice. Have two short conversations with people who work in the field.' },
    { label: 'Final weeks', goal: 'Mock interviews with your AI coach and your career coach. Polish your resume.' },
    { label: 'Job search', goal: 'Apply with your coach. Ask about introductions and people who can vouch for you.' },
  ];
}

function draftBrief(record, profile, skipped, notes) {
  const barriers = profile.barriers || [];
  const shared = [
    `Worries: ${profile.worries}`,
    `Timing: ${profile.timing}`,
    `Support they prefer: ${profile.supportPreferences}`,
  ].concat(barriers.map((b) => `Barrier: ${b.type} (${b.detail.toLowerCase()})`));
  if (skipped && skipped.length) shared.push('Skipped in intake: ' + skipped.map((s) => SKIP_LABELS[s] || s).join(', '));

  const first = [];
  const timing = String(profile.timing || '').toLowerCase();
  if (/unsure|not sure|maybe|don't know|dont know|skipped/.test(timing)) first.push('Timing: they may not be sure now is the right time to start.');
  if (barriers.some((b) => b.type === 'finances')) first.push('Money came up. Connect them with the right staff for benefits or financial questions.');
  if ((notes || []).some((n) => n.type === 'crisis_words')) first.push('Crisis words came up in a chat. Check in personally.');

  const questions = barriers.map((b) => BARRIER_QUESTIONS[b.type]).filter(Boolean).concat(GENERAL_QUESTIONS);
  return {
    whoTheyAre: `${record.track} learner. ${profile.summary}`,
    whatTheyShared: shared,
    worthAskingFirst: first,
    questions: checks.clampQuestions(questions.slice(0, 5), GENERAL_QUESTIONS),
  };
}

// ======================= Watcher agent =======================

const ENGAGEMENT = ['checkin', 'project', 'interview', 'networking', 'chat_message', 'coach_request'];
const WORRY_WORDS = ['behind', 'overwhelmed', 'stressed', 'worried', 'nervous', 'confused', 'struggling', "can't keep up", 'cant keep up', 'too fast', 'lost'];

function splitSentences(text) {
  return String(text).split(/(?<=[.!?])\s+/).filter(Boolean);
}

function firstSentenceWith(text, words) {
  return splitSentences(text).find((s) => words.some((w) => hasWord(s, w))) || null;
}

// Decide whether one learner message is worth a heads up. Highest concern wins.
function classifyMessage(text) {
  if (checks.hasCrisisWords(text)) {
    const sentence = splitSentences(text).find((s) => checks.hasCrisisWords(s)) || text;
    return { summary: 'Crisis words in chat (988 information was shown)', sentence, confidence: 'high', other: 'It may be a figure of speech after a bad day, but this needs a personal check either way.' };
  }
  const leaving = firstSentenceWith(text, PAUSE_WORDS);
  if (leaving) return { summary: 'Talked about pausing or leaving', sentence: leaving, confidence: 'high', other: 'They may be venting after a hard day rather than planning to leave.' };
  for (const [type, words] of Object.entries(BARRIER_KEYWORDS)) {
    const s = firstSentenceWith(text, words);
    if (s) return { summary: `Mentioned a possible ${type} barrier`, sentence: s, confidence: 'medium', other: 'It may already be handled. Mentioning something is not the same as needing help.' };
  }
  const worry = firstSentenceWith(text, WORRY_WORDS);
  if (worry) return { summary: 'Sounded worried or behind', sentence: worry, confidence: 'low', other: 'Feeling behind early on is common and often passes on its own.' };
  return null;
}

// The mock watcher: plain rules over the activity log and the learner's own messages.
// Each proposal has a stable `key` so the same thing is never flagged twice.
function watchRules(learner) {
  const out = [];
  const activity = learner.activity || [];
  // Don't pile up the same kind of heads up while the coach hasn't decided on the last one.
  const openKinds = new Set((learner.flags || []).filter((f) => f.status === 'open').map((f) => String(f.key).split(':')[0]));

  // 1. Missed check-ins in a row
  const relevant = activity
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.type === 'checkin_missed' || ENGAGEMENT.includes(a.type))
    .sort((x, y) => x.a.at.localeCompare(y.a.at));
  let streak = 0;
  for (let j = relevant.length - 1; j >= 0 && relevant[j].a.type === 'checkin_missed'; j--) streak++;
  if (streak >= 2 && !openKinds.has('missed')) {
    const last = relevant[relevant.length - 1];
    out.push({
      key: 'missed:' + last.i,
      summary: `${streak} check-ins missed in a row`,
      evidence: last.a.detail,
      confidence: streak >= 3 ? 'high' : 'medium',
      otherExplanation: 'They may be busy with lessons or work and checking in less, not struggling.',
    });
  }

  // 2. Intake or booking still unfinished after a week
  activity.forEach((a, i) => {
    if (a.type !== 'intake_pending' && a.type !== 'booking_pending') return;
    if (openKinds.has('pending')) return;
    out.push({
      key: 'pending:' + i,
      summary: a.type === 'intake_pending' ? 'Intake still not finished a week after the welcome' : 'First coach meeting still not booked',
      evidence: a.detail,
      confidence: 'medium',
      otherExplanation: 'They may have been busy, or may prefer to talk to a person rather than a chat.',
    });
  });

  // 3. Worries, barriers, or talk of leaving in the learner's own messages
  (learner.coachChat || []).filter((m) => m.role === 'learner').forEach((m) => {
    const hit = classifyMessage(m.text);
    if (!hit) return;
    out.push({ key: 'chat:' + hit.sentence, summary: hit.summary, evidence: hit.sentence, confidence: hit.confidence, otherExplanation: hit.other });
  });
  return out;
}

module.exports = { intakeAck, coachReply, draftWeeks, draftBrief, watchRules };
