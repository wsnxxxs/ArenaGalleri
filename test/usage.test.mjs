import assert from 'node:assert/strict';
import test from 'node:test';
import { GROUP, chartOpen, costOf, costShown, exclusion, formatDuration, formatMoney, formatMultiple, formatTokens, frontier,
  geometricMean, groupCosts, groupStatus, median, priceFor, taskMedian, tokensOf, valueOf } from '../site/usage.js';

// 示意数据：all prices and exchange rates here are invented for the tests, not real vendor prices.
const PRICING = {
  asOf: '2026-11-01', fx: { USD: 7 },
  models: {
    alpha: [
      { since: '2026-01-01', currency: 'USD', input: 2, output: 10 },
      { since: '2026-08-20', currency: 'USD', input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
      { since: '2026-12-01', currency: 'USD', input: 50, output: 250 },
    ],
    beta: [{ since: '2026-09-10', currency: 'CNY', input: 1, output: 4 }],
    gamma: [{ since: '2026-09-10', currency: 'EUR', input: 1, output: 4 }],
  },
};

test('the price is the latest entry dated no later than the table, and unknown models are unpriced', () => {
  assert.equal(priceFor(PRICING, 'alpha').input, 5);
  assert.equal(priceFor({ ...PRICING, asOf: '2026-06-01' }, 'alpha').input, 2);
  assert.equal(priceFor(PRICING, 'nobody'), null);
  assert.equal(priceFor(null, 'alpha'), null);
  // A table without a date uses today: never an entry that starts later.
  const undated = { ...PRICING, asOf: null };
  assert.equal(priceFor(undated, 'alpha', '2026-11-08').input, 5);
  assert.equal(priceFor(undated, 'alpha', '2026-12-02').input, 50);
  assert.equal(priceFor({ asOf: null, models: { later: [{ since: '2099-01-01', currency: 'CNY', input: 1, output: 1 }] } }, 'later', '2026-11-08'), null);
  assert.equal(priceFor({ asOf: null, models: { later: [{ since: '2099-01-01', currency: 'CNY', input: 1, output: 1 }] } }, 'later'), null, 'today by default');
});

test('cost multiplies each kind of token by its price, converts to CNY, and defaults cache prices to input', () => {
  const usage = { input: 31_000, cacheRead: 1_620_000, cacheWrite: 148_000, output: 61_000, reasoning: 23_000 };
  const alpha = costOf(usage, priceFor(PRICING, 'alpha'), PRICING.fx);
  // (31k×5 + 1.62M×0.5 + 148k×6.25 + 61k×25) / 1M USD = 3.415 USD → ×7 CNY; reasoning is inside output.
  assert.ok(Math.abs(alpha.total - 3.415 * 7) < 1e-9);
  assert.ok(Math.abs(alpha.parts.output - 61_000 * 25 / 1e6 * 7) < 1e-9);
  const beta = costOf(usage, priceFor(PRICING, 'beta'), PRICING.fx);
  assert.ok(Math.abs(beta.parts.cacheRead - 1.62) < 1e-9, 'cache read billed at the input price');
  assert.ok(Math.abs(beta.parts.cacheWrite - 0.148) < 1e-9);
  assert.equal(costOf({ output: 10 }, priceFor(PRICING, 'beta'), PRICING.fx), null, 'no input/output split, no cost');
  assert.equal(costOf(usage, priceFor(PRICING, 'gamma'), PRICING.fx), null, 'no exchange rate, no cost');
  assert.equal(costOf(usage, { currency: 'USD', input: 1, output: 1, tiered: true }, PRICING.fx).tiered, true);
});

test('token totals leave reasoning inside output; one kind can be asked for', () => {
  const usage = { input: 10, cacheRead: 100, output: 20, reasoning: 5 };
  assert.equal(tokensOf(usage), 130);
  assert.equal(tokensOf(usage, 'reasoning'), 5);
  assert.equal(tokensOf(usage, 'cacheWrite'), null, 'not recorded is not zero');
  assert.equal(tokensOf({ requests: 3 }), null);
  assert.equal(valueOf({ usage, artifact: { chars: 900 } }, 'artifact'), 900, 'writing counts characters');
  assert.equal(valueOf({ usage: { requests: 38 } }, 'requests'), 38);
});

test('only single-turn work without intervention counts, and cost also needs a price', () => {
  const work = { model: 'beta', usage: { input: 1, output: 1 } };
  assert.equal(exclusion(work, 'cost', PRICING), null);
  assert.equal(exclusion({ ...work, generationMode: 'multi-turn' }, 'tokens', PRICING), 'multi-turn');
  assert.equal(exclusion({ ...work, humanIntervention: 'code-edited' }, 'tokens', PRICING), 'intervention');
  assert.equal(exclusion({ ...work, model: 'nobody' }, 'cost', PRICING), 'unpriced');
  assert.equal(exclusion({ ...work, model: 'nobody' }, 'tokens', PRICING), null, 'unpriced work still compares on tokens');
  assert.equal(exclusion({ ...work, usage: { requests: 2 } }, 'duration', PRICING), 'missing');
});

test('a question median needs three counted works; geometric means cancel 0.5× against 2×', () => {
  assert.equal(taskMedian([1, 2]), null);
  assert.equal(taskMedian([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.ok(Math.abs(geometricMean([0.5, 2]) - 1) < 1e-12);
  // The design's example: 0.5×, 0.8×, 2× → 0.93×, where the arithmetic mean would say 1.10×.
  assert.equal(formatMultiple(geometricMean([0.5, 0.8, 2])), '0.93×');
});

test('groups take each work over its question median, keyed by model, configuration, Harness or both', () => {
  // Three questions, four works each, all priced in CNY so costs are easy to read (示意数据).
  const work = (model, effort, harness, output, extra = {}) => ({ model, effort, harness, usage: { input: 0, output }, ...extra });
  const tasks = [
    { id: 'q1', results: [work('beta', 'High', 'cli', 1e6), work('beta', 'Max', 'cli', 2e6), work('beta', 'High', 'ide', 4e6), work('beta', 'Max', 'ide', 8e6)] },
    { id: 'q2', results: [work('beta', 'High', 'cli', 2e6), work('beta', 'Max', 'cli', 4e6), work('beta', 'High', 'ide', 8e6), work('beta', 'Max', 'ide', 16e6, { generationMode: 'multi-turn' })] },
    { id: 'q3', results: [work('beta', 'High', 'cli', 1e6), work('nobody', 'High', 'cli', 1e6)] },
  ];
  const byConfig = groupCosts(tasks, { pricing: PRICING, keyOf: (w) => `${w.model}|${w.effort.toLowerCase()}` });
  // At 4 CNY per million output tokens, q1 costs 4, 8, 16, 32 CNY → median 12; q2 counts 8, 16, 32 → 16.
  assert.equal(byConfig.get('beta|high').works, 4);
  assert.ok(Math.abs(byConfig.get('beta|high').multiple - geometricMean([4 / 12, 16 / 12, 8 / 16, 32 / 16])) < 1e-12);
  assert.equal(byConfig.get('beta|high').tasks, 2, 'q3 has one counted work, so no median and no multiples');
  assert.equal(byConfig.get('beta|max').works, 3, 'the multi-turn work is left out');
  const byHarness = groupCosts(tasks, { pricing: PRICING, keyOf: (w) => w.harness });
  assert.deepEqual([...byHarness.keys()].sort(), ['cli', 'ide']);
  const both = groupCosts(tasks, { pricing: PRICING, keyOf: (w) => `${w.model}+${w.harness}`, include: (w) => w.harness === 'cli' });
  assert.deepEqual([...both.keys()], ['beta+cli'], 'a filter picks works');
  assert.ok(Math.abs(both.get('beta+cli').multiple - geometricMean([4 / 12, 8 / 12, 8 / 16, 16 / 16])) < 1e-12, 'but keeps the whole question as 1×');
});

test('thresholds: under 3 works or one question is insufficient, 3–4 provisional; the chart opens at 8×5', () => {
  assert.equal(groupStatus({ works: 2, tasks: 2 }), 'insufficient');
  assert.equal(groupStatus({ works: 9, tasks: 1 }), 'insufficient');
  assert.equal(groupStatus({ works: GROUP.min, tasks: 2 }), 'provisional');
  assert.equal(groupStatus({ works: 4, tasks: 3 }), 'provisional');
  assert.equal(groupStatus({ works: 5, tasks: 2 }), 'firm');
  const groups = (n, works) => new Map(Array.from({ length: n }, (_, i) => [i, { works }]));
  assert.equal(chartOpen(groups(8, 5)), true);
  assert.equal(chartOpen(groups(7, 9)), false);
  assert.equal(chartOpen(groups(12, 4)), false);
});

test('the frontier keeps points no other point beats on both cost and score', () => {
  const points = [{ id: 'a', x: 0.1, y: 1030 }, { id: 'b', x: 0.2, y: 1020 }, { id: 'c', x: 0.12, y: 1088 },
    { id: 'd', x: 2.86, y: 1320 }, { id: 'e', x: 4.05, y: 1319 }, { id: 'f', x: 0.12, y: 1080 }];
  assert.deepEqual(frontier(points).map((p) => p.id), ['a', 'c', 'd']);
  assert.deepEqual(frontier([]), []);
  // Two entries at exactly the same cost and score do not dominate each other: both stay.
  assert.deepEqual(frontier([{ id: 'a', x: 1, y: 1000 }, { id: 'b', x: 1, y: 1000 }, { id: 'c', x: 2, y: 900 }]).map((p) => p.id), ['a', 'b']);
  assert.deepEqual(frontier([{ id: 'a', x: 1, y: 1000 }, { id: 'b', x: 1, y: 990 }]).map((p) => p.id), ['a']);
  assert.deepEqual(frontier([{ id: 'z', x: 0, y: 950 }, { id: 'a', x: 1, y: 1000 }]).map((p) => p.id), ['z', 'a'], 'a free entry leads the frontier');
});

test('formatting: compact tokens, money in the chosen currency, multiples and durations', () => {
  assert.equal(formatTokens(950), '950');
  assert.equal(formatTokens(1_500), '1.5k');
  assert.equal(formatTokens(31_000), '31k');
  assert.equal(formatTokens(1_620_000), '1.6M');
  assert.equal(formatTokens(2_000_000), '2M');
  assert.equal(formatMoney(24.31, 'CNY', PRICING.fx), '¥24.31');
  assert.equal(formatMoney(7, 'USD', PRICING.fx), '$1.00');
  assert.equal(formatMoney(0.064, 'CNY', PRICING.fx), '¥0.064');
  assert.equal(formatMoney(1234.5, 'CNY', PRICING.fx), '¥1,235');
  assert.equal(formatMoney(5, 'USD', {}), '—', 'no rate, no dollars');
  assert.equal(formatMultiple(2.857), '2.86×');
  assert.equal(formatMultiple(12.34), '12.3×');
  assert.equal(formatDuration(45), '45 秒');
  assert.equal(formatDuration(980), '16 分 20 秒');
  assert.equal(formatDuration(3900), '1 小时 5 分');
  assert.equal(formatDuration(3600), '1 小时');
});

test('amounts stay hidden unless the server switch is on', () => {
  assert.equal(costShown(undefined), false);
  assert.equal(costShown({}), false);
  assert.equal(costShown({ showCost: 'yes' }), false);
  assert.equal(costShown({ showCost: true }), true);
});
