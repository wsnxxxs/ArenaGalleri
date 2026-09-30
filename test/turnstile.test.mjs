import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTurnstile, mountTurnstile } from '../site/turnstile.js';

test('Turnstile loads on demand and can retry a failed script', async () => {
  const originalDocument = globalThis.document;
  const originalTurnstile = globalThis.turnstile;
  const scripts = [];
  globalThis.document = {
    createElement: () => ({ remove() { this.removed = true; } }),
    head: { append(script) { scripts.push(script); } },
  };
  delete globalThis.turnstile;

  try {
    assert.equal(scripts.length, 0);
    const failure = assert.rejects(loadTurnstile(), /加载失败/);
    assert.match(scripts[0].src, /^https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit$/);
    scripts[0].onload();
    await failure;
    assert.equal(scripts[0].removed, true);

    const retry = loadTurnstile();
    assert.equal(scripts.length, 2);
    const widgetApi = { render() {}, reset() {}, remove() {} };
    globalThis.turnstile = widgetApi;
    scripts[1].onload();
    assert.equal(await retry, widgetApi);
  } finally {
    globalThis.document = originalDocument;
    if (originalTurnstile === undefined) delete globalThis.turnstile;
    else globalThis.turnstile = originalTurnstile;
  }
});

test('Turnstile clears expired or rejected tokens and removes its widget', async () => {
  const originalTurnstile = globalThis.turnstile;
  let options;
  const calls = [];
  globalThis.turnstile = {
    render(container, configuration) { options = configuration; calls.push(['render', container]); return 'widget-1'; },
    reset(id) { calls.push(['reset', id]); },
    remove(id) { calls.push(['remove', id]); },
  };
  try {
    const container = {};
    const messages = [];
    const widget = mountTurnstile(container, '1x00000000000000000000AA', (message) => messages.push(message));
    assert.deepEqual(calls[0], ['render', container]);
    assert.equal(options.sitekey, '1x00000000000000000000AA');

    options.callback('first-token');
    assert.equal(widget.token, 'first-token');
    options['expired-callback']();
    await Promise.resolve();
    assert.equal(widget.token, '');
    assert.deepEqual(calls.at(-1), ['reset', 'widget-1']);
    assert.match(messages.at(-1), /过期/);

    options.callback('second-token');
    widget.reset(); // A failed registration request consumes the submitted token.
    assert.equal(widget.token, '');
    assert.deepEqual(calls.at(-1), ['reset', 'widget-1']);

    options.callback('third-token');
    assert.equal(options['error-callback'](), false);
    assert.equal(widget.token, '');
    assert.match(messages.at(-1), /失败/);

    const messageCount = messages.length;
    widget.remove();
    options.callback('late-token');
    widget.reset();
    assert.equal(widget.token, '');
    assert.equal(messages.length, messageCount);
    assert.deepEqual(calls.at(-1), ['remove', 'widget-1']);
  } finally {
    if (originalTurnstile === undefined) delete globalThis.turnstile;
    else globalThis.turnstile = originalTurnstile;
  }
});
