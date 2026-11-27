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
    assert.match(off.innerHTML, /<h2>用量<\/h2>/);
    assert.match(off.innerHTML, /<p class="usage-lede"><span>这道题的作品生成时用了多少 token、用了多久。<\/span>/, 'the page says what it answers');
    assert.doesNotMatch(off.innerHTML, /[¥$]|花费|data-value="cost"|data-value="CNY"/, 'no amounts, cost metric or currency while the switch is off');
    assert.match(off.innerHTML, /data-value="tokens" aria-pressed="true"/);
    assert.match(off.innerHTML, /目前 4 件有记录，3 件参与比较。/, 'the multi-turn record is shown only on request');
    assert.match(off.innerHTML, /<dt>本题中位数<\/dt>/);
    // Each row names who made the work first: model and level, then Harness.
    assert.match(off.innerHTML, /<span class="usage-name"><b data-i18n-ignore>M1<\/b><span class="badge" data-i18n-ignore>High<\/span><small><span data-i18n-ignore>cli<\/span><\/small>/);
    assert.equal((off.innerHTML.match(/class="usage-row"/g) ?? []).length, 3);
    assert.match(off.innerHTML, /<s style="left:/, 'three counted works draw the median');
    assert.match(off.innerHTML, /aria-describedby="usage-tip-1"/);
    // Grouped rows carry their names for the search, like single works.
    const select = (value) => { const event = new Event('change'); Object.defineProperty(event, 'target', { value: { value, matches: (q) => q === '[data-usage-group]' } }); off.dispatchEvent(event); };
    select('model');
    assert.match(off.innerHTML, /<dt>本题中位数<\/dt><dd><b>71k token/, 'grouping keeps the three-work question median in the summary');
    assert.deepEqual([...off.innerHTML.matchAll(/class="usage-row is-group" data-usage-row="([^"]+)"/g)].map((m) => m[1]).sort(), ['m1', 'm2']);
    const on = box();
    const shown = mountTaskUsage(on, viewCtx(task, PRICING));
    await shown.ready;
    assert.equal(shown.shown(), true);
    assert.match(on.innerHTML, /<h2>花费<\/h2>/);
    assert.match(on.innerHTML, /data-value="cost" aria-pressed="true"/);
    assert.match(on.innerHTML, /data-value="CNY"/);
    assert.match(on.innerHTML, /<span>\$0\.\d+<\/span>/, 'English locale defaults to dollars');
    assert.match(on.innerHTML, /<dt>参与比较<\/dt><dd><b>2 件<\/b><small>不足 3 件，还没有中位数<\/small>/, 'the unpriced model leaves two works on cost');
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
    // The work is the subject: who made it, linked to its preview, before any number.
    assert.match(container.innerHTML, /<a class="usage-who-link" href="#\/q2\/only">[^]*<b data-i18n-ignore>M1<\/b><span class="badge" data-i18n-ignore>Max<\/span>[^]*<span data-i18n-ignore>cli<\/span> · <span>单轮生成<\/span>/);
    assert.match(container.innerHTML, /<dt>总 token<\/dt><dd>98k<\/dd>[^]*<dt>生成耗时<\/dt><dd>10 分<\/dd>[^]*<dt>请求次数<\/dt><dd>12 次<\/dd>/);
    assert.match(container.innerHTML, /<span>其中 51% 是缓存读取，也就是每次请求重复读入的上下文。<\/span><span>模型写出 47k token，其中推理 12k。<\/span>/);
    assert.match(container.innerHTML, /<details class="usage-more"><summary>构成明细/, 'the breakdown waits behind a disclosure');
    assert.match(container.innerHTML, /<small class="usage-part-why">每次请求重复读入的上下文<\/small>/);
    assert.match(container.innerHTML, /目前只有这一件有用量记录。有 3 件以上时/);
    assert.doesNotMatch(container.innerHTML, /usage-stats/, 'no second set of the same numbers');
    assert.doesNotMatch(container.innerHTML, /usage-rows|usage-toolbar/, 'no sorting controls or rows for a single record');
    assert.match(container.innerHTML, /其中推理/);
    assert.match(container.innerHTML, /<span>交付代码 800 行、20k token<\/span><span>，比本题 60% 的作品长。<\/span>/);
    // A size of 0 is a real size: it counts for the median and the share, and sits at the strip's left end.
    const sized = (id, tokens, extra = {}) => ({ id, model: 'm2', effort: 'High', artifact: { files: 1, lines: 10, bytes: 100, tokens }, ...extra });
    const zeroTask = { id: 'q3', results: [sized('z0', 0), sized('z1', 1000), { ...work('z2', 'm1', 'Max', 1000), artifact: { files: 1, lines: 10, bytes: 100, tokens: 2000 } }, sized('z3', 3000), sized('z4', 4000)] };
    const zeroBox = box();
    const zeroView = mountTaskUsage(zeroBox, viewCtx(zeroTask, OFF));
    await zeroView.ready;
    assert.match(zeroBox.innerHTML, /<span>交付代码 10 行、2k token<\/span><span>，比本题 40% 的作品长。<\/span>/);
    assert.match(zeroBox.innerHTML, /<span><span>中位数<\/span> <span>2k token<\/span><\/span>/, 'label and value are separate text nodes');
    assert.match(zeroBox.innerHTML, /<p class="usage-scale" aria-hidden="true"><span>0 token<\/span>/);
    assert.match(zeroBox.innerHTML, /1 件作品的体量为 0，画在最左端。/);
    assert.match(zeroBox.innerHTML, /<i style="left:0\.00%"><\/i>/, 'the zero sits at the left end');
    zeroView.destroy();
    // Every mark of the strip stays on it, whatever the mix of zero and positive sizes.
    const strip = async (sizes, ownIndex) => {
      const results = sizes.map((tokens, i) => i === ownIndex
        ? { ...work(`s${i}`, 'm1', 'Max', 1000), artifact: { files: 1, lines: 10, bytes: 100, tokens } }
        : sized(`s${i}`, tokens));
      const holder = box();
      const view = mountTaskUsage(holder, viewCtx({ id: 'q4', results }, OFF));
      await view.ready; view.destroy();
      const dots = holder.innerHTML.match(/<div class="usage-dots"[^]*?<\/div>/)?.[0] ?? '';
      return { html: holder.innerHTML, dots, lefts: [...dots.matchAll(/left:(-?[\d.]+)%/g)].map((m) => Number(m[1])) };
    };
    const half = await strip([0, 0, 1000, 2000], 2);
    assert.match(half.html, /<span>中位数<\/span> <span>500 token<\/span>/);
    assert.ok(half.lefts.length && half.lefts.every((x) => x >= 0 && x <= 100), `half zero: ${half.lefts}`);
    const medianMark = Number(half.dots.match(/<s style="left:([\d.]+)%/)[1]);
    assert.ok(medianMark >= 6 && medianMark <= 100, 'a positive median is drawn on the positive part, not pushed to 0');
    const allZero = await strip([0, 0, 0], 0);
    assert.equal(allZero.dots, '', 'nothing to draw on a log strip');
    assert.match(allZero.html, /<span>交付代码 10 行、0 token<\/span>/);
    for (const [label, sizes, ownIndex] of [['one positive', [0, 0, 1000], 2], ['median 0', [0, 0, 0, 1000], 3], ['this work at 0', [0, 1000, 2000], 0], ['no zeros', [500, 1000, 2000], 1]]) {
      const { lefts, dots } = await strip(sizes, ownIndex);
      assert.ok(dots && lefts.every((x) => x >= 0 && x <= 100), `${label}: ${lefts}`);
    }
    assert.doesNotMatch(container.innerHTML, /[¥$]/);
    view.destroy();
    // Amounts on: the card keeps its currency switch.
    const priced = box();
    const shown = mountTaskUsage(priced, viewCtx(task, PRICING));
    await shown.ready;
    assert.match(priced.innerHTML, /usage-who-tools"><div class="seg" role="group" aria-label="币种"><button type="button" data-usage-set="currency" data-value="CNY"/);
    assert.match(priced.innerHTML, /<dt>花费<\/dt><dd>/);
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
    // Usage arrives on its own read, asked for only once amounts are on, and laid onto the same works.
    const bare = { ...data, tasks: data.tasks.map((t) => ({ ...t, results: t.results.map(({ usage, ...w }) => w) })) };
    const lay = () => { calls++; bare.tasks.forEach((t, i) => t.results.forEach((w, j) => { w.usage = data.tasks[i].results[j].usage; })); return Promise.resolve(); };
    let calls = 0;
    const late = async (pricing) => {
      const container = box();
      const board = mountBoard(container, boardCtx(bare, pricing, { loadMetrics: lay }));
      await board.ready; await flush(); await flush(); await flush();
      board.destroy();
      return container.innerHTML;
    };
    assert.doesNotMatch(await late(OFF), /c-cost/);
    assert.equal(calls, 0, 'no metrics read while amounts are off');
    assert.equal(((await late(data.pricing)).match(/<td class="c-cost">/g) ?? []).length, 8);
    assert.equal(calls, 1);
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
    assert.match(scatter([{ name: 'Large', x: 100, y: 1050 }]), /<title>Large · 100×/);
    assert.equal(scatter([{ key: 'z', name: 'Z', x: 0, y: 1000 }]), '');
    // A frontier step from zero cost has no ratio: it says where it starts and gives the score difference.
    const { frontierSteps } = await import('../site/cost-chart.js');
    const steps = frontierSteps([{ name: 'Z', x: 0, y: 1000 }, { name: 'A', x: 1, y: 1100 }, { name: 'B', x: 2, y: 1150 }]);
    assert.doesNotMatch(steps, /Infinity|NaN/);
    assert.match(steps, /<li class="cost-step" aria-hidden="true"><span>从零花费起<\/span><span>\+100<\/span><\/li>/);
    assert.match(steps, /<span>×2\.0<\/span><span>\+50<\/span>/);
    let reads = 0;
    globalThis.fetch = async () => { reads++; return Response.json({ error: 'not found' }, { status: 404 }); };
    const { pricingInfo } = await import('../site/platform.js');
    assert.deepEqual(await pricingInfo(), { showCost: false, supported: false });
    assert.deepEqual(await pricingInfo(), { showCost: false, supported: false });
    assert.equal(reads, 1, 'a missing endpoint is asked once per visit');
    // Metrics: one read per visit, a failure or a malformed answer counts as no records.
    const { metricsInfo } = await import('../site/platform.js');
    reads = 0;
    assert.deepEqual(await metricsInfo(), { usage: {}, artifact: {}, supported: false }, 'an older server: no usage capability');
    assert.deepEqual(await metricsInfo(), { usage: {}, artifact: {}, supported: false });
    assert.equal(reads, 1);
  } finally { restore(); }
});

test('a metrics answer is taken by question and work, and anything else in it is ignored', async () => {
  const restore = globals();
  try {
    let reads = 0;
    globalThis.fetch = async () => { reads++; return Response.json({ usage: { q1: { a: { input: 1, output: 2, source: 'log' } } }, artifact: [], extra: 1 }); };
    const { metricsInfo } = await import('../site/platform.js?metrics-shape');
    assert.deepEqual(await metricsInfo(), { usage: { q1: { a: { input: 1, output: 2, source: 'log' } } }, artifact: {}, supported: true });
    await metricsInfo();
    assert.equal(reads, 1);
    // A server with usage but nothing recorded yet, and amounts off: both supported.
    globalThis.fetch = async (url) => Response.json(String(url).endsWith('pricing') ? { showCost: false } : { usage: {}, artifact: {} });
    const fresh = await import('../site/platform.js?metrics-empty');
    assert.deepEqual(await fresh.metricsInfo(), { usage: {}, artifact: {}, supported: true });
    assert.deepEqual(await fresh.pricingInfo(), { showCost: false, supported: true });
  } finally { restore(); }
});
