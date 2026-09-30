// Turnstile is loaded only when the API enables it for registration.
let scriptTask;

export function loadTurnstile() {
  if (globalThis.turnstile) return Promise.resolve(globalThis.turnstile);
  if (!scriptTask) {
    scriptTask = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => {
        if (globalThis.turnstile) resolve(globalThis.turnstile);
        else { script.remove(); reject(new Error('人机验证加载失败，请稍后重试。')); }
      };
      script.onerror = () => { script.remove(); reject(new Error('人机验证加载失败，请检查网络后重试。')); };
      document.head.append(script);
    }).catch((error) => { scriptTask = null; throw error; });
  }
  return scriptTask;
}

export function mountTurnstile(container, siteKey, onState) {
  const turnstile = globalThis.turnstile;
  let token = '';
  let removed = false;
  const widgetId = turnstile.render(container, {
    sitekey: siteKey,
    size: 'flexible',
    callback(value) { if (!removed) { token = value; onState(''); } },
    'expired-callback'() {
      if (removed) return;
      token = '';
      onState('人机验证已过期，正在重新获取。');
      queueMicrotask(() => { if (!removed) turnstile.reset(widgetId); });
    },
    'error-callback'() {
      if (removed) return true;
      token = '';
      onState('人机验证暂时失败，请稍候重试。');
      return false; // Turnstile retries transient errors automatically.
    },
  });
  if (!widgetId) throw new Error('人机验证无法显示，请刷新页面后重试。');
  return {
    get token() { return token; },
    reset() { if (!removed) { token = ''; turnstile.reset(widgetId); } },
    remove() { if (!removed) { removed = true; token = ''; turnstile.remove(widgetId); } },
  };
}
