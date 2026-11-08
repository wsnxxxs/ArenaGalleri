import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as usage from '../site/usage.js';

// usage-view.js in a sandbox: its imports become stubs, its arithmetic stays usage.js's. Prices here are
// illustrative, not real.
function view(pricing, { staff = false } = {}) {
  const source = readFileSync(new URL('../site/usage-view.js', import.meta.url), 'utf8')
    .replace(/^import [\s\S]*?;$/gm, '').replace(/^export /gm, '');
  const context = { ...usage, esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`), store: { get: () => null },
    pricingInfo: () => Promise.resolve(pricing), isStaff: () => staff, locale: () => 'zh-CN' };
  vm.runInNewContext(`${source}\nglobalThis.t = { loadPricing, usageLine, cardUsage, usageBlock, revealUsage, revealCompare };`, context);
  return context.t;
}
const PRICES = { showCost: true, asOf: '2026-11-01', fx: { USD: 7 }, models: { m: [{ since: '2026-01-01', currency: 'USD', input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 }] } };
const work = (id, input, output, extra = {}) => ({ id, model: 'm', modelName: 'Model', generationMode: 'single-turn', humanIntervention: 'none',
  usage: { input, cacheRead: 1_000_000, output, durationSec: 980, source: 'log', ...extra } });

test('with the switch off no amount appears anywhere, only tokens and time', async () => {
  const t = view({ showCost: false });
  await t.loadPricing();
  const a = work('a', 31_000, 61_000, { paid: { basis: 'subscription' } });
  assert.doesNotMatch(t.usageLine(a), /[¥$]/);
  assert.match(t.usageLine(a), /1\.1M tok/);
  assert.doesNotMatch(t.usageBlock(a, { results: [a] }), /[¥$]|花费|实付|价格/);
  const compare = t.revealCompare(a, work('b', 10_000, 20_000), 'a');
  assert.match(compare, /你选的 A 用的 token 是 B 的 1\.0[0-9]* 倍|两边用的 token 差不多/);
  assert.doesNotMatch(compare, /[¥$]/);
  assert.equal(t.cardUsage({ id: 'x' }), '', 'a work without a record keeps its card as it was');
  assert.equal(t.revealUsage({ id: 'x' }), '', 'and shows nothing after the reveal');
  assert.equal(t.revealCompare(a, { id: 'x' }, 'a'), '', 'the comparison needs both sides recorded');
});

test('with the switch on amounts lead, unpriced works say so, and the comparison is by cost', async () => {
  const t = view(PRICES);
  await t.loadPricing();
  const priced = work('a', 31_000, 61_000);
  assert.match(t.usageLine(priced), /<b class="usage-money">¥/);
  assert.match(t.usageLine({ ...priced, model: 'unknown' }), /未定价/);
  const cheap = work('b', 1_000, 2_000, { cacheRead: 0 });
  assert.match(t.revealCompare(priced, cheap, 'b'), /A 花费是你选的 B 的 \d+ 倍/);
  assert.match(t.usageBlock(priced, { results: [priced] }), /按官方标价折算/);
});

test('administrators see the edit entry; readers see nothing for unrecorded works', async () => {
  const reader = view({ showCost: false }), staff = view({ showCost: false }, { staff: true });
  assert.equal(reader.usageBlock({ id: 'x' }, { results: [] }), '');
  assert.equal(staff.usageBlock({ id: 'x' }, { results: [] }), '', 'an older server without usage: no entry');
  assert.match(staff.usageBlock({ id: 'x' }, { results: [] }, { entry: true }), /未录入用量[\s\S]*data-usage-edit/);
  assert.doesNotMatch(reader.usageBlock(work('a', 1, 2), { results: [] }), /data-usage-edit/);
});
