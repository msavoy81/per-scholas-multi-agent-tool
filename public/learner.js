// learner.js: the phone-style learner flow.
// pick a learner -> welcome -> intake chat -> book a meeting -> AI coach chat

const main = document.getElementById('main');
const story = storyState(); // guided demo: each step shows its own screen (see loadStory)
let learnerId = qs('id');
let me = null;
let currentFeature = 'general';

function setWho(text) { document.getElementById('who').textContent = text; }

function bubble(role, text) {
  return el('div', { class: 'bubble ' + role, text });
}

function crisisBubble(text) {
  const b = el('div', { class: 'bubble crisis' }, [
    el('strong', { text: 'If things feel heavy right now' }),
    el('p', { style: 'margin:6px 0 0', text: text }),
    el('button', { class: 'btn small primary', style: 'margin-top:8px', text: 'Talk to my career coach', onclick: () => openModal('crisis') }),
  ]);
  return b;
}

// ---------- 1. Pick a sample learner ----------
async function showPicker() {
  setWho('');
  const list = await api('/api/learners');
  main.innerHTML = '';
  main.appendChild(el('h1', { text: 'Who are you today?' }));
  main.appendChild(el('p', { class: 'muted', text: 'Pick a sample learner. These are fictional.' }));
  if (!list.length) {
    main.appendChild(el('div', { class: 'card' }, [
      el('p', { text: 'No welcomes have been sent yet.' }),
      el('a', { class: 'btn primary', href: '/admissions.html', text: 'Go to admissions and send a welcome' }),
    ]));
    return;
  }
  list.forEach((l) => {
    main.appendChild(el('button', {
      class: 'btn block slot', text: l.label + ' · ' + l.shortDescription,
      onclick: () => { learnerId = l.id; history.replaceState(null, '', '?id=' + l.id); load(); },
    }));
  });
  main.appendChild(el('p', { class: 'muted small', text: 'Not listed? Ask admissions to send the welcome first.' }));
}

// ---------- 2. Welcome ----------
function showWelcome() {
  main.innerHTML = '';
  main.appendChild(el('div', { class: 'card' }, [
    el('h1', { text: 'Welcome, and congratulations!' }),
    el('p', { text: "You're in. Before training starts, we'd like to set you up with two kinds of support:" }),
    el('p', {}, [el('strong', { text: 'Your career coach' }), ', a person who will meet you early and shape a plan with you.']),
    el('p', {}, [el('strong', { text: 'Your AI coach' }), ', available any time for check-ins, practice, and prep.']),
    el('p', { class: 'muted small', text: 'Next is a short, optional conversation with an AI intake assistant. It takes about five minutes. You can skip any question.' }),
    el('button', { class: 'btn primary block', text: "Let's start", onclick: startIntake }),
  ]));
}

// ---------- 3. Intake conversation ----------
let intakeState = null;

async function startIntake() {
  main.innerHTML = '<p class="muted">One moment…</p>';
  intakeState = await api('/api/learners/' + learnerId + '/intake/start', 'POST');
  if (story && storyKey(story) === '2.1') { location.href = storyUrl(story.learnerId, 3, 1); return; } // frame 3 is the intake
  renderIntake();
}

function renderIntake() {
  main.innerHTML = '';
  const wrap = el('div', { class: 'chat-wrap' });
  wrap.appendChild(el('div', { class: 'chat-notice', text: 'AI intake assistant · Every question is optional · Shared with your career coach and AI coach' }));
  const chat = el('div', { class: 'chat' });
  intakeState.messages.forEach((m) => {
    chat.appendChild(bubble(m.role === 'learner' ? 'learner' : 'agent', m.text));
    if (m.crisis) chat.appendChild(crisisBubble(CRISIS_TEXT));
  });
  wrap.appendChild(chat);

  if (intakeState.done) {
    wrap.appendChild(el('button', { class: 'btn primary block', text: 'Pick a meeting time →', onclick: load }));
  } else {
    wrap.appendChild(el('div', { class: 'progress', text: 'Question ' + (intakeState.step + 1) + ' of ' + intakeState.total }));
    const ta = el('textarea', { placeholder: 'Type your answer…', rows: '2' });
    const send = el('button', { class: 'btn primary', text: 'Send', onclick: () => answer(ta.value, false) });
    const skip = el('button', { class: 'btn', text: 'Skip', onclick: () => answer('', true) });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); answer(ta.value, false); } });
    wrap.appendChild(el('div', { class: 'composer' }, [ta, send, skip]));
    setTimeout(() => ta.focus(), 50);
  }
  main.appendChild(wrap);
  window.scrollTo(0, document.body.scrollHeight);
  document.fonts.ready.then(() => window.scrollTo(0, document.body.scrollHeight)); // web font can grow the page after the first scroll
}

async function answer(text, skip) {
  if (!skip && !text.trim()) return;
  intakeState.messages.push({ role: 'learner', text: skip ? '(skipped)' : text });
  renderIntake();
  main.querySelector('.chat').appendChild(el('div', { class: 'typing', text: 'typing…' }));
  intakeState = await api('/api/learners/' + learnerId + '/intake/answer', 'POST', skip ? { skip: true } : { text });
  renderIntake();
}

// ---------- 4. Book first meeting ----------
async function showBooking() {
  const { slots } = await api('/api/learners/' + learnerId + '/slots');
  main.innerHTML = '';
  main.appendChild(el('div', { class: 'card' }, [
    el('h1', { text: 'Meet your career coach' }),
    el('p', { text: 'Pick a time for your first meeting. It happens before training starts, so you begin with someone in your corner.' }),
    el('p', { class: 'muted small', text: 'Sample times for the prototype.' }),
    ...slots.map((s) => el('button', { class: 'btn block slot', text: s, onclick: async () => {
      await api('/api/learners/' + learnerId + '/book', 'POST', { slot: s });
      load();
      storyRecheck();
    } })),
  ]));
}

// ---------- 5. AI coach chat ----------
const CRISIS_TEXT = 'You can call or text 988 (the Suicide & Crisis Lifeline in the US) any time, day or night. Your career coach is also here for you.';
const FEATURES = [
  { id: 'checkin', label: 'Check-in', starter: "Here's my check-in for today." },
  { id: 'project', label: 'Explain a project', starter: "I'd like to practice explaining a project." },
  { id: 'interview', label: 'Mock interview', starter: 'Ask me an interview question.' },
  { id: 'networking', label: 'Networking practice', starter: "Let's practice a networking conversation." },
];

// "Save this chat" demo control. Not part of the real tool.
const SAVE_TAGS = ['Great conversation', 'Bug', 'Test'];

function saveChatPanel() {
  const status = el('p', { class: 'muted small', text: '' });
  const note = el('input', { type: 'text', maxlength: '200', placeholder: 'Optional one-line note' });
  const tagButtons = SAVE_TAGS.map((t) => el('button', { class: 'btn small', text: t, onclick: async () => {
    status.textContent = 'Saving…';
    try {
      const r = await api('/api/demo/save-chat/' + learnerId, 'POST', { tag: t, note: note.value });
      status.textContent = 'Saved as "' + t + '": ' + r.name;
    } catch (e) {
      status.textContent = 'Not saved: ' + e.message;
    }
  } }));
  return el('details', { class: 'card demo' }, [
    el('summary', { class: 'demo-tag', text: 'Demo control · Save this chat' }),
    note,
    el('p', { class: 'muted small', text: 'Save as:' }),
    el('div', { class: 'row' }, tagButtons),
    status,
  ]);
}

function renderCoach() {
  main.innerHTML = '';
  const wrap = el('div', { class: 'chat-wrap' });
  if (me.coachChat.length) wrap.appendChild(saveChatPanel());
  wrap.appendChild(el('button', { class: 'btn block coach-btn', text: 'Talk to my career coach', onclick: () => openModal('coach chat') }));
  wrap.appendChild(el('div', { class: 'chat-notice', text: "I'm an AI coach, not a person. Your career coach may review these conversations." }));
  if (me.plan) {
    wrap.appendChild(el('details', { class: 'plan-learner' }, [
      el('summary', { text: 'My plan · approved by my career coach' }),
      el('ol', { class: 'tight' }, me.plan.weeks.map((w) => el('li', {}, [el('strong', { text: w.label + ': ' }), w.goal]))),
    ]));
  }
  if (me.meeting) wrap.appendChild(el('div', { class: 'bubble system', text: 'First coach meeting: ' + me.meeting.slot }));

  const chat = el('div', { class: 'chat', id: 'chat' });
  if (!me.coachChat.length) {
    chat.appendChild(bubble('agent', "Hi! I'm your AI coach. I'm here any time for a check-in, practice explaining your work, mock interview questions, or networking practice. " +
      (me.planStatus === 'Approved' ? 'Your plan is approved, so ask me about it any time.' : 'Your plan is being reviewed by your career coach.') + ' Where would you like to start?'));
  }
  me.coachChat.forEach((m) => {
    chat.appendChild(bubble(m.role === 'learner' ? 'learner' : 'agent', m.text));
    if (m.crisis) chat.appendChild(crisisBubble(CRISIS_TEXT));
  });
  wrap.appendChild(chat);

  wrap.appendChild(el('div', { class: 'chips' }, FEATURES.map((f) => el('button', { class: 'chip', text: f.label, onclick: () => { currentFeature = f.id; sendChat(f.starter); } }))));
  const ta = el('textarea', { placeholder: 'Message your AI coach…', rows: '2', id: 'composer' });
  const send = el('button', { class: 'btn primary', text: 'Send', onclick: () => { sendChat(ta.value); } });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(ta.value); } });
  wrap.appendChild(el('div', { class: 'composer' }, [ta, send]));
  main.appendChild(wrap);
  window.scrollTo(0, document.body.scrollHeight);
  document.fonts.ready.then(() => window.scrollTo(0, document.body.scrollHeight)); // web font can grow the page after the first scroll
}

async function sendChat(text) {
  text = (text || '').trim();
  if (!text) return;
  me.coachChat.push({ role: 'learner', text, feature: currentFeature });
  renderCoach();
  document.getElementById('chat').appendChild(el('div', { class: 'typing', text: 'typing…' }));
  const r = await api('/api/learners/' + learnerId + '/chat', 'POST', { text, feature: currentFeature });
  me.coachChat.push({ role: 'agent', text: r.reply, crisis: r.crisis });
  renderCoach();
}

// ---------- Talk to my career coach ----------
let modalFrom = '';
function openModal(from) { modalFrom = from; document.getElementById('modal').classList.add('on'); }
document.getElementById('modal-no').addEventListener('click', () => document.getElementById('modal').classList.remove('on'));
document.getElementById('modal-yes').addEventListener('click', async () => {
  document.getElementById('modal').classList.remove('on');
  await api('/api/learners/' + learnerId + '/coach-request', 'POST', { from: modalFrom });
  const chat = document.getElementById('chat') || main.querySelector('.chat');
  const note = el('div', { class: 'bubble system', text: "Done. Your career coach has been notified and will reach out to you." });
  if (chat) chat.appendChild(note); else main.appendChild(note);
  window.scrollTo(0, document.body.scrollHeight);
});

// ---------- Guided demo screens ----------
function showNotWelcomed() {
  setWho('');
  main.innerHTML = '';
  main.appendChild(el('div', { class: 'card' }, [
    el('p', { text: "This learner hasn't been welcomed yet. Go back to frame 1 and send the welcome." }),
    el('a', { class: 'btn primary', href: storyUrl(story.learnerId, 1, 1), text: '← Go to frame 1' }),
  ]));
}

// After booking in frame 3, stop here. The AI coach chat is frame 5.
function showBooked() {
  main.innerHTML = '';
  main.appendChild(el('div', { class: 'card' }, [
    el('h1', { text: "You're booked." }),
    el('p', { text: 'Your career coach will read your intake before you meet.' }),
    me.meeting ? el('p', { class: 'muted small', text: 'First coach meeting: ' + me.meeting.slot }) : null,
  ]));
}

// In the story, the screen follows the step, not just the learner's status:
// frame 2 the welcome, frame 3 the intake, booking, or booked card, frame 5 the chat.
async function loadStory() {
  learnerId = story.learnerId;
  try {
    me = await api('/api/learners/' + learnerId + '/me');
  } catch (e) {
    return showNotWelcomed();
  }
  setWho(me.label);
  const key = storyKey(story);
  if (key === '2.1') return showWelcome();
  if (key === '3.1') {
    if (me.status === 'invited') return showWelcome();
    if (me.status === 'intake') { intakeState = await api('/api/learners/' + learnerId + '/intake/start', 'POST'); return renderIntake(); }
    if (me.status === 'booking') return showBooking();
    return showBooked();
  }
  return renderCoach();
}

// ---------- Decide which screen to show ----------
async function load() {
  if (story) return loadStory();
  if (!learnerId) return showPicker();
  try {
    me = await api('/api/learners/' + learnerId + '/me');
  } catch (e) {
    learnerId = null;
    return showPicker();
  }
  setWho(me.label);
  if (me.status === 'invited') return showWelcome();
  if (me.status === 'intake') { intakeState = await api('/api/learners/' + learnerId + '/intake/start', 'POST'); return renderIntake(); }
  if (me.status === 'booking') return showBooking();
  return renderCoach();
}

load();
