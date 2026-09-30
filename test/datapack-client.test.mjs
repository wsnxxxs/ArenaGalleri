import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { extractArchive, fetchDatapack, readSource } from '../scripts/datapack-client.mjs';

function tar(name, body) {
  const header = Buffer.alloc(512), bytes = Buffer.from(body);
  header.write(name); header.write(bytes.length.toString(8).padStart(11, '0'), 124); header[156] = 48;
  return Buffer.concat([header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512 + 1024)]);
}
test('stream extraction handles chunk boundaries and refuses paths outside the package', async () => {
  const root = mkdtempSync(join(tmpdir(), 'datapack-test-'));
  try {
    const archive = join(root, 'input.gz'), body = 'x'.repeat(200000);
    writeFileSync(archive, gzipSync(tar('repo-sha/results/entry.txt', body)));
    await extractArchive(archive, join(root, 'out'));
    assert.equal(readFileSync(join(root, 'out/results/entry.txt'), 'utf8'), body);
    writeFileSync(archive, gzipSync(tar('repo-sha/../../escape', 'bad')));
    await assert.rejects(extractArchive(archive, join(root, 'other')), /Unsafe/);
    const broken = gzipSync(tar('repo-sha/file', body)); broken[broken.length - 8] ^= 1;
    writeFileSync(archive, broken);
    await assert.rejects(extractArchive(archive, join(root, 'broken')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('a rejected local package leaves the old cache intact and local builds never claim the pin', async () => {
  const root = mkdtempSync(join(tmpdir(), 'datapack-install-'));
  const pin = { repo: 'owner/repo', commit: 'a'.repeat(40) };
  try {
    const source = join(root, 'source'), target = join(root, 'cache');
    mkdirSync(source); mkdirSync(target);
    writeFileSync(join(source, 'data.json'), '{}'); writeFileSync(join(target, 'sentinel'), 'old');
    await assert.rejects(fetchDatapack({ pin, target, localSource: source, validate() { throw new Error('invalid'); } }), /invalid/);
    assert.equal(readFileSync(join(target, 'sentinel'), 'utf8'), 'old');
    await fetchDatapack({ pin, target, localSource: source, validate() {} });
    assert.equal(readSource(target).source, 'local'); assert.equal(readSource(target).commit, undefined);
    await assert.rejects(fetchDatapack({ pin, target, localSource: source, immutable: true }), /immutable/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
