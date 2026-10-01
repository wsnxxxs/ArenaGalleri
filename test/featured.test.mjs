import assert from 'node:assert/strict';
import test from 'node:test';
import { representatives, standard, taskCover } from '../site/featured.js';

const work = (id, model, effort, extra = {}) => ({ id, model, effort, status: 'verified', addedAt: '2026-09-28T00:00:00Z', ...extra });

test('a model leads with its voted work, else a standard work of the highest effort', () => {
  const results = [
    work('a-high', 'a', 'High'),
    work('a-max-multi', 'a', 'Max', { generationMode: 'multi-turn' }),
    work('a-max', 'a', 'Max'),
    work('b-low', 'b', 'Low'),
    work('b-max-edit', 'b', 'Max', { humanIntervention: 'code-edited' }),
  ];
  const keyOf = (r) => r.model;
  assert.deepEqual([...representatives(results, keyOf)].map(([key, r]) => [key, r.id]), [['a', 'a-max'], ['b', 'b-low']]);
  assert.equal(representatives(results, keyOf, { a: 'a-high', b: 'missing' }).get('a').id, 'a-high');
  assert.equal(representatives(results, keyOf, { b: 'missing' }).get('b').id, 'b-low');
  assert.equal(standard({}), true);
  assert.equal(standard({ generationMode: 'single-turn', humanIntervention: 'prompt-guided' }), false);
});

test('the task cover falls back to Opus 5.5 Max, then Astra Max, then nothing', () => {
  const opus = work('claude-opus-5.5-max', 'claude-opus-5.5', 'Max');
  const opusCopy = work('claude-opus-5.5-max-zip', 'claude-opus-5.5', 'Max', { addedAt: '2026-10-01T00:00:00Z' });
  const astra = work('gpt-6-astra-max', 'gpt-6-astra', 'Max');
  const other = work('other', 'c', 'High');
  assert.equal(taskCover({ results: [other, opusCopy, astra, opus] }).id, 'claude-opus-5.5-max');
  assert.equal(taskCover({ results: [other, astra, opus] }, 'other').id, 'other');
  assert.equal(taskCover({ results: [other, astra] }, 'missing').id, 'gpt-6-astra-max');
  assert.equal(taskCover({ results: [other, { ...astra, status: 'questioned' }] }), null);
});
