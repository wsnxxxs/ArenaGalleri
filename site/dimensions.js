// Guided trial dimension chart (#/dimensions): staff only, and only in GUIDED_VOTING builds. From the aspect
// questions staff answered in guided blind voting, the server fits each dimension on its own with the same
// Bradley–Terry scale as the main board, starting from the entry's modelling category score (its prior).
// Three views: a radar per entry, a board for one dimension, and a health check of each aspect question.
// Trial ballots stay off every board.
import { setPageTitle } from './i18n.js';
import { $, $$, brandMark, esc, formatDate, pad, store, vendorLine } from './ui.js';
import { api, isStaff, platform } from './platform.js';

// Every radar on the page shares one scale, so cards compare at a glance: 900–1500 unless something drawn
// (a score with its interval, or a prior) falls outside, and then widened to the next hundred. 1000 is the
// average of the main board.
export const SCALE = { min: 900, max: 1500 };
// Below this many answers a dimension is thin: drawn hollow with a dashed interval. The server says so too.
export const THIN_ANSWERS = 10;
// The health check judges a question only after this many answers in the trial.
export const HEALTH_ANSWERS = 20;
const UNITS = { model: '按模型', config: '按配置' };
const CATEGORIES = { all: '全部', 建模: '三维', 静态网页: '设计' };
const VIEWS = { radar: '雷达', board: '维度榜', health: '测评点体检' };
const ORDERS = { all: '全部', after: '先综合', before: '先测评点' };
// The three problems the health check marks, keyed by the server's flag, and the rate each one reads.
export const FLAGS = {
  'same-side': { rate: 'sameSideRate', text: '与综合同边超过 90%：问了等于没问' },
  ties: { rate: 'tieRate', text: '平局超过 50%：分不出' },
  skips: { rate: 'skipRate', text: '跳过超过 30%：看不出' },
};
const RADAR = { width: 332, height: 252, cx: 158, cy: 126, radius: 80, gap: 11 };

export const rateOf = (cell) => (cell?.n ? (cell.win + cell.tie / 2) / cell.n : null);
const percent = (rate) => (rate == null ? '—' : `${Math.round(rate * 100)}%`);
const fixed = (value) => value.toFixed(1);

// Only dimensions with aspect questions are drawn: a dimension kept for later categories has nothing to show.
export const chartedDimensions = (dimensions) => dimensions.filter((dimension) => dimension.aspects?.length);

// Where a score sits between the centre (900) and the outer ring (1500), clamped to the chart.
export const scaleOf = (score, scale = SCALE) => Math.min(1, Math.max(0, (score - scale.min) / (scale.max - scale.min)));

// The page's scale for these entries, and its labelled rings: 1000 and every 200 from it inside the scale,
// every 400 once the scale has widened past 900 points, so the rings stay apart.
export function scaleFor(entries, dimensions) {
  const values = entries.flatMap((entry) => [entry.prior, ...axesOf(entry, dimensions).flatMap((axis) => [axis.score - axis.interval, axis.score + axis.interval])])
    .filter(Number.isFinite);
  const min = Math.min(SCALE.min, Math.floor(Math.min(...values) / 100) * 100);
  const max = Math.max(SCALE.max, Math.ceil(Math.max(...values) / 100) * 100);
  const step = max - min > 900 ? 400 : 200;
  const ticks = [];
  for (let tick = 1000 - Math.floor((999 - min) / step) * step; tick < max; tick += step) ticks.push(tick);
  return { min, max, step, ticks };
}

// Which rings carry their value. Labels run along one line from the centre; on a widened scale the rings are
// close, so only every k-th ring from 1000 is labelled, keeping at least `gap` px (vertically) between labels.
export function tickLabels(scale, n, radius = RADAR.radius, gap = 12) {
  const ring = (radius * scale.step) / (scale.max - scale.min);
  const rise = Math.max(0.5, Math.abs(Math.sin(angleOf(0.5, n))));
  const every = Math.max(1, Math.ceil(gap / (ring * rise)));
  return scale.ticks.filter((tick) => Math.abs(Math.round((tick - 1000) / scale.step)) % every === 0);
}

// Axis i of n starts at 12 o'clock and runs clockwise; value 1 lands on the outer ring.
const angleOf = (i, n) => -Math.PI / 2 + (2 * Math.PI * i) / n;
export function radarPoint(i, n, value, radius = RADAR.radius, cx = RADAR.cx, cy = RADAR.cy) {
  const angle = angleOf(i, n);
  return [cx + Math.cos(angle) * radius * value, cy + Math.sin(angle) * radius * value];
}

// What the radar draws per dimension. An unanswered dimension rests on the prior (1000 without one), thin.
export function axesOf(entry, dimensions, scale = SCALE) {
  const rest = entry.prior ?? 1000;
  return dimensions.map((dimension) => {
    const cell = entry.dimensions?.[dimension.id] ?? { n: 0, win: 0, tie: 0, loss: 0, aspects: {} };
    const score = cell.score ?? rest;
    const interval = cell.interval ?? 0;
    const thin = cell.thin ?? cell.n < THIN_ANSWERS;
    return { dimension, cell, score, interval, thin, value: scaleOf(score, scale), low: scaleOf(score - interval, scale), high: scaleOf(score + interval, scale) };
  });
}

// A board row joined to its entry for names; rows whose entry is gone are dropped.
export function boardRows(data, dimensionId) {
  const entries = new Map(data.entries.map((entry) => [entry.key, entry]));
  return (data.boards?.[dimensionId] ?? []).filter((row) => entries.has(row.key)).map((row) => ({ ...row, entry: entries.get(row.key) }));
}

// The health metrics for one order of questions, or for both together.
export const healthOf = (row, order) => (order === 'all' ? row : row.byOrder?.[order] ?? null);

const axisText = (axis) => `${axis.dimension.name} ${axis.score} ±${axis.interval}，${axis.cell.n} 票${axis.thin ? `，不足 ${THIN_ANSWERS} 票` : ''}`;

function radar(entry, dimensions, name, scale) {
  const { width, height, cx, cy, radius, gap } = RADAR;
  const axes = axesOf(entry, dimensions, scale);
  const n = axes.length;
  const at = (i, value) => radarPoint(i, n, value, radius, cx, cy);
  const ring = (value, cls) => `<circle class="${cls}" cx="${cx}" cy="${cy}" r="${fixed(radius * value)}"/>`;
  const rings = [...scale.ticks.map((tick) => ring(scaleOf(tick, scale), `radar-ring${tick === 1000 ? ' is-mid' : ''}`)), ring(1, 'radar-ring')].join('');
  // Tick values run along the bisector of the first two axes, clear of the labels.
  const ticks = tickLabels(scale, n, radius).map((tick) => {
    const angle = angleOf(0.5, n);
    const r = radius * scaleOf(tick, scale);
    return `<text class="radar-tick" x="${fixed(cx + Math.cos(angle) * r + 3)}" y="${fixed(cy + Math.sin(angle) * r - 3)}">${tick}</text>`;
  }).join('');
  const spokes = axes.map((_, i) => {
    const [x, y] = at(i, 1);
    return `<line class="radar-spoke" x1="${cx}" y1="${cy}" x2="${fixed(x)}" y2="${fixed(y)}"/>`;
  }).join('');
  const prior = entry.prior == null ? '' : ring(scaleOf(entry.prior, scale), 'radar-prior');
  // Each axis carries its 95% interval as a whisker with short caps across the spoke.
  const whiskers = axes.map((axis, i) => {
    const angle = angleOf(i, n);
    const [x1, y1] = at(i, axis.low), [x2, y2] = at(i, axis.high);
    const dx = -Math.sin(angle) * 4, dy = Math.cos(angle) * 4;
    const cap = (x, y) => `M${fixed(x - dx)},${fixed(y - dy)}L${fixed(x + dx)},${fixed(y + dy)}`;
    return `<path class="radar-whisker${axis.thin ? ' is-thin' : ''}" d="M${fixed(x1)},${fixed(y1)}L${fixed(x2)},${fixed(y2)}${cap(x1, y1)}${cap(x2, y2)}"/>`;
  }).join('');
  const shape = axes.map((axis, i) => at(i, axis.value).map(fixed).join(',')).join(' ');
  const labels = axes.map((axis, i) => {
    const angle = angleOf(i, n);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const x = cx + cos * (radius + gap), y = cy + sin * (radius + gap);
    const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
    const baseline = sin < -0.3 ? y - 16 : sin > 0.3 ? y + 10 : y - 2;
    const thin = axis.thin ? ' is-thin' : '';
    return `<text class="radar-label${thin}" x="${fixed(x)}" y="${fixed(baseline)}" text-anchor="${anchor}">${esc(axis.dimension.name)}</text>`
      + `<text class="radar-value${thin}" x="${fixed(x)}" y="${fixed(baseline + 14)}" text-anchor="${anchor}">${esc(axis.score)}</text>`;
  }).join('');
  const marks = (draw) => axes.map((axis, i) => draw(axis, i, ...at(i, axis.value).map(fixed))).join('');
  return `<svg class="radar" viewBox="0 0 ${width} ${height}" role="group" aria-label="${esc(`${name} 各维度分`)}">
    ${rings}${spokes}${ticks}${prior}<polygon class="radar-area${axes.every((axis) => axis.thin) ? ' is-thin' : ''}" points="${shape}"/>${whiskers}
    ${marks((axis, i, x, y) => `<circle class="radar-dot${axis.thin ? ' is-thin' : ''}" cx="${x}" cy="${y}" r="4"/>`)}${labels}
    ${marks((axis, i, x, y) => `<circle class="radar-hit" cx="${x}" cy="${y}" r="14" tabindex="0" data-axis="${i}" aria-label="${esc(axisText(axis))}"/>`)}
  </svg>`;
}

// Names, values and counts sit in separate text nodes so each translates as a whole phrase.
function tipHtml(axis, entry) {
  const { cell, dimension } = axis;
  const lines = [`<span>${cell.n ? esc(`${cell.n} 票 · 胜 ${cell.win} · 平 ${cell.tie} · 负 ${cell.loss}`) : '还没有作答'}</span>`];
  if (axis.thin && cell.n) lines.push(`<span>不足 ${THIN_ANSWERS} 票，贴近分类分</span>`);
  lines.push(`<span>${entry.prior == null ? '没有基准分，从 1000 起' : `基准分 ${esc(entry.prior)}`}</span>`);
  for (const aspect of dimension.aspects) {
    const part = cell.aspects?.[aspect.id];
    lines.push(`<span><span>${esc(aspect.keyword)}</span> · <span>${part?.n ? `胜率 ${percent(rateOf(part))} · ${esc(part.n)} 票` : '未作答'}</span></span>`);
  }
  return `<b><span>${esc(dimension.name)}</span> · <span>${esc(`${axis.score} ±${axis.interval}`)}</span></b>${lines.join('')}`;
}

const modelLine = (entry, unit, m, extra = '') => `<span class="board-model">${brandMark(m, 'brand-mark sm')}<span class="board-name"><b data-i18n-ignore>${esc(entry.modelName)}</b>${unit === 'config' && entry.effort ? `<span class="badge" data-i18n-ignore>${esc(entry.effort)}</span>` : ''}${extra}</span></span>`;
const priorText = (entry) => (entry.prior == null ? '<span>没有分类分</span>' : `<span>分类分 ${esc(entry.prior)}</span>`);

function card(entry, dimensions, unit, m, scale) {
  const name = `${entry.modelName}${unit === 'config' && entry.effort ? ` · ${entry.effort}` : ''}`;
  return `<article class="dims-card" data-entry="${esc(entry.key)}">
    ${modelLine(entry, unit, m, `<small>${vendorLine(m)} · ${priorText(entry)} · <span>${esc(entry.overall?.n ?? 0)} 组</span></small>`)}
    ${radar(entry, dimensions, name, scale)}
    <div class="dims-tip" role="tooltip" hidden></div>
  </article>`;
}

function detail(entries, dimensions, unit, modelOf) {
  const cell = (entry, dimension) => {
    const value = entry.dimensions?.[dimension.id];
    if (!value?.n) return '<td class="dims-cell is-empty">—</td>';
    const thin = value.thin ?? value.n < THIN_ANSWERS;
    return `<td class="dims-cell${thin ? ' is-thin' : ''}"${thin ? ` title="不足 ${THIN_ANSWERS} 票"` : ''}><b>${esc(value.score)}</b><small><span>±${esc(value.interval)}</span> · <span>${esc(value.n)} 票</span></small></td>`;
  };
  return `<div class="board-wrap"><table class="board dims-table">
    <thead><tr><th class="c-model" scope="col">${unit === 'model' ? '模型' : '模型 · 档位'}</th><th scope="col">分类分</th>${dimensions.map((dimension) => `<th scope="col">${esc(dimension.name)}</th>`).join('')}<th scope="col">测试组</th></tr></thead>
    <tbody>${entries.map((entry) => `<tr><td class="c-model">${modelLine(entry, unit, modelOf(entry))}</td><td class="dims-prior">${esc(entry.prior ?? '—')}</td>${dimensions.map((dimension) => cell(entry, dimension)).join('')}<td>${esc(entry.overall?.n ?? 0)}</td></tr>`).join('')}</tbody>
  </table></div>`;
}

// Same grey-to-ink ramp as the main board's interval bars.
const tone = (at) => `color-mix(in srgb, var(--ink) ${Math.round(at)}%, var(--line-2))`;

// One dimension ranked by its score, in the main board's table.
function board(rows, unit, modelOf, dimension) {
  if (!rows.length) return `<div class="board-empty"><p class="board-empty-title">这个维度还没有作答</p><p>管理员在引导式盲评里答过「${esc(dimension.name)}」的测评点后，这里按维度分排名。</p></div>`;
  const low = Math.min(1000, ...rows.map((row) => row.score - row.interval));
  const high = Math.max(1000, ...rows.map((row) => row.score + row.interval));
  const at = (value) => (((value - low) / Math.max(high - low, 1)) * 100).toFixed(2);
  const body = rows.map((row) => {
    const m = modelOf(row.entry);
    const from = at(row.score - row.interval), to = at(row.score + row.interval);
    const span = row.rankLow != null && row.rankHigh != null && row.rankLow !== row.rankHigh ? `<small class="rank-range">${esc(row.rankLow)}–${esc(row.rankHigh)}</small>` : '';
    return `<tr${row.thin ? ' class="is-provisional"' : ''}>
      <td class="c-rank${row.rank <= 3 ? ' is-top' : ''}">${esc(pad(row.rank))}${span}</td>
      <td class="c-model">${modelLine(row.entry, unit, m, `${row.thin ? `<span class="badge provisional" title="不足 ${THIN_ANSWERS} 票">单薄</span>` : ''}<small>${vendorLine(m)} · ${priorText(row.entry)}</small>`)}</td>
      <td class="c-score"><b>${esc(row.score)}</b><small>±${esc(row.interval)}</small></td>
      <td class="c-range" aria-hidden="true"><span class="range"><s style="left:${at(1000)}%"></s><i style="left:${from}%;width:${(to - from).toFixed(2)}%;background:linear-gradient(90deg, ${tone(from)}, ${tone(to)})"></i><em style="left:${at(row.score)}%"></em></span></td>
      <td class="c-games">${esc(row.n)}</td>
    </tr>`;
  }).join('');
  return `<div class="board-wrap"><table class="board dims-board">
    <thead><tr><th class="c-rank" scope="col">名次</th><th class="c-model" scope="col">${unit === 'model' ? '模型' : '模型 · 档位'}</th><th class="c-score" scope="col">维度分</th><th class="c-range" scope="col"><span class="sr">区间</span></th><th class="c-games" scope="col">作答</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

// One aspect question per row; a marked rate is one of the three problems, judged from 20 answers.
function health(rows, dimensions, order) {
  const names = new Map(dimensions.map((dimension) => [dimension.id, dimension.name]));
  const rate = (metrics, key, base) => {
    const flag = Object.entries(FLAGS).find(([id, f]) => f.rate === key && metrics.flags?.includes(id));
    const denominator = base == null ? '' : `<small>${esc(base)}</small>`;
    return flag ? `<td class="dims-rate is-flag" title="${flag[1].text}"><b>${percent(metrics[key])}</b><i aria-hidden="true">▲</i><span class="sr">${flag[1].text}</span>${denominator}</td>`
      : `<td class="dims-rate">${percent(metrics[key])}${denominator}</td>`;
  };
  const body = rows.map((row) => {
    const metrics = healthOf(row, order);
    if (!metrics) return '';
    const eligible = metrics.eligible ?? metrics.n >= HEALTH_ANSWERS;
    return `<tr${eligible ? '' : ' class="is-early"'}>
      <th class="c-aspect" scope="row">${esc(row.keyword)}</th>
      <td class="c-dimension">${esc(names.get(row.dimension) ?? row.dimension)}</td>
      <td class="dims-rate"><b>${esc(metrics.n)}</b>${eligible ? '' : `<small title="满 ${HEALTH_ANSWERS} 票才判断">未满 ${HEALTH_ANSWERS}</small>`}</td>
      ${rate(metrics, 'skipRate')}${rate(metrics, 'tieRate')}${rate(metrics, 'sameSideRate', metrics.sameSideN)}${rate(metrics, 'agreementRate', metrics.agreementN)}
    </tr>`;
  }).join('');
  return `<div class="board-wrap"><table class="board dims-health">
    <thead><tr><th class="c-aspect" scope="col">测评点</th><th class="c-dimension" scope="col">维度</th><th scope="col">作答</th><th scope="col">跳过</th><th scope="col">平局</th><th scope="col">与综合同边</th><th scope="col">两人一致</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

export function mount(root, ctx) {
  setPageTitle(['维度图', '盲评']);
  let unit = store.get('dimensions-unit') === 'config' ? 'config' : 'model';
  let category = CATEGORIES[store.get('dimensions-category')] ? store.get('dimensions-category') : 'all';
  let view = VIEWS[store.get('dimensions-view')] ? store.get('dimensions-view') : 'radar';
  let picked = store.get('dimensions-board') ?? '';
  let order = 'all';
  let data = null, failure = null, request = 0, destroyed = false, active = null;
  const modelOf = (entry) => ctx.modelOf({ model: entry.model, modelName: entry.modelName, vendor: entry.vendor });
  const stat = (label, value) => `<div><dt>${label}</dt><dd>${esc(pad(value))}</dd></div>`;
  const seg = (label, attr, options, current) => `<div class="seg" role="group" aria-label="${label}">${Object.entries(options).map(([value, text]) =>
    `<button type="button" ${attr}="${esc(value)}" aria-pressed="${value === current}">${esc(text)}</button>`).join('')}</div>`;

  function page(body, meta = '') {
    root.innerHTML = `${ctx.pageStart({ title: '维度图', section: 'arena', heading: '各维度分',
      crumbs: [{ text: '盲评', href: '#/arena' }, { text: '维度图' }],
      description: '测试版：由管理员在引导式盲评里答的测评点计算，不进任何榜单。每个维度和主榜一样按 Bradley–Terry 单独拟合，从这个条目自己的对应分类分（全部时取总榜分）起步：作答少时贴着基准分，作答多了才离开，离开的方向就是长板或短板。',
      meta, nav: ctx.sideNav('维度图', [['#/arena', 'blind', '盲评大厅', false], ['#/dimensions', 'rank', '维度图', true]]) })}
      <section class="block wrap dims">${body}</section>
    ${ctx.pageEnd()}`;
  }

  function gate() {
    data = null;
    page(`<div class="board-empty">
      <p class="board-empty-title">维度图只对管理员开放</p>
      <p>${platform.user ? '当前账号不是管理员。换一个管理员账号登录后再看。' : '用管理员账号登录后即可查看。'}</p>
      <div class="board-empty-actions">${platform.user ? '' : '<button class="btn primary" type="button" data-auth="login">登录</button>'}<a class="btn" href="#/arena">返回盲评大厅</a></div>
    </div>`);
  }

  function radarView(entries, dimensions, noun) {
    const charted = entries.filter((entry) => dimensions.some((dimension) => entry.dimensions?.[dimension.id]?.n));
    const scale = scaleFor(charted, dimensions);
    return `<p class="dims-key"><span>刻度 ${scale.min}–${scale.max}，所有卡片相同</span><span><i class="dims-swatch is-prior"></i>虚线圈：这个条目的基准分（分类分或总榜分），伸出去的是长板</span><span><i class="dims-swatch is-whisker"></i>须线：95% 区间</span><span><i class="dims-swatch is-thin"></i>空心点、虚线：不足 ${THIN_ANSWERS} 票</span></p>
      ${charted.length ? `<div class="dims-grid">${charted.map((entry) => card(entry, dimensions, unit, modelOf(entry), scale)).join('')}</div>`
        : `<p class="muted">还没有${noun}答过测评点。</p>`}
      <h3 class="dims-heading">明细</h3>
      ${detail(entries, dimensions, unit, modelOf)}`;
  }

  function boardView(dimensions) {
    const dimension = dimensions.find((item) => item.id === picked) ?? dimensions[0];
    if (!dimension) return '<p class="muted">还没有带测评点的维度。</p>';
    const rows = boardRows(data, dimension.id);
    return `<div class="dims-bar">${seg('维度', 'data-dims-board', Object.fromEntries(dimensions.map((item) => [item.id, item.name])), dimension.id)}
      <p class="board-meta"><span>${rows.length} 个${unit === 'model' ? '模型' : '配置'}答过</span> · ${dimension.aspects.map((aspect) => `<span>${esc(aspect.keyword)}</span>`).join(' · ')}</p></div>
      ${board(rows, unit, modelOf, dimension)}
      <p class="dims-foot"><span>维度分只用这个维度的测评点作答拟合，起点是对应分类分（全部时取总榜分），没有的从 1000 起。</span><span>不足 ${THIN_ANSWERS} 票标为单薄，分数主要还是分类分。</span></p>`;
  }

  function healthView(dimensions) {
    const rows = data.health ?? [];
    if (!rows.length) return '<div class="board-empty"><p class="board-empty-title">还没有测评点作答</p><p>管理员在引导式盲评里答过测评点后，这里逐题列出作答、跳过和一致程度。</p></div>';
    const split = rows.some((row) => row.byOrder);
    if (!split) order = 'all';
    return `${split ? `<div class="dims-bar">${seg('提问顺序', 'data-dims-order', ORDERS, order)}<p class="board-meta">两种提问顺序的票分开算，「全部」是合在一起。</p></div>` : ''}
      ${health(rows, dimensions, order)}
      <p class="dims-key dims-flags">${Object.values(FLAGS).map((flag) => `<span><i aria-hidden="true">▲</i>${flag.text}</span>`).join('')}<span>满 ${HEALTH_ANSWERS} 票才判断</span></p>
      <p class="dims-foot"><span>跳过按带这道测评点的组数算，平局按作答算。</span><span>与综合同边只看两题都分出胜负的组。</span><span>两人一致看不同管理员对同一对作品的作答，左右互换后比较。</span><span>小字是各自的样本数。</span></p>`;
  }

  function render() {
    if (!data) return page(`<div class="board-empty"><p class="board-empty-title">维度图没有载入</p><p>${esc(failure?.message ?? '')}</p>
      <div class="board-empty-actions"><button class="btn" type="button" data-dims-retry>重试</button></div></div>`);
    const { totals, entries } = data;
    const dimensions = chartedDimensions(data.dimensions);
    const noun = unit === 'model' ? '模型' : '配置';
    const meta = `<dl class="side-stats">${stat('测试对局', totals.pairs)}${stat('测评点作答', totals.answered)}${stat('参与管理员', totals.voters)}</dl>`;
    const toolbar = `<div class="dims-toolbar"><div class="dims-tabs" role="tablist" aria-label="视图">${Object.entries(VIEWS).map(([value, text]) =>
      `<button type="button" role="tab" id="dims-tab-${value}" aria-controls="dims-panel" aria-selected="${value === view}" tabindex="${value === view ? 0 : -1}" data-dims-view="${value}">${text}</button>`).join('')}</div>
      <div class="dims-controls">${seg('题目类型', 'data-dims-cat', CATEGORIES, category)}${view === 'health' ? '' : seg('统计单位', 'data-dims-unit', UNITS, unit)}</div></div>`;
    if (!entries.length && view !== 'health') return page(`${toolbar}<div class="board-empty"><p class="board-empty-title">还没有测试票</p>
      <p>用管理员账号在引导式盲评里评几组，这里会按${noun}画出各维度分。</p>
      <div class="board-empty-actions"><a class="btn primary" href="#/arena/random">随机一组</a></div></div>`, meta);
    const body = view === 'board' ? boardView(dimensions) : view === 'health' ? healthView(dimensions) : radarView(entries, dimensions, noun);
    page(`${toolbar}<div class="dims-panel" id="dims-panel" role="tabpanel" aria-labelledby="dims-tab-${view}">${body}
      <p class="dims-foot"><span>只统计带测评点的测试对局。</span><span>两边是同一${noun}的一对不计。</span>${totals.since ? `<span>数据从 ${formatDate(totals.since)} 到 ${formatDate(totals.until)}。</span>` : ''}<span><span>有测评点的题目类型：</span>${data.categories.map((category) => `<span>${esc(category)}</span>`).join(' · ')}</span></p></div>`, meta);
  }

  // Every load, including one that ends at the gate, makes earlier reads stale; a read that lands is shown
  // only to someone who is still staff.
  async function load() {
    const id = ++request;
    if (!isStaff()) return gate();
    $('.dims', root)?.classList.add('is-loading');
    if (!data) page('<p class="muted">正在载入维度图…</p>');
    try {
      const next = await api(`arena/guided/dimensions?by=${unit}${category === 'all' ? '' : `&category=${encodeURIComponent(category)}`}`);
      if (destroyed || id !== request) return;
      if (!isStaff()) return gate();
      data = next;
    } catch (error) {
      if (destroyed || id !== request) return;
      if (error.code === 'guided-staff-only' || [401, 403].includes(error.status)) return gate();
      data = null;
      failure = error;
    }
    render();
  }

  function hideTip() {
    if (!active) return;
    const { tip, dot } = active;
    tip.hidden = true;
    dot?.classList.remove('is-active');
    active = null;
  }

  function showTip(hit) {
    const frame = hit.closest('.dims-card');
    const entry = data?.entries.find((item) => item.key === frame?.dataset.entry);
    if (!entry) return;
    hideTip();
    const index = Number(hit.dataset.axis);
    const tip = $('.dims-tip', frame), dot = $$('.radar-dot', frame)[index];
    tip.innerHTML = tipHtml(axesOf(entry, chartedDimensions(data.dimensions))[index], entry);
    tip.hidden = false;
    dot?.classList.add('is-active');
    active = { tip, dot };
    const box = hit.getBoundingClientRect(), outer = frame.getBoundingClientRect();
    const half = tip.offsetWidth / 2;
    const left = Math.min(Math.max(box.left + box.width / 2 - outer.left, half + 8), outer.width - half - 8);
    const below = box.top - outer.top < tip.offsetHeight + 12;
    tip.classList.toggle('is-below', below);
    tip.style.left = `${left}px`;
    tip.style.top = `${below ? box.bottom - outer.top : box.top - outer.top}px`;
  }

  function setView(next, focus) {
    if (next === view) return;
    view = next;
    store.set('dimensions-view', view);
    hideTip();
    render();
    if (focus) $(`[data-dims-view="${view}"]`, root)?.focus();
  }

  const onClick = (event) => {
    const unitButton = event.target.closest('[data-dims-unit]');
    if (unitButton && unitButton.dataset.dimsUnit !== unit) {
      unit = unitButton.dataset.dimsUnit;
      store.set('dimensions-unit', unit);
      void load();
    }
    const catButton = event.target.closest('[data-dims-cat]');
    if (catButton && catButton.dataset.dimsCat !== category) {
      category = catButton.dataset.dimsCat;
      store.set('dimensions-category', category);
      void load();
    }
    const tab = event.target.closest('[data-dims-view]');
    if (tab) setView(tab.dataset.dimsView);
    const dimension = event.target.closest('[data-dims-board]');
    if (dimension && dimension.dataset.dimsBoard !== picked) {
      picked = dimension.dataset.dimsBoard;
      store.set('dimensions-board', picked);
      render();
    }
    const orderButton = event.target.closest('[data-dims-order]');
    if (orderButton && orderButton.dataset.dimsOrder !== order) {
      order = orderButton.dataset.dimsOrder;
      render();
    }
    if (event.target.closest('[data-dims-retry]')) void load();
  };
  // Arrow keys move between the tabs, as in any tab list.
  const onKey = (event) => {
    const tab = event.target.closest?.('[data-dims-view]');
    if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const keys = Object.keys(VIEWS), i = keys.indexOf(tab.dataset.dimsView);
    const to = event.key === 'Home' ? 0 : event.key === 'End' ? keys.length - 1 : (i + (event.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length;
    event.preventDefault();
    setView(keys[to], true);
  };
  const onOver = (event) => { const hit = event.target.closest?.('.radar-hit'); if (hit) showTip(hit); };
  const onOut = (event) => { if (event.target.closest?.('.radar-hit')) hideTip(); };
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  root.addEventListener('pointerover', onOver);
  root.addEventListener('pointerout', onOut);
  root.addEventListener('focusin', onOver);
  root.addEventListener('focusout', onOut);
  void load();

  return {
    onPlatformChange(reason) {
      if (reason === 'identity') { data = null; void load(); }
    },
    destroy() {
      destroyed = true;
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKey);
      root.removeEventListener('pointerover', onOver);
      root.removeEventListener('pointerout', onOut);
      root.removeEventListener('focusin', onOver);
      root.removeEventListener('focusout', onOut);
    },
  };
}
