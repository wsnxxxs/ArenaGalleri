// Personal center (#/me), and the admin review queue (#/review[/<tab>]).
import { $, $$, brandMark, byName, esc, formatBytes, formatDate, formatTime, icon, img } from './ui.js';
import { api, avatarFace, confirmDialog, moderationBadge, openBindEmail, openDialog, platform, QUESTION_LABELS, refreshPlatform, requireUser, reviewCount, statusBadge, toast } from './platform.js';
import { onWorkFieldChange, readWorkFields, workFieldsHtml } from './work-fields.js';
import { CATEGORIES, tagsOf } from './categories.js';

const TABS = { unverified: '未验证', content: '内容复核', questions: '题目', verified: '已验证', questioned: '存疑', log: '记录' };
const ME_TABS = { overview: '概览', works: '我的作品', questions: '我的题目' };
const ACCOUNT = { title: '个人中心', description: '每一道提问，每一份解答，都是你的创作足迹。' };
const ACTIONS = { submit: '提交作品', verified: '通过验证', questioned: '标记存疑', unverified: '退回未验证', delete: '删除作品',
  'question-create': '发起题目', 'question-review': '审核题目', 'question-delete': '删除题目',
  'content-review': '内容审核', 'content-retry': '重新自动审核', meta: '编辑信息' };

export function mount(root, ctx) {
  return ctx.route === 'review' ? review(root, ctx) : mine(root, ctx);
}

// Every personal-center page keeps this sidebar; the review queue is one of its views.
function accountNav(ctx, current) {
  return ctx.sideNav('个人中心', [
    ['#/me', 'user', ME_TABS.overview, current === 'overview'],
    ['#/me/works', 'grid', ME_TABS.works, current === 'works'],
    ['#/me/questions', 'text', ME_TABS.questions, current === 'questions'],
    ...(platform.user?.role === 'admin' ? [['#/review', 'shield', '审核', current === 'review', reviewCount() || undefined]] : []),
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

// What a held work or question means for its author, by moderation status.
const HELD = {
  work: {
    pending: '内容审核中，通过前只有你能看到。',
    review: '等待管理员人工复核，通过前只有你能看到。',
    rejected: '内容审核未通过，作品不会公开。可以删除后重新上传。',
  },
  question: {
    pending: '新题目由管理员人工审核，通过前只有你能看到；附带示例结果时，它的审核进度在「我的作品」里。',
    review: '管理员正在复核，通过前只有你能看到。',
    rejected: '审核未通过，题目不会公开。可以删除后重新发起。',
  },
};
const held = (item) => Boolean(HELD.work[item.moderation?.status]);
// What an admin needs about a held work: the automatic or human verdict and any error code.
function contentNote(w) {
  if (!held(w)) return '';
  const m = w.moderation;
  const text = [m.reason, m.categories?.length ? `类别：${m.categories.join('、')}` : '', m.error ? `错误：${m.error}` : ''].filter(Boolean).join(' · ')
    || (m.status === 'pending' ? '自动审核进行中' : '');
  return text ? `<p class="result-reason">${icon(m.status === 'rejected' ? 'alert' : 'guide')}<span>${esc(text)}</span></p>` : '';
}
function heldNote(kind, item) {
  const status = item.moderation?.status;
  const hint = HELD[kind][status];
  if (!hint) return '';
  const reason = status === 'rejected' && item.moderation.reason ? `原因：${item.moderation.reason}` : '';
  return `<p class="result-reason">${icon(status === 'rejected' ? 'alert' : 'clock')}<span>${esc(hint + reason)}</span></p>`;
}

// questions: unpublished community questions, which are not in the public catalogue yet.
function workRow(ctx, w, { admin = false, questions = [] } = {}) {
  const task = ctx.DATA.tasks.find((t) => t.id === w.task);
  const model = ctx.MODELS.get(w.model) ?? { name: w.modelName };
  const hidden = held(w);
  const variant = task?.promptVariants?.find((v) => v.id === w.promptVariant);
  // A work still under moderation is missing from the public gallery; open its private preview.
  const href = hidden ? esc(w.scene) : `#/${esc(w.task)}/${esc(w.id)}`;
  return `<article class="work-row" data-status="${w.status}">
    ${thumb(ctx, w, { link: false })}
    <div class="work-main">
      <p class="result-model">${brandMark(model, 'brand-mark sm')}<b>${esc(w.modelName)}</b>${w.effort ? `<span class="badge">${esc(w.effort)}</span>` : ''}${moderationBadge(w.moderation, HELD.work[w.moderation?.status])}${statusBadge(w.status, { always: true, reason: w.reason })}</p>
      <h3><a href="${href}"${hidden ? ' target="_blank" rel="noopener"' : ''}>${esc(w.title)}</a></h3>
      <p class="work-meta">${esc(task?.title ?? questions.find((q) => q.id === w.task)?.title ?? w.task)}${variant ? ` · ${esc(variant.label)}` : ''}${ctx.sourceLine(w) ? ` · ${esc(ctx.sourceLine(w))}` : w.tool ? ` · 作者原始声明：${esc(w.tool)}` : ''} · ${formatDate(w.addedAt)}${admin ? ` · 投稿者 ${esc(w.owner ?? '已注销的用户')}` : ''}</p>
      ${admin ? contentNote(w) : heldNote('work', w)}
      ${w.reason ? `<p class="result-reason">${icon('alert')}<span>${esc(w.reason)}</span></p>` : ''}
    </div>
    <div class="work-side">
      ${reactionSummary(w)}
      <div class="actions">
        ${admin
          ? hidden ? `<button class="btn sm primary" data-content="${esc(w.id)}">复核内容</button>` : `<button class="btn sm primary" data-review="${esc(w.id)}">审核</button>`
          : `${w.status === 'unverified' && task ? `<button class="btn sm" data-edit-work="${esc(w.id)}">编辑信息</button>` : ''}<button class="icon-btn" data-delete="${esc(w.id)}" title="删除作品" aria-label="删除「${esc(w.title)}」">${icon('trash')}</button>`}
      </div>
    </div>
  </article>`;
}

// Authors correct their own description until an admin has reviewed the work.
function editWork(ctx, w) {
  const task = ctx.DATA.tasks.find((t) => t.id === w.task);
  const sheet = openDialog({
    title: '编辑作品信息',
    className: 'edit-work-sheet',
    body: `<form class="submit-form" data-edit-form novalidate>
      <p class="sheet-text">核验通过前可以修改。${platform.site.contentModeration ? '改动文字后会重新做内容审核，审核期间作品暂不公开。' : ''}</p>
      ${workFieldsHtml(ctx, task, w)}
      <p class="form-error" role="alert"></p>
      <div class="sheet-actions"><button class="btn" type="button" data-sheet-close>取消</button><button class="btn primary" type="submit">保存</button></div>
    </form>`,
  });
  const form = $('[data-edit-form]', sheet.el);
  form.addEventListener('change', (e) => onWorkFieldChange(form, e.target));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const error = $('.form-error:not(.field-error)', form);
    error.textContent = '';
    const { body, error: problem } = readWorkFields(form, task);
    if (!body) return void (error.textContent = problem);
    const button = $('[type="submit"]', form);
    button.disabled = true;
    try {
      await api(`works/${encodeURIComponent(w.task)}/${encodeURIComponent(w.id)}`, { method: 'PATCH', body });
      sheet.close();
      toast('作品信息已保存');
      await refreshPlatform('edit');
    } catch (err) {
      error.textContent = err.message;
      button.disabled = false;
    }
  });
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
  root.innerHTML = `${ctx.pageStart({ ...ACCOUNT, section: 'me', heading: '审核', crumbs: [{ text: '个人中心', href: '#/me' }, { text: '审核' }] })}<section class="account-empty">
    ${icon('user')}<h2>${esc(text)}</h2>
    <p>登录后，你上传的作品和核验结果会显示在这里。</p>
    <div class="actions"><button class="btn primary" data-auth="login">登录 / 注册</button><a class="btn" href="#/questions">回到题库</a></div>
  </section>${ctx.pageEnd()}`;
}

// A question held by moderation has no public page yet, so it is shown without links.
function questionRow(ctx, question) {
  const task = ctx.DATA.tasks.find((item) => item.id === question.id);
  const works = task?.results.filter(ctx.interactive).length ?? 0;
  const hidden = held(question);
  return `<article class="submission-question">
    <span class="submission-question-mark" aria-hidden="true">${icon('text')}</span>
    <div class="submission-question-body"><h3>${hidden ? esc(question.title) : `<a href="#/${esc(question.id)}">${esc(question.title)}</a>`}${moderationBadge(question.moderation, HELD.question[question.moderation?.status], QUESTION_LABELS)}</h3>
      <p class="summary">${esc(question.summary)}</p>
      <p class="work-meta">${[question.category, ...tagsOf(question).map((tag) => `#${tag}`)].filter(Boolean).map(esc).join(' · ')}<span>${esc(question.date)}${hidden ? '' : ` · ${works} 件作品`}</span></p>
      ${heldNote('question', question)}
    </div><div class="actions">${hidden ? '' : `<a class="btn sm" href="#/${esc(question.id)}">查看题目${icon('next')}</a>`}${works && !hidden ? '' : `<button class="icon-btn" data-delete-question="${esc(question.id)}" title="删除题目" aria-label="删除「${esc(question.title)}」">${icon('trash')}</button>`}</div>
  </article>`;
}

async function removeQuestion(question) {
  const ok = await confirmDialog({
    title: '删除这道题？',
    message: `「${question.title}」会被删除，无法恢复。未公开的题目会连同示例结果一起撤回；已经有人作答的题目不能删除。`,
    confirm: '删除',
    danger: true,
  });
  if (!ok) return false;
  try {
    await api(`questions/${encodeURIComponent(question.id)}`, { method: 'DELETE' });
    toast('题目已删除');
    await refreshPlatform('question');
    return true;
  } catch (error) {
    toast(error.message);
    return false;
  }
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
    ${platform.site?.avatars?.length
      ? `<button class="avatar profile-avatar" type="button" data-edit-avatar aria-label="更换头像" title="更换头像">${avatarFace(user.avatar, name)}<span class="avatar-change" aria-hidden="true">更换</span></button>`
      : `<span class="avatar profile-avatar" role="img" aria-label="${esc(name)}的头像">${avatarFace(user.avatar, name)}</span>`}
    <div class="profile-main">${state.editing ? `<form class="profile-form" data-profile-form>
        <label class="field-label" for="profile-nickname">昵称</label>
        <div class="profile-name-row"><input class="input" id="profile-nickname" name="nickname" value="${esc(name)}" required maxlength="24" autocomplete="nickname"><button class="btn primary" type="submit">保存</button><button class="btn" type="button" data-edit-cancel>取消</button></div>
        <p class="form-error" data-profile-error role="alert" hidden></p>
      </form>` : `<p class="profile-name"><b>${esc(name)}</b><button class="btn sm ghost" type="button" data-edit-name>编辑昵称</button></p>`}
      <p class="profile-account">登录账号 ${esc(user.name)}${state.joinedAt ? ` · ${formatDate(state.joinedAt)} 加入` : ''}</p>
    </div><button class="link profile-logout" type="button" data-logout>退出登录</button>
  </section>
  <section class="profile-bindings" aria-labelledby="bindings-title">
    <div class="profile-section-head"><h2 id="bindings-title">账号绑定</h2><p>注册时绑定，用于找回密码与账号安全验证，可随时更换</p></div>
    <div class="binding-list">
      <div class="binding-row"><span class="binding-icon">${icon('mail')}</span><div class="binding-main"><b>邮箱</b><span>${state.email === undefined ? '正在载入…' : state.email ? esc(maskEmail(state.email)) : '未绑定 · 绑定后才能上传、发起题目和投票'}</span></div>
        <button class="btn sm" type="button" data-bind="email"${state.email === undefined ? ' disabled' : ''}>${state.email ? '更换' : '绑定'}</button></div>
    </div>
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

const AVATAR_NAMES = { teapot: '茶壶', bunny: '兔子', cube: '立方体', cursor: '光标', ghost: '小幽灵', donut: '甜甜圈', brackets: '代码括号', frame: '画框',
  seal: '印章', moon: '月亮', robot: '机器人', cat: '猫', plant: '盆栽', bulb: '灯泡', dice: '骰子', planet: '行星' };

// The avatar library opens from the profile picture; a pick is saved to the account.
function pickAvatar() {
  let chosen = platform.user.avatar;
  const sheet = openDialog({
    title: '更换头像',
    className: 'avatar-sheet',
    body: `<p class="sheet-text">从展馆的小住客里挑一位，它会代替你出现在菜单、个人中心和你发起的题目上。</p>
      <div class="avatar-picks">${platform.site.avatars.map((id) => `<button class="avatar-pick" type="button" data-avatar="${esc(id)}" aria-pressed="${id === chosen}" aria-label="${esc(AVATAR_NAMES[id] ?? id)}" title="${esc(AVATAR_NAMES[id] ?? id)}">${avatarFace(id)}</button>`).join('')}</div>
      <p class="form-error" data-avatar-error role="alert" hidden></p>
      <div class="sheet-actions"><button class="btn" type="button" data-sheet-close>取消</button><button class="btn primary" type="button" data-avatar-save>使用这个头像</button></div>`,
  });
  sheet.el.addEventListener('click', async (e) => {
    const pick = e.target.closest('[data-avatar]');
    if (pick) {
      chosen = pick.dataset.avatar;
      $$('[data-avatar]', sheet.el).forEach((button) => button.setAttribute('aria-pressed', String(button === pick)));
      return;
    }
    const save = e.target.closest('[data-avatar-save]');
    if (!save) return;
    if (chosen === platform.user?.avatar) return sheet.close();
    save.disabled = true;
    save.textContent = '保存中…';
    try {
      await api('me', { method: 'PATCH', body: { avatar: chosen } });
      sheet.close();
      await refreshPlatform('profile');
      toast('头像已更换');
    } catch (error) {
      const line = $('[data-avatar-error]', sheet.el);
      line.textContent = error.message;
      line.hidden = false;
      save.disabled = false;
      save.textContent = '使用这个头像';
    }
  });
}

// a***@example.com: the profile only shows a masked address.
const maskEmail = (email) => {
  const at = email.indexOf('@');
  return at <= 0 ? email : `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`;
};

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
  const empty = { questions: null, works: null, votes: 0, activity: null, receivedReactions: null, joinedAt: null, email: undefined, error: '' };
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
      const [data, account] = await Promise.all([api('me'), api('auth/me')]);
      if (!active || version !== request) return;
      Object.assign(state, { questions: data.questions, works: data.works, votes: data.votes, activity: data.activity, receivedReactions: data.receivedReactions, joinedAt: data.joinedAt, email: account.user?.email ?? null, error: '' });
    } catch (error) {
      if (!active || version !== request) return;
      state.error = error.message;
    }
    draw();
    watch();
  }
  let poll = 0, polls = 0;
  const statusKey = () => JSON.stringify((state.works ?? []).map((w) => [w.id, w.status, w.moderation?.status]));
  function watch() {
    clearTimeout(poll);
    if (!active || polls >= 40 || !(state.works ?? []).some((w) => w.moderation?.status === 'pending')) return;
    poll = setTimeout(async () => {
      polls++;
      const before = statusKey();
      try {
        const data = await api('me');
        if (!active) return;
        Object.assign(state, { questions: data.questions, works: data.works });
      } catch { /* try again next round */ }
      if (statusKey() !== before) draw();
      watch();
    }, 15000);
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
          ? `<p class="submission-summary">${works.length} 件作品${works.some(held) ? ` · ${works.filter(held).length} 件未通过或正在内容审核` : ''} · ${works.filter((w) => w.status === 'unverified' && !held(w)).length} 件等待核验${count('questioned') ? ` · ${count('questioned')} 件存疑` : ''}</p><div class="work-list">${works.map((w) => workRow(ctx, w, { questions: state.questions ?? [] })).join('')}</div>`
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
    if (e.target.closest('[data-edit-avatar]')) return pickAvatar();
    if (e.target.closest('[data-bind="email"]')) return openBindEmail({ change: Boolean(state.email) });
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
    const editButton = e.target.closest('[data-edit-work]');
    if (editButton) {
      const work = state.works?.find((w) => w.id === editButton.dataset.editWork);
      if (work) editWork(ctx, work);
      return;
    }
    const questionButton = e.target.closest('[data-delete-question]');
    if (questionButton) {
      const question = state.questions?.find((q) => q.id === questionButton.dataset.deleteQuestion);
      if (question) await removeQuestion(question);
      return;
    }
    const button = e.target.closest('[data-delete]');
    if (!button) return;
    const work = state.works?.find((w) => w.id === button.dataset.delete);
    if (work) await removeWork(work, { admin: false });
  };
  draw();
  load();
  return { onPlatformChange: load, destroy() { active = false; request++; clearTimeout(poll); root.onsubmit = null; } };
}

// ---- review queue -----------------------------------------------------------------------------
function provenanceSelect(ctx, type, work) {
  const harness = type === 'harness';
  if (!harness) {
    const selected = ctx.providerOf(work)?.id ?? 'unset';
    return `<div class="provenance-field"><label class="field"><span class="field-label">服务商</span>
    <select class="input" name="providerChoice">
      <option value="unset"${selected === 'unset' ? ' selected' : ''}>未注明</option>
      ${[...ctx.PROVIDERS.values()].map((entry) => `<option value="${esc(entry.id)}"${selected === entry.id ? ' selected' : ''}>${esc(entry.name)}</option>`).join('')}
    </select></label></div>`;
  }
  const id = work[type];
  const name = work.harnessName;
  const registry = ctx.HARNESSES;
  const selected = id ? id : name ? 'other' : 'unset';
  const entries = [...registry.values()].filter((entry) => entry.listed || entry.id === id).sort((a, b) => byName(a.name, b.name));
  if (id && !registry.has(id)) entries.push({ id, name: name || id, listed: false });
  return `<div class="provenance-field"><label class="field"><span class="field-label">Harness</span>
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
  const choice = form.elements.namedItem('harnessChoice');
  const other = form.querySelector('[data-provenance-other="harness"]');
  const input = form.elements.namedItem('harnessOther');
  const suggestion = form.querySelector('[data-provenance-suggestion="harness"]');
  other.hidden = choice.value !== 'other';
  suggestion.hidden = true;
  suggestion.replaceChildren();
  const match = choice.value === 'other' && sourceSuggestion(ctx.HARNESSES, input.value);
  if (match) {
    suggestion.append('可能是 ', match.name, ' ');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn sm';
    button.dataset.selectSource = 'harness';
    button.dataset.sourceId = match.id;
    button.textContent = `改选 ${match.name}`;
    suggestion.append(button);
    suggestion.hidden = false;
  }
}

function changedProvenance(form, work, ctx) {
  const body = {};
  const harnessId = work.harness ?? null;
  const harnessName = work.harnessName ?? '';
  const initial = harnessId || (harnessName ? 'other' : 'unset');
  const choice = form.elements.namedItem('harnessChoice').value;
  const other = form.elements.namedItem('harnessOther').value.trim();
  if (choice !== initial || (choice === 'other' && other !== harnessName)) {
    if (choice === 'other') {
      if (!other) throw new Error('请填写 Harness 名称');
      body.harnessId = null;
      body.harnessOther = other;
    } else {
      body.harnessId = choice === 'unset' ? null : choice;
      body.harnessOther = '';
    }
  }
  const provider = form.elements.namedItem('providerChoice').value;
  if (provider !== (ctx.providerOf(work)?.id ?? 'unset')) body.providerId = provider === 'unset' ? null : provider;
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
          <div><dt>Harness</dt><dd>${esc(ctx.harnessOf(w)?.name ?? '未注明')}</dd></div>
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
    if (event.target.matches('[data-provenance-choice], [name="harnessOther"]')) updateProvenanceForm(form, ctx);
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
        const registry = ctx.HARNESSES;
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
      body = { status: decide.dataset.decide, reason: form.reason.value, ...changedProvenance(form, w, ctx) };
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

// Content review: approving releases the work as 未验证, rejecting keeps it hidden with a reason
// the author reads, and a retry sends it through the automatic check again.
function openContent(ctx, w, questions = []) {
  const m = w.moderation ?? {};
  const listed = ctx.DATA.tasks.find((t) => t.id === w.task);
  const task = listed ?? questions.find((q) => q.id === w.task);
  const source = m.source === 'human' ? `人工 · ${m.reviewer ?? ''}` : m.status === 'pending' ? '自动审核进行中' : `自动 · ${m.model ?? '6 Luna'}`;
  const sheet = openDialog({
    title: '复核内容',
    className: 'review-sheet',
    body: `<div class="review">
      <div class="review-facts">
        <div class="review-head">${thumb(ctx, w, { link: false })}<div><h3>${esc(w.title)}</h3><p class="result-model">${moderationBadge(m)}<span>${esc(task?.title ?? w.task)}</span></p>
          <div class="actions"><a class="btn sm" href="${esc(w.scene)}" target="_blank" rel="noopener">打开作品${icon('arrow')}</a></div></div></div>
        <dl class="facts">
          <div><dt>投稿者</dt><dd>${esc(w.owner ?? '已注销的用户')} · ${formatTime(w.addedAt)}</dd></div>
          <div><dt>审核来源</dt><dd>${esc(source)}</dd></div>
          <div><dt>结论</dt><dd>${esc(m.reason || '暂无')}</dd></div>
          ${m.categories?.length ? `<div><dt>风险类别</dt><dd>${esc(m.categories.join('、'))}</dd></div>` : ''}
          ${m.error ? `<div><dt>未完成原因</dt><dd>${esc(m.error)}</dd></div>` : ''}
        </dl>
        ${listed ? '' : '<p class="fine">这是新题目的示例结果：题目通过人工审核后，内容通过的结果才会公开。</p>'}
      </div>
      <form class="review-form" novalidate>
        <label class="field"><span class="field-label">理由<small>拒绝时必填，作者会看到</small></span><textarea class="input" name="reason" rows="3" maxlength="500"></textarea></label>
        <p class="form-error" role="alert"></p>
        <div class="sheet-actions">
          ${platform.site.contentModeration && m.status !== 'pending' ? '<button type="button" class="btn ghost" data-content-act="retry">重新自动审核</button>' : ''}
          <span class="spacer"></span>
          ${m.status === 'rejected' ? '' : `<button type="button" class="btn danger" data-content-act="rejected">${icon('close')}拒绝</button>`}
          <button type="button" class="btn primary" data-content-act="approved">${icon('check')}通过并公开</button>
        </div>
      </form>
    </div>`,
  });
  const form = $('form', sheet.el);
  sheet.el.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-content-act]')?.dataset.contentAct;
    if (!act) return;
    const reason = form.reason.value.trim();
    const error = $('.form-error', form);
    if (act === 'rejected' && !reason) { error.textContent = '请写明拒绝理由'; form.reason.focus(); return; }
    $$('[data-content-act]', form).forEach((b) => { b.disabled = true; });
    const path = `works/${encodeURIComponent(w.task)}/${encodeURIComponent(w.id)}/moderation`;
    try {
      if (act === 'retry') await api(`${path}/retry`, { method: 'POST' });
      else await api(path, { method: 'POST', body: { status: act, reason: reason || '人工复核通过' } });
      sheet.close();
      toast(`${{ retry: '已重新提交自动审核', approved: '内容已通过，作品公开为「未验证」', rejected: '已拒绝，作者会看到理由' }[act]}：${w.title}`);
      await refreshPlatform('review');
    } catch (err) {
      error.textContent = err.message;
      $$('[data-content-act]', form).forEach((b) => { b.disabled = false; });
    }
  });
}

const questionWaiting = (q) => ['pending', 'review'].includes(q.moderation?.status);

// A sample result sent with a new question; admins open its private preview before deciding.
function sampleRow(w) {
  return `<li>${esc(w.modelName)}${w.effort ? ` · ${esc(w.effort)}` : ''} · ${esc(w.title)}${moderationBadge(w.moderation, HELD.work[w.moderation?.status])}${w.scene ? `<a class="text-link" href="${esc(w.scene)}" target="_blank" rel="noopener">预览结果${icon('arrow')}</a>` : ''}${w.moderation?.status === 'review' ? '<a class="text-link" href="#/review/content">去复核内容</a>' : ''}</li>`;
}

function reviewQuestionRow(q) {
  const status = q.moderation?.status ?? 'legacy';
  const shown = ['legacy', 'approved'].includes(status);
  const detail = [q.moderation?.reason, q.moderation?.categories?.length ? `类别：${q.moderation.categories.join('、')}` : '']
    .filter(Boolean).join(' · ');
  const samples = q.samples ?? [];
  return `<article class="submission-question review-question">
    <span class="submission-question-mark" aria-hidden="true">${icon('text')}</span>
    <div class="submission-question-body"><h3>${shown ? `<a href="#/${esc(q.id)}">${esc(q.title)}</a>` : esc(q.title)}${moderationBadge(q.moderation, '', QUESTION_LABELS)}</h3>
      <p class="summary">${esc(q.summary)}</p>
      <p class="work-meta">${esc(q.ownerName ?? q.owner ?? '已注销的用户')}<span>${esc(q.date)} · ${q.works ?? 0} 件作品</span>${q.category ? `<span>${esc(q.category)}</span>` : ''}${tagsOf(q).map((tag) => `<span>#${esc(tag)}</span>`).join('')}</p>
      ${detail ? `<p class="result-reason">${icon(status === 'rejected' ? 'alert' : 'guide')}<span>${esc(detail)}</span></p>` : ''}
      ${samples.length ? `<ul class="question-samples">${samples.map(sampleRow).join('')}</ul>` : shown ? '' : '<p class="result-reason"><span>没有附带示例结果。</span></p>'}
      <details class="prompt-peek"><summary>${icon('guide')}完整提示词</summary><pre>${esc(q.prompt)}</pre></details>
    </div>
    <div class="actions">
      ${shown ? '' : `<button class="btn sm primary" data-q-decide="approved" data-q="${esc(q.id)}">通过</button>`}
      ${status === 'rejected' ? '' : `<button class="btn sm" data-q-decide="rejected" data-q="${esc(q.id)}">拒绝</button>`}
      <button class="icon-btn" data-q-delete="${esc(q.id)}" title="删除题目" aria-label="删除「${esc(q.title)}」">${icon('trash')}</button>
    </div>
  </article>`;
}

// Approving needs no reason and can correct the category; rejecting requires a reason the author will read.
function decideQuestion(q, status) {
  return new Promise((resolve) => {
    let saved = false;
    const sheet = openDialog({
      title: status === 'approved' ? '通过这道题？' : '拒绝这道题',
      className: 'confirm-sheet',
      onClose: () => resolve(saved),
      body: `<form data-q-form novalidate>
        <p class="sheet-text">「${esc(q.title)}」${status === 'approved' ? '会公开到题库并开放投稿。' : '不会公开，作者会看到下面的理由。'}</p>
        ${status === 'approved' ? `<label class="field"><span class="field-label">题目分类<i>*</i></span><select class="input" name="category" required><option value="">请选择</option>${CATEGORIES.map((c) => `<option value="${esc(c.name)}"${c.name === q.category ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>` : ''}
        <label class="field"><span class="field-label">理由${status === 'rejected' ? '<i>*</i>' : '<small>选填</small>'}</span><textarea class="input" name="reason" rows="3" maxlength="500"></textarea></label>
        <p class="form-error" role="alert"></p>
        <div class="sheet-actions"><button class="btn" type="button" data-sheet-close>取消</button><button class="btn primary${status === 'rejected' ? ' danger' : ''}" type="submit">${status === 'approved' ? '通过' : '拒绝'}</button></div>
      </form>`,
    });
    const form = $('[data-q-form]', sheet.el);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const reason = form.reason.value.trim();
      const error = $('.form-error', form);
      if (status === 'rejected' && !reason) { error.textContent = '请写明拒绝理由'; form.reason.focus(); return; }
      const category = form.category?.value;
      if (status === 'approved' && !category) { error.textContent = '请选择题目分类'; form.category.focus(); return; }
      const button = $('[type="submit"]', form);
      button.disabled = true;
      try {
        await api(`questions/${encodeURIComponent(q.id)}/moderation`, { method: 'POST', body: { status, reason, ...(category ? { category } : {}) } });
        saved = true;
        sheet.close();
        // Settle on success too, so the list refreshes even if the close event never arrives.
        resolve(true);
        toast(status === 'approved' ? '题目已通过' : '题目已拒绝');
      } catch (err) {
        error.textContent = err.message;
        button.disabled = false;
      }
    });
  });
}

function review(root, ctx) {
  const tab = Object.hasOwn(TABS, ctx.param ?? '') ? ctx.param : 'unverified';
  const state = { works: null, audit: [], questions: null, questionsError: '', error: '' };
  let active = true, request = 0;
  async function load() {
    const version = ++request;
    if (platform.user?.role !== 'admin') return draw();
    try {
      // An older API has no question review; the works tabs keep working without it.
      const [data, questions] = await Promise.all([api('review'),
        api('admin/questions').then((body) => ({ list: body.questions }), (error) => ({ error: error.status === 404 ? '后端暂不支持题目审核。' : error.message }))]);
      if (!active || version !== request) return;
      Object.assign(state, { works: data.works, audit: data.audit, error: '',
        questions: questions.list ?? state.questions ?? [], questionsError: questions.error ?? '' });
    } catch (error) {
      if (!active || version !== request) return;
      state.error = error.message;
    }
    draw();
  }
  function draw() {
    if (!platform.user) return signedOut(root, ctx, '请先登录管理员账号');
    if (platform.user.role !== 'admin') {
      root.innerHTML = `${ctx.pageStart({ ...ACCOUNT, section: 'me', heading: '审核', nav: accountNav(ctx, 'review'), crumbs: [{ text: '个人中心', href: '#/me' }, { text: '审核' }] })}<section class="account-empty">${icon('shield')}<h2>只有管理员可以审核作品</h2><p>管理员由站点维护者在服务器上授予。</p><a class="btn primary" href="#/questions">回到题库${icon('right')}</a></section>${ctx.pageEnd()}`;
      return;
    }
    const works = state.works ?? [];
    // Verification waits for released content and a public question; a pending question's
    // sample is reviewed from the 题目 tab first.
    const listed = (w) => ctx.DATA.tasks.some((t) => t.id === w.task);
    const inTab = (w, id) => (id === 'content' ? held(w) : w.status === id && !(id === 'unverified' && (held(w) || !listed(w))));
    const titles = new Map(works.map((w) => [w.id, w.title]));
    const questions = state.questions ?? [];
    const questionTitles = new Map([...ctx.DATA.tasks, ...questions].map((q) => [q.id, q.title]));
    const tabCount = (id) => (id === 'questions' ? questions.filter(questionWaiting).length
      : id === 'content' ? works.filter((w) => w.moderation?.status === 'review').length
      : works.filter((w) => inTab(w, id)).length);
    const list = tab === 'log'
      ? (state.audit.length ? `<ol class="audit">${state.audit.map((row) => `<li><time>${formatTime(row.at)}</time><span class="audit-actor">${esc(row.actor)}</span><b>${esc(ACTIONS[row.action] ?? row.action)}</b><span class="audit-work">${!row.work && row.action?.startsWith('question-') && row.task ? esc(questionTitles.get(row.task) ?? row.task) : ''}${row.work ? (titles.has(row.work) ? `<a href="#/${esc(row.task)}/${esc(row.work)}">${esc(titles.get(row.work))}</a>` : `<span class="muted">${esc(row.work)}（已删除）</span>`) : ''}${row.detail ? ` · ${esc(row.detail)}` : ''}</span></li>`).join('')}</ol>` : '<p class="muted">还没有记录。</p>')
      : tab === 'questions' ? (() => {
        if (state.questionsError) return `<p class="muted">${esc(state.questionsError)}</p>`;
        const waiting = questions.filter(questionWaiting).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
        const rest = questions.filter((q) => !questionWaiting(q));
        return questions.length ? `<div class="submission-questions">${[...waiting, ...rest].map(reviewQuestionRow).join('')}</div>`
          : '<div class="board-empty"><p class="board-empty-title">还没有社区题目</p><p>用户发起的题目会在这里审核；待审的排在最前。</p></div>';
      })()
      : (() => {
        // Content: works waiting on a person first, then those still being checked, then rejections.
        const rank = { review: 0, pending: 1, rejected: 2 };
        const oldest = (a, b) => Date.parse(a.addedAt) - Date.parse(b.addedAt);
        const rows = works.filter((w) => inTab(w, tab)).sort(tab === 'content'
          ? (a, b) => rank[a.moderation.status] - rank[b.moderation.status] || oldest(a, b)
          : tab === 'unverified' ? oldest : (a, b) => oldest(b, a));
        const empty = { unverified: ['没有等待核验的作品', '内容审核通过的投稿会按提交顺序出现在这里。'],
          content: ['没有需要复核内容的作品', '自动审核没能确定或被拒绝的投稿会出现在这里。'] }[tab]
          ?? [`没有${TABS[tab]}的投稿`, '馆藏作品由仓库收录流程管理，不在这里审核。'];
        return rows.length ? `<div class="work-list">${rows.map((w) => workRow(ctx, w, { admin: true, questions })).join('')}</div>`
          : `<div class="board-empty"><p class="board-empty-title">${empty[0]}</p><p>${empty[1]}</p></div>`;
      })();
    root.innerHTML = `${ctx.pageStart({ ...ACCOUNT, section: 'me', heading: '审核', nav: accountNav(ctx, 'review'),
      crumbs: [{ text: '个人中心', href: '#/me' }, { text: '审核' }],
      caption: `<nav class="seg review-tabs" aria-label="审核分类">${Object.entries(TABS).map(([id, text]) => `<a href="#/review/${id}"${id === tab ? ' aria-current="page"' : ''}>${text}${id === 'log' || state.works === null ? '' : `<span>${tabCount(id)}</span>`}</a>`).join('')}</nav>` })}
      <section class="submission-section">
        <p class="submission-summary">${{
          questions: '题目必须人工审核，通过后才进入题库并开放投稿。确认提示词是一项具体、可比较的生成任务；拒绝时写明理由，作者会看到。',
          content: '自动审核通过的作品直接公开为「未验证」；没能确定的在这里人工复核。通过后公开，拒绝时写明理由，作者会看到。',
        }[tab] ?? '核对作品能否运行、是否符合题目、生成信息是否可信。无法核实的作品保留作参考，并写明原因。'}</p>
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
  // Question decisions, retries and deletions; returns false when the click is not one of them.
  async function questionAction(e) {
    const decide = e.target.closest('[data-q-decide]');
    const remove = e.target.closest('[data-q-delete]');
    const id = decide?.dataset.q ?? remove?.dataset.qDelete;
    const q = id && state.questions?.find((item) => item.id === id);
    if (!q) return false;
    const path = `questions/${encodeURIComponent(q.id)}`;
    try {
      if (decide && !(await decideQuestion(q, decide.dataset.qDecide))) return true;
      if (remove) {
        if (!(await confirmDialog({ title: '删除这道题？', message: `「${q.title}」会从题库中移除并写入审核记录。已有作品或投票的题目需要先处理作品。`, confirm: '删除', danger: true }))) return true;
        await api(path, { method: 'DELETE' });
        toast('题目已删除');
      }
    } catch (err) {
      toast(err.message);
      return true;
    }
    await refreshPlatform('question');
    return true;
  }
  root.onclick = async (e) => {
    if (await questionAction(e)) return;
    const reviewButton = e.target.closest('[data-review]');
    const work = reviewButton && state.works?.find((w) => w.id === reviewButton.dataset.review);
    if (work) open(work);
    const contentButton = e.target.closest('[data-content]');
    const heldWork = contentButton && state.works?.find((w) => w.id === contentButton.dataset.content);
    if (heldWork) openContent(ctx, heldWork, state.questions ?? []);
  };
  draw();
  load();
  return { onPlatformChange: load, destroy() { active = false; request++; } };
}

