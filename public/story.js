// story.js: the guided demo's words and learners. Edit this file to change them.
// No other file needs to change. Keep the quote marks and commas as they are.
//
// STORY_LEARNERS: the learners offered on the home page under "Start the demo".
//   id    must match a sample learner (S1 to S4).
//   card  is the short description shown on the home page card.
//
// FRAMES: the screens of the story, in order. Each frame has a title and one or
// more steps. Each step has:
//   caption   one line about what is happening
//   who       the "Who decides here" line
//   page      which screen opens: 'admissions', 'learner', 'coach', or 'summary'
//   skipWeek  (optional) true shows the "Skip ahead one week" button

const STORY_LEARNERS = [
  { id: 'S2', card: 'New to tech' },
  { id: 'S3', card: 'Has prior tech experience' },
];

const FRAMES = [
  {
    title: 'Who they are',
    steps: [{
      caption: "Staff read the learner's admissions interview record and send the welcome.",
      who: 'Staff decided admission. The AI can read this record but never change it.',
      page: 'admissions',
    }],
  },
  {
    title: 'How they find out',
    steps: [{
      caption: "The welcome arrives on the learner's phone.",
      who: 'The learner chooses whether to start.',
      page: 'learner',
    }],
  },
  {
    title: 'The first time',
    steps: [
      {
        caption: 'The learner has a short intake conversation with the AI, then books their career coach. Every question is optional.',
        who: 'The learner chooses what to share.',
        page: 'learner',
      },
      {
        caption: 'The career coach reviews the plan the AI drafted from the intake.',
        who: 'The plan stays Draft until the coach approves it.',
        page: 'coach',
      },
    ],
  },
  {
    title: 'When it gets hard',
    steps: [{
      caption: 'A quiet week passes. The watcher spots it and flags it to the coach with the exact quote, a confidence level, and another possible explanation.',
      who: 'The coach decides what to do. The watcher never contacts the learner.',
      page: 'coach',
      skipWeek: true,
    }],
  },
  {
    title: 'When it becomes habit',
    steps: [{
      caption: 'Weekly check-ins, project help, mock interviews, and networking practice with the AI coach.',
      who: 'The learner can reach a human any time with Talk to my career coach.',
      page: 'learner',
    }],
  },
  {
    title: 'What changes for them',
    steps: [{
      caption: 'The learner heads into the job search prepared, with a coach who already knows their story.',
      who: 'People made every key decision. The AI supported them.',
      page: 'summary',
    }],
  },
];
