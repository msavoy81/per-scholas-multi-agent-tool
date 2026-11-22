// admissions.js: shows one learner's interview record and the "Send welcome" button.

const story = storyState(); // guided demo: only the story learner, no tabs
let currentId = story ? story.learnerId : (qs('id') || 'S1');

async function loadTabs() {
  if (story) { document.getElementById('tabs').style.display = 'none'; return; }
  const list = await api('/api/admissions');
  const tabs = document.getElementById('tabs');
  tabs.innerHTML = '';
  list.forEach((l) => {
    tabs.appendChild(el('button', {
      class: 'tab' + (l.id === currentId ? ' active' : ''),
      text: l.label + (l.welcomeSent ? ' ✓' : ''),
      onclick: () => { currentId = l.id; history.replaceState(null, '', '?id=' + l.id); loadTabs(); loadRecord(); },
    }));
  });
}

function field(label, value) {
  return [el('dt', { text: label }), el('dd', { text: value || '—' })];
}

async function loadRecord() {
  const content = document.getElementById('content');
  content.innerHTML = '<p class="muted">Loading…</p>';
  const d = await api('/api/admissions/' + currentId);
  const r = d.record;

  const barriers = el('div', {}, r.barriersMentioned.length
    ? r.barriersMentioned.map((b) => el('span', { class: 'barrier', text: b }))
    : [el('span', { class: 'muted', text: 'None mentioned' })]);

  const recordCard = el('div', { class: 'card' }, [
    el('div', { class: 'row', style: 'justify-content: space-between' }, [
      el('h2', { text: d.label + ' · ' + d.shortDescription }),
      el('span', { class: 'pill grey', text: 'Fictional sample' }),
    ]),
    el('dl', { class: 'record' }, [
      ...field('Interview date', r.interviewDate),
      ...field('Program track', r.track),
      ...field('Background', r.background),
      ...field('Why now', r.whyNow),
      ...field('Schedule conversation', r.scheduleConversation),
      el('dt', { text: 'Barriers mentioned' }), el('dd', {}, [barriers]),
      ...field('Interviewer notes', r.interviewerNotes),
    ]),
  ]);

  const decisionCard = el('div', { class: 'card' }, [
    el('h3', { text: 'Decision' }),
    el('div', { class: 'box teal' }, [
      el('p', {}, [el('span', { class: 'pill', text: r.decision.status })]),
      el('p', { class: 'small', text: 'Decided by: ' + r.decision.decidedBy }),
      el('p', { class: 'small', text: 'Decided on: ' + r.decision.decidedOn }),
      el('p', { class: 'small muted', text: 'Career coach joined the interview: ' + (r.decision.careerCoachJoinedInterview ? 'Yes' : 'No') }),
    ]),
  ]);

  const sharedCard = el('div', { class: 'card' }, [
    el('h3', { text: 'Shared with' }),
    el('div', { class: 'box' }, d.sharedWith.map((s) => el('p', { class: 'small', style: 'margin:4px 0' }, [
      el('strong', { text: s.who + ': ' }), s.access,
    ]))),
  ]);

  const sent = d.welcomeSent;
  const sendButton = el('button', {
    class: 'btn primary', text: sent ? 'Welcome sent ✓' : 'Send welcome',
    onclick: async () => {
      await api('/api/admissions/' + currentId + '/send-welcome', 'POST');
      loadTabs(); loadRecord();
      storyRecheck();
    },
  });
  sendButton.disabled = sent;
  const welcomeCard = el('div', { class: 'card' }, [
    el('h3', { text: 'Start the learner flow' }),
    el('p', { class: 'muted small', text: sent
      ? 'Welcome sent. The learner can now open the learner view. Status: ' + d.status + '.'
      : 'Sends the welcome message that starts the intake conversation. A working copy is created for the learner flow; this record stays as it is.' }),
    el('div', { class: 'row' }, [
      sendButton,
      sent ? el('a', { class: 'btn', href: '/learner.html?id=' + currentId, text: 'Open learner view →' }) : el('span'),
    ]),
  ]);

  // Guided demo: a clear success box instead of "Welcome sent ✓", and no link
  // out to the learner view (the story bar's Next goes there).
  const storyWelcomeCard = story && el('div', { class: 'card' }, [
    el('h3', { text: 'Start the learner flow' }),
    sent
      ? el('div', { class: 'box teal story-success' }, [
        el('strong', { text: '✓ Welcome sent to ' + d.label }),
        el('p', { class: 'small', text: 'It is on its way to their phone. The admissions record stays as it is. Click Next in the bar above to continue.' }),
      ])
      : el('p', { class: 'muted small', text: 'Sends the welcome message that starts the intake conversation. A working copy is created for the learner flow; this record stays as it is.' }),
    sent ? null : el('div', { class: 'row' }, [sendButton]),
  ]);

  content.innerHTML = '';
  const grid = el('div', { class: 'grid two' }, [decisionCard, sharedCard]);
  content.appendChild(recordCard);
  content.appendChild(grid);
  content.appendChild(storyWelcomeCard || welcomeCard);
}

loadTabs();
loadRecord();
