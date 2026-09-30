import assert from 'node:assert/strict';
import test from 'node:test';
import { groupVariantResults, variantChoices, variantKey } from '../site/prompt-variants.js';

test('versions switch within one model while different efforts stay separate', () => {
  const results = [
    { id: 'a-long', model: 'a', effort: 'High', promptVariant: 'long' },
    { id: 'a-short', model: 'a', effort: 'High', promptVariant: 'short' },
    { id: 'a-low', model: 'a', effort: 'Low', promptVariant: 'long' },
    { id: 'b-long', model: 'b', promptVariant: 'long' },
  ];
  const task = { promptVariants: [{ id: 'long' }, { id: 'short' }], results };
  const selections = new Map([[variantKey(results[0]), 'a-short']]);
  assert.deepEqual(groupVariantResults(task, results, selections).map((item) => item.id), ['a-short', 'a-low', 'b-long']);
  assert.equal(variantChoices(task, results[3])[1].result, undefined);
  assert.deepEqual(results.map((item) => item.id), ['a-long', 'a-short', 'a-low', 'b-long']);
});
