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
//   hint      (optional) shown in the story bar until the step's action is done
//   done      (optional) shown in the story bar once it is done. {id} becomes the learner id.

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
      hint: 'Send the welcome to continue.',
      done: 'Welcome sent to Learner {id}. Click Next to see it on their phone.',
    }],
  },
  {
    title: 'How they find out',
    steps: [{
      caption: "The welcome arrives on the learner's phone.",
      who: 'The learner chooses whether to start.',
      page: 'learner',
      hint: "Tap Let's start to continue.",
    }],
  },
  {
    title: 'The first time',
    steps: [
      {
        caption: 'The learner has a short intake conversation with the AI, then books their career coach. Every question is optional.',
        who: 'The learner chooses what to share.',
        page: 'learner',
        hint: 'Finish the intake and book a time to continue.',
        done: 'Meeting booked. Click Next to see what the career coach sees.',
      },
      {
        caption: 'The career coach reviews the plan the AI drafted from the intake.',
        who: 'The plan stays Draft until the coach approves it.',
        page: 'coach',
        hint: 'Approve the plan to continue. You can edit it first.',
        done: 'Plan approved. Click Next to see what happens when a week goes quiet.',
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
      hint: 'Click Skip ahead one week to continue.',
      done: "Look for the watcher's flag below, then click Next.",
    }],
  },
  {
    title: 'When it becomes habit',
    steps: [{
      caption: 'Weekly check-ins, project help, mock interviews, and networking practice with the AI coach.',
      who: 'The learner can reach a human any time with Talk to my career coach.',
      page: 'learner',
      hint: 'Try a message, for example ask for a practice interview question.',
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
