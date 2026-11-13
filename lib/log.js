// log.js: the usage log. One entry per event, with a timestamp and the test
// session number, saved to data/sessions/usage-log.json.
// The coach dashboard exports it as CSV (comma separated values) for Excel.

const path = require('path');
const fs = require('fs');
const store = require('./store');

const LOG_FILE = path.join(store.SESSION_DIR, 'usage-log.json');

function readLog() {
  return store.readJson(LOG_FILE, []);
}

function logEvent(type, details) {
  const events = readLog();
  events.push({
    testSession: 'T' + store.getMeta().testSession,
    at: new Date().toISOString(),
    type,
    learnerId: (details && details.learnerId) || '',
    detail: (details && details.detail) || '',
  });
  store.writeJson(LOG_FILE, events);
}

function clearLog() {
  if (fs.existsSync(LOG_FILE)) fs.rmSync(LOG_FILE);
}

function toCsv() {
  const rows = [['test_session', 'timestamp_utc', 'local_time', 'event', 'learner', 'detail']];
  readLog().forEach((e) => rows.push([
    e.testSession || '', e.at, new Date(e.at).toLocaleString('en-US'), e.type, e.learnerId, e.detail,
  ]));
  const escape = (v) => '"' + String(v).replace(/"/g, '""') + '"';
  // The invisible first character (a "byte order mark") helps Excel read the file correctly.
  return '﻿' + rows.map((r) => r.map(escape).join(',')).join('\r\n');
}

module.exports = { logEvent, readLog, clearLog, toCsv };
