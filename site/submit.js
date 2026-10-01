// Submitting to a fixed task (#/submit/<task>): 01 choose file → 02 trial load in the
// platform sandbox → 03 describe the work and submit. The staged draft runs from its own
// origin with a small probe that reports load time, errors and blocked requests.
import { $, $$, esc, formatBytes, formatTime, icon } from './ui.js';
import { api, needsEmail, platform, refreshPlatform, toast } from './platform.js';
import { createUploadRequest, resolveApiMedia } from './platform-api.js';
import { onWorkFieldChange, readWorkFields, workFieldsHtml } from './work-fields.js';
import { TEMPLATE_LABELS, templatesOf } from './categories.js';

const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-pointer-lock allow-downloads';
const VIEWS = { desktop: { width: 1440, height: 900, label: '桌面 1440×900' }, phone: { width: 390, height: 844, label: '手机 390×844' } };
const TRIAL_TIMEOUT = 30000;

// What each format's dropzone accepts: the picker filter, the name check and its message.
const FILES = {
  text: { accept: '.txt,.md,.markdown,text/plain,text/markdown', pattern: /\.(txt|md|markdown)$/i, prompt: '拖入 .txt 或 .md 文本文件', error: '文学作品请上传 .txt 或 .md 文本文件' },
  static: { accept: '.zip,.html,.htm,application/zip,text/html', pattern: /\.(zip|html?)$/i, prompt: '拖入 ZIP 压缩包或单个 HTML 文件', error: '请选择 .zip 压缩包或 .html 文件' },
  vite: { accept: '.zip,application/zip', pattern: /\.zip$/i, prompt: '拖入包含 dist/ 的 Vite 项目 ZIP', error: 'Vite 项目请上传包含 dist/ 的 ZIP 压缩包' },
};

const freshTrial = () => ({ booted: false, loaded: false, loadMs: null, errors: [], failed: [], blocked: [], paint: null, timedOut: false });

function checkRow({ state, label, detail }) {
  const mark = { ok: 'check', warn: 'alert', info: 'guide', fail: 'close', wait: 'clock' }[state] ?? 'clock';
  return `<li class="check is-${state}">${icon(mark)}<span><b>${esc(label)}</b>${esc(detail)}</span></li>`;
}

export function mount(root, ctx) {
  const tasks = ctx.DATA.tasks;
  const accepts = (t) => Boolean(platform.arena[t.id]?.uploads);
  const task = tasks.find((t) => t.id === ctx.param);
  if (!task || !accepts(task)) {
    root.innerHTML = `${ctx.pageStart({ title: '上传作品', section: 'questions', heading: task ? '这道题暂不接受作品' : '从一道题目开始', description: '每份作品都对应一道明确的题目。',
      crumbs: task ? [ctx.LIBRARY, { text: task.title, href: ctx.taskHref(task) }, { text: '上传作品' }] : [ctx.LIBRARY, { text: '上传作品' }],
      back: task ? { href: ctx.taskHref(task), text: '返回当前题目' } : null })}<section class="account-empty">${icon('grid')}<h2>${task ? '提示词原文尚未公开' : '请从题目内上传作品'}</h2><p>${task ? '待题目补充完整提示词后即可上传。' : '在题库中打开一道题，点击「上传作品」。'}</p><a class="btn primary" href="${task ? ctx.taskHref(task) : '#/questions'}">${task ? '返回题目' : '浏览题库'}</a></section>${ctx.pageEnd()}`;
    return {};
  }
  return uploadFlow(root, ctx, { task });
}

// The three upload steps, shared by uploading to a task and by publishing a new question
// together with its first result. options.task needs id, title, prompt and templates;
// the other options replace the page frame, the submit request and the finished view.
export function uploadFlow(root, ctx, options) {
  const { task } = options;
  const draftTask = options.draftTask ?? task.id;
  const offset = options.lead ? 1 : 0;
  const templates = templatesOf(task);
  const templateLabel = (value) => value === 'vite' ? 'Vite 静态网页（含 dist/）' : TEMPLATE_LABELS[value];
  let active = true;
  const state = {
    task, template: templates[0],
    progress: 0, uploading: false, draft: null, error: '',
    trial: freshTrial(), view: 'desktop', confirmed: false, cover: null,
    submitting: false, work: null, result: null, xhr: null, timer: 0,
    resumable: null, peek: task.promptVariants?.[0]?.id ?? null,
  };
  const moderated = () => Boolean(platform.site.contentModeration);

  const pendingFull = () => (platform.me?.pending ?? 0) >= (platform.site.limits.pendingPerUser ?? 5);

  function stepOne() {
    const taskLabel = options.lead ? '' : `<div class="upload-task"><span>当前题目 · 固定关联</span><a href="${ctx.taskHref(task)}">${esc(task.title)}${icon('arrow')}</a></div>`;
    if (!platform.user) {
      return `<div class="step-body">${taskLabel}<div class="notice">${icon('user')}<p>登录后上传到这道题，并在「个人中心」里跟进核验结果。</p><button class="btn primary sm" data-auth="login">登录 / 注册</button></div></div>`;
    }
    if (needsEmail()) {
      return `<div class="step-body">${taskLabel}<div class="notice">${icon('mail')}<p>账号需要先绑定邮箱，才能上传作品。</p><button class="btn primary sm" data-bind-email>绑定邮箱</button></div></div>`;
    }
    if (state.draft) {
      const d = state.draft;
      return `<div class="step-body">${taskLabel}
        <p class="file-line">${icon('file')}<b>${esc(d.sourceName)}</b><span>${d.files} 个文件 · ${formatBytes(d.bytes)} · ${esc(task.title)}</span></p>
        <ul class="checks">${d.checks.map(checkRow).join('')}</ul>
      </div>`;
    }
    return `<div class="step-body">${taskLabel}
      ${templates.length > 1 ? `<label class="field"><span class="field-label">提交格式</span><select class="input" data-template${state.uploading ? ' disabled' : ''}>${templates.map((value) => `<option value="${value}"${value === state.template ? ' selected' : ''}>${templateLabel(value)}</option>`).join('')}</select></label>` : `<p class="fine">提交格式：${templateLabel(state.template)}</p>`}
      ${options.lead ? '' : promptPeek()}
      ${state.resumable && !state.uploading ? `<div class="notice resume-draft">${icon('clock')}<p>你之前上传过「${esc(state.resumable.sourceName)}」，试加载保留到 ${esc(formatTime(state.resumable.expiresAt))}。</p><button class="btn primary sm" type="button" data-act="resume">继续试加载</button><button class="btn sm" type="button" data-act="drop-draft">丢弃</button></div>` : ''}
      ${pendingFull() ? `<div class="notice">${icon('clock')}<p>你已有 ${platform.me.pending} 件作品在等待核验。核验之后再上传新的作品吧。</p></div>` : `
      <div class="dropzone${task ? '' : ' is-disabled'}${state.uploading ? ' is-busy' : ''}" data-drop tabindex="${task ? 0 : -1}" role="button" aria-label="选择或拖入作品文件">
        ${state.uploading
          ? `<span class="progress"><i style="width:${Math.round(state.progress * 100)}%"></i></span><b>${state.progress < 1 ? `正在上传 ${Math.round(state.progress * 100)}%` : '正在检查文件…'}</b><span>请稍候，不要关闭页面</span>`
          : `${icon('upload')}<b>${FILES[state.template].prompt}</b><span>或点击选择 · 最大 ${formatBytes(platform.site.limits.uploadBytes)}</span>`}
        <input type="file" accept="${FILES[state.template].accept}" hidden>
      </div>`}
      ${state.error ? `<p class="form-error" role="alert">${esc(state.error)}</p>` : ''}
    </div>`;
  }

  function promptPeek() {
    const variants = task.promptVariants ?? [];
    const current = variants.find((v) => v.id === state.peek);
    return `<details class="prompt-peek"><summary>${icon('guide')}查看本题提示词 · 作品需按它生成${variants.length ? ` · 共 ${variants.length} 个版本，任选其一` : ''}</summary>
      ${variants.length ? `<div class="seg" role="group" aria-label="提示词版本">${variants.map((v) => `<button type="button" data-peek="${esc(v.id)}" aria-pressed="${v.id === state.peek}">${esc(v.label)}</button>`).join('')}</div>` : ''}
      <pre>${esc(current?.prompt ?? task.prompt)}</pre></details>`;
  }

  function trialChecks() {
    const t = state.trial;
    const rows = [];
    if (t.loaded) rows.push({ state: 'ok', label: '页面载入', detail: `${(t.loadMs / 1000).toFixed(1)} 秒内完成载入` });
    else if (t.timedOut) rows.push({ state: 'fail', label: '页面载入', detail: '30 秒内没有完成载入。请检查作品后重新上传，或在新窗口中确认。' });
    else rows.push({ state: 'wait', label: '页面载入', detail: '正在载入…' });
    rows.push(t.errors.length
      ? { state: 'warn', label: '脚本错误', detail: `捕获到 ${t.errors.length} 条：${t.errors[0]}` }
      : { state: t.loaded ? 'ok' : 'wait', label: '脚本错误', detail: t.loaded ? '没有捕获到错误' : '等待载入完成' });
    rows.push(t.failed.length
      ? { state: 'warn', label: '资源加载', detail: `${t.failed.length} 个文件载入失败：${t.failed[0]}` }
      : { state: t.loaded ? 'ok' : 'wait', label: '资源加载', detail: t.loaded ? '引用的文件都已载入' : '等待载入完成' });
    rows.push(t.blocked.length
      ? { state: 'warn', label: '外部请求', detail: `拦截了 ${t.blocked.length} 个外部请求：${[...new Set(t.blocked.map((url) => { try { return new URL(url).host; } catch { return url; } }))].slice(0, 3).join('、')}` }
      : { state: t.loaded ? 'ok' : 'wait', label: '外部请求', detail: t.loaded ? '没有被拦截的外部请求' : '等待载入完成' });
    if (t.paint) {
      const drawn = t.paint.canvases || t.paint.media || t.paint.words > 20;
      rows.push(drawn
        ? { state: 'ok', label: '画面内容', detail: t.paint.canvases ? `检测到 ${t.paint.canvases} 个正在显示的画布` : '页面上有可见内容' }
        : { state: 'warn', label: '画面内容', detail: '页面看起来是空白的，请在上方确认' });
    } else rows.push({ state: 'wait', label: '画面内容', detail: '载入后检查' });
    return rows.map(checkRow).join('');
  }

  const confirmText = () => {
    const t = state.trial;
    const warned = t.errors.length || t.failed.length || t.blocked.length || state.draft?.checks.some((c) => c.state === 'warn');
    return `我已在上方体验了作品，确认它加载正常、与题目相符${warned ? '，也看过了上面的提示' : ''}`;
  };

  function stepTwo() {
    if (!state.draft) return '<p class="step-placeholder">选好文件后，作品会在这里试运行。</p>';
    const view = VIEWS[state.view];
    const settled = state.trial.loaded || state.trial.timedOut;
    return `<div class="step-body">
      <div class="trial">
        <div class="trial-bar">
          <div class="seg" role="group" aria-label="试加载尺寸">${Object.entries(VIEWS).map(([id, v]) => `<button data-view="${id}" aria-pressed="${id === state.view}">${icon(id)}${v.label}</button>`).join('')}</div>
          <span class="trial-note">与正式展示相同的沙盒</span>
          <button class="icon-btn" data-act="reload" title="重新载入" aria-label="重新载入">${icon('reload')}</button>
          <a class="icon-btn" href="${esc(state.draft.preview)}" target="_blank" rel="noopener" title="在新窗口打开" aria-label="在新窗口打开">${icon('arrow')}</a>
        </div>
        <div class="trial-stage" data-trial-stage style="--w:${view.width};--h:${view.height}">
          <div class="trial-frame"><iframe src="${esc(state.draft.preview)}" title="试加载" sandbox="${SANDBOX}" allow="fullscreen; autoplay" allowfullscreen referrerpolicy="no-referrer"></iframe></div>
        </div>
      </div>
      <ul class="checks" data-trial-checks>${trialChecks()}</ul>
      <label class="confirm${settled && state.trial.loaded ? '' : ' is-disabled'}"><input type="checkbox" data-confirm${state.confirmed ? ' checked' : ''}${state.trial.loaded ? '' : ' disabled'}>
        <span data-confirm-text>${confirmText()}</span></label>
    </div>`;
  }

  const coverPick = () => `<div class="cover-pick">${state.cover
    ? `<img src="${esc(state.cover)}" alt="封面预览"><button class="link" type="button" data-act="drop-cover">移除</button>`
    : `<button class="btn sm" type="button" data-act="pick-cover">${icon('image')}选择图片</button>`}<input type="file" accept="image/png,image/jpeg,image/webp" hidden data-cover-input></div>`;

  function stepThree() {
    if (!state.confirmed) return '<p class="step-placeholder">确认试加载结果后，在这里填写作品信息。</p>';
    return `<form class="step-body submit-form" novalidate>
      ${workFieldsHtml(ctx, task)}
      <div class="field"><span class="field-label">封面图片</span>
        ${coverPick()}
        <p class="field-hint">选填，PNG / JPEG / WebP，不超过 ${formatBytes(platform.site.limits.coverBytes)}。${platform.site.capture ? '提交后平台还会自动截取桌面与手机首屏，用作统一截图。' : '不上传时，展厅显示文字封面。'}</p>
      </div>
      <label class="confirm"><input type="checkbox" name="attest" required><span>我确认作品由所选模型按本题提示词生成，人工介入情况如实填写。我有权提交该作品，并同意<a href="#/terms" target="_blank" rel="noopener">《使用条款》</a>与<a href="#/privacy" target="_blank" rel="noopener">《隐私政策》</a>。</span></label>
      <p class="form-error" role="alert"></p>
      <div class="form-actions"><button class="btn primary" type="submit">${icon('upload')}${options.submitLabel ?? '提交作品'}</button><span class="fine">${options.submitNote ?? `${moderated() ? '提交后先做内容审核，通过后公开为「未验证」。' : '提交后公开为「未验证」，可以被浏览和贴表情。'}核验前可以在个人中心修改信息。`}</span></div>
    </form>`;
  }

  function done() {
    if (options.done) return options.done(state.result);
    const w = state.work;
    const pending = ['pending', 'review'].includes(w.moderation?.status);
    return `<section class="submit-done">
      <p class="kicker"><span class="num">已提交</span><span>${pending ? '内容审核中' : '未验证'}</span></p>
      <h2>「${esc(w.title)}」${pending ? '正在做内容审核' : '已经进入展厅'}</h2>
      <p>${pending
        ? '审核通常几分钟内完成。通过之前只有你能看到它，结果会显示在「个人中心 · 我的作品」。通过后它会出现在题目页，所有人都可以浏览、贴表情。'
        : '现在所有人都可以浏览它、给它贴表情。'}管理员核对生成信息后会把它标为已验证并排在前面，是否加入盲评由管理员决定；如果核验存疑，你会在个人中心看到原因。核验之前，你可以随时修改作品信息或删除它。</p>
      <div class="actions">${pending
        ? `<a class="btn primary" href="#/me/works">查看审核进度${icon('right')}</a><a class="btn" href="${esc(w.scene)}" target="_blank" rel="noopener">预览作品${icon('arrow')}</a>`
        : `<a class="btn primary" href="#/${esc(w.task)}/${esc(w.id)}">在展厅中查看${icon('right')}</a><a class="btn" href="#/me/works">我的作品</a>`}<button class="btn" data-act="another">再上传一件</button></div>
    </section>`;
  }

  const step = (n, title, note, body, { locked = false, doneStep = false, action = '' } = {}) => `<section class="step${locked ? ' is-locked' : ''}${doneStep ? ' is-done' : ''}" data-step="${n}">
    <header class="step-head"><span class="num">0${n + offset}</span><h2>${title}</h2>${note ? `<p>${note}</p>` : ''}${action}</header>
    ${body}
  </section>`;

  function draw() {
    if (!active) return;
    const limits = platform.site.limits;
    const page = options.page?.(Boolean(state.result)) ?? { title: '上传作品', section: 'questions', heading: state.result ? '作品已提交' : '带来你的答案',
      description: task.title,
      crumbs: [ctx.LIBRARY, { text: task.title, href: ctx.taskHref(task) }, { text: '上传作品' }],
      back: { href: ctx.taskHref(task), text: '返回当前题目' } };
    const current = !state.draft ? 0 : state.confirmed ? 2 : 1;
    const steps = [...(options.lead ? [options.lead.label] : []), '选择文件', '试加载', options.infoLabel ?? '作品信息'];
    root.innerHTML = `${ctx.pageStart({ ...page,
      meta: `<ol class="side-steps">${steps.map((label, i) => `<li${i === current + offset ? ' aria-current="step"' : ''}><span>0${i + 1}</span>${label}</li>`).join('')}</ol>` })}
      <section class="block wrap submit-layout">
        <div class="submit-main">${state.result ? done() : [
          options.lead?.html() ?? '',
          step(1, '选择文件', options.fileNote ?? '作品将上传到当前题目', stepOne(), { doneStep: Boolean(state.draft), action: state.draft ? '<button class="link step-action" data-act="restart">重新选择文件</button>' : '' }),
          step(2, '试加载', '作品在与正式展示相同的沙盒中运行，请亲自操作一遍', stepTwo(), { locked: !state.draft, doneStep: state.confirmed }),
          step(3, options.infoLabel ?? '作品信息', '核验时会对照这些信息', stepThree(), { locked: !state.confirmed }),
        ].join('')}</div>
        <aside class="submit-aside">
          <div class="aside-block">
            <h3>之后会发生什么</h3>
            <ol class="timeline">${options.timeline ?? `
              ${moderated() ? '<li><b>内容审核</b><span>提交后先自动检查页面内容，通常几分钟。通过前只有你能看到。</span></li>' : ''}
              <li><b>未验证</b><span>${moderated() ? '审核通过后' : '提交后立即'}出现在题目页，可以被浏览、贴表情；这时你仍可修改作品信息。</span></li>
              <li><b>已验证</b><span>管理员核对作品与生成信息后通过，排在前面；由管理员决定是否加入盲评、计入榜单。</span></li>
              <li><b>存疑</b><span>无法核实时标记存疑并写明原因：作品保留作参考，不再接受互动；你可以删除它。</span></li>`}
            </ol>
          </div>
          <div class="aside-block">
            <h3>文件要求</h3>
            <ul class="plain">${templates.includes('text') ? `
              <li>上传一个 UTF-8 编码的 <code>.txt</code> 或 <code>.md</code> 文件，内容为模型生成的原文。</li>
              <li>Markdown 支持标题、段落、列表、引用、强调与代码；HTML 标签、链接和图片都按原文字显示。</li>
              <li>平台按统一版式排版，预览、盲评与截图都使用排版后的页面。</li>` : `
              <li>ZIP 根目录（或 <code>dist/</code>）有 <code>index.html</code>；也可以直接上传单个 HTML 文件。</li>
              <li>Vite 等需要构建的项目，请先运行构建，把 <code>dist/</code> 一起打包；平台不会执行构建脚本。</li>
              <li><code>node_modules</code>、<code>.git</code> 会被自动忽略，但仍计入压缩包大小，建议打包前移除；<code>.env</code> 等密钥文件会被拒绝。</li>
              <li>作品不能访问外部网络。可以引用的公共 CDN：${platform.site.cdn.map((host) => `<code>${esc(host)}</code>`).join('、')}。</li>`}
            </ul>
          </div>
          <div class="aside-block">
            <h3>限制</h3>
            <ul class="plain"><li>${templates.includes('text') ? `文件不超过 ${formatBytes(limits.uploadBytes)}，最多 20 万字符。` : `压缩包不超过 ${formatBytes(limits.uploadBytes)}，解压后不超过 150 MB，最多 2000 个文件。`}</li><li>每人最多 ${limits.pendingPerUser} 件作品同时等待核验。</li></ul>
          </div>
        </aside>
      </section>
    ${ctx.pageEnd()}`;
    document.title = `${page.title} · ${task.title || ctx.DATA.title}`;
    fitTrial();
  }

  // The trial frame renders at the real viewport size and is scaled to fit the column.
  let resizeObserver = null;
  function fitTrial() {
    resizeObserver?.disconnect();
    const stage = $('[data-trial-stage]', root);
    if (!stage) return;
    const view = VIEWS[state.view];
    const fit = () => {
      const width = stage.clientWidth;
      const maxHeight = state.view === 'phone' ? Math.min(680, innerHeight * 0.75) : Infinity;
      const scale = Math.min(width / view.width, maxHeight / view.height, 1);
      stage.style.setProperty('--scale', scale);
      stage.style.height = `${Math.round(view.height * scale)}px`;
    };
    resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(stage);
    fit();
  }

  function drawTrial() {
    const list = $('[data-trial-checks]', root);
    if (!list) return;
    list.innerHTML = trialChecks();
    const box = $('[data-confirm]', root);
    if (box) {
      box.disabled = !state.trial.loaded;
      box.closest('.confirm').classList.toggle('is-disabled', !state.trial.loaded);
      $('[data-confirm-text]', root).textContent = confirmText();
    }
  }

  function startTrial() {
    state.trial = freshTrial();
    clearTimeout(state.timer);
    state.timer = setTimeout(() => { if (!state.trial.loaded) { state.trial.timedOut = true; drawTrial(); } }, TRIAL_TIMEOUT);
  }

  const onMessage = (e) => {
    if (!state.draft || e.data?.source !== 'sp-probe' || e.origin !== new URL(state.draft.preview).origin) return;
    const t = state.trial;
    const d = e.data;
    if (d.type === 'boot') t.booted = true;
    else if (d.type === 'load') { t.loaded = true; t.loadMs = d.at; }
    else if (d.type === 'error' || d.type === 'console') t.errors.push(d.where ? `${d.message}（${d.where}）` : d.message);
    else if (d.type === 'resource') t.failed.push(d.url);
    else if (d.type === 'blocked') t.blocked.push(d.url);
    else if (d.type === 'paint') t.paint = { canvases: d.canvases, media: d.media, words: d.words };
    drawTrial();
  };
  addEventListener('message', onMessage);

  function upload(file) {
    if (!file || state.uploading) return;
    if (file.size > platform.site.limits.uploadBytes) { state.error = `文件超过 ${formatBytes(platform.site.limits.uploadBytes)} 上限`; return draw(); }
    if (!FILES[state.template].pattern.test(file.name)) { state.error = FILES[state.template].error; return draw(); }
    Object.assign(state, { uploading: true, progress: 0, error: '' });
    draw();
    const xhr = createUploadRequest(`drafts?task=${encodeURIComponent(draftTask)}&name=${encodeURIComponent(file.name)}&template=${state.template}`);
    state.xhr = xhr;
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      state.progress = e.loaded / e.total;
      const bar = $('.dropzone .progress i', root);
      if (bar) {
        bar.style.width = `${Math.round(state.progress * 100)}%`;
        $('.dropzone b', root).textContent = state.progress < 1 ? `正在上传 ${Math.round(state.progress * 100)}%` : '正在检查文件…';
      }
    };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      state.uploading = false;
      state.xhr = null;
      if (xhr.status === 200 && data.draft) {
        state.draft = resolveApiMedia(data.draft, 'draft');
        startTrial();
      } else {
        state.error = data.error ?? `上传失败（${xhr.status}）`;
      }
      draw();
    };
    xhr.onerror = () => {
      Object.assign(state, { uploading: false, xhr: null, error: '网络连接失败，请重试' });
      draw();
    };
    xhr.send(file);
  }

  function discard() {
    if (state.draft && !state.result) api(`drafts/${state.draft.id}`, { method: 'DELETE' }).catch(() => {});
  }

  function restart() {
    discard();
    clearTimeout(state.timer);
    Object.assign(state, { draft: null, error: '', trial: freshTrial(), confirmed: false, cover: null, work: null, result: null });
    draw();
  }

  function trialSummary() {
    const t = state.trial;
    return {
      loaded: t.loaded,
      loadMs: t.loadMs,
      errors: t.errors.length,
      errorSamples: t.errors.slice(0, 3),
      failedResources: t.failed.slice(0, 5),
      blocked: t.blocked.slice(0, 5),
      canvases: t.paint?.canvases ?? null,
      media: t.paint?.media ?? null,
      words: t.paint?.words ?? null,
    };
  }

  async function submit(form) {
    const error = $('.form-error:not(.field-error)', form);
    error.textContent = '';
    const { body, error: problem } = readWorkFields(form, task);
    if (!body) return void (error.textContent = problem);
    if (!form.attest.checked) return void (error.textContent = '请勾选确认生成信息真实');
    const button = $('[type="submit"]', form);
    button.disabled = true;
    try {
      const payload = { ...body, draftId: state.draft.id, confirmed: true, cover: state.cover, trial: trialSummary() };
      const result = options.submit ? await options.submit(payload) : await api('works', { method: 'POST', body: payload });
      Object.assign(state, { result, work: result.work });
      clearTimeout(state.timer);
      if (!options.submit) toast(['pending', 'review'].includes(result.work.moderation?.status) ? '作品已提交，正在做内容审核' : '作品已提交，等待核验');
      await refreshPlatform('upload');
      if (!active) return;
      draw();
      scrollTo({ top: 0 });
    } catch (e) {
      error.textContent = e.message;
      button.disabled = false;
    }
  }

  // A draft survives leaving the page for its 24-hour lifetime; offer to pick it up again.
  async function findDraft() {
    if (!platform.user) return;
    try {
      const { draft } = await api(`drafts?task=${encodeURIComponent(draftTask)}`);
      if (active && draft && !state.draft && !state.uploading) { state.resumable = draft; draw(); }
    } catch { /* an older API has no draft lookup */ }
  }

  root.onclick = (e) => {
    if (e.target.matches('input[type="file"]')) return;
    const drop = e.target.closest('[data-drop]');
    if (drop && !state.uploading) { $('input[type="file"]', drop).click(); return; }
    const view = e.target.closest('[data-view]');
    if (view && view.dataset.view !== state.view) {
      state.view = view.dataset.view;
      const stage = $('[data-trial-stage]', root);
      stage.style.setProperty('--w', VIEWS[state.view].width);
      stage.style.setProperty('--h', VIEWS[state.view].height);
      $$('[data-view]', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
      fitTrial();
      return;
    }
    const peek = e.target.closest('[data-peek]');
    if (peek) {
      state.peek = peek.dataset.peek;
      $$('[data-peek]', root).forEach((b) => b.setAttribute('aria-pressed', String(b === peek)));
      $('.prompt-peek pre', root).textContent = task.promptVariants.find((v) => v.id === state.peek).prompt;
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'resume') {
      Object.assign(state, { draft: resolveApiMedia(state.resumable, 'draft'), resumable: null, error: '' });
      startTrial();
      draw();
    } else if (act === 'drop-draft') {
      api(`drafts/${state.resumable.id}`, { method: 'DELETE' }).catch(() => {});
      state.resumable = null;
      draw();
    } else if (act === 'restart') restart();
    else if (act === 'another') restart();
    else if (act === 'reload') { startTrial(); drawTrial(); const frame = $('.trial iframe', root); frame.src = state.draft.preview; }
    else if (act === 'pick-cover') $('[data-cover-input]', root).click();
    else if (act === 'drop-cover') { state.cover = null; $('.cover-pick', root).outerHTML = coverPick(); }
    else if (act) options.onAct?.(act);
  };
  root.onkeydown = (e) => {
    const drop = e.target.closest?.('[data-drop]');
    if (drop && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); drop.click(); }
  };
  root.onchange = (e) => {
    if (e.target.matches('[data-template]')) {
      state.template = e.target.value;
      state.error = '';
      return draw();
    }
    if (e.target.matches('.dropzone input[type="file"]')) return upload(e.target.files[0]);
    if (e.target.matches('[data-confirm]')) {
      state.confirmed = e.target.checked;
      const three = $('[data-step="3"]', root);
      three.outerHTML = step(3, options.infoLabel ?? '作品信息', '核验时会对照这些信息', stepThree(), { locked: !state.confirmed });
      $('[data-step="2"]', root).classList.toggle('is-done', state.confirmed);
      $$('.side-steps li', root).forEach((li, i) => (i === (state.confirmed ? 2 : 1) + offset ? li.setAttribute('aria-current', 'step') : li.removeAttribute('aria-current')));
      if (state.confirmed) $('[data-step="3"]', root).scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const form = e.target.closest('.submit-form');
    if (form) onWorkFieldChange(form, e.target);
    if (e.target.matches('[data-cover-input]')) {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > platform.site.limits.coverBytes) return toast(`封面不能超过 ${formatBytes(platform.site.limits.coverBytes)}`);
      const reader = new FileReader();
      reader.onload = () => { if (active) { state.cover = reader.result; $('.cover-pick', root).outerHTML = coverPick(); } };
      reader.readAsDataURL(file);
    }
  };
  root.onsubmit = (e) => {
    if (!e.target.matches('.submit-form')) return;
    e.preventDefault();
    submit(e.target);
  };
  const onDrag = (e) => {
    const drop = e.target.closest?.('[data-drop]');
    if (!drop) return;
    e.preventDefault();
    drop.classList.toggle('is-over', e.type === 'dragover');
    if (e.type === 'drop') upload(e.dataTransfer.files[0]);
  };
  for (const type of ['dragover', 'dragleave', 'drop']) root.addEventListener(type, onDrag);

  draw();
  findDraft();
  return {
    onPlatformChange(reason) {
      if (reason === 'upload') return;
      if (!platform.user) restart();
      else { draw(); findDraft(); }
    },
    destroy() {
      active = false;
      state.xhr?.abort();
      clearTimeout(state.timer);
      resizeObserver?.disconnect();
      removeEventListener('message', onMessage);
      for (const type of ['dragover', 'dragleave', 'drop']) root.removeEventListener(type, onDrag);
      root.onkeydown = null;
      root.onsubmit = null;
    },
  };
}
