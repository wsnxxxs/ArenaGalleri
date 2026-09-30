// Personal center (#/me), and the admin review queue (#/review[/<tab>]).
import { $, $$, brandMark, byName, esc, formatBytes, formatDate, formatTime, icon, img } from './ui.js';
import { api, confirmDialog, openDialog, platform, refreshPlatform, requireUser, statusBadge, toast } from './platform.js';

const TABS = { unverified: '未验证', verified: '已验证', questioned: '存疑', log: '记录' };
const ME_TABS = { overview: '概览', works: '我的作品', questions: '我的题目' };
const ACCOUNT = { title: '个人中心', description: '每一道提问，每一份解答，都是你的创作足迹。' };
const ACTIONS = { submit: '提交作品', verified: '通过验证', questioned: '标记存疑', unverified: '退回未验证', delete: '删除作品' };

export function mount(root, ctx) {
  return ctx.route === 'review' ? review(root, ctx) : mine(root, ctx);
}

// Every personal-center page keeps this sidebar; the review queue is one of its views.
function accountNav(ctx, current) {
  return ctx.sideNav('个人中心', [
    ['#/me', 'user', ME_TABS.overview, current === 'overview'],
    ['#/me/works', 'grid', ME_TABS.works, current === 'works'],
    ['#/me/questions', 'text', ME_TABS.questions, current === 'questions'],
    ...(platform.user?.role === 'admin' ? [['#/review', 'shield', '作品审核', current === 'review', platform.review?.unverified || undefined]] : []),
  ]);
}

function thumb(ctx, w, { link = true } = {}) {
  const src = Object.values(w.captures ?? {})[0] ?? w.cover;
  const inner = src ? img(src, '') : `<span class="img-empty upload-cover"><b>${esc(w.title)}</b></span>`;
  return link
    ? `<a class="work-thumb" href="#/${esc(w.task)}/${esc(w.id)}" tabindex="-1" aria-hidden="true">${inner}</a>`
    : `<span class="work-thumb" aria-hidden="true">${inner}</span>`;
}

function reactionSummary(w) {
  const counts = platform.reactions.counts[`${w.task}/${w.id}`] ?? {};
  const entries = Object.entries(counts).filter(([, n]) => n);
  return entries.length ? `<span class="reaction-sum">${entries.map(([emoji, n]) => `<span>${emoji}<b>${n}</b></span>`).join('')}</span>` : '';
}

function workRow(ctx, w, { admin = false } = {}) {
  const task = ctx.DATA.tasks.find((t) => t.id === w.task);
  const model = ctx.MODELS.get(w.model) ?? { name: w.modelName };
  return `<article class="work-row" data-status="${w.status}">
    ${thumb(ctx, w, { link: false })}
    <div class="work-main">
      <p class="result-model">${brandMark(model, 'brand-mark sm')}<b>${esc(w.modelName)}</b>${w.effort ? `<span class="badge">${esc(w.effort)}</span>` : ''}${statusBadge(w.status, { always: true, reason: w.reason })}</p>
      <h3><a href="#/${esc(w.task)}/${esc(w.id)}">${esc(w.title)}</a></h3>
      <p class="work-meta">${esc(task?.title ?? w.task)}${ctx.sourceLine(w) ? ` · ${esc(ctx.sourceLine(w))}` : w.tool ? ` · 作者原始声明：${esc(w.tool)}` : ''} · ${formatDate(w.addedAt)}${admin ? ` · 投稿者 ${esc(w.owner ?? '已注销的用户')}` : ''}</p>
      ${w.reason ? `<p class="result-reason">${icon('alert')}<span>${esc(w.reason)}</span></p>` : ''}
    </div>
    <div class="work-side">
      ${reactionSummary(w)}
      <div class="actions">
        ${admin
          ? `<button class="btn sm primary" data-review="${esc(w.id)}">审核</button>`
          : `<button class="icon-btn" data-delete="${esc(w.id)}" title="删除作品" aria-label="删除「${esc(w.title)}」">${icon('trash')}</button>`}
      </div>
    </div>
  </article>`;
}

async function removeWork(w, { admin }) {
  const verified = w.status === 'verified';
  const ok = await confirmDialog({
    title: '删除这件作品？',
    message: `「${w.title}」的文件会被永久删除，展厅中不再显示。${verified ? '它参与过的盲评投票会从榜单中移出。' : ''}${admin ? '操作会记入审核记录。' : ''}`,
    confirm: '删除',
    danger: true,
  });
  if (!ok) return false;
  try {
    await api(`works/${encodeURIComponent(w.task)}/${encodeURIComponent(w.id)}`, { method: 'DELETE' });
    toast('作品已删除');
    await refreshPlatform('delete');
    return true;
  } catch (error) {
    toast(error.message);
    return false;
  }
}

function signedOut(root, ctx, text) {
  root.innerHTML = `${ctx.pageStart({ ...ACCOUNT, section: 'me', heading: '作品审核', crumbs: [{ text: '个人中心', href: '#/me' }, { text: '作品审核' }] })}<section class="account-empty">
    ${icon('user')}<h2>${esc(text)}</h2>
    <p>登录后，你上传的作品和核验结果会显示在这里。</p>
    <div class="actions"><button class="btn primary" data-auth="login">登录 / 注册</button><a class="btn" href="#/questions">回到题库</a></div>
  </section>${ctx.pageEnd()}`;
}

function questionRow(ctx, question) {
  const task = ctx.DATA.tasks.find((item) => item.id === question.id);
  const works = task?.results.filter(ctx.interactive).length ?? 0;
  return `<article class="submission-question">
    <span class="submission-question-mark" aria-hidden="true">${icon('text')}</span>
    <div class="submission-question-body"><h3><a href="#/${esc(question.id)}">${esc(question.title)}</a></h3>
      <p class="summary">${esc(question.summary)}</p>
      <p class="work-meta">${question.tags.map((tag) => `#${esc(tag)}`).join(' · ')}<span>${esc(question.date)} · ${works} 件作品</span></p>
    </div><a class="btn sm" href="#/${esc(question.id)}">查看题目${icon('next')}</a>
  </article>`;
}

function activityCalendar(activity) {
  const counts = new Map(activity.days.map((day) => [day.date, day.count]));
  const start = new Date(`${activity.from}T00:00:00Z`);
  const end = Date.parse(`${activity.to}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  const weeks = [];
  let previousMonth = -1;
  for (let time = start.getTime(); time <= end; time += 7 * 86400000) {
    const month = new Date(Math.max(time, Date.parse(`${activity.from}T00:00:00Z`))).getUTCMonth();
    const monthLabel = month !== previousMonth ? `${month + 1}月` : '';
    previousMonth = month;
    const cells = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(time + index * 86400000).toISOString().slice(0, 10);
      const count = counts.get(date) ?? 0;
      const level = count === 0 ? 0 : count === 1 ? 1 : count < 4 ? 2 : count < 8 ? 3 : 4;
      return `<span class="activity-day${date < activity.from || date > activity.to ? ' outside' : ''}" data-level="${level}" title="${date} · ${count} 次活跃"></span>`;
    }).join('');
    weeks.push(`<div class="activity-week"><span class="activity-month">${monthLabel}</span>${cells}</div>`);
  }
  return `<div class="activity-scroll"><div class="activity-calendar" role="img" aria-label="${activity.from} 至 ${activity.to}，${activity.activeDays} 天活跃，共 ${activity.total} 次参与。日期按北京时间统计。">
    <div class="activity-week activity-weekdays"><span></span><span>一</span><span></span><span>三</span><span></span><span>五</span><span></span><span>日</span></div>${weeks.join('')}
  </div></div>`;
}

function profileOverview(state) {
  const user = platform.user;
  const name = user.nickname || user.name;
  const activity = state.activity;
  const received = state.receivedReactions;
  return `<section class="profile-settings" aria-label="个人资料">
    <span class="avatar profile-avatar" role="img" aria-label="${esc(name)}的头像">${esc([...name][0].toUpperCase())}</span>
    <div class="profile-main">${state.editing ? `<form class="profile-form" data-profile-form>
        <label class="field-label" for="profile-nickname">昵称</label>
        <div class="profile-name-row"><input class="input" id="profile-nickname" name="nickname" value="${esc(name)}" required maxlength="24" autocomplete="nickname"><button class="btn primary" type="submit">保存</button><button class="btn" type="button" data-edit-cancel>取消</button></div>
        <p class="form-error" data-profile-error role="alert" hidden></p>
      </form>` : `<p class="profile-name"><b>${esc(name)}</b><button class="btn sm ghost" type="button" data-edit-name>编辑昵称</button></p>`}
      <p class="profile-account">登录账号 ${esc(user.name)}${state.joinedAt ? ` · ${formatDate(state.joinedAt)} 加入` : ''}</p>
    </div><button class="link profile-logout" type="button" data-logout>退出登录</button>
  </section>
  <section class="profile-activity" aria-labelledby="activity-title">
    <div class="profile-section-head"><h2 id="activity-title">活跃热力图</h2><p>近一年 <b>${activity ? activity.total : '—'}</b> 次参与 · <b>${activity ? activity.activeDays : '—'}</b> 天活跃</p></div>
    ${activity ? activityCalendar(activity) : `<p class="muted">${state.error ? '活跃记录暂时未能载入。' : '正在载入活跃记录…'}</p>`}
    <div class="activity-foot"><p>发起题目、提交作品、盲评与送出表情 · 北京时间</p><div class="activity-legend" aria-hidden="true">少${[0, 1, 2, 3, 4].map((level) => `<span class="activity-day" data-level="${level}"></span>`).join('')}多</div></div>
  </section>
  <section class="profile-reactions" aria-labelledby="received-title">
    <div><h2 id="received-title">获得的表情</h2><p>作品收到了 <b>${received ? received.total : '—'}</b> 个回应</p></div>
    <div class="received-emojis">${platform.site.emojis.map((emoji) => `<div class="received-emoji"><span>${emoji}</span><b>${received ? received.counts[emoji] ?? 0 : '—'}</b></div>`).join('')}</div>
  </section>`;
}

// Uploads always belong to a question, so the personal center asks which one first.
function pickTask(ctx) {
  const tasks = ctx.DATA.tasks.filter((t) => platform.arena[t.id]?.uploads);
  const sheet = openDialog({
    title: '上传到哪道题？',
    className: 'upload-pick-sheet',
    body: tasks.length
      ? `<p class="sheet-text">每件作品都对应一道题目，请按它的提示词生成后上传。</p><div class="upload-picks">${tasks.map((t) => `<a class="upload-pick" href="#/submit/${esc(t.id)}"><b>${esc(t.title)}</b><span>${t.results.filter(ctx.interactive).length} 件作品</span>${icon('next')}</a>`).join('')}</div>`
      : '<p class="sheet-text">暂时没有接受投稿的题目。</p>',
  });
  sheet.el.addEventListener('click', (e) => { if (e.target.closest('a')) sheet.close(); });
}

// ---- personal center: profile, activity, questions, works -------------------------------------
function mine(root, ctx) {
  const empty = { questions: null, works: null, votes: 0, activity: null, receivedReactions: null, joinedAt: null, error: '' };
  const state = { owner: null, editing: false, ...empty };
  let active = true, request = 0;
  async function load() {
    const version = ++request;
    if (state.owner !== (platform.user?.id ?? null)) {
      Object.assign(state, { owner: platform.user?.id ?? null, ...empty });
      draw();
    }
    if (!platform.user) return draw();
    try {
      const data = await api('me');
      if (!active || version !== request) return;
      Object.assign(state, { questions: data.questions, works: data.works, votes: data.votes, activity: data.activity, receivedReactions: data.receivedReactions, joinedAt: data.joinedAt, error: '' });
    } catch (error) {
      if (!active || version !== request) return;
      state.error = error.message;
    }
    draw();
  }
  const tab = Object.hasOwn(ME_TABS, ctx.param ?? '') ? ctx.param : 'overview';
  function draw() {
    const signedIn = Boolean(platform.user);
    const questions = state.questions ?? [];
    const works = state.works ?? [];
    const count = (status) => works.filter((w) => w.status === status).length;
    const nav = signedIn ? accountNav(ctx, tab) : '';
    const caption = !signedIn ? '' : tab === 'works'
      ? `<button class="btn sm" type="button" data-upload>${icon('upload')}上传作品</button>`
      : tab === 'questions' ? `<a class="btn sm" href="#/new">${icon('plus')}发起题目</a>`
      : `<span class="collection-caption">已参与 ${state.votes} 组盲评</span>`;
    const body = !signedIn ? `<div class="notice submissions-login">${icon('user')}<p>登录后查看你发起的题目与上传的作品。</p><button class="btn primary sm" data-auth="login">登录 / 注册</button></div>`
      : tab === 'overview' ? profileOverview(state)
      : tab === 'works' ? `<section class="submission-section">${state.works === null ? `<p class="muted">${state.error ? '作品暂时未能载入。' : '正在载入作品…'}</p>` : works.length
          ? `<p class="submission-summary">${works.length} 件作品 · ${count('unverified')} 件等待核验${count('questioned') ? ` · ${count('questioned')} 件存疑` : ''}</p><div class="work-list">${works.map((w) => workRow(ctx, w)).join('')}</div>`
          : '<div class="submission-empty"><b>还没有上传作品</b><p>选一道题，上传你让模型生成的答案。</p><button class="btn sm" type="button" data-upload>上传作品</button></div>'}</section>`
      : `<section class="submission-section">${state.questions === null ? `<p class="muted">${state.error ? '题目暂时未能载入。' : '正在载入题目…'}</p>` : questions.length
          ? `<div class="submission-questions">${questions.map((question) => questionRow(ctx, question)).join('')}</div>`
          : `<div class="submission-empty"><b>还没有发起题目</b><p>写下同一份提示词，邀请不同模型给出答案。</p><a class="btn sm" href="#/new">发起题目</a></div>`}</section>`;
    root.innerHTML = `${ctx.pageStart({ ...ACCOUNT, section: 'me', heading: signedIn ? ME_TABS[tab] : '个人中心', caption, nav,
      crumbs: tab === 'overview' ? [{ text: '个人中心' }] : [{ text: '个人中心', href: '#/me' }, { text: ME_TABS[tab] }] })}
      ${state.error ? `<p class="form-error submissions-error" role="alert">${esc(state.error)}</p>` : ''}
      ${body}
    ${ctx.pageEnd()}`;
    const calendar = root.querySelector('.activity-scroll');
    if (calendar) calendar.scrollLeft = calendar.scrollWidth;
    ctx.settleImages();
    document.title = `个人中心 · ${ctx.DATA.title}`;
  }
  root.onsubmit = async (event) => {
    const form = event.target.closest('[data-profile-form]');
    if (!form) return;
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const errorLine = form.querySelector('[data-profile-error]');
    button.disabled = true;
    button.textContent = '保存中…';
    errorLine.hidden = true;
    try {
      await api('me', { method: 'PATCH', body: { nickname: new FormData(form).get('nickname') } });
      state.editing = false;
      await refreshPlatform('profile');
      toast('昵称已保存');
    } catch (error) {
      errorLine.textContent = error.message;
      errorLine.hidden = false;
      button.disabled = false;
      button.textContent = '保存';
    }
  };
  root.onclick = async (e) => {
    const edit = e.target.closest('[data-edit-name], [data-edit-cancel]');
    if (edit) {
      state.editing = edit.matches('[data-edit-name]');
      draw();
      if (state.editing) root.querySelector('#profile-nickname')?.select();
      return;
    }
    if (e.target.closest('[data-upload]')) {
      if (await requireUser('登录后上传作品，并在这里跟进核验结果。')) pickTask(ctx);
      return;
    }
    const button = e.target.closest('[data-delete]');
    if (!button) return;
    const work = state.works?.find((w) => w.id === button.dataset.delete);
    if (work) await removeWork(work, { admin: false });
  };
  draw();
  load();
  return { onPlatformChange: load, destroy() { active = false; request++; root.onsubmit = null; } };
}

// ---- review queue -----------------------------------------------------------------------------
function provenanceSelect(ctx, type, work) {
  const harness = type === 'harness';
  const id = work[type];
  const name = work[harness ? 'harnessName' : 'providerName'];
  const registry = harness ? ctx.HARNESSES : ctx.PROVIDERS;
  const selected = id ? id : name ? 'other' : 'unset';
  const entries = [...registry.values()].filter((entry) => entry.listed || entry.id === id).sort((a, b) => byName(a.name, b.name));
  if (id && !registry.has(id)) entries.push({ id, name: name || id, listed: false });
  return `<div class="provenance-field"><label class="field"><span class="field-label">${harness ? 'Harness' : '服务商'}</span>
    <select class="input" name="${type}Choice" data-provenance-choice="${type}">
      <option value="unset"${selected === 'unset' ? ' selected' : ''}>未注明</option>
      ${entries.map((entry) => `<option value="${esc(entry.id)}"${selected === entry.id ? ' selected' : ''}>${esc(entry.name)}${entry.listed ? '' : '（已停用）'}</option>`).join('')}
      <option value="other"${selected === 'other' ? ' selected' : ''}>其他（手动填写）</option>
    </select></label>
    <label class="field" data-provenance-other="${type}"${selected === 'other' ? '' : ' hidden'}><span class="field-label">其他${harness ? ' Harness' : '服务商'}名称</span>
      <input class="input" name="${type}Other" maxlength="40" value="${selected === 'other' ? esc(name) : ''}" placeholder="手动填写名称">
      <span class="provenance-suggestion" data-provenance-suggestion="${type}" hidden></span>
    </label></div>`;
}

function normalizedSource(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\s\-\u2010-\u2015\u2212\uff0d]+/g, '');
}

function sourceSuggestion(registry, value) {
  const name = normalizedSource(value);
  return name && [...registry.values()].find((entry) => [entry.name, ...(entry.aliases ?? [])].some((alias) => normalizedSource(alias) === name));
}

function updateProvenanceForm(form, ctx) {
  for (const type of ['harness', 'provider']) {
    const choice = form.elements.namedItem(`${type}Choice`);
    const other = form.querySelector(`[data-provenance-other="${type}"]`);
    const input = form.elements.namedItem(`${type}Other`);
    const suggestion = form.querySelector(`[data-provenance-suggestion="${type}"]`);
    other.hidden = choice.value !== 'other';
    suggestion.hidden = true;
    suggestion.replaceChildren();
    if (choice.value !== 'other') continue;
    const match = sourceSuggestion(type === 'harness' ? ctx.HARNESSES : ctx.PROVIDERS, input.value);
    if (!match) continue;
    suggestion.append('可能是 ', match.name, ' ');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn sm';
    button.dataset.selectSource = type;
    button.dataset.sourceId = match.id;
    button.textContent = `改选 ${match.name}`;
    suggestion.append(button);
    suggestion.hidden = false;
  }
  form.elements.namedItem('harnessVersion').disabled = form.elements.namedItem('harnessChoice').value === 'unset';
}

function changedProvenance(form, work) {
  const body = {};
  for (const type of ['harness', 'provider']) {
    const id = work[type] ?? null;
    const name = work[type === 'harness' ? 'harnessName' : 'providerName'] ?? '';
    const initial = id || (name ? 'other' : 'unset');
    const choice = form.elements.namedItem(`${type}Choice`).value;
    const other = form.elements.namedItem(`${type}Other`).value.trim();
    if (choice === initial && (choice !== 'other' || other === name)) continue;
    if (choice === 'other') {
      if (!other) throw new Error(`请填写${type === 'harness' ? 'Harness' : '服务商'}名称`);
      body[`${type}Id`] = null;
      body[`${type}Other`] = other;
    } else {
      body[`${type}Id`] = choice === 'unset' ? null : choice;
      body[`${type}Other`] = '';
    }
  }
  const version = form.elements.namedItem('harnessChoice').value === 'unset' ? '' : form.elements.namedItem('harnessVersion').value.trim();
  if (version !== (work.harnessVersion ?? '')) body.harnessVersion = version;
  return body;
}

function trialRows(trial) {
  if (!trial || trial.loaded === undefined) return '<li class="check is-info"><span><b>试加载</b>没有记录</span></li>';
  const rows = [
    trial.loaded ? ['ok', '页面载入', `${((trial.loadMs ?? 0) / 1000).toFixed(1)} 秒`] : ['fail', '页面载入', '作者提交时页面未完成载入'],
    trial.errors ? ['warn', '脚本错误', `${trial.errors} 条：${trial.errorSamples?.[0] ?? ''}`] : ['ok', '脚本错误', '没有'],
    trial.failedResources?.length ? ['warn', '资源加载', trial.failedResources.join('、')] : ['ok', '资源加载', '全部载入'],
    trial.blocked?.length ? ['warn', '外部请求', `被拦截：${trial.blocked.join('、')}`] : ['ok', '外部请求', '没有被拦截的请求'],
    trial.canvases || trial.media || trial.words > 20 ? ['ok', '画面内容', trial.canvases ? `${trial.canvases} 个画布` : '有可见内容'] : ['warn', '画面内容', '可能是空白页面'],
  ];
  return rows.map(([state, label, detail]) => `<li class="check is-${state}">${icon(state === 'ok' ? 'check' : state === 'fail' ? 'close' : 'alert')}<span><b>${esc(label)}</b>${esc(detail)}</span></li>`).join('');
}

function openReview(ctx, w, { onDecided } = {}) {
  const task = ctx.DATA.tasks.find((t) => t.id === w.task);
  const vendors = new Map();
  for (const model of ctx.DATA.models) {
    if (!vendors.has(model.vendor)) vendors.set(model.vendor, []);
    vendors.get(model.vendor).push(model);
  }
  const options = [...vendors].sort(([a], [b]) => byName(a, b)).map(([vendor, models]) => `<optgroup label="${esc(vendor)}">${models.map((m) => `<option value="${esc(m.id)}"${m.id === w.model ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</optgroup>`).join('');
  const sheet = openDialog({
    title: '核验作品',
    className: 'review-sheet',
    body: `<div class="review">
      <div class="review-facts">
        <div class="review-head">${thumb(ctx, w)}<div><h3>${esc(w.title)}</h3><p class="result-model">${statusBadge(w.status, { always: true })}<span>${esc(task?.title ?? w.task)}</span></p>
          <div class="actions"><a class="btn sm" href="${esc(w.scene)}" target="_blank" rel="noopener">打开作品${icon('arrow')}</a><a class="btn sm" href="#/${esc(w.task)}/${esc(w.id)}">在展厅中查看</a></div></div></div>
        <dl class="facts">
          <div><dt>投稿者</dt><dd>${esc(w.owner ?? '已注销的用户')} · ${formatTime(w.addedAt)}</dd></div>
          <div><dt>声明的模型</dt><dd>${esc(w.modelName)}${w.vendor ? ` · ${esc(w.vendor)}` : ''}${w.model ? '' : '（未登记）'}</dd></div>
          <div><dt>推理档位</dt><dd>${esc(w.effort || '默认 / 未设置')}</dd></div>
          <div><dt>Harness</dt><dd>${esc(ctx.harnessOf(w)?.name ?? '未注明')}${w.harnessVersion ? ` · ${esc(w.harnessVersion)}` : ''}</dd></div>
          <div><dt>服务商</dt><dd>${esc(ctx.providerOf(w)?.name ?? '未注明')}</dd></div>
          <div><dt>作者原始声明</dt><dd>${esc(w.tool || '未注明')}</dd></div>
          <div><dt>文件</dt><dd>${esc(w.sourceName ?? '')} · ${w.files} 个 · ${formatBytes(w.bytes)} · 入口 ${esc(w.root ? `${w.root}/` : '')}${esc(w.entry ?? '')}</dd></div>
          ${w.reviewer ? `<div><dt>上次核验</dt><dd>${esc(w.reviewer)} · ${formatTime(w.reviewedAt)}</dd></div>` : ''}
        </dl>
        ${w.summary ? `<p class="review-text">${esc(w.summary)}</p>` : ''}
        <h4>生成说明</h4><p class="review-text">${w.note ? esc(w.note) : '<span class="muted">投稿者没有填写。</span>'}</p>
        <h4>上传检查</h4><ul class="checks">${(w.checks ?? []).map((c) => `<li class="check is-${c.state}">${icon(c.state === 'ok' ? 'check' : c.state === 'info' ? 'guide' : 'alert')}<span><b>${esc(c.label)}</b>${esc(c.detail)}</span></li>`).join('')}</ul>
        <h4>作者浏览器中的试加载</h4><ul class="checks">${trialRows(w.trial)}</ul>
      </div>
      <form class="review-form" novalidate>
        <h4>核验清单</h4>
        <ul class="review-list">
          <li><label><input type="checkbox">作品能正常运行，内容符合本题提示词</label></li>
          <li><label><input type="checkbox">模型与档位有可信依据（生成说明、记录链接）</label></li>
          <li><label><input type="checkbox">画面中没有写出模型名称，不会破坏双盲</label></li>
          <li><label><input type="checkbox">没有外部追踪、恶意代码或不当内容</label></li>
        </ul>
        <p class="fine">清单只是提醒，不会随结果保存。</p>
        <div class="field-row">
          <label class="field"><span class="field-label">登记为模型</span><select class="input" name="modelId"><option value="">保持声明：${esc(w.modelName)}</option>${options}</select></label>
          <label class="field"><span class="field-label">推理档位</span><input class="input" name="effort" maxlength="20" value="${esc(w.effort)}" placeholder="默认 / 未设置"></label>
        </div>
        <div class="field-row provenance-fields">
          ${provenanceSelect(ctx, 'harness', w)}
          ${provenanceSelect(ctx, 'provider', w)}
        </div>
        <label class="field"><span class="field-label">Harness 版本<small>选填</small></span><input class="input" name="harnessVersion" maxlength="40" value="${esc(w.harnessVersion ?? '')}" placeholder="例如 2.1.3"></label>
        <label class="field"><span class="field-label">说明<small>标记存疑时必填，作者与访客都能看到</small></span><textarea class="input" name="reason" rows="3" maxlength="500">${esc(w.status === 'questioned' ? w.reason : '')}</textarea></label>
        <p class="form-error" role="alert"></p>
        <div class="sheet-actions">
          <button type="button" class="btn danger ghost" data-remove>${icon('trash')}删除</button>
          <span class="spacer"></span>
          ${w.status !== 'unverified' ? '<button type="button" class="btn ghost" data-decide="unverified">退回未验证</button>' : ''}
          <button type="button" class="btn" data-decide="questioned">${icon('alert')}标记存疑</button>
          <button type="button" class="btn primary" data-decide="verified">${icon('check')}通过验证</button>
        </div>
      </form>
    </div>`,
  });
  const form = $('form', sheet.el);
  updateProvenanceForm(form, ctx);
  form.addEventListener('input', (event) => {
    if (event.target.matches('[data-provenance-choice], [name="harnessOther"], [name="providerOther"]')) updateProvenanceForm(form, ctx);
  });
  form.addEventListener('change', (event) => {
    if (event.target.matches('[data-provenance-choice]')) updateProvenanceForm(form, ctx);
  });
  sheet.el.addEventListener('click', async (e) => {
    if (e.target.closest('a[href^="#"]')) { sheet.close(); return; }
    const suggestion = e.target.closest('[data-select-source]');
    if (suggestion) {
      const choice = form.elements.namedItem(`${suggestion.dataset.selectSource}Choice`);
      if (![...choice.options].some((option) => option.value === suggestion.dataset.sourceId)) {
        const registry = suggestion.dataset.selectSource === 'harness' ? ctx.HARNESSES : ctx.PROVIDERS;
        const option = new Option(registry.get(suggestion.dataset.sourceId).name, suggestion.dataset.sourceId);
        choice.add(option, choice.options[choice.options.length - 1]);
      }
      choice.value = suggestion.dataset.sourceId;
      updateProvenanceForm(form, ctx);
      return;
    }
    const decide = e.target.closest('[data-decide]');
    if (e.target.closest('[data-remove]')) {
      sheet.close();
      await removeWork(w, { admin: true });
      return;
    }
    if (!decide) return;
    let body;
    try {
      body = { status: decide.dataset.decide, reason: form.reason.value, ...changedProvenance(form, w) };
    } catch (error) {
      $('.form-error', form).textContent = error.message;
      return;
    }
    if (form.modelId.value && form.modelId.value !== w.model) body.modelId = form.modelId.value;
    if (form.effort.value !== (w.effort ?? '')) body.effort = form.effort.value;
    $$('[data-decide]', form).forEach((b) => { b.disabled = true; });
    try {
      await api(`works/${encodeURIComponent(w.task)}/${encodeURIComponent(w.id)}/review`, { method: 'POST', body });
      sheet.close();
      const note = onDecided?.() ?? '';
      toast(`已${{ verified: '通过验证', questioned: '标记存疑', unverified: '退回未验证' }[body.status]}：${w.title}${note}`);
      await refreshPlatform('review');
    } catch (error) {
      $('.form-error', form).textContent = error.message;
      $$('[data-decide]', form).forEach((b) => { b.disabled = false; });
    }
  });
}

function review(root, ctx) {
  const tab = Object.hasOwn(TABS, ctx.param ?? '') ? ctx.param : 'unverified';
  const state = { works: null, audit: [], error: '' };
  let active = true, request = 0;
  async function load() {
    const version = ++request;
    if (platform.user?.role !== 'admin') return draw();
    try {
      const data = await api('review');
      if (!active || version !== request) return;
      Object.assign(state, { works: data.works, audit: data.audit, error: '' });
    } catch (error) {
      if (!active || version !== request) return;
      state.error = error.message;
    }
    draw();
  }
  function draw() {
    if (!platform.user) return signedOut(root, ctx, '请先登录管理员账号');
    if (platform.user.role !== 'admin') {
      root.innerHTML = `${ctx.pageStart({ ...ACCOUNT, section: 'me', heading: '作品审核', nav: accountNav(ctx, 'review'), crumbs: [{ text: '个人中心', href: '#/me' }, { text: '作品审核' }] })}<section class="account-empty">${icon('shield')}<h2>只有管理员可以审核作品</h2><p>管理员由站点维护者在服务器上授予。</p><a class="btn primary" href="#/questions">回到题库${icon('right')}</a></section>${ctx.pageEnd()}`;
      return;
    }
    const works = state.works ?? [];
    const count = (status) => works.filter((w) => w.status === status).length;
    const titles = new Map(works.map((w) => [w.id, w.title]));
    const list = tab === 'log'
      ? (state.audit.length ? `<ol class="audit">${state.audit.map((row) => `<li><time>${formatTime(row.at)}</time><span class="audit-actor">${esc(row.actor)}</span><b>${esc(ACTIONS[row.action] ?? row.action)}</b><span class="audit-work">${row.work ? (titles.has(row.work) ? `<a href="#/${esc(row.task)}/${esc(row.work)}">${esc(titles.get(row.work))}</a>` : `<span class="muted">${esc(row.work)}（已删除）</span>`) : ''}${row.detail ? ` · ${esc(row.detail)}` : ''}</span></li>`).join('')}</ol>` : '<p class="muted">还没有记录。</p>')
      : (() => {
        const rows = works.filter((w) => w.status === tab).sort((a, b) => (tab === 'unverified' ? Date.parse(a.addedAt) - Date.parse(b.addedAt) : Date.parse(b.addedAt) - Date.parse(a.addedAt)));
        return rows.length ? `<div class="work-list">${rows.map((w) => workRow(ctx, w, { admin: true })).join('')}</div>`
          : `<div class="board-empty"><p class="board-empty-title">${tab === 'unverified' ? '没有等待核验的作品' : `没有${TABS[tab]}的投稿`}</p><p>${tab === 'unverified' ? '新的投稿会按提交顺序出现在这里。' : '馆藏作品由仓库收录流程管理，不在这里审核。'}</p></div>`;
      })();
    root.innerHTML = `${ctx.pageStart({ ...ACCOUNT, section: 'me', heading: '作品审核', nav: accountNav(ctx, 'review'),
      crumbs: [{ text: '个人中心', href: '#/me' }, { text: '作品审核' }],
      caption: `<nav class="seg review-tabs" aria-label="审核分类">${Object.entries(TABS).map(([id, text]) => `<a href="#/review/${id}"${id === tab ? ' aria-current="page"' : ''}>${text}${id === 'log' || state.works === null ? '' : `<span>${count(id)}</span>`}</a>`).join('')}</nav>` })}
      <section class="submission-section">
        <p class="submission-summary">核对作品能否运行、是否符合题目、生成信息是否可信。无法核实的作品保留作参考，并写明原因。</p>
        ${state.error ? `<p class="form-error">${esc(state.error)}</p>` : ''}
        ${state.works === null ? '<p class="muted">正在载入…</p>' : list}
      </section>
    ${ctx.pageEnd()}`;
    document.title = `审核 · ${ctx.DATA.title}`;
  }
  // After deciding on a waiting work, the next one in the queue (oldest first) opens right away.
  const open = (work) => openReview(ctx, work, {
    onDecided() {
      if (work.status !== 'unverified') return '';
      const next = (state.works ?? []).filter((w) => w.status === 'unverified' && w.id !== work.id).sort((a, b) => Date.parse(a.addedAt) - Date.parse(b.addedAt))[0];
      if (next) { open(next); return ''; }
      return ' · 待核验队列已清空';
    },
  });
  root.onclick = (e) => {
    const reviewButton = e.target.closest('[data-review]');
    const work = reviewButton && state.works?.find((w) => w.id === reviewButton.dataset.review);
    if (work) open(work);
  };
  draw();
  load();
  return { onPlatformChange: load, destroy() { active = false; request++; } };
}

