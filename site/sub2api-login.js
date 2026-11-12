import { api, openAuth, openBindEmail } from './platform.js';
import { apiUrl } from './platform-api.js';

const params = new URLSearchParams(location.search);
const request = params.get('request') ?? '';
const pending = /^[A-Za-z0-9_-]{43}$/.test(request);
const registering = !request && params.get('entry') === 'register';
const binding = pending && params.get('mode') === 'bind';
const button = document.querySelector('#sub2api-continue');
const status = document.querySelector('#sub2api-status');
const sub2Login = 'https://wujisuan.cc/api/v1/auth/oauth/oidc/start?redirect=%2Fdashboard';

function resume() {
  if (registering) {
    location.replace(sub2Login);
    return;
  }
  const url = new URL(apiUrl('sso/sub2api/authorize'), location.href);
  url.searchParams.set('request', request);
  location.replace(url);
}

async function continueLogin() {
  button.disabled = true;
  try {
    if (registering) {
      const session = await api('auth/me', { signal: AbortSignal.timeout(6000) }).catch(() => null);
      if (session?.user) return resume();
    }
    const ready = binding
      ? await openBindEmail({ reason: '验证 亿模亿样 邮箱后，即可继续进入 Sub2API。' })
      : await openAuth({
        mode: registering ? 'register' : 'login',
        reason: '完成 亿模亿样 登录或注册后，即可进入 Sub2API。',
      });
    if (ready) resume();
  } catch {
    status.textContent = '暂时无法继续，请重试。';
  } finally {
    button.disabled = false;
  }
}

if (pending || registering) {
  status.textContent = binding
    ? '这个 亿模亿样 账号需要先验证邮箱。'
    : '登录后可以在 Sub2API 创建 API Key，并查看余额和用量。';
  button.hidden = false;
  button.textContent = binding ? '验证邮箱' : registering ? '注册 亿模亿样 账号' : '登录 亿模亿样';
  button.addEventListener('click', continueLogin);
  if (registering) void continueLogin();
} else {
  status.textContent = '登录请求已失效，请返回 Sub2API 重新发起。';
}
