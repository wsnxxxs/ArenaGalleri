// Publish a question: 01 describe it (title / summary / category / tags / prompt / formats), then either
// submit it alone or attach an optional first result through the shared upload steps. The
// question waits for an admin; an attached result also goes through content moderation.
import { $, $$, esc, icon } from './ui.js';
import { api, platform, refreshPlatform, requireUser, toast } from './platform.js';
import { contentStage, moderated, stageTrack, uploadFlow } from './submit.js';
import { CATEGORIES, TEMPLATE_LABELS, categoryOf, tagsOf } from './categories.js';

const normalize = (name) => String(name).normalize('NFKC').trim().replace(/^#+/, '').trim();
const CATEGORY_NOTES = { 文学: '故事、诗歌、文案', 静态网页: '页面与前端交互', 建模: '三维场景与模型' };
// Drafts staged for a question that does not exist yet.
const NEW_QUESTION = '__new__';
const blank = () => ({ title: '', summary: '', category: '', prompt: '', tags: [], templates: [] });
const sideSteps = (current) => `<ol class="side-steps">${['题目信息', '选择文件', '试加载', '结果信息']
  .map((label, i) => `<li${i === current ? ' aria-current="step"' : ''}><span>0${i + 1}</span>${label}</li>`).join('')}</ol>`;

export function mount(root, ctx) {
  const existing = [...new Set(ctx.DATA.tasks.flatMap(tagsOf))].filter((tag) => !categoryOf(tag));
  let question = blank();
  let flow = null, active = true;

  // Formats follow the category: a text question takes text only; web and 3D questions choose.
  function formatField() {
    const category = categoryOf(question.category);
    if (!category) return '<span class="field-label">允许的提交格式 *</span><p class="fine">选择题目分类后显示可用格式。</p>';
    const [only] = category.templates;
    if (category.templates.length === 1) return `<span class="field-label">提交格式</span><input type="hidden" name="templates" value="${only}"><p class="format-fixed">${esc(TEMPLATE_LABELS[only])}</p><p class="fine">${only === 'text' ? '上传 .txt 或 .md 文件，站内按统一版式展示。' : ''}</p>`;
    return `<span class="field-label">允许的提交格式 *</span><div class="format-options">
      ${category.templates.map((value) => `<label><input type="checkbox" name="templates" value="${value}"${question.templates.includes(value) ? ' checked' : ''}>${TEMPLATE_LABELS[value]}</label>`).join('')}
    </div><p class="fine">Vite 项目需要包含构建后的 dist/ 目录。</p>`;
  }

  function showForm() {
    flow?.destroy();
    flow = null;
    const tags = [...question.tags];
    root.innerHTML = `${ctx.pageStart({ title: '发起题目', section: 'new', heading: '让每份答案，从同一题开始',
      description: '写清要测试的能力，提供完整提示词；也可以附上一份模型结果展示它的效果。', meta: sideSteps(0) })}
      <section class="block wrap publish-layout">
        <form class="publish-form" novalidate>
          <div class="notice publish-auth" data-publish-auth${platform.user ? ' hidden' : ''}>${icon('user')}<p>登录后即可发起题目，已填写的内容会保留。</p><button class="btn sm" type="button" data-auth="login">登录 / 注册</button></div>
          <label class="field"><span class="field-label">题目标题 *</span><input class="input" name="title" required maxlength="70" placeholder="例如：体素中国古典建筑群" value="${esc(question.title)}"></label>
          <label class="field"><span class="field-label">测试简述 *</span><textarea class="input" name="summary" required maxlength="400" rows="3" placeholder="需要完成什么？能测出模型的哪些能力？">${esc(question.summary)}</textarea></label>
          <fieldset class="field"><legend class="field-label">题目分类 *</legend><div class="category-options">
            ${CATEGORIES.map((c) => `<label class="category-option"><input type="radio" name="category" value="${esc(c.name)}"${c.name === question.category ? ' checked' : ''}>${icon(c.glyph)}<span><b>${esc(c.name)}</b><small>${esc(CATEGORY_NOTES[c.name])}</small></span></label>`).join('')}
          </div><p class="fine">分类决定这道题在题库、排行榜中的位置，以及作品的提交格式。</p></fieldset>
          <div class="field"><label class="field-label" for="question-tag">题目标签<small>选填</small></label>
            <div class="tag-input-row"><input class="input" id="question-tag" maxlength="24" placeholder="选择或创建标签，按 Enter 添加"><button class="btn" type="button" data-add-tag>添加</button></div>
            <div class="tag-editor" aria-label="已选择的标签"></div>
            <div class="tag-suggestions" aria-label="已有标签">${existing.map((tag) => `<button type="button" data-suggest-tag="${esc(tag)}">#${esc(tag)}</button>`).join('')}</div>
            <p class="fine">最多 6 个，补充技术栈或主题，例如 Three.js、产品展示；不必重复分类。</p>
          </div>
          <label class="field"><span class="field-label">完整提示词 *</span><textarea class="input" name="prompt" required maxlength="20000" rows="12" placeholder="粘贴所有参与模型需要使用的同一份完整提示词。">${esc(question.prompt)}</textarea></label>
          <div class="field" data-formats>${formatField()}</div>
          <p class="form-error" role="alert"></p>
          <div class="form-actions"><button class="btn primary" type="submit" value="plain">提交题目</button><button class="btn" type="submit" value="sample">附上示例结果（选填）${icon('right')}</button><a class="btn" href="#/questions">取消</a><span class="fine">发起即表示你同意<a href="#/terms" target="_blank" rel="noopener">《使用条款》</a>与<a href="#/privacy" target="_blank" rel="noopener">《隐私政策》</a>。</span></div>
        </form>
        <aside class="publish-note"><h3>一道可比较的题目</h3><p>简述说明测试目标。<br>分类决定题目归属与提交格式。<br>提示词作为所有作品的共同依据。</p><p>可以选择附上一份用这份提示词生成的模型结果，让管理员和大家更快看到它能做出什么。</p><p>题目由管理员人工审核，示例结果另做内容审核；通过前只有你能看到。测试文字、灌水或广告不会通过。</p></aside>
      </section>${ctx.pageEnd()}`;
    document.title = `发起题目 · ${ctx.DATA.title}`;
    const form = $('.publish-form', root);
    const error = $('.form-error', form);
    const tagInput = $('#question-tag', form);
    const paintTags = () => {
      $('.tag-editor', form).innerHTML = tags.map((tag, index) => `<button class="chip" type="button" data-remove-tag="${index}" aria-label="移除标签 ${esc(tag)}">#${esc(tag)}${icon('close')}</button>`).join('');
      $$('[data-suggest-tag]', form).forEach((button) => { button.disabled = tags.includes(button.dataset.suggestTag); });
    };
    function addTag(raw) {
      const name = normalize(raw);
      if (!name) return false;
      if (name.length > 24 || /[<>{}\n\r,，]/.test(name)) { error.textContent = '标签为 1–24 字，不能包含特殊符号'; return false; }
      const tag = existing.find((item) => item.toLowerCase() === name.toLowerCase()) ?? name;
      if (tags.some((item) => item.toLowerCase() === tag.toLowerCase())) { tagInput.value = ''; return true; }
      if (tags.length >= 6) { error.textContent = '每道题最多添加 6 个标签'; return false; }
      tags.push(tag);
      tagInput.value = '';
      error.textContent = '';
      paintTags();
      return true;
    }
    paintTags();
    root.onchange = (event) => {
      if (!event.target.matches('[name="category"]')) return;
      question.category = event.target.value;
      question.templates = [...categoryOf(question.category).templates];
      $('[data-formats]', form).innerHTML = formatField();
      error.textContent = '';
    };
    root.onclick = (event) => {
      if (event.target.closest('[data-add-tag]')) addTag(tagInput.value);
      const suggestion = event.target.closest('[data-suggest-tag]');
      if (suggestion) addTag(suggestion.dataset.suggestTag);
      const remove = event.target.closest('[data-remove-tag]');
      if (remove) { tags.splice(Number(remove.dataset.removeTag), 1); paintTags(); }
    };
    root.onkeydown = (event) => {
      if (event.target === tagInput && ['Enter', ',', '，'].includes(event.key)) { event.preventDefault(); addTag(tagInput.value); }
    };
    root.onsubmit = async (event) => {
      if (event.target !== form) return;
      event.preventDefault();
      error.textContent = '';
      if (tagInput.value.trim() && !addTag(tagInput.value)) return;
      const data = new FormData(form);
      for (const [name, label] of [['title', '题目标题'], ['summary', '测试简述'], ['prompt', '完整提示词']]) {
        if (!String(data.get(name)).trim()) { error.textContent = `请填写${label}`; $(`[name="${name}"]`, form).focus(); return; }
      }
      if (!categoryOf(data.get('category'))) { error.textContent = '请选择题目分类'; $('[name="category"]', form).focus(); return; }
      if (!data.getAll('templates').length) { error.textContent = '请至少选择一种提交格式'; return; }
      question = { title: String(data.get('title')).trim(), summary: String(data.get('summary')).trim(), category: String(data.get('category')), prompt: String(data.get('prompt')).trim(),
        tags: [...tags], templates: data.getAll('templates') };
      if (!(await requireUser('登录后即可发起题目')) || !active) return;
      if (event.submitter?.value === 'sample') { showUpload(); scrollTo({ top: 0 }); return; }
      const buttons = $$('button[type="submit"]', form);
      buttons.forEach((button) => { button.disabled = true; });
      try {
        const result = await api('questions', { method: 'POST', body: question });
        toast('题目已提交，等待人工审核');
        await refreshPlatform('question');
        if (active) showDone(result);
      } catch (err) {
        error.textContent = err.message;
        buttons.forEach((button) => { button.disabled = false; });
      }
    };
  }

  function brief() {
    return `<section class="step is-done" data-step="0">
      <header class="step-head"><span class="num">01</span><h2>题目信息</h2><p>管理员会对照这些内容人工审核</p><button class="link step-action" type="button" data-act="edit-question">修改题目</button></header>
      <div class="step-body question-brief">
        <h3>${esc(question.title)}</h3>
        <p>${esc(question.summary)}</p>
        <p class="work-meta">${[esc(question.category), ...question.tags.map((tag) => `#${esc(tag)}`), question.templates.map((t) => TEMPLATE_LABELS[t]).join(' / ')].join(' · ')}</p>
        <details class="prompt-peek"><summary>${icon('guide')}完整提示词 · 示例结果需按它生成</summary><pre>${esc(question.prompt)}</pre></details>
      </div>
    </section>`;
  }

  // A question always waits for a person; its sample result is moderated alongside it.
  function questionStages(work) {
    const status = work?.moderation?.status;
    const sample = !work ? null : status === 'rejected' ? '未通过内容审核，不会展示'
      : status === 'review' ? '等待人工复核' : status === 'pending' ? contentStage()[1] : '已通过';
    return [['题目审核', '管理员人工审核，通过前仅你可见'], ...(sample ? [['示例结果', sample]] : []),
      ['进入题库', work ? '示例结果作为第一份作品展示' : '其他人可以上传各自的结果']];
  }
  function done({ question: saved, work }) {
    const q = saved.moderation?.status ?? 'pending';
    const sampleWaiting = work && ['pending', 'review'].includes(work.moderation?.status);
    const passed = ['approved', 'legacy'].includes(q);
    const current = !passed ? 0 : sampleWaiting ? 1 : -1;
    const view = q === 'rejected'
      ? ['未通过', `「${saved.title}」没有通过审核`, '题目不会公开。可以在「我的题目」删除后修改，再重新发起。']
      : !passed ? ['等待人工审核', `「${saved.title}」已提交审核`, work ? '管理员审核题目的同时，示例结果做内容审核。通过前只有你能看到，这一页会自动更新。' : '管理员审核通过后，题目进入题库并开放投稿。']
      : sampleWaiting ? ['题目已通过', `「${saved.title}」已进入题库`, '示例结果还在内容审核，通过后作为第一份作品展示。']
      : ['已公开', `「${saved.title}」已进入题库`, '其他人现在可以上传各自模型的结果。'];
    const reason = q === 'rejected' && saved.moderation?.reason ? `<p class="result-reason">${icon('alert')}<span>原因：${esc(saved.moderation.reason)}</span></p>` : '';
    const stages = questionStages(work);
    return `<section class="submit-done">
      <p class="kicker"><span class="num">已提交</span><span>${view[0]}</span></p>
      <h2>${esc(view[1])}</h2><p>${view[2]}</p>${reason}
      ${q === 'rejected' ? '' : stageTrack(stages, current < 0 ? stages.length - 1 : current, { row: true })}
      <div class="actions"><a class="btn primary" href="#/me/questions">查看我的题目${icon('right')}</a>${work?.scene && q !== 'rejected' ? `<a class="btn" href="${esc(work.scene)}" target="_blank" rel="noopener">预览示例结果${icon('arrow')}</a>` : ''}<button class="btn" type="button" data-act="new-question">再发起一道题</button></div>
    </section>`;
  }

  // Shown after a question is submitted without a result; the upload flow draws its own.
  function showDone(result) {
    root.innerHTML = `${ctx.pageStart({ title: '发起题目', section: 'new', heading: '题目已提交审核', meta: sideSteps(0) })}
      <section class="block wrap">${done(result)}</section>${ctx.pageEnd()}`;
    root.onclick = (event) => {
      if (event.target.closest('[data-act="new-question"]')) { question = blank(); showForm(); scrollTo({ top: 0 }); }
    };
    scrollTo({ top: 0 });
  }

  function showUpload() {
    flow = uploadFlow(root, ctx, {
      task: { id: NEW_QUESTION, title: question.title, prompt: question.prompt, templates: question.templates, promptVariants: [] },
      draftTask: NEW_QUESTION,
      lead: { label: '题目信息', html: brief },
      page: (finished) => ({ title: '发起题目', section: 'new', heading: finished ? '题目已提交审核' : '附上一份示例结果',
        description: '选填：用这道题的提示词让模型生成一份结果，展示题目的效果。' }),
      fileNote: '上传用这份提示词让模型生成的结果',
      infoLabel: '结果信息',
      submitLabel: '提交题目与结果',
      submitNote: '通过审核前只有你能看到题目和结果。',
      stages: [['题目审核', '管理员人工审核，通过前仅你可见'], ['示例结果', moderated() ? contentStage()[1] : '随题目一起公开'], ['进入题库', '示例结果作为第一份作品展示']],
      waiting: ({ question: saved, work }) => ['pending', 'review'].includes(saved.moderation?.status ?? 'pending') || ['pending', 'review'].includes(work?.moderation?.status),
      async submit({ draftId, confirmed, ...work }) {
        const result = await api('questions', { method: 'POST', body: { ...question, draftId, confirmed, work } });
        toast('题目已提交，等待人工审核');
        await refreshPlatform('question');
        return result;
      },
      done,
      onAct(act) {
        if (act === 'edit-question') showForm();
        if (act === 'new-question') { question = blank(); showForm(); scrollTo({ top: 0 }); }
      },
    });
  }

  showForm();
  return {
    onPlatformChange(reason) {
      if (flow) flow.onPlatformChange?.(reason);
      else $('[data-publish-auth]', root).hidden = Boolean(platform.user);
    },
    destroy() {
      active = false;
      flow?.destroy();
      root.onsubmit = null;
      root.onkeydown = null;
    },
  };
}
