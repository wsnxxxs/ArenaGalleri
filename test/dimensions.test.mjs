import assert from 'node:assert/strict';
import { test } from 'node:test';

test('the dimension chart draws win rates with ties as halves and rests thin axes on 50%', async () => {
  const original = { document: globalThis.document, window: globalThis.window, addEventListener: globalThis.addEventListener };
  globalThis.document = Object.assign(new EventTarget(), { baseURI: 'https://gallery.test/' });
  globalThis.window = new EventTarget();
  globalThis.addEventListener = globalThis.window.addEventListener.bind(globalThis.window);
  let chart;
  try { chart = await import('../site/dimensions.js'); }
  finally { Object.assign(globalThis, original); }
  const { MIN_ANSWERS, axesOf, radarPoint, rateOf } = chart;

  assert.equal(rateOf({ win: 3, tie: 2, loss: 1, n: 6 }), 4 / 6);
  assert.equal(rateOf({ win: 0, tie: 0, loss: 0, n: 0 }), null);

  const dimensions = [{ id: 'aesthetic', name: '审美', aspects: [] }, { id: 'craft', name: '工程完备', aspects: [] }, { id: 'logic', name: '逻辑', aspects: [] }];
  const entry = { dimensions: {
    aesthetic: { win: MIN_ANSWERS, tie: 0, loss: 0, n: MIN_ANSWERS, aspects: {} },
    craft: { win: 1, tie: 0, loss: MIN_ANSWERS - 2, n: MIN_ANSWERS - 1, aspects: {} },
  } };
  const axes = axesOf(entry, dimensions);
  assert.deepEqual(axes.map((axis) => [axis.thin, axis.value]), [[false, 1], [true, 0.5], [true, 0.5]]);
  assert.equal(axes[1].rate, 1 / (MIN_ANSWERS - 1), 'a thin axis keeps its rate for the tooltip and table');
  assert.equal(axes[2].rate, null);

  // Axis 0 points up from the centre and the axes run clockwise.
  const near = ([x, y], [ex, ey]) => assert.ok(Math.abs(x - ex) < 1e-9 && Math.abs(y - ey) < 1e-9, `${x},${y} vs ${ex},${ey}`);
  near(radarPoint(0, 4, 1, 70, 150, 112), [150, 42]);
  near(radarPoint(1, 4, 0.5, 70, 150, 112), [185, 112]);
  near(radarPoint(2, 4, 1, 70, 150, 112), [150, 182]);
});

test('a malformed dimension response offers a retry that can load the chart', async () => {
  const original = { document: globalThis.document, window: globalThis.window, addEventListener: globalThis.addEventListener,
    fetch: globalThis.fetch, SAME_PROMPT_CONFIG: globalThis.SAME_PROMPT_CONFIG };
  globalThis.document = Object.assign(new EventTarget(), { baseURI: 'https://gallery.test/' });
  globalThis.window = new EventTarget();
  globalThis.addEventListener = globalThis.window.addEventListener.bind(globalThis.window);
  globalThis.SAME_PROMPT_CONFIG = { apiBaseUrl: 'https://backend.test/api/' };
  let reads = 0;
  const valid = { categories: [], dimensions: [], entries: [], totals: { pairs: 0, answered: 0, voters: 0 } };
  globalThis.fetch = async () => Response.json(reads++ ? valid : {});
  const { platform } = await import('../site/platform.js');
  const previous = platform.user;
  platform.user = { id: 'fixture', role: 'admin' };
  const root = Object.assign(new EventTarget(), { innerHTML: '', querySelector: () => null });
  let view;
  try {
    const { mount } = await import('../site/dimensions.js');
    view = mount(root, { pageStart: () => '', pageEnd: () => '', sideNav: () => '' });
    await new Promise(resolve => setImmediate(resolve));
    assert.match(root.innerHTML, /服务暂时不可用[^]*data-dims-retry/);
    const retry = new Event('click');
    Object.defineProperty(retry, 'target', { value: { closest: selector => selector === '[data-dims-retry]' } });
    root.dispatchEvent(retry);
    await new Promise(resolve => setImmediate(resolve));
    assert.match(root.innerHTML, /还没有测试票/);
    assert.equal(reads, 2);
  } finally {
    view?.destroy();
    platform.user = previous;
    Object.assign(globalThis, original);
  }
});
