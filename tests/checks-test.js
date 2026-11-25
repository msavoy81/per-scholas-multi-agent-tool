// checks-test.js: proves the plain-code checks work. Run with:  npm test
'use strict';
const assert = require('node:assert');
const path = require('path');
const checks = require('../lib/checks');
const store = require('../lib/store');

function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); } catch (err) { console.log('  ✗ ' + name + '\n    ' + err.message); process.exitCode = 1; }
}

console.log('Code checks');

test('Crisis words are caught, everyday words are not', () => {
  assert.ok(checks.hasCrisisWords('Some days I feel like I want to die'));
  assert.ok(checks.hasCrisisWords('I CANT GO ON like this'));
  assert.ok(!checks.hasCrisisWords('I am excited and a bit nervous to start'));
});

test('Empty or broken agent replies become a friendly fallback', () => {
  assert.ok(checks.safeReply('learner-coach', '').length > 10);
  assert.ok(checks.safeReply('intake', null).length > 10);
  assert.ok(checks.safeReply('learner-coach', 'x'.repeat(5000)).length < 300);
  assert.strictEqual(checks.safeReply('learner-coach', ' Hello there '), 'Hello there');
});

test('Only the coach can approve a plan, and only from Draft', () => {
  assert.ok(checks.canChangePlanStatus('Draft', 'Approved', 'coach'));
  assert.ok(!checks.canChangePlanStatus('Draft', 'Approved', 'agent'));
  assert.ok(!checks.canChangePlanStatus('none', 'Approved', 'coach'));
  assert.ok(!checks.canChangePlanStatus('Approved', 'Draft', 'agent'));
  assert.ok(checks.canChangePlanStatus('Approved', 'Draft', 'coach'));
  assert.strictEqual(checks.enforceDraft({ status: 'Approved', weeks: [] }).status, 'Draft');
});

test('Briefs keep 3 to 5 questions and placeholder resources only', () => {
  assert.strictEqual(checks.clampQuestions(['a'], ['b', 'c', 'd']).length, 3);
  assert.strictEqual(checks.clampQuestions(['1', '2', '3', '4', '5', '6', '7'], []).length, 5);
  const r = checks.placeholderResources([{ type: 'childcare' }, { type: 'technology' }]);
  assert.deepStrictEqual(r.map((x) => x.label), ['Sample childcare resource', 'Sample technology resource']);
});

test('Flags need word-for-word evidence, a confidence level, and another explanation', () => {
  const learner = {
    coachChat: [{ role: 'learner', text: 'My laptop keeps freezing during the video lessons.' }, { role: 'agent', text: 'You should quit.' }],
    activity: [{ type: 'checkin_missed', detail: 'No check-in' }],
  };
  const good = { evidence: 'My laptop keeps freezing', confidence: 'medium', otherExplanation: 'May already be fixed.' };
  assert.ok(checks.validateFlag(good, learner).ok);
  assert.ok(checks.validateFlag({ ...good, evidence: 'No check-in' }, learner).ok);
  assert.ok(!checks.validateFlag({ ...good, evidence: 'My computer is broken' }, learner).ok, 'paraphrase must fail');
  assert.ok(!checks.validateFlag({ ...good, evidence: 'You should quit.' }, learner).ok, 'AI words are not learner evidence');
  assert.ok(!checks.validateFlag({ ...good, confidence: 'very high' }, learner).ok);
  assert.ok(!checks.validateFlag({ ...good, otherExplanation: '' }, learner).ok);
});

test('Agents get a frozen copy of the admissions record', () => {
  const record = store.getRecordForAgents('S1');
  assert.ok(Object.isFrozen(record) && Object.isFrozen(record.decision));
  assert.throws(() => { record.decision.status = 'Changed'; });
  assert.strictEqual(store.getSample('S1').record.decision.status, 'Accepted');
});

test('Nothing can be written outside data/sessions/', () => {
  const target = path.join(__dirname, '..', 'data', 'sample', 'should-not-exist.json');
  assert.throws(() => store.writeJson(target, {}));
});

test('Saved chats become a readable transcript with the evidence label', () => {
  const learner = {
    id: 'S9', label: 'Learner S9',
    coachChat: [
      { role: 'learner', text: 'Ask me an interview question.', feature: 'interview' },
      { role: 'agent', text: 'Tell me about a project you are proud of.' },
      { role: 'learner', text: 'Thanks, that helped.', feature: 'general' },
      { role: 'agent', text: 'Glad to hear it.', crisis: true },
    ],
  };
  const t = store.formatTranscript(learner, { testSession: 4, tag: 'Bug', note: 'Too long' });
  assert.ok(t.split('\n')[0].startsWith('Evidence-informed test conversation'));
  assert.ok(t.includes('Sample learner: S9 (Learner S9)'));
  assert.ok(t.includes('Test session: T4') && t.includes('Tag: Bug') && t.includes('Note: Too long'));
  const a = t.indexOf('Learner [interview]: Ask me an interview question.');
  const b = t.indexOf('AI coach: Tell me about a project you are proud of.');
  assert.ok(a > -1 && b > a, 'messages appear in order with speaker labels');
  assert.ok(t.includes('Learner: Thanks, that helped.'), 'general messages have no feature tag');
  assert.ok(t.includes('(988 crisis information was shown here.)'));
  assert.ok(store.formatTranscript({ id: 'S9', coachChat: [] }).includes('(No messages in the AI coach chat.)'));
});

if (process.exitCode) console.log('\nSome checks failed.'); else console.log('\nAll code checks passed.');
