// Guided trial dimension chart (#/dimensions): staff only, and only in GUIDED_VOTING builds. One radar
// per model from the aspect questions staff answered in guided blind voting. Each axis is the model's
// aspect win rate on that dimension (ties count half), so 50% is even. Trial ballots stay off every board.
import { setPageTitle } from './i18n.js';
import { $, $$, brandMark, esc, formatDate, pad, store, vendorLine } from './ui.js';
import { api, isStaff, platform } from './platform.js';

// Below this many answers an axis is not drawn at its rate: its point rests on 50%, hollow.
export const MIN_ANSWERS = 5;
const UNITS = { model: '按模型', config: '按配置' };
const EMPTY = { win: 0, tie: 0, loss: 0, n: 0, aspects: {} };
const RADAR = { width: 300, height: 224, cx: 150, cy: 112, radius: 70, gap: 12 };

export const rateOf = (cell) => (cell?.n ? (cell.win + cell.tie / 2) / cell.n : null);
const percent = (rate) => `${Math.round(rate * 100)}%`;
const fixed = (value) => value.toFixed(1);

// Axis i of n starts at 12 o'clock and runs clockwise; value 1 lands on the outer ring.
export function radarPoint(i, n, value, radius = RADAR.radius, cx = RADAR.cx, cy = RADAR.cy) {
  const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
  return [cx + Math.cos(angle) * radius * value, cy + Math.sin(angle) * radius * value];
}

// What the radar draws per dimension: the rate once an axis has enough answers, otherwise 50%, flagged thin.
export function axesOf(entry, dimensions, min = MIN_ANSWERS) {
  return dimensions.map((dimension) => {
    const cell = entry.dimensions?.[dimension.id] ?? EMPTY;
    const rate = rateOf(cell);
    const thin = cell.n < min;
    return { dimension, cell, rate, thin, value: thin ? 0.5 : rate };
  });
}

const axisText = (axis) => axis.thin
  ? `${axis.dimension.name}：${axis.cell.n} 票，不足 ${MIN_ANSWERS} 票`
  : `${axis.dimension.name} ${percent(axis.rate)}，${axis.cell.n} 票：胜 ${axis.cell.win}，平 ${axis.cell.tie}，负 ${axis.cell.loss}`;

function radar(entry, dimensions, name) {
  const { width, height, cx, cy, radius, gap } = RADAR;
  const axes = axesOf(entry, dimensions);
  const at = (i, value) => radarPoint(i, axes.length, value, radius, cx, cy);
  const rings = [0.25, 0.5, 0.75, 1].map((value) => `<circle class="radar-ring${value === 0.5 ? ' is-even' : ''}" cx="${cx}" cy="${cy}" r="${fixed(radius * value)}"/>`).join('');
  const spokes = axes.map((_, i) => {
    const [x, y] = at(i, 1);
    return `<line class="radar-spoke" x1="${cx}" y1="${cy}" x2="${fixed(x)}" y2="${fixed(y)}"/>`;
  }).join('');
  const shape = axes.map((axis, i) => at(i, axis.value).map(fixed).join(',')).join(' ');
  const labels = axes.map((axis, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / axes.length;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const x = cx + cos * (radius + gap), y = cy + sin * (radius + gap);
    const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
    const baseline = sin < -0.3 ? y - 16 : sin > 0.3 ? y + 10 : y - 2;
    const thin = axis.thin ? ' is-thin' : '';
    return `<text class="radar-label${thin}" x="${fixed(x)}" y="${fixed(baseline)}" text-anchor="${anchor}">${esc(axis.dimension.name)}</text>`
      + `<text class="radar-value${thin}" x="${fixed(x)}" y="${fixed(baseline + 14)}" text-anchor="${anchor}">${axis.thin ? `${axis.cell.n} 票` : percent(axis.rate)}</text>`;
  }).join('');
  const marks = (draw) => axes.map((axis, i) => draw(axis, i, ...at(i, axis.value).map(fixed))).join('');
  return `<svg class="radar" viewBox="0 0 ${width} ${height}" role="group" aria-label="${esc(`${name} 各维度胜率`)}">
    ${rings}${spokes}<polygon class="radar-area${axes.every((axis) => axis.thin) ? ' is-thin' : ''}" points="${shape}"/>
    ${marks((axis, i, x, y) => `<circle class="radar-dot${axis.thin ? ' is-thin' : ''}" cx="${x}" cy="${y}" r="4"/>`)}${labels}
    ${marks((axis, i, x, y) => `<circle class="radar-hit" cx="${x}" cy="${y}" r="14" tabindex="0" data-axis="${i}" aria-label="${esc(axisText(axis))}"/>`)}
  </svg>`;
}

// Names, values and counts sit in separate text nodes so each translates as a whole phrase.
function tipHtml(axis) {
  const { cell, dimension } = axis;
  const value = !cell.n ? '<span>还没有作答</span>' : axis.thin ? `<span>${cell.n} 票，不足 ${MIN_ANSWERS} 票</span>` : percent(axis.rate);
  const lines = cell.n ? [`<span>胜 ${cell.win} · 平 ${cell.tie} · 负 ${cell.loss}</span>`] : [];
  for (const aspect of dimension.aspects) {
    const part = cell.aspects?.[aspect.id];
    lines.push(`<span><span>${esc(aspect.keyword)}</span> · <span>${part?.n ? `${percent(rateOf(part))} · ${part.n} 票` : '未作答'}</span></span>`);
  }
  return `<b><span>${esc(dimension.name)}</span> · ${value}</b>${lines.join('')}`;
}

const modelLine = (entry, unit, m, extra = '') => `<span class="board-model">${brandMark(m, 'brand-mark sm')}<span class="board-name"><b data-i18n-ignore>${esc(entry.modelName)}</b>${unit === 'config' && entry.effort ? `<span class="badge" data-i18n-ignore>${esc(entry.effort)}</span>` : ''}${extra}</span></span>`;

function card(entry, dimensions, unit, m) {
  const overall = rateOf(entry.overall);
  const name = `${entry.modelName}${unit === 'config' && entry.effort ? ` · ${entry.effort}` : ''}`;
  return `<article class="dims-card" data-entry="${esc(entry.key)}">
    ${modelLine(entry, unit, m, `<small>${vendorLine(m)} · <span>综合 ${overall == null ? '—' : percent(overall)} · ${entry.overall.n} 票</span></small>`)}
    ${radar(entry, dimensions, name)}
    <div class="dims-tip" role="tooltip" hidden></div>
  </article>`;
}

function table(entries, dimensions, unit, modelOf) {
  const cell = (value) => (!value?.n ? '<td class="dims-cell is-empty">—</td>'
    : `<td class="dims-cell${value.n < MIN_ANSWERS ? ' is-thin' : ''}"${value.n < MIN_ANSWERS ? ` title="不足 ${MIN_ANSWERS} 票"` : ''}><b>${percent(rateOf(value))}</b><small>${value.n} 票</small></td>`);
  return `<div class="board-wrap"><table class="board dims-table">
    <thead><tr><th class="c-model" scope="col">${unit === 'model' ? '模型' : '模型 · 档位'}</th>${dimensions.map((dimension) => `<th scope="col">${esc(dimension.name)}</th>`).join('')}<th scope="col">综合</th></tr></thead>
    <tbody>${entries.map((entry) => `<tr><td class="c-model">${modelLine(entry, unit, modelOf(entry))}</td>${dimensions.map((dimension) => cell(entry.dimensions?.[dimension.id])).join('')}${cell(entry.overall)}</tr>`).join('')}</tbody>
  </table></div>`;
}

export function mount(root, ctx) {
  setPageTitle(['维度图', '盲评']);
  let unit = store.get('dimensions-unit') === 'config' ? 'config' : 'model';
  let data = null, failure = null, request = 0, destroyed = false, active = null;
  const modelOf = (entry) => ctx.modelOf({ model: entry.model, modelName: entry.modelName, vendor: entry.vendor });
  const stat = (label, value) => `<div><dt>${label}</dt><dd>${pad(value)}</dd></div>`;

  function page(body, meta = '') {
    root.innerHTML = `${ctx.pageStart({ title: '维度图', section: 'arena', heading: '各维度胜率',
      crumbs: [{ text: '盲评', href: '#/arena' }, { text: '维度图' }],
      description: '测试版：由管理员在引导式盲评里答的单项题计算，不进任何榜单。每条轴是模型在这个维度上的单项胜率，平局算半场，50% 为持平。',
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

  function render() {
    if (!data) return page(`<div class="board-empty"><p class="board-empty-title">维度图没有载入</p><p>${esc(failure?.message ?? '')}</p>
      <div class="board-empty-actions"><button class="btn" type="button" data-dims-retry>重试</button></div></div>`);
    const { dimensions, totals, entries } = data;
    const noun = unit === 'model' ? '模型' : '配置';
    const meta = `<dl class="side-stats">${stat('测试对局', totals.pairs)}${stat('单项作答', totals.answered)}${stat('参与管理员', totals.voters)}</dl>`;
    const toolbar = `<div class="dims-toolbar"><div class="seg" role="group" aria-label="统计单位">${Object.entries(UNITS).map(([value, text]) =>
      `<button type="button" data-dims-unit="${value}" aria-pressed="${value === unit}">${text}</button>`).join('')}</div>
      <p class="dims-key"><span><i class="dims-swatch"></i>作答满 ${MIN_ANSWERS} 票的维度按胜率画</span><span><i class="dims-swatch is-thin"></i>不足 ${MIN_ANSWERS} 票的暂按 50% 画</span><span>加粗的圆圈是 50% 持平线</span></p></div>`;
    if (!entries.length) return page(`${toolbar}<div class="board-empty"><p class="board-empty-title">还没有测试票</p>
      <p>用管理员账号在引导式盲评里评几组，这里会按${noun}画出各维度的胜率。</p>
      <div class="board-empty-actions"><a class="btn primary" href="#/arena/random">随机一组</a></div></div>`, meta);
    const charted = entries.filter((entry) => dimensions.some((dimension) => entry.dimensions?.[dimension.id]?.n));
    page(`${toolbar}
      ${charted.length ? `<div class="dims-grid">${charted.map((entry) => card(entry, dimensions, unit, modelOf(entry))).join('')}</div>`
        : `<p class="muted">还没有${noun}答过单项题。</p>`}
      <h3 class="dims-heading">明细</h3>
      ${table(entries, dimensions, unit, modelOf)}
      <p class="dims-foot"><span>只统计带单项题的测试对局，目前只有${esc(data.categories.join('、'))}题有单项题。</span><span>两边是同一${noun}的一对不计。</span><span>综合是同一批对局里综合题的胜率。</span>${totals.since ? `<span>数据从 ${formatDate(totals.since)} 到 ${formatDate(totals.until)}。</span>` : ''}</p>`, meta);
  }

  async function load() {
    if (!isStaff()) return gate();
    const id = ++request;
    $('.dims', root)?.classList.add('is-loading');
    if (!data) page('<p class="muted">正在载入维度图…</p>');
    try {
      const next = await api(`arena/guided/dimensions?by=${unit}`);
      if (destroyed || id !== request) return;
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
    tip.innerHTML = tipHtml(axesOf(entry, data.dimensions)[index]);
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

  const onClick = (event) => {
    const button = event.target.closest('[data-dims-unit]');
    if (button && button.dataset.dimsUnit !== unit) {
      unit = button.dataset.dimsUnit;
      store.set('dimensions-unit', unit);
      void load();
    }
    if (event.target.closest('[data-dims-retry]')) void load();
  };
  const onOver = (event) => { const hit = event.target.closest?.('.radar-hit'); if (hit) showTip(hit); };
  const onOut = (event) => { if (event.target.closest?.('.radar-hit')) hideTip(); };
  root.addEventListener('click', onClick);
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
      root.removeEventListener('pointerover', onOver);
      root.removeEventListener('pointerout', onOut);
      root.removeEventListener('focusin', onOver);
      root.removeEventListener('focusout', onOut);
    },
  };
}
