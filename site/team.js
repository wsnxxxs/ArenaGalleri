// Developer team: interactive hanging lanyard ID badge stage (#/team, #/team/<id>).
// Designed around a declarative MEMBERS list so additional member badges can be added cleanly.
import { locale, setPageTitle } from './i18n.js';
import { $, esc, icon, reducedMotion } from './ui.js';
import { toast } from './platform.js';

const MEMBERS = [
  {
    id: 'kme7',
    index: '01',
    name: 'kme7',
    nameMain: 'kme',
    nameAccent: '7',
    accentColor: '#1628e2',
    restAngle: -7.2,
    taglineZh: '搭建亿模亿样，和背后每一场评测的故事。',
    taglineEn: 'Building ArenaGalleri and the stories behind it.',
    statusTopZh: '发起 · 产品与开发',
    statusBottomZh: '@ 亿模亿样 · ArenaGalleri',
    statusTopEn: 'Currently building & maintaining',
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
    bioZh: [
      '亿模亿样（ArenaGalleri）与偏见试验场（Arena of Bias）的发起人与核心开发者，主要负责平台架构、题库策展、双盲评测系统与榜单体验的持续打磨。',
      '把同一份提示词交给不同 AI 模型，让可运行的网页、三维场景、文字与音乐作品并排接受真实检验——这个工牌展台是团队成员页的第一张名片，更多伙伴的工牌也将陆续挂上。',
    ],
    bioEn: [
      'Founder and core builder of ArenaGalleri and Arena of Bias, working across frontend exhibition architecture, benchmark curation, blind evaluation, and leaderboard design.',
      'This hanging badge stage is the first card in our team directory — additional collaborator badges will be added as the roster grows.',
    ],
    links: [
      { href: 'https://github.com/kme7kme7-prog', zh: 'GitHub · kme7kme7-prog', en: 'GitHub · kme7kme7-prog', external: true },
      { href: '#/questions', zh: '浏览题库', en: 'Browse questions' },
      { href: '#/arena', zh: '进入盲评', en: 'Blind arena' },
    ],
  },
];

const english = () => locale() === 'en';
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function memberById(id) {
  if (!id) return MEMBERS[0];
  return MEMBERS.find((m) => m.id.toLowerCase() === String(id).toLowerCase()) || null;
}

function memberCopy(m) {
  const en = english();
  return {
    tagline: en ? m.taglineEn : m.taglineZh,
    statusTop: en ? m.statusTopEn : m.statusTopZh,
    statusBottom: en ? m.statusBottomEn : m.statusBottomZh,
    currentLabel: en ? m.currentLabelEn : m.currentLabelZh,
    currentValue: en ? m.currentValueEn : m.currentValueZh,
    tagsLabel: en ? m.tagsLabelEn : m.tagsLabelZh,
    pills: m.pills.map((p) => ({ text: en ? p.en : p.zh, tone: p.tone })),
    bio: en ? m.bioEn : m.bioZh,
    links: m.links.map((l) => ({ href: l.href, text: en ? l.en : l.zh, external: Boolean(l.external) })),
  };
}

function claspSvgMarkup() {
  // Brushed steel swivel D-ring + wire hook positioned over the PVC oval lanyard slot.
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
      <!-- Folded black fabric tab gripping the D-ring bar -->
      <path d="M22 4 L42 4 L40 24 C40 26.5 38 28 35.5 28 L28.5 28 C26 28 24 26.5 24 24 Z" fill="url(#team-collar-g)"/>
      <path d="M23.5 11 L40.5 11" stroke="rgba(255,255,255,0.14)" stroke-width="1"/>
      <!-- Flat metal D-ring loop -->
      <path d="M21 25 C21 21 43 21 43 25 L41 37 C40.5 41 37 44 32 44 C27 44 23.5 41 23 37 Z" fill="none" stroke="url(#team-metal-h)" stroke-width="4.2" stroke-linejoin="round"/>
      <path d="M22.2 25.5 C22.2 22.8 41.8 22.8 41.8 25.5" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1"/>
      <!-- Swivel joint collar -->
      <rect x="28.2" y="42" width="7.6" height="8" rx="3" fill="url(#team-metal-v)"/>
      <!-- Back loop of J-hook entering behind the slot -->
      <path d="M31.5 49 C26.5 55 26 70 29.8 79.5" fill="none" stroke="#85888f" stroke-width="2.7" stroke-linecap="round" opacity="0.72"/>
      <!-- Front gleaming wire pin threading down over the PVC header lip into the oval slot -->
      <path d="M32.2 48.5 C35.5 54 35.8 68 33.4 81.5 C32.7 85 29.8 85 29.5 81.5" fill="none" stroke="url(#team-metal-v)" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M32.4 50 C34.8 55 35 67 33.1 79" fill="none" stroke="rgba(255,255,255,0.72)" stroke-width="1" stroke-linecap="round"/>
    </g>
  </svg>`;
}

export function mount(root, ctx) {
  const rawParam = ctx.param ? String(ctx.param) : null;
  const matched = memberById(rawParam);
  let activeIndex = matched ? MEMBERS.indexOf(matched) : 0;
  let missingParam = Boolean(rawParam && !matched);
  let modalOpen = false;
  let hasInteracted = false;
  let destroyed = false;

  // Physics state (clasp pivot position relative to stage, plus pendulum angle).
  let rafId = 0;
  let lastTs = 0;
  let stageRect = { width: 1200, height: 760 };
  let restX = 600;
  let restY = 265;
  let x = restX;
  let y = restY;
  let vx = 0;
  let vy = 0;
  let theta = -0.18;
  let omega = 0;
  let tiltX = 0;
  let tiltY = 0;
  let targetTiltX = 0;
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
  let phaseTime = 0;

  let resizeObserver = null;
  let stageEl = null;
  let pivotEl = null;
  let pvcEl = null;
  let shadowEl = null;
  let strapLeftEl = null;
  let strapRightEl = null;
  let strapLeftHiEl = null;
  let strapRightHiEl = null;
  let shadowLeftEl = null;
  let shadowRightEl = null;
  let svgEl = null;
  let hintEl = null;

  const activeMember = () => MEMBERS[activeIndex] || MEMBERS[0];
  const restAngleRad = () => (activeMember().restAngle * Math.PI) / 180;

  function computeLayout(resetPosition = false) {
    if (!stageEl) return;
    const r = stageEl.getBoundingClientRect();
    if (!r.width || !r.height) return;
    stageRect = { width: r.width, height: r.height };
    const narrow = r.width <= 640;
    const compactH = r.height < 640;
    restX = r.width * 0.5;
    // Keep the V-lanyard occupying ~33–38% of stage height so the badge overlaps the giant bottom wordmark cleanly.
    restY = narrow
      ? clamp(r.height * 0.37, 185, 270)
      : compactH
        ? clamp(r.height * 0.33, 180, 232)
        : clamp(r.height * 0.36, 220, 308);
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
        // Gentle drop-in swing on first arrival so the physical affordance is immediately felt.
        theta = restAngleRad() - 0.14;
        omega = 0.85;
      }
    }
  }

  function applyVisuals() {
    if (!pivotEl || !svgEl) return;
    const w = stageRect.width;
    const narrow = w <= 640;
    const deg = (theta * 180) / Math.PI;
    const lift = dragging ? 1 : clamp(Math.hypot(x - restX, y - restY) / 160, 0, 1);

    // Position the badge assembly at the exact oval-slot pivot (x, y) and rotate smoothly.
    pivotEl.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${deg.toFixed(3)}deg)`;

    if (pvcEl) {
      const rx = tiltX.toFixed(2);
      const ry = tiltY.toFixed(2);
      const scale = (1 + lift * 0.018).toFixed(4);
      pvcEl.style.transform = `perspective(950px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`;
      const sheenShift = clamp(50 + deg * 1.6 + tiltY * 2.4, 10, 90);
      pvcEl.style.setProperty('--sheen-x', `${sheenShift.toFixed(1)}%`);
    }

    if (shadowEl) {
      const sx = 20 + lift * 16 + Math.sin(theta) * 8;
      const sy = 22 + lift * 18 + Math.abs(Math.sin(theta)) * 4;
      const blur = 26 + lift * 14;
      shadowEl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
      shadowEl.style.filter = `blur(${blur.toFixed(1)}px)`;
      shadowEl.style.opacity = (0.92 - lift * 0.2).toFixed(3);
    }

    // Compute the exact moving top of the folded clasp collar in stage coordinates.
    // The collar top sits claspLen pixels "above" the oval slot pivot along the rotated badge axis.
    const claspLen = narrow ? 58 : 68;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    const collarX = x + sinT * claspLen;
    const collarY = y - cosT * claspLen;

    // Strap anchor spread along the very top edge of the stage (narrower on mobile so corner copy stays clear).
    const spread = narrow ? clamp(w * 0.088, 24, 36) : clamp(w * 0.082, 82, 126);
    const axL = restX - spread;
    const axR = restX + spread;
    const ay = -24;

    // Slight collar width offset so the two ribbons visibly meet in a crisp V.
    const neckHalf = narrow ? 3.2 : 3.8;
    const endLX = collarX - cosT * neckHalf;
    const endLY = collarY - sinT * neckHalf;
    const endRX = collarX + cosT * neckHalf;
    const endRY = collarY + sinT * neckHalf;

    // Subtle fabric sag / inertial bow when swinging rapidly.
    const bow = clamp(-vx * 0.016, -24, 24);
    const midLX = (axL + endLX) * 0.5 + bow;
    const midLY = (ay + endLY) * 0.5 + Math.abs(bow) * 0.25;
    const midRX = (axR + endRX) * 0.5 + bow;
    const midRY = (ay + endRY) * 0.5 + Math.abs(bow) * 0.25;

    const dL = `M ${axL.toFixed(1)} ${ay} Q ${midLX.toFixed(1)} ${midLY.toFixed(1)} ${endLX.toFixed(1)} ${endLY.toFixed(1)}`;
    const dR = `M ${axR.toFixed(1)} ${ay} Q ${midRX.toFixed(1)} ${midRY.toFixed(1)} ${endRX.toFixed(1)} ${endRY.toFixed(1)}`;

    strapLeftEl.setAttribute('d', dL);
    strapRightEl.setAttribute('d', dR);
    strapLeftHiEl.setAttribute('d', dL);
    strapRightHiEl.setAttribute('d', dR);

    // Matching diagonal cast shadow falling down-right from the lanyard straps.
    const shX = 24 + lift * 12;
    const shY = 14 + lift * 12;
    const sdL = `M ${(axL + shX * 0.7).toFixed(1)} ${ay} Q ${(midLX + shX).toFixed(1)} ${(midLY + shY).toFixed(1)} ${(endLX + shX).toFixed(1)} ${(endLY + shY).toFixed(1)}`;
    const sdR = `M ${(axR + shX * 0.7).toFixed(1)} ${ay} Q ${(midRX + shX).toFixed(1)} ${(midRY + shY).toFixed(1)} ${(endRX + shX).toFixed(1)} ${(endRY + shY).toFixed(1)}`;
    shadowLeftEl.setAttribute('d', sdL);
    shadowRightEl.setAttribute('d', sdR);
  }

  function tick(ts) {
    if (destroyed) return;
    rafId = requestAnimationFrame(tick);
    if (!lastTs) { lastTs = ts; applyVisuals(); return; }
    const dt = Math.min((ts - lastTs) / 1000, 0.04);
    lastTs = ts;
    phaseTime += dt;

    const targetAngle = restAngleRad() + Math.sin(phaseTime * 1.15) * 0.008;

    if (dragging) {
      // Smoothly pull the clasp toward the pointer while tilting according to drag velocity & grab lever.
      const dx = dragOffsetX - x;
      const dy = dragOffsetY - y;
      const prevVx = vx;
      vx = dx / Math.max(dt, 0.016);
      vy = dy / Math.max(dt, 0.016);
      x += dx * Math.min(1, dt * 26);
      y += dy * Math.min(1, dt * 26);

      // Natural pendulum tilt from horizontal pull + off-center grab torque.
      const leverTorque = clamp(-dragVelX * 0.00055, -0.58, 0.58)
        + clamp((x - restX) * -0.0014, -0.32, 0.32)
        + clamp((dragGrabLocalX / 120) * ((y - restY) * 0.0012), -0.18, 0.18);
      const desired = clamp(restAngleRad() + leverTorque, -0.78, 0.78);
      const rotAcc = (desired - theta) * 68 - omega * 9.5 + clamp(-(vx - prevVx) * 0.00045, -18, 18);
      omega += rotAcc * dt;
      theta = clamp(theta + omega * dt, -0.92, 0.92);
    } else {
      // Spring-damper tether pulling the clasp back to rest, coupled into angular pendulum inertia.
      const prevVx = vx;
      const ax = (restX - x) * 115 - vx * 11.2;
      const ay = (restY - y) * 125 - vy * 12.0;
      vx += ax * dt;
      vy += ay * dt;
      x += vx * dt;
      y += vy * dt;

      // Inertial pendulum coupling: accelerating clasp left swings the heavy bottom right.
      const inertiaTorque = clamp(-ax * 0.0021 - (vx - prevVx) * 0.0004, -22, 22);
      const alpha = (targetAngle - theta) * 54 - omega * 4.1 + inertiaTorque;
      omega += alpha * dt;
      theta = clamp(theta + omega * dt, -1.05, 1.05);
    }

    // Smooth 3D hover tilt easing.
    tiltX += (targetTiltX - tiltX) * Math.min(1, dt * 11);
    tiltY += (targetTiltY - tiltY) * Math.min(1, dt * 11);

    applyVisuals();
  }

  function startLoop() {
    cancelAnimationFrame(rafId);
    lastTs = 0;
    if (reducedMotion()) {
      theta = restAngleRad();
      omega = 0;
      x = restX;
      y = restY;
      applyVisuals();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function markInteracted() {
    if (hasInteracted) return;
    hasInteracted = true;
    if (hintEl) hintEl.classList.add('is-hidden');
  }

  function renderModal(m, copy) {
    if (!modalOpen) return '';
    const en = english();
    const shareUrl = `${location.origin}${location.pathname}#/team/${m.id}`;
    return `<div class="team-modal-backdrop" data-team-modal-backdrop>
      <section class="team-modal" role="dialog" aria-modal="true" aria-labelledby="team-modal-title" data-i18n-ignore>
        <div class="team-modal-head">
          <div class="team-modal-id">
            <span class="team-modal-index">${esc(m.index)}</span>
            <h2 id="team-modal-title"><span class="team-name-main">${esc(m.nameMain)}</span><span class="team-name-accent" style="color:${esc(m.accentColor)}">${esc(m.nameAccent)}</span></h2>
          </div>
          <button type="button" class="icon-btn team-modal-close" data-team-modal-close aria-label="${esc(en ? 'Close' : '关闭')}">${icon('close')}</button>
        </div>
        <p class="team-modal-role">${esc(copy.statusTop)} · ${esc(copy.statusBottom)}</p>
        <div class="team-modal-pills">${copy.pills.map((p) => `<span class="team-pill is-${esc(p.tone)}">${esc(p.text)}</span>`).join('')}</div>
        <div class="team-modal-bio">${copy.bio.map((para) => `<p>${esc(para)}</p>`).join('')}</div>
        <div class="team-modal-actions">
          ${copy.links.map((l) => `<a class="btn sm${l.external ? ' primary' : ''}" href="${esc(l.href)}"${l.external ? ' target="_blank" rel="noopener"' : ''}>${esc(l.text)}${icon(l.external ? 'arrow' : 'right')}</a>`).join('')}
          <button type="button" class="btn sm ghost" data-team-copy="${esc(shareUrl)}">${icon('link')}${esc(en ? 'Copy link' : '复制名片链接')}</button>
        </div>
        <p class="team-modal-foot">${esc(en ? 'More team member badges will be added here soon.' : '成员名录将陆续补充，更多伙伴的工牌会陆续挂上。')}</p>
      </section>
    </div>`;
  }

  function renderSwitcher() {
    if (MEMBERS.length <= 1) return '';
    const en = english();
    return `<nav class="team-switcher" aria-label="${esc(en ? 'Team members' : '团队成员')}" data-i18n-ignore>
      ${MEMBERS.map((m, i) => `<button type="button" class="team-switch-btn${i === activeIndex ? ' is-active' : ''}" data-team-select="${i}" aria-current="${i === activeIndex ? 'true' : 'false'}"><span>${esc(m.index)}</span>${esc(m.name)}</button>`).join('')}
    </nav>`;
  }

  function draw(resetPhysics = true) {
    const m = activeMember();
    const copy = memberCopy(m);
    const en = english();
    const crumbs = [{ text: '开发者团队', href: '#/team' }, { text: m.name, original: true }];

    root.innerHTML = `${ctx.header(crumbs, false, '')}<main class="team-page">
      <section class="team-stage" data-team-stage aria-label="${esc(en ? `${m.name} · Developer profile` : `${m.name} · 开发者名片`)}">
        ${missingParam ? `<p class="team-missing" role="status" data-i18n-ignore>${esc(en ? 'That member badge has not been added yet — showing kme7.' : '该成员工牌尚未添加，当前展示 kme7。')}</p>` : ''}

        <div class="team-corner team-corner-left" data-i18n-ignore>
          <p>${esc(copy.tagline)} <button type="button" class="team-more-btn" data-team-more>[${esc(en ? 'more' : '更多')}]</button></p>
        </div>
        <div class="team-corner team-corner-right" data-i18n-ignore>
          <p>${esc(copy.statusTop)}<br>${esc(copy.statusBottom)}</p>
        </div>

        <div class="team-backdrop" aria-hidden="true" data-i18n-ignore>
          <span class="team-backdrop-word">${esc(m.name)}</span>
        </div>

        <svg class="team-lanyard-svg" data-team-svg aria-hidden="true" preserveAspectRatio="none">
          <defs>
            <filter id="team-strap-blur" x="-30%" y="-20%" width="160%" height="150%">
              <feGaussianBlur stdDeviation="7.5"/>
            </filter>
          </defs>
          <g class="team-strap-shadows" filter="url(#team-strap-blur)">
            <path class="team-strap-shadow" data-shadow-left d=""/>
            <path class="team-strap-shadow" data-shadow-right d=""/>
          </g>
          <g class="team-straps">
            <path class="team-strap" data-strap-left d=""/>
            <path class="team-strap" data-strap-right d=""/>
            <path class="team-strap-hi" data-strap-left-hi d=""/>
            <path class="team-strap-hi" data-strap-right-hi d=""/>
          </g>
        </svg>

        <div class="team-badge-pivot" data-team-pivot style="--member-accent:${esc(m.accentColor)}">
          <div class="team-pvc-shadow" data-team-shadow aria-hidden="true"></div>
          <div class="team-pvc" data-team-pvc role="button" tabindex="0" aria-label="${esc(en ? `${m.name} badge — drag to swing, press Enter for more` : `${m.name} 工牌 — 可拖拽晃动，按回车查看详情`)}" data-i18n-ignore>
            <div class="team-pvc-header" aria-hidden="true">
              <span class="team-pvc-hole"></span>
              <span class="team-pvc-slot"></span>
              <span class="team-pvc-hole"></span>
            </div>
            <div class="team-pvc-seam" aria-hidden="true"></div>
            <div class="team-card">
              <div class="team-card-top">
                <div class="team-card-name" aria-label="${esc(m.name)}">
                  <span class="team-card-name-main">${esc(m.nameMain)}</span><span class="team-card-name-accent">${esc(m.nameAccent)}</span>
                </div>
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
            <div class="team-pvc-sheen" aria-hidden="true"></div>
          </div>
          <div class="team-clasp" aria-hidden="true">${claspSvgMarkup()}</div>
        </div>

        ${renderSwitcher()}
        <p class="team-hint${hasInteracted ? ' is-hidden' : ''}" data-team-hint data-i18n-ignore>${esc(en ? 'Drag or flick the badge' : '可拖拽或轻拨工牌')}</p>
      </section>
      <div data-team-modal-host>${renderModal(m, copy)}</div>
    </main>${ctx.footer()}`;

    setPageTitle(['开发者团队', { text: m.name, original: true }, ctx.DATA.title]);

    stageEl = $('[data-team-stage]', root);
    pivotEl = $('[data-team-pivot]', root);
    pvcEl = $('[data-team-pvc]', root);
    shadowEl = $('[data-team-shadow]', root);
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
        if (!dragging) {
          x += restX - prevRestX;
          y += restY - prevRestY;
        }
        applyVisuals();
      });
      resizeObserver.observe(stageEl);
    }

    computeLayout(resetPhysics);
    applyVisuals();
    startLoop();
  }

  function syncModal() {
    const host = $('[data-team-modal-host]', root);
    if (!host) return;
    const m = activeMember();
    host.innerHTML = renderModal(m, memberCopy(m));
  }

  function openModal() {
    if (modalOpen) return;
    modalOpen = true;
    document.body.classList.add('has-team-modal');
    syncModal();
    $('[data-team-modal-close]', root)?.focus();
  }

  function closeModal(restoreFocus = true) {
    if (!modalOpen) return;
    modalOpen = false;
    document.body.classList.remove('has-team-modal');
    syncModal();
    if (restoreFocus) $('[data-team-more]', root)?.focus();
  }

  function elasticTether(rawX, rawY) {
    const dx = rawX - restX;
    const dy = rawY - restY;
    const dist = Math.hypot(dx, dy);
    const maxSoft = Math.min(stageRect.width * 0.34, 240);
    if (dist <= maxSoft) return { tx: rawX, ty: clamp(rawY, 72, stageRect.height - 130) };
    // Smooth logarithmic rubber-band stretch past soft radius.
    const extra = dist - maxSoft;
    const damped = maxSoft + 90 * (1 - Math.exp(-extra / 120));
    const ratio = damped / dist;
    return {
      tx: clamp(restX + dx * ratio, 90, stageRect.width - 90),
      ty: clamp(restY + dy * ratio, 72, stageRect.height - 120),
    };
  }

  const onPointerDown = (event) => {
    if (modalOpen || event.button > 0) return;
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

    // Preserve where on the badge the user grabbed so it doesn't jump to cursor center.
    dragGrabLocalX = px - x;
    dragGrabLocalY = py - y;
    dragOffsetX = x;
    dragOffsetY = y;
    targetTiltX = 0;
    targetTiltY = 0;

    pivotEl?.classList.add('is-dragging');
    try { pvcEl?.setPointerCapture(event.pointerId); } catch { /* ignore capture issues */ }
  };

  const onPointerMove = (event) => {
    if (!stageEl) return;
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

    // Subtle 3D sheen & parallax tilt when hovering over the PVC sleeve.
    if (!modalOpen && !reducedMotion() && pvcEl && event.pointerType === 'mouse') {
      const rect = pvcEl.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right
        && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (inside) {
        const nx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        const ny = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
        targetTiltY = nx * 6.5;
        targetTiltX = -ny * 5.5;
      } else {
        targetTiltX = 0;
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
      // A light tap gives the badge a playful nudge.
      omega += (theta >= restAngleRad() ? -1 : 1) * 1.65;
      vx += (Math.random() > 0.5 ? 1 : -1) * 42;
    } else {
      // Impart fling velocity on release.
      vx = clamp(dragVelX * 0.42, -950, 950);
      vy = clamp(dragVelY * 0.42, -950, 950);
      omega += clamp(-dragVelX * 0.0022, -4.8, 4.8);
    }
  };

  const onClick = (event) => {
    const more = event.target.closest('[data-team-more]');
    if (more) { openModal(); return; }

    const closeBtn = event.target.closest('[data-team-modal-close]');
    if (closeBtn) { closeModal(); return; }

    if (event.target.matches('[data-team-modal-backdrop]')) {
      closeModal();
      return;
    }

    const selectBtn = event.target.closest('[data-team-select]');
    if (selectBtn) {
      const next = Number(selectBtn.dataset.teamSelect);
      if (Number.isInteger(next) && next >= 0 && next < MEMBERS.length && next !== activeIndex) {
        activeIndex = next;
        missingParam = false;
        history.replaceState(history.state, '', `#/team/${MEMBERS[activeIndex].id}`);
        draw(true);
      }
      return;
    }

    const copyBtn = event.target.closest('[data-team-copy]');
    if (copyBtn) {
      navigator.clipboard?.writeText(copyBtn.dataset.teamCopy).then(
        () => toast(english() ? 'Link copied' : '已复制链接'),
        () => toast(english() ? 'Copy failed — please copy from the address bar' : '复制失败，请从地址栏复制'),
      );
    }
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape' && modalOpen) {
      event.preventDefault();
      closeModal();
      return;
    }
    if (!modalOpen && (event.key === 'Enter' || event.key === ' ') && event.target?.matches?.('[data-team-pvc]')) {
      event.preventDefault();
      openModal();
    }
  };

  const relocalize = () => {
    if (!destroyed) draw(false);
  };

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
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      document.body.classList.remove('has-team-modal');
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
