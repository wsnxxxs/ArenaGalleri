import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.document = { title: '', addEventListener() {}, removeEventListener() {} };
globalThis.window = { addEventListener() {} };
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.history = { state: {} };
globalThis.SAME_PROMPT_CONFIG = { apiBaseUrl: 'https://backend.test/api/' };
const { platform } = await import('../site/platform.js');
const { mount } = await import('../site/publish.js');
const { uploadFlow } = await import('../site/submit.js');
const settle = () => new Promise(resolve => setImmediate(resolve));

async function withForm(values, run, delayResponse = null) {
  const previous = { user: platform.user, site: platform.site, sessionReady: platform.sessionReady };
  const originalFormData = globalThis.FormData, originalFetch = globalThis.fetch;
  platform.user = { id: 1, role: 'user', level: 1, emailBound: true, capabilities: { canSubmitQuestion: true } };
  platform.site = { limits: { referenceCount: 0 } };
  platform.sessionReady = true;
  const error = { textContent: '' }, buttons = [{ disabled: false }, { disabled: false }];
  const fields = new Map();
  const field = selector => { if (!fields.has(selector)) fields.set(selector, { innerHTML: '', value: '', focus() {} }); return fields.get(selector); };
  const form = {
    querySelector: selector => selector === '.form-error' ? error : selector === '[data-domain-count]' ? null : field(selector),
    querySelectorAll: selector => selector === 'button[type="submit"]' ? buttons : [],
  };
  const root = { innerHTML: '', querySelector: selector => selector === '.publish-form' ? form : field(selector) };
  globalThis.FormData = class {
    constructor(node) { assert.equal(node, form); }
    get(name) { const value = values[name]; return Array.isArray(value) ? value[0] ?? null : value ?? null; }
    getAll(name) { const value = values[name]; return Array.isArray(value) ? value : value == null ? [] : [value]; }
  };
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), method: options.method, body: JSON.parse(options.body) });
    await delayResponse;
    return new Response(JSON.stringify({ error: 'Test submission rejected' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  };
  const page = mount(root, { DATA: { title: 'Gallery test' }, pageStart: () => '', pageEnd: () => '' });
  const submit = async mode => {
    root.onsubmit({ target: form, submitter: { value: mode }, preventDefault() {} });
    await settle();
  };
  try { await run({ submit, error, calls, buttons }); }
  finally {
    page.destroy();
    Object.assign(platform, previous);
    globalThis.FormData = originalFormData;
    globalThis.fetch = originalFetch;
  }
}

for (const mode of ['plain', 'sample']) {
  test(`${mode} question submission reaches form validation`, async () => {
    await withForm({ title: '' }, async ({ submit, error, calls }) => {
      await submit(mode);
      assert.equal(error.textContent, '请填写题目标题');
      assert.equal(calls.length, 0, 'invalid forms must not be sent');
    });
  });
}

test('a complete question reaches the API and can be retried after a rejection', async () => {
  const question = { title: 'A question', summary: 'Compare answers', prompt: 'Build a page',
    category: '静态网页', subcategory: '网页', domains: ['计算机技术'], templates: ['static'] };
  await withForm(question, async ({ submit, error, calls, buttons }) => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      await submit('plain');
      assert.equal(calls.length, attempt);
      assert.deepEqual(calls.at(-1), { url: 'https://backend.test/api/questions', method: 'POST', body: question });
      assert.equal(error.textContent, 'Test submission rejected');
      assert.ok(buttons.every(button => !button.disabled), 'a rejected request must allow retrying');
    }
  });
});

test('a second submit shares the pending form state and cannot create a duplicate request', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const values = { title: 'A question', summary: 'Compare answers', prompt: 'Build a page',
    category: '静态网页', domains: ['计算机技术'], templates: ['static'] };
  await withForm(values, async ({ submit, calls, buttons }) => {
    try {
      await submit('plain');
      assert.equal(calls.length, 1);
      assert.ok(buttons.every(button => button.disabled));
      await submit('plain');
      assert.equal(calls.length, 1, 'only one request may be pending for the form');
      release();
      await settle();
      assert.ok(buttons.every(button => !button.disabled));
      await submit('plain');
      assert.equal(calls.length, 2, 'a rejected request can still be retried');
    } finally {
      release();
    }
  }, pending);
});

test('a new sample offers only drafts in an accepted format, including older drafts named by extension', async () => {
  const previous = { user: platform.user, site: platform.site };
  const originalFetch = globalThis.fetch;
  platform.user = { id: 'one', role: 'user', emailBound: true };
  platform.site = { cdn: [], limits: { uploadBytes: 1000000, coverBytes: 10000 } };
  const task = { id: '__new__', title: 'Text question', prompt: 'Write', templates: ['text'] };
  const ctx = { DATA: { title: 'Gallery' }, pageStart: () => '', pageEnd: () => '', taskHref: () => '#' };
  try {
    for (const [sourceName, template, accepted] of [['old.html', 'static', false], ['old.HTML', null, false], ['old.MD', null, true]]) {
      const draft = { id: 'old', sourceName, template, files: 1, bytes: 42, expiresAt: '2027-01-01T00:00:00Z', checks: [], preview: '/draft-preview/' };
      globalThis.fetch = async () => Response.json({ draft });
      const root = Object.assign(new EventTarget(), { innerHTML: '', querySelector: () => null });
      const flow = uploadFlow(root, ctx, { task });
      try {
        await settle();
        assert.equal(root.innerHTML.includes('data-act="resume"'), accepted, sourceName);
        if (accepted) {
          root.onclick({ target: { matches: () => false, closest: (selector) => selector === '[data-act]' ? { dataset: { act: 'resume' } } : null } });
          assert.match(root.innerHTML, /class="file-line"/);
          assert.equal(flow.kept().file, 'old.MD');
        }
      } finally { flow.destroy(); }
    }
  } finally {
    Object.assign(platform, previous);
    globalThis.fetch = originalFetch;
  }
});
