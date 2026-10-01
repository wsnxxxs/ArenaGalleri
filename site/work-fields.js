// The description of an upload, shared by the submit page and the author's edit dialog.
// Field names follow the API body of POST /api/works and PATCH /api/works/:task/:id.
import { $, $$, byName, esc } from './ui.js';
import { platform } from './platform.js';

const HARNESS_KINDS = [
  ['cli-agent', '命令行智能体'], ['ide', 'IDE'], ['desktop-app', '桌面应用'],
  ['web-chat', '网页对话'], ['api', 'API'], ['arena', '对战平台'], ['other', '其他'],
];
const GENERATION_MODES = [
  ['single-turn', '单轮对话：一次提示直接产出'],
  ['multi-turn', '多轮对话：来回交流后产出'],
  ['agent', '智能体执行：自主读写文件、运行命令'],
];
const INTERVENTIONS = [
  ['none', '只给了题目提示词，没有改代码'],
  ['prompt-guided', '追加过人工提示，但没有改代码'],
  ['code-edited', '人工改过代码'],
];

const option = (value, text, selected) => `<option value="${esc(value)}"${selected ? ' selected' : ''}>${esc(text)}</option>`;
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60e3).toISOString().slice(0, 10);

function modelOptions(ctx, selected) {
  const byVendor = new Map();
  for (const model of ctx.DATA.models) {
    if (!byVendor.has(model.vendor)) byVendor.set(model.vendor, []);
    byVendor.get(model.vendor).push(model);
  }
  return [...byVendor].sort(([a], [b]) => byName(a, b)).map(([vendor, models]) => `<optgroup label="${esc(vendor)}">${[...models].sort((a, b) => byName(a.name, b.name)).map((m) => option(m.id, m.name, m.id === selected)).join('')}</optgroup>`).join('');
}

function harnessOptions(ctx, selected) {
  const listed = [...ctx.HARNESSES.values()].filter((h) => h.listed || h.id === selected);
  return HARNESS_KINDS.map(([kind, label]) => {
    const entries = listed.filter((h) => h.kind === kind);
    return entries.length ? `<optgroup label="${label}">${entries.map((h) => option(h.id, h.name, h.id === selected)).join('')}</optgroup>` : '';
  }).join('');
}

function providerOptions(ctx, selected) {
  return [...ctx.PROVIDERS.values()].map((p) => option(p.id, p.name, p.id === selected)).join('');
}

// work is an existing upload when editing; its values prefill the form.
export function workFieldsHtml(ctx, task, work = null) {
  const w = work ?? {};
  const variants = task.promptVariants ?? [];
  const model = w.model && ctx.MODELS.has(w.model) ? w.model : w.modelName ? '__other' : '';
  const efforts = platform.site.efforts;
  const effort = !w.effort ? '' : efforts.includes(w.effort) ? w.effort : '__other';
  const harness = w.harness ?? (w.harnessName ? '__other' : '');
  const provider = ctx.providerOf(w)?.id ?? '';
  return `
    <label class="field"><span class="field-label">作品标题<i>*</i></span><input class="input" name="title" maxlength="40" required placeholder="例如：云山古刹" value="${esc(w.title ?? '')}"></label>
    <label class="field"><span class="field-label">简介</span><textarea class="input" name="summary" maxlength="200" rows="2" placeholder="一两句话介绍作品的看点">${esc(w.summary ?? '')}</textarea></label>
    ${variants.length ? `<label class="field"><span class="field-label">提示词版本<i>*</i></span><select class="input" name="promptVariant" required><option value="">选择生成时用的版本</option>${variants.map((v) => option(v.id, v.label, v.id === w.promptVariant)).join('')}</select><span class="field-hint">同一道题的不同版本。展厅会把同一模型的各版本结果合成一张卡片，访客可以切换对比。</span></label>` : ''}
    <div class="field-row">
      <label class="field"><span class="field-label">模型<i>*</i></span><select class="input" name="modelId" required><option value="">选择模型</option>${modelOptions(ctx, w.model)}${option('__other', '其他模型（手动填写）', model === '__other')}</select></label>
      <label class="field"><span class="field-label">推理档位</span><select class="input" name="effort"><option value="">默认 / 未设置</option>${efforts.map((e) => option(e, e, e === w.effort)).join('')}${option('__other', '其他…', effort === '__other')}</select></label>
    </div>
    <div class="field-row" data-other-model${model === '__other' ? '' : ' hidden'}>
      <label class="field"><span class="field-label">模型名称<i>*</i></span><input class="input" name="modelName" maxlength="60" placeholder="按官方写法，例如 GPT-6 Sol" value="${esc(model === '__other' ? w.modelName : '')}"></label>
      <label class="field"><span class="field-label">厂商</span><input class="input" name="vendor" maxlength="40" placeholder="例如 OpenAI"><span class="field-hint">未登记的模型，厂商会附在补充说明里供核验参考。</span></label>
    </div>
    <label class="field" data-other-effort${effort === '__other' ? '' : ' hidden'}><span class="field-label">档位名称</span><input class="input" name="effortOther" maxlength="20" placeholder="例如 Extra" value="${esc(effort === '__other' ? w.effort : '')}"></label>
    <label class="field"><span class="field-label">模型版本</span><input class="input" name="modelVersion" maxlength="60" placeholder="选填，例如 2026-09-15 快照" value="${esc(w.modelVersion ?? '')}"><span class="field-hint">模型页面或接口显示的具体版本；不清楚就留空。</span></label>
    <div class="field-row">
      <label class="field"><span class="field-label">Harness<i>*</i></span><select class="input" name="harnessId" required><option value="">选择 Harness</option>${harnessOptions(ctx, w.harness)}${option('__other', '其他（手动填写）', harness === '__other')}</select><span class="field-hint">用什么工具或环境生成，例如 Claude Code、Cursor、官方网页对话。</span></label>
      <label class="field"><span class="field-label">Harness 版本</span><input class="input" name="harnessVersion" maxlength="40" placeholder="选填，例如 2.1.3" value="${esc(w.harnessVersion ?? '')}"${harness ? '' : ' disabled'}><span class="field-hint">选择 Harness 后可填写，最多 40 字。</span></label>
    </div>
    <label class="field" data-other-harness${harness === '__other' ? '' : ' hidden'}><span class="field-label">其他 Harness<i>*</i></span><input class="input" name="harnessOther" maxlength="40" placeholder="填写工具或环境名称" value="${esc(harness === '__other' ? w.harnessName : '')}"></label>
    <label class="field"><span class="field-label">服务商</span><select class="input" name="providerId"><option value="">未注明</option>${providerOptions(ctx, provider)}</select><span class="field-hint">「官方」指模型厂商自己的 API、网页或 App，其他都选「非官方」。不确定就留「未注明」。</span></label>
    <div class="field-row">
      <label class="field"><span class="field-label">生成方式<i>*</i></span><select class="input" name="generationMode" required><option value="">请选择</option>${GENERATION_MODES.map(([value, text]) => option(value, text, value === w.generationMode)).join('')}</select></label>
      <label class="field"><span class="field-label">人工介入<i>*</i></span><select class="input" name="humanIntervention" required><option value="">请选择</option>${INTERVENTIONS.map(([value, text]) => option(value, text, value === w.humanIntervention)).join('')}</select></label>
    </div>
    <div class="field-row">
      <label class="field"><span class="field-label">生成日期</span><input class="input" type="date" name="generatedOn" max="${today()}" value="${esc(w.generatedOn ?? '')}"><span class="field-hint">模型实际产出作品的日期。</span></label>
      <label class="field"><span class="field-label">过程记录链接</span><input class="input" type="url" name="evidenceUrl" maxlength="2000" placeholder="https://…" value="${esc(w.evidenceUrl ?? '')}"><span class="field-hint">公开的对话分享或运行记录，核验会快很多。</span></label>
    </div>
    <label class="field"><span class="field-label">补充说明</span><textarea class="input" name="note" maxlength="1000" rows="3" placeholder="对话轮次、追加了哪些提示、改了哪些代码等。">${esc(w.note ?? '')}</textarea></label>`;
}

// Shows the "other" inputs that belong to the changed select.
export function onWorkFieldChange(form, target) {
  const toggle = { modelId: '[data-other-model]', effort: '[data-other-effort]', harnessId: '[data-other-harness]' }[target.name];
  if (!toggle) return;
  $(toggle, form).hidden = target.value !== '__other';
  if (target.name === 'harnessId') $('[name="harnessVersion"]', form).disabled = !target.value;
}

function fail(form, name, message) {
  const input = form.elements[name];
  input?.setAttribute('aria-invalid', 'true');
  input?.closest('.field')?.insertAdjacentHTML('beforeend', `<p class="form-error field-error">${esc(message)}</p>`);
  input?.focus();
  return { error: message };
}

// Checks the form and returns { body } for the API, or { error } after marking the field.
export function readWorkFields(form, task) {
  $$('.field-error', form).forEach((el) => el.remove());
  $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
  const data = Object.fromEntries(new FormData(form));
  const text = (name) => (data[name] ?? '').trim();
  const other = data.modelId === '__other';
  if (!text('title')) return fail(form, 'title', '请填写作品标题');
  if ((task.promptVariants ?? []).length && !data.promptVariant) return fail(form, 'promptVariant', '请选择生成时用的提示词版本');
  if (!data.modelId) return fail(form, 'modelId', '请选择模型');
  if (other && !text('modelName')) return fail(form, 'modelName', '请填写模型名称');
  if (!data.harnessId) return fail(form, 'harnessId', '请选择 Harness');
  if (data.harnessId === '__other' && !text('harnessOther')) return fail(form, 'harnessOther', '请填写 Harness 名称');
  if (!data.generationMode) return fail(form, 'generationMode', '请选择生成方式');
  if (!data.humanIntervention) return fail(form, 'humanIntervention', '请选择人工介入程度');
  if (text('evidenceUrl') && !/^https?:\/\//i.test(text('evidenceUrl'))) return fail(form, 'evidenceUrl', '请填写以 http:// 或 https:// 开头的链接');
  return { body: {
    title: text('title'),
    summary: data.summary ?? '',
    ...(data.promptVariant !== undefined ? { promptVariant: data.promptVariant } : {}),
    ...(other ? { modelName: text('modelName'), vendor: text('vendor') } : { modelId: data.modelId }),
    effort: data.effort === '__other' ? text('effortOther') : data.effort,
    modelVersion: text('modelVersion'),
    ...(data.harnessId === '__other' ? { harnessOther: text('harnessOther') } : { harnessId: data.harnessId }),
    harnessVersion: text('harnessVersion'),
    providerId: data.providerId,
    generationMode: data.generationMode,
    humanIntervention: data.humanIntervention,
    generatedOn: data.generatedOn ?? '',
    evidenceUrl: text('evidenceUrl'),
    note: data.note ?? '',
  } };
}
