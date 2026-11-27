import assert from 'node:assert/strict';
import { test } from 'node:test';

test('sample visibility respects the five-work boundary without changing scores, ranks, or provisional labels', async () => {
  const original = { document: globalThis.document, window: globalThis.window, addEventListener: globalThis.addEventListener };
  globalThis.document = Object.assign(new EventTarget(), { baseURI: 'https://gallery.test/' });
  globalThis.window = new EventTarget();
  globalThis.addEventListener = globalThis.window.addEventListener.bind(globalThis.window);
  let visibleBoardEntries;
  try { ({ visibleBoardEntries } = await import('../site/leaderboard.js')); }
  finally { Object.assign(globalThis, original); }
  for (const by of ['config', 'model']) {
    const data = { by, rows: [
      { key: 'small', works: 4, games: 21, rank: 1, score: 1400, provisional: false },
      { key: 'five', works: 5, games: 21, rank: 2, score: 1300, provisional: true },
      { key: 'large', works: 12, games: 30, rank: 3, score: 1200, provisional: false },
    ], unranked: [{ key: 'unrated-small', works: 4 }, { key: 'unrated-five', works: 5 }] };
    const before = structuredClone(data);
    assert.deepEqual(visibleBoardEntries(data).rows, data.rows.slice(1));
    assert.deepEqual(visibleBoardEntries(data).unranked, []);
    assert.deepEqual(visibleBoardEntries(data, true), { rows: data.rows, unranked: [] });
    const boundary = { rows: [{ works: 12, games: 20 }, { works: 1, games: 21 }], unranked: [] };
    assert.deepEqual(visibleBoardEntries(boundary).rows, []);
    assert.deepEqual(visibleBoardEntries(boundary, true).rows, boundary.rows.slice(1));
    assert.deepEqual(data, before);
  }
});

test('single-question boards show small entries and aggregate boards renumber after the work filter', async () => {
  const original = { document: globalThis.document, window: globalThis.window, addEventListener: globalThis.addEventListener,
    fetch: globalThis.fetch, SAME_PROMPT_CONFIG: globalThis.SAME_PROMPT_CONFIG, localStorage: globalThis.localStorage };
  globalThis.document = Object.assign(new EventTarget(), { baseURI: 'https://gallery.test/', activeElement: null });
  globalThis.window = new EventTarget();
  globalThis.addEventListener = globalThis.window.addEventListener.bind(globalThis.window);
  globalThis.SAME_PROMPT_CONFIG = { apiBaseUrl: 'https://backend.test/api/' };
  const settings = new Map();
  globalThis.localStorage = { getItem: key => settings.get(key) ?? null, setItem: (key, value) => settings.set(key, value) };
  let calls = 0;
  globalThis.fetch = async url => {
    calls++;
    const params = new URL(url).searchParams;
    const small = { key: 'small', modelName: 'Small sample sentinel', model: 'small',
      rank: 1, works: 1, score: 1300, interval: 100, games: 21, wins: 13, draws: 0, losses: 8, winRate: 13 / 21, provisional: true };
    const large = { ...small, key: 'large', modelName: 'Large sample sentinel', model: 'large', rank: 2, works: 5, score: 1200 };
    return Response.json({ by: params.get('by'), rows: params.has('task') ? [small] : [small, large],
    unranked: [], totals: { votes: 21, voters: 3 } });
  };
  try {
    const { mountBoard } = await import('../site/leaderboard.js');
    for (const scope of ['aggregate', 'question', 'embedded']) for (const by of ['config', 'model']) {
      const task = scope === 'aggregate' ? undefined : { id: `visibility-${scope}-${by}` };
      settings.set('board-unit', by); settings.set('board-show-small-samples', 'false');
      const container = Object.assign(new EventTarget(), { innerHTML: '', setAttribute() {}, removeAttribute() {},
        querySelector() { return null; }, querySelectorAll() { return []; } });
      let delivered, visibleRows;
      const board = mountBoard(container, { embedded: scope === 'embedded', task,
        modelOf: row => ({ name: row.modelName, vendor: 'Test' }),
        onData(data, visibility) { delivered = data; visibleRows = visibility.visibleRows; } });
      try {
        await board.ready;
        assert.equal(delivered.by, by);
        if (task) {
          assert.match(container.innerHTML, /Small sample sentinel/);
          assert.match(container.innerHTML, /class="badge provisional" title="比较少于 30 次">暂定/);
          assert.doesNotMatch(container.innerHTML, /data-board-small|5 件/);
          assert.equal(visibleRows, 1);
          assert.equal(settings.get('board-show-small-samples'), 'false');
          continue;
        }
        const ranks = () => [...container.innerHTML.matchAll(/<td class="c-rank is-top">(\d+)<\/td>/g)].map(match => match[1]);
        assert.doesNotMatch(container.innerHTML, /Small sample sentinel/);
        assert.deepEqual(ranks(), ['01']);
        assert.equal(visibleRows, 1); assert.equal(delivered.rows[1].rank, 2);
        const requests = calls;
        const toggle = checked => {
          const event = new Event('change');
          Object.defineProperty(event, 'target', { value: { checked, matches: selector => selector === '[data-board-small]' } });
          container.dispatchEvent(event);
        };
        toggle(true);
        assert.match(container.innerHTML, /Small sample sentinel/);
        assert.match(container.innerHTML, /class="badge provisional" title="比较少于 30 次">暂定/);
        assert.deepEqual(ranks(), ['01', '02']);
        assert.equal(visibleRows, 2); assert.equal(delivered.rows[1].rank, 2);
        assert.equal(settings.get('board-show-small-samples'), 'true');
        toggle(false);
        assert.doesNotMatch(container.innerHTML, /Small sample sentinel/);
        assert.deepEqual(ranks(), ['01']);
        assert.equal(visibleRows, 1); assert.equal(calls, requests, 'display changes do not request a new ranking');
      } finally { board.destroy(); }
    }
  } finally { Object.assign(globalThis, original); }
});

// v3 (plan 03): no work-count switch, three groups, rank ranges only when wider than one place, search across groups.
test('v3 boards drop the work switch, fold partial and watch groups, show ranges, and search every group', async () => {
  const original = { document: globalThis.document, window: globalThis.window, addEventListener: globalThis.addEventListener,
    fetch: globalThis.fetch, SAME_PROMPT_CONFIG: globalThis.SAME_PROMPT_CONFIG, localStorage: globalThis.localStorage };
  globalThis.document = Object.assign(new EventTarget(), { baseURI: 'https://gallery.test/', activeElement: null });
  globalThis.window = new EventTarget();
  globalThis.addEventListener = globalThis.window.addEventListener.bind(globalThis.window);
  globalThis.SAME_PROMPT_CONFIG = { apiBaseUrl: 'https://backend.test/api/', guidedVoting: true };
  const settings = new Map();
  globalThis.localStorage = { getItem: key => settings.get(key) ?? null, setItem: (key, value) => settings.set(key, value) };
  const scoring = { version: 3, weighted: true, minimumGames: 21, minimumTasks: 3, maxTaskShare: 0.5, minimumEffectiveVoters: 10,
    taskSpread: 85, rankRange: 0.95, composite: { 建模: 1, 静态网页: 1, 文学: 1 } };
  const stats = { games: 40, wins: 20, draws: 4, losses: 16, winRate: 0.55, voters: 30, works: 2, provisional: false };
  const parts = (a, b, c) => ({ 建模: { rank: a, aligned: 1100.4 }, 静态网页: { rank: b, aligned: 1000 }, 文学: { rank: c, aligned: 990 } });
  const reads = [];
  globalThis.fetch = async url => {
    const address = new URL(url);
    reads.push(address.pathname + address.search);
    const composite = !address.searchParams.has('category');
    return Response.json({ by: address.searchParams.get('by'), category: address.searchParams.get('category'), unranked: [],
      totals: { votes: 400, voters: 60 }, provisionalGames: 30, scoring,
      rows: [
        { ...stats, key: 'solo', model: 'solo', modelName: 'Solo Leader', rank: 1, rankLow: 1, rankHigh: 1, score: 1180.6, interval: 30.2, intervalVotes: 20, tasks: 12, ...(composite ? { parts: parts(1, 1, 1) } : {}) },
        { ...stats, key: 'span', model: 'span', modelName: 'Spread Second', rank: 2, rankLow: 2, rankHigh: 8, score: 1090, interval: 40, intervalVotes: 24, tasks: 9, ...(composite ? { parts: parts(2, 3, 4) } : {}) },
      ],
      partial: composite ? [{ ...stats, key: 'half', model: 'half', modelName: 'Claude Partial', tasks: 4, parts: { 建模: { rank: 3, aligned: 1050 } }, missing: ['静态网页', '文学'] }] : [],
      watch: composite
        ? [{ ...stats, key: 'thin', model: 'thin', modelName: 'Claude Watch', score: 1070, interval: 94.4, intervalVotes: 50, tasks: 5, reasons: ['coverage'] }]
        : [{ ...stats, key: 'few', model: 'few', modelName: 'Few Tasks', score: 1010, interval: 120, tasks: 2, taskShare: 0.7, effectiveVoters: 8.6, reasons: ['tasks', 'task-share', 'voters'] }] });
  };
  // Enough of a DOM for the search: rows, groups and the "found in" line are read back from the rendered markup.
  const fakeDom = (container) => {
    let parsed = { html: null };
    const parse = () => {
      if (parsed.html === container.innerHTML) return parsed;
      const rows = [...container.innerHTML.matchAll(/data-board-row="([^"]*)" data-board-in="(\w+)"/g)]
        .map(([, text, group]) => ({ dataset: { boardRow: text, boardIn: group }, hidden: false }));
      const groups = [...container.innerHTML.matchAll(/<tbody class="[^"]*" data-board-group="(\w+)"|<tbody data-board-group="(\w+)"/g)].map(([, a, b]) => {
        const toggle = { expanded: null, setAttribute(_, value) { this.expanded = value; } };
        const group = { dataset: { boardGroup: a ?? b }, open: null, toggle, querySelector: () => toggle };
        group.classList = { toggle: (_, on) => { group.open = on; } };
        return group;
      });
      parsed = { html: container.innerHTML, rows, groups, found: { hidden: true, innerHTML: '' }, none: { hidden: true } };
      return parsed;
    };
    Object.assign(container, {
      querySelectorAll: selector => selector === '[data-board-row]' ? parse().rows : selector === 'tbody[data-board-group]' ? parse().groups : [],
      querySelector: selector => selector === '[data-board-found]' ? parse().found : selector === '[data-board-none]' ? parse().none : null,
      state: parse,
    });
    return container;
  };
  try {
    const { mountBoard } = await import('../site/leaderboard.js');
    const container = fakeDom(Object.assign(new EventTarget(), { innerHTML: '', setAttribute() {}, removeAttribute() {} }));
    let visibleRows;
    const board = mountBoard(container, { modelOf: row => ({ name: row.modelName, vendor: 'Test' }), onData(_, visibility) { visibleRows = visibility.visibleRows; } });
    await board.ready;
    const html = container.innerHTML;
    assert.equal(reads[0], '/api/leaderboard/next?by=model', 'the overall v3 board defaults to models');
    assert.doesNotMatch(html, /data-board-small|5 件/);
    assert.equal(visibleRows, 2, 'works below five no longer hide ranked rows');
    assert.match(html, /<td class="c-rank is-top">01<\/td>/, 'a single possible place has no range');
    assert.match(html, /<td class="c-rank is-top">02<small class="rank-range">2–8<\/small><\/td>/);
    // Each group explains its own score: ranked composite rows are combined, composite watch rows are pooled references.
    const tip = (name) => html.match(new RegExp(`<tr class="[^"]*" data-board-row="${name}[^]*?<td class="c-score">([^]*?)</td>`))[1];
    assert.match(tip('solo'), /^<span class="score-tip"><button type="button" class="score-tip-btn" data-score-tip aria-describedby="(board-tip-\d+-\d+)"><b><span data-i18n-number="1181">1181<\/span><\/b><small>±<span data-i18n-number="30">30<\/span><\/small><\/button><span class="score-tip-text" role="tooltip" id="\1">三类区间合成，已含投票和换题的波动<\/span>/);
    assert.match(tip('claude watch'), /role="tooltip" id="[^"]+">混合池参考分，不参与综合排名；投票 ±50，换题 ±80<\/span>/);
    assert.doesNotMatch(tip('claude watch'), /三类区间合成/);
    assert.equal(tip('claude partial'), '—');
    assert.doesNotMatch(html, /<td class="c-score" title=/, 'explanations are focusable, not hover-only titles');
    assert.match(html, /<span>12 道题<\/span>/);
    assert.match(html, /实际胜率/);
    assert.match(html, /<tbody data-board-group="ranked">/);
    for (const [group, title] of [['partial', '未覆盖全部大类'], ['watch', '观察区']]) {
      assert.match(html, new RegExp(`<tbody class="board-group" data-board-group="${group}">`), `${group} starts folded`);
      assert.match(html, new RegExp(`data-board-group-toggle="${group}" aria-expanded="false">.*<b>${title}</b><span class="board-group-count" data-i18n-number="1">1</span>`));
    }
    assert.match(html, /<td class="c-part is-missing"><small>未达标<\/small><\/td>/);
    assert.match(html, /<td class="c-reason" colspan="3"><span>没有哪一类达标<\/span><\/td>/);
    const open = () => Object.fromEntries(container.state().groups.map(group => [group.dataset.boardGroup, group.open]));
    assert.deepEqual(open(), { ranked: true, partial: false, watch: false });
    board.search('claude');
    let state = container.state();
    assert.deepEqual(state.rows.map(row => [row.dataset.boardIn, row.hidden]), [['ranked', true], ['ranked', true], ['partial', false], ['watch', false]]);
    assert.deepEqual(open(), { ranked: true, partial: true, watch: true }, 'groups with matches open while searching');
    assert.equal(state.found.hidden, false);
    assert.match(state.found.innerHTML, /^<span>搜索结果<\/span> · <span>未覆盖全部大类<\/span> <span data-i18n-number="1">1<\/span> · <span>观察区<\/span>/);
    assert.doesNotMatch(state.found.innerHTML, /已排名/);
    board.search('');
    assert.deepEqual(open(), { ranked: true, partial: false, watch: false });
    assert.equal(container.state().found.hidden, true);
    const click = selector => {
      const event = new Event('click');
      Object.defineProperty(event, 'target', { value: { closest: query => query === selector ? { dataset: { boardUnit: 'config', boardGroupToggle: 'watch' } } : null } });
      container.dispatchEvent(event);
    };
    click('[data-board-group-toggle]');
    assert.deepEqual(open(), { ranked: true, partial: false, watch: true });
    click('[data-board-unit]');
    assert.equal(settings.get('board-unit-overall'), 'config');
    assert.equal(settings.get('board-unit'), undefined, 'the v2 unit choice is left alone');
    board.destroy();

    const scoped = fakeDom(Object.assign(new EventTarget(), { innerHTML: '', setAttribute() {}, removeAttribute() {} }));
    const category = mountBoard(scoped, { category: '建模', modelOf: row => ({ name: row.modelName, vendor: 'Test' }) });
    await category.ready;
    assert.equal(reads.at(-1), '/api/leaderboard/next?by=config&category=%E5%BB%BA%E6%A8%A1', 'category boards default to configurations');
    assert.doesNotMatch(scoped.innerHTML, /data-board-group="partial"|c-part/);
    assert.match(scoped.innerHTML, /role="tooltip" id="[^"]+">投票 ±24，换题 ±32<\/span>/);
    // Numbers keep their units on one line: every space inside a reason is a no-break space.
    assert.match(scoped.innerHTML, /<span>2\u00a0道题，不足\u00a03\u00a0道<\/span><span> · <\/span><span>单题占\u00a070%，超过\u00a050%<\/span><span> · <\/span><span>有效投票者\u00a08\u00a0人，不足\u00a010\u00a0人<\/span>/);
    category.destroy();
  } finally { Object.assign(globalThis, original); }
});
