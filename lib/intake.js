// intake.js: the intake conversation's question list. Plain code decides which
// question comes next and tracks skips. The AI (or mock) phrases the words.

const QUESTIONS = [
  {
    id: 'confirm',
    topic: 'confirm where they are coming from and why they are enrolling, based on what they shared in the interview',
    mock: (record) =>
      `From your interview, I have that you're coming from ${record.backgroundShort}, and that ${record.whyNowShort}. Does that still sound right? Anything you'd add?`,
  },
  {
    id: 'barriers',
    topic: 'what could get in the way during the program: childcare, transportation, technology (a laptop or internet), work schedule, or finances',
    mock: () =>
      'Is there anything that could get in the way during the program? For example childcare, getting to class, a laptop or internet, your work schedule, or money. Anything counts.',
  },
  {
    id: 'worries',
    topic: 'what, if anything, worries them about starting',
    mock: () => "What, if anything, worries you about starting? It's normal to have a few.",
  },
  {
    id: 'timing',
    topic: 'whether now feels like a good time to start',
    mock: () => 'Does now feel like a good time to start? Honest answers help us support you.',
  },
  {
    id: 'support',
    topic: 'how they like to be supported, for example short texts, calls, or a weekly plan',
    mock: () => 'Last one: how do you like to be supported? Short texts, a call now and then, a clear weekly plan, something else?',
  },
];

const INTRO =
  "Hi, I'm the intake assistant, an AI. Congratulations on your acceptance! " +
  'I have a few quick, optional questions so your career coach and AI coach can support you from day one. ' +
  'What you share here is used by your AI coach and your career coach, and your later chats with the AI coach may be reviewed by your career coach. ' +
  'Skip anything you like.';

const WRAP_UP_MOCK =
  "That's everything. Thank you for sharing. Your career coach will read this before you meet, so you won't have to start from scratch. " +
  'Next, pick a time for your first meeting with them.';

const BARRIER_KEYWORDS = {
  childcare: ['childcare', 'child care', 'daycare', 'kids', 'my son', 'my daughter', 'pickup', 'pick up', 'babysit'],
  transportation: ['transportation', 'bus', 'train', 'car', 'ride', 'commute', 'drive', 'get to class'],
  technology: ['laptop', 'computer', 'internet', 'wifi', 'wi-fi', 'device', 'freezes', 'slow'],
  'work schedule': ['shift', 'shifts', 'work schedule', 'my job', 'hours', 'evenings', 'weekends'],
  finances: ['money', 'rent', 'bills', 'finances', 'financial', 'income', 'unemployment', 'pay'],
};

// True if `word` appears in `text` as a whole word or phrase (so "childcare"
// does not count as "car", and "quite" does not count as "quit").
function hasWord(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('\\b' + escaped + '\\b', 'i').test(String(text || ''));
}

// Code-built profile. Used in mock mode, and as a safety net in live mode.
function buildProfile(record, answers) {
  const text = Object.values(answers).join(' ');
  const barriers = [];
  Object.entries(BARRIER_KEYWORDS).forEach(([type, words]) => {
    if (words.some((w) => hasWord(text, w))) {
      barriers.push({ type, detail: 'Mentioned during intake' });
    }
  });
  (record.barriersMentioned || []).forEach((type) => {
    if (!barriers.find((b) => b.type === type)) barriers.push({ type, detail: 'Mentioned during admissions interview' });
  });
  return {
    summary: `Coming from ${record.backgroundShort}. Enrolling in ${record.track} because ${record.whyNowShort}.`,
    barriers,
    worries: answers.worries || '(skipped)',
    timing: answers.timing || '(skipped)',
    supportPreferences: answers.support || '(skipped)',
  };
}

module.exports = { QUESTIONS, INTRO, WRAP_UP_MOCK, BARRIER_KEYWORDS, hasWord, buildProfile };
