import assert from 'node:assert/strict';
import test from 'node:test';
import { hasModelPreview, screenshotOf } from '../site/work-preview-media.js';

test('screenshotOf prefers the adapted display image and falls back through packaged shots', () => {
  const work = {
    previewCapture: 'adapted.webp',
    captures: { first: 'first.jpg', mobile: 'mobile.jpg' },
    gallery: [{ src: 'gallery.jpg' }],
  };
  assert.equal(screenshotOf(work), 'adapted.webp');
  assert.equal(screenshotOf({ ...work, previewCapture: '' }), 'first.jpg');
  assert.equal(screenshotOf({ captures: { mobile: 'mobile.jpg' }, gallery: [{ src: 'gallery.jpg' }] }), 'gallery.jpg');
  assert.equal(screenshotOf({ captures: { mobile: 'mobile.jpg' } }), 'mobile.jpg');
  assert.equal(screenshotOf({}), '');
});

test('hasModelPreview respects screenshot mode and accepts either runtime reference', () => {
  assert.equal(hasModelPreview({ previewModel: 'work.sbox' }), true);
  assert.equal(hasModelPreview({ previewLoader: 'loader/' }), true);
  assert.equal(hasModelPreview({ previewMode: 'screenshot', previewModel: 'work.sbox' }), false);
  assert.equal(hasModelPreview({}), false);
});
