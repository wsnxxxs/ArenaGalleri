// Reference images handed to every model with a question: file names, the prompt's wording about
// them, and a store-only zip so a reader downloads the same files under the same names.
const pad = (n) => String(n).padStart(2, '0');

export const REFERENCE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// Upload names are `NN-stem.ext`: the number follows the order, the stem stays the author's.
export function referenceStem(name) {
  const stem = String(name ?? '').replace(/\.[^.]*$/, '').replace(/^\d{1,2}[-_ ]+/, '').normalize('NFKC').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return stem || 'image';
}
export const referenceName = (index, stem, ext) => `${pad(index + 1)}-${referenceStem(stem)}.${ext}`;

// The prompt's own section about the images, in the order they are given.
export function referenceNote(refs) {
  return `【参考图】\n请参考提供的 ${refs.length} 张图片完成，按顺序分别为：\n${refs.map((ref, i) => `${i + 1}. ${ref.caption?.trim() || ref.name}`).join('\n')}`;
}

// Wording that tells a model images come with the prompt; the pack check shares it.
export const MENTIONS_REFERENCES = /参考图|参考提供的|提供的\s*\d+\s*张|references\//;

// A section written by referenceNote is rewritten in place, so a new order does not add a second one.
const NOTE = /【参考图】\n请参考提供的 \d+ 张图片完成，按顺序分别为：\n(?:\d+\. [^\n]*(?:\n|$))+/;
export function replaceReferenceNote(prompt, note) {
  const match = String(prompt ?? '').match(NOTE);
  return match ? prompt.replace(NOTE, `${note}${match[0].endsWith('\n') ? '\n' : ''}`) : null;
}

// Mismatches between the prompt and the attached images, as advice; none of them blocks a submit.
export function referenceAdvice(prompt, count) {
  const text = String(prompt ?? '');
  const mentioned = MENTIONS_REFERENCES.test(text);
  if (count && !mentioned) return 'missing-note';
  if (!count && mentioned) return 'missing-images';
  const stated = text.match(/(\d+)\s*张(?:参考)?图/);
  if (count && stated && Number(stated[1]) !== count) return 'count';
  return '';
}

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// files: [{ name, bytes: Uint8Array }]. Images are already compressed, so entries are stored.
export function zipStore(files) {
  const encoder = new TextEncoder();
  const chunks = [], central = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name), crc = crc32(file.bytes), size = file.bytes.length;
    const head = (signature, length) => {
      const view = new DataView(new ArrayBuffer(length));
      view.setUint32(0, signature, true);
      return view;
    };
    // Local header: version 2.0, UTF-8 names, stored, 1980-01-01.
    const local = head(0x04034b50, 30);
    [[4, 20], [6, 0x0800], [8, 0], [10, 0], [12, 0x21], [26, name.length], [28, 0]].forEach(([at, v]) => local.setUint16(at, v, true));
    [[14, crc], [18, size], [22, size]].forEach(([at, v]) => local.setUint32(at, v, true));
    const entry = head(0x02014b50, 46);
    [[4, 20], [6, 20], [8, 0x0800], [10, 0], [12, 0], [14, 0x21], [28, name.length], [30, 0], [32, 0], [34, 0], [36, 0]].forEach(([at, v]) => entry.setUint16(at, v, true));
    [[16, crc], [20, size], [24, size], [38, 0], [42, offset]].forEach(([at, v]) => entry.setUint32(at, v, true));
    chunks.push(new Uint8Array(local.buffer), name, file.bytes);
    central.push(new Uint8Array(entry.buffer), name);
    offset += 30 + name.length + size;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
