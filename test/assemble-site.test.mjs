import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

test('assembly excludes private inputs and preserves the previous site when a later build fails', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'gallery-assembly-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (name, content) => {
    const path = join(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  };
  // Use the actual assembly entry point with an isolated local package.
  cpSync(new URL('../scripts/', import.meta.url), join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'site'));
  for (const name of ['media-cdn.js', 'reference-files.js']) {
    cpSync(new URL('../site/' + name, import.meta.url), join(root, 'site', name));
  }
  put('package.json', '{"type":"module"}');
  put('site/index.html', '<head><script type="importmap">{"imports":{}}</script></head>');
  for (const name of ['result-previews.js', 'preview-model.js', 'scene-resources.js']) put('site/' + name, '');
  for (const name of ['three.module.js', 'three.core.js', 'OrbitControls.js', 'BufferGeometryUtils.js']) put('.datapack/vendor/' + name, '');
  put('.datapack/assets/brands/README.md', 'sample.svg');
  put('.datapack/assets/brands/sample.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const config = { title: 'Test', subtitle: 'Test', description: 'Test', repo: 'https://example.test' };
  put('site-config.json', JSON.stringify(config));
  put('.datapack/data.json', JSON.stringify({ ...config,
    models: [{ id: 'model', name: 'Model', vendor: 'Vendor', brandName: 'Brand', brandUrl: config.repo, logo: 'assets/brands/sample.svg' }],
    tasks: [{ id: 'task', title: 'Task', prompt: 'Prompt', tags: [], conditions: [], results: [] }],
  }));
  put('.datapack/integration.json', '{}');
  put('site/.env.local.js', 'private');
  const build = (env = {}) => spawnSync(process.execPath, ['scripts/assemble-site.mjs'], { cwd: root, env, encoding: 'utf8' });
  let run = build();
  assert.equal(run.status, 0, run.stderr);
  assert.equal(existsSync(join(root, 'dist/integration.json')), false);
  assert.equal(existsSync(join(root, 'dist/.env.local.js')), false);
  const version = readFileSync(join(root, 'dist/version.json'), 'utf8');
  run = build({ API_BASE_URL: 'https://user@example.test/' });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /without credentials/);
  assert.equal(readFileSync(join(root, 'dist/version.json'), 'utf8'), version);
  put('.datapack/preview-model.js', '// Synthetic collision');
  run = build();
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /collides/);
  assert.equal(readFileSync(join(root, 'dist/version.json'), 'utf8'), version);
});
