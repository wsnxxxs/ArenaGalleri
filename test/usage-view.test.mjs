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
  const context = { ...usage, esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`), store: { get: () => null }, icon: () => '<svg></svg>',
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
  assert.match(t.usageLine(a), /1\.1M token/);
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
  assert.match(t.usageBlock(priced, { results: [priced] }), /<h3>花费<\/h3>[\s\S]*<dt>花费<\/dt><dd>¥/);
});

test('the drawer gives each figure once, says what the tokens were, and keeps the breakdown folded', async () => {
  const t = view({ showCost: false });
  await t.loadPricing();
  const a = work('a', 104_000, 61_000, { cacheRead: 3_100_000, reasoning: 23_000, requests: 41, durationSec: 1632 });
  const block = t.usageBlock(a, { results: [a] });
  assert.match(block, /<h3>用量<\/h3>/);
  assert.match(block, /<dt>总 token<\/dt><dd>3\.3M<\/dd>[\s\S]*<dt>生成耗时<\/dt><dd>27 分 12 秒<\/dd>[\s\S]*<dt>请求次数<\/dt><dd>41 次<\/dd>/);
  assert.equal(block.match(/3\.3M/g).length, 1, 'the total appears once');
  assert.match(block, /其中 95% 是缓存读取，也就是每次请求重复读入的上下文。[\s\S]*模型写出 61k token，其中推理 23k。/);
  assert.match(block, /<details class="usage-more-detail"><summary>构成明细/);
  assert.doesNotMatch(block, /<details[^>]* open/);
  assert.match(block, /输出（含推理）<small>模型写出的内容<\/small>/);
  assert.match(block, /<dt>来源<\/dt><dd>会话日志<\/dd>/);
  assert.match(t.usageLine(a), /^<span>3\.3M token<\/span><span class="usage-sep" aria-hidden="true">&nbsp;· <\/span><span>27 分 12 秒<\/span>$/);
});

test('the question median and sample count include zero usage in the work drawer', async () => {
  const t = view({ showCost: false });
  await t.loadPricing();
  const items = [0, 100, 500].map((n, i) => work(String(i), n, 0, { cacheRead: 0 }));
  const block = t.usageBlock(items[0], { results: items });
  assert.match(block, /本题 3 件参与比较，中位数 100/);
  assert.match(block, /这一件的 token 是本题中位数的 0.0 倍/);
  const allZero = t.usageBlock(items[0], { results: [items[0], items[0], items[0]] });
  assert.match(allZero, /本题 3 件参与比较，中位数 0/);
  assert.doesNotMatch(allZero, /NaN|Infinity|倍/);
});

test('administrators see the edit entry; readers see nothing for unrecorded works', async () => {
  const reader = view({ showCost: false }), staff = view({ showCost: false }, { staff: true });
  assert.equal(reader.usageBlock({ id: 'x' }, { results: [] }), '');
  assert.equal(staff.usageBlock({ id: 'x' }, { results: [] }), '', 'an older server without usage: no entry');
  assert.match(staff.usageBlock({ id: 'x' }, { results: [] }, { entry: true }), /未录入用量[\s\S]*data-usage-edit/);
  assert.doesNotMatch(reader.usageBlock(work('a', 1, 2), { results: [] }), /data-usage-edit/);
});

// The size phrase can wrap but keeps each number with its unit; the English keeps them together too.
test('the drawer size phrase wraps between figures, never inside a figure', async () => {
  const source = readFileSync(new URL('../site/usage-view.js', import.meta.url), 'utf8').replace(/^import [\s\S]*?;$/gm, '').replace(/^export /gm, '');
  const context = { ...usage, esc: (s) => String(s ?? ''), store: { get: () => null }, pricingInfo: () => Promise.resolve({ showCost: false }), isStaff: () => false, locale: () => 'zh-CN' };
  vm.runInNewContext(`${source}\nglobalThis.row = artifactRow;`, context);
  const row = context.row({ artifact: { files: 1, lines: 4472, bytes: 668_458, tokens: 319_158 } }, (b) => `${Math.round(b / 1024)} KB`);
  assert.match(row, /<span class="usage-phrase">交付代码 4,472\u00a0行、319k\u00a0token<\/span>/);
  assert.match(row, /<span>1 个文件<\/span>/);
  const { setLocale, translateText } = await import('../site/i18n.js');
  setLocale('en');
  assert.equal(translateText('交付代码 4,472 行、319k token'), 'Delivered code: 4,472 lines, 319k tokens');
  assert.equal(translateText('交付文字 12,345 字'), 'Delivered text: 12,345 characters');
  setLocale('zh-CN');
});
