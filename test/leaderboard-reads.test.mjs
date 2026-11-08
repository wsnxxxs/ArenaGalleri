import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../site/leaderboard.js', import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const data = (tag = 'fresh') => ({ by: 'config', rows: [], unranked: [], totals: { votes: 3, voters: 2 }, tag });

function environment(cached = null, config = undefined, ctx = {}) {
  const reads = [], rendered = [], attributes = new Map(), timers = new Map();
  let timerId = 0, memory = cached;
  const container = Object.assign(new EventTarget(), {
    innerHTML: '', querySelector: () => null, querySelectorAll: () => [],
    setAttribute: (key, value) => attributes.set(key, value), removeAttribute: key => attributes.delete(key),
    insertAdjacentHTML(_, value) { this.innerHTML = value + this.innerHTML; },
  });
  const state = { AbortController, DOMException, URLSearchParams, EventTarget, SAME_PROMPT_CONFIG: config,
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id),
    document: { activeElement: null }, store: { get: () => null, set() {} },
    $: () => null, esc: s => String(s), icon: () => '', platform: {},
    apiRemembered(path, options) {
      const read = { path, ...options, ...deferred() }; reads.push(read);
      return read.promise.then(answer => { memory = answer; return answer; });
    }, recall: () => memory,
  };
  vm.runInNewContext(source.replace(/^import .*$/gm, '').replace(/^export /gm, '') + '\nglobalThis.mountBoardForTest = mountBoard;', state);
  const board = state.mountBoardForTest(container, { embedded: false, onData: value => rendered.push(value), ...ctx });
  const click = selector => {
    const event = new Event('click');
    Object.defineProperty(event, 'target', { value: { closest: query => query === selector ? { dataset: { boardUnit: 'model' } } : null } });
    container.dispatchEvent(event);
  };
  return { board, reads, rendered, container, attributes, timers, click };
}

test('board reads coalesce, cancel a previous scope, and keep the new request busy until its own answer', async () => {
  const e = environment();
  assert.equal(e.board.reload(), e.board.ready, 'a refresh shares the active scope request');
  e.click('[data-board-unit]');
  assert.equal(e.reads.length, 2);
  assert.equal(e.reads[0].signal.aborted, true);
  await flush();
  assert.equal(e.attributes.get('aria-busy'), 'true', 'old cleanup does not finish a new read');
  e.reads[0].resolve(data('old')); await flush();
  assert.equal(e.rendered.length, 0);
  e.reads[1].resolve(data('new')); await flush();
  assert.equal(e.rendered.at(-1).tag, 'new');
  assert.equal(e.attributes.has('aria-busy'), false);
  const late = e.board.reload(), beforeDeparture = e.rendered.length;
  e.board.destroy(); e.reads[2].resolve(data('departed')); await late;
  assert.equal(e.rendered.length, beforeDeparture);
  assert.equal(e.timers.size, 0);
});

test('a body that never settles times out, offers a direct retry, and ignores its later response', async () => {
  const e = environment();
  const deadline = [...e.timers.values()].find(timer => timer.ms === 15000);
  assert.ok(deadline); deadline.fn(); await e.board.ready;
  assert.equal(e.reads[0].signal.aborted, true);
  assert.match(e.container.innerHTML, /连接超时，请重试。/);
  assert.match(e.container.innerHTML, /data-board-retry/);
  e.click('[data-board-retry]');
  assert.equal(e.reads.length, 2);
  e.reads[0].resolve(data('late')); await flush(); assert.equal(e.rendered.length, 0);
  e.reads[1].resolve(data('retry')); await flush();
  assert.equal(e.rendered.at(-1).tag, 'retry');
  e.board.destroy();
});

test('a malformed remembered board cannot poison retries, and a valid stale board survives a refresh failure', async () => {
  const e = environment();
  e.reads[0].resolve({ broken: true }); await e.board.ready;
  assert.match(e.container.innerHTML, /data-board-retry/);
  e.click('[data-board-retry]'); assert.equal(e.reads.length, 2, 'bad cached data is skipped before starting the new read');
  e.reads[1].resolve(data('recovered')); await flush();
  assert.equal(e.rendered.at(-1).tag, 'recovered');
  const refresh = e.board.reload(); e.reads[2].reject(new Error('offline')); await refresh;
  assert.equal(e.rendered.at(-1).tag, 'recovered');
  assert.match(e.container.innerHTML, /每 10 分钟更新一次/);
  assert.match(e.container.innerHTML, /offline[\s\S]*data-board-retry/);
  e.board.destroy();
});

test('the guided trial build reads the next scoring for public boards and the current one for curated boards', async () => {
  const trial = { guidedVoting: true };
  const overall = environment(null, trial);
  assert.equal(overall.reads[0].path, 'leaderboard/next?by=model');
  const scoped = environment(null, trial, { category: '建模' });
  assert.equal(scoped.reads[0].path, 'leaderboard/next?by=config&category=%E5%BB%BA%E6%A8%A1');
  const curated = environment(null, trial, { curated: true });
  assert.equal(curated.reads[0].path, 'leaderboard?by=config&audience=curated');
  const formal = environment();
  assert.equal(formal.reads[0].path, 'leaderboard?by=config', 'the formal build keeps the current endpoint and unit');
  for (const e of [overall, scoped, curated, formal]) e.board.destroy();
});
