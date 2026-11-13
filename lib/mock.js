// mock.js: pre-written replies used when no API key is set ("mock mode").
// They are realistic enough to click through every screen without the AI.

const checks = require('./checks');

const ACKS = [
  'Thanks for sharing that.',
  'Got it, thank you.',
  'That helps, thanks.',
  'Thank you. That makes sense.',
];

function intakeAck(skipped, index, lastAnswer) {
  if (skipped) return 'No problem, we can skip that.';
  if (checks.hasCrisisWords(lastAnswer)) {
    return "Thank you for trusting me with that. I'm an AI, and you deserve a person right now: please call or text 988 (the Suicide & Crisis Lifeline in the US). Your career coach will see this and reach out. We can keep going if you'd like.";
  }
  return ACKS[index % ACKS.length];
}

// Coach chat replies, grouped by feature. The reply chosen depends on how many
// turns the learner has had in that feature, so the conversation moves forward.
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
    "Okay. What would be most useful right now: a quick check-in, practicing how you describe a project, a mock interview question, or a networking conversation?",
  ],
};

const INTRO_WORDS = ['introduce', 'introduction', 'vouch', 'reference', 'recommend me', 'refer me', 'connect me', 'put in a word'];
const PAUSE_WORDS = ['pause', 'quit', 'drop out', 'dropping out', 'leave the program', 'leaving the program', 'give up', 'giving up', 'stop the program', 'withdraw'];
const PLAN_WORDS = ['my plan', 'the plan', 'weekly goals', 'what should i do this week'];

const CRISIS_REPLY =
  "I'm really glad you told me, and I'm sorry things feel this heavy. I'm an AI, and you deserve a person right now. " +
  'Please call or text 988 (the Suicide & Crisis Lifeline in the US). Your career coach is here for you too; the button at the top lets them know. ' +
  "I'm still here if you want to keep talking.";

function coachReply({ feature, text, turnsInFeature, planApproved }) {
  const lower = String(text || '').toLowerCase();
  if (checks.hasCrisisWords(lower)) return CRISIS_REPLY;
  if (INTRO_WORDS.some((w) => lower.includes(w))) {
    return 'I can help you prepare for that conversation, but an introduction or someone vouching for you comes from a person. Your career coach can help with that. Tap "Talk to my career coach" and I can also help you draft what you want to ask for.';
  }
  if (PAUSE_WORDS.some((w) => lower.includes(w))) {
    return "Thank you for telling me. Pausing or leaving is a real decision, and you deserve a person for it. Your career coach can talk through options with you, including ones you may not know about. Would you like to reach them now with the button at the top? In the meantime, what is making this feel hard right now?";
  }
  if (PLAN_WORDS.some((w) => lower.includes(w))) {
    return planApproved
      ? 'Your plan is approved. This week the goal is to settle into the routine and finish the first set of lessons. Want to pick one small step for today?'
      : 'Your plan is being reviewed by your career coach right now. Once they approve it, I can walk through it with you week by week. In the meantime, want to practice something?';
  }
  const list = COACH[feature] || COACH.general;
  return list[Math.min(turnsInFeature, list.length - 1)];
}

module.exports = { intakeAck, coachReply };
