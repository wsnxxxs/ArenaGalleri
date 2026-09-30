import { $$, esc, icon, img, brandMark, reducedMotion } from './ui.js';
import { platform } from './platform.js';

const time = (r) => Date.parse(r.addedAt) || 0;
// Short tab names: "机械键盘 · 交互式产品配置器" → "机械键盘".
const shortTitle = (t) => t.title.split(' · ')[0];
// 36 → 三十六, so the count reads in the same register as 「回字有四样写法」.
const DIGITS = '零一二三四五六七八九';
const hanzi = (n) => (n < 10 ? DIGITS[n] : n < 100 ? `${n >= 20 ? DIGITS[Math.floor(n / 10)] : ''}十${n % 10 ? DIGITS[n % 10] : ''}` : String(n));
// A plain-text line of the prompt, skipping section heads such as 【任务】 and list markers.
const promptLine = (t) => (t.promptPending || !t.prompt ? t.summary : t.prompt.split(/\r?\n/).map((line) => line.trim())
  .filter((line) => line && !/^(【.*】|#)/.test(line)).map((line) => line.replace(/^(-|\d+[.、])\s*/, '')).join(' ').slice(0, 120));
// Resting places in the deck, front card first: the rest fan out behind it.
const SLOTS = [
  'translate(0, 0) rotate(0deg) scale(1)',
  'translate(9%, -6%) rotate(3deg) scale(.93)',
  'translate(-8%, -4%) rotate(-3.5deg) scale(.89)',
  'translate(16%, -11%) rotate(6deg) scale(.84)',
  'translate(-15%, -9%) rotate(-6.5deg) scale(.8)',
];
const SHUFFLE = 3200;
const QUESTION = SHUFFLE * 4;

export function mount(root, ctx) {
  const answersOf = (t) => t.results.filter((r) => ctx.interactive(r) && ctx.cover(r))
    .sort((a, b) => (a.status === 'verified' ? 0 : 1) - (b.status === 'verified' ? 0 : 1) || time(b) - time(a));
  // The headline promises more answers than 回 has ways to be written, so only such questions lead.
  const decks = ctx.DATA.tasks.filter((t) => answersOf(t).length > 4).sort((a, b) => answersOf(b).length - answersOf(a).length);
  const recent = ctx.DATA.tasks.flatMap((task) => answersOf(task).map((work) => ({ task, work })))
    .sort((a, b) => time(b.work) - time(a.work)).slice(0, 12);
  const totalWorks = ctx.DATA.tasks.reduce((n, t) => n + t.results.filter(ctx.interactive).length, 0);
  const vendors = new Map();
  ctx.DATA.tasks.forEach((t) => t.results.filter(ctx.interactive).forEach((r) => {
    const m = ctx.modelOf(r);
    if (m.vendor && m.logo) vendors.set(m.vendor, { m, n: (vendors.get(m.vendor)?.n ?? 0) + 1 });
  }));
  const vendorMarks = [...vendors.values()].sort((a, b) => b.n - a.n).slice(0, 7);
  const vendorCount = new Set(ctx.DATA.models.map((m) => m.vendor)).size;
  const first = decks[0], firstCount = first ? answersOf(first).length : 0;

  // Every answer is a small browser window: the model in the title bar, its first screen below.
  const windowCard = (task, work, attrs = '', eager = false) => `<a class="home-window" href="${ctx.viewHref(task, work.id)}" aria-label="在线预览：${esc(work.title)}，${esc(ctx.label(work))}"${attrs}>
      <span class="home-window-bar"><span class="home-window-dots" aria-hidden="true"><i></i><i></i><i></i></span>${brandMark(ctx.modelOf(work), 'home-window-mark')}<b>${esc(ctx.label(work))}</b></span>
      <span class="home-window-shot">${img(ctx.cover(work), '', '', eager)}</span>
    </a>`;
  // Two matching copies make the strip loop without a jump. Only the first is keyboard-focusable.
  const strip = [false, true].map((copy) => `<div class="home-stream-group"${copy ? ' aria-hidden="true"' : ''}>${recent.map(({ task, work }) =>
    `<div class="home-stream-item">${windowCard(task, work, copy ? ' tabindex="-1"' : '')}<span class="home-stream-task">${esc(shortTitle(task))}</span></div>`).join('')}</div>`).join('');

  root.innerHTML = `${ctx.header()}<main class="landing page">
    <section class="home-hero" aria-labelledby="home-title">
      <div class="home-copy">
        <p class="home-eyebrow"><span class="home-live-dot" aria-hidden="true"></span>同一份提示词 <span>/</span> 不同模型的网页作品</p>
        <h1 id="home-title">回字有四样写法，<br><span>这道题有<em data-home-n>${hanzi(firstCount)}</em>种</span><span class="home-stop">。</span></h1>
        <p class="home-lede">把同一份提示词交给不同的 AI 模型，每一个都交出一张能运行的网页。并排打开，差距一眼可见。</p>
        <div class="home-actions">
          ${first ? `<a class="btn home-enter" data-home-cta href="${ctx.taskHref(first)}"><span>看看这<span data-home-n>${hanzi(firstCount)}</span>种</span>${icon('right')}</a>` : ''}
          <a class="home-link" href="#/questions">浏览全部题目${icon('right')}</a>
        </div>
        <p class="home-proof"><span class="home-proof-marks" aria-hidden="true">${vendorMarks.map(({ m }) => brandMark(m, 'home-proof-mark')).join('')}</span><span>${vendorCount} 家厂商的 ${ctx.DATA.models.length} 个模型，已交出 ${totalWorks} 份解答</span></p>
      </div>
      <div class="home-stage">
        <div class="home-deck-frame">
          <div class="home-deck"></div>
          <a class="home-slip" href="#"><span class="home-slip-kicker">这道题 · 同一份提示词</span><b></b><span class="home-slip-text"></span></a>
        </div>
      </div>
      <div class="home-foot">
        <a class="home-scroll" href="#" data-scroll-next aria-label="向下查看最近收录"><span class="home-scroll-track" aria-hidden="true"><i></i></span>往下看 · 最近收录</a>
        <div class="home-tabs" role="tablist" aria-label="选择题目">${decks.map((t, i) => `<button class="home-tab" role="tab" aria-selected="${i === 0}" data-home-tab="${i}"><small>${String(i + 1).padStart(2, '0')}</small>${esc(shortTitle(t))}<span class="home-tab-count">${answersOf(t).length}</span></button>`).join('')}</div>
        <button class="home-motion" type="button" data-autoplay aria-pressed="false">暂停轮播 <span aria-hidden="true">Ⅱ</span></button>
      </div>
    </section>
    <section class="home-recent" aria-label="最近收录">
      <div class="home-recent-head"><h2>最近收录</h2><button class="home-motion" type="button" data-motion aria-pressed="false">暂停流动 <span aria-hidden="true">Ⅱ</span></button></div>
      <div class="home-stream"><div class="home-stream-track">${strip}</div></div>
    </section>
    ${platform.available ? `<section class="home-blind" aria-labelledby="home-blind-title">
      <p class="home-blind-ab" aria-hidden="true"><i>A</i><span>vs</span><i>B</i></p>
      <div><h2 id="home-blind-title">先别看名字，只看作品。</h2><p>同一道题的两份解答匿名并排，选出更好的那一个，投票后揭晓模型并汇入排行榜。</p></div>
      <a class="btn" href="#/arena">开始双盲测试${icon('right')}</a>
    </section>` : ''}
  </main>${ctx.footer()}`;

  const deck = root.querySelector('.home-deck'), slip = root.querySelector('.home-slip'), hero = root.querySelector('.home-hero');
  const cta = root.querySelector('[data-home-cta]'), autoplay = root.querySelector('[data-autoplay]');
  let current = 0, cards = [], elapsed = 0, sinceShuffle = 0, playing = !reducedMotion(), autoQuestion = playing, hovering = false;

  const place = () => cards.forEach((card, k) => {
    card.style.transform = SLOTS[Math.min(k, SLOTS.length - 1)];
    card.style.zIndex = String(SLOTS.length - k);
    card.style.filter = k ? `brightness(${1 - k * 0.12})` : '';
    card.tabIndex = k ? -1 : 0;
    card.toggleAttribute('data-front', !k);
  });
  const show = (i) => {
    current = i; elapsed = 0; sinceShuffle = 0;
    const t = decks[i], works = answersOf(t);
    $$('[data-home-tab]', root).forEach((tab, k) => {
      tab.setAttribute('aria-selected', String(k === i));
      tab.style.setProperty('--progress', k === i && autoQuestion ? '0' : '1');
    });
    // The number in the headline and the button follow the question in the deck.
    $$('[data-home-n]', root).forEach((el) => { el.textContent = hanzi(works.length); });
    cta.href = ctx.taskHref(t);
    slip.href = ctx.taskHref(t);
    slip.querySelector('b').textContent = t.title;
    slip.querySelector('.home-slip-text').textContent = promptLine(t);
    deck.innerHTML = works.slice(0, SLOTS.length).map((w, k) => windowCard(t, w, ' data-dealing', k === 0)).join('');
    cards = [...deck.children];
    // Deal the new deck in from below, one card after another.
    requestAnimationFrame(() => cards.forEach((card, k) => setTimeout(() => { card.removeAttribute('data-dealing'); place(); }, 60 + k * 90)));
  };
  const bringToFront = (card) => {
    const at = cards.indexOf(card);
    if (at <= 0) return;
    cards = [...cards.slice(at), ...cards.slice(0, at)];
    sinceShuffle = 0;
    place();
  };
  const setPlaying = (on) => {
    playing = on;
    autoplay.setAttribute('aria-pressed', String(!on));
    autoplay.innerHTML = on ? '暂停轮播 <span aria-hidden="true">Ⅱ</span>' : '继续轮播 <span aria-hidden="true">▷</span>';
  };

  // Cards shuffle and questions advance on their own, pausing while the pointer or focus is on the hero.
  const TICK = 100;
  const timer = setInterval(() => {
    if (!root.contains(deck)) return clearInterval(timer);
    if (!playing || hovering || document.visibilityState !== 'visible') return;
    sinceShuffle += TICK;
    if (sinceShuffle >= SHUFFLE && cards.length > 1) { sinceShuffle = 0; cards.push(cards.shift()); place(); }
    if (!autoQuestion) return;
    elapsed += TICK;
    root.querySelector('[data-home-tab][aria-selected="true"]')?.style.setProperty('--progress', String(Math.min(elapsed / QUESTION, 1)));
    if (elapsed >= QUESTION) show((current + 1) % decks.length);
  }, TICK);
  const stage = root.querySelector('.home-stage');
  stage.addEventListener('pointerenter', () => { hovering = true; });
  stage.addEventListener('pointerleave', () => { hovering = false; });
  hero.addEventListener('focusin', () => { hovering = true; });
  hero.addEventListener('focusout', () => { hovering = false; });

  // The scroll cue on the fold fades once the page has moved; its click glides to the next section.
  const cue = root.querySelector('.home-scroll');
  const onScroll = () => {
    if (!root.contains(cue)) return removeEventListener('scroll', onScroll);
    cue.classList.toggle('is-gone', scrollY > 60);
  };
  addEventListener('scroll', onScroll, { passive: true });

  root.onclick = (event) => {
    if (event.target.closest('[data-scroll-next]')) {
      event.preventDefault();
      root.querySelector('.home-recent').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
      return;
    }
    const back = event.target.closest('.home-deck .home-window:not([data-front])');
    if (back) { event.preventDefault(); bringToFront(back); return; }
    const tab = event.target.closest('[data-home-tab]');
    if (tab) { autoQuestion = false; show(+tab.dataset.homeTab); return; }
    if (event.target.closest('[data-autoplay]')) { setPlaying(!playing); return; }
    const button = event.target.closest('[data-motion]');
    if (!button) return;
    const paused = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(paused));
    button.innerHTML = paused ? '继续流动 <span aria-hidden="true">▷</span>' : '暂停流动 <span aria-hidden="true">Ⅱ</span>';
    root.querySelector('.home-recent').classList.toggle('is-paused', paused);
  };
  root.querySelector('.home-tabs').onkeydown = (event) => {
    const tabs = $$('[data-home-tab]', root), at = tabs.indexOf(document.activeElement);
    const next = { ArrowRight: at + 1, ArrowLeft: at - 1 }[event.key];
    if (at < 0 || next === undefined) return;
    event.preventDefault();
    const i = (next + tabs.length) % tabs.length;
    autoQuestion = false; show(i); tabs[i].focus();
  };
  if (reducedMotion()) setPlaying(false);
  if (decks.length) show(0);
  else hero.classList.add('is-empty');
  document.title = `${ctx.DATA.title} · ${ctx.DATA.subtitle}`;
}
