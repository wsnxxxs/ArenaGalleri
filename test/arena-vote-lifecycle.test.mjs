import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createHold, writeWithDeadline } from '../site/arena-loading.js';

const source = readFileSync(new URL('../site/arena.js', import.meta.url), 'utf8');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const chunk = (first, last) => source.slice(source.indexOf(first), source.indexOf(last, source.indexOf(first)));

function environment(timeout) {
  let version = 1;
  const reads = [], notices = [], deadlines = [];
  const e = { alive: true, DOMException, AbortController, voteController: null, state: { match: { id: 'current' }, busy: false, counted: 0, tally: {} },
    accountVersion: () => version, platform: { user: { id: 'one' }, me: { votes: 10 }, totals: { votes: 20 } },
    task: { id: 'task' }, stopGate() {}, levelOf: () => 1, curatedKnown: () => null,
    canVote: () => true, canSkip: () => true, update() {}, drawBar() {}, syncGate() {}, prefetch() { e.prefetches++; }, prefetches: 0,
    next() { e.nexts++; }, nexts: 0, writeWithDeadline: (write, options) => writeWithDeadline(write, { ...options, timeout }),
    toast: message => notices.push(message), performance: { now: () => 0 }, document: { hidden: false },
    hold: { mark: (...value) => deadlines.push(value), resume() {} }, later() { assert.fail('a rejected write must wait for another user action'); },
    api(path, options) { const request = { path, ...options, ...deferred() }; reads.push(request); return request.promise; },
    askHuman: options => { e.challenge = options; e.answer = deferred(); return e.answer.promise; },
  };
  vm.runInNewContext(chunk('  const owns =', '\n  const later') + chunk('  function accept(', '\n  function togglePrompt') + '\nglobalThis.voteForTest = vote; globalThis.verifyForTest = verifyVote;', e);
  return { e, reads, notices, deadlines, identity() { version++; e.platform.user = { id: 'two' }; e.platform.me = { votes: 50 }; } };
}

test('a late successful vote after departure or an account epoch change cannot update counters or prefetch', async () => {
  for (const change of ['departure', 'identity', 'match']) {
    const { e, reads, identity } = environment();
    const sending = e.voteForTest('a');
    await Promise.resolve();
    if (change === 'departure') e.alive = false;
    else if (change === 'identity') identity();
    else e.state.match = { id: 'next' };
    reads[0].resolve({ counted: true }); await sending;
    assert.equal(e.platform.me.votes, change === 'identity' ? 50 : 10);
    assert.equal(e.platform.totals.votes, 20);
    assert.equal(e.prefetches, 0);
  }
});

test('a rejected early vote restores the same pair and waits for an explicit second vote', async () => {
  const { e, reads, deadlines, notices } = environment(), current = e.state.match;
  const first = e.voteForTest('a');
  await Promise.resolve();
  reads[0].reject(Object.assign(new Error('early'), { code: 'vote_too_early', retryAfter: 2 })); await first;
  assert.equal(reads.length, 1); assert.equal(e.state.busy, false); assert.equal(e.state.match, current);
  assert.equal(deadlines.length, 2); assert.deepEqual(notices, ['请再多看一会儿再投票']);
  const second = e.voteForTest('a'); await Promise.resolve(); reads[1].resolve({ counted: true }); await second;
  assert.equal(e.platform.me.votes, 11); assert.equal(e.platform.totals.votes, 21); assert.equal(e.prefetches, 1);
});

test('a challenge cannot submit or accept a vote belonging to an old account epoch', async () => {
  const { e, reads, identity } = environment();
  const verifying = e.verifyForTest('a', { siteKey: 'fixture' });
  const pending = e.challenge.submit('token'); await Promise.resolve(); assert.equal(reads.length, 1);
  identity();
  assert.throws(() => e.challenge.submit('late-token'), { name: 'AbortError' });
  reads[0].resolve({ counted: true });
  e.answer.resolve({ value: await pending }); await verifying;
  assert.equal(e.platform.me.votes, 50); assert.equal(e.prefetches, 0);
});

test('a vote deadline restores the same pair and ignores a late counted response', async () => {
  const { e, reads, notices } = environment(0), current = e.state.match;
  await e.voteForTest('a');
  assert.equal(reads.length, 1, 'there is no automatic resubmission');
  assert.equal(reads[0].signal.aborted, true);
  assert.equal(e.state.match, current);
  assert.equal(e.state.busy, false);
  assert.match(notices[0], /提交结果未确认/);
  reads[0].resolve({ counted: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(e.state.result, undefined);
  assert.equal(e.platform.me.votes, 10);
  assert.equal(e.platform.totals.votes, 20);
  assert.equal(e.prefetches, 0);
  assert.equal(e.nexts, 0);

  const retrying = e.voteForTest('a');
  await Promise.resolve();
  reads[1].reject(Object.assign(new Error('already decided'), { status: 409, code: 'match_decided' }));
  await retrying;
  assert.match(notices[1], /这一组已提交/);
  assert.equal(e.nexts, 1);
  assert.equal(e.platform.me.votes, 10, 'an unknown receipt cannot update counters');
  assert.equal(e.prefetches, 0);
});

test('zero hold still requires both works to be ready and visited on mobile', () => {
  const e = { state: { match: { minViewSeconds: 0, minSkipSeconds: 0 }, ready: { a: true }, seen: { a: true } },
    hold: createHold(), mobile: () => true };
  vm.runInNewContext(chunk('  const bothReady =', '\n  const live =') + '\nglobalThis.gate = { canVote, voteWait, skipWait };', e);
  assert.equal(e.gate.canVote(), false);
  e.state.ready.b = true;
  assert.equal(e.gate.canVote(), false);
  e.state.seen.b = true;
  assert.equal(e.gate.canVote(), true);
  assert.equal(e.gate.voteWait(), 0);
  assert.equal(e.gate.skipWait(), 0);
});

test('an immediate vote waits for the in-flight readiness write within its own deadline', async () => {
  for (const timedOut of [false, true]) {
    const { e, reads } = environment(timedOut ? 0 : undefined);
    const ready = deferred();
    e.state.match.minViewSeconds = 0;
    e.readyRequest = ready.promise;
    const sending = e.voteForTest('a');
    await Promise.resolve();
    assert.equal(e.state.busy, true, 'the click is accepted immediately');
    assert.equal(reads.length, 0, 'the vote cannot overtake readiness');
    if (timedOut) await sending;
    ready.resolve();
    await new Promise(resolve => setImmediate(resolve));
    if (timedOut) {
      assert.equal(e.state.busy, false);
      assert.equal(reads.length, 0, 'late readiness cannot dispatch a timed-out vote');
    } else {
      assert.equal(reads.length, 1);
      assert.equal(reads[0].path, 'arena/matches/current/vote');
      reads[0].resolve({ counted: true });
      await sending;
      assert.equal(e.prefetches, 1);
    }
  }
});

test('only current ready acknowledgements set deadlines and zero stays zero', async () => {
  for (const change of ['departure', 'identity', 'reload', 'current']) {
    let version = 1, finish;
    const marked = [];
    const e = { alive: true, state: { match: { id: 'one' }, result: null }, accountVersion: () => version, AbortController, writeWithDeadline,
      hold: { begin() {}, mark(...deadline) { marked.push(deadline); }, resume() {} }, resetGate() {}, live() {}, seconds: () => 5, viewMs: () => 5000, skipMs: () => 3000,
      api: () => new Promise(resolve => { finish = resolve; }), performance: { now: () => 0.1 }, document: { hidden: false }, drawBar() {}, syncGate() {}, voteWait: () => 1, skipWait: () => 1 };
    vm.runInNewContext(chunk('  const owns =', '\n  const later') + chunk('  function startGate(', '\n  function tickGate') + '\nglobalThis.start = startGate;', e);
    e.start();
    await Promise.resolve();
    if (change === 'departure') e.alive = false;
    else if (change === 'identity') version++;
    else if (change === 'reload') e.readyController.abort();
    finish({ serverNow: '2026-01-01T00:00:00.000Z', voteAllowedAt: '2026-01-01T00:00:00.000Z', skipAllowedAt: '2026-01-01T00:00:03.000Z' });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(marked, change === 'current' ? [['vote', 0], ['skip', 3000.1]] : []);
  }
});
