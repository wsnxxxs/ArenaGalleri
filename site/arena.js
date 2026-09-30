// Blind comparison: a lobby of tasks (#/arena) and the match itself (#/arena/<task>).
// The server picks every pair and hands out opaque frame addresses; nothing on this page
// knows which work is which until the vote comes back with the reveal.
import { $, $$, brandMark, esc, icon, pad, themeButton } from './ui.js';
import { api, platform, reactionBar, toast } from './platform.js';

const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-pointer-lock allow-downloads';
const VERDICT = { a: '你认为 A 更好', b: '你认为 B 更好', tie: '你认为不分伯仲', skip: '你跳过了这一组' };
const REASON = {
  counted: '已计入榜单',
  anonymous: '未登录，这一票没有计入榜单',
  duplicate: '这一对作品你评过了，这次不重复计入',
  changed: '作品的核验状态刚刚变化，这一票没有计入',
  own: '其中有你上传的作品，不计入',
  skipped: '跳过的组合不计入榜单',
};

export function mount(root, ctx) {
  if (!ctx.param) return lobby(root, ctx);
  const task = ctx.DATA.tasks.find((t) => t.id === ctx.param);
  if (!task) {
    location.replace('#/arena');
    return {};
  }
  return match(root, ctx, task);
}

function lobby(root, ctx) {
  const draw = () => {
    const tasks = ctx.DATA.tasks.map((t, i) => ({ t, i, pool: platform.arena[t.id] ?? { works: 0, entries: 0 } }));
    const open = tasks.filter(({ pool }) => pool.entries >= 2);
    root.innerHTML = `${ctx.pageStart({ title: '双盲测试', section: 'arena', heading: '选择一道题，开始比较',
      description: '同一道题，两件匿名作品。只凭体验选出你更认可的一件，投票后揭晓模型身份。',
      meta: `<dl class="side-stats">
            <div><dt>可评题目</dt><dd>${pad(open.length)}</dd></div>
            <div><dt>有效比较</dt><dd>${pad(platform.totals.votes)}</dd></div>
            ${platform.user ? `<div><dt>你已评</dt><dd>${pad(platform.me?.votes ?? 0)}</dd></div>` : ''}
          </dl>${open.length ? `<button class="btn primary side-cta" data-random>${icon('blind')}随机一道题</button>` : ''}` })}
      <section class="block wrap">
        <ol class="rules">
          <li><span class="num">01</span><h3>同题，匿名</h3><p>两件作品来自同一道题、不同的模型配置。左右位置随机，作品地址也不透露身份。</p></li>
          <li><span class="num">02</span><h3>先体验，再选择</h3><p>分别打开、操作两件作品，再选「A 更好」「B 更好」或「不分伯仲」。认出作品或页面异常时，请跳过。</p></li>
          <li><span class="num">03</span><h3>计入榜单</h3><p>登录后的选择计入榜单，每对作品每人计一次。只有已验证作品参与，你上传的作品不会出现在你面前。</p></li>
        </ol>
      </section>
      <section class="block wrap">
        <div class="block-head"><h2>选择题目</h2><p>至少有两个不同模型配置的已验证作品，才能开始盲评</p></div>
        <ul class="arena-tasks">${tasks.map(({ t, i, pool }) => {
          const ready = pool.entries >= 2;
          return `<li class="arena-task${ready ? '' : ' is-closed'}"><a ${ready ? `href="#/arena/${esc(t.id)}"` : 'aria-disabled="true"'}>
            <span class="num">No.${pad(i + 1)}</span>
            <span class="arena-task-title"><b>${esc(t.title)}</b><small>${esc(t.summary)}</small></span>
            <span class="arena-task-meta">${pool.works} 件作品<br>${pool.entries} 个配置</span>
            <span class="arena-task-go">${ready ? `开始${icon('right')}` : '作品不足'}</span>
          </a></li>`;
        }).join('')}</ul>
        ${platform.user ? '' : '<p class="arena-login">未登录也可以体验盲评，但选择不会计入榜单。<button class="link" data-auth="login">登录</button></p>'}
      </section>
    ${ctx.pageEnd()}`;
    root.onclick = (e) => {
      if (!e.target.closest('[data-random]') || !open.length) return;
      location.hash = `#/arena/${open[Math.floor(Math.random() * open.length)].t.id}`;
    };
    document.title = `盲评 · ${ctx.DATA.title}`;
  };
  draw();
  return { onPlatformChange: draw, destroy() {} };
}

function match(root, ctx, task) {
  const state = { match: null, result: null, ready: {}, seen: {}, side: 'a', round: 0, counted: 0, busy: false, prompt: false, slow: false, error: null };
  const mobile = () => matchMedia('(max-width: 860px)').matches;
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };

  document.body.classList.add('is-viewer');
  document.title = `盲评 · ${task.title}`;
  root.innerHTML = `<div class="viewer arena">
    <header class="vbar">
      <a class="vback" href="#/arena" title="返回双盲测试">${icon('prev')}<span class="vback-text">双盲测试</span></a>
      <div class="arena-heading"><b>${esc(task.title)}</b><span data-round>正在准备</span></div>
      <div class="vtools">
        <button class="vtool" data-a="prompt" aria-pressed="false" title="查看提示词">${icon('guide')}<span class="vtool-text">提示词</span></button>
        <a class="vtool" href="#/leaderboard/${esc(task.id)}" title="这道题的榜单">${icon('rank')}<span class="vtool-text">榜单</span></a>
        <span class="vdivider" aria-hidden="true"></span>
        ${themeButton('vtool icon-only')}
      </div>
    </header>
    <div class="arena-switch seg" role="group" aria-label="切换作品">
      <button data-a="side" data-side="a" aria-pressed="true">作品 A<i data-dot="a"></i></button>
      <button data-a="side" data-side="b" aria-pressed="false">作品 B<i data-dot="b"></i></button>
    </div>
    <div class="vmain">
      <div class="stage arena-stage">${['a', 'b'].map((side) => `<section class="pane arena-pane" data-side="${side}">
        <div class="arena-head" data-head="${side}"></div>
        <div class="pane-body" data-body="${side}"></div>
      </section>`).join('')}</div>
      <aside class="guide arena-prompt" aria-label="提示词"><div class="guide-in">
        <div class="guide-head"><div><p class="eyebrow">本题提示词</p><h2>${esc(task.title)}</h2></div><button class="icon-btn" data-a="prompt" aria-label="收起提示词">${icon('close')}</button></div>
        <pre class="arena-prompt-text">${esc(task.prompt)}</pre>
      </div></aside>
    </div>
    <footer class="vote-bar" data-bar></footer>
  </div>`;
  const el = $('.arena', root);

  const letter = (side) => side.toUpperCase();
  function blindHead(side) {
    const ready = state.ready[side];
    return `<span class="pane-letter">${letter(side)}</span><span class="arena-who">匿名作品</span>
      <span class="arena-state${ready ? ' is-ready' : ''}">${ready ? '已就绪' : '载入中'}</span>
      <button class="pane-close" data-a="reload" data-side="${side}" title="重新载入作品 ${letter(side)}" aria-label="重新载入作品 ${letter(side)}">${icon('reload')}</button>`;
  }
  function revealHead(side) {
    const work = state.result[side];
    if (!work) return `<span class="pane-letter">${letter(side)}</span><span class="arena-who">作品已不可用</span>`;
    const model = ctx.MODELS.get(work.model) ?? { name: work.modelName };
    const chosen = state.result.choice === side;
    return `<span class="pane-letter">${letter(side)}</span>${brandMark(model, 'brand-mark sm')}
      <span class="arena-who revealed"><b>${esc(work.modelName)}</b>${work.effort ? `<span class="badge">${esc(work.effort)}</span>` : ''}<small>${esc(work.title)}${work.curated ? '' : ' · 投稿'}</small></span>
      ${chosen ? '<span class="chosen-tag">你的选择</span>' : ''}
      ${reactionBar(`${task.id}/${work.id}`, { locked: work.status === 'questioned' })}
      <a class="pane-close" href="#/${esc(task.id)}/${esc(work.id)}" title="在展厅中打开" aria-label="在展厅中打开 ${esc(work.title)}">${icon('arrow')}</a>`;
  }

  const canVote = () => Boolean(state.match && !state.result && state.ready.a && state.ready.b && (!mobile() || (state.seen.a && state.seen.b)));

  function status() {
    if (!state.match) return '正在抽取一组作品…';
    if (!(state.ready.a && state.ready.b)) {
      const parts = ['a', 'b'].map((side) => `${letter(side)} ${state.ready[side] ? '已就绪' : '载入中'}`).join(' · ');
      return state.slow ? `载入较慢（${parts}）：可以继续等待，或跳过这一组` : `等待两件作品载入 · ${parts}`;
    }
    if (mobile() && !(state.seen.a && state.seen.b)) return `请先切换到作品 ${state.seen.a ? 'B' : 'A'} 看一看`;
    return platform.user ? '体验过两件作品后，选出你更认可的一件' : '未登录：可以体验，但这一组的选择不会计入榜单';
  }

  function drawBar() {
    const bar = $('[data-bar]', el);
    if (state.error) {
      bar.innerHTML = '';
      return;
    }
    if (state.result) {
      const { choice, counted, reason } = state.result;
      bar.innerHTML = `<div class="vote-in is-result">
        <p class="vote-verdict"><b>${VERDICT[choice]}</b><span>${REASON[counted ? 'counted' : reason] ?? ''}${state.counted ? ` · 本次已计入 ${state.counted} 组` : ''}${!counted && reason === 'anonymous' ? ' <button class="link" data-auth="login">登录</button>' : ''}</span></p>
        <div class="vote-actions"><a class="btn" href="#/leaderboard/${esc(task.id)}">${icon('rank')}查看榜单</a><button class="btn primary" data-a="next">下一组<kbd>N</kbd></button></div>
      </div>`;
      return;
    }
    const ready = canVote();
    const disabled = ready && !state.busy ? '' : ' disabled';
    bar.innerHTML = `<div class="vote-in">
      <p class="vote-status">${status()}${!platform.user && state.match ? ' <button class="link" data-auth="login">登录</button>' : ''}</p>
      <div class="vote-actions">
        <button class="btn vote" data-vote="a"${disabled}><kbd>A</kbd>A 更好</button>
        <button class="btn vote vote-tie" data-vote="tie"${disabled}><kbd>S</kbd>不分伯仲</button>
        <button class="btn vote" data-vote="b"${disabled}>B 更好<kbd>D</kbd></button>
      </div>
      <button class="link vote-skip" data-vote="skip"${state.match && !state.busy ? '' : ' disabled'}>跳过这一组</button>
    </div>`;
  }

  function drawHeads() {
    for (const side of ['a', 'b']) {
      $(`[data-head="${side}"]`, el).innerHTML = state.result ? revealHead(side) : blindHead(side);
      $(`[data-side="${side}"].arena-pane`, el).classList.toggle('chosen', state.result?.choice === side);
      const dot = $(`[data-dot="${side}"]`, el);
      if (dot) dot.className = state.ready[side] ? 'is-ready' : '';
    }
    $('[data-round]', el).textContent = state.match ? `第 ${state.round} 组${state.result ? ' · 已揭晓' : ' · 双盲'}` : '正在准备';
  }

  function drawSide() {
    el.dataset.side = state.side;
    $$('[data-a="side"]', el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.side === state.side)));
  }

  const update = () => { drawHeads(); drawBar(); drawSide(); };

  function frame(side) {
    const body = $(`[data-body="${side}"]`, el);
    state.ready[side] = false;
    body.innerHTML = `<iframe src="${esc(state.match[side])}" title="匿名作品 ${letter(side)}" sandbox="${SANDBOX}" allow="fullscreen; autoplay" allowfullscreen referrerpolicy="no-referrer"></iframe>
      <div class="loader blind"><div class="spinner" aria-hidden="true"></div><b>作品 ${letter(side)}</b><span>正在载入</span></div>`;
    const current = state.match;
    $('iframe', body).addEventListener('load', () => {
      if (state.match !== current) return;
      state.ready[side] = true;
      later(() => $('.loader', body)?.classList.add('gone'), 300);
      update();
    }, { once: true });
  }

  function showError(error) {
    state.error = error;
    const others = ctx.DATA.tasks.filter((t) => t !== task && (platform.arena[t.id]?.entries ?? 0) >= 2);
    const exhausted = error.code === 'exhausted';
    $('.arena-stage', el).innerHTML = `<div class="arena-empty">
      <p class="kicker"><span class="num">${exhausted ? '已评完' : '暂停'}</span></p>
      <h2>${esc(exhausted ? '这道题的组合你都评过了' : error.message)}</h2>
      <p>${exhausted ? '感谢你的每一次选择。换一道题继续，或去看看榜单的变化。' : '稍后再来，或者先去看看其他题目。'}</p>
      <div class="actions">${others.slice(0, 3).map((t) => `<a class="btn" href="#/arena/${esc(t.id)}">${esc(t.title)}${icon('right')}</a>`).join('')}<a class="btn primary" href="#/leaderboard/${esc(task.id)}">${icon('rank')}查看榜单</a></div>
    </div>`;
    drawBar();
  }

  async function next() {
    if (state.busy || state.error) return;
    state.busy = true;
    const previous = state.match?.id;
    Object.assign(state, { match: null, result: null, ready: {}, seen: { a: true }, side: 'a', slow: false });
    $$('[data-body]', el).forEach((body) => { body.innerHTML = '<div class="loader blind"><div class="spinner" aria-hidden="true"></div><b>盲评</b><span>正在抽取一组作品</span></div>'; });
    update();
    try {
      state.match = await api('arena/matches', { method: 'POST', body: { task: task.id, previous } });
      state.round++;
      frame('a');
      frame('b');
      const current = state.match;
      later(() => { if (state.match === current && !(state.ready.a && state.ready.b)) { state.slow = true; update(); } }, 25000);
    } catch (error) {
      state.busy = false;
      return showError(error);
    }
    state.busy = false;
    update();
  }

  async function vote(choice) {
    if (state.busy || state.result || !state.match || (choice !== 'skip' && !canVote())) return;
    state.busy = true;
    drawBar();
    try {
      state.result = await api(`arena/matches/${state.match.id}/vote`, { method: 'POST', body: { choice } });
      if (state.result.counted) {
        state.counted++;
        platform.totals.votes++;
        if (platform.me) platform.me.votes++;
      }
    } catch (error) {
      toast(error.message);
      if (error.status === 404) { state.busy = false; return next(); }
    }
    state.busy = false;
    update();
  }

  function togglePrompt(force) {
    state.prompt = force ?? !state.prompt;
    el.classList.toggle('guide-open', state.prompt);
    $$('[data-a="prompt"]', el).forEach((b) => b.setAttribute('aria-pressed', String(state.prompt)));
  }

  el.addEventListener('click', (e) => {
    const voteButton = e.target.closest('[data-vote]');
    if (voteButton && !voteButton.disabled) return vote(voteButton.dataset.vote);
    const action = e.target.closest('[data-a]');
    if (!action) return;
    const kind = action.dataset.a;
    if (kind === 'next') next();
    else if (kind === 'prompt') togglePrompt();
    else if (kind === 'reload' && state.match && !state.result) frame(action.dataset.side);
    else if (kind === 'side') {
      state.side = action.dataset.side;
      state.seen[state.side] = true;
      update();
    }
  });
  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.matches('input, textarea, select') || $('dialog[open]')) return;
    const key = e.key.toLowerCase();
    if (key === 'a' || key === 'd' || key === 's') {
      if (!canVote() || state.busy) return;
      vote(key === 'a' ? 'a' : key === 'd' ? 'b' : 'tie');
    } else if (key === 'n' && state.result) next();
    else if (key === 'escape' && state.prompt) togglePrompt(false);
    else return;
    e.preventDefault();
  };
  document.addEventListener('keydown', onKey);
  const onResize = () => { if (!state.result) drawBar(); };
  addEventListener('resize', onResize);

  next();
  return {
    fullscreen: true,
    onPlatformChange() { if (!state.error) update(); },
    destroy() {
      document.removeEventListener('keydown', onKey);
      removeEventListener('resize', onResize);
      timers.forEach(clearTimeout);
      document.body.classList.remove('is-viewer');
    },
  };
}

