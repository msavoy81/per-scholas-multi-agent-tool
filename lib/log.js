// log.js: the usage log. One line per event, with a timestamp, saved to
// data/sessions/usage-log.json. The coach dashboard can export it as CSV.

const path = require('path');
const store = require('./store');

const LOG_FILE = path.join(store.SESSION_DIR, 'usage-log.json');

function readLog() {
  return store.readJson(LOG_FILE, []);
}

function logEvent(type, details) {
  const events = readLog();
  events.push({
    at: new Date().toISOString(),
    type,
    learnerId: (details && details.learnerId) || '',
    detail: (details && details.detail) || '',
  });
  store.writeJson(LOG_FILE, events);
}

// Turn the log into CSV text (comma separated values) so it opens in Excel.
function toCsv() {
  const rows = [['timestamp', 'event', 'learner', 'detail']];
  readLog().forEach((e) => rows.push([e.at, e.type, e.learnerId, e.detail]));
  const escape = (v) => '"' + String(v).replace(/"/g, '""') + '"';
  return rows.map((r) => r.map(escape).join(',')).join('\n');
}

module.exports = { logEvent, readLog, toCsv };
