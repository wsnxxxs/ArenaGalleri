// Usage and cost: the one place that turns recorded token counts into money and compares them
// (token-cost design §02–04). Pure functions; the pages pass works, the price table and how to key a
// work (model, configuration, Harness, model + Harness).
//
// usage    { input, cacheRead, cacheWrite, output, reasoning, requests, durationSec, paid, source }
//          raw numbers recorded by an administrator; a missing field means "not recorded", never 0.
// artifact { files, lines, tokens, bytes } counted from the work's files.
//          reasoning is part of output and is never billed again.
// artifact { files, lines, bytes, tokens? | chars? } counted from the work's files (chars for writing).
// pricing  GET /api/pricing { asOf, fx: { USD: 7.12 }, models: { <model id>: [{ since, currency, input,
//          output, cacheRead?, cacheWrite?, url }] } } prices per million tokens in the vendor's currency;
//          fx gives one unit of a currency in CNY. Contract: .wt/contracts/usage.md.
//
// Amounts stay hidden until the server turns them on (costShown); until then pages compare tokens,
// requests, time and artifact size only.

import { standard } from './featured.js';

export const PARTS = ['cacheRead', 'input', 'cacheWrite', 'output'];
// Token views can show the total or one kind; reasoning is the part of output the vendor reports.
export const TOKEN_PARTS = ['total', 'input', 'cacheRead', 'cacheWrite', 'output', 'reasoning'];
export const METRICS = ['cost', 'tokens', 'requests', 'duration', 'artifact'];
// The server's switch for amounts (¥/$, multiples, cost sorting and charts); off unless it says so.
export const costShown = (flags) => flags?.showCost === true;
const MILLION = 1_000_000;
const number = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

// The current official price: the latest entry dated no later than the table itself.
export function priceFor(pricing, modelId) {
  const entries = pricing?.models?.[modelId];
  if (!Array.isArray(entries)) return null;
  const asOf = pricing.asOf ?? '9999-12-31';
  return entries.filter((entry) => !entry.since || entry.since <= asOf)
    .sort((a, b) => String(b.since ?? '').localeCompare(String(a.since ?? '')))[0] ?? null;
}

// One unit of the currency in CNY; unknown currencies cannot be converted.
const rate = (fx, currency) => currency === 'CNY' ? 1 : number(fx?.[currency]) && fx[currency] > 0 ? fx[currency] : null;

// Cost in CNY with its parts, or null when the usage has no input/output split or the model has no
// usable price. Cache prices default to the input price; long-context tiers are billed at the base
// tier and flagged.
export function costOf(usage, price, fx) {
  if (!usage || !price || !number(usage.input) || !number(usage.output) || !number(price.input) || !number(price.output)) return null;
  const toCny = rate(fx, price.currency ?? 'CNY');
  if (toCny === null) return null;
  const per = { input: price.input, output: price.output,
    cacheRead: number(price.cacheRead) ? price.cacheRead : price.input, cacheWrite: number(price.cacheWrite) ? price.cacheWrite : price.input };
  const parts = Object.fromEntries(PARTS.map((part) => [part, (number(usage[part]) ? usage[part] : 0) * per[part] / MILLION * toCny]));
  return { total: PARTS.reduce((sum, part) => sum + parts[part], 0), parts, tiered: Boolean(price.tiered || price.tiers) };
}

// All recorded tokens, or one kind of them.
export function tokensOf(usage, part = 'total') {
  if (!usage) return null;
  if (part !== 'total') return number(usage[part]) ? usage[part] : null;
  const known = PARTS.filter((kind) => number(usage[kind]));
  return known.length ? known.reduce((sum, kind) => sum + usage[kind], 0) : null;
}
// Artifact length: unified tokens for code, non-blank characters for writing.
export const artifactOf = (artifact) => number(artifact?.tokens) ? { value: artifact.tokens, unit: 'tokens' }
  : number(artifact?.chars) ? { value: artifact.chars, unit: 'chars' } : null;

// What a work measures on one metric, in CNY for cost; part picks a kind of token.
export function valueOf(work, metric, pricing, modelId = work.model, part = 'total') {
  if (metric === 'cost') return costOf(work.usage, priceFor(pricing, modelId), pricing?.fx)?.total ?? null;
  if (metric === 'tokens') return tokensOf(work.usage, part);
  if (metric === 'requests') return number(work.usage?.requests) ? work.usage.requests : null;
  if (metric === 'duration') return number(work.usage?.durationSec) ? work.usage.durationSec : null;
  if (metric === 'artifact') return artifactOf(work.artifact)?.value ?? null;
  return null;
}

// Why a recorded work stays out of medians, multiples and the leaderboard; null when it counts.
// Multi-turn and human-assisted works never count; cost also needs a priced model.
export function exclusion(work, metric, pricing, modelId = work.model, part = 'total') {
  if (!standard(work)) return work.generationMode === 'multi-turn' ? 'multi-turn' : 'intervention';
  if (metric === 'cost' && !priceFor(pricing, modelId)) return 'unpriced';
  return valueOf(work, metric, pricing, modelId, part) === null ? 'missing' : null;
}

export function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
export const geometricMean = (values) => values.length ? Math.exp(values.reduce((sum, v) => sum + Math.log(v), 0) / values.length) : null;

// A question's median needs at least three counted works.
export const MIN_TASK = 3;
export const taskMedian = (values) => values.length >= MIN_TASK ? median(values) : null;

// Group thresholds (§04): on the chart from 3 counted works over 2 questions; under 5 provisional.
export const GROUP = { min: 3, tasks: 2, firm: 5 };
// The leaderboard chart opens once 8 groups have 5 counted works each.
export const OPEN = { groups: 8, works: 5 };
export const groupStatus = ({ works, tasks }) => works < GROUP.min || tasks < GROUP.tasks ? 'insufficient' : works < GROUP.firm ? 'provisional' : 'firm';

// Cross-question comparison (§04). tasks: [{ id, results }]; keyOf(work) gives the group, modelOf(work)
// the priced model id. Each counted work is divided by its question's median; a group's multiple is
// the geometric mean of its works' multiples, beside the plain median cost per work. The median is
// always the whole question's, so a filter (include) picks works without moving the 1× line.
export function groupCosts(tasks, { pricing, keyOf, modelOf = (work) => work.model, include = () => true }) {
  const groups = new Map();
  for (const task of tasks) {
    const counted = task.results.filter((work) => work.usage && !exclusion(work, 'cost', pricing, modelOf(work)))
      .map((work) => ({ work, cost: valueOf(work, 'cost', pricing, modelOf(work)) }));
    const mid = taskMedian(counted.map((item) => item.cost));
    if (!mid) continue;
    for (const { work, cost } of counted) {
      if (!include(work)) continue;
      const key = keyOf(work);
      if (key == null) continue;
      const group = groups.get(key) ?? { key, multiples: [], costs: [], tasks: new Set(), sample: work };
      group.multiples.push(cost / mid);
      group.costs.push(cost);
      group.tasks.add(task.id);
      groups.set(key, group);
    }
  }
  return new Map([...groups].map(([key, g]) => {
    const stats = { key, works: g.multiples.length, tasks: g.tasks.size, multiple: geometricMean(g.multiples), medianCost: median(g.costs), sample: g.sample };
    return [key, { ...stats, status: groupStatus(stats) }];
  }));
}
export const chartOpen = (groups) => [...groups.values()].filter((g) => g.works >= OPEN.works).length >= OPEN.groups;

// The cost/score frontier: points that no other point beats on both, cheaper (lower x) and better
// (higher y). Ties in cost keep the higher score. Returns the frontier from cheapest to dearest.
export function frontier(points) {
  const sorted = [...points].filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)).sort((a, b) => a.x - b.x || b.y - a.y);
  const kept = [];
  for (const point of sorted) if (!kept.length || point.y > kept.at(-1).y) kept.push(point);
  return kept;
}

// ---- formatting --------------------------------------------------------------------------
// Readers see ¥ in Chinese and $ in English unless they choose; amounts are kept in CNY.
export const SYMBOL = { CNY: '¥', USD: '$' };
export const convert = (cny, currency, fx) => currency === 'CNY' ? cny : cny / (rate(fx, currency) ?? NaN);
const trim = (text) => text.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
export function formatMoney(cny, currency, fx) {
  const value = convert(cny, currency, fx);
  if (!Number.isFinite(value)) return '—';
  const digits = value >= 1000 ? 0 : value >= 0.1 || value === 0 ? 2 : null;
  const text = digits === null ? value.toPrecision(2) : value.toLocaleString('en', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${SYMBOL[currency] ?? ''}${text}`;
}
export function formatTokens(n) {
  if (!Number.isFinite(n)) return '—';
  if (n < 1000) return String(Math.round(n));
  if (n < MILLION) return `${trim((n / 1000).toFixed(n < 10_000 ? 1 : 0))}k`;
  return `${trim((n / MILLION).toFixed(n < 100 * MILLION ? 1 : 0))}M`;
}
export const formatMultiple = (x) => !Number.isFinite(x) ? '—' : `${x >= 100 ? Math.round(x) : x >= 10 ? x.toFixed(1) : x.toFixed(2)}×`;
// 45 秒 · 16 分 20 秒 · 1 小时 5 分: one text node per duration, translated as a whole (i18n-platform.js).
export function formatDuration(sec) {
  if (!Number.isFinite(sec)) return '—';
  const s = Math.round(sec);
  if (s < 60) return `${s} 秒`;
  if (s < 3600) return s % 60 ? `${Math.floor(s / 60)} 分 ${s % 60} 秒` : `${s / 60} 分`;
  const m = Math.round(s / 60);
  return m % 60 ? `${Math.floor(m / 60)} 小时 ${m % 60} 分` : `${m / 60} 小时`;
}
export const SOURCES = { api: 'API 回执', harness: '工具统计', bill: '账单', log: '会话日志' };
export const EXCLUSIONS = { 'multi-turn': '多轮', intervention: '人工介入', unpriced: '未定价', missing: '缺少数字' };
