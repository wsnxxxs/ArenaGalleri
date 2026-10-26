import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../site/app.js', import.meta.url), 'utf8');
const early = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1]).find((source) => source.includes('globalThis.GALLERY_BOOT ='));
const start = app.indexOf('  const requests = requestPlatform();', app.lastIndexOf('\ntry {'));
const read = app.slice(start, app.indexOf('\n  PACK =', start));

const bounded = (task) => new Promise((resolve, reject) => {
  const deadline = setTimeout(() => reject(new Error('The data body remained pending without a deadline')), 500);
  task.then((value) => { clearTimeout(deadline); resolve(value); }, (error) => { clearTimeout(deadline); reject(error); });
});

async function fixture(run, { stalled = true } = {}) {
  let reads = 0, delayed;
  const server = createServer((request, response) => {
    reads++;
    response.writeHead(200, { 'Content-Type': 'application/json' });
    if (stalled && reads === 1) { delayed = response; response.write('{"marker":'); }
    else response.end('{"marker":"fresh"}');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseURI = `http://127.0.0.1:${server.address().port}/`;
  const timeouts = [];
  const context = {
    URL, document: { baseURI }, DATA: undefined, requestPlatform: () => ({}),
    SAME_PROMPT_CONFIG: { apiBaseUrl: `${baseURI}api/` },
    AbortSignal: { timeout(ms) { timeouts.push(ms); return AbortSignal.timeout(100); } },
    fetch: (url, options) => new URL(url, baseURI).pathname === '/data.json'
      ? fetch(new URL(url, baseURI), options)
      : Promise.resolve(new Response('{}')),
  };
  context.bootRead = (name) => {
    const request = context.GALLERY_BOOT?.[name];
    if (request) delete context.GALLERY_BOOT[name];
    return request ?? null;
  };
  const reading = () => vm.runInNewContext(`(async () => {${read}\nreturn DATA;})()`, context);
  try { await run({ context, reading, timeouts, reads: () => reads, late: () => delayed?.end('"late"}') }); }
  finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
}

for (const preload of [true, false]) test(`startup ${preload ? 'preloaded' : 'fallback'} data has a body deadline and a fresh retry`, async () => {
  await fixture(async ({ context, reading, timeouts, reads, late }) => {
    if (preload) vm.runInNewContext(early, context);
    await assert.rejects(bounded(reading()), (error) => ['AbortError', 'TimeoutError'].includes(error.name));
    assert.ok(timeouts.includes(15000), 'startup uses the same 15-second deadline as other Gallery reads');
    assert.equal(reads(), 1);
    late();
    assert.equal(context.DATA, undefined, 'the unfinished response never becomes the mounted data');
    assert.equal((await bounded(reading())).marker, 'fresh', 'a reload can make a new request after the stalled read');
    assert.equal(context.DATA.marker, 'fresh');
    assert.equal(reads(), 2);
  });
});

test('startup consumes its completed preload without issuing a duplicate data request', async () => {
  await fixture(async ({ context, reading, reads }) => {
    vm.runInNewContext(early, context);
    assert.equal((await bounded(reading())).marker, 'fresh');
    assert.equal(reads(), 1);
    assert.equal(context.GALLERY_BOOT.data, undefined);
  }, { stalled: false });
});

test('a completed preload remains usable when app modules arrive after its network deadline', async () => {
  await fixture(async ({ context, reading, reads }) => {
    vm.runInNewContext(early, context);
    await context.GALLERY_BOOT.data;
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal((await bounded(reading())).marker, 'fresh');
    assert.equal(reads(), 1, 'late modules reuse the downloaded data without another request');
  }, { stalled: false });
});
