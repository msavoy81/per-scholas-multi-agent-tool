// coach.js: the career coach dashboard.
// No ?id= in the address: the list of learners. With ?id=S1: that learner's detail page.

const main = document.getElementById('main');
const learnerId = qs('id');

const STATUS_LABEL = {
  'not started': 'Welcome not sent',
  invited: 'Welcome sent',
  intake: 'In intake',
  booking: 'Booking first meeting',
  active: 'Active',
};
const CONFIDENCE_KIND = { high: 'flag', medium: 'warn', low: 'grey' };
const DECISIONS = [
  { id: 'reach_out', label: "I'll reach out" },
  { id: 'watch', label: 'Keep an eye on it' },
  { id: 'dismiss', label: 'Dismiss' },
];
const DECISION_LABEL = { reach_out: "You'll reach out", watch: 'Keeping an eye on it', dismiss: 'Dismissed' };

function card(title, children, extraClass) {
  return el('section', { class: 'card' + (extraClass ? ' ' + extraClass : '') }, [el('h2', { text: title })].concat(children));
}

function message(text, kind) {
  return el('p', { class: 'small', style: kind === 'error' ? 'color: var(--flag-text)' : 'color: var(--teal-dark)', text });
}

// ======================= Learner list =======================

async function showList() {
  const list = await api('/api/coach/learners');
  main.innerHTML = '';

  main.appendChild(el('div', { class: 'row', style: 'justify-content: space-between' }, [
    el('h1', { text: 'Coach dashboard' }),
    el('a', { class: 'btn small', href: '/api/log.csv', text: 'Export usage log to CSV' }),
  ]));
  main.appendChild(el('p', { class: 'muted', text: 'Your learners, what needs a person, and drafts waiting for your review.' }));

  // Demo control
  const demoMsg = el('p', { class: 'small' });
  const skipBtn = el('button', { class: 'btn small', text: 'Skip ahead one week' });
  skipBtn.addEventListener('click', async () => {
    skipBtn.disabled = true;
    demoMsg.textContent = 'Moving forward a week and asking the watcher to review…';
    const r = await api('/api/demo/skip-week', 'POST');
    sessionStorage.setItem('skipMsg', `Moved ahead one week for ${r.learners} learner(s). The watcher added ${r.flagsCreated} new flag(s).`);
    showList();
  });
  const saved = sessionStorage.getItem('skipMsg');
  if (saved) { demoMsg.textContent = saved; sessionStorage.removeItem('skipMsg'); }
  main.appendChild(el('div', { class: 'card demo' }, [
    el('span', { class: 'demo-tag', text: 'Demo control · not part of the real tool' }),
    el('div', { class: 'row', style: 'justify-content: space-between; margin-top: 6px' }, [
      el('p', { class: 'muted small', style: 'margin: 0; max-width: 640px', text: 'Pretends a quiet week has passed: active learners get three missed check-ins, anyone mid-intake gets an "unfinished" note, then the watcher reviews everyone.' }),
      skipBtn,
    ]),
    demoMsg,
  ]));

  list.forEach((l) => {
    const pills = [
      pill(STATUS_LABEL[l.status] || l.status, l.welcomeSent ? '' : 'grey'),
      l.openFlags ? pill(l.openFlags + ' open flag' + (l.openFlags > 1 ? 's' : ''), 'flag') : null,
      l.openNotes ? pill(l.openNotes + ' note' + (l.openNotes > 1 ? 's' : '') + ' to handle', 'warn') : null,
      l.planStatus === 'Draft' ? pill('Plan: draft to review', 'warn') : null,
      l.planStatus === 'Approved' ? pill('Plan approved') : null,
      l.firstMeetingMet ? pill('First meeting met') : l.meeting ? pill('Meets ' + l.meeting, 'grey') : null,
    ];
    main.appendChild(el('a', { class: 'card learner-row', href: l.welcomeSent ? '/coach.html?id=' + l.id : '/admissions.html?id=' + l.id }, [
      el('div', {}, [el('h3', { text: l.label }), el('p', { class: 'muted small', text: l.shortDescription })]),
      el('div', { class: 'row' }, l.welcomeSent ? pills : [pills[0], el('span', { class: 'small muted', text: 'Open admissions →' })]),
    ]));
  });
}

// ======================= Learner detail =======================

async function showDetail() {
  let l;
  try {
    l = await api('/api/coach/learners/' + learnerId);
  } catch (e) {
    main.innerHTML = '';
    main.appendChild(el('p', { text: 'This learner has not been sent a welcome yet.' }));
    main.appendChild(el('a', { class: 'btn', href: '/coach.html', text: '← All learners' }));
    return;
  }
  main.innerHTML = '';
  main.appendChild(el('a', { class: 'small', href: '/coach.html', text: '← All learners' }));
  main.appendChild(el('div', { class: 'row', style: 'justify-content: space-between; margin-top: 8px' }, [
    el('h1', { text: l.label + ' · ' + l.shortDescription }),
    pill(STATUS_LABEL[l.status] || l.status),
  ]));
  main.appendChild(el('p', { class: 'muted small', text: `${l.record.track} · Fictional sample learner · Demo week ${l.demoWeek || 0}` }));

  const left = el('div');
  const right = el('div');
  left.appendChild(attentionCard(l));
  left.appendChild(profileCard(l));
  left.appendChild(briefCard(l));
  right.appendChild(planCard(l));
  right.appendChild(coachNotesCard(l));
  right.appendChild(historyCard(l));
  main.appendChild(el('div', { class: 'grid two' }, [left, right]));

  // If the plan and prep agent is still working, check back shortly.
  if (l.drafting || (l.intake.profile && !l.plan)) setTimeout(showDetail, 1500);
}

// ---------- Needs attention: notes + flags ----------
function attentionCard(l) {
  const openNotes = l.notes.map((n, i) => ({ ...n, i })).filter((n) => n.open);
  const openFlags = (l.flags || []).filter((f) => f.status === 'open');
  const pastFlags = (l.flags || []).filter((f) => f.status !== 'open');
  const rejected = l.rejectedFlags || [];
  const msg = el('p', { class: 'small' });

  const children = [];
  if (!openNotes.length && !openFlags.length) children.push(el('p', { class: 'muted', text: 'Nothing needs you right now.' }));

  openNotes.forEach((n) => children.push(el('div', { class: 'note-card' + (n.type === 'crisis_words' ? ' crisis' : '') }, [
    el('strong', { text: n.type === 'coach_request' ? 'Learner asked to talk to you' : 'Crisis words came up' }),
    el('p', { class: 'small', style: 'margin: 4px 0', text: n.text + ' ' + ago(n.at) + '.' }),
    el('button', { class: 'btn small', text: 'Mark handled', onclick: async () => { await api(`/api/coach/learners/${l.id}/notes/${n.i}/done`, 'POST'); showDetail(); } }),
  ])));

  openFlags.forEach((f) => children.push(flagCard(l, f)));

  const watchBtn = el('button', { class: 'btn small', text: 'Ask the watcher to review now' });
  watchBtn.addEventListener('click', async () => {
    watchBtn.disabled = true;
    const r = await api(`/api/coach/learners/${l.id}/watch`, 'POST');
    sessionStorage.setItem('watchMsg', r.created || r.rejected
      ? `The watcher added ${r.created} flag(s). ${r.rejected} proposal(s) were rejected by the evidence check.`
      : 'The watcher found nothing new.');
    showDetail();
  });
  const savedMsg = sessionStorage.getItem('watchMsg');
  if (savedMsg) { msg.textContent = savedMsg; sessionStorage.removeItem('watchMsg'); }
  children.push(el('div', { class: 'row' }, [watchBtn]));
  children.push(msg);

  if (pastFlags.length) {
    children.push(el('details', {}, [el('summary', { text: `Past flags (${pastFlags.length})` })].concat(pastFlags.map((f) => flagCard(l, f)))));
  }
  if (rejected.length) {
    children.push(el('details', {}, [
      el('summary', { text: `Rejected by the evidence check (${rejected.length})` }),
      el('p', { class: 'muted small', text: 'The watcher proposed these, but the code could not find the quoted words in the chat or activity log, so they were not shown as flags.' }),
    ].concat(rejected.map((r) => el('div', { class: 'flag-card low' }, [
      el('strong', { text: r.summary || '(no summary)' }),
      el('p', { class: 'quote', text: '"' + r.evidence + '"' }),
      el('p', { class: 'small muted', style: 'margin: 0', text: 'Reason: ' + r.reason }),
    ])))));
  }
  return card('Needs attention', children);
}

function flagCard(l, f) {
  return el('div', { class: 'flag-card ' + f.confidence }, [
    el('div', { class: 'row', style: 'justify-content: space-between' }, [
      el('strong', { text: f.summary }),
      pill('Confidence: ' + f.confidence, CONFIDENCE_KIND[f.confidence]),
    ]),
    el('p', { class: 'quote', text: '"' + f.evidence + '"' }),
    el('p', { class: 'small', style: 'margin: 0 0 6px' }, [el('strong', { text: 'Another explanation: ' }), f.otherExplanation]),
    el('p', { class: 'muted small', text: 'Flagged by the watcher agent ' + ago(f.createdAt) + '. The watcher never contacts the learner.' }),
    f.status === 'open'
      ? el('div', { class: 'row' }, DECISIONS.map((d) => el('button', {
        class: 'btn small' + (d.id === 'reach_out' ? ' primary' : ''),
        text: d.label,
        onclick: async () => { await api(`/api/coach/learners/${l.id}/flags/${f.id}`, 'POST', { decision: d.id }); showDetail(); },
      })))
      : el('p', { class: 'small', style: 'margin: 0' }, [el('strong', { text: 'Your decision: ' }), DECISION_LABEL[f.decision] + ', ' + ago(f.decidedAt)]),
  ]);
}

// ---------- Intake profile ----------
function profileCard(l) {
  const p = l.intake.profile;
  if (!p) {
    return card('Intake profile', [el('p', { class: 'muted', text: l.status === 'invited' ? 'The learner has not started the intake yet.' : 'The learner is partway through the intake.' })]);
  }
  const barriers = p.barriers && p.barriers.length
    ? p.barriers.map((b) => el('span', { class: 'barrier', title: b.detail, text: b.type }))
    : [el('span', { class: 'muted', text: 'None shared' })];
  return card('Intake profile', [
    el('p', { text: p.summary }),
    el('h3', { text: 'Barriers' }),
    el('div', { style: 'margin-bottom: 10px' }, barriers),
    el('dl', { class: 'record' }, [
      el('dt', { text: 'Worries' }), el('dd', { text: p.worries }),
      el('dt', { text: 'Timing' }), el('dd', { text: p.timing }),
      el('dt', { text: 'How they like support' }), el('dd', { text: p.supportPreferences }),
      el('dt', { text: 'Skipped questions' }), el('dd', { text: l.intake.skipped.length ? l.intake.skipped.join(', ') : 'None' }),
      el('dt', { text: 'First meeting' }), el('dd', { text: l.meeting ? l.meeting.slot : 'Not booked yet' }),
    ]),
    el('a', { class: 'small', href: '/admissions.html?id=' + l.id, text: 'View the admissions interview record (read only) →' }),
  ]);
}

// ---------- Meeting brief ----------
function briefCard(l) {
  const b = l.brief;
  if (!b) {
    return card('Meeting brief', [el('p', { class: 'muted', text: l.intake.profile ? 'The plan and prep agent is drafting the brief…' : 'The brief is drafted once the intake is finished.' })]);
  }
  const kids = [
    el('p', { class: 'muted small', text: 'Drafted by the plan and prep agent for your first meeting.' }),
    el('p', { text: b.whoTheyAre }),
  ];
  if (b.worthAskingFirst && b.worthAskingFirst.length) {
    kids.push(el('div', { class: 'first-ask' }, [el('strong', { text: 'Worth asking about first' }), el('ul', { class: 'tight' }, b.worthAskingFirst.map((t) => el('li', { text: t })))]));
  }
  kids.push(el('h3', { text: 'What they shared' }));
  kids.push(el('ul', { class: 'tight' }, b.whatTheyShared.map((t) => el('li', { text: t }))));
  kids.push(el('h3', { text: 'Suggested questions' }));
  kids.push(el('ol', { class: 'tight' }, b.questions.map((t) => el('li', { text: t }))));
  kids.push(el('h3', { text: 'Resources by barrier' }));
  kids.push(b.resources.length
    ? el('ul', { class: 'tight' }, b.resources.map((r) => el('li', {}, [el('strong', { text: r.label }), el('span', { class: 'muted small', text: ' · ' + r.note })])))
    : el('p', { class: 'muted small', text: 'No barriers shared, so no resources matched.' }));
  return card('Meeting brief', kids);
}

// ---------- Plan ----------
function planCard(l) {
  const plan = l.plan;
  const msg = el('p', { class: 'small' });
  if (!plan) {
    const kids = [el('p', { class: 'muted', text: l.intake.profile ? 'The plan and prep agent is drafting the plan…' : 'The plan is drafted once the intake is finished.' })];
    return card('Plan', kids);
  }
  const approved = plan.status === 'Approved';
  const header = el('div', { class: 'row', style: 'justify-content: space-between; margin-bottom: 8px' }, [
    pill(approved ? 'Approved' : 'Draft', approved ? '' : 'warn'),
    el('span', { class: 'muted small', text: approved
      ? 'Approved ' + ago(plan.approvedAt) + (plan.editedByCoach ? ', with your edits' : '')
      : 'Drafted by the plan and prep agent' + (plan.editedByCoach ? ', edited by you' : '') }),
  ]);
  const note = el('p', { class: 'muted small', text: approved
    ? 'The learner and their AI coach can now see this plan.'
    : 'Nobody but you sees this until you approve it. The AI coach tells the learner the plan is being reviewed.' });

  if (approved) {
    return card('Plan', [header, note,
      el('ol', { class: 'tight' }, plan.weeks.map((w) => el('li', {}, [el('strong', { text: w.label + ': ' }), w.goal]))),
      el('button', { class: 'btn small', text: 'Reopen as draft to edit', onclick: async () => { await api(`/api/coach/learners/${l.id}/plan/reopen`, 'POST'); showDetail(); } }),
    ]);
  }

  const areas = plan.weeks.map((w) => el('textarea', { rows: '2', 'aria-label': w.label }, [w.goal]));
  const weeksEl = plan.weeks.map((w, i) => el('div', { class: 'week' }, [el('label', { text: w.label }), areas[i]]));
  const collect = () => ({ weeks: areas.map((a) => ({ goal: a.value })) });
  const approve = el('button', { class: 'btn primary', text: 'Approve plan', onclick: async () => {
    await api(`/api/coach/learners/${l.id}/plan/approve`, 'POST', collect());
    showDetail();
  } });
  const save = el('button', { class: 'btn', text: 'Save edits', onclick: async () => {
    const r = await api(`/api/coach/learners/${l.id}/plan/save`, 'POST', collect());
    msg.textContent = r.changed ? 'Edits saved. The plan is still a draft.' : 'No changes to save.';
  } });
  const redraft = el('button', { class: 'btn small', text: 'Ask the agent to redraft', onclick: async () => {
    if (!confirm('Replace this draft with a new one from the plan and prep agent? Your unsaved edits will be lost.')) return;
    redraft.disabled = true;
    try { await api(`/api/coach/learners/${l.id}/draft`, 'POST'); } catch (e) { alert(e.message); }
    showDetail();
  } });
  return card('Plan', [header, note].concat(weeksEl).concat([el('div', { class: 'row' }, [approve, save, redraft]), msg]));
}

// ---------- Coach notes ----------
function coachNotesCard(l) {
  const cn = l.coachNotes || { nextSteps: ['', '', ''], firstMeetingMet: false };
  const inputs = [0, 1, 2].map((i) => el('input', { type: 'text', placeholder: 'Next step ' + (i + 1), value: cn.nextSteps[i] || '', 'aria-label': 'Next step ' + (i + 1) }));
  const met = el('input', { type: 'checkbox', id: 'met' });
  met.checked = !!cn.firstMeetingMet;
  const msg = el('p', { class: 'small' });
  const save = el('button', { class: 'btn primary', text: 'Save notes', onclick: async () => {
    await api(`/api/coach/learners/${l.id}/coach-notes`, 'POST', { nextSteps: inputs.map((x) => x.value), firstMeetingMet: met.checked });
    msg.textContent = 'Saved.';
  } });
  return card('Notes and next steps', [
    el('p', { class: 'muted small', text: 'Up to three next steps you and the learner agreed on.' }),
    ...inputs.map((x) => el('div', { style: 'margin-bottom: 8px' }, [x])),
    el('label', { class: 'check-row', for: 'met' }, [met, 'First meeting met']),
    save,
    msg,
  ]);
}

// ---------- Chat and activity ----------
function historyCard(l) {
  const chat = l.coachChat.length
    ? el('div', { class: 'mini-chat' }, l.coachChat.map((m) => el('div', { class: 'bubble ' + (m.role === 'learner' ? 'learner' : 'agent'), text: m.text })))
    : el('p', { class: 'muted small', text: 'No AI coach conversations yet.' });
  const activity = l.activity.length
    ? el('ul', { class: 'tight small' }, l.activity.slice().reverse().map((a) => el('li', { text: `${ago(a.at)} · ${a.type.replace(/_/g, ' ')}: ${a.detail}` })))
    : el('p', { class: 'muted small', text: 'No activity yet.' });
  return card('Chat and activity', [
    el('p', { class: 'muted small', text: 'The learner was told their AI coach chats may be reviewed by you.' }),
    el('details', {}, [el('summary', { text: `AI coach chat (${l.coachChat.length} messages)` }), chat]),
    el('details', {}, [el('summary', { text: `Activity log (${l.activity.length} events)` }), activity]),
  ]);
}

if (learnerId) showDetail(); else showList();
