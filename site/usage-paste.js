// Reads a pasted usage record into the raw numbers an administrator saves (token-cost design §5.6).
// Pure functions: no DOM, no network. The pasted text itself is never kept.
//
// Recognised: Claude Code's /cost summary, Codex's closing "Token usage" line and its session log
// (token_count events), and the usage objects of the Anthropic, OpenAI (Responses and Chat
// Completions) and Gemini APIs, alone, in an array, in JSON Lines or inside a larger response. The
// site's own shape ({ input, cacheRead, … }, as the backfill scripts print it) is read as is.
//
// Every result uses the site's fields: input is input that missed the cache. OpenAI and Gemini count
// cached input inside their input totals, so the cached part is taken out; reasoning is part of
// output. Formats are checked against today's tool output and may drift; unknown text gives null.

const FIELDS = ['input', 'cacheRead', 'cacheWrite', 'output', 'reasoning', 'requests', 'durationSec'];
const SUFFIX = { k: 1e3, m: 1e6, b: 1e9, 万: 1e4, 亿: 1e8 };

// "31k", "1.6M", "1,600,000", "3.1万" → a non-negative number; "" → undefined; anything else → null.
export function parseAmount(text) {
  const raw = String(text ?? '').trim().replace(/[\s_]/g, '');
  if (!raw) return undefined;
  const match = raw.replace(/,(?=\d{3}(\D|$))/g, '').match(/^(\d+(?:\.\d+)?|\.\d+)([kKmMbB万亿])?$/);
  if (!match) return null;
  return Number(match[1]) * (match[2] ? SUFFIX[match[2].toLowerCase()] : 1);
}
const count = (value) => { const n = parseAmount(value); return n == null ? null : Math.round(n); };
const whole = (n) => (Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined);
const tidy = (usage) => Object.fromEntries(FIELDS.filter((key) => Number.isFinite(usage[key])).map((key) => [key, key === 'durationSec' ? usage[key] : Math.round(usage[key])]));
const add = (sum, part) => { for (const key of FIELDS) if (Number.isFinite(part[key])) sum[key] = (sum[key] ?? 0) + part[key]; return sum; };

// "35m 7.9s", "1h 2m 3s", "7.9s", "16:20" → seconds.
export function parseDuration(text) {
  const raw = String(text ?? '').trim();
  const clock = raw.match(/^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/);
  if (clock) return (Number(clock[1] ?? 0) * 3600) + Number(clock[2]) * 60 + Number(clock[3]);
  const parts = [...raw.matchAll(/(\d+(?:\.\d+)?)\s*(h|hr|hours?|m|min|minutes?|s|sec|seconds?|小时|分钟|分|秒)/gi)];
  if (!parts.length) return null;
  return parts.reduce((sum, [, n, unit]) => sum + Number(n) * (/^(h|小时)/i.test(unit) ? 3600 : /^(m|分)/i.test(unit) ? 60 : 1), 0);
}

// ---- tool summaries (plain text) ----------------------------------------------------------

// Claude Code /cost: a line per model with input, output, cache read and cache write, plus the totals.
function claudeCode(text) {
  if (!/Usage by model|Total duration \(wall\)|Total cost:/i.test(text)) return null;
  const usage = {};
  let lines = 0;
  for (const line of text.split(/\r?\n/)) {
    const found = [...line.matchAll(/([\d.,]+\s*[kmb]?)\s+(input|output|cache read|cache write)\b/gi)];
    if (!found.length) continue;
    lines++;
    const part = {};
    for (const [, n, kind] of found) part[{ input: 'input', output: 'output', 'cache read': 'cacheRead', 'cache write': 'cacheWrite' }[kind.toLowerCase()]] = count(n);
    add(usage, part);
  }
  const wall = text.match(/Total duration \(wall\):\s*([^\n]+)/i);
  if (wall) usage.durationSec = parseDuration(wall[1]) ?? undefined;
  const cost = text.match(/Total cost:\s*\$\s*([\d.,]+)/i);
  if (!lines && !wall) return null;
  return { kind: 'claude-code', usage: tidy(usage), parts: lines, ...(cost ? { shown: { amount: Number(cost[1].replace(/,/g, '')), currency: 'USD' } } : {}) };
}

// Codex's closing line: "Token usage: total=… input=… (+ … cached) output=… (reasoning …)". The input
// it prints already leaves out the cached part, which follows in brackets.
function codexLine(text) {
  const line = text.match(/Token usage:\s*total=([\d,.]+[kmb]?)\s+input=([\d,.]+[kmb]?)(?:\s*\(\+\s*([\d,.]+[kmb]?)\s*cached\))?\s+output=([\d,.]+[kmb]?)(?:\s*\(reasoning\s+([\d,.]+[kmb]?)\))?/i);
  if (!line) return null;
  const usage = { input: count(line[2]), cacheRead: line[3] ? count(line[3]) : undefined, output: count(line[4]), reasoning: line[5] ? count(line[5]) : undefined };
  return { kind: 'codex', usage: tidy(usage), parts: 1 };
}

// ---- API usage objects (JSON) -------------------------------------------------------------

const has = (o, ...keys) => o && typeof o === 'object' && keys.every((key) => Number.isFinite(o[key]));
const RECOGNISERS = [
  // The site's own record, as the backfill scripts print it.
  ['site', (o) => has(o, 'output') && ('input' in o || 'cacheRead' in o) && !('output_tokens' in o),
    (o) => Object.fromEntries(FIELDS.map((key) => [key, Number.isFinite(o[key]) ? o[key] : undefined]))],
  // Codex session totals; input_tokens counts cached input too.
  ['codex', (o) => has(o, 'input_tokens', 'output_tokens') && 'cached_input_tokens' in o,
    (o) => ({ input: whole(o.input_tokens - (o.cached_input_tokens ?? 0)), cacheRead: whole(o.cached_input_tokens), output: whole(o.output_tokens), reasoning: whole(o.reasoning_output_tokens) })],
  // Anthropic Messages: input_tokens leaves out both cache reads and cache writes.
  ['anthropic', (o) => has(o, 'input_tokens', 'output_tokens') && ('cache_read_input_tokens' in o || 'cache_creation_input_tokens' in o || !('input_tokens_details' in o || 'total_tokens' in o)),
    (o) => ({ input: whole(o.input_tokens), cacheRead: whole(o.cache_read_input_tokens), cacheWrite: whole(o.cache_creation_input_tokens), output: whole(o.output_tokens) })],
  // OpenAI Responses: input_tokens includes input_tokens_details.cached_tokens.
  ['openai', (o) => has(o, 'input_tokens', 'output_tokens'),
    (o) => { const cached = o.input_tokens_details?.cached_tokens ?? 0; return { input: whole(o.input_tokens - cached), cacheRead: whole(o.input_tokens_details?.cached_tokens), output: whole(o.output_tokens), reasoning: whole(o.output_tokens_details?.reasoning_tokens) }; }],
  // OpenAI Chat Completions: prompt_tokens includes prompt_tokens_details.cached_tokens.
  ['openai', (o) => has(o, 'prompt_tokens', 'completion_tokens'),
    (o) => { const cached = o.prompt_tokens_details?.cached_tokens ?? 0; return { input: whole(o.prompt_tokens - cached), cacheRead: whole(o.prompt_tokens_details?.cached_tokens), output: whole(o.completion_tokens), reasoning: whole(o.completion_tokens_details?.reasoning_tokens) }; }],
  // Gemini usageMetadata: promptTokenCount includes cached content; thoughts are billed as output.
  ['gemini', (o) => has(o, 'promptTokenCount') && ('candidatesTokenCount' in o || 'thoughtsTokenCount' in o),
    (o) => { const cached = o.cachedContentTokenCount ?? 0, thoughts = o.thoughtsTokenCount ?? 0;
      return { input: whole(o.promptTokenCount - cached), cacheRead: whole(o.cachedContentTokenCount), output: whole((o.candidatesTokenCount ?? 0) + thoughts), reasoning: whole(o.thoughtsTokenCount) }; }],
];

// Every usage object in a parsed value, outermost first; a matched object is not searched further.
function collect(value, found = [], depth = 0) {
  if (depth > 8 || !value || typeof value !== 'object') return found;
  if (Array.isArray(value)) { for (const item of value) collect(item, found, depth + 1); return found; }
  // A Codex token_count event carries the running total and the last turn; keep only the total.
  if (value.total_token_usage && typeof value.total_token_usage === 'object') {
    found.push({ codexTotal: value.total_token_usage });
    return found;
  }
  for (const [kind, test, read] of RECOGNISERS) if (test(value)) { found.push({ kind, usage: read(value) }); return found; }
  for (const child of Object.values(value)) collect(child, found, depth + 1);
  return found;
}

function parseJson(text) {
  const trimmed = text.trim();
  if (!/^[[{]/.test(trimmed)) return null;
  try { return [JSON.parse(trimmed)]; } catch { /* JSON Lines below */ }
  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim());
  const values = [];
  for (const line of lines) { try { values.push(JSON.parse(line)); } catch { /* skip a broken line */ } }
  return values.length ? values : null;
}

function fromJson(values) {
  const found = values.flatMap((value) => collect(value));
  if (!found.length) return null;
  // A Codex log repeats a running total: the last one is the session. A request is a step up in
  // total_tokens, as scripts/codex-log-usage.mjs counts it. A counter that goes down was reset, and its
  // segments cannot be added up safely here: nothing is filled, and the backfill script is suggested.
  const totals = found.filter((item) => item.codexTotal).map((item) => item.codexTotal);
  if (totals.length) {
    const COUNTERS = ['input_tokens', 'cached_input_tokens', 'output_tokens', 'reasoning_output_tokens', 'total_tokens'];
    let requests = 0;
    for (let i = 0; i < totals.length; i++) {
      const before = totals[i - 1] ?? {};
      if (COUNTERS.some((key) => Number.isFinite(before[key]) && Number.isFinite(totals[i][key]) && totals[i][key] < before[key])) return { kind: 'codex', usage: {}, parts: totals.length, reset: true };
      if (Number.isFinite(totals[i].total_tokens) && totals[i].total_tokens > (before.total_tokens ?? 0)) requests++;
    }
    const read = RECOGNISERS.find(([kind]) => kind === 'codex')[2];
    const usage = tidy({ ...read({ cached_input_tokens: 0, ...totals.at(-1) }) });
    if (totals.every((total) => Number.isFinite(total.total_tokens))) usage.requests = requests;
    return { kind: 'codex', usage, parts: totals.length };
  }
  const kinds = new Set(found.map((item) => item.kind));
  const usage = tidy(found.reduce((sum, item) => add(sum, item.usage), {}));
  // Several API responses are several requests; a single site record keeps its own count.
  if (!kinds.has('site') && found.length > 1) usage.requests = found.length;
  if (!kinds.has('site') && found.length === 1) usage.requests = 1;
  return { kind: kinds.size === 1 ? [...kinds][0] : 'mixed', usage, parts: found.length };
}

export const KINDS = { 'claude-code': 'Claude Code 会话统计', codex: 'Codex 会话统计', anthropic: 'Anthropic usage', openai: 'OpenAI usage', gemini: 'Gemini usageMetadata', site: '用量记录', mixed: '多段 usage' };

// The numbers in a pasted record: { kind, usage, parts, shown?, reset? } or null when nothing is
// recognised. parts counts the model lines or responses that were added together; shown is a tool's own
// total cost; reset marks a Codex log whose counters went down, which gives no numbers.
export function recognize(text) {
  const raw = String(text ?? '');
  if (!raw.trim()) return null;
  const json = parseJson(raw);
  const result = (json && fromJson(json)) ?? codexLine(raw) ?? claudeCode(raw);
  return result && (result.reset || Object.keys(result.usage).length) ? result : null;
}

// Numbers that look mistyped. Shown in red beside the field; saving is never blocked by them.
export function warnings(usage) {
  const out = [];
  const n = (key) => (Number.isFinite(usage?.[key]) ? usage[key] : null);
  const total = ['input', 'cacheRead', 'cacheWrite', 'output'].reduce((sum, key) => sum + (n(key) ?? 0), 0);
  if (n('reasoning') !== null && n('output') !== null && n('reasoning') > n('output')) out.push({ field: 'reasoning', text: '其中推理不能大于输出' });
  for (const key of ['input', 'output']) {
    if (n(key) !== null && n(key) > 0 && n(key) < 100 && total - n(key) > 10_000) out.push({ field: key, text: '数字很小，是不是漏写了 k？' });
  }
  if (total > 2e9) out.push({ field: 'cacheRead', text: '合计超过 20 亿 token，检查单位' });
  if (n('requests') !== null && n('requests') > 10_000) out.push({ field: 'requests', text: '请求次数异常多，检查单位' });
  if (n('durationSec') !== null && n('durationSec') > 48 * 3600) out.push({ field: 'durationSec', text: '耗时超过 48 小时，这里填的是分钟' });
  return out;
}
