// Developer team: orthographic parallel card stack (#/team) + zero-flash choreographed hanging PVC badge (#/team/<id>).
import { locale, setPageTitle } from './i18n.js';
import { $, $$, esc, icon, reducedMotion } from './ui.js';

const GROUP_META = {
  lead: { zh: '核心负责人', en: 'Core Leads', singularZh: '核心负责人', singularEn: 'Core Lead', pillTone: 'ink' },
  member: { zh: '团队成员', en: 'Team Members', singularZh: '团队成员', singularEn: 'Team Member', pillTone: 'blue' },
  honorary: { zh: '荣誉成员', en: 'Honorary Members', singularZh: '荣誉成员', singularEn: 'Honorary Member', pillTone: 'red' },
};

const GROUP_ORDER = ['lead', 'member', 'honorary'];

const MEMBERS = [
  {
    id: 'kme7',
    index: '01',
    group: 'lead',
    name: 'kme7',
    accentColor: '#1628e2',
    restAngle: -7.2,
    cardTitle: { mode: 'inline-drop', main: 'kme', accent: '7', size: 'lg' },
    statusTopZh: '核心负责人 · 发起与开发',
    statusBottomZh: '@ 亿模亿样 · ArenaGalleri',
    statusTopEn: 'Core Lead · Founder & Builder',
    statusBottomEn: '@ ArenaGalleri · Arena of Bias',
    currentLabelZh: '当前负责',
    currentLabelEn: 'Currently',
    currentValueZh: '产品与开发 @ 亿模亿样',
    currentValueEn: 'Product & Dev @ ArenaGalleri',
    tagsLabelZh: '参与构建',
    tagsLabelEn: 'Projects',
    pills: [
      { zh: '亿模亿样', en: 'ArenaGalleri', tone: 'ink' },
      { zh: '偏见试验场', en: 'Arena of Bias', tone: 'red' },
      { zh: '核心开发', en: 'Core Dev', tone: 'blue' },
    ],
  },
  {
    id: 'shadow',
    index: '02',
    group: 'lead',
    name: 'Shadow',
    accentColor: '#1f3fd1',
    restAngle: -6.4,
    cardTitle: { mode: 'single-dot', main: 'Shadow', size: 'md' },
  },
  {
    id: 'wujisuan',
    index: '03',
    group: 'lead',
    name: '无机酸',
    accentColor: '#0e6f7c',
    restAngle: -6.8,
    cardTitle: { mode: 'inline', main: '无机', accent: '酸', size: 'cjk-md' },
  },
  {
    id: 'alanbacker',
    index: '04',
    group: 'member',
    name: 'AlanBacker',
    accentColor: '#1628e2',
    restAngle: -7.0,
    cardTitle: { mode: 'stacked', top: 'Alan', bottom: 'Backer', size: 'stack-en' },
  },
  {
    id: 'alex',
    index: '05',
    group: 'member',
    name: 'Alex',
    accentColor: '#2346d8',
    restAngle: -6.2,
    cardTitle: { mode: 'single-dot', main: 'Alex', size: 'lg' },
  },
  {
    id: 'johhny',
    index: '06',
    group: 'member',
    name: 'Johhny',
    accentColor: '#c73a24',
    restAngle: -6.9,
    cardTitle: { mode: 'single-dot', main: 'Johhny', size: 'md' },
  },
  {
    id: 'qinshihuang',
    index: '07',
    group: 'member',
    name: '秦始皇',
    accentColor: '#b83a24',
    restAngle: -6.5,
    cardTitle: { mode: 'inline', main: '秦始', accent: '皇', size: 'cjk-md' },
  },
  {
    id: 'test',
    index: '08',
    group: 'member',
    name: 'test',
    accentColor: '#1d6b52',
    restAngle: -7.1,
    cardTitle: { mode: 'single-dot', main: 'test', size: 'lg' },
  },
  {
    id: 'xiaofolanyang',
    index: '09',
    group: 'member',
    name: '小佛懒羊',
    accentColor: '#2c48c8',
    restAngle: -6.6,
    cardTitle: { mode: 'stacked', top: '小佛', bottom: '懒羊', size: 'stack-cjk' },
  },
  {
    id: 'caolvchong',
    index: '10',
    group: 'member',
    name: '一只草履虫',
    accentColor: '#1b7a5e',
    restAngle: -6.8,
    cardTitle: { mode: 'stacked', top: '一只', bottom: '草履虫', size: 'stack-cjk-sm' },
  },
  {
    id: 'icy',
    index: '11',
    group: 'honorary',
    name: 'Icyの狼',
    accentColor: '#1a5fb4',
    restAngle: -6.5,
    cardTitle: { mode: 'inline-accent-first', accent: 'Icy', main: 'の狼', size: 'mix-md' },
  },
  {
    id: 'xiaoming',
    index: '12',
    group: 'honorary',
    name: '小小小名不是小明',
    accentColor: '#5c35b8',
    restAngle: -6.9,
    cardTitle: { mode: 'stacked', top: '小小小名', bottom: '不是小明', size: 'stack-cjk-xs' },
  },
];

const ISO_X = 55;
const ISO_Z = -36;

const english = () => locale() === 'en';
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
const easeOutQuint = (t) => 1 - (1 - t) ** 5;

function memberIndexByParam(param) {
  if (!param) return -1;
  const q = decodeURIComponent(String(param)).trim().toLowerCase();
  return MEMBERS.findIndex((m) => m.id.toLowerCase() === q || m.name.toLowerCase() === q);
}

function backdropScaleClass(name) {
  let units = 0;
  for (const ch of String(name)) units += /[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? 1.02 : 0.58;
  if (units <= 3.1) return 'is-xl';
  if (units <= 4.9) return 'is-lg';
  if (units <= 6.5) return 'is-md';
  return 'is-sm';
}

function memberCopy(m) {
  const en = english();
  const g = GROUP_META[m.group];
  return {
    statusTop: en ? (m.statusTopEn || g.singularEn) : (m.statusTopZh || g.singularZh),
    statusBottom: en ? (m.statusBottomEn || '@ ArenaGalleri') : (m.statusBottomZh || '@ 亿模亿样 · ArenaGalleri'),
    currentLabel: en ? (m.currentLabelEn || 'Role') : (m.currentLabelZh || '所属分组'),
    currentValue: en ? (m.currentValueEn || `${g.singularEn} @ ArenaGalleri`) : (m.currentValueZh || `${g.singularZh} @ 亿模亿样`),
    tagsLabel: en ? (m.tagsLabelEn || 'Team') : (m.tagsLabelZh || '团队标签'),
    pills: (m.pills || [
      { zh: g.singularZh, en: g.singularEn, tone: g.pillTone },
      { zh: '亿模亿样', en: 'ArenaGalleri', tone: 'ink' },
    ]).map((p) => ({ text: en ? p.en : p.zh, tone: p.tone })),
  };
}

function cardNameHtml(m) {
  const spec = m.cardTitle || { mode: 'single-dot', main: m.name, size: 'md' };
  const cls = `team-card-name is-${esc(spec.size || 'md')}`;
  if (spec.mode === 'inline-drop') {
    return `<div class="${cls}" aria-label="${esc(m.name)}"><span class="team-card-name-main">${esc(spec.main)}</span><span class="team-card-name-accent is-drop">${esc(spec.accent)}</span></div>`;
  }
  if (spec.mode === 'inline') {
    return `<div class="${cls}" aria-label="${esc(m.name)}"><span class="team-card-name-main">${esc(spec.main)}</span><span class="team-card-name-accent">${esc(spec.accent)}</span></div>`;
  }
  if (spec.mode === 'inline-accent-first') {
    return `<div class="${cls}" aria-label="${esc(m.name)}"><span class="team-card-name-accent">${esc(spec.accent)}</span><span class="team-card-name-main">${esc(spec.main)}</span></div>`;
  }
  if (spec.mode === 'stacked') {
    return `<div class="${cls} is-stacked" aria-label="${esc(m.name)}"><span class="team-card-name-main">${esc(spec.top)}</span><span class="team-card-name-accent">${esc(spec.bottom)}</span></div>`;
  }
  return `<div class="${cls}" aria-label="${esc(m.name)}"><span class="team-card-name-main">${esc(spec.main)}</span><span class="team-card-name-dot" aria-hidden="true">.</span></div>`;
}

function pvcCardInnerHtml(m) {
  const copy = memberCopy(m);
  return `<div class="team-pvc-header" aria-hidden="true">
      <span class="team-pvc-hole"></span>
      <span class="team-pvc-slot"></span>
      <span class="team-pvc-hole"></span>
    </div>
    <div class="team-pvc-seam" aria-hidden="true"></div>
    <div class="team-card">
      <div class="team-card-top">
        ${cardNameHtml(m)}
        <span class="team-card-serial">${esc(m.index)}</span>
      </div>
      <div class="team-card-meta">
        <div class="team-card-group">
          <span class="team-card-label">${esc(copy.currentLabel)}</span>
          <span class="team-card-value">${esc(copy.currentValue)}</span>
        </div>
        <div class="team-card-group">
          <span class="team-card-label">${esc(copy.tagsLabel)}</span>
          <div class="team-card-pills">
            ${copy.pills.map((p) => `<span class="team-pill is-${esc(p.tone)}">${esc(p.text)}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>
    <div class="team-pvc-sheen" aria-hidden="true"></div>`;
}

function claspSvgMarkup() {
  return `<svg class="team-clasp-svg" viewBox="0 0 64 96" width="64" height="96" aria-hidden="true">
    <defs>
      <linearGradient id="team-metal-v" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#6e7177"/>
        <stop offset="28%" stop-color="#e9ebee"/>
        <stop offset="52%" stop-color="#ffffff"/>
        <stop offset="76%" stop-color="#8b8e95"/>
        <stop offset="100%" stop-color="#53565b"/>
      </linearGradient>
      <linearGradient id="team-metal-h" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f3f4f6"/>
        <stop offset="42%" stop-color="#9ca0a7"/>
        <stop offset="72%" stop-color="#e5e7eb"/>
        <stop offset="100%" stop-color="#63666c"/>
      </linearGradient>
      <linearGradient id="team-collar-g" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#171716"/>
        <stop offset="45%" stop-color="#2c2c2a"/>
        <stop offset="100%" stop-color="#141413"/>
      </linearGradient>
      <filter id="team-clasp-shadow" x="-35%" y="-20%" width="190%" height="160%">
        <feDropShadow dx="4" dy="5" stdDeviation="3.2" flood-color="#000000" flood-opacity="0.22"/>
      </filter>
    </defs>
    <g filter="url(#team-clasp-shadow)">
      <path d="M22 4 L42 4 L40 24 C40 26.5 38 28 35.5 28 L28.5 28 C26 28 24 26.5 24 24 Z" fill="url(#team-collar-g)"/>
      <path d="M23.5 11 L40.5 11" stroke="rgba(255,255,255,0.14)" stroke-width="1"/>
      <path d="M21 25 C21 21 43 21 43 25 L41 37 C40.5 41 37 44 32 44 C27 44 23.5 41 23 37 Z" fill="none" stroke="url(#team-metal-h)" stroke-width="4.2" stroke-linejoin="round"/>
      <path d="M22.2 25.5 C22.2 22.8 41.8 22.8 41.8 25.5" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1"/>
      <rect x="28.2" y="42" width="7.6" height="8" rx="3" fill="url(#team-metal-v)"/>
      <path d="M31.5 49 C26.5 55 26 70 29.8 79.5" fill="none" stroke="#85888f" stroke-width="2.7" stroke-linecap="round" opacity="0.72"/>
      <path d="M32.2 48.5 C35.5 54 35.8 68 33.4 81.5 C32.7 85 29.8 85 29.5 81.5" fill="none" stroke="url(#team-metal-v)" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M32.4 50 C34.8 55 35 67 33.1 79" fill="none" stroke="rgba(255,255,255,0.72)" stroke-width="1" stroke-linecap="round"/>
    </g>
  </svg>`;
}

export function mount(root, ctx) {
  const rawParam = ctx.param ? String(ctx.param) : null;
  const initialIdx = memberIndexByParam(rawParam);
  let activeIndex = initialIdx >= 0 ? initialIdx : 0;
  let mode = initialIdx >= 0 ? 'detail' : 'overview'; // 'overview' | 'entering' | 'detail' | 'leaving'
  let hoveredIndex = -1;
  let hasInteracted = false;
  let destroyed = false;

  // Physics & transition state.
  let rafId = 0;
  let lastTs = 0;
  let phaseTime = 0;
  let stageRect = { width: 1200, height: 760 };
  let restX = 600;
  let restY = 270;
  let x = restX;
  let y = restY;
  let vx = 0;
  let vy = 0;
  let theta = -0.12;
  let omega = 0;
  let tiltY = 0;
  let targetTiltY = 0;

  let dragging = false;
  let dragPointerId = null;
  let dragStartClientX = 0;
  let dragStartClientY = 0;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let dragGrabLocalX = 0;
  let dragGrabLocalY = 140;
  let dragMoved = false;
  let lastDragClientX = 0;
  let lastDragClientY = 0;
  let lastDragTime = 0;
  let dragVelX = 0;
  let dragVelY = 0;

  let anim = null;
  let extractTimer = 0;

  // Cached DOM references.
  let resizeObserver = null;
  let stageEl = null;
  let overviewEl = null;
  let detailRevealEl = null;
  let pivotEl = null;
  let pvcEl = null;
  let shadowEl = null;
  let claspEl = null;
  let svgEl = null;
  let strapLeftEl = null;
  let strapRightEl = null;
  let strapLeftHiEl = null;
  let strapRightHiEl = null;
  let shadowLeftEl = null;
  let shadowRightEl = null;
  let hintEl = null;

  const activeMember = () => MEMBERS[activeIndex] || MEMBERS[0];
  const restAngleRad = () => (activeMember().restAngle * Math.PI) / 180;

  function badgeGeometry() {
    const w = stageRect.width;
    const narrow = w <= 640;
    const tiny = w <= 360;
    const tablet = w <= 960;
    const badgeW = tiny ? 196 : narrow ? 214 : 258;
    const badgeH = tiny ? 288 : narrow ? 312 : 374;
    const slotY = narrow ? 19 : 22;
    const deckScale = tiny ? 0.68 : narrow ? 0.72 : tablet ? 0.74 : 0.86;
    return {
      narrow,
      badgeW,
      badgeH,
      slotY,
      centerOffsetY: badgeH * 0.5 - slotY,
      deckScale,
      claspLen: narrow ? 58 : 68,
    };
  }

  function computeLayout(resetPosition = false) {
    if (!stageEl) return;
    const r = stageEl.getBoundingClientRect();
    if (!r.width || !r.height) return;
    stageRect = { width: r.width, height: r.height };
    const narrow = r.width <= 640;
    const compactH = r.height < 640;
    restX = r.width * 0.5;
    restY = narrow
      ? clamp(r.height * 0.36, 185, 268)
      : compactH
        ? clamp(r.height * 0.33, 180, 232)
        : clamp(r.height * 0.36, 218, 306);
    if (svgEl) svgEl.setAttribute('viewBox', `0 0 ${Math.round(r.width)} ${Math.round(r.height)}`);
    if (resetPosition) {
      x = restX;
      y = restY;
      vx = 0;
      vy = 0;
      if (reducedMotion()) {
        theta = restAngleRad();
        omega = 0;
      } else {
        theta = restAngleRad() - 0.12;
        omega = 0.75;
      }
    }
  }

  // Measure the EXACT visual center of a card in stage coordinates.
  // Passing useInnerCard=true captures the card right where the user sees it (including any hover slide-out).
  // Passing useInnerCard=false captures the card's stationary un-hovered home slot center.
  function measureCardCenter(index, useInnerCard = false) {
    if (!stageEl) return { cx: stageRect.width * 0.28, cy: stageRect.height * 0.5 };
    const slot = $(`[data-stack-index="${index}"]`, stageEl);
    if (!slot) return { cx: stageRect.width * 0.28, cy: stageRect.height * 0.5 };
    const target = useInnerCard ? ($('.team-stack-card', slot) || slot) : slot;
    const sRect = stageEl.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    return {
      cx: r.left + r.width * 0.5 - sRect.left,
      cy: r.top + r.height * 0.5 - sRect.top,
    };
  }

  function syncHoverUi(nextIdx) {
    hoveredIndex = nextIdx;
    if (!stageEl) return;
    for (const slot of $$('[data-stack-index]', stageEl)) {
      const idx = Number(slot.dataset.stackIndex);
      slot.classList.toggle('is-hovered', idx === hoveredIndex);
      slot.classList.toggle('is-above-hovered', hoveredIndex >= 0 && idx < hoveredIndex);
      slot.classList.toggle('is-below-hovered', hoveredIndex >= 0 && idx > hoveredIndex);
    }
    for (const btn of $$('[data-roster-index]', stageEl)) {
      btn.classList.toggle('is-hovered', Number(btn.dataset.rosterIndex) === hoveredIndex);
    }
  }

  // Update only page title & header breadcrumb (never destroys/rebuilds pvcEl during an animation!).
  function syncPageMeta() {
    const m = activeMember();
    const en = english();
    const crumbsNav = $('.crumbs', root);
    if (crumbsNav) {
      crumbsNav.innerHTML = mode === 'overview'
        ? `<span aria-current="page">${esc(en ? 'Developer Team' : '开发者团队')}</span>`
        : `<a href="#/team">${esc(en ? 'Developer Team' : '开发者团队')}</a><span class="sep" aria-hidden="true">/</span><span data-i18n-ignore aria-current="page">${esc(m.name)}</span>`;
    }
    setPageTitle(mode === 'overview'
      ? ['开发者团队', ctx.DATA.title]
      : ['开发者团队', { text: m.name, original: true }, ctx.DATA.title]);
  }

  // Populate the detail badge & backdrop text ONCE before revealing the badge (never at animation end).
  function populateDetailDom() {
    if (!stageEl) return;
    const m = activeMember();
    const copy = memberCopy(m);
    const en = english();
    if (pivotEl) pivotEl.style.setProperty('--member-accent', m.accentColor);
    if (pvcEl) {
      pvcEl.innerHTML = pvcCardInnerHtml(m);
      pvcEl.setAttribute('aria-label', en ? `${m.name} badge — drag to swing` : `${m.name} 工牌 — 可拖拽晃动`);
    }
    const statusEl = $('[data-detail-status]', stageEl);
    if (statusEl) statusEl.innerHTML = `${esc(copy.statusTop)}<br>${esc(copy.statusBottom)}`;
    const wordEl = $('[data-backdrop-word]', stageEl);
    if (wordEl) {
      wordEl.textContent = m.name;
      wordEl.className = `team-backdrop-word ${backdropScaleClass(m.name)}`;
    }
  }

  function renderLanyard(px, py, rad, drawFraction, lift, velX = 0) {
    if (!svgEl || !strapLeftEl || !strapRightEl) return;
    const draw = clamp(drawFraction, 0, 1);
    svgEl.style.opacity = draw <= 0.005 ? '0' : '1';
    if (draw <= 0.005) return;

    const w = stageRect.width;
    const { narrow, claspLen } = badgeGeometry();
    const sinT = Math.sin(rad);
    const cosT = Math.cos(rad);
    const collarX = px + sinT * claspLen;
    const collarY = py - cosT * claspLen;

    const spread = narrow ? clamp(w * 0.088, 24, 36) : clamp(w * 0.082, 82, 126);
    const axL = restX - spread;
    const axR = restX + spread;
    const ay = -24;

    const neckHalf = narrow ? 3.2 : 3.8;
    const endLX = collarX - cosT * neckHalf;
    const endLY = collarY - sinT * neckHalf;
    const endRX = collarX + cosT * neckHalf;
    const endRY = collarY + sinT * neckHalf;

    const bow = clamp(-velX * 0.016, -24, 24);
    const midLX = (axL + endLX) * 0.5 + bow;
    const midLY = (ay + endLY) * 0.5 + Math.abs(bow) * 0.25;
    const midRX = (axR + endRX) * 0.5 + bow;
    const midRY = (ay + endRY) * 0.5 + Math.abs(bow) * 0.25;

    const dL = `M ${axL.toFixed(1)} ${ay} Q ${midLX.toFixed(1)} ${midLY.toFixed(1)} ${endLX.toFixed(1)} ${endLY.toFixed(1)}`;
    const dR = `M ${axR.toFixed(1)} ${ay} Q ${midRX.toFixed(1)} ${midRY.toFixed(1)} ${endRX.toFixed(1)} ${endRY.toFixed(1)}`;
    const dashOffset = ((1 - draw) * 100).toFixed(2);

    for (const el of [strapLeftEl, strapLeftHiEl]) {
      el.setAttribute('d', dL);
      el.style.strokeDashoffset = dashOffset;
    }
    for (const el of [strapRightEl, strapRightHiEl]) {
      el.setAttribute('d', dR);
      el.style.strokeDashoffset = dashOffset;
    }

    const shX = 24 + lift * 12;
    const shY = 14 + lift * 12;
    const sdL = `M ${(axL + shX * 0.7).toFixed(1)} ${ay} Q ${(midLX + shX).toFixed(1)} ${(midLY + shY).toFixed(1)} ${(endLX + shX).toFixed(1)} ${(endLY + shY).toFixed(1)}`;
    const sdR = `M ${(axR + shX * 0.7).toFixed(1)} ${ay} Q ${(midRX + shX).toFixed(1)} ${(midRY + shY).toFixed(1)} ${(endRX + shX).toFixed(1)} ${(endRY + shY).toFixed(1)}`;
    for (const el of $$('[data-shadow-left]', svgEl)) {
      el.setAttribute('d', sdL);
      el.style.strokeDashoffset = dashOffset;
    }
    for (const el of $$('[data-shadow-right]', svgEl)) {
      el.setAttribute('d', sdR);
      el.style.strokeDashoffset = dashOffset;
    }
  }

  // Crisp directional cast shadow matching the lanyard's upper-left light vector and semi-hard edge.
  function renderCardShadow(rad, lift, opacityScale = 1, extraTransform = '') {
    if (!shadowEl) return;
    const worldX = 24 + lift * 14;
    const worldY = 16 + lift * 14;
    const cosT = Math.cos(rad);
    const sinT = Math.sin(rad);
    const localX = worldX * cosT + worldY * sinT;
    const localY = -worldX * sinT + worldY * cosT;
    const blur = 3.5 + lift * 2.5;
    shadowEl.style.transform = `translate3d(${localX.toFixed(1)}px, ${localY.toFixed(1)}px, 0)${extraTransform}`;
    shadowEl.style.filter = `blur(${blur.toFixed(1)}px)`;
    shadowEl.style.opacity = ((0.96 - lift * 0.14) * opacityScale).toFixed(3);
  }

  // Shared shadow + sheen formula so the final transition frame matches the first live physics frame identically!
  function applyDetailVisuals() {
    if (!pivotEl || !pvcEl || !shadowEl || !claspEl) return;
    const deg = (theta * 180) / Math.PI;
    const lift = dragging ? 1 : clamp(Math.hypot(x - restX, y - restY) / 160, 0, 1);

    pivotEl.style.opacity = '1';
    pivotEl.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${deg.toFixed(3)}deg)`;

    const scale = (1 + lift * 0.018).toFixed(4);
    pvcEl.style.transform = `scale(${scale})`;
    pvcEl.style.setProperty('--stack-mix', '0');
    const sheenShift = clamp(50 + deg * 1.6 + tiltY * 3.2, 10, 90);
    pvcEl.style.setProperty('--sheen-x', `${sheenShift.toFixed(1)}%`);

    renderCardShadow(theta, lift, 1);

    claspEl.style.opacity = '1';
    claspEl.style.transform = 'translate3d(0, 0, 0) scale(1)';

    renderLanyard(x, y, theta, 1, lift, vx);
  }

  function applyStageModeClasses() {
    if (!stageEl) return;
    stageEl.dataset.mode = mode;
    if (overviewEl) overviewEl.setAttribute('aria-hidden', mode === 'detail' ? 'true' : 'false');
    if (detailRevealEl) {
      detailRevealEl.setAttribute('aria-hidden', mode === 'overview' ? 'true' : 'false');
      if (mode === 'detail') detailRevealEl.style.setProperty('--wipe', '100%');
      if (mode === 'overview') detailRevealEl.style.setProperty('--wipe', '0%');
    }
    if (pivotEl) {
      pivotEl.style.pointerEvents = mode === 'detail' ? 'auto' : 'none';
      if (mode === 'overview') {
        pivotEl.style.opacity = '0';
        if (svgEl) svgEl.style.opacity = '0';
      }
    }
  }

  // Remove .is-extracted instantaneously without triggering .team-stack-slot's 340ms opacity fade-in!
  function restoreExtractedSlot(slot) {
    if (!slot) return;
    slot.style.transition = 'none';
    slot.classList.remove('is-extracted');
    void slot.offsetWidth;
    slot.style.transition = '';
  }

  function renderTransitionAt(rawP) {
    if (!anim || !pivotEl || !pvcEl || !shadowEl || !claspEl || !detailRevealEl) return;

    if (anim.kind === 'enter') {
      // Phase 1 (0..0.24): lift smoothly from exact hovered card position while other cards & roster float out.
      // Phase 2 (0.14..0.62): pure orthographic unfold to upright + V-lanyard draws down & clasp clicks into slot.
      // Phase 3 (0.16..1.00): smooth left → right sweep carrying the left-to-right clip-path wipe.
      const liftP = easeOutCubic(clamp(rawP / 0.26, 0, 1));
      const flightP = easeInOutCubic(clamp((rawP - 0.14) / 0.86, 0, 1));
      const unfoldP = easeInOutCubic(clamp((rawP - 0.10) / 0.58, 0, 1));
      const lanyardP = easeOutCubic(clamp((rawP - 0.20) / 0.34, 0, 1));
      const claspP = easeOutCubic(clamp((rawP - 0.28) / 0.26, 0, 1));
      const wipeP = easeOutQuint(clamp((rawP - 0.22) / 0.74, 0, 1));

      const liftY = -56 * Math.sin(liftP * Math.PI * 0.5) * (1 - flightP);
      const arcY = -30 * Math.sin(flightP * Math.PI);
      const sweepOvershoot = 24 * Math.sin(clamp((rawP - 0.34) / 0.66, 0, 1) * Math.PI);
      const curX = lerp(anim.startX, restX, flightP) + sweepOvershoot;
      const curY = lerp(anim.startY, restY, flightP) + liftY + arcY;

      const isoX = lerp(ISO_X, 0, unfoldP);
      const isoZ = lerp(ISO_Z, 0, unfoldP);
      const isoScale = lerp(anim.deckScale, 1, unfoldP);
      const swingLean = -14 * Math.sin(flightP * Math.PI);
      const curTheta = lerp(0, restAngleRad(), flightP) + (swingLean * Math.PI) / 180;
      const curDeg = (curTheta * 180) / Math.PI;

      pivotEl.style.opacity = '1';
      pivotEl.style.transform = `translate3d(${curX.toFixed(2)}px, ${curY.toFixed(2)}px, 0) rotate(${curDeg.toFixed(3)}deg)`;
      pvcEl.style.transform = `scale(${isoScale.toFixed(4)}) rotateX(${isoX.toFixed(2)}deg) rotateZ(${isoZ.toFixed(2)}deg)`;

      // Blend smoothly from stacked card finish (mix=1) to hanging finish (mix=0) — zero frame-0 or frame-N pop!
      pvcEl.style.setProperty('--stack-mix', (1 - unfoldP).toFixed(3));
      const endSheen = clamp(50 + curDeg * 1.6, 10, 90);
      pvcEl.style.setProperty('--sheen-x', `${lerp(42, endSheen, unfoldP).toFixed(1)}%`);

      const lift = clamp(Math.hypot(curX - restX, curY - restY) / 160, 0, 1);
      // Match applyDetailVisuals() shadow formula identically at unfoldP=1 & rawP=1 (zero shadow snap!).
      renderCardShadow(curTheta, lift, easeOutCubic(unfoldP), ` scale(${isoScale.toFixed(4)}) rotateX(${isoX.toFixed(2)}deg) rotateZ(${isoZ.toFixed(2)}deg)`);

      claspEl.style.opacity = claspP.toFixed(3);
      claspEl.style.transform = `translate3d(0, ${lerp(-24, 0, claspP).toFixed(1)}px, 0) scale(${lerp(0.88, 1, claspP).toFixed(3)})`;

      renderLanyard(curX, curY, curTheta, lanyardP, lift, (restX - anim.startX) * (1 - flightP) * 0.9);
      detailRevealEl.style.setProperty('--wipe', `${(wipeP * 100).toFixed(2)}%`);

      if (rawP >= 1) {
        // C1-continuous handoff: position & angle stay 100% IDENTICAL; only gentle momentum continues!
        x = curX;
        y = curY;
        theta = curTheta;
        vx = 95;
        vy = 8;
        omega = -0.95;
        anim = null;
        mode = 'detail';
        applyStageModeClasses();
        syncPageMeta();
        applyDetailVisuals();
      }
      return;
    }

    if (anim.kind === 'leave') {
      // Staged zero-z-pop return:
      // 0.00..0.50: right-to-left reverse wipe + lanyard & clasp retract upward.
      // 0.04..0.72: unhooked badge glides smoothly into exact home slot (targetX, targetY) & folds orthographic flat.
      // 0.24..0.68: lower cards (below activeIndex) + right roster softly float back in underneath the returning card.
      // 0.72: seamless 0px handoff to homeSlot inside the deck (pivot hides, homeSlot shows identically!).
      // 0.72..1.00: upper cards (above activeIndex) gently settle down over the returned card to close the stack!
      const wipeP = 1 - easeInOutCubic(clamp(rawP / 0.48, 0, 1));
      const lanyardP = 1 - easeOutCubic(clamp(rawP / 0.34, 0, 1));
      const claspP = 1 - easeOutCubic(clamp(rawP / 0.26, 0, 1));
      const flightP = easeInOutCubic(clamp((rawP - 0.04) / 0.68, 0, 1));
      const foldP = easeInOutCubic(clamp((rawP - 0.08) / 0.64, 0, 1));

      detailRevealEl.style.setProperty('--wipe', `${(wipeP * 100).toFixed(2)}%`);

      // Bring lower cards & right roster back in early (visually behind the returning card — zero overlap pop).
      if (rawP >= 0.22 && !anim.lowerRevealed) {
        anim.lowerRevealed = true;
        overviewEl?.classList.remove('is-roster-hidden');
        for (const slot of $$('[data-stack-index]', stageEl)) {
          if (Number(slot.dataset.stackIndex) > activeIndex) slot.classList.remove('is-deck-hidden');
        }
      }

      if (!anim.handedOff) {
        const arcY = -24 * Math.sin(flightP * Math.PI);
        const curX = lerp(anim.fromX, anim.targetX, flightP);
        const curY = lerp(anim.fromY, anim.targetY, flightP) + arcY;
        const curTheta = lerp(anim.fromTheta, 0, flightP);
        const curDeg = (curTheta * 180) / Math.PI;

        const isoX = lerp(0, ISO_X, foldP);
        const isoZ = lerp(0, ISO_Z, foldP);
        const isoScale = lerp(1, anim.deckScale, foldP);

        pivotEl.style.opacity = '1';
        pivotEl.style.transform = `translate3d(${curX.toFixed(2)}px, ${curY.toFixed(2)}px, 0) rotate(${curDeg.toFixed(3)}deg)`;
        pvcEl.style.transform = `scale(${isoScale.toFixed(4)}) rotateX(${isoX.toFixed(2)}deg) rotateZ(${isoZ.toFixed(2)}deg)`;
        pvcEl.style.setProperty('--stack-mix', foldP.toFixed(3));

        renderCardShadow(curTheta, 0, 1 - easeOutCubic(foldP), ` scale(${isoScale.toFixed(4)}) rotateX(${isoX.toFixed(2)}deg) rotateZ(${isoZ.toFixed(2)}deg)`);

        claspEl.style.opacity = claspP.toFixed(3);
        claspEl.style.transform = `translate3d(0, ${lerp(0, -24, 1 - claspP).toFixed(1)}px, 0) scale(${lerp(1, 0.88, 1 - claspP).toFixed(3)})`;

        renderLanyard(curX, curY, curTheta, lanyardP, 0, 0);

        // Once the card lands at 100% exact home slot coordinates & flat orthographic state, hand off silently!
        if (flightP >= 1 && foldP >= 1) {
          anim.handedOff = true;
          const homeSlot = $(`[data-stack-index="${activeIndex}"]`, stageEl);
          restoreExtractedSlot(homeSlot);
          pivotEl.style.opacity = '0';
          if (svgEl) svgEl.style.opacity = '0';
          // Now smoothly glide the upper cards (above activeIndex) down on top of the landed card!
          for (const slot of $$('[data-stack-index]', stageEl)) {
            if (Number(slot.dataset.stackIndex) < activeIndex) slot.classList.remove('is-deck-hidden');
          }
        }
      }

      if (rawP >= 1) {
        if (!anim.handedOff) {
          for (const el of $$('[data-stack-index]', stageEl)) {
            restoreExtractedSlot(el);
            el.classList.remove('is-deck-hidden');
          }
          overviewEl?.classList.remove('is-roster-hidden');
        }
        anim = null;
        mode = 'overview';
        applyStageModeClasses();
        syncPageMeta();
      }
    }
  }

  function stepTransition(now) {
    if (!anim) return;
    if (anim.start === null) anim.start = now;
    const rawP = clamp((now - anim.start) / anim.duration, 0, 1);
    renderTransitionAt(rawP);
  }

  function tick(ts) {
    if (destroyed) return;
    rafId = requestAnimationFrame(tick);
    if (!lastTs) { lastTs = ts; return; }
    const dt = Math.min((ts - lastTs) / 1000, 0.04);
    lastTs = ts;
    phaseTime += dt;

    if (mode === 'entering' || mode === 'leaving') {
      stepTransition(ts);
      return;
    }

    if (mode !== 'detail') return;

    const targetAngle = restAngleRad() + Math.sin(phaseTime * 1.15) * 0.008;

    if (dragging) {
      const dx = dragOffsetX - x;
      const dy = dragOffsetY - y;
      const prevVx = vx;
      vx = dx / Math.max(dt, 0.016);
      vy = dy / Math.max(dt, 0.016);
      x += dx * Math.min(1, dt * 26);
      y += dy * Math.min(1, dt * 26);

      const leverTorque = clamp(-dragVelX * 0.00055, -0.58, 0.58)
        + clamp((x - restX) * -0.0014, -0.32, 0.32)
        + clamp((dragGrabLocalX / 120) * ((y - restY) * 0.0012), -0.18, 0.18);
      const desired = clamp(restAngleRad() + leverTorque, -0.78, 0.78);
      const rotAcc = (desired - theta) * 68 - omega * 9.5 + clamp(-(vx - prevVx) * 0.00045, -18, 18);
      omega += rotAcc * dt;
      theta = clamp(theta + omega * dt, -0.92, 0.92);
    } else {
      const prevVx = vx;
      const ax = (restX - x) * 115 - vx * 11.2;
      const ay = (restY - y) * 125 - vy * 12.0;
      vx += ax * dt;
      vy += ay * dt;
      x += vx * dt;
      y += vy * dt;

      const inertiaTorque = clamp(-ax * 0.0021 - (vx - prevVx) * 0.0004, -22, 22);
      const alpha = (targetAngle - theta) * 54 - omega * 4.1 + inertiaTorque;
      omega += alpha * dt;
      theta = clamp(theta + omega * dt, -1.05, 1.05);
    }

    tiltY += (targetTiltY - tiltY) * Math.min(1, dt * 11);
    applyDetailVisuals();
  }

  function startLoop() {
    cancelAnimationFrame(rafId);
    lastTs = 0;
    if (reducedMotion()) {
      if (mode === 'detail') {
        theta = restAngleRad();
        omega = 0;
        x = restX;
        y = restY;
        applyDetailVisuals();
      }
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function hideOverviewForDetail() {
    if (!stageEl) return;
    overviewEl?.classList.add('is-roster-hidden');
    for (const slot of $$('[data-stack-index]', stageEl)) {
      const idx = Number(slot.dataset.stackIndex);
      slot.classList.toggle('is-upper-card', idx < activeIndex);
      if (idx === activeIndex) {
        slot.classList.add('is-extracted');
        slot.classList.remove('is-deck-hidden');
      } else {
        slot.classList.add('is-deck-hidden');
        slot.classList.remove('is-extracted');
      }
    }
  }

  function launchEnterFlight(index) {
    if (destroyed || mode !== 'entering') return;
    // Measure the EXACT current visual screen position of the card right before extracting it (0.00px jump!).
    const { cx, cy } = measureCardCenter(index, true);
    const { centerOffsetY, deckScale } = badgeGeometry();

    const chosenSlot = $(`[data-stack-index="${index}"]`, stageEl);
    chosenSlot?.classList.remove('is-pre-lifting');
    chosenSlot?.classList.add('is-extracted');

    anim = {
      kind: 'enter',
      start: null,
      duration: 920,
      startX: cx,
      startY: cy - centerOffsetY,
      deckScale,
    };
    renderTransitionAt(0);
  }

  function openMember(index) {
    if (index < 0 || index >= MEMBERS.length) return;
    if (mode === 'entering' || mode === 'leaving') return;
    clearTimeout(extractTimer);
    activeIndex = index;
    dragging = false;
    tiltY = 0;
    targetTiltY = 0;

    const m = activeMember();
    history.replaceState(history.state, '', `#/team/${m.id}`);
    populateDetailDom();

    if (reducedMotion()) {
      mode = 'detail';
      syncHoverUi(-1);
      hideOverviewForDetail();
      computeLayout(true);
      applyStageModeClasses();
      syncPageMeta();
      applyDetailVisuals();
      return;
    }

    mode = 'entering';
    applyStageModeClasses();
    syncPageMeta();
    if (detailRevealEl) detailRevealEl.style.setProperty('--wipe', '0%');

    if (index === 0) {
      // Top card has no cards above it: extract instantaneously at its exact hovered pixel position!
      const { cx, cy } = measureCardCenter(0, true);
      const { centerOffsetY, deckScale } = badgeGeometry();
      syncHoverUi(-1);
      hideOverviewForDetail();
      anim = {
        kind: 'enter',
        start: null,
        duration: 920,
        startX: cx,
        startY: cy - centerOffsetY,
        deckScale,
      };
      renderTransitionAt(0);
      return;
    }

    // Buried card (#2..#12): keep it inside its true z-order slot while cards above it swiftly lift away (175ms),
    // then hand off seamlessly at 0.00px with zero z-order pop!
    syncHoverUi(-1);
    overviewEl?.classList.add('is-roster-hidden');
    for (const slot of $$('[data-stack-index]', stageEl)) {
      const idx = Number(slot.dataset.stackIndex);
      slot.classList.toggle('is-upper-card', idx < activeIndex);
      if (idx === activeIndex) {
        slot.classList.remove('is-deck-hidden', 'is-extracted');
        slot.classList.add('is-pre-lifting');
      } else {
        slot.classList.add('is-deck-hidden');
        slot.classList.remove('is-extracted', 'is-pre-lifting');
      }
    }
    extractTimer = setTimeout(() => launchEnterFlight(index), 185);
  }

  function returnToOverview() {
    if (mode !== 'detail') return;
    dragging = false;
    pivotEl?.classList.remove('is-dragging');
    targetTiltY = 0;
    tiltY = 0;

    history.replaceState(history.state, '', '#/team');

    if (reducedMotion()) {
      mode = 'overview';
      overviewEl?.classList.remove('is-roster-hidden');
      for (const slot of $$('[data-stack-index]', stageEl)) {
        restoreExtractedSlot(slot);
        slot.classList.remove('is-deck-hidden');
      }
      applyStageModeClasses();
      syncPageMeta();
      return;
    }

    // Ensure overview remains cleanly hidden (all non-active cards hidden, active card extracted at its resting slot),
    // and measure the exact un-hovered resting slot center.
    hideOverviewForDetail();
    const { cx, cy } = measureCardCenter(activeIndex, false);
    const { centerOffsetY, deckScale } = badgeGeometry();

    mode = 'leaving';
    applyStageModeClasses();
    syncPageMeta();

    // If returning to top card (#0), there are no upper cards to wait for, so shorten total duration smoothly.
    const hasUpperCards = activeIndex > 0;
    anim = {
      kind: 'leave',
      start: null,
      duration: hasUpperCards ? 860 : 680,
      fromX: x,
      fromY: y,
      fromTheta: theta,
      targetX: cx,
      targetY: cy - centerOffsetY,
      deckScale,
      lowerRevealed: false,
      handedOff: false,
    };
    renderTransitionAt(0);
  }

  function markInteracted() {
    if (hasInteracted) return;
    hasInteracted = true;
    if (hintEl) hintEl.classList.add('is-hidden');
  }

  function stackCardHtml(m, i) {
    const zIndex = MEMBERS.length - i;
    const extraCls = mode === 'detail' ? (i === activeIndex ? ' is-extracted' : ' is-deck-hidden') : '';
    const posCls = i < activeIndex ? ' is-upper-card' : '';
    return `<div class="team-stack-slot${extraCls}${posCls}" data-stack-index="${i}" style="--stack-i:${i};--member-accent:${esc(m.accentColor)};z-index:${zIndex}">
      <button type="button" class="team-stack-card team-pvc is-stacked-card" data-open-member="${i}" aria-label="${esc(m.name)}" data-i18n-ignore>
        ${pvcCardInnerHtml(m)}
      </button>
    </div>`;
  }

  function rosterGroupsHtml() {
    const en = english();
    return GROUP_ORDER.map((groupKey) => {
      const meta = GROUP_META[groupKey];
      const items = MEMBERS.map((m, i) => ({ m, i })).filter(({ m }) => m.group === groupKey);
      return `<section class="team-roster-group" aria-label="${esc(en ? meta.en : meta.zh)}">
        <h2 class="team-roster-group-title">${esc(en ? `${meta.en}:` : `${meta.zh}：`)}</h2>
        <div class="team-roster-grid">
          ${items.map(({ m, i }) => `<button type="button" class="team-roster-name${m.name.length >= 7 && /[\u3000-\u9fff]/.test(m.name) ? ' is-wide' : ''}" data-roster-index="${i}" data-open-member="${i}" style="--member-accent:${esc(m.accentColor)}"><span class="team-roster-dot" aria-hidden="true"></span><span class="team-roster-label">${esc(m.name)}</span></button>`).join('')}
        </div>
      </section>`;
    }).join('');
  }

  function draw(resetPhysics = true) {
    const m = activeMember();
    const copy = memberCopy(m);
    const en = english();
    const crumbs = [{ text: '开发者团队' }];

    root.innerHTML = `${ctx.header(crumbs, false, '')}<main class="team-page">
      <section class="team-stage" data-team-stage data-mode="${esc(mode)}" aria-label="${esc(en ? 'Developer Team' : '开发者团队')}">

        <!-- Layer 1: Orthographic parallel card stack + grouped lexicographical roster -->
        <div class="team-overview${mode === 'detail' ? ' is-roster-hidden' : ''}" data-team-overview data-i18n-ignore>
          <div class="team-deck-zone">
            <div class="team-deck" style="--stack-count:${MEMBERS.length}">
              ${MEMBERS.map((member, i) => stackCardHtml(member, i)).join('')}
            </div>
          </div>
          <div class="team-roster" data-team-roster>
            <header class="team-roster-head">
              <h1 class="team-roster-title">${en
                ? '<span class="team-roster-zh">Team</span><span class="team-roster-en">团队</span>'
                : '<span class="team-roster-zh">团队</span><span class="team-roster-en">Team</span>'}</h1>
              <p class="team-roster-order">${esc(en ? '(Alphabetical)' : '（字典序）')}</p>
            </header>
            <div class="team-roster-groups">
              ${rosterGroupsHtml()}
            </div>
          </div>
        </div>

        <!-- Layer 2: Detail backdrop elements wiped smoothly left → right -->
        <div class="team-detail-reveal" data-team-detail-reveal style="--wipe:${mode === 'detail' ? '100%' : '0%'}" data-i18n-ignore>
          <div class="team-corner team-corner-left">
            <button type="button" class="team-back-btn" data-team-back aria-label="${esc(en ? 'Back to team roster' : '返回团队名单')}">${icon('prev')}<span>${esc(en ? 'Back' : '返回')}</span></button>
          </div>
          <div class="team-corner team-corner-right">
            <p data-detail-status>${esc(copy.statusTop)}<br>${esc(copy.statusBottom)}</p>
          </div>
          <div class="team-backdrop" aria-hidden="true">
            <span class="team-backdrop-word ${backdropScaleClass(m.name)}" data-backdrop-word>${esc(m.name)}</span>
          </div>
          <p class="team-hint${hasInteracted ? ' is-hidden' : ''}" data-team-hint>${esc(en ? 'Drag or flick the badge' : '可拖拽或轻拨工牌')}</p>
        </div>

        <!-- Layer 3: Dynamic V-lanyard SVG (multi-pass soft vector shadow avoids full-viewport SVG blur stutter) -->
        <svg class="team-lanyard-svg" data-team-svg aria-hidden="true" preserveAspectRatio="none">
          <g class="team-strap-shadows">
            <path class="team-strap-shadow is-outer" data-shadow-left pathLength="100" d=""/>
            <path class="team-strap-shadow is-outer" data-shadow-right pathLength="100" d=""/>
            <path class="team-strap-shadow is-mid" data-shadow-left pathLength="100" d=""/>
            <path class="team-strap-shadow is-mid" data-shadow-right pathLength="100" d=""/>
            <path class="team-strap-shadow is-core" data-shadow-left pathLength="100" d=""/>
            <path class="team-strap-shadow is-core" data-shadow-right pathLength="100" d=""/>
          </g>
          <g class="team-straps">
            <path class="team-strap" data-strap-left pathLength="100" d=""/>
            <path class="team-strap" data-strap-right pathLength="100" d=""/>
            <path class="team-strap-hi" data-strap-left-hi pathLength="100" d=""/>
            <path class="team-strap-hi" data-strap-right-hi pathLength="100" d=""/>
          </g>
        </svg>

        <!-- Layer 4: Live physical PVC badge + brushed steel clasp -->
        <div class="team-badge-pivot" data-team-pivot style="--member-accent:${esc(m.accentColor)}">
          <div class="team-pvc-shadow" data-team-shadow aria-hidden="true"></div>
          <div class="team-pvc" data-team-pvc role="button" tabindex="0" aria-label="${esc(en ? `${m.name} badge — drag to swing` : `${m.name} 工牌 — 可拖拽晃动`)}" data-i18n-ignore>
            ${pvcCardInnerHtml(m)}
          </div>
          <div class="team-clasp" data-team-clasp aria-hidden="true">${claspSvgMarkup()}</div>
        </div>

      </section>
    </main>${ctx.footer()}`;

    stageEl = $('[data-team-stage]', root);
    overviewEl = $('[data-team-overview]', root);
    detailRevealEl = $('[data-team-detail-reveal]', root);
    pivotEl = $('[data-team-pivot]', root);
    pvcEl = $('[data-team-pvc]', root);
    shadowEl = $('[data-team-shadow]', root);
    claspEl = $('[data-team-clasp]', root);
    svgEl = $('[data-team-svg]', root);
    strapLeftEl = $('[data-strap-left]', root);
    strapRightEl = $('[data-strap-right]', root);
    strapLeftHiEl = $('[data-strap-left-hi]', root);
    strapRightHiEl = $('[data-strap-right-hi]', root);
    shadowLeftEl = $('[data-shadow-left]', root);
    shadowRightEl = $('[data-shadow-right]', root);
    hintEl = $('[data-team-hint]', root);

    resizeObserver?.disconnect();
    if (typeof ResizeObserver === 'function' && stageEl) {
      resizeObserver = new ResizeObserver(() => {
        const prevRestX = restX;
        const prevRestY = restY;
        computeLayout(false);
        if (mode === 'detail' && !dragging) {
          x += restX - prevRestX;
          y += restY - prevRestY;
          applyDetailVisuals();
        }
      });
      resizeObserver.observe(stageEl);
    }

    computeLayout(resetPhysics);
    applyStageModeClasses();
    syncPageMeta();
    if (mode === 'detail') applyDetailVisuals();
    startLoop();
  }

  function elasticTether(rawX, rawY) {
    const dx = rawX - restX;
    const dy = rawY - restY;
    const dist = Math.hypot(dx, dy);
    const maxSoft = Math.min(stageRect.width * 0.34, 240);
    if (dist <= maxSoft) return { tx: rawX, ty: clamp(rawY, 72, stageRect.height - 130) };
    const extra = dist - maxSoft;
    const damped = maxSoft + 90 * (1 - Math.exp(-extra / 120));
    const ratio = damped / dist;
    return {
      tx: clamp(restX + dx * ratio, 90, stageRect.width - 90),
      ty: clamp(restY + dy * ratio, 72, stageRect.height - 120),
    };
  }

  const onPointerOver = (event) => {
    if (mode !== 'overview') return;
    const el = event.target.closest('[data-roster-index], [data-stack-index]');
    if (!el) return;
    const idx = Number(el.dataset.rosterIndex ?? el.dataset.stackIndex);
    if (Number.isInteger(idx) && idx !== hoveredIndex) syncHoverUi(idx);
  };

  const onPointerOut = (event) => {
    if (mode !== 'overview') return;
    const from = event.target.closest('[data-roster-index], [data-stack-index]');
    if (!from) return;
    const to = event.relatedTarget?.closest?.('[data-roster-index], [data-stack-index]');
    if (!to) syncHoverUi(-1);
  };

  const onFocusIn = (event) => {
    if (mode !== 'overview') return;
    const el = event.target.closest('[data-roster-index], [data-open-member]');
    if (!el) return;
    const idx = Number(el.dataset.rosterIndex ?? el.dataset.openMember);
    if (Number.isInteger(idx)) syncHoverUi(idx);
  };

  const onPointerDown = (event) => {
    if (mode !== 'detail' || event.button > 0) return;
    const target = event.target.closest('[data-team-pvc], .team-clasp');
    if (!target || !stageEl) return;
    event.preventDefault();
    markInteracted();

    const sRect = stageEl.getBoundingClientRect();
    const px = event.clientX - sRect.left;
    const py = event.clientY - sRect.top;

    dragging = true;
    dragMoved = false;
    dragPointerId = event.pointerId;
    dragStartClientX = event.clientX;
    dragStartClientY = event.clientY;
    lastDragClientX = event.clientX;
    lastDragClientY = event.clientY;
    lastDragTime = performance.now();
    dragVelX = 0;
    dragVelY = 0;

    dragGrabLocalX = px - x;
    dragGrabLocalY = py - y;
    dragOffsetX = x;
    dragOffsetY = y;
    targetTiltY = 0;

    pivotEl?.classList.add('is-dragging');
    try { pvcEl?.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  };

  const onPointerMove = (event) => {
    if (!stageEl || mode !== 'detail') return;
    if (dragging && event.pointerId === dragPointerId) {
      const now = performance.now();
      const dtMs = Math.max(8, now - lastDragTime);
      const stepX = event.clientX - lastDragClientX;
      const stepY = event.clientY - lastDragClientY;
      dragVelX = dragVelX * 0.5 + (stepX / (dtMs / 1000)) * 0.5;
      dragVelY = dragVelY * 0.5 + (stepY / (dtMs / 1000)) * 0.5;
      lastDragClientX = event.clientX;
      lastDragClientY = event.clientY;
      lastDragTime = now;

      if (Math.hypot(event.clientX - dragStartClientX, event.clientY - dragStartClientY) > 5) {
        dragMoved = true;
      }

      const sRect = stageEl.getBoundingClientRect();
      const rawX = (event.clientX - sRect.left) - dragGrabLocalX;
      const rawY = (event.clientY - sRect.top) - dragGrabLocalY;
      const { tx, ty } = elasticTether(rawX, rawY);
      dragOffsetX = tx;
      dragOffsetY = ty;
      return;
    }

    if (!reducedMotion() && pvcEl && event.pointerType === 'mouse') {
      const rect = pvcEl.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right
        && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (inside) {
        const nx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        targetTiltY = nx * 6.5;
      } else {
        targetTiltY = 0;
      }
    }
  };

  const finishDrag = (event) => {
    if (!dragging || (event && event.pointerId !== undefined && event.pointerId !== dragPointerId)) return;
    dragging = false;
    pivotEl?.classList.remove('is-dragging');
    try { if (dragPointerId !== null) pvcEl?.releasePointerCapture(dragPointerId); } catch { /* ignore */ }
    dragPointerId = null;

    if (!dragMoved) {
      omega += (theta >= restAngleRad() ? -1 : 1) * 1.65;
      vx += (Math.random() > 0.5 ? 1 : -1) * 42;
    } else {
      vx = clamp(dragVelX * 0.42, -950, 950);
      vy = clamp(dragVelY * 0.42, -950, 950);
      omega += clamp(-dragVelX * 0.0022, -4.8, 4.8);
    }
  };

  const onClick = (event) => {
    const backBtn = event.target.closest('[data-team-back]');
    if (backBtn) {
      returnToOverview();
      return;
    }
    const openBtn = event.target.closest('[data-open-member]');
    if (openBtn && mode === 'overview') {
      const idx = Number(openBtn.dataset.openMember);
      if (Number.isInteger(idx)) openMember(idx);
      return;
    }
    const teamCrumb = event.target.closest('a[href="#/team"]');
    if (teamCrumb && mode === 'detail') {
      event.preventDefault();
      returnToOverview();
    }
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape' && mode === 'detail') {
      event.preventDefault();
      returnToOverview();
    }
  };

  const relocalize = () => {
    if (!destroyed) {
      if (mode === 'entering') { anim = null; mode = 'detail'; }
      if (mode === 'leaving') { anim = null; mode = 'overview'; }
      draw(false);
    }
  };

  root.addEventListener('pointerover', onPointerOver);
  root.addEventListener('pointerout', onPointerOut);
  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('click', onClick);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', finishDrag);
  window.addEventListener('pointercancel', finishDrag);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('localechange', relocalize);

  draw(true);

  return {
    ready: Promise.resolve(),
    onPlatformChange() {},
    destroy() {
      destroyed = true;
      clearTimeout(extractTimer);
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      root.removeEventListener('pointerover', onPointerOver);
      root.removeEventListener('pointerout', onPointerOut);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('click', onClick);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('localechange', relocalize);
    },
  };
}
