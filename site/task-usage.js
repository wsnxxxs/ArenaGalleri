// The task page's usage view (#/<task>/usage, or #/<task>/cost once amounts are on; design §5.3).
// Lists the works an administrator measured, one bar each, sorted by the chosen metric, with the
// question's median as a dashed line once three works count. Amounts (¥/$) appear only when the
// server's switch is on (usage.costShown); until then the view compares tokens, requests, time and
// artifact size. Rows can be grouped by model, configuration, Harness or model + Harness.
import { $, brandMark, esc, icon, store } from './ui.js';
import { standard } from './featured.js';
import { variantsOf } from './prompt-variants.js';
import { locale } from './i18n.js';
import { pricingInfo } from './platform.js';
import { EXCLUSIONS, PAID_BASIS, PARTS, SOURCES, SYMBOL, artifactOf, convert, costOf, costShown, exclusion, formatDuration, formatMoney, formatTokens,
  median, priceFor, taskMedian, valueOf } from './usage.js';

// The words this view uses (see the terminology table in the handoff): every kind of token gets a short
// plain explanation where the numbers are broken down.
const PART_LABELS = { total: '全部', input: '输入', cacheRead: '缓存读取', cacheWrite: '缓存写入', output: '输出', reasoning: '其中推理' };
const COMPOSITION = { cacheRead: '缓存读取', input: '输入', cacheWrite: '缓存写入', output: '输出（含推理）' };
const MEANING = { cacheRead: '每次请求重复读入的上下文', input: '新读入的提示和文件', cacheWrite: '存进缓存、供之后读取的上下文', output: '模型写出的内容', reasoning: '模型的思考过程' };
const GROUPS = { work: '逐件', model: '按模型', config: '按配置', harness: '按 Harness', pair: '按模型 + Harness' };
// One ink ramp: darker parts cost more per token (cache reads are cheapest, output dearest).
const SHADE = { cacheRead: 30, input: 52, cacheWrite: 74, output: 100 };
const shade = (part) => `color-mix(in srgb, var(--ink) ${SHADE[part] ?? 82}%, var(--bg))`;
const count = (n, unit) => `${n} ${unit}`;

export function mountTaskUsage(container, ctx) {
  const t = ctx.task;
  const recorded = t.results.filter((r) => r.usage);
  const state = {
    metric: null, part: 'total', scale: store.get('usage-scale') === 'log' ? 'log' : 'linear', group: 'work', showExcluded: false,
    currency: ['CNY', 'USD'].includes(store.get('usage-currency')) ? store.get('usage-currency') : locale() === 'en' ? 'USD' : 'CNY',
  };
  let pricing = null, shown = false, destroyed = false, tips = 0, query = '';

  const modelId = (r) => ctx.modelOf(r).id ?? r.model;
  const harnessName = (r) => ctx.harnessOf(r)?.name ?? '未注明 Harness';
  const keyOf = {
    work: (r) => r.id, model: (r) => modelId(r), config: (r) => ctx.entryKey(r),
    harness: (r) => harnessName(r), pair: (r) => `${modelId(r)} ${harnessName(r)}`,
  };
  const nameOf = {
    model: (r) => ctx.modelOf(r).name, config: (r) => ctx.label(r), harness: (r) => harnessName(r),
    pair: (r) => `${ctx.modelOf(r).name} · ${harnessName(r)}`,
  };
  const metrics = () => [...(shown ? [['cost', '花费']] : []), ['tokens', 'token'], ['requests', '请求次数'], ['duration', '生成耗时'], ['artifact', '作品体量']];
  const value = (r) => valueOf(r, state.metric, pricing, modelId(r), state.part);
  const why = (r) => exclusion(r, state.metric, pricing, modelId(r), state.part);
  const money = (cny) => formatMoney(cny, state.currency, pricing?.fx);
  const unit = () => recorded.map((r) => artifactOf(r.artifact)?.unit).find(Boolean) ?? 'tokens';
  const display = (v, metric = state.metric) => v == null ? '—'
    : metric === 'cost' ? money(v) : metric === 'tokens' ? `${formatTokens(v)} token` : metric === 'requests' ? count(v, '次')
      : metric === 'duration' ? formatDuration(v) : unit() === 'chars' ? count(v.toLocaleString('en'), '字') : `${formatTokens(v)} token`;

  // A work's composition: the four kinds of token, in cost when amounts are on and the metric is cost.
  const composition = (r) => {
    if (state.metric === 'cost') return costOf(r.usage, priceFor(pricing, modelId(r)), pricing?.fx)?.parts ?? null;
    if (state.metric === 'tokens' && state.part === 'total') return Object.fromEntries(PARTS.map((part) => [part, r.usage[part] ?? 0]));
    return null;
  };

  // Rows: each measured work, or one per group with the median of its counted works.
  function rows() {
    const works = recorded.map((r) => ({ r, value: value(r), why: why(r) }));
    const counted = works.filter((w) => !w.why);
    if (state.group === 'work') {
      const list = state.showExcluded ? works : counted;
      return { counted, list: list.map((w) => ({ ...w, key: w.r.id, name: ctx.label(w.r) })) };
    }
    const groups = new Map();
    for (const w of counted) {
      const key = keyOf[state.group](w.r);
      const group = groups.get(key) ?? { key, name: nameOf[state.group](w.r), works: [] };
      group.works.push(w);
      groups.set(key, group);
    }
    return { counted, list: [...groups.values()].map((g) => ({ ...g, value: median(g.works.map((w) => w.value)) })) };
  }

  // Axes run in what the reader sees (amounts in the chosen currency). Linear axes start at 0 and end
  // on a round number; log axes span whole decades.
  const shownValue = (v) => state.metric === 'cost' ? convert(v, state.currency, pricing?.fx) : v;
  const tick = (v) => state.metric === 'cost' ? `${SYMBOL[state.currency]}${v < 1 ? v : Math.round(v).toLocaleString('en')}`
    : state.metric === 'duration' ? formatDuration(v) : state.metric === 'requests' ? String(v) : formatTokens(v);
  function axis(raw) {
    const values = raw.map(shownValue);
    const scaled = scale(values);
    return { at: (v) => scaled.at(shownValue(v)), ticks: scaled.ticks };
  }
  function scale(values) {
    const top = Math.max(...values, 0);
    const positive = values.filter((v) => v > 0);
    if (state.scale === 'log' && positive.length) {
      const lo = 10 ** Math.floor(Math.log10(Math.min(...positive))), hi = 10 ** Math.ceil(Math.log10(Math.max(...positive)));
      const span = Math.max(Math.log10(hi / lo), 1);
      const ticks = []; for (let v = lo; v <= hi * 1.0001; v *= 10) ticks.push(v);
      return { at: (v) => v > 0 ? Math.max(0, Math.log10(v / lo) / span * 100) : 0, ticks };
    }
    const step0 = 10 ** Math.floor(Math.log10(top / 4 || 1));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * step0).find((s) => top / s <= 5) ?? step0 * 10;
    const end = Math.max(step, Math.ceil(top / step) * step);
    const ticks = []; for (let v = 0; v <= end * 1.0001; v += step) ticks.push(v);
    return { at: (v) => v / end * 100, ticks };
  }

  // Who made a work: Harness, service provider, prompt version and how it was generated. Rows show the
  // first two; the single-record card shows all of them.
  const whereOf = (r, full = false) => {
    const variant = full && r.promptVariant ? variantsOf(t).find((v) => v.id === r.promptVariant)?.label : '';
    return [ctx.harnessOf(r)?.name ? `<span data-i18n-ignore>${esc(ctx.harnessOf(r).name)}</span>` : '<span>未注明 Harness</span>',
      ctx.providerOf?.(r)?.name ? `<span>${esc(ctx.providerOf(r).name)}</span>` : '',
      variant ? `<span>提示词</span> <span data-i18n-ignore>${esc(variant)}</span>` : '',
      full ? `<span>${standard(r) ? '单轮生成' : r.generationMode === 'multi-turn' ? '多轮生成' : '有人工介入'}</span>` : '']
      .filter(Boolean).join(' · ');
  };
  // The full record of one work, for the hover/focus tip and the single-record card.
  function details(r, explain = false) {
    const cost = shown ? costOf(r.usage, priceFor(pricing, modelId(r)), pricing?.fx) : null;
    const why = (part) => explain ? `<small class="usage-part-why">${MEANING[part]}</small>` : '';
    const lines = PARTS.filter((part) => r.usage[part] != null).map((part) => `<tr><th scope="row"><i style="background:${shade(part)}"></i>${COMPOSITION[part]}${why(part)}</th><td>${formatTokens(r.usage[part])}</td>${cost ? `<td>${money(cost.parts[part])}</td>` : ''}</tr>`);
    if (r.usage.reasoning != null) lines.push(`<tr class="is-sub"><th scope="row">其中推理${why('reasoning')}</th><td>${formatTokens(r.usage.reasoning)}</td>${cost ? '<td></td>' : ''}</tr>`);
    const total = valueOf(r, 'tokens');
    return `<table class="usage-parts"><tbody>${lines.join('')}${total != null ? `<tr class="is-total"><th scope="row">合计</th><td>${formatTokens(total)}</td>${cost ? `<td>${money(cost.total)}</td>` : ''}</tr>` : ''}</tbody></table>`;
  }
  const facts = (r) => {
    const art = artifactOf(r.artifact);
    return [r.usage.requests != null ? `<span>${count(r.usage.requests, '次请求')}</span>` : '', r.usage.durationSec != null ? `<span>${formatDuration(r.usage.durationSec)}</span>` : '',
      art ? `<span>${art.unit === 'chars' ? count(art.value.toLocaleString('en'), '字') : `${formatTokens(art.value)} token`}</span>` : ''].filter(Boolean).join(' · ');
  };

  // The line under a value: what the other metrics say about the same work.
  function secondaryOf(r) {
    const tok = valueOf(r, 'tokens'), art = r.artifact;
    const bits = state.metric === 'cost' ? [tok != null ? `${formatTokens(tok)} token` : '', r.usage.durationSec != null ? formatDuration(r.usage.durationSec) : '']
      : state.metric === 'tokens' ? [r.usage.requests != null ? count(r.usage.requests, '次请求') : '', r.usage.durationSec != null ? formatDuration(r.usage.durationSec) : '']
        : state.metric === 'artifact' ? [art?.lines != null ? count(art.lines.toLocaleString('en'), '行') : '', art?.files != null ? count(art.files, '个文件') : '']
          : [tok != null ? `${formatTokens(tok)} token` : ''];
    return bits.filter(Boolean).map((bit) => `<span>${bit}</span>`).join(' · ');
  }
  function bar(row, at, median) {
    const parts = row.r && !row.why && state.scale === 'linear' ? composition(row.r) : null;
    let left = 0;
    const segments = parts ? PARTS.filter((part) => parts[part] > 0).map((part) => {
      const width = at(parts[part]);
      const html = `<i style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%;background:${shade(part)}"></i>`;
      left += width;
      return html;
    }).join('') : row.value != null ? `<i style="left:0;width:${at(row.value).toFixed(2)}%;background:${shade()}"></i>` : '';
    return `<span class="usage-bar" aria-hidden="true">${segments}${median != null ? `<s style="left:${at(median).toFixed(2)}%"></s>` : ''}</span>`;
  }

  function rowHtml(row, at, mid) {
    const r = row.r;
    const secondary = r ? secondaryOf(r) : `<span>${count(row.works.length, '件')}</span>`;
    const value = row.why === 'unpriced' ? '<span>未定价</span>' : `<span>${display(row.value)}</span>`;
    const name = r ? `<b data-i18n-ignore>${esc(ctx.modelOf(r).name)}</b>${r.effort ? `<span class="badge" data-i18n-ignore>${esc(r.effort)}</span>` : ''}${row.why && row.why !== 'missing' ? `<span class="badge usage-why">${EXCLUSIONS[row.why]}</span>` : ''}<small>${whereOf(r)}</small>`
      : `<b data-i18n-ignore>${esc(row.name)}</b>`;
    const body = `<span class="usage-name">${name}</span>${bar(row, at, mid)}<span class="usage-value"><b>${value}</b><small>${secondary}</small></span>`;
    if (!r) return `<li class="usage-row is-group" data-usage-row="${esc(String(row.name).toLowerCase())}">${body}</li>`;
    const id = `usage-tip-${++tips}`;
    return `<li class="usage-row${row.why ? ' is-excluded' : ''}" data-usage-row="${esc([ctx.label(r), ctx.harnessOf(r)?.name].join(' ').toLowerCase())}">
      <a class="usage-link" href="${ctx.viewHref(t, r.id)}" aria-describedby="${id}">${body}</a>
      <span class="usage-tip" role="tooltip" id="${id}">${details(r)}</span></li>`;
  }

  const stat = (label, value, note = '') => `<div><dt>${label}</dt><dd><b>${value}</b>${note ? `<small>${note}</small>` : ''}</dd></div>`;
  const by = (w) => `<span data-i18n-ignore>${esc(ctx.label(w.r))}</span>`;
  // Two or more counted works: the question's median (from three), the least and most, and their spread.
  function stats(counted, mid) {
    const sorted = [...counted].sort((a, b) => a.value - b.value);
    const middle = sorted.length % 2 ? sorted[sorted.length >> 1] : null;
    const [low, high] = [sorted[0], sorted.at(-1)];
    return (mid != null ? stat('本题中位数', display(mid), middle ? by(middle) : count(sorted.length, '件参与比较'))
      : stat('参与比较', count(sorted.length, '件'), '不足 3 件，还没有中位数'))
      + stat(state.metric === 'cost' ? '最省' : '最少', display(low.value), by(low))
      + stat(state.metric === 'cost' ? '最贵' : '最多', display(high.value), by(high))
      + stat('相差', low.value > 0 ? `${Math.round(high.value / low.value * 10) / 10}×` : '—', state.metric === 'cost' ? '同一道题里，最贵是最省的几倍' : '同一道题里，最多是最少的几倍');
  }

  // How long the delivered work is next to every work of the question (the server counts all works,
  // measured or not), in one sentence, with a small strip for those who want to see it.
  function sizeLine(r) {
    const own = artifactOf(r.artifact);
    if (!own) return '';
    const lengths = t.results.map((w) => artifactOf(w.artifact)?.value).filter((v) => v > 0);
    const what = own.unit === 'chars' ? `交付文字 ${own.value.toLocaleString('en')} 字`
      : `交付代码 ${r.artifact.lines != null ? `${r.artifact.lines.toLocaleString('en')} 行、` : ''}${formatTokens(own.value)} token`;
    if (lengths.length < 3 || !(own.value > 0)) return `<div class="usage-size"><p><span>${what}。</span></p></div>`;
    const shorter = lengths.filter((v) => v < own.value).length, longer = lengths.filter((v) => v > own.value).length;
    const place = shorter >= longer ? `，比本题 ${Math.round(shorter / lengths.length * 100)}% 的作品长。` : `，比本题 ${Math.round(longer / lengths.length * 100)}% 的作品短。`;
    const lo = Math.min(...lengths), hi = Math.max(...lengths), span = Math.log(hi / lo) || 1;
    const at = (v) => (Math.log(v / lo) / span * 100).toFixed(2);
    const mid = median(lengths);
    return `<div class="usage-size"><p><span>${what}</span><span>${place}</span></p>
      <div class="usage-dots" aria-hidden="true">${lengths.map((v) => `<i style="left:${at(v)}%"></i>`).join('')}<s style="left:${at(mid)}%"></s><b style="left:${at(own.value)}%"></b></div>
      <p class="usage-scale" aria-hidden="true"><span>${display(lo, 'artifact')}</span><span>中位数 ${display(mid, 'artifact')}</span><span>${display(hi, 'artifact')}</span></p></div>`;
  }

  // The plain reading of a record: how much was re-read context, and how much the model wrote.
  function plain(r) {
    const total = valueOf(r, 'tokens'), u = r.usage;
    const share = total > 0 && u.cacheRead > 0 ? Math.round(u.cacheRead / total * 100) : null;
    return [share ? `<span>其中 ${share}% 是缓存读取，也就是每次请求重复读入的上下文。</span>` : '',
      u.output != null ? `<span>${u.reasoning != null ? `模型写出 ${formatTokens(u.output)} token，其中推理 ${formatTokens(u.reasoning)}。` : `模型写出 ${formatTokens(u.output)} token。`}</span>` : '']
      .filter(Boolean).join('');
  }

  // A question with one record: that work is the subject. Who made it, three numbers, one bar and a
  // sentence; the breakdown and the source wait behind 构成明细.
  function card(r) {
    const m = ctx.modelOf(r);
    const paid = r.usage.paid?.basis ? PAID_BASIS[r.usage.paid.basis] : '';
    // The bar shows tokens, as the sentence under it does; what each kind cost is in the breakdown.
    const parts = Object.fromEntries(PARTS.map((part) => [part, r.usage[part] ?? 0]));
    const total = PARTS.reduce((sum, part) => sum + parts[part], 0);
    const key = (label, value) => value == null ? '' : `<div><dt>${label}</dt><dd>${value}</dd></div>`;
    const tokens = valueOf(r, 'tokens');
    return `<article class="usage-work" aria-label="这件作品的用量">
      <header class="usage-who">
        <a class="usage-who-link" href="${ctx.viewHref(t, r.id)}">${brandMark(m, 'brand-mark')}<span class="usage-who-text">
          <span class="usage-who-name"><b data-i18n-ignore>${esc(m.name)}</b>${r.effort ? `<span class="badge" data-i18n-ignore>${esc(r.effort)}</span>` : ''}</span>
          <small>${whereOf(r, true)}</small></span></a>
        <span class="usage-who-tools">${shown ? seg('currency', [['CNY', '¥'], ['USD', '$']], state.currency) : ''}<a class="text-link" href="${ctx.viewHref(t, r.id)}">在线预览${icon('right')}</a></span>
      </header>
      <dl class="usage-keys">
        ${shown ? key('花费', display(valueOf(r, 'cost', pricing, modelId(r)), 'cost')) : ''}
        ${key('总 token', tokens == null ? null : formatTokens(tokens))}
        ${key('生成耗时', r.usage.durationSec == null ? null : formatDuration(r.usage.durationSec))}
        ${key('请求次数', r.usage.requests == null ? null : count(r.usage.requests, '次'))}
      </dl>
      ${total > 0 ? `<span class="usage-stack" aria-hidden="true">${PARTS.filter((part) => parts[part] > 0).map((part) => `<i style="flex-grow:${parts[part] / total};background:${shade(part)}"></i>`).join('')}</span>` : ''}
      <p class="usage-plain">${plain(r)}</p>
      <details class="usage-more"><summary>构成明细${icon('next')}</summary>
        ${details(r, true)}
        <dl class="usage-facts">
          ${SOURCES[r.usage.source] ? `<div><dt>来源</dt><dd>${SOURCES[r.usage.source]}</dd></div>` : ''}
          ${paid ? `<div><dt>实付</dt><dd>${paid}</dd></div>` : ''}
        </dl></details>
      ${sizeLine(r)}
    </article>
    <p class="fine usage-later">目前只有这一件有用量记录。有 3 件以上时，这里会按用量排序，并画出本题的中位数。</p>`;
  }

  const seg = (name, options, current) => `<div class="seg" role="group" aria-label="${NAMES[name]}">${options.map(([value, text]) => `<button type="button" data-usage-set="${name}" data-value="${value}" aria-pressed="${value === current}">${text}</button>`).join('')}</div>`;
  const NAMES = { metric: '指标', scale: '刻度', currency: '币种' };

  function draw() {
    if (destroyed) return;
    tips = 0;
    const { counted, list } = rows();
    const sorted = [...list].sort((a, b) => (a.value ?? Infinity) - (b.value ?? Infinity) || String(a.name).localeCompare(String(b.name)));
    const mid = state.group === 'work' ? taskMedian(counted.map((w) => w.value)) : null;
    const values = sorted.map((row) => row.value).filter((v) => v != null);
    const at = values.length ? axis(values).at : () => 0;
    const ticks = values.length ? axis(values).ticks : [];
    // ticks are already in display units; place them on the same scale
    const tickAt = values.length ? scale(values.map(shownValue)).at : () => 0;
    const excluded = recorded.length - counted.length;
    const legend = state.scale === 'linear' && (state.metric === 'cost' || (state.metric === 'tokens' && state.part === 'total')) && state.group === 'work'
      ? `<p class="usage-legend" aria-hidden="true">${PARTS.map((part) => `<span><i style="background:${shade(part)}"></i>${COMPOSITION[part]}</span>`).join('')}${state.metric === 'cost' ? '<span class="fine">颜色越浓，单价越高</span>' : ''}</p>` : '';
    const controls = `${seg('metric', metrics().map(([v, text]) => [v, text]), state.metric)}
      ${state.metric === 'tokens' ? `<label class="result-sort">种类<select data-usage-part aria-label="token 种类">${Object.entries(PART_LABELS).map(([v, text]) => `<option value="${v}"${v === state.part ? ' selected' : ''}>${text}</option>`).join('')}</select></label>` : ''}
      ${seg('scale', [['linear', '线性'], ['log', '对数']], state.scale)}
      ${shown && state.metric === 'cost' ? seg('currency', [['CNY', '¥'], ['USD', '$']], state.currency) : ''}`;
    // A question with one record shows that record whole; sorting and a median need more.
    const single = recorded.length === 1 && counted.length === 1;
    container.innerHTML = `<div class="usage-head"><h2>${shown ? '花费' : '用量'}</h2>
        <p class="usage-lede"><span>${shown ? '这道题的作品生成时用了多少 token、花了多少钱、用了多久。' : '这道题的作品生成时用了多少 token、用了多久。'}</span><span>${single ? '数字由管理员从生成记录实测录入，目前 1 件有记录。' : `数字由管理员从生成记录实测录入，目前 ${recorded.length} 件有记录，${counted.length} 件参与比较。`}</span></p>
        ${shown && pricing?.asOf ? `<p class="usage-basis">按官方标价折算 · 价格表 <span data-i18n-date="${esc(pricing.asOf)}">${esc(pricing.asOf)}</span></p>` : ''}</div>
      ${single ? '' : `<dl class="usage-stats">${counted.length >= 2 ? stats(counted, mid) : stat('有记录', count(recorded.length, '件'), counted.length ? '参与比较的不足 2 件' : '都不参与比较')}</dl>`}
      ${single ? card(counted[0].r) : `<div class="usage-toolbar">
        ${recorded.length > 5 ? `<label class="collection-search">${icon('search')}<input type="search" data-usage-search aria-label="搜索模型" placeholder="搜索模型" value="${esc(query)}"></label>` : ''}
        <label class="result-sort">分组<select data-usage-group aria-label="分组">${Object.entries(GROUPS).map(([v, text]) => `<option value="${v}"${v === state.group ? ' selected' : ''}>${text}</option>`).join('')}</select></label>
        <button class="btn sm usage-display-toggle" type="button" data-usage-display aria-expanded="false" aria-controls="usage-controls">显示${icon('next')}</button>
        <div class="usage-controls" id="usage-controls">${controls}</div>
      </div>
      ${legend}
      ${sorted.length ? `<ol class="usage-rows${state.scale === 'log' ? ' is-log' : ''}">${sorted.map((row) => rowHtml(row, at, mid)).join('')}</ol>
      <div class="usage-axis" aria-hidden="true"><span></span><span class="usage-ticks">${ticks.map((v) => `<i style="left:${tickAt(v).toFixed(2)}%">${tick(v)}</i>`).join('')}${mid != null ? `<em style="left:${at(mid).toFixed(2)}%">中位数 ${display(mid)}</em>` : ''}</span><span></span></div>`
        : '<p class="muted">没有可比较的记录。</p>'}
      ${counted.length && counted.length < 3 && state.group === 'work' ? '<p class="fine usage-note">参与比较的作品不足 3 件，还没有中位数。</p>' : ''}`}
      ${single ? '' : `<div class="usage-foot">${state.group === 'work' && excluded ? `<label class="board-sample-toggle"><input type="checkbox" data-usage-excluded${state.showExcluded ? ' checked' : ''}><span>显示不参与比较的作品（${excluded}）</span></label>` : ''}
        <p class="fine">只列管理员实测过的作品；其余作品没有用量记录。</p></div>`}
      <details class="board-notes usage-notes"><summary>${shown ? '花费怎么算' : '用量怎么记'}${icon('next')}</summary><dl>
        ${shown ? '<div><dt>花费</dt><dd>花费 = 各类 token × 该模型当前官方标价，再按价格表汇率换算；实付不参与比较。</dd></div>' : ''}
        <div><dt>来源</dt><dd>管理员从 API 回执、工具统计、账单或会话日志录入，普通投稿没有用量。</dd></div>
        <div><dt>参与比较</dt><dd>只比较单轮生成、没有人工介入的作品${shown ? '，花费还要求模型已定价' : ''}；中位数要有 3 件以上。</dd></div>
        <div><dt>token</dt><dd>由各家分词器计数，跨模型只作参考。缓存读取是每次请求重复读入的上下文，输入是新读入的提示和文件，输出是模型写出的内容，推理包含在输出里。</dd></div>
        <div><dt>作品体量</dt><dd>交付代码的行数和长度（写作题为字数），由程序按同一规则统计全部作品，可以直接比较。</dd></div>
      </dl></details>`;
    applyQuery();
  }

  function applyQuery() {
    for (const row of container.querySelectorAll('[data-usage-row]')) row.hidden = Boolean(query) && !row.dataset.usageRow.includes(query);
  }
  const onClick = (e) => {
    const set = e.target.closest('[data-usage-set]');
    if (set) {
      state[set.dataset.usageSet] = set.dataset.value;
      if (set.dataset.usageSet === 'scale') store.set('usage-scale', state.scale);
      if (set.dataset.usageSet === 'currency') store.set('usage-currency', state.currency);
      return void draw();
    }
    const toggle = e.target.closest('[data-usage-display]');
    if (toggle) {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      $('#usage-controls', container)?.classList.toggle('is-open', open);
    }
  };
  const onInput = (e) => { if (e.target.matches('[data-usage-search]')) { query = e.target.value.trim().toLowerCase(); applyQuery(); } };
  const onChange = (e) => {
    if (e.target.matches('[data-usage-group]')) state.group = e.target.value;
    else if (e.target.matches('[data-usage-part]')) state.part = e.target.value;
    else if (e.target.matches('[data-usage-excluded]')) state.showExcluded = e.target.checked;
    else return;
    draw();
  };
  // Escape hides the tip in view until the pointer or focus moves on.
  const onKey = (e) => { if (e.key === 'Escape') container.classList.add('is-quiet'); };
  const onMove = () => container.classList.remove('is-quiet');
  container.addEventListener('click', onClick);
  container.addEventListener('change', onChange);
  container.addEventListener('input', onInput);
  container.addEventListener('keydown', onKey);
  container.addEventListener('pointermove', onMove);
  container.addEventListener('focusin', onMove);

  const ready = (ctx.pricing ?? pricingInfo()).then((info) => {
    if (destroyed) return;
    pricing = info;
    shown = costShown(info);
    // Cost leads when amounts are on and some record is priced; otherwise tokens.
    state.metric = shown && recorded.some((r) => !exclusion(r, 'cost', pricing, modelId(r))) ? 'cost' : 'tokens';
    draw();
  });
  return {
    ready,
    shown: () => shown,
    destroy() {
      destroyed = true;
      container.removeEventListener('click', onClick);
      container.removeEventListener('change', onChange);
      container.removeEventListener('input', onInput);
      container.removeEventListener('keydown', onKey);
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('focusin', onMove);
    },
  };
}
