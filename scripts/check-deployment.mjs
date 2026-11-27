// Check the API configured by the published Gallery, rather than an unrelated API URL.
import assert from 'node:assert/strict';
import { compatibleBuild } from '../site/platform-api.js';

const [siteUrl, expectedApiUrl] = process.argv.slice(2);
assert.ok(siteUrl && expectedApiUrl, 'Usage: npm run check:deployment -- <gallery URL> <expected API directory URL>');
const site = new URL(siteUrl);
const expectedApi = new URL(expectedApiUrl).href;
const read = async (path) => {
  const response = await fetch(new URL(path, site), { cache: 'no-store' });
  assert.ok(response.ok, `${response.url}: HTTP ${response.status}`);
  return response;
};
const source = await (await read('runtime-config.js')).text();
const config = JSON.parse(source.match(/SAME_PROMPT_CONFIG\s*=\s*(\{[^\n]*\})/)?.[1] ?? 'null');
assert.ok(config?.apiBaseUrl, 'Published runtime must explicitly configure the production API');
const configuredApi = new URL(config.apiBaseUrl, site);
if (configuredApi.pathname === '/') configuredApi.pathname = '/api/';
if (!configuredApi.pathname.endsWith('/')) configuredApi.pathname += '/';
const actualApi = configuredApi.href;
assert.equal(actualApi, expectedApi, 'Published Gallery API differs from the expected production API');
const response = await fetch(new URL('catalog', actualApi), { cache: 'no-cache', headers: { Origin: site.origin } });
assert.ok(response.ok, `Configured public catalog: HTTP ${response.status}`);
assert.equal(response.headers.get('access-control-allow-origin'), site.origin, 'Gallery origin must be allowed by the API');
const bootstrap = await response.json();
for (const key of ['user', 'me', 'review', 'reactions', 'workAccess']) {
  assert.equal(Object.hasOwn(bootstrap, key), false, `Public catalog must not contain ${key}`);
}
const etag = response.headers.get('etag');
assert.ok(etag, 'Public catalog must have a validator');
assert.match(response.headers.get('cache-control') ?? '', /no-cache/, 'Public catalog must be revalidated');
const validation = await fetch(new URL('catalog', actualApi), { headers: { Origin: site.origin, 'If-None-Match': etag } });
// A concurrent publication may legitimately replace the catalog during this check.
assert.ok([200, 304].includes(validation.status), `Catalog revalidation: HTTP ${validation.status}`);
if (validation.status === 200) {
  const updatedTag = validation.headers.get('etag');
  assert.ok(updatedTag, 'An updated catalog must still have a validator');
  assert.notEqual(updatedTag.replace(/^W\//, ''), etag.replace(/^W\//, ''),
    'An unchanged catalog must return 304; check whether the proxy forwards If-None-Match');
}
assert.equal(validation.headers.get('access-control-allow-origin'), site.origin, 'Revalidation must retain CORS headers');
const session = await fetch(new URL('session', actualApi), { headers: { Origin: site.origin } });
assert.ok(session.ok, `Configured session: HTTP ${session.status}`);
assert.equal(session.headers.get('cache-control'), 'no-store', 'Session must not be cached');
assert.equal((await session.json()).user, null, 'Credential-free deployment check must remain anonymous');
const catalog = await (await read('data.json')).json();
assert.ok(compatibleBuild(catalog.buildInfo, bootstrap), 'Published Gallery and configured API must be compatible');
const { datapack, catalogDigest } = catalog.buildInfo;
if (datapack === null) {
  assert.match(catalogDigest ?? '', /^[a-f0-9]{64}$/, 'A local build requires its catalog digest');
  assert.equal(bootstrap.catalogDigest, catalogDigest, 'Published Gallery and configured API must use the same catalog');
} else {
  assert.match(datapack, /^[a-f0-9]{40}$/, 'A pinned build requires its full commit SHA');
  assert.equal(bootstrap.datapack, datapack, 'Published Gallery and configured API must use the same datapack');
}
const questionIds = new Set(bootstrap.questions.map(question => question.id));
const missing = catalog.tasks.filter(task => !questionIds.has(task.id));
assert.equal(missing.length, 0, `Configured API is missing packaged questions: ${missing.map(task => task.id).join(', ')}`);
console.log(JSON.stringify({ api: actualApi, questions: bootstrap.questions.length, communityQuestions: bootstrap.questions.filter((q) => !catalog.tasks.some((t) => t.id === q.id)).length, works: bootstrap.works.length, server: bootstrap.serverVersion, revalidation: validation.status, session: session.status }));
