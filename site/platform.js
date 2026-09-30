// Platform layer: session, uploads, reactions and the dialogs they share. The gallery runs
// without it as a static archive; `platform.available` is false when no API answers.
import { $, $$, esc, icon } from './ui.js';
import { compatibleBuild, fetchApi, resolveApiMedia, setDatapackVersion, staleBuild } from './platform-api.js';
import { loadTurnstile, mountTurnstile } from './turnstile.js';
import { CONTACT } from './legal.js';

export const platform = {
  available: false,
  mismatch: false,
  stale: false,
  serverVersion: null,
  serverDatapack: null,
  user: null,
  site: null,
  works: [],
  questions: [],
  reactions: { counts: {}, mine: {} },
  arena: {},
  totals: { votes: 0, voters: 0, entries: 0 },
  me: null,
  review: null,
};

const listeners = new Set();
export const onPlatformChange = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
const emit = (reason) => listeners.forEach((listener) => listener(reason));

let frontendBuildInfo = null;
export async function connectPlatform(buildInfo = frontendBuildInfo) {
  frontendBuildInfo = buildInfo;
  setDatapackVersion(buildInfo?.datapack);
  try {
    const response = await fetchApi('bootstrap', { cache: 'no-store' });
    if (response.status === 409) { platform.available = false; platform.mismatch = true; return false; }
    if (!response.ok || !(response.headers.get('content-type') ?? '').includes('application/json')) return false;
    const bootstrap = await response.json();
    // Keep diagnostics even when business data must not be merged.
    platform.serverVersion = bootstrap.serverVersion ?? null;
    platform.serverDatapack = bootstrap.datapack ?? null;
    if (!compatibleBuild(buildInfo, bootstrap)) {
      platform.available = false;
      platform.mismatch = true;
      return false;
    }
    Object.assign(platform, resolveApiMedia(bootstrap, 'bootstrap'), { available: true, mismatch: false, stale: staleBuild(buildInfo, bootstrap) });
    return true;
  } catch {
    return false;
  }
}

export async function refreshPlatform(reason = 'refresh') {
  if (!platform.available) return;
  await connectPlatform();
  emit(reason);
}

export class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetchApi(path, {
      method,
      signal,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(0, '网络连接失败，请稍后再试');
  }
  const data = await response.json().catch(() => ({}));
  if (response.headers.get('X-Datapack-Stale') === '1' && !platform.stale) {
    platform.stale = true;
    emit('stale');
  }
  if (!response.ok) {
    if (response.status === 401 && platform.user) {
      platform.user = null;
      emit('session');
    }
    throw new ApiError(response.status, data.error ?? `请求失败（${response.status}）`, data.code);
  }
  const endpoint = path === 'me' || path === 'review' ? path
    : path === 'arena/matches' ? 'match'
      : /^arena\/matches\/[^/]+\/vote$/.test(path) ? 'reveal'
      : path === 'works' || /\/review$/.test(path) ? 'work' : null;
  return resolveApiMedia(data, endpoint);
}

// ---- status -------------------------------------------------------------------------------
export const STATUS = {
  verified: { label: '已验证', hint: '已核验，参与盲评并优先展示', icon: 'check' },
  unverified: { label: '未验证', hint: '等待管理员核验：可以浏览和贴表情，暂不参与盲评', icon: 'clock' },
  questioned: { label: '存疑', hint: '核验存疑：仅供参考，不参与互动与盲评', icon: 'alert' },
};
export function statusBadge(status, { always = false, reason = '' } = {}) {
  const info = STATUS[status];
  if (!info || (status === 'verified' && !always)) return '';
  return `<span class="status status-${status}" title="${esc(reason || info.hint)}">${icon(info.icon)}${info.label}</span>`;
}
// Content moderation holds works and questions back until they pass; only authors and admins see it.
export const MODERATION = {
  pending: { label: '内容审核中', icon: 'clock', tone: 'unverified' },
  review: { label: '等待人工复核', icon: 'clock', tone: 'unverified' },
  rejected: { label: '内容未通过', icon: 'alert', tone: 'questioned' },
};
export function moderationBadge(moderation, hint = '', labels = {}) {
  const info = MODERATION[moderation?.status];
  return info ? `<span class="status status-${info.tone}" title="${esc(hint)}">${icon(info.icon)}${labels[moderation.status] ?? info.label}</span>` : '';
}
// Questions are always reviewed by a person, so a pending one waits for an admin.
export const QUESTION_LABELS = { pending: '等待人工审核' };
// Everything waiting on an admin: unverified or held works, and questions under review.
export const reviewCount = () => (platform.review?.unverified ?? 0) + (platform.review?.questions ?? 0);

// ---- toast and dialogs ------------------------------------------------------------------
let toastTimer = 0;
export function toast(message) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

export function openDialog({ title, body, className = '', onClose }) {
  const dialog = document.createElement('dialog');
  dialog.className = `sheet ${className}`;
  dialog.innerHTML = `<div class="sheet-in">
    <header class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" type="button" data-sheet-close aria-label="关闭">${icon('close')}</button></header>
    <div class="sheet-body">${body}</div>
  </div>`;
  document.body.append(dialog);
  const close = () => { if (dialog.open) dialog.close(); };
  dialog.addEventListener('close', () => { dialog.remove(); onClose?.(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog || e.target.closest('[data-sheet-close]')) close(); });
  dialog.showModal();
  return { el: dialog, close, setTitle: (text) => { $('.sheet-head h2', dialog).textContent = text; } };
}

export function confirmDialog({ title, message, confirm = '确认', danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    const sheet = openDialog({
      title,
      className: 'confirm-sheet',
      body: `<p class="sheet-text">${esc(message)}</p><div class="sheet-actions"><button class="btn" type="button" data-sheet-close>取消</button><button class="btn primary${danger ? ' danger' : ''}" type="button" data-confirm>${esc(confirm)}</button></div>`,
      onClose: () => resolve(answer),
    });
    $('[data-confirm]', sheet.el).addEventListener('click', () => { answer = true; sheet.close(); });
  });
}

// ---- accounts -----------------------------------------------------------------------------
// The "send code" button of an email-code form: Turnstile when the API enables it (its token is
// single-use, so it resets after each send) and a 60-second cooldown. request(token) sends the
// code and returns the notice to show.
export function codeSender(sheet, form, request) {
  let widget = null;
  let countdown = 0;
  let timer = null;
  const send = $('[data-send]', form);
  const errorLine = $('.form-error', form);
  const notice = $('.code-notice', form);
  const challenge = $('.auth-turnstile', form);
  const ready = api('auth/turnstile').then(async ({ siteKey }) => {
    if (!siteKey || !sheet.el.open) return;
    await loadTurnstile();
    if (!sheet.el.open) return;
    challenge.hidden = false;
    widget = mountTurnstile(challenge, siteKey, (message) => { $('.auth-turnstile-status', form).textContent = message; });
  }).catch((error) => { errorLine.textContent = error.message; });
  const tick = () => {
    send.disabled = countdown > 0;
    send.textContent = countdown > 0 ? `${countdown} 秒后重发` : '发送验证码';
  };
  send.addEventListener('click', async () => {
    if (send.disabled) return;
    send.disabled = true;
    errorLine.textContent = '';
    notice.textContent = '';
    await ready;
    if (!sheet.el.open) return;
    if (widget && !widget.token) { errorLine.textContent = '请先完成人机验证。'; send.disabled = false; return; }
    try {
      notice.textContent = await request(widget?.token);
      countdown = 60;
      tick();
      timer = setInterval(() => { countdown--; tick(); if (!countdown) clearInterval(timer); }, 1000);
      form.code.focus();
    } catch (error) {
      errorLine.textContent = error.message;
      send.disabled = false;
    } finally {
      widget?.reset();
    }
  });
  sheet.el.addEventListener('close', () => { widget?.remove(); clearInterval(timer); });
}

// Password recovery in two steps: the emailed code is checked first, then spent on the new
// password. The server answers the same whether or not the account has an email.
function openReset(account = '') {
  return new Promise((resolve) => {
    let done = null;
    let verified = false;
    const sheet = openDialog({
      title: '找回密码',
      className: 'auth-sheet code-sheet',
      onClose: () => resolve(done),
      body: `<form class="auth-form" novalidate>
        <div data-reset-step="1">
          <p class="sheet-text">输入账号，验证码会发到账号绑定的邮箱。没有绑定邮箱的账号，请发邮件至 <a href="mailto:${CONTACT}">${CONTACT}</a> 联系我们。</p>
          <label class="field"><span class="field-label">账号</span><span class="code-row"><input class="input" name="account" autocomplete="username" maxlength="24" value="${esc(account)}"><button class="btn" type="button" data-send>发送验证码</button></span></label>
          <div class="auth-turnstile" hidden></div>
          <p class="auth-turnstile-status" role="status"></p>
          <label class="field"><span class="field-label">验证码</span><input class="input" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 位数字"></label>
        </div>
        <div data-reset-step="2" hidden>
          <p class="sheet-text">验证通过，请设置新密码。重置后，所有设备都需要重新登录。</p>
          <label class="field"><span class="field-label">新密码</span><input class="input" name="password" type="password" autocomplete="new-password" maxlength="128" placeholder="至少 8 位"></label>
          <label class="field"><span class="field-label">确认新密码</span><input class="input" name="confirm" type="password" autocomplete="new-password" maxlength="128"></label>
        </div>
        <p class="form-error" role="alert"></p>
        <p class="code-notice" role="status"></p>
        <div class="sheet-actions"><button class="btn" type="button" data-sheet-close>取消</button><button class="btn primary" type="submit">验证，继续</button></div>
      </form>`,
    });
    const form = $('form', sheet.el);
    const errorLine = $('.form-error', form);
    const username = () => form.account.value.trim();
    codeSender(sheet, form, async (token) => {
      if (!username()) throw new Error('请填写账号。');
      await api('auth/email/send', { method: 'POST', body: { purpose: 'reset', username: username(), turnstileToken: token } });
      return '如果该账号绑定了邮箱，验证码已发送到该邮箱。';
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submit = $('[type="submit"]', form);
      errorLine.textContent = '';
      if (verified && form.password.value !== form.confirm.value) { errorLine.textContent = '两次输入的密码不一致。'; return; }
      submit.disabled = true;
      try {
        if (!verified) {
          await api('auth/email/verify', { method: 'POST', body: { purpose: 'reset', username: username(), code: form.code.value.trim() } });
          verified = true;
          $('[data-reset-step="1"]', form).hidden = true;
          $('[data-reset-step="2"]', form).hidden = false;
          $('.code-notice', form).textContent = '';
          submit.textContent = '重置密码';
          form.password.focus();
        } else {
          await api('auth/password/reset', { method: 'POST', body: { username: username(), code: form.code.value.trim(), password: form.password.value } });
          done = username();
          sheet.close();
          toast('密码已重置，请用新密码登录');
        }
      } catch (error) {
        errorLine.textContent = error.message;
      }
      submit.disabled = false;
    });
    setTimeout(() => (account ? form.code : form.account).focus());
  });
}

export function openAuth({ mode = 'login', reason = '' } = {}) {
  return new Promise((resolve) => {
    let user = null;
    let widget = null;
    let widgetTask = null;
    let widgetGeneration = 0;
    const clearWidget = () => {
      widgetGeneration++;
      widget?.remove();
      widget = null;
      widgetTask = null;
    };
    const sheet = openDialog({
      title: mode === 'login' ? '登录' : '注册',
      className: 'auth-sheet',
      onClose: () => { clearWidget(); resolve(user); },
      body: `<form class="auth-form" novalidate>
        ${reason ? `<p class="auth-reason">${esc(reason)}</p>` : ''}
        <label class="field"><span class="field-label">用户名</span><input class="input" name="name" autocomplete="username" maxlength="24" required></label>
        <label class="field"><span class="field-label">密码</span><input class="input" name="password" type="password" maxlength="128" required></label>
        <button class="auth-forgot" type="button" data-forgot>忘记密码？</button>
        <div class="auth-turnstile" hidden></div>
        <p class="auth-turnstile-status" role="status"></p>
        <p class="form-error" role="alert"></p>
        <p class="auth-legal" hidden>注册即表示你已阅读并同意<a href="#/terms" target="_blank" rel="noopener">《使用条款》</a>与<a href="#/privacy" target="_blank" rel="noopener">《隐私政策》</a></p>
        <button class="btn primary full" type="submit"></button>
        <p class="auth-switch"><span></span><button type="button" data-switch></button></p>
      </form>`,
    });
    const form = $('form', sheet.el);
    const challenge = $('.auth-turnstile', form);
    const challengeStatus = $('.auth-turnstile-status', form);
    const prepareWidget = () => {
      const generation = ++widgetGeneration;
      widgetTask = (async () => {
        const { siteKey } = await api('auth/turnstile');
        if (generation !== widgetGeneration || !sheet.el.open || !siteKey) return null;
        await loadTurnstile();
        if (generation !== widgetGeneration || !sheet.el.open) return null;
        challenge.hidden = false;
        const mounted = mountTurnstile(challenge, siteKey, (message) => {
          if (generation === widgetGeneration) challengeStatus.textContent = message;
        });
        widget = mounted;
        return mounted;
      })().catch((error) => {
        if (generation === widgetGeneration) widgetTask = null;
        throw error;
      });
      return widgetTask;
    };
    const setMode = (next) => {
      clearWidget();
      challenge.hidden = true;
      challengeStatus.textContent = '';
      mode = next;
      const login = mode === 'login';
      sheet.setTitle(login ? '登录' : '注册');
      form.name.placeholder = login ? '' : '2–24 位中文、字母、数字或下划线';
      form.password.placeholder = login ? '' : '至少 8 位';
      form.password.autocomplete = login ? 'current-password' : 'new-password';
      $('[type="submit"]', form).textContent = login ? '登录' : '注册并登录';
      $('.auth-switch span', form).textContent = login ? '还没有账号？' : '已有账号？';
      $('[data-switch]', form).textContent = login ? '注册' : '登录';
      $('.auth-legal', form).hidden = login;
      $('[data-forgot]', form).hidden = !login;
      $('.form-error', form).textContent = '';
      if (!login) {
        const generation = widgetGeneration + 1;
        prepareWidget().catch((error) => {
          if (generation === widgetGeneration && sheet.el.open) $('.form-error', form).textContent = error.message;
        });
      }
    };
    setMode(mode);
    $('[data-switch]', form).addEventListener('click', () => { setMode(mode === 'login' ? 'register' : 'login'); form.name.focus(); });
    // Recovery opens above the sign-in sheet and hands the account back to it.
    $('[data-forgot]', form).addEventListener('click', async () => {
      const account = await openReset(form.name.value.trim());
      if (!account || !sheet.el.open) return;
      form.name.value = account;
      form.password.value = '';
      $('.form-error', form).textContent = '';
      form.password.focus();
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submit = $('[type="submit"]', form);
      const switchButton = $('[data-switch]', form);
      submit.disabled = true;
      switchButton.disabled = true;
      try {
        const challengeWidget = mode === 'register' ? await (widgetTask ?? prepareWidget()) : null;
        if (!sheet.el.open) return;
        if (challengeWidget && !challengeWidget.token) {
          throw new Error('请先完成人机验证，再注册账号。');
        }
        const body = { name: form.name.value, password: form.password.value };
        if (challengeWidget) body.turnstileToken = challengeWidget.token;
        const result = await api(`auth/${mode}`, { method: 'POST', body });
        user = result.user;
        await refreshPlatform('session');
        sheet.close();
        toast(mode === 'login' ? `欢迎回来，${user.nickname || user.name}` : `账号已创建，欢迎你，${user.nickname || user.name}`);
      } catch (error) {
        $('.form-error', form).textContent = error.message;
        if (mode === 'register' && widget?.token) widget.reset();
        submit.disabled = false;
        switchButton.disabled = false;
      }
    });
    setTimeout(() => form.name.focus());
  });
}

export async function requireUser(reason) {
  if (platform.user) return platform.user;
  return openAuth({ reason });
}

async function logout() {
  await api('auth/logout', { method: 'POST' }).catch(() => {});
  await refreshPlatform('session');
  toast('已退出登录');
}

// A library avatar when the server names one it lists; otherwise the name's first letter.
export function avatarFace(id, name) {
  if (id && platform.site?.avatars?.includes(id)) return `<img src="assets/avatars/${esc(id)}.svg" alt="" decoding="async">`;
  return esc([...(name || '?')][0].toUpperCase());
}

// Signed-in accounts open their personal center; narrow screens keep a separate navigation menu.
export function accountControl(current = false) {
  if (!platform.available) return '';
  const user = platform.user;
  const name = user?.nickname || user?.name;
  if (user) return `<div class="account" data-account${current ? ' data-current' : ''}>
    <a class="account-btn signed-in" href="#/me"${current ? ' aria-current="page"' : ''} aria-label="${esc(name)} · 个人中心"><span class="avatar" aria-hidden="true">${avatarFace(user.avatar, name)}</span><span class="account-name">${esc(name)}</span></a>
    <button class="icon-btn account-navigation" data-menu aria-haspopup="true" aria-expanded="false" aria-label="打开导航菜单">${icon('menu')}</button>
  </div>`;
  return `<div class="account" data-account>
    <button class="account-btn" data-menu aria-haspopup="true" aria-expanded="false" aria-label="登录与菜单">
      <span class="account-name">账户</span>
      ${icon('menu')}
      ${reviewCount() ? `<span class="dot" aria-hidden="true"></span>` : ''}
    </button>
  </div>`;
}

function menuHtml() {
  const user = platform.user;
  const nav = `<nav class="menu-nav" aria-label="平台">
    <a href="#/questions" role="menuitem">${icon('grid')}题库</a>
    <a href="#/arena" role="menuitem">${icon('blind')}双盲测试</a>
    <a href="#/leaderboard" role="menuitem">${icon('rank')}排行榜</a>
    <a href="#/new" role="menuitem">${icon('plus')}发起题目</a>
  </nav>`;
  if (!user) {
    return `${nav}<div class="menu-group"><button role="menuitem" data-auth="login">${icon('user')}登录</button><button role="menuitem" data-auth="register">${icon('plus')}注册账号</button></div>`;
  }
  const name = user.nickname || user.name;
  return `${nav}<div class="menu-user"><span class="avatar" aria-hidden="true">${avatarFace(user.avatar, name)}</span><span><b>${esc(name)}</b><small>${user.role === 'admin' ? '管理员' : '成员'} · 已评 ${platform.me?.votes ?? 0} 组</small></span></div>
    <div class="menu-group">
      <a href="#/me" role="menuitem">${icon('user')}个人中心</a>
      ${user.role === 'admin' ? `<a href="#/review" role="menuitem">${icon('shield')}审核${reviewCount() ? `<span class="count">${reviewCount()}</span>` : ''}</a>` : ''}
      <button role="menuitem" data-logout>${icon('logout')}退出登录</button>
    </div>`;
}

function closeMenus() {
  $$('.menu').forEach((menu) => menu.remove());
  $$('[data-menu][aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}

export function refreshAccountControls() {
  closeMenus();
  $$('[data-account]').forEach((el) => { el.outerHTML = accountControl(el.hasAttribute('data-current')); });
}

// ---- reactions ----------------------------------------------------------------------------
export function reactionBar(key, { locked = false } = {}) {
  if (!platform.available) return '';
  const counts = platform.reactions.counts[key] ?? {};
  const mine = new Set(platform.reactions.mine[key] ?? []);
  const pills = platform.site.emojis.filter((emoji) => counts[emoji]).map((emoji) => {
    const own = mine.has(emoji);
    return `<button class="react" type="button" data-react="${emoji}" data-key="${esc(key)}" aria-pressed="${own}" ${locked ? 'disabled' : ''} title="${locked ? '存疑作品不能再互动' : own ? '撤回我的表情' : '也贴一个'}"><span class="emoji">${emoji}</span><span class="n">${counts[emoji]}</span></button>`;
  }).join('');
  if (locked && !pills) return '';
  return `<div class="reactions" data-reactions="${esc(key)}" data-locked="${locked ? 1 : 0}">${pills}${locked ? '' : `<button class="react-add" type="button" data-react-add data-key="${esc(key)}" aria-label="贴表情" title="贴表情">${icon('smile')}</button>`}</div>`;
}

function redrawReactions(key) {
  $$('[data-reactions]').filter((el) => el.dataset.reactions === key).forEach((el) => {
    el.outerHTML = reactionBar(key, { locked: el.dataset.locked === '1' }) || '<div class="reactions" hidden></div>';
  });
}

async function toggleReaction(key, emoji) {
  if (!(await requireUser('登录后就可以给作品贴表情'))) return;
  const [task, ...rest] = key.split('/');
  try {
    const result = await api(`works/${encodeURIComponent(task)}/${encodeURIComponent(rest.join('/'))}/reactions`, { method: 'POST', body: { emoji } });
    platform.reactions.counts[key] = result.counts;
    platform.reactions.mine[key] = result.mine;
    redrawReactions(key);
  } catch (error) {
    toast(error.message);
  }
}

function openPicker(button) {
  closeMenus();
  const key = button.dataset.key;
  const mine = new Set(platform.reactions.mine[key] ?? []);
  const picker = document.createElement('div');
  picker.className = 'menu react-picker';
  picker.setAttribute('role', 'menu');
  picker.innerHTML = platform.site.emojis.map((emoji) => `<button type="button" role="menuitem" data-react="${emoji}" data-key="${esc(key)}" aria-pressed="${mine.has(emoji)}" aria-label="${emoji}">${emoji}</button>`).join('');
  document.body.append(picker);
  const box = button.getBoundingClientRect();
  const width = picker.offsetWidth;
  picker.style.left = `${Math.max(8, Math.min(innerWidth - width - 8, box.left + box.width / 2 - width / 2))}px`;
  picker.style.top = `${box.top > picker.offsetHeight + 16 ? box.top - picker.offsetHeight - 8 + scrollY : box.bottom + 8 + scrollY}px`;
  button.setAttribute('aria-expanded', 'true');
  picker.querySelector('button')?.focus({ preventScroll: true });
}

document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-menu]');
  if (trigger) {
    const open = trigger.getAttribute('aria-expanded') === 'true';
    closeMenus();
    if (open) return;
    const menu = document.createElement('div');
    menu.className = 'menu account-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = menuHtml();
    trigger.closest('[data-account]').append(menu);
    trigger.setAttribute('aria-expanded', 'true');
    return;
  }
  const auth = e.target.closest('[data-auth]');
  if (auth) { closeMenus(); openAuth({ mode: auth.dataset.auth }); return; }
  // Signed out, the personal center has nothing to show yet: sign in first, then open it.
  if (!platform.user && platform.available && e.target.closest('a[href="#/me"]')) {
    e.preventDefault();
    closeMenus();
    openAuth({ reason: '登录后查看你发起的题目与上传的作品。' }).then((user) => { if (user) location.hash = '#/me'; });
    return;
  }
  if (e.target.closest('[data-logout]')) { closeMenus(); logout(); return; }
  const add = e.target.closest('[data-react-add]');
  if (add) { openPicker(add); return; }
  const react = e.target.closest('[data-react]');
  if (react && !react.disabled) { closeMenus(); toggleReaction(react.dataset.key, react.dataset.react); return; }
  if (!e.target.closest('.menu')) closeMenus();
  else if (e.target.closest('.menu a')) closeMenus();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('.menu')) { closeMenus(); e.stopPropagation(); } }, true);
addEventListener('hashchange', closeMenus);
