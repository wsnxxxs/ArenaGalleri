import test from 'node:test';
import assert from 'node:assert/strict';
import { publicCatalog, publishablePackageFile } from '../scripts/public-catalog.mjs';

test('the display catalog keeps prompts and runtime paths without private source metadata or future internal fields', () => {
  const privateValue = 'PRIVATE-SOURCE';
  const result = { id: 'work', model: 'model', promptVariant: 'short', scene: 'results/work/', previewModel: 'assets/work.sbox',
    source: privateValue, readme: privateValue, sourceUpload: privateValue, sourceDigest: privateValue,
    futureInternalField: privateValue, captures: { first: 'work/first.jpg' },
    guide: { privateNote: privateValue, presets: [{ label: 'Dawn', query: 't=6', provenance: privateValue }] },
    gallery: [{ src: 'work/cover.jpg', caption: 'Cover', provenance: privateValue }] };
  const raw = { title: 'Gallery', repo: 'https://example.test/gallery', schemaVersion: 1,
    sourceCommit: privateValue, sourceDirty: true, modelPool: [{ id: privateValue }], futureInternalField: privateValue,
    models: [{ id: 'model', name: 'Model', logo: 'logo.svg', priceOut: 10, privateNote: privateValue }],
    tasks: [{ id: 'task', category: '建模', prompt: 'The public prompt', promptUrl: privateValue, futureInternalField: privateValue,
      promptVariants: [{ id: 'short', label: 'Short', prompt: 'The short prompt', promptUrl: privateValue, source: privateValue }],
      conditions: [{ id: 'first', label: 'First', secret: privateValue }], results: [result] }] };
  const info = { frontendCommit: 'a'.repeat(40), datapack: 'b'.repeat(40), schemaVersion: 1, privateNote: privateValue };
  const display = publicCatalog(raw, info);
  assert.equal(display.tasks[0].prompt, raw.tasks[0].prompt);
  assert.equal(display.tasks[0].category, '建模', 'the leaderboard groups tasks by category');
  assert.deepEqual(display.tasks[0].promptVariants, [{ id: 'short', label: 'Short', prompt: 'The short prompt' }]);
  assert.equal(display.tasks[0].results[0].promptVariant, 'short');
  assert.equal(display.tasks[0].results[0].scene, result.scene);
  assert.equal(display.tasks[0].results[0].previewModel, result.previewModel);
  assert.equal(display.buildInfo.datapack, info.datapack, 'write/version compatibility identifiers remain available');
  assert.ok(!JSON.stringify(display).includes(privateValue));
  assert.equal(raw.tasks[0].results[0].source, privateValue, 'the private input is unchanged');
});

test('published package files exclude build records and source maps while keeping runtime assets and licenses', () => {
  for (const path of ['data.json', '.datapack-source.json', 'assets/scenes/posters.json',
    'results\\work\\build-info.json', 'assets/brands/README.md', 'results/work/app.js.map']) {
    assert.equal(publishablePackageFile(path), false, path);
  }
  for (const path of ['results/work/index.html', 'results/work/app.js', 'results/work/data.json',
    'assets/work.sbox', 'results/work/THIRD_PARTY.md', 'LICENSE']) {
    assert.equal(publishablePackageFile(path), true, path);
  }
});
