import assert from 'node:assert/strict';
import test from 'node:test';
import { modelResolver } from '../site/models.js';

const resolve = modelResolver([
  { id: 'claude-1', name: 'Claude 1', vendor: 'Anthropic', logo: 'assets/brands/generic.svg' },
  { id: 'claude-opus-4.7', name: 'Claude Opus 4.7', vendor: 'Anthropic', logo: 'assets/brands/claude.svg', aliases: ['opus-4.7'] },
  { id: 'llama-3', name: 'Llama 3 70B', vendor: 'Meta', logo: 'assets/brands/meta.svg' },
  { id: 'lunaris', name: 'Llama 3 8B Lunaris', vendor: 'Sao10K', logo: 'assets/brands/generic.svg' },
]);

test('an unregistered model borrows the vendor its family shares, unless the uploader named one', () => {
  assert.equal(resolve({ model: 'claude-opus-4.7' }).name, 'Claude Opus 4.7');
  assert.equal(resolve({ model: 'x:claude opus 4.7', modelName: 'claude-opus 4.7' }).id, 'claude-opus-4.7');
  assert.equal(resolve({ modelName: 'Opus 4.7' }).id, 'claude-opus-4.7');
  assert.deepEqual(resolve({ model: 'x:claude opus 4.6', modelName: 'Claude Opus 4.6' }),
    { name: 'Claude Opus 4.6', vendor: 'Anthropic', logo: 'assets/brands/claude.svg', unlisted: 'inferred' });
  assert.deepEqual(resolve({ modelName: 'Llama 5' }), { name: 'Llama 5', vendor: '', logo: '', unlisted: 'unknown' });
  assert.deepEqual(resolve({ modelName: 'Llama 5', vendor: 'meta' }), { name: 'Llama 5', vendor: 'Meta', logo: 'assets/brands/meta.svg', unlisted: 'declared' });
  assert.deepEqual(resolve({ modelName: 'Xing4.0-29B', vendor: 'Xing Lab' }), { name: 'Xing4.0-29B', vendor: 'Xing Lab', logo: '', unlisted: 'declared' });
});
