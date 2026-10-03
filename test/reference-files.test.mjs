import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32, referenceAdvice, referenceName, referenceNote, referenceStem, replaceReferenceNote, zipStore } from '../site/reference-files.js';

test('reference names follow the order and keep a clean stem', () => {
  assert.equal(referenceStem('03_Side Profile.JPG'), 'side-profile');
  assert.equal(referenceStem('车尾 正后.webp'), '车尾-正后');
  assert.equal(referenceStem('…'), 'image');
  assert.equal(referenceName(0, 'front-three-quarter', 'jpg'), '01-front-three-quarter.jpg');
  assert.equal(referenceName(11, '02-rear.png', 'png'), '12-rear.png', 'a moved image takes its new number');
});

test('the prompt note lists the images in order and the advice spots mismatches', () => {
  const refs = [{ name: '01-front.jpg', caption: '正前' }, { name: '02-rear.jpg', caption: '' }];
  assert.equal(referenceNote(refs), '【参考图】\n请参考提供的 2 张图片完成，按顺序分别为：\n1. 正前\n2. 02-rear.jpg');
  assert.equal(referenceAdvice('做一辆车', 2), 'missing-note');
  assert.equal(referenceAdvice('请参考提供的 5 张图片完成', 0), 'missing-images');
  assert.equal(referenceAdvice('【参考图】请参考提供的 5 张图片完成', 4), 'count');
  assert.equal(referenceAdvice('【参考图】请参考提供的 5 张图片完成', 5), '');
  assert.equal(referenceAdvice('做一辆车', 0), '');
  const prompt = `任务\n\n${referenceNote(refs)}\n\n要求`;
  assert.equal(replaceReferenceNote(prompt, referenceNote([refs[1], refs[0]])), `任务\n\n${referenceNote([refs[1], refs[0]])}\n\n要求`, 'a new order rewrites the section');
  assert.equal(replaceReferenceNote('任务', referenceNote(refs)), null);
});

test('the zip stores each file under its name with a correct checksum', async () => {
  assert.equal(crc32(new TextEncoder().encode('hello')), 0x3610a686);
  const bytes = new Uint8Array([1, 2, 3, 4, 5]);
  const zip = new Uint8Array(await zipStore([{ name: '01-前.jpg', bytes }, { name: '02-b.png', bytes: new Uint8Array() }]).arrayBuffer());
  const view = new DataView(zip.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(14, true), crc32(bytes));
  const name = new TextEncoder().encode('01-前.jpg');
  assert.deepEqual(zip.subarray(30, 30 + name.length), name);
  assert.deepEqual(zip.subarray(30 + name.length, 35 + name.length), bytes);
  const end = zip.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  assert.equal(view.getUint16(end + 10, true), 2);
  const central = view.getUint32(end + 16, true);
  assert.equal(view.getUint32(central, true), 0x02014b50);
  assert.equal(central + view.getUint32(end + 12, true), end);
});
