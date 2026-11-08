// How recorded usage reads on the gallery (token-cost design §5.1, §5.2, §5.4): the line under a card's
// source, the 「生成用量」 block in the preview drawer, a line under each pane of a side-by-side
// preview, and the lines and comparison after a blind vote. All arithmetic and number formatting is
// usage.js's; this file only lays it out.
//
// Amounts (¥/$), cost multiples and price facts appear only while the server's switch is on
// (costShown). Until then every place shows tokens, requests, time and artifact size, and the drawer
// compares tokens within the question.
import { esc, store } from './ui.js';
import { isStaff, pricingInfo } from './platform.js';
import { locale } from './i18n.js';
import { PAID_BASIS, PARTS, SOURCES, costOf, costShown, exclusion, formatDuration, formatMoney, formatTokens, priceFor, taskMedian, tokensOf, valueOf } from './usage.js';

// ---- the price table and the switch -------------------------------------------------------
// The site reads GET /api/pricing once (platform.js pricingInfo, shared with the usage view and the
// leaderboard); this keeps its answer at hand for synchronous drawing. Until it arrives, and after a
// failed read, the switch counts as off, so no amount can appear by accident.
let pricing = { showCost: false };
export const pricingNow = () => pricing;
export const loadPricing = () => pricingInfo().then((data) => (pricing = data ?? { showCost: false }));

// Readers see ¥ in Chinese and $ in English unless they chose; the choice is kept on this device.
export const CURRENCY_KEY = 'usage-currency';
export const currencyNow = () => (['CNY', 'USD'].includes(store.get(CURRENCY_KEY)) ? store.get(CURRENCY_KEY) : locale() === 'en' ? 'USD' : 'CNY');
const money = (cny) => formatMoney(cny, currencyNow(), pricing.fx);
const other = () => (currencyNow() === 'CNY' ? 'USD' : 'CNY');

const PART_LABEL = { cacheRead: '缓存读取', input: '输入', cacheWrite: '缓存写入', output: '输出' };
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
// Each figure is its own text node, so a translation never has to take a number apart.
const bit = (text) => `<span>${esc(text)}</span>`;
const join = (bits) => bits.filter(Boolean).join('<span class="usage-sep" aria-hidden="true"> · </span>');

// What a work cost, or null: only with the switch on, a priced model and an input/output split.
function costFor(work) {
  if (!costShown(pricing)) return null;
  return costOf(work.usage, priceFor(pricing, work.model), pricing.fx);
}
// Shown in place of an amount when the switch is on but the work cannot be priced.
const unpriced = (work) => costShown(pricing) && work.usage && !costFor(work);

// One line of usage: the amount (or 未定价) when amounts are on, then tokens and time. Empty when
// the work has no record. `extra` adds output and the source, as the blind-vote reveal does.
export function usageLine(work, { extra = false } = {}) {
  const usage = work?.usage;
  if (!usage) return '';
  const cost = costFor(work), tokens = tokensOf(usage);
  return join([
    cost ? `<b class="usage-money">${esc(money(cost.total))}</b>` : unpriced(work) ? bit('未定价') : '',
    finite(tokens) ? bit(`${formatTokens(tokens)} tok`) : '',
    extra && finite(usage.output) ? bit(`输出 ${formatTokens(usage.output)}`) : '',
    finite(usage.durationSec) ? bit(formatDuration(usage.durationSec)) : '',
    extra && SOURCES[usage.source] ? bit(SOURCES[usage.source]) : '',
  ]);
}

// Under a card's source line; nothing at all for works without a record.
export const cardUsage = (work) => (work?.usage ? `<p class="result-usage" data-usage>${usageLine(work)}</p>` : '');

// Artifact size with the file count and bytes in the drawer's 文件/产物 row.
export function artifactRow(work, formatBytes) {
  const a = work.artifact;
  const files = finite(a?.files) ? a.files : work.files, bytes = finite(a?.bytes) ? a.bytes : work.bytes;
  if (!a && !files) return '';
  const size = [
    finite(a?.lines) ? bit(`${a.lines.toLocaleString('en')} 行`) : '',
    finite(a?.tokens) ? bit(`${formatTokens(a.tokens)} tok`) : finite(a?.chars) ? bit(`${a.chars.toLocaleString('en')} 字`) : '',
    files ? bit(`${files} 个文件`) : '',
    finite(bytes) && bytes > 0 ? bit(formatBytes(bytes)) : '',
  ];
  return `<div><dt>${a ? '产物' : '文件'}</dt><dd class="usage-artifact">${join(size)}</dd></div>`;
}

// ---- the drawer block ---------------------------------------------------------------------

// The works of the question that count in its comparison on this metric.
function counted(task, metric) {
  return (task?.results ?? []).filter((r) => r.usage && !exclusion(r, metric, pricing, r.model))
    .map((r) => ({ id: r.id, value: valueOf(r, metric, pricing, r.model) })).filter((item) => finite(item.value) && item.value > 0);
}

// The question's counted works on a log scale: this work solid, the median dashed (§5.2 同题位置).
function position(task, work, metric) {
  const items = counted(task, metric);
  const mid = taskMedian(items.map((item) => item.value));
  if (!mid) return '';
  const own = items.find((item) => item.id === work.id);
  const lo = Math.log10(Math.min(...items.map((item) => item.value))), hi = Math.log10(Math.max(...items.map((item) => item.value)));
  const span = Math.max(hi - lo, 0.3), left = lo - span * 0.06, width = span * 1.12;
  const x = (value) => (((Math.log10(value) - left) / width) * 280 + 10).toFixed(1);
  const label = (value) => (metric === 'cost' ? money(value) : formatTokens(value));
  const dots = items.map((item) => `<circle class="usage-dot${item.id === work.id ? ' is-own' : ''}" cx="${x(item.value)}" cy="26" r="${item.id === work.id ? 4.5 : 3.5}"/>`).join('');
  const ratio = own ? own.value / mid : null;
  return `<div class="usage-position">
    <h4>同题位置</h4>
    <svg viewBox="0 0 300 50" role="img" aria-label="${esc(`本题 ${items.length} 件计入，中位 ${label(mid)}`)}">
      <line class="usage-pos-axis" x1="6" y1="26" x2="294" y2="26"/>
      <line class="usage-median" x1="${x(mid)}" y1="10" x2="${x(mid)}" y2="36"/>
      <text class="usage-tick" x="${x(mid)}" y="8" text-anchor="middle">${esc(`中位 ${label(mid)}`)}</text>
      ${dots}
      <text class="usage-tick" x="10" y="48">${esc(label(10 ** lo))}</text><text class="usage-tick" x="290" y="48" text-anchor="end">${esc(label(10 ** hi))}</text>
    </svg>
    <p class="fine"><span>${esc(`本题 ${items.length} 件计入`)}</span>${ratio ? ` · <span>${esc(metric === 'cost' ? `这一件是中位的 ${ratio.toFixed(1)} 倍` : `这一件的 token 是中位的 ${ratio.toFixed(1)} 倍`)}</span>` : ''}</p>
  </div>`;
}

// The 「生成用量」 block under 核验状态. Readers see it only for recorded works; administrators also
// see 「编辑」 on recorded ones (data-usage-edit) and, once the server is known to keep usage
// (`entry`: GET /api/works/metrics answered), 「未录入用量 · 录入」 on the rest. An older server
// leaves the drawer exactly as it was.
export function usageBlock(work, task, { entry = false } = {}) {
  const usage = work?.usage, admin = isStaff();
  if (!usage) {
    return admin && entry ? `<div class="guide-block usage-block is-empty"><div class="usage-block-head"><h3>生成用量</h3><span class="fine">未录入用量</span><button class="btn sm" type="button" data-usage-edit>录入</button></div></div>` : '';
  }
  const shown = costShown(pricing), cost = costFor(work), price = shown ? priceFor(pricing, work.model) : null;
  const tokens = tokensOf(usage);
  // Shares follow the amount while amounts are on, tokens otherwise; colours are only a guide.
  const parts = PARTS.filter((part) => finite(usage[part]));
  const share = (part) => (cost ? cost.parts[part] / (cost.total || 1) : finite(tokens) && tokens ? usage[part] / tokens : 0);
  const bar = parts.length > 1 ? `<div class="usage-mix" aria-hidden="true">${parts.map((part) => `<i class="is-${part}" style="flex-grow:${Math.max(share(part), 0.004).toFixed(4)}"></i>`).join('')}</div>` : '';
  const rows = parts.map((part) => `<tr><th scope="row"><i class="usage-key is-${part}" aria-hidden="true"></i>${PART_LABEL[part]}</th><td>${formatTokens(usage[part])}</td>${cost ? `<td>${esc(money(cost.parts[part]))}</td>` : ''}<td>${Math.round(share(part) * 100)}%</td></tr>`
    + (part === 'output' && finite(usage.reasoning) ? `<tr class="usage-sub"><th scope="row">其中推理</th><td>${formatTokens(usage.reasoning)}</td>${cost ? '<td></td>' : ''}<td></td></tr>` : '')).join('');
  const table = parts.length ? `<table class="usage-table"><thead><tr><th scope="col">构成</th><th scope="col">token</th>${cost ? '<th scope="col">花费</th>' : ''}<th scope="col">占比</th></tr></thead>
    <tbody>${rows}</tbody>${parts.length > 1 ? `<tfoot><tr><th scope="row">合计</th><td>${formatTokens(tokens)}</td>${cost ? `<td>${esc(money(cost.total))}</td>` : ''}<td></td></tr></tfoot>` : ''}</table>` : '';
  const headline = cost
    ? `<p class="usage-total"><b>${esc(money(cost.total))}</b><span>按官方标价折算</span></p>
      <p class="usage-aside">${join([bit(`约 ${formatMoney(cost.total, other(), pricing.fx)}`), usage.paid?.basis ? `<span><span>实付：</span><span>${PAID_BASIS[usage.paid.basis] ?? esc(usage.paid.basis)}</span></span>` : ''])}</p>`
    : shown && unpriced(work) ? `<p class="usage-total"><b>未定价</b><span>没有官方标价，只列 token</span></p>`
      : finite(tokens) ? `<p class="usage-total"><b>${formatTokens(tokens)}</b><span>token</span></p>` : '';
  const why = exclusion(work, shown && cost ? 'cost' : 'tokens', pricing, work.model);
  const facts = [
    finite(usage.requests) ? `<div><dt>请求</dt><dd class="usage-mono">${esc(usage.requests)}</dd></div>` : '',
    finite(usage.durationSec) ? `<div><dt>耗时</dt><dd>${esc(formatDuration(usage.durationSec))}</dd></div>` : '',
    price ? `<div><dt>价格</dt><dd><span data-i18n-ignore>${esc(work.modelName)}</span> <span>官方标价</span>${cost?.tiered ? ' · <span>分档未计</span>' : ''}</dd></div>` : '',
    price && pricing.asOf ? `<div><dt>价格表</dt><dd class="usage-mono">${esc(pricing.asOf)}${finite(pricing.fx?.USD) ? ` · 1 USD = ${pricing.fx.USD} CNY` : ''}</dd></div>` : '',
  ].join('');
  return `<div class="guide-block usage-block">
    <div class="usage-block-head"><h3>生成用量</h3>${SOURCES[usage.source] ? `<span class="badge">${SOURCES[usage.source]}</span>` : ''}${admin ? '<button class="btn sm" type="button" data-usage-edit>编辑</button>' : ''}</div>
    ${headline}${bar}${table}
    ${facts ? `<dl class="facts">${facts}</dl>` : ''}
    ${why === 'multi-turn' || why === 'intervention' ? `<p class="fine">${why === 'multi-turn' ? '多轮生成' : '有人工介入'}：照常显示，不计入同题对比。</p>` : position(task, work, cost ? 'cost' : 'tokens')}
  </div>`;
}

// ---- blind vote, after the reveal --------------------------------------------------------

// A line under a revealed work's name; empty without a record, so only recorded sides show one.
export const revealUsage = (work) => (work?.usage ? `<div class="arena-usage-line" data-usage>${usageLine(work, { extra: true })}</div>` : '');

// The two sides side by side once both are recorded: amounts while they are on, tokens otherwise.
// `chosen` is the side the reader picked ('a', 'b' or anything else for a tie).
export function revealCompare(a, b, chosen) {
  if (!a?.usage || !b?.usage) return '';
  const costA = costFor(a), costB = costFor(b);
  const byCost = Boolean(costA && costB);
  const value = (work, cost) => (byCost ? cost.total : tokensOf(work.usage));
  const va = value(a, costA), vb = value(b, costB);
  if (!finite(va) || !finite(vb) || va <= 0 || vb <= 0) return '';
  const [big, small] = va >= vb ? ['a', 'b'] : ['b', 'a'];
  const ratio = Math.max(va, vb) / Math.min(va, vb), n = ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1);
  // Whole sentences, one per case, so each translates as a phrase (i18n-experience.js).
  const what = byCost ? '花费' : '用的 token ';
  const [A, B] = [big.toUpperCase(), small.toUpperCase()];
  const headline = ratio < 1.1 ? `两边${what}差不多`
    : chosen === big ? `你选的 ${A} ${what}是 ${B} 的 ${n} 倍` : chosen === small ? `${A} ${what}是你选的 ${B} 的 ${n} 倍` : `${A} ${what}是 ${B} 的 ${n} 倍`;
  const fmt = (v) => (byCost ? money(v) : formatTokens(v));
  const max = Math.max(va, vb);
  const row = (side, v) => `<span class="ab">${side.toUpperCase()}</span><span class="usage-meter"><i style="width:${Math.max((v / max) * 100, 1.5).toFixed(1)}%"></i></span><b>${esc(fmt(v))}</b>`;
  const time = finite(a.usage.durationSec) && finite(b.usage.durationSec)
    ? `<span><span>耗时</span> <span>${esc(formatDuration(a.usage.durationSec))}</span> / <span>${esc(formatDuration(b.usage.durationSec))}</span></span>` : '';
  return `<div class="arena-compare" data-usage-compare>
    <p><b>${esc(headline)}</b><small>${join([byCost ? bit('按官方标价折算') : '', time, bit('不影响这一票')])}</small></p>
    <div class="arena-compare-bars" aria-hidden="true">${row('a', va)}${row('b', vb)}</div>
  </div>`;
}
