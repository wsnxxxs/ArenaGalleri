import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.document = { addEventListener() {} };
globalThis.window = { addEventListener() {} };
globalThis.addEventListener = () => {};
const { platform } = await import('../site/platform.js');
const { pendingLimit } = await import('../site/submit.js');

test('member quotas keep personal limits and staff remain unlimited', () => {
  platform.site = { limits: {} };
  platform.user = { role: 'user' };
  platform.me = {};
  assert.equal(pendingLimit(), 8);
  platform.site.limits.pendingPerUser = 8;
  platform.me.pendingLimit = 20;
  assert.equal(pendingLimit(), 20);
  platform.me.pendingLimit = null;
  assert.equal(pendingLimit(), null);
  for (const role of ['moderator', 'admin']) {
    platform.user.role = role;
    // An older server or a stale member quota must not cap staff uploads.
    for (const cap of [undefined, null, 5]) {
      platform.me.pendingLimit = cap;
      assert.equal(pendingLimit(), null);
    }
  }
});
