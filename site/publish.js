// Publish a question: 01 describe it (title / summary / tags / prompt / formats), then attach
// the first result through the shared upload steps. Both are submitted together; the
// question waits for an admin while its result goes through content moderation.
import { $, $$, esc, icon } from './ui.js';
import { api, platform, refreshPlatform, requireUser, toast } from './platform.js';
import { uploadFlow } from './submit.js';

const normalize = (name) => String(name).normalize('NFKC').trim().replace(/^#+/, '').trim();
const TEMPLATE_LABELS = { static: '纯 HTML / JavaScript', vite: 'Vite 静态网页' };
// Drafts staged for a question that does not exist yet.
const NEW_QUESTION = '__new__';
const blank = () => ({ title: '', summary: '', prompt: '', tags: [], templates: ['static', 'vite'] });
const sideSteps = (current) => `<ol class="side-steps">${['题目信息', '选择文件', '试加载', '结果信息']
  .map((label, i) => `<li${i === current ? ' aria-current="step"' : ''}><span>0${i + 1}</span>${label}</li>`).join('')}</ol>`;

export function mount(root, ctx) {
  const existing = [...new Set(ctx.DATA.tasks.flatMap((task) => task.tags))];
  let question = blank();
  let flow = null, active = true;

  function showForm() {
    flow?.destroy();
    flow = null;
    const tags = [...question.tags];
    root.innerHTML = `${ctx.pageStart({ title: '发起题目', section: 'new', heading: '让每份答案，从同一题开始',
      description: '写清要测试的能力，提供完整提示词，再附上一份模型结果展示它的效果。', meta: sideSteps(0) })}
      <section class="block wrap publish-layout">
        <form class="publish-form" novalidate>
          <div class="notice publish-auth" data-publish-auth${platform.user ? ' hidden' : ''}>${icon('user')}<p>登录后即可发起题目，已填写的内容会保留。</p><button class="btn sm" type="button" data-auth="login">登录 / 注册</button></div>
          <label class="field"><span class="field-label">题目标题 *</span><input class="input" name="title" required maxlength="70" placeholder="例如：体素中国古典建筑群" value="${esc(question.title)}"></label>
          <label class="field"><span class="field-label">测试简述 *</span><textarea class="input" name="summary" required maxlength="400" rows="3" placeholder="需要完成什么？能测出模型的哪些能力？">${esc(question.summary)}</textarea></label>
          <div class="field"><label class="field-label" for="question-tag">题目标签 *</label>
            <div class="tag-input-row"><input class="input" id="question-tag" maxlength="24" placeholder="选择或创建标签，按 Enter 添加"><button class="btn" type="button" data-add-tag>添加</button></div>
            <div class="tag-editor" aria-label="已选择的标签"></div>
            <div class="tag-suggestions" aria-label="已有标签">${existing.map((tag) => `<button type="button" data-suggest-tag="${esc(tag)}">#${esc(tag)}</button>`).join('')}</div>
            <p class="fine">最多 6 个；同名标签会归入同一分类。</p>
          </div>
          <label class="field"><span class="field-label">完整提示词 *</span><textarea class="input" name="prompt" required maxlength="20000" rows="12" placeholder="粘贴所有参与模型需要使用的同一份完整提示词。">${esc(question.prompt)}</textarea></label>
          <div class="field"><span class="field-label">允许的提交格式 *</span><div class="format-options">
            ${Object.entries(TEMPLATE_LABELS).map(([value, label]) => `<label><input type="checkbox" name="templates" value="${value}"${question.templates.includes(value) ? ' checked' : ''}>${label}</label>`).join('')}
          </div><p class="fine">Vite 项目需要包含构建后的 dist/ 目录。</p></div>
          <p class="form-error" role="alert"></p>
          <div class="form-actions"><button class="btn primary" type="submit">下一步：上传示例结果${icon('right')}</button><a class="btn" href="#/questions">取消</a><span class="fine">发起即表示你同意<a href="#/terms" target="_blank" rel="noopener">《使用条款》</a>与<a href="#/privacy" target="_blank" rel="noopener">《隐私政策》</a>。</span></div>
        </form>
        <aside class="publish-note"><h3>一道可比较的题目</h3><p>简述说明测试目标。<br>提示词作为所有作品的共同依据。<br>标签帮助其他人发现这道题。</p><p>发起时需要附上一份用这份提示词生成的模型结果，让大家看到它能做出什么。</p><p>题目由管理员人工审核，示例结果先做内容审核；通过前只有你能看到。测试文字、灌水或广告不会通过。</p></aside>
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
    root.onchange = null;
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
      if (!tags.length) { error.textContent = '请至少添加一个标签'; tagInput.focus(); return; }
      if (!data.getAll('templates').length) { error.textContent = '请至少选择一种提交格式'; return; }
      question = { title: String(data.get('title')).trim(), summary: String(data.get('summary')).trim(), prompt: String(data.get('prompt')).trim(),
        tags: [...tags], templates: data.getAll('templates') };
      if (!(await requireUser('登录后即可发起题目')) || !active) return;
      showUpload();
      scrollTo({ top: 0 });
    };
  }

  function brief() {
    return `<section class="step is-done" data-step="0">
      <header class="step-head"><span class="num">01</span><h2>题目信息</h2><p>管理员会对照这些内容人工审核</p><button class="link step-action" type="button" data-act="edit-question">修改题目</button></header>
      <div class="step-body question-brief">
        <h3>${esc(question.title)}</h3>
        <p>${esc(question.summary)}</p>
        <p class="work-meta">${question.tags.map((tag) => `#${esc(tag)}`).join(' · ')} · ${question.templates.map((t) => TEMPLATE_LABELS[t]).join(' / ')}</p>
        <details class="prompt-peek"><summary>${icon('guide')}完整提示词 · 示例结果需按它生成</summary><pre>${esc(question.prompt)}</pre></details>
      </div>
    </section>`;
  }

  function done({ question: saved, work }) {
    return `<section class="submit-done">
      <p class="kicker"><span class="num">已提交</span><span>等待人工审核</span></p>
      <h2>「${esc(saved.title)}」已提交审核</h2>
      <p>管理员会人工审核这道题，示例结果「${esc(work.title)}」同时进行内容审核。审核通过前只有你能看到它们，进度显示在「个人中心 · 我的题目」和「我的作品」里。题目通过后会出现在题库，其他人就可以上传各自模型的结果。</p>
      <div class="actions"><a class="btn primary" href="#/me/questions">查看我的题目${icon('right')}</a>${work.scene ? `<a class="btn" href="${esc(work.scene)}" target="_blank" rel="noopener">预览示例结果${icon('arrow')}</a>` : ''}<button class="btn" type="button" data-act="new-question">再发起一道题</button></div>
    </section>`;
  }

  function showUpload() {
    flow = uploadFlow(root, ctx, {
      task: { id: NEW_QUESTION, title: question.title, prompt: question.prompt, templates: question.templates, promptVariants: [] },
      draftTask: NEW_QUESTION,
      lead: { label: '题目信息', html: brief },
      page: (finished) => ({ title: '发起题目', section: 'new', heading: finished ? '题目已提交审核' : '附上一份示例结果',
        description: '用这道题的提示词让模型生成一份结果，展示题目的效果。' }),
      fileNote: '上传用这份提示词让模型生成的结果',
      infoLabel: '结果信息',
      submitLabel: '提交题目与结果',
      submitNote: '题目由管理员人工审核，示例结果先做内容审核；通过前只有你能看到。',
      timeline: `<li><b>人工审核题目</b><span>管理员确认题目是一项具体、可比较的生成任务。</span></li>
        <li><b>内容审核结果</b><span>示例结果先自动检查页面内容，异常时转人工复核。</span></li>
        <li><b>公开</b><span>题目通过后进入题库，示例结果作为第一份作品展示，其他人可以上传自己的结果。</span></li>`,
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
