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
  (children || []).forEach((c) => node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
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
      banner.textContent = 'Mock mode is on: no API key set, so the agents use pre-written replies.';
      banner.classList.add('on');
    }
  } catch (e) { /* ignore */ }
}
document.addEventListener('DOMContentLoaded', showModeBanner);
