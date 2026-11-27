import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('deployment check verifies the catalog identity, all packaged questions, and a replacement ETag', async (t) => {
  const digest = 'a'.repeat(64), pinned = 'b'.repeat(40);
  const buildInfo = { datapack: null, catalogDigest: digest };
  const api = { apiVersion: 2, datapack: pinned, catalogDigest: digest, questions: [{ id: 'packaged' }], works: [] };
  let origin, omitReplacementTag = false;
  const server = createServer((req, res) => {
    res.setHeader('access-control-allow-origin', origin);
    if (req.url === '/runtime-config.js') return res.end('globalThis.SAME_PROMPT_CONFIG = {"apiBaseUrl":"api/"};');
    if (req.url === '/data.json') return res.end(JSON.stringify({ buildInfo, tasks: [{ id: 'packaged' }] }));
    if (req.url === '/api/session') {
      res.setHeader('cache-control', 'no-store');
      return res.end('{"user":null}');
    }
    if (req.url !== '/api/catalog') { res.writeHead(404); return res.end(); }
    res.setHeader('cache-control', 'public, no-cache');
    if (req.headers['if-none-match'] && !omitReplacementTag) { res.writeHead(304); return res.end(); }
    if (!req.headers['if-none-match']) res.setHeader('etag', '"original"');
    res.end(JSON.stringify(api));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  origin = 'http://127.0.0.1:' + server.address().port;
  const check = () => promisify(execFile)(process.execPath, [
    fileURLToPath(new URL('../scripts/check-deployment.mjs', import.meta.url)), origin + '/', origin + '/api/',
  ]);
  await check();
  api.catalogDigest = 'c'.repeat(64);
  await assert.rejects(check(), /must use the same catalog/);
  buildInfo.datapack = pinned;
  await check();
  api.questions = [{ id: 'community' }];
  await assert.rejects(check(), /missing packaged questions: packaged/);
  api.questions = [{ id: 'packaged' }];
  omitReplacementTag = true;
  await assert.rejects(check(), /still have a validator/);
});
