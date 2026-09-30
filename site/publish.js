// Publish a question using the original title / summary / tags / prompt / formats flow.
import { $, $$, esc, icon } from './ui.js';
import { api, platform, refreshPlatform, requireUser, toast } from './platform.js';

const normalize = (name) => String(name).normalize('NFKC').trim().replace(/^#+/, '').trim();

export function mount(root, ctx) {
  const existing = [...new Set(ctx.DATA.tasks.flatMap((task) => task.tags))];
  const tags = [];
  let busy = false, active = true;
  root.innerHTML = `${ctx.pageStart({ title: '发起题目', section: 'new', heading: '让每份答案，从同一题开始',
    description: '写清要测试的能力，提供完整提示词，邀请不同模型带来答案。',
    meta: '<ol class="side-steps"><li><span>01</span>描述题目</li><li><span>02</span>选择标签</li><li><span>03</span>公开提示词</li></ol>' })}
    <section class="block wrap publish-layout">
      <form class="publish-form" novalidate>
        <div class="notice publish-auth" data-publish-auth${platform.user ? ' hidden' : ''}>${icon('user')}<p>登录后即可发起题目，已填写的内容会保留。</p><button class="btn sm" type="button" data-auth="login">登录 / 注册</button></div>
        <label class="field"><span class="field-label">题目标题 *</span><input class="input" name="title" required maxlength="70" placeholder="例如：体素中国古典建筑群"></label>
        <label class="field"><span class="field-label">测试简述 *</span><textarea class="input" name="summary" required maxlength="400" rows="3" placeholder="需要完成什么？能测出模型的哪些能力？"></textarea></label>
        <div class="field"><label class="field-label" for="question-tag">题目标签 *</label>
          <div class="tag-input-row"><input class="input" id="question-tag" maxlength="24" placeholder="选择或创建标签，按 Enter 添加"><button class="btn" type="button" data-add-tag>添加</button></div>
          <div class="tag-editor" aria-label="已选择的标签"></div>
          <div class="tag-suggestions" aria-label="已有标签">${existing.map((tag) => `<button type="button" data-suggest-tag="${esc(tag)}">#${esc(tag)}</button>`).join('')}</div>
          <p class="fine">最多 6 个；同名标签会归入同一分类。</p>
        </div>
        <label class="field"><span class="field-label">完整提示词 *</span><textarea class="input" name="prompt" required maxlength="20000" rows="12" placeholder="粘贴所有参与模型需要使用的同一份完整提示词。"></textarea></label>
        <div class="field"><span class="field-label">允许的提交格式 *</span><div class="format-options">
          <label><input type="checkbox" name="templates" value="static" checked>纯 HTML / JavaScript</label>
          <label><input type="checkbox" name="templates" value="vite" checked>Vite 静态网页</label>
        </div><p class="fine">Vite 项目需要包含构建后的 dist/ 目录。</p></div>
        <p class="form-error" role="alert"></p>
        <div class="form-actions"><button class="btn primary" type="submit">${icon('plus')}发起题目</button><a class="btn" href="#/questions">取消</a></div>
      </form>
      <aside class="publish-note"><h3>一道可比较的题目</h3><p>简述说明测试目标。<br>提示词作为所有作品的共同依据。<br>标签帮助其他人发现这道题。</p><p>发布后可在题目内上传作品。<br>每份作品会固定关联这道题。</p></aside>
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
  root.onclick = (event) => {
    if (busy) return;
    if (event.target.closest('[data-add-tag]')) addTag(tagInput.value);
    const suggestion = event.target.closest('[data-suggest-tag]');
    if (suggestion) addTag(suggestion.dataset.suggestTag);
    const remove = event.target.closest('[data-remove-tag]');
    if (remove) { tags.splice(Number(remove.dataset.removeTag), 1); paintTags(); }
  };
  root.onkeydown = (event) => {
    if (event.target === tagInput && ['Enter', ',', '，'].includes(event.key)) { event.preventDefault(); if (!busy) addTag(tagInput.value); }
  };
  root.onsubmit = async (event) => {
    if (event.target !== form) return;
    event.preventDefault();
    if (busy) return;
    error.textContent = '';
    if (tagInput.value.trim() && !addTag(tagInput.value)) return;
    const data = new FormData(form);
    for (const [name, label] of [['title', '题目标题'], ['summary', '测试简述'], ['prompt', '完整提示词']]) {
      if (!String(data.get(name)).trim()) { error.textContent = `请填写${label}`; $(`[name="${name}"]`, form).focus(); return; }
    }
    if (!tags.length) { error.textContent = '请至少添加一个标签'; tagInput.focus(); return; }
    if (!data.getAll('templates').length) { error.textContent = '请至少选择一种提交格式'; return; }
    if (!(await requireUser('登录后即可发起题目')) || !active) return;
    const button = $('[type="submit"]', form);
    busy = true;
    button.disabled = true;
    button.textContent = '正在发布…';
    try {
      const { question } = await api('questions', { method: 'POST', body: {
        title: data.get('title'), summary: data.get('summary'), prompt: data.get('prompt'), tags: [...tags], templates: data.getAll('templates'),
      } });
      await refreshPlatform('question');
      // 新题目先进入审核队列；后端未带 status 时保持原行为。
      if (active) {
        if (question.status === 'pending') { toast('题目已提交，审核通过后公开'); location.hash = '#/me/questions'; }
        else { toast('题目已发起'); location.hash = `#/${question.id}`; }
      }
    } catch (cause) {
      if (active) error.textContent = cause.message;
    } finally {
      busy = false;
      button.disabled = false;
      button.innerHTML = `${icon('plus')}发起题目`;
    }
  };
  return {
    onPlatformChange() { $('[data-publish-auth]', root).hidden = Boolean(platform.user); },
    destroy() { active = false; root.onsubmit = null; root.onkeydown = null; },
  };
}
