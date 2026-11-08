import assert from 'node:assert/strict';
import test from 'node:test';

// 示意数据：every price and exchange rate below is invented for the tests, never a vendor's real price.
const PRICING = { showCost: true, asOf: '2026-11-01', fx: { USD: 7 }, models: { m1: [{ since: '2026-01-01', currency: 'CNY', input: 1, output: 4 }] } };
const OFF = { showCost: false };
const flush = () => new Promise((resolve) => setImmediate(resolve));

function globals() {
  const original = { document: globalThis.document, window: globalThis.window, addEventListener: globalThis.addEventListener,
    fetch: globalThis.fetch, SAME_PROMPT_CONFIG: globalThis.SAME_PROMPT_CONFIG, localStorage: globalThis.localStorage };
  globalThis.document = Object.assign(new EventTarget(), { baseURI: 'https://gallery.test/', activeElement: null });
  globalThis.window = new EventTarget();
  globalThis.addEventListener = globalThis.window.addEventListener.bind(globalThis.window);
  globalThis.SAME_PROMPT_CONFIG = { apiBaseUrl: 'https://backend.test/api/' };
  const settings = new Map();
  globalThis.localStorage = { getItem: (key) => settings.get(key) ?? null, setItem: (key, value) => settings.set(key, value) };
  return () => Object.assign(globalThis, original);
}
// A container whose cost body (the part the leaderboard redraws on search) is a separate node.
const box = () => {
  const body = { innerHTML: '' };
  return Object.assign(new EventTarget(), { innerHTML: '', body, setAttribute() {}, removeAttribute() {}, querySelectorAll: () => [], classList: { add() {}, remove() {} },
    querySelector(selector) { return selector === '[data-cost-body]' && this.innerHTML.includes('data-cost-body') ? body : null; } });
};
const work = (id, model, effort, output, extra = {}) => ({ id, model, modelName: model.toUpperCase(), effort, harness: extra.harness ?? 'cli',
  usage: { input: 1000, cacheRead: 50_000, output, reasoning: Math.round(output / 4), requests: 12, durationSec: 600, source: 'log' },
  artifact: { files: 2, lines: 800, bytes: 40_000, tokens: 20_000 }, ...extra });
const viewCtx = (task, pricing) => ({ task, pricing: Promise.resolve(pricing),
  label: (r) => `${r.modelName} · ${r.effort}`, modelOf: (r) => ({ id: r.model, name: r.modelName }), harnessOf: (r) => ({ name: r.harness }),
  entryKey: (r) => `${r.model}|${r.effort.toLowerCase()}`, viewHref: (t, id) => `#/${t.id}/${id}` });

test('with amounts off the task view compares tokens only; on, it adds cost in the chosen currency', async () => {
  const restore = globals();
  try {
    const { mountTaskUsage } = await import('../site/task-usage.js');
    const task = { id: 'q1', results: [work('a', 'm1', 'High', 10_000), work('b', 'm1', 'Max', 20_000), work('c', 'm2', 'High', 40_000),
      work('d', 'm1', 'High', 80_000, { generationMode: 'multi-turn' }), { id: 'e', model: 'm1', effort: 'High' }] };
    const off = box();
    const hidden = mountTaskUsage(off, viewCtx(task, OFF));
    await hidden.ready;
    assert.match(off.innerHTML, /<h2>用量对比<\/h2>/);
    assert.doesNotMatch(off.innerHTML, /[¥$]|花费|data-value="cost"|data-value="CNY"/, 'no amounts, cost metric or currency while the switch is off');
    assert.match(off.innerHTML, /data-value="tokens" aria-pressed="true"/);
    assert.match(off.innerHTML, /3 件计入 · 共 5 件作品，4 件有记录/, 'the multi-turn record is shown only on request');
    assert.match(off.innerHTML, /<dt>本题中位<\/dt>/);
    assert.equal((off.innerHTML.match(/class="usage-row"/g) ?? []).length, 3);
    assert.match(off.innerHTML, /<s style="left:/, 'three counted works draw the median');
    assert.match(off.innerHTML, /aria-describedby="usage-tip-1"/);
    // Grouped rows carry their names for the search, like single works.
    const select = (value) => { const event = new Event('change'); Object.defineProperty(event, 'target', { value: { value, matches: (q) => q === '[data-usage-group]' } }); off.dispatchEvent(event); };
    select('model');
    assert.deepEqual([...off.innerHTML.matchAll(/class="usage-row is-group" data-usage-row="([^"]+)"/g)].map((m) => m[1]).sort(), ['m1', 'm2']);
    const on = box();
    const shown = mountTaskUsage(on, viewCtx(task, PRICING));
    await shown.ready;
    assert.equal(shown.shown(), true);
    assert.match(on.innerHTML, /<h2>花费对比<\/h2>/);
    assert.match(on.innerHTML, /data-value="cost" aria-pressed="true"/);
    assert.match(on.innerHTML, /data-value="CNY"/);
    assert.match(on.innerHTML, /<span>\$0\.\d+<\/span>/, 'English locale defaults to dollars');
    assert.match(on.innerHTML, /<dt>计入<\/dt><dd><b>2 件<\/b><small>不足 3 件，暂无中位<\/small>/, 'the unpriced model leaves two works on cost');
    hidden.destroy(); shown.destroy();
  } finally { restore(); }
});

test('a question with one record shows that record whole instead of a lone bar', async () => {
  const restore = globals();
  try {
    const { mountTaskUsage } = await import('../site/task-usage.js');
    const others = Array.from({ length: 4 }, (_, i) => ({ id: `o${i}`, model: 'm2', effort: 'High', artifact: { files: 1, lines: 100, bytes: 1000, tokens: 5000 * (i + 1) } }));
    const task = { id: 'q2', results: [work('only', 'm1', 'Max', 46_723), ...others] };
    const container = box();
    const view = mountTaskUsage(container, viewCtx(task, OFF));
    await view.ready;
    assert.match(container.innerHTML, /本题目前只有这一件有用量记录/);
    assert.doesNotMatch(container.innerHTML, /usage-rows|usage-toolbar/, 'no sorting controls or rows for a single record');
    assert.match(container.innerHTML, /其中推理/);
    assert.match(container.innerHTML, /产物体量在本题 5 件作品中的位置/);
    assert.doesNotMatch(container.innerHTML, /[¥$]/);
    view.destroy();
    // Amounts on: the card keeps its currency switch.
    const priced = box();
    const shown = mountTaskUsage(priced, viewCtx(task, PRICING));
    await shown.ready;
    assert.match(priced.innerHTML, /usage-card-tools"><div class="seg" role="group" aria-label="币种"><button type="button" data-usage-set="currency" data-value="CNY"/);
    assert.match(priced.innerHTML, /<span>2 lines<\/span>|<span>100 行<\/span>|<span>800 行<\/span>/, 'each artifact fact is its own text node');
    shown.destroy();
  } finally { restore(); }
});

// Eight configurations with one work on each of five questions: the chart's opening threshold exactly.
function leaderboardData() {
  const configs = Array.from({ length: 8 }, (_, i) => [`m${i}`, i % 2 ? 'High' : 'Max']);
  const tasks = Array.from({ length: 5 }, (_, t) => ({ id: `t${t}`, category: '建模', results: configs.map(([model, effort], i) => work(`w${t}-${i}`, model, effort, 10_000 * (i + 1) * (t + 1))) }));
  const models = Object.fromEntries(configs.map(([model]) => [model, [{ since: '2026-01-01', currency: 'CNY', input: 1, output: 4 }]]));
  const rows = configs.map(([model, effort], i) => ({ rank: i + 1, key: `${model}|${effort.toLowerCase()}`, model, modelName: model.toUpperCase(), effort,
    score: 1200 - i * 20, interval: 30, games: 100, wins: 50, draws: 10, losses: 40, winRate: 0.55, works: 5, provisional: false }));
  return { tasks, pricing: { ...PRICING, models }, board: { by: 'config', rows, unranked: [], totals: { votes: 800, voters: 90 }, provisionalGames: 30 } };
}
const boardCtx = (data, pricing, extra = {}) => ({ DATA: { tasks: data.tasks }, pricing: Promise.resolve(pricing), view: 'rank', ...extra,
  label: (r) => `${r.modelName} · ${r.effort}`, modelOf: (r) => ({ id: r.model, name: r.modelName, vendor: 'Test' }), harnessOf: (r) => ({ name: r.harness }),
  providerOf: () => null, modelKey: (r) => r.model, entryKey: (r) => `${r.model}|${r.effort.toLowerCase()}` });

test('the leaderboard gains a cost column and a cost chart only when amounts are on and the threshold is met', async () => {
  const restore = globals();
  const data = leaderboardData();
  globalThis.fetch = async () => Response.json(data.board);
  try {
    const { mountBoard } = await import('../site/leaderboard.js');
    const draw = async (pricing, extra) => {
      const container = box();
      const board = mountBoard(container, boardCtx(data, pricing, extra));
      await board.ready; await flush(); await flush();
      board.destroy();
      return container.innerHTML;
    };
    const off = await draw(OFF);
    assert.doesNotMatch(off, /c-cost|data-board-view|花费/, 'switch off: the board is unchanged');
    const on = await draw(data.pricing);
    assert.equal((on.match(/<td class="c-cost">/g) ?? []).length, 8);
    assert.match(on, /<th class="c-cost" scope="col">花费<\/th>/);
    assert.match(on, /data-board-view="cost" aria-pressed="false"/);
    assert.match(on, /<span class="badge cost-tag">前沿<\/span>/);
    assert.match(on, /¥[\d.]+ \/ 件 · 5 件/);
    const chart = await draw(data.pricing, { view: 'cost' });
    assert.match(chart, /<svg class="cost-chart"/);
    assert.match(chart, /class="cc-dot is-front"/);
    assert.match(chart, /查看数据表/);
    assert.match(chart, /<div data-cost-body>/);
    // Search narrows the chart and its table.
    const searched = box();
    const searching = mountBoard(searched, boardCtx(data, data.pricing, { view: 'cost' }));
    await searching.ready; await flush(); await flush();
    searching.search('m3');
    assert.match(searched.body.innerHTML, /<b data-i18n-ignore>M3 · High<\/b>/);
    assert.doesNotMatch(searched.body.innerHTML, /M4 · Max/);
    searching.search('no-such-model');
    assert.match(searched.body.innerHTML, /没有匹配的模型/);
    assert.doesNotMatch(searched.body.innerHTML, /cost-chart/);
    searching.destroy();
    // A configuration that cost nothing stays off the log axis, named under it, and the chart still draws.
    const free = { ...data, tasks: data.tasks.map((t) => ({ ...t, results: t.results.map((w, i) => i ? w : { ...w, usage: { ...w.usage, input: 0, cacheRead: 0, output: 0, reasoning: 0 } }) })) };
    const zeroChart = await (async () => {
      const container = box();
      const board = mountBoard(container, boardCtx(free, data.pricing, { view: 'cost' }));
      await board.ready; await flush(); await flush(); board.destroy();
      return container.innerHTML;
    })();
    assert.match(zeroChart, /<svg class="cost-chart"/);
    assert.match(zeroChart, /花费为 0，无法画在对数轴上：<span data-i18n-ignore>M0 · Max<\/span>/);
    // One configuration short of the threshold: no column, and the chart explains instead of drawing.
    const short = { ...data, tasks: data.tasks.map((t) => ({ ...t, results: t.results.slice(1) })) };
    globalThis.fetch = async () => Response.json(data.board);
    const closedBoard = await (async () => {
      const container = box();
      const board = (await import('../site/leaderboard.js')).mountBoard(container, boardCtx(short, data.pricing, { view: 'cost' }));
      await board.ready; await flush(); await flush(); board.destroy();
      return container.innerHTML;
    })();
    assert.match(closedBoard, /花费图还在积累记录/);
    assert.doesNotMatch(closedBoard, /class="cost-chart"/);
  } finally { restore(); }
});

test('the chart takes only positive costs, and the pricing read happens once even when it fails', async () => {
  const restore = globals();
  try {
    const { scatter } = await import('../site/cost-chart.js');
    const svg = scatter([{ key: 'z', name: 'Z', x: 0, y: 1000 }, { key: 'a', name: 'A', x: 1, y: 1100 }, { key: 'b', name: 'B', x: 2, y: 1050 }]);
    assert.match(svg, /<svg class="cost-chart"/);
    assert.doesNotMatch(svg, /<title>Z /, 'the zero point is not drawn');
    assert.equal(scatter([{ key: 'z', name: 'Z', x: 0, y: 1000 }]), '');
    let reads = 0;
    globalThis.fetch = async () => { reads++; return Response.json({ error: 'not found' }, { status: 404 }); };
    const { pricingInfo } = await import('../site/platform.js');
    assert.deepEqual(await pricingInfo(), { showCost: false });
    assert.deepEqual(await pricingInfo(), { showCost: false });
    assert.equal(reads, 1, 'a missing endpoint is asked once per visit');
  } finally { restore(); }
});
