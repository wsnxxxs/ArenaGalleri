import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { writeWithDeadline } from '../site/arena-loading.js';

const source = readFileSync(new URL('../site/arena.js', import.meta.url), 'utf8');
const chunk = (first, last) => source.slice(source.indexOf(first), source.indexOf(last, source.indexOf(first)));
const constant = (name) => chunk(`const ${name} =`, ';\n') + ';\n';
const ASPECT = { id: 'floating', dimension: 'craft', dimensionName: '工程完备', question: '哪个建模的悬空或断连现象更少？', keyword: '悬空或断连', hint: '' };

// The guided card's two questions, run against a fake page: drawing is a no-op, and every vote is answered at once.
function guided(match) {
  const votes = [], said = [];
  const e = { alive: true, guided: true, DOMException, AbortController, voteController: null, readyRequest: null, el: {},
    state: { match: { id: 'pair', minViewSeconds: 5, ...match }, busy: false, result: null, counted: 0, tally: {}, step: 'overall', aspectPick: null, overallPick: null, compact: false, seen: { a: true, b: true } },
    accountVersion: () => 1, platform: { user: { id: 'staff' }, me: { votes: 0 }, totals: { votes: 0 } }, task: { id: 'task' },
    $: (selector) => (selector === '#lightbox' ? { hidden: true } : selector === 'dialog[open]' ? null : { contains: () => false, focus() {} }),
    document: { hidden: false, activeElement: null }, performance: { now: () => 0 },
    canVote: () => true, canSkip: () => true, bothReady: () => true, voteWait: () => 0, mobile: () => false,
    stopGate() {}, update() {}, drawBar() {}, syncGate() {}, status: () => '', prefetch() {}, next() {}, toast() {}, levelOf: () => 2, curatedKnown: () => null,
    live: (text) => said.push(text), writeWithDeadline, hold: { mark() {}, resume() {} },
    api(path, options) { votes.push(JSON.parse(JSON.stringify({ path, body: options.body }))); return Promise.resolve({ counted: false, reason: 'trial', choice: options.body.choice }); },
  };
  vm.runInNewContext(constant('PICKS') + constant('OVERALL') + chunk('  const owns =', '\n  const later')
    + chunk('  const aspectLast =', '\n  const live =') + chunk('  function answer(', '\n  function setCompact')
    + chunk('  function accept(', '\n  function togglePrompt') + chunk('  const onKey =', '\n  document.addEventListener')
    + '\nglobalThis.t = { answer, repick, marked, aspectLast, onKey };', e);
  // As next() does when the pair arrives.
  e.state.step = e.state.match.aspect && !e.t.aspectLast() ? 'aspect' : 'overall';
  const key = (k) => e.t.onKey({ key: k, target: { matches: () => false, closest: () => null }, preventDefault() {} });
  return { e, votes, said, key, settle: () => new Promise((resolve) => setImmediate(resolve)) };
}

test('the after order asks the overall question first and sends both answers in one vote', async () => {
  const { e, votes, said, settle } = guided({ aspect: ASPECT, aspectOrder: 'after' });
  assert.equal(e.state.step, 'overall');
  e.t.answer('a');
  assert.equal(votes.length, 0, 'the first answer stays on the page');
  assert.deepEqual([e.state.step, e.state.overallPick], ['aspect', 'a']);
  assert.equal(said.at(-1), `下一题：${ASPECT.question}`);
  e.t.answer('good');
  await settle();
  assert.deepEqual(votes, [{ path: 'arena/matches/pair/vote', body: { choice: 'a', aspect: { id: 'floating', choice: 'tie', tieKind: 'good' } } }]);
  assert.equal(e.state.result.choice, 'a');
});

test('the before order and a pair without an aspect keep their old flow', async () => {
  for (const order of ['before', undefined]) {
    const { e, votes, settle } = guided({ aspect: ASPECT, aspectOrder: order });
    assert.equal(e.state.step, 'aspect');
    e.t.answer('b');
    assert.deepEqual([votes.length, e.state.step, e.state.aspectPick], [0, 'overall', 'b']);
    e.t.answer('bad');
    await settle();
    assert.deepEqual(votes.map((vote) => vote.body), [{ choice: 'tie', tieKind: 'bad', aspect: { id: 'floating', choice: 'b' } }]);
  }
  const { e, votes, settle } = guided({ aspect: null, aspectOrder: 'after' });
  assert.equal(e.state.step, 'overall');
  e.t.answer('b');
  await settle();
  assert.deepEqual(votes.map((vote) => vote.body), [{ choice: 'b' }], 'without an aspect the only question is sent at once');
});

test('skipping the aspect question of the after order sends the overall answer alone', async () => {
  const { e, votes, settle } = guided({ aspect: ASPECT, aspectOrder: 'after' });
  e.t.answer('b');
  e.t.answer(null);
  await settle();
  assert.deepEqual(votes.map((vote) => vote.body), [{ choice: 'b' }]);
  assert.equal(e.state.aspectPick, null);
});

test('改选 returns to the overall question with its pick marked and the new pick is the one sent', async () => {
  const { e, votes, settle } = guided({ aspect: ASPECT, aspectOrder: 'after' });
  e.t.answer('a');
  assert.equal(e.t.marked(), null, 'the aspect question starts unmarked');
  e.t.repick();
  assert.deepEqual([e.state.step, e.state.overallPick, e.t.marked()], ['overall', 'a', 'a']);
  e.t.answer('bad');
  assert.deepEqual([e.state.step, e.state.overallPick], ['aspect', 'bad']);
  e.state.busy = true;
  e.t.repick();
  assert.equal(e.state.step, 'aspect', 'a vote on its way cannot be changed');
  e.state.busy = false;
  e.t.answer('b');
  assert.equal(e.t.marked(), 'b', 'while sending, the aspect answer is the one marked');
  await settle();
  assert.deepEqual(votes.map((vote) => vote.body), [{ choice: 'tie', tieKind: 'bad', aspect: { id: 'floating', choice: 'b' } }]);
});

test('A S X D answer both questions of the after order', async () => {
  const { e, votes, key, settle } = guided({ aspect: ASPECT, aspectOrder: 'after' });
  key('s');
  assert.deepEqual([e.state.step, e.state.overallPick, votes.length], ['aspect', 'good', 0]);
  key('X');
  await settle();
  assert.deepEqual(votes.map((vote) => vote.body), [{ choice: 'tie', tieKind: 'good', aspect: { id: 'floating', choice: 'tie', tieKind: 'bad' } }]);
  const other = guided({ aspect: ASPECT, aspectOrder: 'after' });
  other.key('d');
  other.key('a');
  await other.settle();
  assert.deepEqual(other.votes.map((vote) => vote.body), [{ choice: 'b', aspect: { id: 'floating', choice: 'a' } }]);
});

test('a skip reason is offered for six seconds and sent at most once', async () => {
  const calls = [], waits = [];
  let version = 1;
  const strip = () => {
    const node = { className: '', innerHTML: '', classList: { add(name) { node.gone = name; } }, setAttribute() {}, addEventListener() {}, matches: () => false, remove() { node.removed = true; } };
    node.contains = (target) => target?.strip === node;
    return node;
  };
  const e = { accountVersion: () => version, icon: () => '', $$: () => [], el: {}, ResizeObserver: class { observe() {} disconnect() {} },
    $: (selector) => (selector === '.arena-stage' ? { append(node) { e.shown = node; } } : null), document: { createElement: strip, activeElement: null },
    later: (fn) => fn(), setTimeout: (fn, ms) => { waits.push({ fn, ms }); return waits.length; }, clearTimeout() {},
    api: (path, options) => { calls.push(JSON.parse(JSON.stringify({ path, body: options.body }))); return Promise.resolve({ ok: true }); } };
  vm.runInNewContext(constant('SKIP_REASONS') + constant('SKIP_REASON_MS') + chunk('  let skipReason = null;', '\n  function showError')
    + '\nglobalThis.t = { askSkipReason, sendSkipReason, dropSkipReason };', e);

  e.t.askSkipReason('skipped-1');
  assert.equal(waits.at(-1).ms, 6000);
  const pick = (reason) => ({ strip: e.shown, dataset: { reason } });
  e.t.sendSkipReason(pick('broken'));
  e.t.sendSkipReason(pick('unsure'));
  assert.deepEqual(calls, [{ path: 'arena/matches/skipped-1/skip-reason', body: { reason: 'broken' } }]);
  assert.equal(e.shown.gone, 'is-gone');

  // Left alone, the strip goes away and nothing is recorded.
  e.t.askSkipReason('skipped-2');
  const ignored = e.shown;
  waits.at(-1).fn();
  assert.equal(ignored.removed, true);
  e.t.sendSkipReason({ strip: ignored, dataset: { reason: 'recognized' } });
  assert.equal(calls.length, 1);

  // A reason picked under another account is not sent.
  e.t.askSkipReason('skipped-3');
  version = 2;
  e.t.sendSkipReason(pick('recognized'));
  assert.equal(calls.length, 1);
});

test('the task note follows the skip reasons as they change size and returns to its place when they go', () => {
  const note = { style: {} };
  let strip = null, resize = null, disconnected = 0;
  const e = { accountVersion: () => 1, icon: () => '', $$: () => [], el: {}, later: (fn) => fn(), setTimeout: () => 0, clearTimeout() {},
    ResizeObserver: class { constructor(callback) { resize = callback; } observe() {} disconnect() { disconnected++; } },
    document: { createElement: () => (strip = { offsetTop: 56, offsetHeight: 44, classList: { add(name) { strip.gone = name; } }, setAttribute() {}, addEventListener() {}, remove() {} }) },
    $: (selector) => (selector === '.arena-stage' ? { append() {} } : selector === '.arena-switched' ? note
      : selector === '.arena-why:not(.is-gone)' && strip && !strip.gone ? strip : null) };
  vm.runInNewContext(constant('SKIP_REASONS') + constant('SKIP_REASON_MS') + chunk('  let skipReason = null;', '\n  function showError')
    + '\nglobalThis.t = { askSkipReason, dropSkipReason, stackNotes };', e);
  e.t.stackNotes();
  assert.equal(note.style.top, '', 'without skip reasons the note keeps its own place');
  e.t.askSkipReason('skipped');
  e.t.stackNotes();
  assert.equal(note.style.top, '108px');
  strip.offsetHeight = 168; // translated to English and wrapped on a phone
  resize();
  assert.equal(note.style.top, '232px');
  e.t.dropSkipReason();
  assert.equal(note.style.top, '');
  assert.equal(disconnected, 1);
});
