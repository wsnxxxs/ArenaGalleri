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

test('retired prompt versions keep their work identities alongside registered versions', () => {
  const result = (id, model, promptVariant) => ({ id, model, promptVariant });
  const archived = result('archived', 'a', 'removed');
  const old = result('old', 'b', 'earlier');
  const full = result('full', 'a', 'full');
  const short = result('short', 'a', 'short');
  const plain = result('plain', 'a');
  const task = { promptVariants: [{ id: 'full' }, { id: 'short' }], results: [archived, full, short, plain, old] };
  const group = (rows, selected) => groupVariantResults(task, rows, new Map([[variantKey(full), selected]]));
  assert.deepEqual(group(task.results, 'short'), [archived, short, plain, old]);
  assert.deepEqual(group([short, old, full, archived, plain], 'gone'), [full, old, archived, plain]);
  assert.deepEqual(variantChoices(task, archived), []);
  assert.deepEqual(variantChoices(task, old), []);
  assert.deepEqual(variantChoices(task, plain), []);
});

test('extra submissions for the same version remain accessible when another version is selected', () => {
  const full = { id: 'first', model: 'a', promptVariant: 'full' };
  const extra = { ...full, id: 'second' };
  const short = { ...full, id: 'short', promptVariant: 'short' };
  const task = { promptVariants: [{ id: 'full' }, { id: 'short' }], results: [full, extra, short] };
  assert.deepEqual(groupVariantResults(task, [extra, short, full], new Map()), [extra, full]);
  const selections = new Map([[variantKey(full), short.id]]);
  assert.deepEqual(groupVariantResults(task, task.results, selections), [short, extra]);
  assert.deepEqual(variantChoices(task, extra), []);
  assert.deepEqual(variantChoices(task, short).map((choice) => choice.result), [full, short]);
});
