import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {
  CATEGORIES,
  TEMPLATE_LABELS,
  benchmarkTask,
  categoryOf,
  matchesQuery,
  pdfTask,
  publishableCategories,
  subcategoriesOf,
  templatesOf,
  votedTask,
} from '../site/categories.js';
import { setLocale, translateText } from '../site/i18n.js';

function withBrowserStubs(run) {
  const original = {
    document: globalThis.document,
    window: globalThis.window,
    addEventListener: globalThis.addEventListener,
    removeEventListener: globalThis.removeEventListener,
    fetch: globalThis.fetch,
    history: globalThis.history,
    location: globalThis.location,
    SAME_PROMPT_CONFIG: globalThis.SAME_PROMPT_CONFIG,
  };
  globalThis.document = Object.assign(new EventTarget(), {
    baseURI: 'https://gallery.test/',
    activeElement: null,
    visibilityState: 'visible',
    title: '',
  });
  globalThis.window = new EventTarget();
  globalThis.addEventListener = globalThis.window.addEventListener.bind(globalThis.window);
  globalThis.removeEventListener = globalThis.window.removeEventListener.bind(globalThis.window);
  globalThis.history = { state: {}, replaceState() {}, pushState() {} };
  globalThis.location = { hash: '#/leaderboard/curated', replace(next) { this.hash = next; } };
  globalThis.SAME_PROMPT_CONFIG = { apiBaseUrl: 'https://backend.test/api/', guidedVoting: true };
  return Promise.resolve().then(run).finally(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
}

function makeContainer() {
  const attributes = new Map();
  const rows = [];
  return Object.assign(new EventTarget(), {
    innerHTML: '',
    isConnected: true,
    setAttribute(k, v) { attributes.set(k, v); },
    removeAttribute(k) { attributes.delete(k); },
    getAttribute(k) { return attributes.get(k); },
    querySelector(selector) {
      if (selector === '[data-board]') return this;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-backend-row]') return rows;
      return [];
    },
  });
}

test('backend category, PDF subcategory, helpers and terminal icon match specification', async () => {
  await withBrowserStubs(async () => {
    const { icon } = await import('../site/ui.js');
    assert.match(icon('terminal'), /<rect x="3\.5" y="4\.5"/);

    const design = categoryOf('静态网页');
    assert.equal(design.note, '网页、像素画与 PDF 文档排版');
    assert.deepEqual(subcategoriesOf('静态网页'), [
      { name: '网页', label: '网页' },
      { name: '像素画', label: '像素画' },
      { name: 'PDF', label: 'PDF', templates: ['pdf'] },
    ]);

    const backend = categoryOf('后端');
    assert.deepEqual(backend, {
      name: '后端',
      label: '后端',
      note: '离线闭卷后端工程基准 · 仅展示排名数据',
      slug: 'backend',
      glyph: 'terminal',
      templates: [],
      judging: 'benchmark',
      publish: false,
      subcategories: [],
    });

    assert.equal(TEMPLATE_LABELS.pdf, '单个 PDF 文件');
    assert.equal(publishableCategories().some((c) => c.name === '后端'), false);
    assert.equal(publishableCategories().some((c) => c.name === '静态网页'), true);

    const pdf = { id: 'p1', title: 'PDF排版', category: '静态网页', subcategory: 'PDF', domains: ['设计'] };
    const web = { id: 'w1', title: '网页', category: '静态网页', subcategory: '网页', domains: ['计算机技术'] };
    const reason = { id: 'r1', title: '推理', category: '推理', domains: ['数学'] };
    const bench = { id: 'agb-v41-ez', title: '基础维护卷', category: '后端', languages: ['Python'], benchmark: { tier: 'EZ' }, domains: ['计算机技术'] };

    assert.equal(pdfTask(pdf), true);
    assert.equal(pdfTask(web), false);
    assert.deepEqual(templatesOf(pdf), ['pdf']);
    assert.deepEqual(templatesOf(web), ['static']);
    assert.deepEqual(templatesOf(bench), []);

    assert.equal(benchmarkTask(bench), true);
    assert.equal(benchmarkTask({ id: 'x', benchmarkOnly: true }), true);
    assert.equal(votedTask(bench), false);
    assert.equal(votedTask(reason), false);
    assert.equal(votedTask(pdf), true);

    for (const kw of ['Python', 'EZ', '后端']) assert.equal(matchesQuery(bench, kw), true, kw);
    assert.equal(matchesQuery(pdf, 'PDF'), true);
  });
});

test('backend-board renders 1:2:1:2 composite mode, partial rows, unreliable toggle, and single-tier fallback', async () => {
  await withBrowserStubs(async () => {
    const compositePayload = {
      benchmark: 'AGB-Bench v4.1',
      rows: [
        {
          rank: 1,
          name: 'AlphaCoder Pro',
          vendor: 'AlphaLab',
          effort: 'High',
          harness: 'SWE-Agent',
          totalScore: 540.5,
          scores: { EZ: 96.0, HD: 88.25, IN: 95.0, AT: 86.5 },
          totalTokens: 12_400_000,
          note: '全卷实测',
        },
        {
          rank: 2,
          name: 'Canary Model',
          vendor: 'BetaLab',
          effort: 'Max',
          harness: 'Codex',
          badge: '灰测',
          unreliable: true,
          totalScore: 510.0,
          scores: { EZ: 92.0, HD: 82.0, IN: 90.0, AT: 82.0 },
          totalTokens: 9_500_000,
          note: '灰度窗口采样',
        },
      ],
      partialRows: [
        { name: 'Qwen3.8 Flash', vendor: 'Alibaba', effort: 'Default', harness: 'Agent', totalScore: 260, scores: { EZ: 90, IN: 85, AT: 85 }, totalTokens: 3_100_000, note: '缺HD卷' },
        { name: 'GLM 5.4 Low', vendor: 'Zhipu', effort: 'Low', harness: 'Agent', totalScore: 78, scores: { AT: 78 }, totalTokens: 1_200_000, note: '仅测AT' },
      ],
    };

    const requests = [];
    globalThis.fetch = async (url) => {
      requests.push(String(url));
      if (String(url).includes('tier=')) {
        return new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify(compositePayload), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const { mountBackendBoard } = await import('../site/backend-board.js');
    const container = makeContainer();
    const composite = mountBackendBoard(container, {
      tier: null,
      DATA: { model: ({ modelName, vendor }) => ({ name: modelName, vendor, logo: '' }) },
    });
    try {
      await composite.ready;

      assert.match(requests[0], /leaderboard\/backend$/);
      assert.match(container.innerHTML, /AGB-Bench v4\.1/);
      assert.match(container.innerHTML, /权重 1 : 2 : 1 : 2/);
      assert.match(container.innerHTML, /#\/leaderboard\/backend\/ez/);
      assert.match(container.innerHTML, /#\/leaderboard\/backend\/hd/);
      assert.match(container.innerHTML, /#\/leaderboard\/backend\/in/);
      assert.match(container.innerHTML, /#\/leaderboard\/backend\/at/);
      assert.match(container.innerHTML, /AlphaCoder Pro/);
      assert.match(container.innerHTML, /540\.50/);
      assert.match(container.innerHTML, /90\.08/);
      assert.match(container.innerHTML, /Canary Model/);
      assert.match(container.innerHTML, /灰测/);
      assert.match(container.innerHTML, /未完赛参考（缺卷）/);
      assert.match(container.innerHTML, /Qwen3\.8 Flash/);
      assert.match(container.innerHTML, /缺HD卷/);
      assert.match(container.innerHTML, /GLM 5\.4 Low/);
      assert.match(container.innerHTML, /仅测AT/);
      assert.match(container.innerHTML, /class="range backend-range"/);

      // Unchecking the unreliable toggle hides unreliable: true rows.
      const changeEvent = new Event('change');
      Object.defineProperty(changeEvent, 'target', {
        value: { matches: (sel) => sel === '[data-backend-unreliable]', checked: false },
      });
      container.dispatchEvent(changeEvent);
      assert.match(container.innerHTML, /AlphaCoder Pro/);
      assert.doesNotMatch(container.innerHTML, /Canary Model/);
    } finally {
      composite.destroy();
    }

    // Single-tier mode falls back gracefully to ctx.task.benchmark when API fails.
    const tierContainer = makeContainer();
    const tierBoard = mountBackendBoard(tierContainer, {
      tier: 'HD',
      DATA: { model: ({ modelName, vendor }) => ({ name: modelName, vendor, logo: '' }) },
      task: {
        benchmark: {
          tier: 'HD',
          name: '底层系统卷',
          weight: 2,
          languages: ['Go', 'C'],
          status: '深水区分化',
          rows: [
            { rank: 1, name: 'SystemsModel', vendor: 'LabX', effort: 'Ultra', harness: 'CLI', score: 88.4, brs: '0.94', tokens: 6_200_000, note: 'Go+C 通过' },
          ],
        },
      },
    });
    try {
      await tierBoard.ready;
      assert.match(tierContainer.innerHTML, /底层系统卷/);
      assert.match(tierContainer.innerHTML, />Go</);
      assert.match(tierContainer.innerHTML, />C</);
      assert.match(tierContainer.innerHTML, /总榜权重 ×2/);
      assert.match(tierContainer.innerHTML, /#\/leaderboard\/backend/);
      assert.match(tierContainer.innerHTML, /SystemsModel/);
      assert.match(tierContainer.innerHTML, /88\.40/);
      assert.match(tierContainer.innerHTML, /BRS 健康度/);
    } finally {
      tierBoard.destroy();
    }
  });
});

test('leaderboard unifies 大众榜 and 精选榜 icons, names, order and adds 后端榜 group', async () => {
  await withBrowserStubs(async () => {
    const { icon } = await import('../site/ui.js');
    globalThis.fetch = async (url) => {
      const target = String(url);
      if (target.includes('curated/info') || target.endsWith('curated')) {
        return new Response(JSON.stringify({
          revision: 1,
          sections: [
            { id: 'music', name: '音乐', category: '音乐', questionCount: 1 },
            { id: '3d', name: '三维建模', category: '建模', questionCount: 3 },
            { id: 'web', name: '网页设计', category: '静态网页', questionCount: 5 },
            { id: 'lit', name: '文学', category: '文学', questionCount: 2 },
            { id: 'custom', name: '专题精选', questionCount: 1 },
          ],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        audience: 'curated',
        rows: [],
        unranked: [],
        totals: { votes: 0, voters: 0 },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const { mount } = await import('../site/leaderboard.js');
    const boardHost = makeContainer();
    const root = Object.assign(new EventTarget(), {
      innerHTML: '',
      querySelector(selector) {
        if (selector === '[data-board]') return boardHost;
        return null;
      },
      querySelectorAll() { return []; },
    });
    let capturedNav = '';
    let capturedHeading = '';
    const page = mount(root, {
      DATA: {
        title: 'Test',
        tasks: [
          { id: 't-lit', category: '文学', domains: [], results: [] },
          { id: 't-web', category: '静态网页', domains: [], results: [] },
          { id: 't-3d', category: '建模', domains: [], results: [] },
          { id: 't-music', category: '音乐', domains: [], results: [] },
          { id: 'agb-v41-hd', category: '后端', benchmark: { tier: 'HD' }, domains: [], results: [] },
        ],
      },
      modelOf: (r) => r,
      pageStart: ({ heading, nav }) => {
        capturedHeading = heading;
        capturedNav = nav;
        return '';
      },
      pageEnd: () => '',
      sideNav: (label, links) => `<nav aria-label="${label}">${links.map(([href, glyph, text, current, count]) => `<a href="${href}" data-glyph="${glyph}"${current ? ' aria-current="page"' : ''}>${text}<span>${count}</span></a>`).join('')}</nav>`,
    });
    try {
      await page.ready;

      assert.equal(capturedHeading, '精选 · 综合');
      assert.match(capturedNav, /<h2 class="board-nav-title">大众榜<\/h2>/);
      assert.match(capturedNav, /<h2 class="board-nav-title">精选榜<\/h2>/);
      assert.match(capturedNav, /<h2 class="board-nav-title">后端榜<\/h2>/);

      const curatedPart = capturedNav.split('data-curated-nav')[1].split('后端榜')[0];
      assert.match(curatedPart, /href="#\/leaderboard\/curated"[^>]*>.*?综合/);
      assert.doesNotMatch(curatedPart, /网页设计|三维建模/);
      const labels = [...curatedPart.matchAll(/<span(?: data-i18n-ignore)?>(语言|设计|三维|音乐|专题精选)<\/span>/g)].map((m) => m[1]);
      assert.deepEqual(labels, ['语言', '设计', '三维', '音乐', '专题精选']);
      assert.match(curatedPart, /<span>语言<\/span>/);
      assert.match(curatedPart, /<span>设计<\/span>/);
      assert.match(curatedPart, /<span>三维<\/span>/);
      assert.match(curatedPart, /<span>音乐<\/span>/);
      assert.match(curatedPart, /<span data-i18n-ignore>专题精选<\/span>/);
      for (const cat of CATEGORIES.filter((c) => c.judging === 'vote')) {
        assert.ok(curatedPart.includes(icon(cat.glyph)), `curated nav uses ${cat.glyph} icon for ${cat.label}`);
      }

      assert.match(capturedNav, /href="#\/leaderboard\/backend"[^>]*>合成总榜<span>4<\/span>/);
      assert.match(capturedNav, /href="#\/leaderboard\/backend\/ez"[^>]*>EZ · Python<span>×1<\/span>/);
      assert.match(capturedNav, /href="#\/leaderboard\/backend\/hd"[^>]*>HD · Go \+ C<span>×2<\/span>/);
      assert.match(capturedNav, /href="#\/leaderboard\/backend\/in"[^>]*>IN · Python<span>×1<\/span>/);
      assert.match(capturedNav, /href="#\/leaderboard\/backend\/at"[^>]*>AT · Python<span>×2<\/span>/);
    } finally {
      page.destroy();
    }

    // Backend composite route mounts mountBackendBoard cleanly.
    globalThis.location.hash = '#/leaderboard/backend';
    let backendFetch = '';
    globalThis.fetch = async (url) => {
      backendFetch = String(url);
      return new Response(JSON.stringify({ benchmark: 'AGB-Bench v4.1', rows: [], partialRows: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const backendPage = mount(root, {
      DATA: { title: 'Test', tasks: [], model: ({ modelName, vendor }) => ({ name: modelName, vendor, logo: '' }) },
      modelOf: (r) => r,
      pageStart: ({ heading, nav }) => {
        capturedHeading = heading;
        capturedNav = nav;
        return '';
      },
      pageEnd: () => '',
      sideNav: (label, links) => `<nav aria-label="${label}">${links.map(([href, glyph, text, current, count]) => `<a href="${href}" data-glyph="${glyph}"${current ? ' aria-current="page"' : ''}>${text}<span>${count}</span></a>`).join('')}</nav>`,
    });
    try {
      await backendPage.ready;
      assert.equal(capturedHeading, 'AGB-Bench v4.1 · 后端合成总榜');
      assert.match(backendFetch, /leaderboard\/backend$/);
    } finally {
      backendPage.destroy();
    }
  });
});

test('publish.js emits templates: ["pdf"] for 静态网页 + PDF and submit.js rejects HTML for PDF', async () => {
  const publishSource = readFileSync(new URL('../site/publish.js', import.meta.url), 'utf8');
  const fields = new Map();
  const field = (name) => {
    if (!fields.has(name)) fields.set(name, { value: '', innerHTML: '', textContent: '', hidden: false, focus() {} });
    return fields.get(name);
  };
  const form = { querySelector: field, querySelectorAll: () => [] };
  const root = {
    innerHTML: '',
    querySelector: (selector) => (selector === '.publish-form' ? form : field(selector)),
  };
  const reads = [];
  const state = {
    AbortController,
    URLSearchParams,
    history: { state: {} },
    setTimeout() { return 1; },
    clearTimeout() {},
    accountVersion: () => 1,
    platform: { user: { id: 'one' } },
    can: () => true,
    addEventListener() {},
    removeEventListener() {},
    setPageTitle() {},
    scrollTo() {},
    referencesEnabled: () => false,
    $: (selector, node) => node.querySelector(selector),
    $$: (selector, node) => node.querySelectorAll(selector),
    esc: String,
    formatDate: String,
    pad: String,
    icon: () => '',
    moderationBadge: () => '',
    reviewVerdict: () => '',
    categoryOf,
    subcategoriesOf,
    categoryField: () => '',
    domainField: () => '',
    syncDomains() {},
    TEMPLATE_LABELS,
    resolveApiMedia: (data) => data,
    requireUser: async () => true,
    toast() {},
    refreshPlatform: async () => {},
    FormData: class {
      get(key) {
        return { title: 'PDF 报告', summary: '排版测试', prompt: '导出 PDF', category: '静态网页', subcategory: 'PDF' }[key];
      }
      getAll(key) {
        return { domains: ['计算机技术'], templates: ['pdf'] }[key] ?? [];
      }
    },
    api(path, options = {}) {
      reads.push({ path, ...options });
      return Promise.resolve({ question: { id: 'q-pdf', moderation: { status: 'pending' } } });
    },
  };
  vm.runInNewContext(publishSource.replace(/^import .*$/gm, '').replace('export function mount', 'function mount') + '\nglobalThis.mountForTest = mount;', state);
  const page = state.mountForTest(root, { param: null, DATA: { title: 'Fixture' }, pageStart: () => '', pageEnd: () => '' });
  try {
    root.onsubmit({ target: form, submitter: { value: 'plain' }, preventDefault() {} });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(reads[0].path, 'questions');
    assert.deepEqual([...reads[0].body.templates], ['pdf']);
    assert.equal(reads[0].body.subcategory, 'PDF');
  } finally {
    page.destroy();
  }

  const submitSource = readFileSync(new URL('../site/submit.js', import.meta.url), 'utf8');
  assert.match(submitSource, /pdf:\s*\{\s*accept:\s*'\.pdf,application\/pdf'/);
  assert.match(submitSource, /PDF 题目不接受 HTML 文件，请上传单个 \.pdf 文件/);
  assert.match(submitSource, /请在下面翻阅一遍，确认 PDF 每一页都解析正常/);
});

test('i18n translates new backend, curated and PDF interface copy to English', () => {
  setLocale('en');
  try {
    for (const [zh, expected] of [
      ['后端', 'Backend'],
      ['后端榜', 'Backend'],
      ['合成总榜', 'Composite'],
      ['精选 · 综合', 'Curated · Overall'],
      ['精选 · 设计', 'Curated · Design'],
      ['精选 · 三维', 'Curated · 3D'],
      ['单个 PDF 文件', 'Single PDF file'],
      ['拖入单个 .pdf 文件', 'Drop a single .pdf file'],
      ['PDF 题目不接受 HTML 文件，请上传单个 .pdf 文件', 'PDF questions do not accept HTML files; upload a single .pdf file'],
      ['基础维护卷', 'Basic Maintenance Tier'],
      ['底层系统卷', 'Low-level Systems Tier'],
      ['高耦合排障卷', 'High-Coupling Debugging Tier'],
      ['架构演进卷', 'Architecture Evolution Tier'],
      ['闭卷排名', 'Closed-book rankings'],
      ['显示不可靠参考项（灰测 / V3转算）', 'Show unreliable references (canary / V3-converted)'],
      ['未完赛参考（缺卷）', 'Incomplete references (missing tiers)'],
    ]) {
      assert.equal(translateText(zh), expected, zh);
    }
  } finally {
    setLocale('zh-CN');
  }
});
