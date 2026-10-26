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

const pending = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

async function fixture(run, { stalled = true } = {}) {
  let reads = 0, bodyReads = 0, delayed;
  const bodyStarted = pending(), bodyFinished = pending();
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
    // Advance the application's deadline explicitly after the native body reader starts.
    // A slow CI connection must not turn a body-timeout test into a pre-header timeout.
    AbortSignal: { timeout(ms) {
      const controller = new AbortController();
      timeouts.push({ ms, signal: controller.signal, expire: () => controller.abort(new DOMException('Deadline elapsed', 'TimeoutError')) });
      return controller.signal;
    } },
    fetch: async (url, options) => {
      if (new URL(url, baseURI).pathname !== '/data.json') return new Response('{}');
      const response = await fetch(new URL(url, baseURI), options);
      const json = response.json.bind(response);
      response.json = () => {
        bodyReads++;
        const body = json();
        bodyStarted.resolve(options.signal);
        body.then((value) => bodyFinished.resolve({ ok: true, value, signal: options.signal }),
          () => bodyFinished.resolve({ ok: false, signal: options.signal }));
        return body;
      };
      return response;
    },
  };
  context.bootRead = (name) => {
    const request = context.GALLERY_BOOT?.[name];
    if (request) delete context.GALLERY_BOOT[name];
    return request ?? null;
  };
  const reading = () => vm.runInNewContext(`(async () => {${read}\nreturn DATA;})()`, context);
  try { await run({ context, reading, timeouts, reads: () => reads, bodyReads: () => bodyReads,
    bodyStarted: bodyStarted.promise, bodyFinished: bodyFinished.promise, late: () => delayed?.end('"late"}') }); }
  finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
}

for (const preload of [true, false]) test(`startup ${preload ? 'preloaded' : 'fallback'} data has a body deadline and a fresh retry`, { timeout: 10000 }, async () => {
  await fixture(async ({ context, reading, timeouts, reads, bodyStarted, late }) => {
    if (preload) vm.runInNewContext(early, context);
    const read = reading();
    read.catch(() => {});
    const signal = await bodyStarted;
    const deadline = timeouts.find((item) => item.signal === signal);
    assert.equal(deadline?.ms, 15000, 'the body reader uses the same 15-second deadline as other Gallery reads');
    assert.equal(reads(), 1);
    const failure = assert.rejects(read, (error) => ['AbortError', 'TimeoutError'].includes(error.name));
    deadline.expire();
    await failure;
    assert.equal(signal.aborted, true);
    late();
    await new Promise(setImmediate);
    assert.equal(context.DATA, undefined, 'the unfinished response never becomes the mounted data');
    assert.equal((await reading()).marker, 'fresh', 'a reload can make a new request after the stalled read');
    assert.equal(context.DATA.marker, 'fresh');
    assert.equal(reads(), 2);
  });
});

test('startup consumes its completed preload without issuing a duplicate data request', { timeout: 10000 }, async () => {
  await fixture(async ({ context, reading, reads }) => {
    vm.runInNewContext(early, context);
    assert.equal((await reading()).marker, 'fresh');
    assert.equal(reads(), 1);
    assert.equal(context.GALLERY_BOOT.data, undefined);
  }, { stalled: false });
});

test('a completed preload remains usable when app modules arrive after its network deadline', { timeout: 10000 }, async () => {
  await fixture(async ({ context, reading, reads, bodyReads, bodyFinished, timeouts }) => {
    vm.runInNewContext(early, context);
    await context.GALLERY_BOOT.data;
    assert.equal(bodyReads(), 1, 'the preload consumes its body while app modules are still absent');
    const completed = await bodyFinished;
    assert.equal(completed.ok, true);
    const deadline = timeouts.find((item) => item.signal === completed.signal);
    assert.equal(deadline?.ms, 15000);
    deadline.expire();
    assert.equal(completed.signal.aborted, true);
    assert.equal((await reading()).marker, 'fresh');
    assert.equal(reads(), 1, 'late modules reuse the downloaded data without another request');
  }, { stalled: false });
});
