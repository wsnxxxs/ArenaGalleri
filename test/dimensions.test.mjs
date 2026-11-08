import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

async function chart() {
  const original = { document: globalThis.document, window: globalThis.window, addEventListener: globalThis.addEventListener };
  globalThis.document = Object.assign(new EventTarget(), { baseURI: 'https://gallery.test/' });
  globalThis.window = new EventTarget();
  globalThis.addEventListener = globalThis.window.addEventListener.bind(globalThis.window);
  try { return await import('../site/dimensions.js'); }
  finally { Object.assign(globalThis, original); }
}

test('the radar draws dimension scores on one 900–1500 scale and rests unanswered axes on the prior', async () => {
  const { SCALE, THIN_ANSWERS, axesOf, chartedDimensions, radarPoint, rateOf, scaleOf } = await chart();
  assert.deepEqual(SCALE, { min: 900, max: 1500 });
  assert.equal(scaleOf(900), 0);
  assert.equal(scaleOf(1200), 0.5);
  assert.equal(scaleOf(1700), 1, 'scores past the scale stay on the outer ring');
  assert.equal(scaleOf(700), 0);
  assert.equal(rateOf({ win: 3, tie: 2, loss: 1, n: 6 }), 4 / 6, 'aspect win rates remain for the tooltip');

  const dimensions = chartedDimensions([
    { id: 'aesthetic', name: '审美', aspects: [{ id: 'lighting', keyword: '光影' }] },
    { id: 'craft', name: '工程完备', aspects: [{ id: 'floating', keyword: '悬空或断连' }] },
    { id: 'logic', name: '逻辑', aspects: [] },
    { id: 'fit', name: '贴题', aspects: [{ id: 'fidelity', keyword: '造型' }] },
  ]);
  assert.deepEqual(dimensions.map((dimension) => dimension.id), ['aesthetic', 'craft', 'fit'], 'a dimension without aspects is not drawn');

  const entry = { prior: 1140, dimensions: {
    aesthetic: { score: 1260, interval: 60, n: 24, thin: false, win: 15, tie: 4, loss: 5, aspects: {} },
    craft: { score: 1150, interval: 90, n: THIN_ANSWERS - 1, thin: true, win: 5, tie: 0, loss: 4, aspects: {} },
  } };
  const axes = axesOf(entry, dimensions);
  assert.deepEqual(axes.map((axis) => [axis.score, axis.thin, axis.value]), [[1260, false, 0.6], [1150, true, scaleOf(1150)], [1140, true, scaleOf(1140)]]);
  assert.deepEqual([axes[0].low, axes[0].high], [scaleOf(1200), scaleOf(1320)], 'the whisker spans the interval');
  assert.equal(axes[2].cell.n, 0);
  assert.equal(axesOf({ prior: null, dimensions: {} }, dimensions)[0].score, 1000, 'without a prior an unanswered axis rests at 1000');
  assert.equal(axesOf({ prior: 1100, dimensions: { aesthetic: { score: 1180, interval: 40, n: 12 } } }, dimensions)[0].thin, false, 'without the flag, thin follows the answer count');

  // One scale for the page: 900–1500, widened to the next hundred when a drawn value falls outside.
  const { scaleFor } = await chart();
  assert.deepEqual(scaleFor([entry], dimensions), { min: 900, max: 1500, ticks: [1000, 1200, 1400] });
  assert.deepEqual(scaleFor([], dimensions), { min: 900, max: 1500, ticks: [1000, 1200, 1400] });
  const low = { prior: 621, dimensions: { aesthetic: { score: 640, interval: 238, n: 3, thin: true } } };
  const high = { prior: 1444, dimensions: { craft: { score: 1430, interval: 90, n: 30, thin: false } } };
  const wide = scaleFor([entry, low, high], dimensions);
  assert.deepEqual(wide, { min: 400, max: 1600, ticks: [600, 1000, 1400] }, 'the interval floor 402 and the ceiling 1520 round outward');
  assert.equal(axesOf(low, dimensions, wide)[0].low, scaleOf(402, wide));
  assert.deepEqual(scaleFor([{ prior: 820, dimensions: {} }], dimensions).ticks, [1000, 1200, 1400], 'widened by 100, the rings keep their 200 steps');
  assert.deepEqual(scaleFor([{ prior: 820, dimensions: {} }], dimensions).min, 800);
  assert.ok(axesOf(low, dimensions, wide)[0].low > 0, 'on the widened scale nothing drawn is clamped');

  // Axis 0 points up from the centre and the axes run clockwise.
  const near = ([x, y], [ex, ey]) => assert.ok(Math.abs(x - ex) < 1e-9 && Math.abs(y - ey) < 1e-9, `${x},${y} vs ${ex},${ey}`);
  near(radarPoint(0, 4, 1, 70, 150, 112), [150, 42]);
  near(radarPoint(1, 4, 0.5, 70, 150, 112), [185, 112]);
  near(radarPoint(2, 4, 1, 70, 150, 112), [150, 182]);
});

test('the dimension board joins rows to their entries and the health check reads either order', async () => {
  const { FLAGS, boardRows, healthOf } = await chart();
  const data = {
    entries: [{ key: 'm1', modelName: 'One' }, { key: 'm2', modelName: 'Two' }],
    boards: { craft: [{ key: 'm2', rank: 1, score: 1210, interval: 50, n: 30, thin: false }, { key: 'gone', rank: 2, score: 1100, interval: 80, n: 4, thin: true }, { key: 'm1', rank: 3, score: 1010, interval: 70, n: 12, thin: false }] },
  };
  const rows = boardRows(data, 'craft');
  assert.deepEqual(rows.map((row) => [row.rank, row.entry.modelName]), [[1, 'Two'], [3, 'One']]);
  assert.deepEqual(boardRows(data, 'fit'), []);

  const row = { n: 40, skipRate: 0.1, flags: [], byOrder: { after: { n: 25, flags: ['ties'] }, before: { n: 15, flags: [] } } };
  assert.equal(healthOf(row, 'all'), row);
  assert.equal(healthOf(row, 'after').n, 25);
  assert.equal(healthOf({ n: 3 }, 'before'), null);
  assert.deepEqual(Object.keys(FLAGS), ['same-side', 'ties', 'skips']);
  assert.deepEqual(Object.values(FLAGS).map((flag) => flag.rate), ['sameSideRate', 'tieRate', 'skipRate']);
});

// The page run in a sandbox: imports replaced by stubs, the root a plain object whose markup is read back.
function page(response, stored = {}) {
  const source = readFileSync(new URL('../site/dimensions.js', import.meta.url), 'utf8');
  const reads = [];
  const root = Object.assign(new EventTarget(), { innerHTML: '', querySelector: () => null });
  const state = { platform: { user: { role: 'admin' } }, setPageTitle() {}, store: { get: (key) => stored[key] ?? null, set() {} },
    esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
    pad: (n) => String(n).padStart(2, '0'), formatDate: String, brandMark: () => '', vendorLine: () => '', $: () => null, $$: () => [],
    api(path) { const read = { path, ...deferred() }; reads.push(read); return read.promise; } };
  state.isStaff = () => ['admin', 'moderator'].includes(state.platform.user?.role);
  vm.runInNewContext(source.replace(/^import .*$/gm, '').replace(/^export /gm, '') + '\nglobalThis.mountForTest = mount;', state);
  const ctx = { pageStart: ({ meta }) => meta ?? '', pageEnd: () => '', sideNav: () => '', modelOf: (m) => m };
  const view = state.mountForTest(root, ctx);
  return { state, root, reads, view, answer: (i = reads.length - 1) => reads[i].resolve(structuredClone(response)) };
}
const deferred = () => { let resolve; const promise = new Promise((yes) => { resolve = yes; }); return { promise, resolve }; };
const flush = () => new Promise((resolve) => setImmediate(resolve));
const response = {
  categories: ['建模'], totals: { pairs: 1, answered: 1, voters: 1 }, health: [],
  dimensions: [{ id: 'aesthetic', name: '审美', aspects: [{ id: 'atmosphere', keyword: '<img src=x onerror=alert(1)>' }, { id: 'lighting', keyword: '光影' }] }],
  entries: [{ key: 'm1', modelName: 'One<b>', prior: null, overall: { n: 1 }, dimensions: { aesthetic: { score: 1010, interval: 80, n: 1, thin: true, win: 1, tie: 0, loss: 0, aspects: {} } } }],
  boards: { aesthetic: [{ key: 'm1', rank: 1, score: 1010, interval: 80, n: 1, thin: true }] },
};

test('server text on the dimension board is escaped, one keyword per text node', async () => {
  const e = page(response, { 'dimensions-view': 'board' });
  e.answer();
  await flush();
  assert.doesNotMatch(e.root.innerHTML, /<img/);
  assert.match(e.root.innerHTML, /<span>&lt;img src=x onerror=alert\(1\)&gt;<\/span> · <span>光影<\/span>/);
  assert.doesNotMatch(e.root.innerHTML, /One<b>/);
});

test('a staff read that lands after the account changed to a member shows the gate, not the chart', async () => {
  const e = page(response);
  assert.equal(e.reads.length, 1);
  e.state.platform.user = { role: 'user' };
  e.view.onPlatformChange('identity');
  assert.match(e.root.innerHTML, /维度图只对管理员开放/);
  e.answer(0);
  await flush();
  assert.match(e.root.innerHTML, /维度图只对管理员开放/);
  assert.doesNotMatch(e.root.innerHTML, /dims-card/);
  // Even without an identity event, a read that lands for a non-staff account is not drawn.
  const f = page(response);
  f.state.platform.user = { role: 'user' };
  f.answer(0);
  await flush();
  assert.match(f.root.innerHTML, /维度图只对管理员开放/);
});
