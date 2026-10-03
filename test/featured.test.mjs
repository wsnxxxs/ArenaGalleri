import assert from 'node:assert/strict';
import test from 'node:test';
import { representatives, standard, taskCover } from '../site/featured.js';

const work = (id, model, effort, extra = {}) => ({ id, model, effort, status: 'verified', addedAt: '2026-09-28T00:00:00Z', captures: { first: `${id}.jpg` }, ...extra });

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

test('the task cover respects admin and vote picks before the existing model fallbacks', () => {
  const opus = work('claude-opus-5.5-max', 'claude-opus-5.5', 'Max');
  const opusCopy = work('claude-opus-5.5-max-zip', 'claude-opus-5.5', 'Max', { addedAt: '2026-10-01T00:00:00Z' });
  const astra = work('gpt-6-astra-max', 'gpt-6-astra', 'Max');
  const other = work('other', 'c', 'High');
  assert.equal(taskCover({ results: [other, opusCopy, astra, opus] }).id, 'claude-opus-5.5-max');
  assert.equal(taskCover({ cover: 'other', results: [other, opus] }, 'claude-opus-5.5-max').id, 'other');
  assert.equal(taskCover({ results: [other, astra, opus] }, 'other').id, 'other');
  assert.equal(taskCover({ results: [other, astra] }, 'missing').id, 'gpt-6-astra-max');
  assert.equal(taskCover({ results: [{ ...other, captures: {} }, { ...astra, status: 'questioned' }] }), null);
});

test('the task cover skips works without visible card media and accepts public unverified works', () => {
  const noScreenshot = (id, model, effort, extra = {}) => work(id, model, effort, {
    status: 'verified', previewMode: 'screenshot', captures: {}, gallery: [], previewPoster: null, ...extra,
  });
  const noOpus = noScreenshot('no-opus-media', 'claude-opus-5.5', 'Max');
  const noAstra = noScreenshot('no-astra-media', 'gpt-6-astra', 'Max');
  const unverified = work('public-unverified', 'new-model', 'High', { status: 'unverified' });

  assert.equal(taskCover({ cover: noOpus.id, results: [noOpus, unverified] }).id, unverified.id);
  assert.equal(taskCover({ cover: noOpus.id, results: [noOpus, unverified] }, unverified.id).id, unverified.id);
  assert.equal(taskCover({ results: [noOpus, noAstra] }), null);
  assert.equal(taskCover({ results: [noOpus, { ...unverified, status: 'questioned' }] }), null);
});

test('an unusable voted or fixed fallback gives way to the best media-bearing work', () => {
  const noMedia = (id, model, effort) => work(id, model, effort, {
    previewMode: 'screenshot', captures: {}, gallery: [], previewPoster: null,
  });
  const noOpus = noMedia('no-opus-media', 'claude-opus-5.5', 'Max');
  const noAstra = noMedia('no-astra-media', 'gpt-6-astra', 'Max');
  const standardMax = work('standard-max', 'other', 'Max');
  const multiTurnMax = work('multi-turn-max', 'other', 'Max', { generationMode: 'multi-turn' });
  const posterOnly = work('poster-only', 'poster-model', 'High', {
    captures: {}, gallery: [], previewMode: 'model', previewModel: 'model.sbox', previewPoster: 'poster.webp',
  });
  const modelOnly = work('model-only', 'model-only', 'High', {
    captures: {}, gallery: [], previewMode: 'model', previewModel: 'model.sbox', previewPoster: null,
  });

  assert.equal(taskCover({ results: [noOpus, noAstra, multiTurnMax, standardMax] }, noOpus.id).id, standardMax.id);
  assert.equal(taskCover({ results: [noOpus, noAstra, posterOnly] }).id, posterOnly.id);
  assert.equal(taskCover({ results: [noOpus, noAstra, modelOnly] }).id, modelOnly.id);
  assert.equal(taskCover({ results: [noOpus, noAstra, { ...modelOnly, previewMode: 'screenshot' }] }), null);
  assert.equal(taskCover({ results: [noOpus, noAstra] }, noOpus.id), null);
});
