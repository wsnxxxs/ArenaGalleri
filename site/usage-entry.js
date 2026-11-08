// The administrators' 「生成用量」 block (token-cost design §5.6): in the upload form an administrator
// fills in, in 「管理 · 全部作品」 and from the preview drawer. Readers and ordinary members never see
// it, and the server only takes writes from administrators.
//
// A pasted tool summary or API usage is read in the browser (usage-paste.js) and only the numbers
// are kept. Fields take 31k or 1.6M. Numbers that look mistyped are marked in red but never stop a
// save; text that is not a number does, since the server would refuse it. Converted amounts appear
// only while the server's switch is on.
import { $, $$, esc, formatTime, icon } from './ui.js';
import { api, openDialog, refreshPlatform, toast } from './platform.js';
import { KINDS, parseAmount, recognize, warnings } from './usage-paste.js';
import { PAID_BASIS, SOURCES, costOf, costShown, formatMoney, formatTokens, priceFor, tokensOf } from './usage.js';
import { currencyNow, loadPricing, pricingNow } from './usage-view.js';

// Fields in the order of the form; minutes for time, which is stored in seconds.
const FIELDS = [
  ['requests', '请求次数'], ['durationSec', '耗时（分钟）'],
  ['input', '输入 token'], ['cacheRead', '缓存读取'], ['cacheWrite', '缓存写入'], ['output', '输出 token（含推理）'],
  ['reasoning', '其中推理（选填）'],
];
const PAID = { '': '—', ...PAID_BASIS };
// Where recognised numbers usually come from; the administrator can change it.
const SOURCE_OF = { 'claude-code': 'harness', codex: 'harness', anthropic: 'api', openai: 'api', gemini: 'api', mixed: 'api' };
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const shown = (key, value) => (!finite(value) ? '' : key === 'durationSec' ? String(Math.round((value / 60) * 10) / 10) : value.toLocaleString('en'));

export function usageEntryHtml() {
  return `<section class="usage-entry" data-usage-entry>
    <h3 class="mini-heading">生成用量<span class="badge">仅管理员</span></h3>
    <p class="field-hint">把工具结束时显示的用量统计，或 API 返回的 usage 粘贴进来，会自动识别。原文不保存，只保存识别出的数字；随这里的「保存」一起提交，不进审核队列。</p>
    <textarea class="input usage-paste" rows="3" data-usage-paste aria-label="粘贴用量统计" placeholder="Total cost: … / Token usage: … / {&quot;usage&quot;: …}"></textarea>
    <p class="usage-recognize"><button class="btn sm" type="button" data-usage-recognize>识别</button><span class="fine" role="status" data-usage-status></span></p>
    <p class="usage-model"><span class="field-label">模型（取自作品信息）</span><b data-usage-model data-i18n-ignore></b></p>
    <div class="usage-grid">
      ${FIELDS.map(([key, label]) => `<label class="field" data-usage-field="${key}"><span class="field-label">${label}</span><input class="input" name="usage_${key}" inputmode="decimal" autocomplete="off"><span class="field-hint usage-warn" data-usage-warn="${key}"></span></label>`).join('')}
      <div class="field usage-paid"><span class="field-label">实付（选填）</span>
        <span class="usage-paid-row"><input class="input" name="usage_paidAmount" inputmode="decimal" placeholder="金额" aria-label="实付金额" autocomplete="off">
        <select class="input" name="usage_paidCurrency" aria-label="实付币种"><option value="USD">USD</option><option value="CNY">CNY</option></select>
        <select class="input" name="usage_paidBasis" aria-label="实付方式">${Object.entries(PAID).map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select></span></div>
    </div>
    <div class="field"><span class="field-label">数字来自</span><div class="seg usage-source" role="radiogroup" aria-label="数字来自">${Object.entries(SOURCES).map(([value, text]) => `<button type="button" role="radio" aria-checked="false" data-usage-source="${value}">${text}</button>`).join('')}</div></div>
    <div class="usage-sum" data-usage-sum></div>
    <p class="field-hint usage-error" role="alert" data-usage-error></p>
    <p class="fine" data-usage-meta>录入人与时间记进这件作品的管理记录，读者看不到。</p>
  </section>`;
}

// Binds a block drawn by usageEntryHtml. `modelOf()` gives the work's current model { id, name } for
// the conversion; `draft` (any object) keeps what was typed across redraws of the form around it.
// read() → { usage, changed, error }: usage null means the record is to be removed.
export function bindUsageEntry(block, { modelOf = () => null, draft = {} } = {}) {
  let initial = null, initialText = {}, source = draft.source ?? null, recognised = draft.recognised ?? null;
  const input = (key) => block.querySelector(`[name="usage_${key}"]`);
  const status = $('[data-usage-status]', block), sum = $('[data-usage-sum]', block), problem = $('[data-usage-error]', block);

  function setSource(value) {
    source = value;
    draft.source = value;
    $$('[data-usage-source]', block).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.usageSource === value)));
  }
  // The numbers in the fields; a field that still shows what was loaded keeps the stored value exactly.
  function values() {
    const usage = {}, bad = [];
    for (const [key] of FIELDS) {
      const text = input(key).value;
      if (initial && text === initialText[key]) { if (finite(initial[key])) usage[key] = initial[key]; continue; }
      const n = parseAmount(text);
      if (n === null) bad.push(key);
      else if (n !== undefined) usage[key] = key === 'durationSec' ? Math.round(n * 60 * 10) / 10 : Math.round(n);
    }
    const amount = parseAmount(input('paidAmount').value), basis = input('paidBasis').value;
    if (amount === null) bad.push('paidAmount');
    const paid = basis ? { basis, ...(finite(amount) ? { amount, currency: input('paidCurrency').value } : {}) } : null;
    return { usage, paid, bad, amountWithoutBasis: finite(amount) && !basis };
  }
  function refresh() {
    const { usage, bad } = values();
    for (const [key] of FIELDS) {
      const note = $(`[data-usage-warn="${key}"]`, block);
      note.textContent = bad.includes(key) ? '无法识别这个数字' : warnings(usage).find((w) => w.field === key)?.text ?? '';
      note.classList.toggle('is-issue', Boolean(note.textContent));
    }
    const model = modelOf();
    $('[data-usage-model]', block).textContent = model?.name ?? '—';
    const pricing = pricingNow(), tokens = tokensOf(usage);
    const cost = costShown(pricing) ? costOf(usage, priceFor(pricing, model?.id), pricing.fx) : null;
    const tool = recognised?.shown && costShown(pricing) ? `<span>工具显示</span> <span class="usage-mono">$${esc(recognised.shown.amount)}</span>` : '';
    sum.innerHTML = cost
      ? `<p><span><span>按</span> <span data-i18n-ignore>${esc(model?.name ?? '')}</span> <span>官方标价折算</span></span><b>${esc(formatMoney(cost.total, currencyNow(), pricing.fx))}</b></p>
        <p class="fine"><span>${esc(`合计 ${formatTokens(tokens)} token`)}</span>${pricing.asOf ? ` · <span>${esc(`价格表 ${pricing.asOf}`)}</span>` : ''}${tool ? ` · ${tool}` : ''}</p>`
      : finite(tokens) ? `<p><span>${esc(`合计 ${formatTokens(tokens)} token`)}</span>${costShown(pricing) && model ? ' <span class="fine">未定价，只记 token</span>' : ''}</p>` : '';
    draft.texts = Object.fromEntries([...FIELDS.map(([key]) => key), 'paidAmount', 'paidCurrency', 'paidBasis'].map((key) => [key, input(key).value]));
  }
  // Fills the fields from a record; loaded records become the baseline for "changed".
  function fill(usage, { baseline = false } = {}) {
    for (const [key] of FIELDS) input(key).value = shown(key, usage?.[key]);
    input('paidAmount').value = finite(usage?.paid?.amount) ? String(usage.paid.amount) : '';
    input('paidCurrency').value = usage?.paid?.currency ?? 'USD';
    input('paidBasis').value = usage?.paid?.basis ?? '';
    if (baseline) {
      initial = usage ?? null;
      initialText = Object.fromEntries(FIELDS.map(([key]) => [key, input(key).value]));
      setSource(usage?.source ?? null);
    }
    refresh();
  }

  block.addEventListener('input', (e) => { if (e.target.name?.startsWith('usage_')) refresh(); });
  block.addEventListener('change', (e) => { if (e.target.name?.startsWith('usage_')) refresh(); });
  block.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-usage-source]');
    if (pick) { setSource(pick.dataset.usageSource); refresh(); return; }
    if (!e.target.closest('[data-usage-recognize]')) return;
    const paste = $('[data-usage-paste]', block);
    const result = recognize(paste.value);
    if (!result) { status.textContent = '没有识别出用量，可以直接在下面填写。'; status.classList.add('is-issue'); return; }
    if (result.reset) { status.textContent = '检测到计数器重置，建议用回填脚本'; status.classList.add('is-issue'); return; }
    recognised = result;
    draft.recognised = result;
    // Only what the paste contains replaces a field; numbers typed by hand for the rest stay.
    for (const [key] of FIELDS) if (finite(result.usage[key])) input(key).value = shown(key, result.usage[key]);
    if (result.usage.source && SOURCES[result.usage.source]) setSource(result.usage.source);
    else if (!source || SOURCE_OF[result.kind]) setSource(SOURCE_OF[result.kind] ?? 'log');
    // The pasted text is not kept: only the numbers move into the fields.
    paste.value = '';
    const items = FIELDS.filter(([key]) => finite(result.usage[key])).length;
    status.classList.remove('is-issue');
    status.innerHTML = `${icon('check')}<span><span>已识别：</span><span>${esc(KINDS[result.kind] ?? result.kind)}</span> · <span>${esc(`${items} 项`)}</span>${result.parts > 1 ? ` · <span>${esc(`合计 ${result.parts} 段`)}</span>` : ''}</span>`;
    refresh();
  });

  // Back from a redraw: the typed text and the chosen source come back.
  if (draft.texts) {
    for (const [key, value] of Object.entries(draft.texts)) if (input(key)) input(key).value = value;
    setSource(source);
  }
  refresh();

  return {
    fill,
    refresh,
    showMeta(record) {
      const who = (actor) => esc(actor?.name ?? '系统导入');
      $('[data-usage-meta]', block).innerHTML = record?.createdAt
        ? `<span>录入</span> <span data-i18n-ignore>${who(record.createdBy)}</span> · <span data-i18n-time="${esc(record.createdAt)}">${formatTime(record.createdAt)}</span>${record.updatedAt && record.updatedAt !== record.createdAt ? ` · <span>修改</span> <span data-i18n-ignore>${who(record.updatedBy)}</span> · <span data-i18n-time="${esc(record.updatedAt)}">${formatTime(record.updatedAt)}</span>` : ''} · <span>读者看不到录入人与时间。</span>`
        : '录入人与时间记进这件作品的管理记录，读者看不到。';
    },
    read() {
      const { usage, paid, bad, amountWithoutBasis } = values();
      const empty = !Object.keys(usage).length && !paid;
      problem.textContent = '';
      const fail = (text) => { problem.textContent = text; return { error: text }; };
      if (bad.length) return fail('用量里有无法识别的数字，请改正或清空');
      if (amountWithoutBasis) return fail('填写实付金额时请选择实付方式');
      if (!empty && !source) return fail('请选择数字来自哪里');
      const next = empty ? null : { ...usage, ...(paid ? { paid } : {}), source };
      const same = JSON.stringify(normal(next)) === JSON.stringify(normal(initial));
      return { usage: next, changed: !same };
    },
  };
}
const ORDER = ['input', 'cacheRead', 'cacheWrite', 'output', 'reasoning', 'requests', 'durationSec', 'paid', 'source'];
const normal = (usage) => (usage ? Object.fromEntries(ORDER.filter((key) => usage[key] != null).map((key) => [key, key === 'paid' ? { basis: usage.paid.basis, amount: usage.paid.amount, currency: usage.paid.amount == null ? undefined : usage.paid.currency } : usage[key]])) : null);

const path = (task, id) => `admin/works/${encodeURIComponent(task)}/${encodeURIComponent(id)}/usage`;
export const readUsage = (task, id) => api(path(task, id));
// Saves a read() result: a record replaces the old one, null removes it.
export const saveUsage = (task, id, usage) => (usage ? api(path(task, id), { method: 'PUT', body: usage }) : api(path(task, id), { method: 'DELETE' }));

// Loads a work's record into a bound block. True when the block may be saved: the record was read,
// or there is none (404). After any other failure the block stays empty and must not be saved, so an
// unread record is never overwritten.
export async function loadInto(entry, task, id) {
  try {
    const { usage } = await readUsage(task, id);
    entry.fill(usage, { baseline: true });
    entry.showMeta(usage);
    return true;
  } catch (error) {
    entry.fill(null, { baseline: true });
    if (error.status === 404) return true;
    toast(`用量没有读出：${error.message}`);
    return false;
  }
}

// The drawer's 「编辑」/「录入」: the block alone in a sheet.
export function openUsageSheet(work, { modelName } = {}) {
  void loadPricing();
  const sheet = openDialog({
    title: '生成用量',
    className: 'usage-sheet',
    body: `<form novalidate data-usage-form>${usageEntryHtml()}
      <div class="sheet-actions"><button class="btn" type="button" data-sheet-close>取消</button><button class="btn primary" type="submit">保存</button></div></form>`,
  });
  const form = $('[data-usage-form]', sheet.el);
  const entry = bindUsageEntry($('[data-usage-entry]', form), { modelOf: () => ({ id: work.model, name: modelName ?? work.modelName }) });
  let ready = false;
  void loadInto(entry, work.task, work.id).then((ok) => { ready = ok; $('[type="submit"]', form).disabled = !ok; });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!ready) return;
    const { usage, changed, error } = entry.read();
    if (error) return;
    if (!changed) { sheet.close(); return; }
    const button = $('[type="submit"]', form);
    button.disabled = true;
    try {
      await saveUsage(work.task, work.id, usage);
      sheet.close();
      toast(usage ? '用量已保存' : '用量记录已删除');
      await refreshPlatform('edit');
    } catch (err) {
      $('[data-usage-error]', form).textContent = err.message;
      button.disabled = false;
    }
  });
  return sheet;
}
