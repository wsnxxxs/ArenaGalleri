import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as paste from '../site/usage-paste.js';

// readFields from usage-entry.js, without the page around it.
function fields() {
  const source = readFileSync(new URL('../site/usage-entry.js', import.meta.url), 'utf8')
    .replace(/^import [\s\S]*?;$/gm, '').replace(/^export /gm, '');
  const context = { ...paste, PAID_BASIS: {}, SOURCES: {} };
  vm.runInNewContext(`${source}\nglobalThis.t = { readFields };`, context);
  return context.t.readFields;
}

test('a recognised or loaded time keeps its seconds while its field is untouched; typed minutes are converted', () => {
  const readFields = fields();
  const exact = { durationSec: { text: '35.1', value: 2107.9 } };
  assert.equal(readFields({ durationSec: '35.1' }, exact).usage.durationSec, 2107.9, '35m 7.9s is not rounded to 2106 seconds');
  assert.equal(readFields({ durationSec: '35.2' }, exact).usage.durationSec, 2112, 'an edited field is read as minutes');
  assert.equal(JSON.stringify(readFields({ durationSec: '', input: '' }, { durationSec: { text: '', value: undefined } }).usage), '{}');
});

test('with the amount fields hidden, a loaded paid amount and currency go back unchanged on save', () => {
  const readFields = fields();
  const hidden = readFields({ input: '31,000' }, { input: { text: '31,000', value: 31_000 } }, { amount: '9876.54', currency: 'USD', basis: 'subscription' });
  assert.deepEqual(JSON.parse(JSON.stringify(hidden.paid)), { basis: 'subscription', amount: 9876.54, currency: 'USD' });
  assert.equal(readFields({}, {}, { basis: 'api' }).paid.amount, undefined, 'no amount was recorded, none is invented');
  assert.equal(readFields({}, {}, { amount: '5', basis: '' }).amountWithoutBasis, true);
  // The amount and currency inputs are drawn only while amounts show (syncMoney).
  const source = readFileSync(new URL('../site/usage-entry.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source.slice(source.indexOf('export function usageEntryHtml'), source.indexOf('// What the fields say')), /usage_paidAmount|usage_paidCurrency/);
  assert.match(source, /want = costShown\(pricingNow\(\)\)/);
});

test('the stored baseline blocks editing until read and never fills an editor for another account', async () => {
  const source = readFileSync(new URL('../site/usage-entry.js', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('export async function loadInto'), source.indexOf('// The drawer')).replace('export ', '');
  let version = 1, answer;
  const context = { accountVersion: () => version, loadPricing: async () => ({}),
    readUsage: () => new Promise(resolve => { answer = resolve; }) };
  vm.runInNewContext(body, context);
  const fills = [], loading = [];
  const entry = { setLoading: value => loading.push(value), refresh() {}, fill: record => fills.push(record), showMeta() {} };
  const first = context.loadInto(entry, 'q', 'w');
  assert.deepEqual(loading, [true]);
  answer({ usage: { source: 'bill', requests: 7 } });
  assert.equal(await first, true);
  assert.deepEqual(fills, [{ source: 'bill', requests: 7 }]);
  assert.deepEqual(loading, [true, false]);
  const second = context.loadInto(entry, 'q', 'w');
  version++;
  answer({ usage: { source: 'log', requests: 8 } });
  assert.equal(await second, false);
  assert.equal(fills.length, 1);
  assert.equal(loading.at(-1), true);
});
