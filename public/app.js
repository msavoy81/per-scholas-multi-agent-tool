// app.js: small helpers shared by every page.

async function api(path, method, body) {
  const res = await fetch(path, {
    method: method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  (children || [])
    .filter((c) => c !== null && c !== undefined && c !== false)
    .forEach((c) => node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return node;
}

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

// Show the mock-mode banner if the server has no API key.
async function showModeBanner() {
  const banner = document.getElementById('mock-banner');
  if (!banner) return;
  try {
    const s = await api('/api/status');
    if (s.mockMode) {
      banner.textContent = s.forcedMock
        ? 'Mock mode is on (started with npm run mock): the agents use pre-written replies.'
        : 'Mock mode is on: no API key set, so the agents use pre-written replies.';
      banner.classList.add('on');
    }
  } catch (e) { /* ignore */ }
}
document.addEventListener('DOMContentLoaded', showModeBanner);

function pill(text, kind) {
  return el('span', { class: 'pill' + (kind ? ' ' + kind : ''), text });
}

function ago(iso) {
  const d = Math.floor((Date.now() - Date.parse(iso)) / 864e5);
  return d <= 0 ? 'today' : d === 1 ? '1 day ago' : d + ' days ago';
}

// ---------- Two-click confirm ----------
// Built-in browser previews block window.confirm(), so risky buttons confirm on
// the page instead. First click: the button says "Click again to confirm" and the
// warning shows next to it. A second click within 5 seconds runs the action.
function confirmClick(button, warning, action) {
  const original = button.textContent;
  const note = el('span', { class: 'confirm-note small', text: warning });
  let timer = null;
  function reset() {
    clearTimeout(timer);
    timer = null;
    button.textContent = original;
    note.remove();
  }
  button.addEventListener('click', () => {
    if (timer) { reset(); action(); return; }
    button.textContent = 'Click again to confirm';
    button.insertAdjacentElement('afterend', note);
    timer = setTimeout(reset, 5000);
  });
}

// ---------- Guided demo ----------
// The story learners and frame text live in story.js. When the address has
// ?story=S2&frame=3&step=2, every page shows the story bar under the top bar.
// Without those, nothing here changes the page.
const STORY_PAGES = { admissions: '/admissions.html', learner: '/learner.html', coach: '/coach.html', summary: '/story.html' };

function storyUrl(learnerId, frame, step) {
  const page = FRAMES[frame - 1].steps[step - 1].page;
  const params = new URLSearchParams();
  if (page !== 'summary') params.set('id', learnerId);
  params.set('story', learnerId);
  params.set('frame', frame);
  params.set('step', step);
  return STORY_PAGES[page] + '?' + params.toString();
}

// Starts a new test session, then opens frame 1 for this learner.
async function startStory(learnerId) {
  await api('/api/demo/new-session', 'POST');
  location.href = storyUrl(learnerId, 1, 1);
}

// Where we are in the story, read from the address. Null when not in the story.
function storyState() {
  if (typeof FRAMES === 'undefined' || typeof STORY_LEARNERS === 'undefined') return null;
  const learnerId = qs('story');
  const frame = Number(qs('frame'));
  const step = Number(qs('step') || 1);
  if (!STORY_LEARNERS.some((s) => s.id === learnerId)) return null;
  if (!FRAMES[frame - 1] || !FRAMES[frame - 1].steps[step - 1]) return null;
  return { learnerId, frame, step };
}

// The address of the step before (dir -1) or after (dir 1), or null at either end.
function storyNeighbor(s, dir) {
  let frame = s.frame;
  let step = s.step + dir;
  if (step < 1) {
    frame -= 1;
    if (!FRAMES[frame - 1]) return null;
    step = FRAMES[frame - 1].steps.length;
  } else if (step > FRAMES[frame - 1].steps.length) {
    frame += 1;
    step = 1;
    if (!FRAMES[frame - 1]) return null;
  }
  return storyUrl(s.learnerId, frame, step);
}

function showStoryBar() {
  const s = storyState();
  const topbar = document.querySelector('.topbar');
  if (!s || !topbar) return;
  const frame = FRAMES[s.frame - 1];
  const step = frame.steps[s.step - 1];
  const back = storyNeighbor(s, -1);
  const next = storyNeighbor(s, 1);

  const msg = el('p', { class: 'story-msg' });
  const saved = sessionStorage.getItem('storyMsg');
  if (saved) { msg.textContent = saved; sessionStorage.removeItem('storyMsg'); }

  const nav = [];
  if (step.skipWeek) {
    const skip = el('button', { class: 'btn small', text: 'Skip ahead one week' });
    skip.addEventListener('click', async () => {
      skip.disabled = true;
      msg.textContent = 'Moving forward a week and asking the watcher to review…';
      try {
        const r = await api('/api/demo/skip-week', 'POST', { learnerId: s.learnerId });
        sessionStorage.setItem('storyMsg', `Moved ahead one week. The watcher added ${r.flagsCreated} new flag(s).`);
        location.reload();
      } catch (e) {
        msg.textContent = e.message;
        skip.disabled = false;
      }
    });
    nav.push(skip);
  }
  nav.push(el('a', { class: 'btn small', href: back || '/', text: back ? '← Back' : '← Home' }));
  nav.push(el('a', { class: 'btn small primary', href: next || '/', text: next ? 'Next →' : 'Finish · Home' }));

  const stepText = frame.steps.length > 1 ? ` (step ${s.step} of ${frame.steps.length})` : '';
  const bar = el('div', { class: 'story-bar' }, [el('div', { class: 'story-bar-inner' }, [
    el('div', { class: 'story-text' }, [
      el('p', { class: 'story-title', text: `Frame ${s.frame} of ${FRAMES.length}: ${frame.title}${stepText}` }),
      el('p', { text: step.caption }),
      el('p', { class: 'story-who' }, [el('strong', { text: 'Who decides here: ' }), step.who]),
    ]),
    el('div', { class: 'row' }, nav),
    msg,
  ])]);
  topbar.insertAdjacentElement('afterend', bar);
}
document.addEventListener('DOMContentLoaded', showStoryBar);
