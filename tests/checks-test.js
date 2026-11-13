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

if (process.exitCode) console.log('\nSome checks failed.'); else console.log('\nAll code checks passed.');
