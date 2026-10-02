// Opens the real review dialog and records the verification request body.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const site = join(import.meta.dirname, '..', 'site');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const harness = `<!doctype html><meta charset="utf-8"><body>
<script type="module">
import { openReview } from './account.js';
import { platform } from './platform.js';
platform.site = { efforts: ['High'] };
const ctx = {
  DATA: { tasks: [{ id: 'one', title: '题', results: [] }], models: [{ id: 'm', name: 'Model', vendor: 'V' }] },
  MODELS: new Map([['m', { name: 'Model' }]]),
  HARNESSES: new Map([['codex', { id: 'codex', name: 'Codex', listed: true }]]),
  PROVIDERS: new Map([['official', { id: 'official', name: '官方' }]]),
  harnessOf: () => ({ name: 'Codex' }),
  providerOf: () => ({ id: 'official', name: '官方' }),
};
const work = {
  id: 'up1', task: 'one', title: '作品', modelName: 'Model', model: 'm', effort: 'Default',
  vendor: 'V', tool: 'Codex', status: 'unverified', summary: '说明', note: '', files: 1, bytes: 100,
  root: '', entry: 'index.html', sourceName: 'a.html', checks: [], trial: {},
  moderation: { status: 'approved' }, harness: 'codex', provider: 'official',
  generationMode: 'single-turn', humanIntervention: 'none',
};
window.openIt = () => openReview(ctx, work);
</script></body>`;

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://gallery.local');
  if (url.pathname === '/harness.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(harness);
    return;
  }
  const file = normalize(join(site, decodeURIComponent(url.pathname)));
  if (!file.startsWith(site)) { res.writeHead(403); res.end(); return; }
  try {
    const body = readFileSync(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const posts = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
page.on('pageerror', (error) => posts.push({ pageerror: error.message }));
await page.route('**/*', async (route) => {
  const request = route.request();
  if (request.method() === 'POST') posts.push({ url: request.url(), body: request.postData() });
  if (request.url().startsWith(base)) return route.continue();
  await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
});
await page.goto(`${base}/harness.html`);
await page.waitForFunction(() => window.openIt);

async function pass(check) {
  await page.evaluate(() => document.querySelectorAll('dialog').forEach((dialog) => dialog.remove()));
  await page.evaluate(() => window.openIt());
  const box = page.locator('dialog input[name="toInbox"]').last();
  await box.waitFor();
  if (check) await box.check();
  else await box.uncheck();
  await page.locator('dialog [data-decide="verified"]').last().click();
  await page.waitForTimeout(300);
  const message = await page.locator('dialog .form-error').last().textContent().catch(() => '');
  if (message?.trim()) posts.push({ formError: message.trim() });
}

await pass(false);
await pass(true);
await browser.close();
server.close();
const reviews = posts.filter((item) => item.url?.includes('/review'));
const bodies = reviews.map((item) => JSON.parse(item.body));
const unchecked = bodies.find((body) => body.entertainment === false);
const checked = bodies.find((body) => body.entertainment === true);
if (!unchecked || !checked || bodies.length < 2) {
  console.error(JSON.stringify({ posts, bodies }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ unchecked, checked, reviews: bodies.length }));
