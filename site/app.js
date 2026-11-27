import { initI18n, languageButton, setPageTitle, t as tr } from './i18n.js';
// 亿模亿样 — single-page gallery and platform. Routes are hash based, so the archive works
// on any static host; the platform routes need the server (npm start).
//   #/                        home: latest questions and answers
//   #/questions               library: every task and every model
//   #/<task>                  task: results, screenshots, prompt, leaderboard
//   #/<task>/<result>         viewer: the live page in a frame with a guide drawer
//   #/<task>/<a>/vs/<b>       viewer, two results side by side
//   #/arena[/<task>]          blind comparison            (platform)
//   #/leaderboard[/<task>]    leaderboard                 (platform)
//   #/changelog[/<id>]        website changelog           (platform)
//   #/team[/<id>]             developer team              (guided-trial)
//   #/new                    publish a question          (platform)
//   #/exam                   qualification test          (platform)
//   #/submit/<task>           upload to this task         (platform)
//   #/me · #/review           personal center · review queue (platform)
//   #/terms · #/privacy       terms of use and disclaimer · privacy policy
import { $, $$, LOGO, brandMark, byName, esc, ext, formatBytes, formatDate, icon, img, pad, reducedMotion, store, syncThemeUi, themeButton, versionedMedia } from './ui.js';
import { STATUS, accountControl, api, arenaScope, arenaText, avatarFace, bySite, catalogState, connectPlatform, can, isStaff, metricsInfo, onPlatformChange, platform, reactionBar, refreshAccountControls, refreshPlatform, requestPlatform, setFaces, setActivityNeeded, startPlatformRecovery, statusBadge, toast } from './platform.js';
import { bootRead } from './platform-api.js';
import { mount as renderLanding } from './home.js';
import { startAnnouncements } from './announcements.js';
import { curatedInfo, invalidateCurated } from './curated.js';
import { CONTACT, aigcLabel, beianLink, mount as renderLegal } from './legal.js';
import { effortRank, representatives, standard, taskCover } from './featured.js';
import { groupVariantResults, variantChoices, variantKey, variantsOf } from './prompt-variants.js';
import { boostOrder, boostedWorks } from './work-boost.js';
import { downloadReference, linkReferences, referenceSheet, useReferenceViewer } from './references.js';
import { CATEGORIES, aiJudged, aiScoreOf, benchmarkTask, catalogQuestionsForBuild, categoryLabel, categoryOf, createQuestionSearch, domainList, domainsIn, domainsOf, subcategoriesOf, subcategoryOf, tracksOf, votedTask } from './categories.js';
import { BACKEND_TIERS, backendTierMeta } from './backend-board.js';
import { textMatches } from './match.js';
import { modelResolver } from './models.js';
import { popularQuestions, recommendQuestions } from './question-recommendations.js';
import { createWorkControls, workFrameUrl } from './work-controls.js';
import { hasModelPreview, previewScreenshotOf, previewZoomKind, screenshotOf } from './work-preview-media.js';
import { watchViewerFrame } from './viewer-loading.js';
import { costShown } from './usage.js';
import { artifactRow, cardUsage, loadPricing, usageBlock, usageLine } from './usage-view.js';
import { openUsageSheet } from './usage-entry.js';
import { routeParts } from './route-path.js';
import { createDeferredMedia } from './deferred-media.js';
import { cascade, flip, scene, settleIn, slideIn, zoomFrom } from './motion.js';

initI18n();
const deferredMedia = createDeferredMedia();
const root = $('#app');
let DATA;
const SOLVE_STATUSES = [
  { key: 'hard', label: '难以解决' },
  { key: 'solving', label: '正被解决' },
  { key: 'solved', label: '基本解决' },
  { key: 'scarce', label: '结果较少' },
];
const SOLVE_STATUS_MAP = new Map(SOLVE_STATUSES.map((item) => [item.key, item]));
const DEFAULT_SOLVE_STATUS = 'scarce';
const normalizeSolveStatus = (value) => (SOLVE_STATUS_MAP.has(value) ? value : DEFAULT_SOLVE_STATUS);
const solveStatusOf = (t) => normalizeSolveStatus(t?.solveStatus);
const solveStatusMeta = (status) => SOLVE_STATUS_MAP.get(normalizeSolveStatus(status));

function taskSolveCornerHtml(t) {
  const status = solveStatusOf(t);
  const meta = solveStatusMeta(status);
  const labelText = tr(meta.label);
  const titleText = isStaff()
    ? `${tr('解决状态')}：${labelText}（${tr('点击修改题目解决状态')}）`
    : `${tr('解决状态')}：${labelText}`;
  if (isStaff()) {
    return `<button type="button" class="solve-corner is-editable" data-solve-trigger="${esc(t.id)}" data-solve-corner="${esc(t.id)}" data-solve-status="${esc(status)}" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(titleText)}" title="${esc(titleText)}"><span class="solve-dot" aria-hidden="true"></span><span class="solve-corner-label">${esc(labelText)}</span><span class="solve-side-caret" aria-hidden="true">▾</span></button>`;
  }
  return `<span class="solve-corner" data-solve-corner="${esc(t.id)}" data-solve-status="${esc(status)}" aria-label="${esc(titleText)}" title="${esc(titleText)}"><span class="solve-dot" aria-hidden="true"></span><span class="solve-corner-label">${esc(labelText)}</span></span>`;
}

function taskSolveSidebarHtml(t) {
  const status = solveStatusOf(t);
  const meta = solveStatusMeta(status);
  const labelText = tr(meta.label);
  const hint = isStaff() ? tr('点击修改题目解决状态') : tr('解决状态');
  const control = isStaff()
    ? `<button type="button" class="solve-side is-editable" data-solve-trigger="${esc(t.id)}" data-solve-side="${esc(t.id)}" data-solve-status="${esc(status)}" aria-haspopup="menu" aria-expanded="false" title="${esc(hint)}"><span class="solve-dot" aria-hidden="true"></span><span class="solve-side-label">${esc(labelText)}</span><span class="solve-side-caret" aria-hidden="true">▾</span></button>`
    : `<span class="solve-side" data-solve-side="${esc(t.id)}" data-solve-status="${esc(status)}" title="${esc(hint)}"><span class="solve-dot" aria-hidden="true"></span><span class="solve-side-label">${esc(labelText)}</span></span>`;
  return `<div class="solve-side-wrap" data-solve-wrap="${esc(t.id)}">${control}${taskSubcatSidebarHtml(t)}</div>`;
}

function syncSolveNode(node, status) {
  const meta = solveStatusMeta(status);
  const normalized = meta.key;
  const labelText = tr(meta.label);
  node.dataset.solveStatus = normalized;
  const labelEl = node.querySelector('.solve-corner-label, .solve-side-label');
  if (labelEl) labelEl.textContent = labelText;
  if (node.matches('[data-solve-corner]')) {
    const tip = isStaff() ? `${tr('解决状态')}：${labelText}（${tr('点击修改题目解决状态')}）` : `${tr('解决状态')}：${labelText}`;
    node.setAttribute('aria-label', tip);
    node.setAttribute('title', tip);
  }
}

function applyTaskSolveStatus(taskId, status) {
  const normalized = normalizeSolveStatus(status);
  if (Array.isArray(DATA?.tasks)) {
    const task = DATA.tasks.find((item) => item.id === taskId);
    if (task) task.solveStatus = normalized;
  }
  if (Array.isArray(platform?.questions)) {
    const q = platform.questions.find((item) => item.id === taskId);
    if (q) q.solveStatus = normalized;
  }
  for (const node of document.querySelectorAll('[data-solve-corner], [data-solve-side]')) {
    const id = node.dataset.solveCorner || node.dataset.solveSide;
    if (id === taskId) syncSolveNode(node, normalized);
  }
  window.dispatchEvent(new CustomEvent('solvestatuschange', { detail: { taskId, status: normalized } }));
}

const curatedSaving = new Set();
const isCuratedTask = task => Boolean(task?.curatedSectionId);
const CURATED_STAR_SVG = '<svg class="curated-star-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.4l2.72 5.66 6.23.86-4.54 4.35 1.11 6.19L12 16.48l-5.52 2.98 1.11-6.19-4.54-4.35 6.23-.86L12 2.4z" fill="currentColor"/><path d="M12 2.4l2.72 5.66 6.23.86-4.54 4.35 1.11 6.19L12 16.48V2.4z" fill="rgb(255 255 255 / 22%)"/></svg>';
function taskCuratedStarHtml(task) {
  return `<span class="task-curated-star" data-curated-star="${esc(task.id)}" role="img" aria-label="精选题" title="精选题"${isCuratedTask(task) ? '' : ' hidden'}>${CURATED_STAR_SVG}</span>`;
}
function taskCuratedSidebarHtml(task) {
  if (globalThis.SAME_PROMPT_CONFIG?.guidedVoting !== true) return '';
  if (!isStaff()) return isCuratedTask(task) ? `<p class="curated-side-badge">${CURATED_STAR_SVG}<span>精选题</span></p>` : '';
  const supported = CATEGORIES.some(category => category.name === task.category && category.judging === 'vote');
  const saving = curatedSaving.has(task.id);
  return `<div class="curated-side"><label><input type="checkbox" data-task-curated="${esc(task.id)}"${isCuratedTask(task) ? ' checked' : ''}${saving || !supported ? ' disabled' : ''}><span>是否是精选题</span><span class="curated-side-star" aria-hidden="true">${CURATED_STAR_SVG}</span></label><p>${saving ? '正在保存…' : !supported ? '该题目类型暂不支持精选' : task.category === '音乐' ? '音乐可先标为精选，榜单暂不计分。' : '精选题会优先展示，并在题库标星。'}</p></div>`;
}
function applyTaskCurated(taskId, sectionId) {
  for (const list of [DATA?.tasks, platform.questions]) {
    const task = list?.find(item => item.id === taskId);
    if (task) task.curatedSectionId = sectionId;
  }
  for (const star of document.querySelectorAll('[data-curated-star]')) if (star.dataset.curatedStar === taskId) star.hidden = !sectionId;
  for (const input of document.querySelectorAll('[data-task-curated]')) if (input.dataset.taskCurated === taskId) input.checked = Boolean(sectionId);
  window.dispatchEvent(new CustomEvent('curatedselectionchange', { detail: { taskId } }));
}
async function saveTaskCurated(input) {
  const taskId = input.dataset.taskCurated;
  if (!isStaff() || curatedSaving.has(taskId)) return;
  const selected = input.checked, actorId = platform.user.id;
  curatedSaving.add(taskId);
  input.disabled = true;
  try {
    const info = await curatedInfo({ fresh: true });
    if (platform.user?.id !== actorId || !isStaff()) throw new Error(tr('登录状态已变化，请重新载入'));
    const saved = await api(`admin/curated/questions/${encodeURIComponent(taskId)}`, { method: 'PUT', body: { selected, revision: info.revision } });
    invalidateCurated();
    applyTaskCurated(taskId, saved.sectionId);
    toast(tr(saved.selected ? '已加入精选题' : '已移出精选题'));
  } catch (error) {
    input.checked = isCuratedTask(DATA.tasks.find(task => task.id === taskId));
    toast(error.message || tr('精选状态保存失败，请重试'));
    invalidateCurated();
  } finally {
    await refreshPlatform('curated');
    curatedSaving.delete(taskId);
    const task = DATA.tasks.find(task => task.id === taskId);
    if (task) for (const control of document.querySelectorAll('[data-task-curated]')) {
      if (control.dataset.taskCurated === taskId) control.closest('.curated-side').outerHTML = taskCuratedSidebarHtml(task);
    }
  }
}

let solveMenuEl = null;
let solveMenuTrigger = null;
let solveMenuSaving = false;

function closeSolveMenu() {
  if (solveMenuTrigger) solveMenuTrigger.setAttribute('aria-expanded', 'false');
  solveMenuTrigger = null;
  if (solveMenuEl) {
    solveMenuEl.hidden = true;
    solveMenuEl.removeAttribute('data-task-id');
  }
}

function positionSolveMenu(trigger) {
  if (!solveMenuEl || !trigger || !trigger.isConnected) { closeSolveMenu(); return; }
  const rect = trigger.getBoundingClientRect();
  const menuRect = solveMenuEl.getBoundingClientRect();
  const margin = 8;
  let left = rect.right - menuRect.width;
  if (left < margin) left = Math.max(margin, rect.left);
  if (left + menuRect.width > innerWidth - margin) left = Math.max(margin, innerWidth - menuRect.width - margin);
  let top = rect.bottom + 6;
  if (top + menuRect.height > innerHeight - margin) {
    const above = rect.top - menuRect.height - 6;
    top = above >= margin ? above : Math.max(margin, innerHeight - menuRect.height - margin);
  }
  solveMenuEl.style.left = `${Math.round(left)}px`;
  solveMenuEl.style.top = `${Math.round(top)}px`;
}

function ensureSolveMenu() {
  if (solveMenuEl) return solveMenuEl;
  const menu = document.createElement('div');
  menu.className = 'solve-status-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', tr('修改题目解决状态'));
  menu.hidden = true;
  menu.addEventListener('click', async (event) => {
    const option = event.target.closest('[data-solve-option]');
    if (!option || solveMenuSaving) return;
    event.preventDefault();
    event.stopPropagation();
    const taskId = menu.dataset.taskId;
    const nextStatus = option.dataset.solveOption;
    if (!taskId || !SOLVE_STATUS_MAP.has(nextStatus)) return;
    const task = DATA?.tasks?.find((item) => item.id === taskId);
    const currentStatus = solveStatusOf(task);
    if (nextStatus === currentStatus) { closeSolveMenu(); return; }
    solveMenuSaving = true;
    for (const btn of menu.querySelectorAll('button')) btn.disabled = true;
    menu.classList.add('is-saving');
    try {
      const res = await api(`admin/tasks/${encodeURIComponent(taskId)}/solve-status`, {
        method: 'PUT',
        body: { status: nextStatus },
      });
      const saved = normalizeSolveStatus(res?.solveStatus ?? nextStatus);
      applyTaskSolveStatus(taskId, saved);
      closeSolveMenu();
      toast(`${tr('解决状态')}：${tr(solveStatusMeta(saved).label)}`);
    } catch (error) {
      toast(error?.message || tr('状态保存失败，请重试'));
    } finally {
      solveMenuSaving = false;
      for (const btn of menu.querySelectorAll('button')) btn.disabled = false;
      menu.classList.remove('is-saving');
    }
  });
  document.body.appendChild(menu);
  solveMenuEl = menu;
  return menu;
}

function openSolveMenu(trigger) {
  const taskId = trigger.dataset.solveTrigger;
  if (!taskId || !isStaff()) return;
  if (solveMenuTrigger === trigger && solveMenuEl && !solveMenuEl.hidden) {
    closeSolveMenu();
    return;
  }
  closeSubcatMenu();
  closeSolveMenu();
  const task = DATA?.tasks?.find((item) => item.id === taskId);
  const current = normalizeSolveStatus(trigger.dataset.solveStatus ?? solveStatusOf(task));
  const menu = ensureSolveMenu();
  menu.dataset.taskId = taskId;
  menu.setAttribute('aria-label', tr('修改题目解决状态'));
  menu.innerHTML = `<div class="solve-menu-head">${esc(tr('解决状态'))}</div>${SOLVE_STATUSES.map((item) => `
    <button type="button" class="solve-menu-item${item.key === current ? ' is-active' : ''}" role="menuitemradio" aria-checked="${item.key === current}" data-solve-option="${esc(item.key)}" data-solve-status="${esc(item.key)}">
      <span class="solve-dot" aria-hidden="true"></span>
      <span class="solve-menu-name">${esc(tr(item.label))}</span>
      <span class="solve-menu-check" aria-hidden="true">${item.key === current ? '✓' : ''}</span>
    </button>`).join('')}`;
  menu.hidden = false;
  solveMenuTrigger = trigger;
  trigger.setAttribute('aria-expanded', 'true');
  positionSolveMenu(trigger);
  // The menu sits at the end of the page; keyboard users land on its current choice (Escape returns).
  menu.querySelector('.solve-menu-item.is-active:not(:disabled), .solve-menu-item:not(:disabled):not(.is-disabled)')?.focus({ preventScroll: true });
}

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-solve-trigger]');
  if (trigger) {
    event.preventDefault();
    event.stopPropagation();
    openSolveMenu(trigger);
    return;
  }
  if (solveMenuEl && !solveMenuEl.hidden && !event.target.closest('.solve-status-menu')) closeSolveMenu();
}, true);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && solveMenuEl && !solveMenuEl.hidden) {
    const trigger = solveMenuTrigger;
    closeSolveMenu();
    trigger?.focus?.();
  }
});
window.addEventListener('resize', closeSolveMenu);
window.addEventListener('scroll', () => {
  if (solveMenuEl && !solveMenuEl.hidden && solveMenuTrigger) positionSolveMenu(solveMenuTrigger);
}, true);
window.addEventListener('hashchange', closeSolveMenu);
window.addEventListener('localechange', () => {
  closeSolveMenu();
  for (const node of document.querySelectorAll('[data-solve-corner], [data-solve-side]')) {
    syncSolveNode(node, node.dataset.solveStatus);
  }
});
function subcatLabelOf(category, subName) {
  const found = subcategoriesOf(category).find((s) => s.name === subName);
  return found ? tr(found.label) : (subName ? tr(subName) : tr('未设置细分'));
}

function taskSubcatSidebarHtml(t) {
  const subs = subcategoriesOf(t.category).filter((s) => !s.disabled);
  if (!isStaff() || !subs.length) return '';
  const current = subcategoryOf(t);
  const labelText = current ? subcatLabelOf(t.category, current) : tr('未设置细分');
  return `<button type="button" class="subcat-side${current ? '' : ' is-unset'}" data-subcat-trigger="${esc(t.id)}" data-subcat-value="${esc(current)}" aria-haspopup="menu" aria-expanded="false" title="${esc(tr('点击修改细分分类'))}"><span class="subcat-side-kicker">${esc(tr('细分方向'))}</span><span class="subcat-side-label">${esc(labelText)}</span><span class="solve-side-caret" aria-hidden="true">▾</span></button>`;
}

function applyTaskSubcategory(taskId, subcategory) {
  const tasks = Array.isArray(DATA?.tasks) ? DATA.tasks : [];
  const task = tasks.find((item) => item.id === taskId);
  const category = task?.category ?? '';
  const clean = typeof subcategory === 'string' && subcategoriesOf(category).some((s) => s.name === subcategory && !s.disabled) ? subcategory : '';
  if (task) task.subcategory = clean;
  if (Array.isArray(platform?.questions)) {
    const q = platform.questions.find((item) => item.id === taskId);
    if (q) q.subcategory = clean;
  }
  const btn = document.querySelector(`[data-subcat-trigger="${CSS.escape(taskId)}"]`);
  if (btn) {
    btn.dataset.subcatValue = clean;
    btn.classList.toggle('is-unset', !clean);
    const lbl = btn.querySelector('.subcat-side-label');
    if (lbl) lbl.textContent = clean ? subcatLabelOf(category, clean) : tr('未设置细分');
  }
  const sideTags = $('.app-sidebar .side-tags');
  if (sideTags && task) {
    sideTags.querySelector('.tag-sub')?.remove();
    if (clean) {
      const kindEl = sideTags.querySelector('.tag-kind');
      const liHtml = `<li class="tag-sub"><a href="${LIBRARY.href}/${encodeURIComponent(task.category)}/${encodeURIComponent(clean)}">${esc(tr(clean))}</a></li>`;
      if (kindEl) kindEl.insertAdjacentHTML('afterend', liHtml);
      else sideTags.insertAdjacentHTML('afterbegin', liHtml);
    }
  }
  const cardTags = document.querySelector(`[data-task-card="${CSS.escape(taskId)}"] .tag-line`);
  if (cardTags && task) {
    cardTags.querySelector('.tag-sub')?.remove();
    if (clean) {
      const kindEl = cardTags.querySelector('.tag-kind');
      const liHtml = `<li class="tag-sub">${esc(tr(clean))}</li>`;
      if (kindEl) kindEl.insertAdjacentHTML('afterend', liHtml);
      else cardTags.insertAdjacentHTML('afterbegin', liHtml);
    }
  }
}

let subcatMenuEl = null;
let subcatMenuTrigger = null;
let subcatMenuSaving = false;

function closeSubcatMenu() {
  if (subcatMenuTrigger) subcatMenuTrigger.setAttribute('aria-expanded', 'false');
  subcatMenuTrigger = null;
  if (subcatMenuEl) {
    subcatMenuEl.hidden = true;
    subcatMenuEl.removeAttribute('data-task-id');
  }
}

function positionSubcatMenu(trigger) {
  if (!subcatMenuEl || !trigger || !trigger.isConnected) { closeSubcatMenu(); return; }
  const rect = trigger.getBoundingClientRect();
  const menuRect = subcatMenuEl.getBoundingClientRect();
  const margin = 8;
  let left = rect.left;
  if (left + menuRect.width > innerWidth - margin) left = Math.max(margin, innerWidth - menuRect.width - margin);
  let top = rect.bottom + 6;
  if (top + menuRect.height > innerHeight - margin) {
    const above = rect.top - menuRect.height - 6;
    top = above >= margin ? above : Math.max(margin, innerHeight - menuRect.height - margin);
  }
  subcatMenuEl.style.left = `${Math.round(left)}px`;
  subcatMenuEl.style.top = `${Math.round(top)}px`;
}

function ensureSubcatMenu() {
  if (subcatMenuEl) return subcatMenuEl;
  const menu = document.createElement('div');
  menu.className = 'solve-status-menu subcat-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', tr('点击修改细分分类'));
  menu.hidden = true;
  menu.addEventListener('click', async (event) => {
    const option = event.target.closest('[data-subcat-option]');
    if (!option || subcatMenuSaving || option.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    const taskId = menu.dataset.taskId;
    const nextSub = option.dataset.subcatOption;
    if (!taskId) return;
    const task = DATA?.tasks?.find((item) => item.id === taskId);
    const currentSub = subcategoryOf(task);
    if (nextSub === currentSub) { closeSubcatMenu(); return; }
    subcatMenuSaving = true;
    for (const btn of menu.querySelectorAll('button')) btn.disabled = true;
    menu.classList.add('is-saving');
    try {
      const res = await api(`admin/tasks/${encodeURIComponent(taskId)}/subcategory`, {
        method: 'PUT',
        body: { subcategory: nextSub },
      });
      const saved = typeof res?.subcategory === 'string' ? res.subcategory : nextSub;
      applyTaskSubcategory(taskId, saved);
      closeSubcatMenu();
      toast(`${tr('细分方向')}：${saved ? tr(saved) : tr('未设置细分')}`);
    } catch (error) {
      toast(error?.message || tr('状态保存失败，请重试'));
    } finally {
      subcatMenuSaving = false;
      for (const btn of menu.querySelectorAll('button')) {
        btn.disabled = btn.dataset.disabledOption === '1';
      }
      menu.classList.remove('is-saving');
    }
  });
  document.body.appendChild(menu);
  subcatMenuEl = menu;
  return menu;
}

function openSubcatMenu(trigger) {
  const taskId = trigger.dataset.subcatTrigger;
  if (!taskId || !isStaff()) return;
  if (subcatMenuTrigger === trigger && subcatMenuEl && !subcatMenuEl.hidden) {
    closeSubcatMenu();
    return;
  }
  closeSolveMenu();
  closeSubcatMenu();
  const task = DATA?.tasks?.find((item) => item.id === taskId);
  if (!task) return;
  const subs = subcategoriesOf(task.category);
  const current = subcategoryOf(task);
  const menu = ensureSubcatMenu();
  menu.dataset.taskId = taskId;
  menu.setAttribute('aria-label', tr('点击修改细分分类'));
  menu.innerHTML = `<div class="solve-menu-head">${esc(tr('细分方向'))}</div>${subs.map((item) => `
    <button type="button" class="solve-menu-item${item.name === current ? ' is-active' : ''}${item.disabled ? ' is-disabled' : ''}" role="menuitemradio" aria-checked="${item.name === current}" data-subcat-option="${esc(item.name)}" data-disabled-option="${item.disabled ? '1' : '0'}"${item.disabled ? ' disabled' : ''}>
      <span class="solve-menu-name">${esc(tr(item.label))}</span>
      <span class="solve-menu-check" aria-hidden="true">${item.name === current ? '✓' : ''}</span>
    </button>`).join('')}`;
  menu.hidden = false;
  subcatMenuTrigger = trigger;
  trigger.setAttribute('aria-expanded', 'true');
  positionSubcatMenu(trigger);
  // The menu sits at the end of the page; keyboard users land on its current choice (Escape returns).
  menu.querySelector('.solve-menu-item.is-active:not(:disabled), .solve-menu-item:not(:disabled):not(.is-disabled)')?.focus({ preventScroll: true });
}

document.addEventListener('click', (event) => {
  const subTrigger = event.target.closest('[data-subcat-trigger]');
  if (subTrigger) {
    event.preventDefault();
    event.stopPropagation();
    openSubcatMenu(subTrigger);
    return;
  }
  if (subcatMenuEl && !subcatMenuEl.hidden && !event.target.closest('.subcat-menu')) closeSubcatMenu();
}, true);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && subcatMenuEl && !subcatMenuEl.hidden) {
    const trigger = subcatMenuTrigger;
    closeSubcatMenu();
    trigger?.focus?.();
  }
});
window.addEventListener('resize', closeSubcatMenu);
window.addEventListener('scroll', () => {
  if (subcatMenuEl && !subcatMenuEl.hidden && subcatMenuTrigger) positionSubcatMenu(subcatMenuTrigger);
}, true);
window.addEventListener('hashchange', closeSubcatMenu);
window.addEventListener('localechange', () => {
  closeSubcatMenu();
  for (const btn of document.querySelectorAll('[data-subcat-trigger]')) {
    const task = DATA?.tasks?.find((item) => item.id === btn.dataset.subcatTrigger);
    const val = btn.dataset.subcatValue || '';
    const lbl = btn.querySelector('.subcat-side-label');
    if (lbl) lbl.textContent = val ? subcatLabelOf(task?.category ?? '', val) : tr('未设置细分');
    const kicker = btn.querySelector('.subcat-side-kicker');
    if (kicker) kicker.textContent = tr('细分方向');
    btn.setAttribute('title', tr('点击修改细分分类'));
  }
});


let MODELS;
let HARNESSES;
let PROVIDERS;
let resolveModel;
let initialPlatformSettled = false;

// Uploads may name a model that is not in the registry; they carry their own name and vendor.
const modelOf = (r) => resolveModel({ model: r.model, modelName: r.modelName ?? r.model, vendor: r.vendorName ?? r.vendor });
const vendorOf = (r) => modelOf(r).vendor || '其他';
const harnessOf = (r) => (r.harness && HARNESSES.get(r.harness)) || (r.harnessName || r.harness ? { name: r.harnessName ?? r.harness } : null);
// Provider is only official or not: anything named other than 'official' counts as unofficial.
const providerOf = (r) => (r.provider || r.providerName ? PROVIDERS.get(r.provider === 'official' ? 'official' : 'unofficial') : null);
const providerKey = (r) => providerOf(r)?.id ?? 'unset';
const sourceLine = (r) => {
  const harness = harnessOf(r);
  return [harness?.name, providerOf(r)?.name].filter(Boolean).join(' · ');
};
const sourceHtml = (r) => [harnessOf(r)?.name ? `<span data-i18n-ignore>${esc(harnessOf(r).name)}</span>` : '', providerOf(r)?.name ? `<span>${esc(providerOf(r).name)}</span>` : ''].filter(Boolean).join(' · ');
const sourceKey = (r, field, nameField) => r[field] ? `id:${r[field]}` : r[nameField] ? `name:${r[nameField]}` : 'unset';
const label = (r) => (r.effort ? `${modelOf(r).name} · ${r.effort}` : modelOf(r).name);
// Works outside the blind test (multi-turn or with human help) say so on their card.
const INTERVENTION_TEXT = { 'prompt-guided': '人工提示与指导', 'code-edited': '人工修改了代码' };
const generationBadges = (r) => standard(r) ? '' : `${r.generationMode === 'multi-turn' ? '<span class="badge" title="多轮生成 · 只展示，不参与盲评">多轮</span>' : ''}${INTERVENTION_TEXT[r.humanIntervention] ? `<span class="badge" title="${INTERVENTION_TEXT[r.humanIntervention]} · 只展示，不参与盲评">人工介入</span>` : ''}`;
// AI-graded questions show their grade where blind questions rely on the leaderboard.
const aiScoreBadge = (r) => {
  const grade = aiScoreOf(r);
  return grade ? `<span class="badge" title="${esc(grade.judge ? `评分模型：${grade.judge}` : 'AI 评分')}">AI 评分 ${grade.score} / ${grade.max}</span>`
    : '<span class="badge" title="推理题由 AI 评分，评分开放前不显示">AI 评分待开放</span>';
};
const resultBadges = (r) => `${r.effort ? `<span class="badge" data-i18n-ignore>${esc(r.effort)}</span>` : ''}${r.sourceLabel ? `<span class="badge source-badge" data-i18n-ignore>${esc(r.sourceLabel)}</span>` : ''}${generationBadges(r)}`;
// Leaderboard entry of a work (model + effort), the same key the server ranks by.
const normal = (s) => String(s ?? '').normalize('NFKC').trim().toLowerCase();
const modelKey = (r) => (MODELS.has(r.model) ? r.model : `x:${normal(r.modelName ?? r.model)}`);
const entryKey = (r) => `${modelKey(r)}|${normal(r.effort)}`;
// A work's registered model, including uploads that named one before it was registered.
const registeredOf = (r) => modelOf(r).id;
const modelCount = (results) => new Set(results.map((r) => registeredOf(r) ?? modelKey(r))).size;
// The index and its counts show only registered models with a verified work.
function exhibitedModels() {
  const ids = new Set(DATA.tasks.flatMap((t) => t.results.filter((r) => r.status === 'verified').map(registeredOf)));
  return DATA.models.filter((m) => ids.has(m.id));
}
const sortModes = { added: '加入时间（最新在前）', vendor: '模型厂商（A–Z）', name: '模型名字（A–Z）', score: '榜单评分（高到低）' };
const sortChoices = () => Object.entries(sortModes).filter(([value]) => value !== 'score' || platform.available);
let resultSort = Object.hasOwn(sortModes, store.get('result-sort')) ? store.get('result-sort') : 'added';
let previewMode = store.get('preview-mode') === 'screenshot' ? 'screenshot' : 'model';
document.body.dataset.previewMode = previewMode;
const sortControl = () => `<label class="result-sort">排序<select data-result-sort>${sortChoices().map(([value, text]) => `<option value="${value}"${value === resultSort ? ' selected' : ''}>${text}</option>`).join('')}</select></label>`;
// Verified works come first, questioned ones last; the chosen order applies within each group.
const STATUS_ORDER = { verified: 0, unverified: 1, questioned: 2 };
let taskScores = new Map();
function sortedResults(t) {
  return [...t.results].sort((a, b) => {
    const group = (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0);
    if (group) return group;
    if (resultSort === 'vendor') return byName(vendorOf(a), vendorOf(b)) || byName(label(a), label(b));
    if (resultSort === 'name') return byName(label(a), label(b));
    if (resultSort === 'score') return (taskScores.get(entryKey(b)) ?? -Infinity) - (taskScores.get(entryKey(a)) ?? -Infinity) || byName(label(a), label(b));
    return (Date.parse(b.addedAt) || 0) - (Date.parse(a.addedAt) || 0);
  });
}
function setResultSort(value) {
  resultSort = value;
  store.set('result-sort', value);
}
// Cover: the work's own preview capture, else its first-screen capture, else the author's first
// screenshot, else any other capture (work-preview-media.js).
const cover = screenshotOf;
// Works without a screenshot yet show their title instead of an empty frame.
function coverHtml(r, cls = '', eager = false, task = null) {
  const src = task ? previewScreenshotOf(task, r) : cover(r);
  if (src) return img(src, r.title, cls, eager);
  return `<div class="${cls} img-empty upload-cover"><b><span data-i18n-ignore>${esc(r.title)}</span></b><span>${platform.site?.capture ? '截图生成中' : '暂无截图'}</span></div>`;
}
const taskHref = (t) => `#/${t.id}`;
const viewHref = (t, a, b) => `#/${t.id}/${a}${b ? `/vs/${b}` : ''}`;
const hasExhibition = (t) => t.sandtable;
const sandtableHref = (t, ids = []) => `#/${t.id}/sandtable${ids.length ? `/${ids.join(',')}` : ''}`;
// Works this site serves itself can be framed same-origin: the sandtable, the exhibition, card
// models and injected controls need that. Works on the content origin stay sandboxed.
const hosted = (r) => Boolean(r.scene) && new URL(r.scene, document.baseURI).origin === location.origin;
const hostedTask = (t) => ({ ...t, results: t.results.filter(hosted) });
// Account-owned works and questions keep their author's name.
const authorName = (item) => (bySite(item) ? DATA.title : item.author.name ?? '已注销的用户');
const authorAvatar = (item) => (bySite(item) ? LOGO : avatarFace(item.author.avatar, item.author.name ?? ''));
const workKey = (t, r) => `${t.id}/${r.id}`;
const interactive = (r) => r.status !== 'questioned';
// Whether a work has a gallery page: the public catalog holds exactly the works the gallery shows,
// so an unverified, held or taken-down upload links to its own preview instead.
const inGallery = (taskId, id) => DATA.tasks.some((t) => t.id === taskId && t.results.some((r) => r.id === id));

// Images fade in once decoded; `load` does not bubble, so listen in the capture phase.
document.addEventListener('load', (e) => { if (e.target.tagName === 'IMG') e.target.classList.add('is-loaded'); }, true);
document.addEventListener('error', (e) => { if (e.target.tagName === 'IMG') e.target.classList.add('is-loaded', 'is-broken'); }, true);
document.addEventListener('click', (e) => { if (e.target.closest('[data-reload]')) location.reload(); });
document.addEventListener('click', async (e) => {
  const button = e.target.closest('[data-platform-reconnect]');
  if (!button || button.disabled) return;
  button.disabled = true;
  button.textContent = '正在连接…';
  const connected = await refreshPlatform('reconnect');
  if (button.isConnected) { button.disabled = false; button.textContent = connected ? '已连接' : '重新连接'; }
});
const RELOAD = '<button type="button" class="btn primary" data-reload>刷新页面</button>';

// A tab left open across a release keeps its old import map, so a page it loads later can get new
// modules that link against old ones. The build writes this tab's ?v= to version.json; when they
// differ, only a full reload helps, and it keeps the address.
const loadedVersion = new URL(import.meta.url).searchParams.get('v');
async function showLoadFailure(container, error, title, backLink = '') {
  const details = `<p></p><div class="${backLink ? 'empty-actions' : 'board-empty-actions'}">${RELOAD}${backLink}</div>`;
  container.innerHTML = backLink ? `<h1></h1>${details}`
    : `<div class="board-empty"><p class="board-empty-title"></p>${details}</div>`;
  const [heading, message] = (backLink ? container : container.firstElementChild).children;
  heading.textContent = title;
  message.textContent = error?.message ?? String(error);
  if (!loadedVersion) return;
  try {
    const res = await fetch('version.json', { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    const { assets } = res.ok ? await res.json() : {};
    if (assets && assets !== loadedVersion && heading.isConnected) {
      heading.textContent = '页面已更新';
      message.textContent = '网站已发布新版本，这个标签页仍是旧版。刷新后会回到当前页面。';
    }
  } catch { /* The original error and reload action are already visible. */ }
}
const settleImages = () => {
  deferredMedia.refresh(root);
  $$('img[src]', root).forEach((im) => { if (im.complete && im.naturalWidth) im.classList.add('is-loaded'); });
};

// ---- shell ----------------------------------------------------------------------------
const previewControl = () => `<div class="preview-setting" role="group" aria-label="作品卡片预览">
  <button data-preview-mode="screenshot" aria-pressed="${previewMode === 'screenshot'}" title="截图预览 · 减少设备负担">截图</button>
  <button data-preview-mode="model" aria-pressed="${previewMode === 'model'}" title="小模型预览 · 可随鼠标转动">小模型</button>
</div>`;
const SITE_NAV = [['questions', '题库'], ['arena', '盲评'], ['leaderboard', '排行榜'], ['new', '发起题目']];
// Breadcrumbs follow the real hierarchy: each section is its own root. The crumb one level up is
// the way back, so it returns to that page as the reader left it.
const LIBRARY = { text: '题库', href: '#/questions' };
function breadcrumbTrail(crumbs = []) {
  const items = crumbs.length ? crumbs : [{ text: DATA.subtitle }];
  return items.map((c, i) => `${i ? '<span class="sep" aria-hidden="true">/</span>' : ''}${c.href
    ? `<a${c.original ? ' data-i18n-ignore' : ''} href="${esc(back?.up === c.href ? back.href : c.href)}" title="${esc(c.text)}"${back?.up === c.href ? ' data-back' : ''}${c.href === LIBRARY.href ? ' data-home-view="tasks"' : ''}>${esc(c.text)}</a>`
    : `<span${c.original ? ' data-i18n-ignore' : ''} aria-current="page" title="${esc(c.text)}">${esc(c.text)}</span>`}`).join('');
}
// Shown under the top bar while the platform and the archive disagree on the data version.
const platformNotice = () => `<div class="platform-notice" role="status"><div class="wrap platform-notice-in">
  <span class="platform-notice-mark" aria-hidden="true"></span>
  <p><strong>有新内容，请刷新</strong><span>刷新后可查看最新作品；上传和盲评可继续使用。</span></p>
  <button type="button" class="link" data-reload>刷新页面</button>
</div></div>`;
function header(crumbs = [], showPreviewSetting = false, current = '', { notice = true } = {}) {
  const hasNav = catalogState() !== 'static';
  const navItems = SITE_NAV.filter(([id]) => id !== 'new');
  const publishItem = SITE_NAV.find(([id]) => id === 'new');
  const nav = hasNav
    ? `<nav class="site-nav" aria-label="平台">${navItems.map(([id, text]) => `<a class="topbar-link" href="#/${id}"${id === current ? ' aria-current="page"' : ''}>${text}</a>`).join('')}</nav>`
    : '';
  const cta = hasNav && publishItem
    ? `<a class="topbar-link topbar-cta" href="#/${publishItem[0]}"${publishItem[0] === current ? ' aria-current="page"' : ''}>${icon('plus')}<span>${publishItem[1]}</span></a>`
    : '';
  return `<header class="topbar"><div class="wrap topbar-in">
    <div class="topbar-island topbar-left">
      <a class="brand" href="#/" aria-label="${esc(DATA.title)} · 首页">${LOGO}<span class="wordmark">${esc(DATA.title)}</span></a>
      ${backLink('top-back')}
      <nav class="crumbs" aria-label="面包屑">${breadcrumbTrail(crumbs)}</nav>
    </div>
    <div class="topbar-tools${showPreviewSetting ? ' has-preview-setting' : ''}${platform.available ? ' has-platform' : ''}">
      ${accountControl(current === 'me')}
      <div class="topbar-island topbar-dock">
        ${nav}
        ${hasNav ? '<span class="topbar-sep" aria-hidden="true"></span>' : ''}
        ${platform.available ? '' : ext(DATA.repo, 'GitHub', 'topbar-link topbar-github')}
        ${languageButton()}${themeButton()}
        ${cta}
      </div>
    </div>
  </div></header>${notice && platform.available && platform.connectionError ? `<div class="platform-notice" role="status"><div class="wrap platform-notice-in"><span class="platform-notice-mark" aria-hidden="true"></span><p><strong>连接暂时中断</strong><span>当前保留上次加载的作品与账户信息，重新连接后更新。</span></p><button type="button" class="link" data-platform-reconnect>重新连接</button></div></div>` : platform.stale && notice ? platformNotice() : ''}`;
}
// The two 3D views sit under their task; the mode switch names the current one.
function galleryStageHeader(t, mode) {
  const modes = [['exhibition', '原作展厅'], ['sandtable', '三维沙盘']];
  return `<header class="topbar sandbar"><div class="wrap topbar-in sandbar-in">
    <a class="brand" href="#/" aria-label="${esc(DATA.title)} · 首页">${LOGO}<span class="wordmark">${esc(DATA.title)}</span></a>
    ${backLink('top-back')}
    <nav class="crumbs sand-crumbs" aria-label="面包屑">${breadcrumbTrail([LIBRARY, { text: t.title, original: true, href: taskHref(t) }])}</nav>
    <nav class="display-modes" aria-label="展示模式">${modes.map(([id, name]) => `<a ${id === mode ? 'aria-current="page"' : 'data-switch-mode'} href="#/${t.id}/${id}">${name}</a>`).join('')}</nav>
    <div class="sandbar-tools"><span class="sand-count">已选择 <b data-count>0</b> 件</span><button class="btn sm" data-action="panel" aria-expanded="true" aria-controls="${mode === 'sandtable' ? 'sand-library' : 'exhibition-library'}">选择模型</button>${languageButton()}${themeButton()}</div>
  </div></header>`;
}
const footer = () => `<footer class="footer"><div class="wrap footer-in">
  <p class="footer-brand">${LOGO}<span>${esc(DATA.title)}</span><span class="muted">前端作品档案</span></p>
  <div class="footer-links">${platform.available ? '<a href="#/changelog">更新日志</a>' : ''}<a href="#/team">开发者团队</a>${platform.available ? '<a href="#/new">发起题目</a><a href="#/leaderboard">榜单</a>' : ''}<a href="${esc(DATA.repo)}" target="_blank" rel="noopener">项目仓库</a><a href="${esc(DATA.repo)}#readme" target="_blank" rel="noopener">参与贡献</a><a href="#/terms">使用条款</a><a href="#/privacy">隐私政策</a><a href="mailto:${CONTACT}">联系我们</a></div>
  <p class="footer-legal">© ${new Date().getFullYear()} ${esc(DATA.title)} · 站内作品由 AI 模型生成，仅供比较与学习参考 · 引用或转载请<a href="#/terms#cite">注明来源</a> · <a href="mailto:${CONTACT}">${CONTACT}</a>${beianLink() ? ` · ${beianLink()}` : ''}</p>
</div></footer>`;

let draftOrnamentUid = 0;
function draftOrnamentHtml(extraClass = '') {
  const uid = ++draftOrnamentUid;
  const hatchId = `draft-hatch-${uid}`;
  const fadeId = `draft-fade-${uid}`;
  const maskId = `draft-mask-${uid}`;
  // 100% original ArenaGalleri drafting motif: one prompt beam projecting onto stepped parallel specimen frames.
  return `<span class="draft-ornament${extraClass ? ` ${extraClass}` : ''}" aria-hidden="true"><svg viewBox="0 0 280 78" fill="none"><defs><pattern id="${hatchId}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="5" stroke="var(--draft-hatch)" stroke-width="1"/></pattern><linearGradient id="${fadeId}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#000"/><stop offset="18%" stop-color="#fff"/><stop offset="94%" stop-color="#fff"/><stop offset="100%" stop-color="#000"/></linearGradient><mask id="${maskId}"><rect x="0" y="0" width="280" height="78" fill="url(#${fadeId})"/></mask></defs><g mask="url(#${maskId})" stroke="var(--draft-line)" stroke-width="0.7"><line x1="0" y1="8" x2="278" y2="8"/><line x1="0" y1="26" x2="278" y2="26"/><line x1="0" y1="54" x2="278" y2="54"/><line x1="0" y1="70" x2="278" y2="70"/><line x1="58" y1="2" x2="58" y2="76"/><line x1="128" y1="2" x2="128" y2="76"/><line x1="196" y1="2" x2="196" y2="76"/><line x1="252" y1="2" x2="252" y2="76"/></g><g stroke="var(--draft-dash)" stroke-width="0.95" stroke-dasharray="2.2 2.6" stroke-linecap="round"><line x1="94" y1="17" x2="146" y2="17"/><line x1="128" y1="17" x2="128" y2="42"/><line x1="128" y1="42" x2="146" y2="42"/></g><rect x="58" y="11" width="36" height="12" rx="2.5" fill="var(--draft-fill)" stroke="var(--draft-stroke)" stroke-width="1.05"/><line x1="64" y1="17" x2="88" y2="17" stroke="var(--draft-stroke)" stroke-width="1.1" stroke-linecap="round"/><g><rect x="192" y="10" width="60" height="42" rx="4" fill="var(--draft-fill)" stroke="var(--draft-dash)" stroke-width="1" stroke-dasharray="2.4 2.4"/><rect x="169" y="18" width="60" height="42" rx="4" fill="var(--draft-fill)" stroke="var(--draft-stroke)" stroke-width="1"/><rect x="146" y="26" width="60" height="42" rx="4" fill="var(--draft-fill)" stroke="var(--draft-stroke)" stroke-width="1.1"/><rect x="152" y="32" width="48" height="22" rx="2" fill="url(#${hatchId})" stroke="var(--draft-line)" stroke-width="0.8"/><line x1="152" y1="61" x2="174" y2="61" stroke="var(--draft-stroke)" stroke-width="1.4" stroke-linecap="round"/><rect x="184" y="58.5" width="16" height="4.8" rx="1.4" fill="var(--accent)"/></g><g stroke="var(--draft-stroke)" stroke-width="0.85"><line x1="55" y1="8" x2="61" y2="8"/><line x1="58" y1="5" x2="58" y2="11"/><line x1="249" y1="70" x2="255" y2="70"/><line x1="252" y1="67" x2="252" y2="73"/></g></svg></span>`;
}

// Section titles pair the Chinese name with an English word, as the team page does (团队 Team).
// Neither half is translated; in English the pair trades sizes (studio.css).
const TITLE_EN = { 题库: 'Questions', 盲评: 'Blind review', 排行榜: 'Leaderboard', 更新日志: 'Changelog', 发起题目: 'New question', 资格考试: 'Exam', 上传作品: 'Upload', 个人中心: 'Account', 维度图: 'Dimensions', 使用条款: 'Terms', 隐私政策: 'Privacy' };
// A long question title steps down a size, so the display serif breaks into even lines instead of stranding one character.
const titleWidth = (text) => [...String(text ?? '')].reduce((n, ch) => n + (/[\u2e80-\u9fff\uff00-\uffef]/.test(ch) ? 1 : 0.55), 0);
const pageTitle = (title) => (TITLE_EN[title]
  ? `<h1 class="page-title" data-i18n-ignore><span class="page-title-zh">${esc(title)}</span><span class="page-title-en" lang="en">${TITLE_EN[title]}</span></h1>`
  : `<h1${titleWidth(title) > 9 ? ' class="is-long"' : ''}>${esc(title)}</h1>`);
const SIDE_MOTTO = '同一份提示词，看见不同的答案。';
// A shared two-column shell keeps every platform page in the same exhibition. The top bar is the
// site navigation and carries the way back; the sidebar only holds this section's own views.
function pageStart({ title, description, descriptionOriginal = false, section, meta = '', nav = '', heading = title, headingOriginal = false, caption = '', crumbs = [{ text: title }] }) {
  return `${header(crumbs, false, section)}<div class="app-layout platform-layout">
    <aside class="app-sidebar">
      ${pageTitle(title)}<p class="side-intro"${descriptionOriginal ? ' data-i18n-ignore' : ''}>${esc(description)}</p>${meta}${nav}
      ${description === SIDE_MOTTO ? '' : '<div class="side-bottom"><p>同一份提示词，<br>看见不同的答案。</p></div>'}
    </aside><main class="workspace page"><div class="collection-heading${caption ? '' : ' has-draft'}"><h2${headingOriginal ? ' data-i18n-ignore' : ''}>${esc(heading)}</h2>${caption || draftOrnamentHtml()}</div>`;
}
// Views of the current section in a platform sidebar: [href, glyph, text, current, count].
const sideNav = (label, links) => `<nav class="side-nav section-nav" aria-label="${esc(label)}">${links.map(([href, glyph, text, current, count]) => `<a class="side-link" href="${esc(href)}"${current ? ' aria-current="page"' : ''}>${icon(glyph)}${esc(text)}${count === undefined ? '' : `<span class="nav-count">${count}</span>`}</a>`).join('')}</nav>`;
const pageEnd = () => `${footer()}</main></div>`;
const searchControl = (type, placeholder, value = '') => `<label class="collection-search">${icon('search')}<input type="search" data-${type}-search aria-label="${placeholder}" placeholder="${placeholder}" value="${esc(value)}"></label>`;
const questionSorts = { random: '随机排序', popularity: '热度（高到低）', recommended: '推荐（热门与探索）', date: '发布时间（最新在前）', works: '解答数量（多到少）', title: '题目名称（A–Z）' };
const recommendationLabels = { popular: '热门', unanswered: '等你来测', explore: '待探索', recent: '新题' };
const homeState = { category: '', subcategory: '', treeOpen: false, domain: '', solveStatus: '', model: '', unanswered: false, query: '', view: 'tasks', sort: Object.hasOwn(questionSorts, store.get('question-sort')) ? store.get('question-sort') : 'random', recommendationBatch: 0, modelQuery: '', vendor: '' };
// Keep one random position per question until reload, including across filters and catalog updates.
const questionRandomOrder = new Map();

// ---- home -----------------------------------------------------------------------------
// Questioned works stay visible as reference but are left out of every count.
const counted = (t) => t.results.filter(interactive);

function libraryStart(crumbs) {
  const works = DATA.tasks.reduce((sum, t) => sum + counted(t).length, 0);
  const models = exhibitedModels();
  const vendorCount = new Set(models.map((m) => m.vendor || '其他')).size;
  const control = (cls, attrs, pressed, body) => `<button class="${cls}" ${attrs} aria-pressed="${pressed}">${body}</button>`;
  const domains = domainsIn(DATA.tasks, domainList(platform));
  return `${header(crumbs, false, 'questions')}<div class="app-layout home-layout">
    <aside class="app-sidebar">
      ${pageTitle('题库')}<p class="side-intro">${['ready', 'static'].includes(catalogState()) ? `${DATA.tasks.length} 道题目 · ${works} 件作品` : '最新题目与作品正在加载'}</p>
      <nav class="side-nav section-nav" aria-label="题库导航">
        ${control('side-link', 'data-home-view="tasks"', true, `${icon('grid')}全部题目${['ready', 'static'].includes(catalogState()) ? `<span class="nav-count">${DATA.tasks.length}</span>` : ''}`)}
        ${tracksOf(DATA.tasks, { alwaysInclude: libraryCategories() }).map((x) => {
          const hasSubs = x.subcategories.length > 0;
          return `<div class="side-tree-group${hasSubs ? '' : ' is-leaf'}" data-tree-group="${esc(x.name)}"${hasSubs ? ' data-expanded="false"' : ''}>
          <button class="side-link${hasSubs ? ' side-tree-parent' : ''}" type="button" data-home-category="${esc(x.name)}" aria-pressed="false"${hasSubs ? ' aria-expanded="false"' : ''}>${icon(x.glyph)}<span class="side-link-text">${esc(x.label)}</span>${hasSubs ? '<span class="side-tree-caret" aria-hidden="true">▸</span>' : ''}<span class="nav-count">${x.tasks.length}</span></button>
          ${hasSubs ? `<div class="side-tree-children-wrap"><div class="side-tree-children" role="group" aria-label="${esc(x.label)}">
            ${x.subcategories.map((sub) => sub.disabled
              ? `<span class="side-sublink is-disabled" aria-disabled="true"><span class="side-sublink-branch" aria-hidden="true"></span><span class="side-sublink-label">${esc(sub.label)}</span></span>`
              : `<button type="button" class="side-sublink" data-home-subcategory="${esc(sub.name)}" data-parent-category="${esc(x.name)}" aria-pressed="false"><span class="side-sublink-branch" aria-hidden="true"></span><span class="side-sublink-label">${esc(sub.label)}</span><span class="nav-count">${sub.count}</span></button>`).join('')}
          </div></div>` : ''}
        </div>`;
        }).join('')}
        <span class="side-divider" aria-hidden="true"></span>
        ${control('side-link', 'data-home-view="models"', false, `${icon('code')}模型索引${['ready', 'static'].includes(catalogState()) ? `<span class="nav-count">${models.length}</span>` : ''}`)}
      </nav>
      <div class="side-mobile-subcats chips" data-mobile-subcats hidden></div>
      ${domains.length ? `<section class="side-section" aria-label="按领域筛选"><h2>领域</h2><div class="chips">${domains.map((d) => control('chip', `data-home-domain="${esc(d.name)}"`, false, `${esc(d.name)}<span class="nav-count">${d.tasks.length}</span>`)).join('')}</div></section>` : ''}
      <div class="side-bottom"><p>${['ready', 'static'].includes(catalogState()) ? `${vendorCount} 家厂商 · ${models.length} 个模型<br>` : ''}同一份提示词，不同的表达。</p></div>
    </aside>
    <main class="workspace page">`;
}

// Taking part sits beside the works: blind review in vermilion, uploading in ink. Library and task page share it.
const AB = '<span class="task-act-ab">A<i>B</i></span>';
const act = (kind, href, glyph, title, note, hint = '') => (href
  ? `<a class="task-act is-${kind}" href="${href}"><span class="task-act-mark" aria-hidden="true">${glyph}</span><span><b>${title}</b><small>${note}</small></span></a>`
  : `<span class="task-act is-off" aria-disabled="true"${hint ? ` title="${hint}"` : ''}><span class="task-act-mark" aria-hidden="true">${glyph}</span><span><b>${title}</b><small>${note}</small></span></span>`);

// Filter selects share the task page's toolbar: the option text carries the label and count.
const selectControl = (name, aria, options) => `<label class="result-sort">${aria}<select data-${name} aria-label="${aria}">${options}</select></label>`;
const option = (value, text, selected, suffix = null) => `<option${suffix === null ? '' : ` data-i18n-ignore data-i18n-option-original="${esc(text)}" data-i18n-option-suffix="${esc(suffix)}"`} value="${esc(value)}"${selected ? ' selected' : ''}>${esc(text)}${suffix === null ? '' : esc(suffix)}</option>`;
// A card names its form, then its domains.
const backendLanguages = (t) => {
  if (Array.isArray(t?.languages) && t.languages.length) return t.languages;
  return backendTierMeta(t?.benchmark?.tier)?.languages ?? [];
};
const tagLine = (t) => `${t.category ? `<li class="tag-kind">${esc(categoryLabel(t.category))}</li>` : ''}${benchmarkTask(t) ? backendLanguages(t).map((lang) => `<li class="tag-lang" data-i18n-ignore>${esc(lang)}</li>`).join('') : ''}${subcategoryOf(t) ? `<li class="tag-sub">${esc(subcategoryOf(t))}</li>` : ''}${domainsOf(t).map((d) => `<li class="tag-domain">${esc(d)}</li>`).join('')}`;
function rankedTasks(tasks = DATA.tasks, now = Date.now()) {
  if (homeState.sort === 'recommended') return recommendQuestions(tasks, { now, batch: homeState.recommendationBatch, modelKey: r => registeredOf(r) ?? modelKey(r) });
  if (homeState.sort === 'popularity') return popularQuestions(tasks, { now, modelKey: r => registeredOf(r) ?? modelKey(r) });
  if (homeState.sort === 'random') {
    for (const task of DATA.tasks) if (!questionRandomOrder.has(task.id)) questionRandomOrder.set(task.id, Math.random());
    return [...tasks].sort((a, b) => questionRandomOrder.get(a.id) - questionRandomOrder.get(b.id) || byName(a.id, b.id)).map(task => ({ task, reason: null }));
  }
  const order = new Map(DATA.tasks.map((t, i) => [t.id, i]));
  return [...tasks].sort((a, b) => {
    if (homeState.sort === 'works') return counted(b).length - counted(a).length || order.get(b.id) - order.get(a.id);
    if (homeState.sort === 'title') return byName(a.title, b.title);
    return (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0) || order.get(b.id) - order.get(a.id);
  }).map(task => ({ task, reason: null }));
}

const ALL_SUBCATEGORIES = '全部';
// Form and domain ride in the address (#/questions/<category>/<subcategory>/<domain>, each may be left out),
// as does the model index (#/questions/models), so a return or a shared link keeps them. Search
// and the selects only survive a return; a fresh visit opens the whole library.
function renderLibrary(scopes = [], fresh = true) {
  if (fresh) Object.assign(homeState, { solveStatus: '', model: '', unanswered: false, query: '', modelQuery: '', vendor: '' });
  if (!SOLVE_STATUS_MAP.has(homeState.solveStatus)) homeState.solveStatus = '';
  homeState.view = scopes[0] === 'models' ? 'models' : 'tasks';
  const restScopes = homeState.view === 'tasks' ? [...scopes] : [];
  const categories = libraryCategories();
  const catIdx = restScopes.findIndex((x) => categories.includes(x) || DATA.tasks.some((t) => t.category === x));
  homeState.category = catIdx >= 0 ? restScopes.splice(catIdx, 1)[0] : '';
  const allowedSubs = subcategoriesOf(homeState.category).filter((s) => !s.disabled);
  // 全部 holds the subcategory place before a domain that shares a subcategory's name (推理 / 数学).
  const allSubs = Boolean(homeState.category) && restScopes[0] === ALL_SUBCATEGORIES;
  if (allSubs) restScopes.shift();
  const subIdx = homeState.category && !allSubs ? restScopes.findIndex((x) => allowedSubs.some((s) => s.name === x)) : -1;
  homeState.subcategory = subIdx >= 0 ? restScopes.splice(subIdx, 1)[0] : '';
  homeState.treeOpen = Boolean(homeState.category);
  homeState.domain = restScopes.find((x) => DATA.tasks.some((t) => domainsOf(t).includes(x))) ?? '';
  const controller = new AbortController();
  const recommendationTime = Date.now();
  let previews = null, destroyed = false, activePreviewKey = null;
  let search = createQuestionSearch();
  const choicesById = new Map(DATA.tasks.map(task => {
    const featured = platform.featured?.[task.id]?.cover ?? null;
    return [task.id, { task, featured, result: taskCover(task, featured) }];
  }));
  const artworkFor = (t, shown, eager = false) => shown?.previewMode === 'screenshot'
    ? img(previewScreenshotOf(t, shown), shown.title, 'question-screenshot-preview', eager)
    : shown?.previewModel || shown?.previewLoader
      ? (shown.previewPoster ? img(shown.previewPoster, '', 'question-model-poster', eager) : coverHtml(shown, '', eager, t))
      : shown ? coverHtml(shown, '', eager, t) : `<span class="question-placeholder">${icon('text')}<span>${counted(t).length ? '暂无预览图' : '等待第一份答案'}</span></span>`;
  const results = DATA.tasks.flatMap((t) => counted(t).map((r) => ({ t, r })));
  // Build the answer lookup once per catalog, including aliases and unverified answers exactly
  // as the question filter did. A selected model then needs one Set lookup per question.
  const answersByModel = new Map();
  for (const { t, r } of results) {
    const id = registeredOf(r);
    if (!id) continue;
    if (!answersByModel.has(id)) answersByModel.set(id, new Set());
    answersByModel.get(id).add(t.id);
  }
  for (const t of DATA.tasks) {
    if (!benchmarkTask(t) || !Array.isArray(t.benchmark?.rows)) continue;
    for (const row of t.benchmark.rows) {
      const id = registeredOf({ model: row?.model, modelName: row?.name ?? row?.modelName, vendor: row?.vendor });
      if (!id) continue;
      if (!answersByModel.has(id)) answersByModel.set(id, new Set());
      answersByModel.get(id).add(t.id);
    }
  }
  const answeredBy = (task, id) => answersByModel.get(id)?.has(task.id) ?? false;

  const zoomFor = (task, result) => previewZoomKind(task, result &&
    ((result.previewMode !== 'screenshot' && (result.previewModel || result.previewLoader) && result.previewPoster) || previewScreenshotOf(task, result)));
  const backendCardVisual = (t) => {
    const b = t.benchmark ?? {};
    const meta = backendTierMeta(b.tier);
    const tierCode = b.tier ?? meta?.tier ?? 'BENCH';
    const langs = backendLanguages(t);
    const weight = b.weight ?? meta?.weight ?? 1;
    const status = b.statusLabel ?? b.status ?? meta?.status ?? '';
    const top3 = (Array.isArray(b.rows) ? b.rows : []).slice(0, 3);
    return `<div class="backend-card-visual">
      <div class="backend-card-head">
        <span class="backend-tier-code" data-i18n-ignore>${esc(tierCode)}</span>
        <span class="backend-card-langs">${langs.map((lang) => `<span class="tag-lang" data-i18n-ignore>${esc(lang)}</span>`).join('')}</span>
        <span class="backend-card-weight">1:2:1:2 · ×${esc(weight)}</span>
      </div>
      ${status ? `<p class="backend-card-status">${esc(status)}</p>` : ''}
      ${top3.length ? `<ol class="backend-card-top3">${top3.map((row, idx) => `<li><span class="backend-card-rank">${esc(pad(row?.rank ?? idx + 1))}</span><span class="backend-card-model" data-i18n-ignore>${esc(row?.name ?? row?.modelName ?? '')}${row?.effort ? ` <small>${esc(row.effort)}</small>` : ''}</span><span class="backend-card-score">${row?.score != null ? Number(row.score).toFixed(2) : '—'}</span></li>`).join('')}</ol>` : '<p class="backend-card-empty">闭卷排名数据</p>'}
    </div>`;
  };
  const taskCard = (t) => {
    if (benchmarkTask(t)) {
      const b = t.benchmark ?? {};
      const meta = backendTierMeta(b.tier);
      const weight = b.weight ?? meta?.weight ?? 1;
      const rowCount = Array.isArray(b.rows) ? b.rows.length : 0;
      return `<article class="task-card is-backend" data-task-card="${esc(t.id)}">
      <a class="question-visual backend-thumb" href="${taskHref(t)}" aria-label="查看「${esc(t.title)}」的排名数据" tabindex="-1">
        ${backendCardVisual(t)}
      </a>
      ${taskSolveCornerHtml(t)}
      <div class="task-body">
        <div class="question-byline"><ul class="tag-line"><li class="tag-recommendation" data-question-reason hidden></li>${tagLine(t)}</ul>
          <span class="avatar question-avatar${bySite(t) ? ' is-site' : ''}" role="img" aria-label="发布者：${esc(authorName(t))}" title="发布者：${esc(authorName(t))}">${authorAvatar(t)}</span>
        </div>
        <h3><a href="${taskHref(t)}"><span data-i18n-ignore>${esc(t.title)}</span></a></h3>
        <p class="summary"><span data-i18n-ignore>${esc(t.summary)}</span></p>
        <p data-i18n-ignore class="prompt-hit" data-prompt-hit hidden></p>
        <div class="question-meta">
          <span class="question-date">闭卷基准 · 权重 ×${esc(weight)}</span>
          <a href="${taskHref(t)}">${rowCount} 条实测${icon('next')}</a>
        </div>
      </div>
    </article>`;
    }
    const works = counted(t);
    const shown = choicesById.get(t.id).result;
    const zoom = zoomFor(t, shown);
    const artwork = artworkFor(t, shown);
    return `<article class="task-card" data-task-card="${esc(t.id)}">
      <a class="question-visual${shown?.previewMode === 'screenshot' ? ' screenshot-thumb' : shown?.previewModel || shown?.previewLoader ? ' model-thumb' : ''}" href="${taskHref(t)}" aria-label="查看「${esc(t.title)}」的全部作品" tabindex="-1"${shown ? ` data-preview-id="${esc(shown.id)}"` : ''}${zoom ? ` data-preview-zoom="${zoom}"` : ''}>
        ${artwork}
      </a>
      ${taskSolveCornerHtml(t)}
      <div class="task-body">
        <div class="question-byline"><ul class="tag-line"><li class="tag-recommendation" data-question-reason hidden></li>${tagLine(t)}</ul>
          <span class="avatar question-avatar${bySite(t) ? ' is-site' : ''}" role="img" aria-label="发布者：${esc(authorName(t))}" title="发布者：${esc(authorName(t))}">${authorAvatar(t)}</span>
        </div>
        <h3><a href="${taskHref(t)}">${taskCuratedStarHtml(t)}<span data-i18n-ignore>${esc(t.title)}</span></a></h3>
        <p class="summary"><span data-i18n-ignore>${esc(t.summary)}</span></p>
        <p data-i18n-ignore class="prompt-hit" data-prompt-hit hidden></p>
        <div class="question-meta">
          <span class="question-date" data-i18n-date="${esc(t.date ?? '')}">${formatDate(t.date)}</span>
          ${t.references?.length ? `<span class="question-refs" title="附 ${t.references.length} 张参考图，作答需要识图">${icon('image')}参考图 ${t.references.length}</span>` : ''}
          <a href="${taskHref(t)}">${modelCount(works)} 个模型 · ${works.length} 件作品${icon('next')}</a>
        </div>
      </div>
    </article>`;
  };
  const taskCards = rankedTasks(DATA.tasks, recommendationTime).map(({ task: t }) => taskCard(t)).join('');
  // Publishing sits in the grid itself, as the first card, so it reads as part of the library.
  const newCard = platform.available ? `<a class="task-card task-new" href="#/new" data-task-new>
      <span class="question-visual task-new-visual" aria-hidden="true"><span class="task-new-stack"><i></i><i></i><i></i></span><span class="task-new-plus">${icon('plus')}</span></span>
      <span class="task-body">
        <span class="task-new-kicker">发起题目</span>
        <h3>下一道题，由你来出</h3>
        <p class="summary">写下一份提示词，邀请各家模型作答，收录后在这里并排对照。</p>
        <span class="question-meta"><span>一份提示词 · 许多答案</span><span class="task-new-go">开始发起${icon('next')}</span></span>
      </span>
    </a>` : '';

  const modelsByVendor = new Map();
  const exhibited = exhibitedModels();
  for (const model of exhibited) {
    const vendor = model.vendor || '其他';
    if (!modelsByVendor.has(vendor)) modelsByVendor.set(vendor, []);
    modelsByVendor.get(vendor).push(model);
  }
  // The index lists verified works.
  const catalogued = results.filter(({ r }) => r.status === 'verified');
  const modelQuestions = new Map();
  for (const { t, r } of catalogued) {
    const id = registeredOf(r);
    if (!id) continue;
    if (!modelQuestions.has(id)) modelQuestions.set(id, new Map());
    const questions = modelQuestions.get(id);
    if (!questions.has(t.id)) questions.set(t.id, { task: t, works: [] });
    questions.get(t.id).works.push(r);
  }
  const vendors = [...modelsByVendor.keys()].sort(byName);
  if (!vendors.includes(homeState.vendor)) homeState.vendor = '';
  // Only models with an answer can narrow the question list.
  const answering = vendors.map((vendor) => [vendor, modelsByVendor.get(vendor).filter((m) => answersByModel.has(m.id))]).filter(([, models]) => models.length);
  if (!answering.some(([, models]) => models.some((m) => m.id === homeState.model))) { homeState.model = ''; homeState.unanswered = false; }
  const solveStatusOptions = () => {
    const counts = new Map(SOLVE_STATUSES.map((s) => [s.key, 0]));
    for (const t of DATA.tasks) counts.set(solveStatusOf(t), (counts.get(solveStatusOf(t)) ?? 0) + 1);
    return option('', '全部解决状态', !homeState.solveStatus)
      + SOLVE_STATUSES.map((s) => option(s.key, `${s.label}（${counts.get(s.key) ?? 0} 题）`, s.key === homeState.solveStatus)).join('');
  };
  // Search leads every list's toolbar; the heading keeps the page's own actions or a quiet note.
  const taskToolbar = `<div class="collection-toolbar">${searchControl('home', '搜索题目或提示词', homeState.query)}<div class="toolbar-actions">
    ${selectControl('home-solve', '按解决状态筛选', solveStatusOptions())}
    ${selectControl('home-model', '按作答模型筛选', option('', '全部作答模型', !homeState.model) + answering.map(([vendor, models]) => `<optgroup label="${esc(vendor)}">${models.map((m) => option(m.id, m.name, m.id === homeState.model, `（${answersByModel.get(m.id).size} 题）`)).join('')}</optgroup>`).join(''))}
    <button class="btn sm ghost model-answer-filter" type="button" data-home-unanswered aria-pressed="${homeState.unanswered}"${homeState.model ? '' : ' hidden'}>尚未回答</button>
    ${selectControl('home-sort', '题目排序', Object.entries(questionSorts).map(([value, text]) => option(value, text, value === homeState.sort)).join(''))}
  </div></div>`;
  const modelToolbar = `<div class="collection-toolbar">${searchControl('model', '搜索模型或厂商', homeState.modelQuery)}<div class="toolbar-actions">
    ${selectControl('model-vendor', '按厂商筛选', option('', `全部厂商（${vendors.length}）`, !homeState.vendor) + vendors.map((v) => option(v, `${v}（${modelsByVendor.get(v).length}）`, v === homeState.vendor)).join(''))}
  </div></div>`;
  const modelContent = (id) => {
    const m = MODELS.get(id);
    const questions = [...(modelQuestions.get(id)?.values() ?? [])].sort((a, b) => byName(a.task.title, b.task.title));
    return `${questions.map(({ task: t, works: answers }) => `<section class="dir-question" data-dir-question="${esc(t.id)}">
            <header class="dir-question-head"><a class="dir-question-title" href="${taskHref(t)}"><span class="dir-question-label">题目</span><span data-i18n-ignore>${esc(t.title)}</span></a><span class="dir-question-count">${answers.length} 件作品</span></header>
            <ul class="dir-works">${answers.map((r) => `<li><a href="${viewHref(t, r.id)}"><span class="dir-work-title" data-i18n-ignore>${esc(r.title)}</span><span class="dir-work-badges">${resultBadges(r)}</span>${icon('next')}</a></li>`).join('')}</ul>
          </section>`).join('')}${m.brandUrl ? `<a class="dir-brand-source" href="${esc(m.brandUrl)}" target="_blank" rel="noopener">模型官网${icon('arrow')}</a>` : ''}`;
  };
  const modelRows = () => vendors.map((vendor) => [vendor, modelsByVendor.get(vendor)]).map(([vendor, models]) => {
    const works = models.reduce((sum, model) => sum + [...(modelQuestions.get(model.id)?.values() ?? [])].reduce((count, question) => count + question.works.length, 0), 0);
    const items = models.map((m) => {
      const questions = modelQuestions.get(m.id);
      const workCount = [...(questions?.values() ?? [])].reduce((sum, question) => sum + question.works.length, 0);
      return `<li class="dir-model" data-dir-model="${esc([m.name, ...(m.aliases ?? []), m.vendorNote ?? '', vendor].join(' '))}" data-dir-model-id="${esc(m.id)}" data-dir-work-count="${workCount}">
        <details class="dir-model-detail">
          <summary class="dir-model-summary">${brandMark(m)}
            <span class="dir-model-body"><b class="dir-model-name" data-i18n-ignore>${esc(m.name)}</b>${m.vendorNote ? `<span class="dir-model-note">${esc(m.vendorNote)}</span>` : ''}<span class="dir-model-meta">${questions?.size ?? 0} 道题目 · ${workCount} 件作品</span></span>
            <span class="dir-model-toggle"><span class="dir-when-closed">查看作品</span><span class="dir-when-open">收起</span>${icon('next')}</span>
          </summary>
          <div class="dir-model-content"></div>
        </details>
      </li>`;
    }).join('');
    return `<section class="dir-row" data-dir-vendor="${esc(vendor)}">
      <header class="dir-vendor"><h3>${esc(vendor)}</h3><p data-dir-vendor-count>${models.length} 个模型 · ${works} 件作品</p></header>
      <ul class="dir-models">${items}</ul>
    </section>`;
  }).join('');
  let modelsMounted = false;

  root.innerHTML = `${libraryStart([{ text: '题库' }])}
      <section data-home-panel="tasks">
        <div class="collection-heading"><div class="collection-title"><h2 id="h-tasks">全部题目</h2><span data-home-count title="解答数不计存疑作品">${DATA.tasks.length} 道题目</span></div>${platform.available ? '<div class="task-acts" data-home-blind></div>' : ''}</div>
        ${taskToolbar}
        <div class="question-recommendation" data-question-recommendation><p>热门、新题与待探索题目穿插展示</p><button class="btn sm ghost" type="button" data-recommend-refresh>换一批</button></div>
        <div class="task-list">${newCard}${taskCards || (newCard ? '' : '<p class="muted">还没有题目。</p>')}</div>
        <div class="board-empty" data-home-empty hidden><h3>没有找到这道题</h3><p>${platform.available ? '换个关键词或筛选条件，或者把它发起成一道新题。' : '换个关键词或筛选条件，或浏览全部题目。'}</p><div class="board-empty-actions"><button class="btn" data-home-reset>清除筛选</button>${platform.available ? `<a class="btn primary" href="#/new">${icon('plus')}发起题目</a>` : ''}</div></div>
      </section>
      <section data-home-panel="models" hidden><div class="collection-heading"><div class="collection-title"><h2 id="h-models">模型索引</h2><span data-model-count>${modelsByVendor.size} 家厂商 · ${exhibited.length} 个模型</span></div><span class="collection-caption">展开模型，按题目查看作品</span></div>
        ${modelToolbar}<div class="dir-rows"></div>
        <div class="board-empty" data-model-empty hidden><h3>没有找到这个模型</h3><p>换个关键词，或查看全部厂商。</p><div class="board-empty-actions"><button class="btn" data-model-reset>清除筛选</button></div></div></section>
      ${footer()}
    </main></div>`;
  // While searching, questions matched by their own words come first and those matched only inside
  // a prompt follow, each showing the stretch of prompt that matched; the chosen sort holds within each.
  const list = $('.task-list', root), cards = $$('[data-task-card]', list);
  const rows = new Map(cards.map(card => {
    const choice = choicesById.get(card.dataset.taskCard);
    return [choice.task.id, { task: choice.task, choice, card, hit: $('[data-prompt-hit]', card), reason: $('[data-question-reason]', card), reasonText: '' }];
  }));
  let matching = [], blindScope = [], blindMarkup;
  // Random pairs come from the questions in view, as far as they can be judged.
  const updateBlindAction = () => {
    blindScope = matching.filter(task => votedTask(task) && (platform.arena[task.id]?.entries ?? 0) >= 2);
    const blind = $('[data-home-blind]', root);
    if (blind) {
      const html = !platform.activityReady
        ? act('judge', '', AB, '参与盲评', platform.activityError ? '统计暂未载入 <button class="link" type="button" data-platform-reconnect>重新连接</button>' : '统计加载中…') : blindScope.length
        ? act('judge', `#/arena/random`, AB, '参与盲评', `可盲评 ${blindScope.reduce((sum, t) => sum + platform.arena[t.id].works, 0)} 件`)
        : act('judge', '', AB, '参与盲评', '暂无可评的题', '当前范围内没有两个模型配置以上的盲评池');
      if (blindMarkup !== html) { blind.innerHTML = html; blindMarkup = html; }
    }
  };
  const filterTasks = () => {
    const matchTask = search(homeState.query);
    const promptOnly = new Set();
    matching = [];
    for (const row of rows.values()) {
      const { task, card, hit } = row;
      const excluded = (homeState.category && task.category !== homeState.category) || (homeState.subcategory && subcategoryOf(task) !== homeState.subcategory) || (homeState.domain && !domainsOf(task).includes(homeState.domain)) || (homeState.solveStatus && solveStatusOf(task) !== homeState.solveStatus) || (homeState.model && (homeState.unanswered ? answeredBy(task, homeState.model) : !answeredBy(task, homeState.model)));
      const match = excluded ? null : matchTask(task);
      card.toggleAttribute('hidden', !match);
      const snippet = match?.snippet;
      hit.toggleAttribute('hidden', !snippet);
      if (snippet) {
        const { before, hit: word, after } = snippet;
        const html = `<span>提示词</span>${esc(before)}<mark>${esc(word)}</mark>${esc(after)}`;
        if (row.snippet !== html) { hit.innerHTML = html; row.snippet = html; }
        promptOnly.add(task.id);
      }
      if (match) matching.push(task);
    }
    updateBlindAction();
    const count = matching.length;
    // Mix within the filtered result set and keep direct search hits before prompt-only hits.
    const ranked = [...rankedTasks(matching.filter(t => !promptOnly.has(t.id)), recommendationTime),
      ...rankedTasks(matching.filter(t => promptOnly.has(t.id)), recommendationTime)]
      .sort((a, b) => Number(isCuratedTask(b.task)) - Number(isCuratedTask(a.task)));
    const reasons = new Map(ranked.map(({ task, reason }) => [task.id, reason]));
    const visible = $$('[data-task-card]:not([hidden])', list);
    if (ranked.some(({ task }, i) => visible[i].dataset.taskCard !== task.id)) {
      list.append(...ranked.map(({ task }) => rows.get(task.id).card));
    }
    for (const row of rows.values()) {
      const text = recommendationLabels[reasons.get(row.task.id)] ?? '';
      if (row.reasonText === text) continue;
      row.reason.toggleAttribute('hidden', !text);
      row.reason.textContent = text;
      row.reasonText = text;
    }
    $('[data-question-recommendation]').hidden = homeState.sort !== 'recommended' || count === 0;
    $('#h-tasks').innerHTML = [homeState.category ? `<span>${esc(categoryLabel(homeState.category))}</span>` : '', homeState.subcategory ? `<span>${esc(homeState.subcategory)}</span>` : '', homeState.domain ? `<span>${esc(homeState.domain)}</span>` : '', homeState.solveStatus ? `<span>${esc(solveStatusMeta(homeState.solveStatus).label)}</span>` : '', homeState.model ? `<span data-i18n-ignore>${esc(MODELS.get(homeState.model)?.name)}</span>` : '', homeState.model && homeState.unanswered ? '<span>尚未回答</span>' : ''].filter(Boolean).join(' · ') || '全部题目';
    $('[data-home-count]').textContent = `${count} 道题目`;
    const emptyBox = $('[data-home-empty]');
    emptyBox.hidden = count > 0;
    if (!count) {
      const emptyMusic = homeState.category === '音乐' && !homeState.subcategory && !homeState.query.trim() && !homeState.domain && !homeState.solveStatus && !homeState.model;
      const emptySub = Boolean(homeState.subcategory && !homeState.query.trim() && !homeState.domain && !homeState.solveStatus && !homeState.model);
      $('h3', emptyBox).textContent = emptyMusic ? '音乐分区还没有题目' : emptySub ? '该细分分类还没有题目' : '没有找到这道题';
      $('p', emptyBox).textContent = emptyMusic
        ? '为测试LLM制作音乐的能力，不要将生成模型的音乐纳入。欢迎发起第一道音乐题目。'
        : (platform.available ? '换个关键词或筛选条件，或者把它发起成一道新题。' : '换个关键词或筛选条件，或浏览全部题目。');
    }
    $('[data-task-new]')?.toggleAttribute('hidden', count === 0);
    $('[data-home-solve]').value = homeState.solveStatus;
    $('[data-home-model]').value = homeState.model;
    const unanswered = $('[data-home-unanswered]', root);
    unanswered.hidden = !homeState.model;
    unanswered.setAttribute('aria-pressed', String(homeState.unanswered));
    const leadImage = $('.task-card:not([hidden]) .question-visual img', root);
    if (leadImage) leadImage.fetchPriority = 'high';
  };
  const filterModels = () => {
    if (!modelsMounted) {
      $('.dir-rows', root).innerHTML = modelRows();
      modelsMounted = true;
      settleImages();
    }
    // Model index: the keyword matches a model or its vendor; the vendor select keeps one row.
    const needle = homeState.modelQuery;
    let models = 0, vendorsShown = 0;
    for (const row of $$('[data-dir-vendor]', root)) {
      const vendorMatch = textMatches(needle, row.dataset.dirVendor);
      let shown = 0, worksShown = 0;
      for (const item of $$('[data-dir-model]', row)) {
        item.hidden = !vendorMatch && !textMatches(needle, item.dataset.dirModel);
        if (!item.hidden) { shown++; worksShown += Number(item.dataset.dirWorkCount); }
      }
      $('[data-dir-vendor-count]', row).textContent = `${shown} 个模型 · ${worksShown} 件作品`;
      row.hidden = !shown || Boolean(homeState.vendor && row.dataset.dirVendor !== homeState.vendor);
      if (!row.hidden) { models += shown; vendorsShown++; }
    }
    $('#h-models').toggleAttribute('data-i18n-ignore', Boolean(homeState.vendor));
    $('#h-models').textContent = homeState.vendor || '模型索引';
    $('[data-model-count]').textContent = `${vendorsShown} 家厂商 · ${models} 个模型`;
    $('[data-model-empty]').hidden = models > 0;
    $('[data-model-vendor]').value = homeState.vendor;
  };
  const filter = () => {
    if (homeState.view === 'tasks') filterTasks();
    else filterModels();
    $$('[data-home-panel]').forEach((el) => { el.hidden = el.dataset.homePanel !== homeState.view; });
    $$('.side-nav [data-home-view]').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.homeView === homeState.view && !(el.dataset.homeView === 'tasks' && (homeState.category || homeState.subcategory || homeState.domain)))));
    $$('[data-tree-group]').forEach((group) => {
      if (!group.querySelector('.side-tree-children-wrap')) return;
      const open = homeState.view === 'tasks' && homeState.treeOpen && group.dataset.treeGroup === homeState.category;
      group.dataset.expanded = String(open);
      group.querySelector('[data-home-category]')?.setAttribute('aria-expanded', String(open));
    });
    $$('[data-home-category]').forEach((el) => {
      const isCat = homeState.view === 'tasks' && el.dataset.homeCategory === homeState.category;
      el.setAttribute('aria-pressed', String(isCat && !homeState.subcategory));
      el.dataset.parentActive = String(isCat);
    });
    $$('[data-home-subcategory]').forEach((el) => el.setAttribute('aria-pressed', String(homeState.view === 'tasks' && el.dataset.parentCategory === homeState.category && el.dataset.homeSubcategory === homeState.subcategory)));
    const mobileSubs = $('[data-mobile-subcats]', root);
    if (mobileSubs) {
      const activeTrack = homeState.view === 'tasks' && homeState.treeOpen && homeState.category
        ? tracksOf(DATA.tasks, { alwaysInclude: libraryCategories() }).find((x) => x.name === homeState.category)
        : null;
      const subs = activeTrack?.subcategories ?? [];
      mobileSubs.hidden = !subs.length;
      mobileSubs.innerHTML = subs.length ? subs.map((sub) => sub.disabled
        ? `<span class="chip is-disabled" aria-disabled="true">${esc(sub.label)}</span>`
        : `<button type="button" class="chip" data-home-subcategory="${esc(sub.name)}" data-parent-category="${esc(activeTrack.name)}" aria-pressed="${sub.name === homeState.subcategory}">${esc(sub.label)}<span class="nav-count">${sub.count}</span></button>`).join('') : '';
    }
    $$('[data-home-domain]').forEach((el) => el.setAttribute('aria-pressed', String(homeState.view === 'tasks' && el.dataset.homeDomain === homeState.domain)));
    const scopes = homeState.view === 'tasks' ? [homeState.category, homeState.subcategory, homeState.domain].filter(Boolean) : [];
    const scopeCrumbs = homeState.view === 'models' ? [{ text: '模型索引' }] : scopes.map((x) => ({ text: categoryOf(x) ? categoryLabel(x) : x }));
    $('.topbar .crumbs').innerHTML = breadcrumbTrail(scopeCrumbs.length ? [LIBRARY, ...scopeCrumbs] : [{ text: '题库' }]);
    const sharedName = !homeState.subcategory && homeState.domain && subcategoriesOf(homeState.category).some((s) => s.name === homeState.domain);
    const written = sharedName ? [homeState.category, ALL_SUBCATEGORIES, homeState.domain] : scopes;
    const address = [LIBRARY.href, ...(homeState.view === 'models' ? ['models'] : written.map(encodeURIComponent))].join('/');
    if (location.hash !== address) history.replaceState(history.state, '', address);
    previews?.setPaused(homeState.view !== 'tasks');
  };
  // Cards that stay move to their new places and new matches fade in (motion.js).
  const reflow = () => flip(root, filter, '.task-card, .dir-row');
  root.oninput = (event) => {
    if (event.target.matches('[data-home-search]')) homeState.query = event.target.value;
    else if (event.target.matches('[data-model-search]')) homeState.modelQuery = event.target.value;
    else return;
    filter();
  };
  root.onchange = (event) => {
    const el = event.target;
    if (el.matches('[data-home-solve]')) homeState.solveStatus = SOLVE_STATUS_MAP.has(el.value) ? el.value : '';
    else if (el.matches('[data-home-model]')) { homeState.model = el.value; if (!homeState.model) homeState.unanswered = false; }
    else if (el.matches('[data-model-vendor]')) homeState.vendor = el.value;
    else if (el.matches('[data-home-sort]')) {
      homeState.sort = el.value;
      store.set('question-sort', el.value);
    } else return;
    reflow();
  };
  root.onclick = (event) => {
    if (event.target.closest('[data-home-blind] a')) arenaScope.set(blindScope.map((t) => t.id));
    // Form and domain combine; pressing the current domain again lifts it.
    const category = event.target.closest('[data-home-category]'), subBtn = event.target.closest('[data-home-subcategory]'), domain = event.target.closest('[data-home-domain]'), view = event.target.closest('[data-home-view]');
    if (subBtn) {
      homeState.view = 'tasks';
      homeState.category = subBtn.dataset.parentCategory;
      homeState.treeOpen = true;
      homeState.subcategory = homeState.subcategory === subBtn.dataset.homeSubcategory ? '' : subBtn.dataset.homeSubcategory;
    }
    if (category) {
      const nextCat = category.dataset.homeCategory;
      if (homeState.view === 'tasks' && homeState.category === nextCat) {
        if (homeState.subcategory) {
          homeState.subcategory = '';
          homeState.treeOpen = true;
        } else {
          homeState.treeOpen = !homeState.treeOpen;
        }
      } else {
        homeState.view = 'tasks';
        homeState.category = nextCat;
        homeState.subcategory = '';
        homeState.treeOpen = true;
      }
    }
    if (domain) { homeState.domain = homeState.view === 'tasks' && homeState.domain === domain.dataset.homeDomain ? '' : domain.dataset.homeDomain; homeState.view = 'tasks'; }
    if (view) { homeState.view = view.dataset.homeView; homeState.category = ''; homeState.subcategory = ''; homeState.treeOpen = false; homeState.domain = ''; }
    if (event.target.closest('[data-home-reset]')) { homeState.category = ''; homeState.subcategory = ''; homeState.treeOpen = false; homeState.domain = ''; homeState.solveStatus = ''; homeState.model = ''; homeState.unanswered = false; homeState.query = ''; $('[data-home-search]').value = ''; }
    if (event.target.closest('[data-model-reset]')) { homeState.vendor = ''; homeState.modelQuery = ''; $('[data-model-search]').value = ''; }
    if (event.target.closest('[data-recommend-refresh]')) homeState.recommendationBatch++;
    if (event.target.closest('[data-home-unanswered]')) homeState.unanswered = !homeState.unanswered;
    if (category || subBtn || domain || view || event.target.closest('[data-home-reset], [data-model-reset], [data-recommend-refresh], [data-home-unanswered]')) reflow();
  };
  root.addEventListener('toggle', (event) => {
    const detail = event.target;
    if (!detail.matches('.dir-model-detail') || !detail.open) return;
    const content = $('.dir-model-content', detail);
    if (content.dataset.mounted) return;
    content.innerHTML = modelContent(detail.closest('[data-dir-model-id]').dataset.dirModelId);
    content.dataset.mounted = '1';
    settleImages();
  }, { capture: true, signal: controller.signal });
  filter();
  window.addEventListener('localechange', () => { search = createQuestionSearch(); filter(); }, { signal: controller.signal });
  window.addEventListener('curatedselectionchange', () => { if (homeState.view === 'tasks') reflow(); }, { signal: controller.signal });
  window.addEventListener('solvestatuschange', () => {
    const select = $('[data-home-solve]', root);
    if (select) {
      select.innerHTML = solveStatusOptions();
      select.value = homeState.solveStatus;
    }
    if (homeState.view === 'tasks') reflow();
  }, { signal: controller.signal });
  setPageTitle(['题库', DATA.title]);
  async function loadPreviews(choice) {
    const result = choice?.result;
    if (destroyed || !initialPlatformSettled || homeState.view !== 'tasks' || result?.previewMode === 'screenshot' || !(result?.previewModel || result?.previewLoader)) return;
    const key = `${choice.task.id}/${result.id}`;
    if (activePreviewKey === key && previews) return;
    previews?.destroy(); previews = null;
    activePreviewKey = key;
    try {
      const { createQuestionPreviews } = await import('./result-previews.js');
      if (destroyed || activePreviewKey !== key) return;
      previews = createQuestionPreviews(root, [choice]);
      previews.setPaused(homeState.view !== 'tasks');
      settleImages();
    } catch (error) {
      if (activePreviewKey === key) activePreviewKey = null;
      console.error('Question model previews unavailable:', error);
    }
  }
  root.onpointerover = (event) => {
    if (event.pointerType === 'touch' || homeState.view !== 'tasks') return;
    const visual = event.target.closest('.question-visual');
    const card = visual?.closest('[data-task-card]');
    if (!card || visual.contains(event.relatedTarget) || card.hidden) return;
    loadPreviews(choicesById.get(card.dataset.taskCard));
  };
  root.onfocusin = (event) => {
    const card = event.target.closest('[data-task-card]');
    if (card && !card.hidden && homeState.view === 'tasks') loadPreviews(choicesById.get(card.dataset.taskCard));
  };
  return {
    onPlatformChange(reason) {
      if (reason !== 'activity') { void route({ keepScroll: true }); return; }
      updateBlindAction();
      for (const { task, card, choice } of rows.values()) {
        const featured = platform.featured?.[task.id]?.cover ?? null;
        if (choice.featured === featured) continue;
        choice.featured = featured;
        const result = taskCover(task, featured);
        if (choice.result === result) continue;
        if (choice.result && activePreviewKey === `${task.id}/${choice.result.id}`) {
          previews?.destroy();
          previews = null;
          activePreviewKey = null;
        }
        choice.result = result;
        const artwork = $('.question-visual', card);
        const screenshot = result?.previewMode === 'screenshot';
        artwork.classList.toggle('screenshot-thumb', Boolean(screenshot));
        artwork.classList.toggle('model-thumb', Boolean(!screenshot && (result?.previewModel || result?.previewLoader)));
        if (result) artwork.dataset.previewId = result.id;
        else delete artwork.dataset.previewId;
        const zoom = zoomFor(task, result);
        if (zoom) artwork.dataset.previewZoom = zoom;
        else delete artwork.dataset.previewZoom;
        artwork.innerHTML = artworkFor(task, result);
      }
      const lead = $('.task-card:not([hidden]) .question-visual img', root);
      if (lead) lead.fetchPriority = 'high';
    },
    destroy() { destroyed = true; controller.abort(); previews?.destroy(); activePreviewKey = null; },
  };
}

// ---- task -----------------------------------------------------------------------------
const taskState = { task: null, cond: null, vendor: '', harness: '', provider: '', query: '', picks: [], promptVariant: null, promptOpener: null, variants: new Map(), open: new Set(), view: store.get('task-view') === 'family' ? 'family' : 'featured' };
const selectedVariant = (t) => variantsOf(t).find((variant) => variant.id === taskState.promptVariant);
const selectedPrompt = (t) => selectedVariant(t)?.prompt ?? t.prompt;
// Each model leads with one work (per review group); its other works follow, folded until opened.
const foldKey = (r) => `${r.status}|${modelKey(r)}`;
// The task's cover work heads the verified grid and is drawn large while nothing narrows the list.
// It needs a few other models around it to read as the lead, and it leads its own model's fold.
function coverLead(t) {
  const cover = taskCover(t, platform.featured?.[t.id]?.cover);
  if (cover?.status !== 'verified') return null;
  return new Set(t.results.filter((r) => r.status === 'verified').map(modelKey)).size >= 3 ? cover : null;
}
// A tagged cover keeps the lead when the reader switches its prompt version.
const isLead = (t, lead, r) => Boolean(lead) && (r.id === lead.id
  || (lead.promptVariant && r.promptVariant && variantKey(r) === variantKey(lead)
    && variantChoices(t, r).some((choice) => choice.result?.id === lead.id)));
function foldOrder(t, results, lead) {
  const leads = new Set();
  for (const status of new Set(results.map((r) => r.status))) {
    const featured = { ...platform.featured?.[t.id]?.models, ...(lead && status === 'verified' ? { [modelKey(lead)]: results.find((r) => isLead(t, lead, r))?.id } : {}) };
    const picks = representatives(results.filter((r) => r.status === status), modelKey, featured);
    picks.forEach((r) => leads.add(r));
  }
  const ordered = results.filter((r) => leads.has(r)).flatMap((first) => [first, ...results.filter((r) => r !== first && !leads.has(r) && foldKey(r) === foldKey(first))]);
  if (!lead) return ordered;
  const ahead = (r) => r.status === 'verified' && modelKey(r) === modelKey(lead);
  return [...ordered.filter(ahead), ...ordered.filter((r) => !ahead(r))];
}
const displayedResults = (t, lead = coverLead(t)) => boostOrder(foldOrder(t, groupVariantResults(t, sortedResults(t), taskState.variants), lead), { sort: resultSort, vendorOf });
function resultVariantButtons(t, r, pane = null) {
  const choices = variantChoices(t, r);
  if (!choices.length) return '';
  return `<div class="seg result-variants" role="group" aria-label="${esc(label(r))}的提示词版本">${choices.map((choice) => `<button ${pane === null ? 'data-result-variant' : `data-pane-variant="${pane}"`} data-variant-result="${esc(choice.result?.id ?? '')}" aria-pressed="${choice.id === r.promptVariant}"${choice.result ? '' : ' disabled title="这版结果尚未收录"'}><span data-i18n-ignore>${esc(choice.label)}</span></button>`).join('')}</div>`;
}
let resultPreviews = null;
let previewVersion = 0;
let activeResultPreviewId = null;
function previewTriggerId(t) {
  const results = new Map(t.results.map((result) => [result.id, result]));
  const visible = $$('.result[data-id]', root).filter((card) => !card.hidden && card.getClientRects().length);
  const available = (card) => {
    const result = results.get(card.dataset.id);
    return result && hasModelPreview(result) && (result.previewModel || hosted(result));
  };
  return (visible.find((card) => card.classList.contains('is-lead') && available(card)) ?? visible.find(available))?.dataset.id ?? null;
}
function prioritizeResultLead() {
  const cards = $$('.result[data-id]', root);
  const visible = cards.filter((card) => !card.hidden && card.getClientRects().length);
  const card = visible.find((item) => item.classList.contains('is-lead')) ?? visible[0];
  const images = $$('.result-media img', root);
  const leadImages = card ? $$('.result-media img', card) : [];
  const selected = previewMode === 'screenshot'
    ? card?.querySelector('img.result-screenshot-preview') ?? leadImages[0]
    : card?.querySelector('img.result-model-poster') ?? card?.querySelector('img.result-screenshot-preview') ?? leadImages[0];
  for (const image of images) {
    const eager = image === selected;
    image.fetchPriority = eager ? 'high' : 'auto';
  }
}
async function updateResultPreviews(t, preferredId = null) {
  if (!initialPlatformSettled || previewMode !== 'model') {
    ++previewVersion;
    resultPreviews?.destroy(); resultPreviews = null; activeResultPreviewId = null;
    return;
  }
  const results = displayedResults(t).filter((result) => hasModelPreview(result) && (result.previewModel || hosted(result)));
  const visibleIds = new Set($$('.result[data-id]', root).filter((card) => !card.hidden && card.getClientRects().length).map((card) => card.dataset.id));
  // Without an explicit card target, keep the poster and transfer no model file.
  const selected = preferredId
    ? results.find((result) => result.id === preferredId && visibleIds.has(result.id))
    : results.find((result) => result.id === activeResultPreviewId && visibleIds.has(result.id));
  if (preferredId && !selected) return;
  if (selected?.id === activeResultPreviewId && resultPreviews) return;
  const version = ++previewVersion;
  resultPreviews?.destroy(); resultPreviews = null;
  activeResultPreviewId = selected?.id ?? null;
  if (!selected) return;
  try {
    const { createResultPreviews } = await import('./result-previews.js');
    if (version !== previewVersion || previewMode !== 'model') return;
    resultPreviews = createResultPreviews(root, { ...t, results: [selected] });
    resultPreviews.setPaused($('#results').hidden);
  } catch (error) {
    if (version === previewVersion) activeResultPreviewId = null;
    console.error('Model previews unavailable:', error);
  }
}
// Panels are views of the one task page: they replace the address and add no level to the trail.
// The prompt lives in the sidebar now; an old #prompt address opens the works.
const panels = ['results', 'shots', 'board', 'cost'];
function activatePanel(name, updateHash = true) {
  const target = panels.includes(name) && $(`[data-panel="${name}"]`) ? name : 'results';
  const shown = $(`[data-panel="${target}"]`), switched = shown.hidden && $$('[data-panel]').some((el) => !el.hidden);
  $$('[data-panel]').forEach((el) => { el.hidden = el.dataset.panel !== target; });
  if (switched) settleIn(shown);
  $$('[data-go]').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.go === target)));
  resultPreviews?.setPaused(target !== 'results');
  if (target === 'board') mountTaskBoard();
  if (target === 'cost') mountTaskUsage();
  if (target === 'results') {
    const task = DATA.tasks.find((item) => item.id === taskState.task);
    if (task) void loadTaskScores(task);
  } else if (taskScoreRead) cancelTaskScores(false);
  deferredMedia.refresh(root);
  if (updateHash) {
    // The usage view has its own address (#/<task>/usage, or /cost once amounts show); the others ride after a second #.
    const base = `#${location.hash.split('#')[1].replace(/\/(?:usage|cost)$/, '')}`;
    history.replaceState(history.state, '', target === 'results' ? base : target === 'cost' ? `${base}/${usageView?.shown() ? 'cost' : 'usage'}` : `${base}#${target}`);
  }
}

// The task leaderboard doubles as the source of the "榜单评分" sort.
let taskBoard = null;
let usageView = null;
let taskScoreRead = null, taskScoreController = null, taskScoreRun = 0, scoredTask = null, taskScoreError = '';
function updateTaskScoreStatus() {
  const status = $('[data-score-state]');
  if (!status) return;
  status.hidden = resultSort !== 'score' || scoredTask === taskState.task;
  status.innerHTML = taskScoreError ? `${esc(taskScoreError)} <button class="link" type="button" data-task-score-retry>重试加载</button>` : '正在载入榜单…';
}
function cancelTaskScores(forget = true) {
  taskScoreRun++;
  taskScoreController?.abort();
  taskScoreController = null;
  taskScoreRead = null;
  if (forget) scoredTask = null;
  taskScoreError = '';
  updateTaskScoreStatus();
}
function loadTaskScores(t) {
  if (resultSort !== 'score' || !platform.available || aiJudged(t) || scoredTask === t.id) return;
  if (taskScoreRead) { updateTaskScoreStatus(); return taskScoreRead; }
  const run = ++taskScoreRun, controller = new AbortController();
  taskScoreController = controller;
  taskScoreError = '';
  updateTaskScoreStatus();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    if (run === taskScoreRun) { taskScoreError = '连接超时，请重试。'; updateTaskScoreStatus(); }
    controller.abort();
  }, 15000);
  taskScoreRead = (async () => {
    try {
      const board = await api(`leaderboard?task=${encodeURIComponent(t.id)}`, { signal: controller.signal });
      if (run !== taskScoreRun || taskState.task !== t.id || controller.signal.aborted) return;
      const current = DATA.tasks.find((task) => task.id === t.id);
      if (!current) return;
      taskScores = new Map(board.rows.map((row) => [row.key, row.score]));
      scoredTask = t.id;
      if (resultSort === 'score') applySort(current);
    } catch (error) {
      if (run === taskScoreRun) taskScoreError = timedOut ? '连接超时，请重试。' : error.message;
    }
    finally {
      clearTimeout(timer);
      if (run === taskScoreRun) { taskScoreRead = null; taskScoreController = null; updateTaskScoreStatus(); }
    }
  })();
  return taskScoreRead;
}
async function mountTaskBoard() {
  const body = $('#board-body');
  if (!body || body.dataset.mounted) return;
  body.dataset.mounted = '1';
  const t = DATA.tasks.find((task) => task.id === taskState.task);
  try {
    const { mountBoard } = await import('./leaderboard.js');
    if (!body.isConnected) return;
    taskBoard = mountBoard(body, { ...context(), task: t, embedded: true });
  } catch (error) {
    if (body.isConnected) void showLoadFailure(body, error, '榜单加载失败');
  }
}
// The usage view loads with the price table and the server's switch for amounts (task-usage.js).
async function mountTaskUsage() {
  const body = $('#usage-body');
  if (!body || body.dataset.mounted) return;
  body.dataset.mounted = '1';
  const t = DATA.tasks.find((task) => task.id === taskState.task);
  try {
    const { mountTaskUsage: mount } = await import('./task-usage.js');
    if (!body.isConnected) return;
    usageView = mount(body, { ...context(), task: t });
    await usageView.ready;
    if (!body.isConnected) return;
    // Amounts off: the view is 用量 and an old /cost address becomes /usage, as the leaderboard's /cost returns to its ranking.
    if (!usageView.shown()) {
      if (/\/cost$/.test(location.hash.split('#')[1])) history.replaceState(history.state, '', `#${location.hash.split('#')[1].replace(/\/cost$/, '/usage')}`);
      return;
    }
    // Amounts are on: the view is 花费 and its address says /cost.
    $('[data-go="cost"] [data-usage-label]')?.replaceChildren('花费');
    if (/\/usage$/.test(location.hash.split('#')[1])) history.replaceState(history.state, '', `#${location.hash.split('#')[1].replace(/\/usage$/, '/cost')}`);
  } catch (error) {
    if (body.isConnected) void showLoadFailure(body, error, '用量加载失败');
  }
}

function shotGrid(t) {
  const cond = t.conditions.find((c) => c.id === taskState.cond) ?? t.conditions[0];
  if (!cond) return '';
  const shots = t.results.filter((r) => r.captures[cond.id]);
  if (!shots.length) return '<p class="muted empty-note">该条件下暂无截图。</p>';
  return `<div class="shot-grid${cond.mobile ? ' phones' : ''}">${shots.map((r) => {
    const src = r.captures[cond.id];
    const zoom = cond.mobile ? '' : previewZoomKind(t, src);
    return `<figure class="shot">
      <button class="shot-img" data-shot="${esc(r.id)}"${zoom ? ` data-preview-zoom="${zoom}"` : ''} aria-label="放大查看 ${esc(label(r))} · ${esc(cond.label)}">${img(src, `${label(r)} · ${cond.label}`)}</button>
      <figcaption><b><span data-i18n-ignore>${esc(r.title)}</span></b><span><span data-i18n-ignore>${esc(label(r))}</span>${r.status !== 'verified' ? ` · ${STATUS[r.status].label}` : ''}</span><a href="${viewHref(t, r.id)}">在线预览</a></figcaption>
    </figure>`;
  }).join('')}</div>`;
}

// Staff see the task's blind pool and how many published works stay out of it.
function adminPoolLine(t, pool) {
  const out = t.results.filter((r) => r.status === 'verified' && r.arena && r.arena.state !== 'in_pool').length;
  return `<p>盲评池 ${pool?.works ?? 0} 件 · ${pool?.entries ?? 0} 个配置${out ? ` · <a href="#/review/noarena">${out} 件已公开但不在池中</a>` : ''}</p>`;
}

// The model is the card's title; the work's own name follows in grey. Summaries stay in the guide.
function resultCard(t, r, coverWork) {
  const m = modelOf(r);
  const screenshotPreview = !hasModelPreview(r);
  const screenshot = previewScreenshotOf(t, r);
  const lead = isLead(t, coverWork, r);
  const zoom = screenshotPreview ? previewZoomKind(t, screenshot) : '';
  return `<article class="result${screenshotPreview ? ' is-screenshot-preview' : ''}${lead ? ' is-lead' : ''}" data-vendor="${esc(vendorOf(r))}" data-model="${esc(modelKey(r))}" data-id="${esc(r.id)}" data-status="${r.status}">
    <div class="result-media"${zoom ? ` data-preview-zoom="${zoom}"` : ''}>
      <a href="${viewHref(t, r.id)}" aria-label="在线预览：${esc(r.title)}，${esc(label(r))}">${screenshotPreview && screenshot ? img(screenshot, r.title, 'result-screenshot-preview') : coverHtml(r, 'result-screenshot-preview', false, t)}${!screenshotPreview && r.previewPoster ? img(r.previewPoster, '', 'result-model-poster') : ''}<span class="play">${icon('arrow')}在线预览</span></a>
      ${lead ? '<span class="lead-seal" aria-hidden="true"><span>代表</span></span>' : ''}
      ${t.results.length > 1 ? `<button class="pick" data-pick="${esc(r.id)}" aria-pressed="false" aria-label="加入对比：${esc(r.title)}"><span class="pick-box">${icon('plus')}${icon('check')}</span><span class="pick-text">对比</span></button>` : ''}
    </div>
    <div class="result-body">
      ${resultVariantButtons(t, r)}
      <p class="result-model">${brandMark(m, 'brand-mark sm')}<b><span data-i18n-ignore>${esc(m.name)}</span></b>${resultBadges(r)}${aiJudged(t) ? aiScoreBadge(r) : ''}${platform.featured?.[t.id]?.models?.[modelKey(r)] === r.id ? '<span class="badge featured-badge" title="盲评票选出的代表作">代表作</span>' : ''}${statusBadge(r.status, { reason: r.reason })}</p>
      ${lead ? `<p class="lead-why">${t.cover === coverWork.id ? '管理员指定的本题封面' : platform.featured?.[t.id]?.cover === coverWork.id ? '盲评票选的代表作' : '本题封面作品 · 盲评票数足够后改由票选决定'}</p>` : ''}
      <h3><a href="${viewHref(t, r.id)}"><span data-i18n-ignore>${esc(r.title)}</span>${icon('arrow')}</a></h3>
      <p class="result-by"><span data-i18n-ignore>${esc(authorName(r))}</span> <span>发布</span>${sourceLine(r) || r.tool ? ` · ${sourceLine(r) ? sourceHtml(r) : `<span data-i18n-ignore>${esc(r.tool)}</span>`}` : ''}${r.addedAt ? ` · <span data-i18n-date="${esc(r.addedAt)}">${formatDate(r.addedAt)}</span>` : ''}</p>${cardUsage(r)}
      ${r.status === 'questioned' && r.reason ? `<p data-i18n-ignore class="result-reason">${icon('alert')}<span>${esc(r.reason)}</span></p>` : ''}
      <div class="result-foot">
        ${r.gallery.length ? `<button class="text-action" data-gallery="${esc(r.id)}">${icon('image')}截图 ${r.gallery.length}</button>` : ''}
        ${reactionBar(workKey(t, r), { locked: !interactive(r) })}
      </div>
    </div>
  </article>`;
}

// The list splits by review state: verified works lead, unverified
// ones follow, questioned ones stay folded away as reference.
const GROUPS = [
  { status: 'verified', title: '已验证', note: '核验通过的作品' },
  { status: 'unverified', title: '未验证', note: '等待管理员核验 · 可以浏览和贴表情，暂不参与盲评' },
  { status: 'questioned', title: '存疑', note: '核验存疑 · 仅供参考，不参与互动与盲评' },
];
function resultGroup(t, g, items, coverWork) {
  const head = `<div class="group-head"><h3>${g.title}<span class="group-count" data-group-count>${items.length}</span></h3><p>${g.note}</p>${g.status === 'questioned' ? `<span class="group-toggle" aria-hidden="true"><span class="when-open">收起</span><span class="when-closed">展开</span>${icon('next')}</span>` : ''}</div>`;
  const grid = `<div class="result-grid" data-group="${g.status}">${items.map((r) => resultCard(t, r, coverWork)).join('')}</div>`;
  return g.status === 'questioned'
    ? `<details class="result-group is-questioned" data-group-wrap><summary>${head}</summary>${grid}</details>`
    : `<section class="result-group" data-group-wrap>${head}${grid}</section>`;
}
function resultGroups(t) {
  const coverWork = coverLead(t);
  const sorted = displayedResults(t, coverWork);
  if (t.results.every((r) => r.status === 'verified')) return `<div class="result-grid" data-group="verified">${sorted.map((r) => resultCard(t, r, coverWork)).join('')}</div>`;
  return GROUPS.map((g) => {
    const items = sorted.filter((r) => r.status === g.status);
    return items.length ? resultGroup(t, g, items, coverWork) : '';
  }).join('');
}

// 同门: each vendor's works in version order, so one lab's versions read left to right. Vendors
// with a single model share the last row; questioned works keep their folded group below.
// A task where no vendor answered with two models has no lineage to show, so it stays on 精选.
function hasLineage(t) {
  const models = new Map();
  for (const r of t.results.filter((item) => item.status !== 'questioned')) models.set(vendorOf(r), new Set([...(models.get(vendorOf(r)) ?? []), modelKey(r)]));
  return [...models.values()].some((keys) => keys.size > 1);
}
const familyShown = (t) => taskState.view === 'family' && hasLineage(t);
// Many models have no release month, so versions follow the name with its numbers read as numbers:
// a product line stays together and runs Gemini 3.1 → 3.7 → 3.8 → 4.x, then each effort low to max.
const lineage = (a, b) => modelOf(a).name.localeCompare(modelOf(b).name, 'en', { numeric: true, sensitivity: 'base' }) || effortRank(a) - effortRank(b);
function familyView(t) {
  const coverWork = coverLead(t);
  const shown = displayedResults(t, coverWork);
  const vendors = new Map();
  for (const r of shown.filter((item) => item.status !== 'questioned')) vendors.set(vendorOf(r), [...(vendors.get(vendorOf(r)) ?? []), r]);
  const models = (list) => new Set(list.map(modelKey)).size;
  const rows = [...vendors].filter(([, list]) => models(list) > 1)
    .sort(([a, x], [b, y]) => models(y) - models(x) || y.length - x.length || byName(a, b))
    .map(([vendor, list]) => ({ vendor, list: list.sort(lineage) }));
  const rest = [...vendors].filter(([, list]) => models(list) === 1).sort(([a], [b]) => byName(a, b)).flatMap(([, list]) => list.sort(lineage));
  if (rest.length) rows.push({ vendor: '', list: rest });
  const questioned = shown.filter((r) => r.status === 'questioned');
  return `<div class="family-list">${rows.map(({ vendor, list }) => `<section class="family" data-family${vendor ? '' : ' data-family-rest'}>
      <header class="family-head">${vendor ? brandMark(modelOf(list[0]), 'brand-mark') : ''}<h3>${vendor ? esc(vendor) : '其他厂商'}</h3><p data-family-count></p></header>
      <div class="family-strip">${list.map((r) => resultCard(t, r, coverWork)).join('')}</div>
    </section>`).join('')}</div>
    ${questioned.length ? resultGroup(t, GROUPS[2], questioned, coverWork) : ''}`;
}
const viewControl = (t) => !hasLineage(t) ? '' : `<div class="seg task-view" role="group" aria-label="作品排列">${[['featured', '精选', '每个模型先看一件代表作'], ['family', '同门', '按厂商分组，同一家按系列与版本排开']]
  .map(([value, text, hint]) => `<button data-task-view="${value}" aria-pressed="${value === (familyShown(t) ? 'family' : 'featured')}" title="${hint}">${text}</button>`).join('')}</div>`;
// 同门 keeps its own order, so the sort waits until the reader returns to 精选.
function syncTaskView(t) {
  const family = familyShown(t);
  $$('[data-task-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.taskView === taskState.view)));
  Object.assign($('[data-result-sort]'), { disabled: family, title: family ? '同门按系列与版本排列' : '' });
}

function sourceChoices(results, field, nameField, resolve) {
  const choices = new Map();
  for (const r of results) {
    const key = sourceKey(r, field, nameField);
    const item = choices.get(key) ?? { name: key === 'unset' ? '未注明' : resolve(r)?.name ?? r[nameField] ?? r[field], count: 0 };
    item.count++;
    choices.set(key, item);
  }
  if (!choices.has('unset')) choices.set('unset', { name: '未注明', count: 0 });
  return [...choices].sort(([a, x], [b, y]) => a === 'unset' ? -1 : b === 'unset' ? 1 : byName(x.name, y.name));
}

// The task page's usage view, once its question has measured works (see loadMetrics).
const usageNav = (t) => t.results.some((r) => r.usage) ? `<button class="side-link" data-go="cost" aria-pressed="false">${icon('clock')}<span data-usage-label>用量</span><span class="nav-count">${t.results.filter((r) => r.usage).length}</span></button>` : '';
const usageSection = (t) => t.results.some((r) => r.usage) ? `<section id="usage" data-panel="cost" class="block wrap usage-panel" hidden>
      <div id="usage-body"><p class="muted">正在载入用量…</p></div>
    </section>` : '';
// Metrics arrive after the page draws: add the view to the sidebar and the page, and open it when the
// address asks for it.
function showTaskUsage(t) {
  if (taskState.task !== t.id || $('[data-go="cost"]') || !usageNav(t)) return;
  const nav = $('.task-nav [data-go="board"]') ?? $('.task-nav [data-go="shots"]') ?? $('.task-nav [data-go="results"]');
  const panel = $('#board') ?? $('#shots') ?? $('#results');
  if (!nav || !panel) return;
  nav.insertAdjacentHTML('afterend', usageNav(t));
  panel.insertAdjacentHTML('afterend', usageSection(t));
  if (/\/(?:usage|cost)$/.test(location.hash.split('#')[1])) activatePanel('cost', false);
}
// Cards drawn before the metrics arrived gain their usage line under the source; the rest stay as they are.
function showCardUsage(t) {
  if (taskState.task !== t.id) return;
  for (const card of $$('[data-results] .result[data-id]')) {
    const line = cardUsage(t.results.find((r) => r.id === card.dataset.id));
    $('.result-usage', card)?.remove();
    if (line) $('.result-by', card)?.insertAdjacentHTML('afterend', line);
  }
}
function renderTask(t) {
  if (taskState.task !== t.id) {
    Object.assign(taskState, { task: t.id, vendor: '', harness: '', provider: '', query: '', picks: [], promptVariant: variantsOf(t)[0]?.id, promptOpener: null, variants: new Map(), open: new Set() });
    document.body.classList.remove('has-prompt-modal');
    taskScores = new Map();
  }
  taskState.cond = t.conditions.some((c) => c.id === taskState.cond) ? taskState.cond : t.conditions[0]?.id;
  const vendorCounts = new Map();
  for (const r of t.results) vendorCounts.set(vendorOf(r), (vendorCounts.get(vendorOf(r)) ?? 0) + 1);
  const vendors = [...vendorCounts.keys()].sort(byName);
  if (!vendors.includes(taskState.vendor)) taskState.vendor = '';
  const harnessChoices = sourceChoices(t.results, 'harness', 'harnessName', harnessOf);
  const providerChoices = ['unset', ...PROVIDERS.keys()].map((key) => [key, { name: PROVIDERS.get(key)?.name ?? '未注明', count: t.results.filter((r) => providerKey(r) === key).length }]);
  if (!harnessChoices.some(([key]) => key === taskState.harness)) taskState.harness = '';
  if (!providerChoices.some(([key]) => key === taskState.provider)) taskState.provider = '';
  taskState.picks = taskState.picks.filter((id) => t.results.some((r) => r.id === id));
  const hasCaptures = t.results.some((r) => Object.keys(r.captures).length);
  const captureNotes = t.results.filter((r) => r.captureNote).map((r) => `<span data-i18n-ignore>${esc(r.title)}</span>：<span data-i18n-ignore>${esc(r.captureNote)}</span>`);
  const works = counted(t);
  const pool = platform.arena[t.id];
  const promptNote = t.promptPending ? '提示词暂未公开' : t.references?.length ? `查看题面 · 附参考图 ${t.references.length}` : '查看完整题面';
  const promptBtn = `<button type="button" class="task-act is-prompt" data-open-prompt="actions" aria-haspopup="dialog" aria-expanded="${Boolean(taskState.promptOpener)}"><span class="task-act-mark" aria-hidden="true">${icon('file')}</span><span><b>提示词</b><small>${promptNote}</small></span></button>`;
  const actions = `<div class="task-acts">
    ${promptBtn}
    ${platform.available ? `${aiJudged(t) ? act('judge', '', icon('reason'), 'AI 评分', '暂未开放', '推理题由 AI 评分，不参与盲评和排行榜')
      : !platform.activityReady ? act('judge', '', AB, '参与盲评', platform.activityError ? '统计暂未载入 <button class="link" type="button" data-platform-reconnect>重新连接</button>' : '统计加载中…')
      : (pool?.entries ?? 0) >= 2 ? act('judge', `#/arena/${esc(t.id)}`, AB, '参与盲评', `可盲评 ${pool.works} 件`) : act('judge', '', AB, '参与盲评', '作品不足', '至少需要两个模型配置的作品进入盲评池')}
    ${t.acceptsUploads ? act('upload', `#/submit/${esc(t.id)}`, icon('upload'), '上传作品', platform.user && !can('canSubmitWork') ? '需要 Lv1 认证成员' : '交一份你的答案') : act('upload', '', icon('upload'), '暂不接受投稿', t.promptPending ? '提示词原文尚未公开' : '这道题暂时关闭了投稿')}` : ''}
  </div>`;

  root.innerHTML = `${header([LIBRARY, { text: t.title, original: true }], false, 'questions')}<div class="app-layout task-layout">
    <aside class="app-sidebar">
      <h1${titleWidth(t.title) > 9 ? ' class="is-long"' : ''}><span data-i18n-ignore>${esc(t.title)}</span></h1>
      <p class="side-intro"><span data-i18n-ignore>${esc(t.summary)}</span></p>
      <p class="side-byline"><span data-i18n-ignore>${esc(authorName(t))}</span> <span>发起</span>${t.date ? ` · <span data-i18n-date="${esc(t.date)}">${formatDate(t.date)}</span>` : ''}</p>
      <ul class="tags side-tags">${t.category ? `<li class="tag-kind">${esc(categoryLabel(t.category))}</li>` : ''}${subcategoryOf(t) ? `<li class="tag-sub"><a href="${LIBRARY.href}/${encodeURIComponent(t.category)}/${encodeURIComponent(subcategoryOf(t))}">${esc(subcategoryOf(t))}</a></li>` : ''}${domainsOf(t).map((d) => `<li><a href="${LIBRARY.href}/${encodeURIComponent(d)}">${esc(d)}</a></li>`).join('')}</ul>
      ${taskSolveSidebarHtml(t)}${taskCuratedSidebarHtml(t)}
      <nav class="side-nav task-nav" aria-label="本页">
        <button class="side-link" data-go="results" aria-pressed="true">${icon('grid')}作品<span class="nav-count">${t.results.length}</span></button>
        ${t.conditions.length ? `<button class="side-link" data-go="shots" aria-pressed="false">${icon('image')}截图对照</button>` : ''}
        ${platform.available && !aiJudged(t) ? `<button class="side-link" data-go="board" aria-pressed="false">${icon('rank')}排行榜</button>` : ''}${usageNav(t)}
        ${hasExhibition(t) ? `<p class="nav-sep">全屏查看</p>
        <a class="side-link" href="${sandtableHref(t)}">${icon('full')}三维沙盘<span class="nav-ext">${icon('arrow')}</span></a>
        <a class="side-link" href="#/${t.id}/exhibition">${icon('grid')}原作展厅<span class="nav-ext">${icon('arrow')}</span></a>` : ''}
      </nav>
      <div class="side-facts"><p>${modelCount(works)} 个模型 · ${new Set(works.map(vendorOf)).size} 家厂商</p>
        ${isStaff() && platform.activityReady ? adminPoolLine(t, pool) : ''}</div>
      <section class="side-prompt" aria-labelledby="side-prompt-title">
        <div class="side-prompt-head"><h2 id="side-prompt-title">题面</h2>
          ${variantsOf(t).length ? `<div class="seg" role="group" aria-label="提示词版本">${variantsOf(t).map((variant) => `<button type="button" data-prompt-variant="${esc(variant.id)}" aria-pressed="${variant.id === taskState.promptVariant}"><span data-i18n-ignore>${esc(variant.label)}</span></button>`).join('')}</div>` : ''}
          <button class="text-action side-prompt-open" type="button" data-open-prompt="sidebar" aria-haspopup="dialog" aria-expanded="${Boolean(taskState.promptOpener)}">浮窗查看</button><button class="text-action side-prompt-more" type="button" data-prompt-more aria-expanded="false">展开</button><button class="text-action" type="button" data-copy="short"><span data-copy-label>复制</span></button></div>
        ${referenceSheet(t.references, { key: t.id, credit: t.referenceCredit })}
        <pre data-i18n-ignore data-prompt-text>${linkReferences(selectedPrompt(t), t.references, t.id)}</pre>
      </section>
    </aside>
    <main class="workspace page">
    <section id="results" data-panel="results" class="collection-panel">
      <div class="collection-heading"><div class="collection-title"><h2 id="filter-heading">全部作品</h2><span id="filter-count">${t.results.length} 件作品</span>${aigcLabel()}</div>${actions}</div>
      <div class="collection-toolbar">${searchControl('work', '搜索模型或作品', taskState.query)}<div class="toolbar-actions">${viewControl(t)}${previewControl()}<label class="result-sort">厂商<select data-vendor-filter aria-label="按模型厂商筛选">
        <option value="">全部厂商（${t.results.length}）</option>
        ${vendors.map((v) => `<option value="${esc(v)}"${v === taskState.vendor ? ' selected' : ''}>${esc(v)}（${vendorCounts.get(v)}）</option>`).join('')}
      </select></label><label class="result-sort">Harness<select data-harness-filter aria-label="按 Harness 筛选">
        <option value="">全部 Harness（${t.results.length}）</option>
        ${harnessChoices.map(([key, item]) => `<option value="${esc(key)}"${key === taskState.harness ? ' selected' : ''}>${esc(item.name)}（${item.count}）</option>`).join('')}
      </select></label><label class="result-sort">服务商<select data-provider-filter aria-label="按服务商筛选">
        <option value="">全部服务商（${t.results.length}）</option>
        ${providerChoices.map(([key, item]) => `<option value="${esc(key)}"${key === taskState.provider ? ' selected' : ''}>${esc(item.name)}（${item.count}）</option>`).join('')}
      </select></label>${sortControl()}</div></div>
      <p class="fine" role="status" data-score-state hidden></p>
      <div data-results>${familyShown(t) ? familyView(t) : resultGroups(t)}</div>
      <p class="muted filter-empty" hidden>${t.results.length ? '没有匹配的作品，请试试其他关键词或筛选条件。' : '还没有作品，点击本题的「上传作品」带来第一份答案。'}</p>
    </section>

    ${t.conditions.length ? `<section id="shots" data-panel="shots" class="block wrap" hidden>
      <div class="block-head"><h2>截图对照</h2><p>切换拍摄条件；点开大图后，←/→ 换作品，↑/↓ 换条件。</p></div>
      <div class="seg" role="group" aria-label="截图条件">${t.conditions.map((c) => `<button data-cond="${esc(c.id)}" aria-pressed="${c.id === taskState.cond}">${esc(c.label)}</button>`).join('')}</div>
      <p class="cond-note" id="cond-note">${esc(t.conditions.find((c) => c.id === taskState.cond)?.note ?? '')}</p>
      <div id="shot-grid">${hasCaptures ? shotGrid(t) : '<p class="muted">暂无截图。</p>'}</div>
      ${captureNotes.length ? `<p class="fine">${captureNotes.join('<br />')}</p>` : ''}
      <p class="fine">自动截图可能使用软件渲染；实际光影与帧率请以在线预览为准。</p>
    </section>` : ''}

    ${platform.available && !aiJudged(t) ? `<section id="board" data-panel="board" class="block wrap" hidden>
      <div class="block-head"><h2>榜单</h2><p>这道题的盲评结果 · 按模型与推理档位分别计分</p>${(pool?.entries ?? 0) >= 2 ? `<a class="block-hint text-link" href="#/arena/${esc(t.id)}">参与这道题的盲评${icon('right')}</a>` : ''}</div>
      <div id="board-body"><p class="muted">正在载入榜单…</p></div>
    </section>` : ''}${usageSection(t)}
    ${footer()}</main></div>
  <div class="tray" role="region" aria-label="对比栏" hidden></div>
  <div class="prompt-overlay" data-prompt-modal role="dialog" aria-modal="true" aria-labelledby="prompt-modal-title"${taskState.promptOpener ? '' : ' hidden'}>
    <div class="prompt-sheet">
      <div class="prompt-sheet-head">
        <div class="prompt-sheet-title"><h2 id="prompt-modal-title">提示词</h2><p class="prompt-sheet-sub" data-i18n-ignore>${esc(t.title)}</p></div>
        <div class="prompt-sheet-tools">
          ${variantsOf(t).length ? `<div class="seg" role="group" aria-label="提示词版本">${variantsOf(t).map((variant) => `<button type="button" data-prompt-variant="${esc(variant.id)}" aria-pressed="${variant.id === taskState.promptVariant}"><span data-i18n-ignore>${esc(variant.label)}</span></button>`).join('')}</div>` : ''}
          <button type="button" class="btn sm" data-copy><span data-copy-label>复制提示词</span></button>
          <button type="button" class="icon-btn prompt-sheet-close" data-close-prompt aria-label="关闭提示词" title="关闭（Esc）">${icon('close')}</button>
        </div>
      </div>
      <div class="prompt-sheet-body">
        ${referenceSheet(t.references, { key: t.id, credit: t.referenceCredit })}
        <pre class="prompt-sheet-text" data-i18n-ignore data-prompt-text>${linkReferences(selectedPrompt(t), t.references, t.id)}</pre>
      </div>
    </div>
  </div>`;
  const promptModal = $('[data-prompt-modal]', root);
  const promptButtons = $$('[data-open-prompt]', root);
  const setPromptOpen = (opener = null) => {
    const previous = taskState.promptOpener;
    taskState.promptOpener = opener?.dataset.openPrompt ?? null;
    const open = Boolean(opener);
    promptModal.hidden = !open;
    promptButtons.forEach((button) => button.setAttribute('aria-expanded', String(open)));
    for (const el of root.children) if (el !== promptModal) el.inert = open;
    document.body.classList.toggle('has-prompt-modal', open);
    if (open) {
      deferredMedia.refresh(promptModal);
      $('[data-close-prompt]', promptModal).focus({ preventScroll: true });
    } else {
      promptButtons.find((button) => button.dataset.openPrompt === previous)?.focus({ preventScroll: true });
    }
  };
  let promptBackdropDown = false;
  promptModal?.addEventListener('pointerdown', (event) => {
    promptBackdropDown = event.target === promptModal;
  });
  if (taskState.promptOpener) setPromptOpen(promptButtons.find((button) => button.dataset.openPrompt === taskState.promptOpener));
  setPageTitle([{ text: t.title, original: true }, DATA.title]);
  void loadMetrics().then((info) => { showTaskUsage(t); if (info.supported) showCardUsage(t); });
  syncTaskView(t);
  filterResults(t);
  syncPicks(t);

  root.oninput = (e) => {
    if (!e.target.matches('[data-work-search]')) return;
    taskState.query = e.target.value;
    filterResults(t);
    updateResultPreviews(t);
  };

  root.onchange = (e) => {
    if (e.target.matches('[data-task-curated]')) return void saveTaskCurated(e.target);
    if (e.target.matches('[data-vendor-filter]')) { taskState.vendor = e.target.value; flip(root, () => filterResults(t)); updateResultPreviews(t); }
    if (e.target.matches('[data-harness-filter]')) { taskState.harness = e.target.value; flip(root, () => filterResults(t)); updateResultPreviews(t); }
    if (e.target.matches('[data-provider-filter]')) { taskState.provider = e.target.value; flip(root, () => filterResults(t)); updateResultPreviews(t); }
    if (!e.target.matches('[data-result-sort]')) return;
    setResultSort(e.target.value);
    flip(root, () => applySort(t));
    if (resultSort === 'score') void loadTaskScores(t);
    else cancelTaskScores();
  };
  root.onclick = (e) => {
    if (e.target.closest('[data-task-score-retry]')) { cancelTaskScores(); void loadTaskScores(t); return; }
    const promptVariant = e.target.closest('[data-prompt-variant]');
    if (promptVariant) {
      taskState.promptVariant = promptVariant.dataset.promptVariant;
      $$('[data-prompt-variant]', root).forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.promptVariant === taskState.promptVariant)));
      const promptHtml = linkReferences(selectedPrompt(t), t.references, t.id);
      $$('[data-prompt-text]', root).forEach((node) => { node.innerHTML = promptHtml; });
    }
    const opener = e.target.closest('[data-open-prompt]');
    if (opener) { setPromptOpen(opener); return; }
    if (e.target.closest('[data-close-prompt]')) { setPromptOpen(); return; }
    if (promptModal && taskState.promptOpener && e.target === promptModal && promptBackdropDown) {
      promptBackdropDown = false;
      setPromptOpen();
      return;
    }
    promptBackdropDown = false;
    // On narrow screens the sidebar sits above the works, so the prompt opens on request.
    const more = e.target.closest('[data-prompt-more]');
    if (more) {
      const open = more.closest('.side-prompt').classList.toggle('is-open');
      more.setAttribute('aria-expanded', String(open));
      more.textContent = open ? '收起' : '展开';
    }
    const view = e.target.closest('[data-task-view]');
    if (view && view.dataset.taskView !== taskState.view) {
      taskState.view = view.dataset.taskView;
      store.set('task-view', taskState.view);
      $('[data-results]').innerHTML = familyShown(t) ? familyView(t) : resultGroups(t);
      syncTaskView(t); filterResults(t); syncPicks(t); settleImages(); updateResultPreviews(t);
      cascade($('[data-results]'));
    }
    const resultVariant = e.target.closest('[data-result-variant]');
    if (resultVariant && resultVariant.dataset.variantResult) {
      const card = resultVariant.closest('.result'), previousId = card.dataset.id;
      if (previousId === resultVariant.dataset.variantResult) return;
      const restoreFocus = document.activeElement === resultVariant;
      const result = t.results.find((item) => item.id === resultVariant.dataset.variantResult);
      taskState.variants.set(variantKey(result), result.id);
      taskState.picks = taskState.picks.map((id) => id === previousId ? result.id : id);
      card.outerHTML = resultCard(t, result, coverLead(t));
      applySort(t); filterResults(t); syncPicks(t); settleImages(); updateResultPreviews(t);
      if (restoreFocus) $(`[data-result-variant][data-variant-result="${CSS.escape(result.id)}"][aria-pressed="true"]`, root)?.focus({ preventScroll: true });
    }
    const preview = e.target.closest('[data-preview-mode]');
    if (preview) {
      if (preview.dataset.previewMode !== previewMode) {
        previewMode = preview.dataset.previewMode;
        store.set('preview-mode', previewMode);
        document.body.dataset.previewMode = previewMode;
        $$('[data-preview-mode]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.previewMode === previewMode)));
      }
      prioritizeResultLead();
      updateResultPreviews(t, previewMode === 'model' ? previewTriggerId(t) : null);
    }
    const go = e.target.closest('[data-go]');
    if (go) {
      activatePanel(go.dataset.go);
      scrollTo({ top: 0 });
    }
    const fold = e.target.closest('[data-fold]');
    if (fold) {
      if (taskState.open.has(fold.dataset.fold)) taskState.open.delete(fold.dataset.fold);
      else taskState.open.add(fold.dataset.fold);
      flip(root, () => filterResults(t));
    }
    const pick = e.target.closest('[data-pick], [data-unpick]');
    if (pick) togglePick(t, pick.dataset.pick ?? pick.dataset.unpick);
    if (e.target.closest('[data-clear-picks]')) { taskState.picks = []; syncPicks(t); }
    const cond = e.target.closest('[data-cond]');
    if (cond) {
      taskState.cond = cond.dataset.cond;
      $$('[data-cond]').forEach((el) => el.setAttribute('aria-pressed', String(el === cond)));
      $('#cond-note').textContent = t.conditions.find((c) => c.id === taskState.cond)?.note ?? '';
      if (hasCaptures) { $('#shot-grid').innerHTML = shotGrid(t); settleImages(); cascade($('#shot-grid'), '.shot'); }
    }
    const shot = e.target.closest('[data-shot]');
    if (shot) openCompareLightbox(t, shot.dataset.shot);
    const gal = e.target.closest('[data-gallery]');
    if (gal) {
      const r = t.results.find((x) => x.id === gal.dataset.gallery);
      lightbox.open(r.gallery.map((g) => ({ src: versionedMedia(g.src), title: g.caption || r.title, sub: `${r.title} · ${label(r)} · 作者截图` })), 0);
    }
    const copy = e.target.closest('[data-copy]');
    if (copy) {
      const lbl = $('[data-copy-label]', copy) ?? copy;
      const idleLabel = copy.dataset.copy === 'short' ? tr('复制') : tr('复制提示词');
      clearTimeout(copy._copyTimer);
      navigator.clipboard?.writeText(selectedPrompt(t)).then(() => {
        lbl.textContent = tr('已复制');
        toast(tr('已复制提示词'));
        copy._copyTimer = setTimeout(() => { lbl.textContent = idleLabel; }, 1500);
      }, () => { lbl.textContent = tr('复制失败'); });
    }
  };
  const requestCardPreview = (event) => {
    if (!initialPlatformSettled || previewMode !== 'model' || $('#results').hidden) return;
    const media = event.target.closest?.('.result-media');
    const card = media?.closest('.result[data-id]');
    if (!card || card.hidden || media.contains(event.relatedTarget)) return;
    updateResultPreviews(t, card.dataset.id);
  };
  root.onpointerover = (event) => {
    if (event.pointerType !== 'touch') requestCardPreview(event);
  };
  root.onfocusin = requestCardPreview;
  return (event) => {
    if (!taskState.promptOpener || event.defaultPrevented || lightbox.isOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setPromptOpen();
    } else if (event.key === 'Tab') {
      const buttons = $$('button:not(:disabled), a[href]', promptModal).filter((el) => el.getClientRects().length);
      const first = buttons[0], last = buttons.at(-1);
      if (document.activeElement === (event.shiftKey ? first : last)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    }
  };
}

// The task page as the router sees it: its panel and selected card preview, plus board and tray cleanup.
function renderBackendTask(t) {
  taskState.task = t.id;
  taskState.promptOpener = null;
  document.body.classList.remove('has-prompt-modal');
  const b = t.benchmark ?? {};
  const tierCode = b.tier ? String(b.tier).toUpperCase() : null;
  const meta = backendTierMeta(tierCode);
  const langs = backendLanguages(t);
  const tierLinks = BACKEND_TIERS.map((item) => {
    const peer = DATA.tasks.find((x) => benchmarkTask(x) && String(x.benchmark?.tier ?? '').toUpperCase() === item.tier);
    const href = peer ? taskHref(peer) : `#/leaderboard/backend/${item.slug}`;
    const current = item.tier === tierCode;
    return `<a class="side-link" href="${esc(href)}"${current ? ' aria-current="page"' : ''}>${icon('terminal')}<span>${esc(item.tier)} · ${esc(item.name)}</span><span class="nav-count">×${item.weight}</span></a>`;
  }).join('');
  root.innerHTML = `${header([LIBRARY, { text: categoryLabel(t.category), href: `${LIBRARY.href}/${encodeURIComponent(t.category)}` }, { text: t.title, original: true }], false, 'questions')}<div class="app-layout task-layout is-backend-task">
    <aside class="app-sidebar">
      <a class="side-link backend-back-link" href="${LIBRARY.href}/${encodeURIComponent(t.category)}">${icon('prev')}返回后端题库</a>
      <h1${titleWidth(t.title) > 9 ? ' class="is-long"' : ''}><span data-i18n-ignore>${esc(t.title)}</span></h1>
      <p class="side-intro"><span data-i18n-ignore>${esc(t.summary)}</span></p>
      <ul class="tags side-tags">
        ${t.category ? `<li class="tag-kind">${esc(categoryLabel(t.category))}</li>` : ''}
        ${langs.map((lang) => `<li class="tag-lang" data-i18n-ignore>${esc(lang)}</li>`).join('')}
        ${domainsOf(t).map((d) => `<li><a href="${LIBRARY.href}/${encodeURIComponent(d)}">${esc(d)}</a></li>`).join('')}
      </ul>
      ${taskSolveSidebarHtml(t)}
      <div class="backend-side-cta">
        <a class="btn primary" href="#/leaderboard/backend">查看后端合成总榜${icon('right')}</a>
      </div>
      <nav class="side-nav task-nav backend-tier-nav" aria-label="后端分卷">${tierLinks}</nav>
    </aside>
    <main class="workspace page">
      <section class="block wrap">
        <div id="backend-task-board" data-backend-board><p class="muted">正在载入榜单…</p></div>
      </section>
      <section class="block wrap backend-eval-card">
        <h2>评测说明</h2>
        <p>本题属于 <code data-i18n-ignore>${esc(b.suite ?? b.benchmark ?? 'AGB-Bench v4.1')}</code> 离线闭卷自动化后端工程基准，页面仅展示分卷元数据、编程语言要求（<span data-i18n-ignore>${esc(langs.join(' / ') || meta?.languageLabel || 'Python')}</span>）与实测排名数据，不公开题面原文，也不开放作品投稿与盲评投票。</p>
      </section>
      ${footer()}
    </main>
  </div>`;
  setPageTitle([{ text: t.title, original: true }, DATA.title]);
  let cancelled = false;
  const ready = import('./backend-board.js').then(({ mountBackendBoard }) => {
    const body = $('[data-backend-board]', root);
    if (cancelled || !body || !body.isConnected) return;
    taskBoard = mountBackendBoard(body, { ...context(), tier: tierCode, task: t });
    return taskBoard.ready;
  }).catch((error) => {
    const body = $('[data-backend-board]', root);
    if (!cancelled && body?.isConnected) void showLoadFailure(body, error, '榜单加载失败');
  });
  return {
    ready,
    // Sign-in and statistics do not change the benchmark board; the page is not redrawn for them.
    onPlatformChange() {},
    destroy() {
      cancelled = true;
      taskBoard?.destroy?.();
      taskBoard = null;
      document.body.classList.remove('has-tray');
    },
  };
}
function taskPage(t) {
  if (benchmarkTask(t)) return renderBackendTask(t);
  const onPromptKey = renderTask(t);
  activatePanel(/\/(?:usage|cost)$/.test(location.hash.split('#')[1]) ? 'cost' : location.hash.split('#')[2], false);
  document.addEventListener('keydown', onPromptKey);
  return {
    scoreTask: t.id,
    ready: updateResultPreviews(t),
    destroy({ keepTaskScores = false } = {}) {
      document.removeEventListener('keydown', onPromptKey);
      if (!keepTaskScores) {
        taskState.promptOpener = null;
        document.body.classList.remove('has-prompt-modal');
        cancelTaskScores();
      }
      taskBoard?.destroy?.();
      taskBoard = null;
      usageView?.destroy();
      usageView = null;
      ++previewVersion;
      resultPreviews?.destroy();
      resultPreviews = null;
      activeResultPreviewId = null;
      document.body.classList.remove('has-tray');
    },
  };
}

function applySort(t) {
  const cards = new Map($$('.result').map((el) => [el.dataset.id, el]));
  const sorted = displayedResults(t);
  $$('.result-grid[data-group]').forEach((grid) => grid.append(...sorted.filter((r) => r.status === grid.dataset.group).map((r) => cards.get(r.id)).filter(Boolean)));
  resultPreviews?.refresh();
}

function filterResults(t) {
  const displayed = displayedResults(t);
  const shown = displayed.filter((r) => (!taskState.vendor || vendorOf(r) === taskState.vendor)
    && (!taskState.harness || sourceKey(r, 'harness', 'harnessName') === taskState.harness)
    && (!taskState.provider || providerKey(r) === taskState.provider)
    && textMatches(taskState.query, [label(r), r.title, r.summary, vendorOf(r), harnessOf(r)?.name, providerOf(r)?.name].join(' ')));
  // A filter or search lists every match; otherwise each model shows its lead work. 同门 lists them all.
  const filtering = Boolean(taskState.vendor || taskState.harness || taskState.provider || taskState.query.trim());
  const unfolded = filtering || familyShown(t);
  const matches = new Set(shown.map((r) => r.id));
  const groups = new Map(), groupByWork = new Map();
  const boosted = new Set(boostedWorks(displayed, { sort: resultSort, vendorOf }));
  for (const r of displayed) {
    const key = boosted.has(r) ? `boost|${r.id}` : foldKey(r);
    if (!groups.has(key)) groups.set(key, { key, first: r, count: 0 });
    const group = groups.get(key);
    group.count++;
    groupByWork.set(r.id, group);
  }
  $$('.result').forEach((el) => {
    const id = el.dataset.id;
    const group = groupByWork.get(id);
    const first = group?.first.id === id;
    const open = !unfolded && group?.count > 1 && taskState.open.has(group.key);
    el.hidden = !matches.has(id) || (!unfolded && !first && !open);
    el.classList.toggle('is-fold-open', open);
    let button = $('[data-fold]', el);
    if (unfolded || !first || group.count < 2) { button?.remove(); return; }
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'fold-chip';
      button.dataset.fold = group.key;
      $('.result-model', el).append(button);
    }
    const more = group.count - 1;
    const name = modelOf(group.first).name;
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? `收起 ${name} 的其余作品` : `展开 ${name} 的另外 ${more} 件作品`);
    button.title = open ? '收起' : `同一模型的另外 ${more} 件作品（其他档位或版本）`;
    button.textContent = open ? '收起' : `+${more} 件`;
  });
  // The cover is drawn large only over the full list; a filter or search shows plain matches.
  $$('.result-grid').forEach((grid) => grid.classList.toggle('is-filtering', filtering));
  // A vendor row marks each step to a newer model; the shared last row has no lineage to mark.
  $$('[data-family]').forEach((row) => {
    const cards = $$('.result', row).filter((el) => !el.hidden);
    row.hidden = !cards.length;
    cards.forEach((el, i) => el.classList.toggle('is-next-model', i > 0 && !('familyRest' in row.dataset) && el.dataset.model !== cards[i - 1].dataset.model));
    $('[data-family-count]', row).textContent = `${new Set(cards.map((el) => el.dataset.model)).size} 个模型 · ${cards.length} 件作品`;
  });
  $$('[data-group-wrap]').forEach((wrap) => {
    wrap.hidden = !$$('.result', wrap).some((el) => !el.hidden);
    $('[data-group-count]', wrap).textContent = $$('.result', wrap).filter((el) => matches.has(el.dataset.id)).length;
  });
  $('[data-vendor-filter]').value = taskState.vendor;
  $('[data-harness-filter]').value = taskState.harness;
  $('[data-provider-filter]').value = taskState.provider;
  $('#filter-heading').textContent = taskState.vendor || '全部作品';
  $('#filter-count').textContent = variantsOf(t).length ? `${modelCount(shown)} 个模型 · ${shown.length} 组结果 · ${t.results.length} 份作品` : `${modelCount(shown)} 个模型 · ${shown.length} 件作品`;
  $('.filter-empty').hidden = shown.length > 0;
  prioritizeResultLead();
  resultPreviews?.refresh();
}

// Architecture supports a multi-result exhibition; other tasks keep two panes.
function togglePick(t, id) {
  const picks = taskState.picks;
  if (picks.includes(id)) taskState.picks = picks.filter((x) => x !== id);
  else taskState.picks = hasExhibition(t) ? [...picks, id] : [...picks, id].slice(-2);
  syncPicks(t);
}

function syncPicks(t) {
  const picks = taskState.picks;
  $$('[data-pick]').forEach((el) => {
    const on = picks.includes(el.dataset.pick);
    el.setAttribute('aria-pressed', String(on));
    el.closest('.result')?.classList.toggle('picked', on);
    $('.pick-text', el).textContent = on ? `已选 ${picks.indexOf(el.dataset.pick) + 1}` : '对比';
  });
  const tray = $('.tray');
  if (!tray) return;
  tray.hidden = !picks.length;
  document.body.classList.toggle('has-tray', picks.length > 0);
  if (!picks.length) return;
  const chosen = picks.map((id) => t.results.find((r) => r.id === id));
  // Works on the content origin have no scene extract: side by side, but not in the sandtable.
  const sandIds = picks.filter((id) => t.results.some((r) => r.id === id && hosted(r)));
  const sandNote = sandIds.length < picks.length ? ' title="网页上传的作品没有沙盘模型"' : '';
  const slot = (r, i) => {
    const slotSrc = r ? previewScreenshotOf(t, r) : '';
    const slotZoom = r ? previewZoomKind(t, slotSrc) : '';
    return (r
    ? `<li class="slot"><span class="slot-thumb"${slotZoom ? ` data-preview-zoom="${slotZoom}"` : ''}>${img(slotSrc, '', '', true)}</span><span class="slot-text"><b><span data-i18n-ignore>${esc(r.title)}</span></b><small><span data-i18n-ignore>${esc(label(r))}</span></small></span><button class="slot-x" data-unpick="${esc(r.id)}" aria-label="移出对比：${esc(r.title)}">${icon('close')}</button></li>`
    : `<li class="slot empty"><span class="slot-thumb">${pad(i + 1)}</span><span class="slot-text"><b>再选一件</b><small>点击作品上的「对比」</small></span></li>`);
  };
  tray.innerHTML = `<ol class="slots">${slot(chosen[0], 0)}<li class="vs" aria-hidden="true">${chosen.length > 2 ? `+${chosen.length - 1}` : 'vs'}</li>${chosen.length <= 2 ? slot(chosen[1], 1) : `<li class="slot"><span class="slot-text"><b>共 ${chosen.length} 件作品</b><small>在同一画布上查看原作</small></span></li>`}</ol>
    <div class="tray-actions">
      <button class="icon-btn" data-clear-picks aria-label="清空对比" title="清空">${icon('close')}</button>
      ${chosen.length === 2 ? `<a class="btn${hasExhibition(t) ? '' : ' primary'}" href="${viewHref(t, chosen[0].id, chosen[1].id)}">并排对比${icon('right')}</a>` : ''}
      ${hasExhibition(t) ? (sandIds.length ? `<a class="btn primary" href="${sandtableHref(t, sandIds)}"${sandNote}>进入沙盘${icon('right')}</a>` : `<span class="btn primary is-disabled" aria-disabled="true" title="投稿作品不进入沙盘">进入沙盘${icon('right')}</span>`) : chosen.length < 2 ? `<span class="btn primary is-disabled" aria-disabled="true">并排对比${icon('right')}</span>` : ''}
    </div>`;
  settleImages();
}

function openCompareLightbox(t, resultId) {
  const items = (condId) => {
    const cond = t.conditions.find((c) => c.id === condId);
    return t.results.filter((r) => r.captures[condId]).map((r) => ({
      id: r.id, src: versionedMedia(r.captures[condId]), title: `${r.title} · ${cond.label}`, sub: `${label(r)} · ←/→ 换作品，↑/↓ 换条件`,
    }));
  };
  const current = t.results.find((r) => r.id === resultId);
  const list = items(taskState.cond);
  lightbox.open(list, Math.max(0, list.findIndex((x) => x.id === current.id)), (dir, item) => {
    const withShots = t.conditions.filter((c) => t.results.some((r) => r.captures[c.id]));
    let i = withShots.findIndex((c) => c.id === taskState.cond);
    i = (i + dir + withShots.length) % withShots.length;
    taskState.cond = withShots[i].id;
    $$('[data-cond]').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.cond === taskState.cond)));
    const note = $('#cond-note');
    if (note) note.textContent = withShots[i].note ?? '';
    const grid = $('#shot-grid');
    if (grid) { grid.innerHTML = shotGrid(t); settleImages(); }
    const next = items(taskState.cond);
    return { items: next, index: Math.max(0, next.findIndex((x) => x.id === item.id)) };
  }, { returnFocus: (item) => $(`#shot-grid [data-shot="${CSS.escape(item.id)}"]`, root) });
}

// ---- lightbox -------------------------------------------------------------------------
const lightbox = (() => {
  const el = $('#lightbox');
  const image = $('.lb-img', el);
  const caption = $('.lb-caption', el);
  const count = $('.lb-count', el);
  $('.lb-close', el).innerHTML = icon('close');
  $('.lb-prev', el).innerHTML = icon('prev');
  $('.lb-next', el).innerHTML = icon('next');
  const download = $('.lb-download', el);
  download.innerHTML = icon('download');
  const strip = $('.lb-strip', el);
  let items = [];
  let index = 0;
  let vertical = null;
  let lastFocus = null;
  let returnFocus = null;
  let label = '';
  let closing = null;
  // Stepping slides the next picture in from the side it came from.
  const show = (direction = 0) => {
    const it = items[index];
    image.classList.remove('is-loaded');
    image.src = it.src;
    image.alt = it.title;
    if (image.complete) image.classList.add('is-loaded');
    if (direction) slideIn(image, direction);
    caption.innerHTML = `<b><span data-i18n-ignore>${esc(it.title)}</span></b>${it.credit !== undefined ? it.credit ? `<span>图片来源：<span data-i18n-ignore>${esc(it.credit)}</span></span>` : '' : `<span data-i18n-ignore>${esc(it.sub ?? '')}</span>`}`;
    count.textContent = items.length > 1 ? `${label ? `${label} ` : ''}${index + 1} / ${items.length}` : label;
    el.classList.toggle('single', items.length < 2);
    // Items with a download name offer the file under that name.
    download.hidden = !it.download;
    if (it.download) Object.assign(download, { href: it.download.href, download: it.download.name });
    $('.lb-file', el).textContent = it.download?.name ?? '';
    $$('button', strip).forEach((b, i) => b.setAttribute('aria-current', String(i === index)));
  };
  const step = (d) => { index = (index + d + items.length) % items.length; show(d); };
  const finish = () => {
    if (el.hidden) return;
    closing = null;
    el.hidden = true;
    el.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
    document.body.classList.remove('lb-open');
    resultPreviews?.setPaused(Boolean($('#results')?.hidden));
    const target = lastFocus?.isConnected ? lastFocus : returnFocus?.(items[index]);
    target?.focus();
    lastFocus = null;
    returnFocus = null;
    vertical = null;
    items = [];
  };
  // Closing on request fades the picture away; a page change closes at once.
  const close = (fade = false) => {
    if (el.hidden) return;
    if (!fade || reducedMotion()) return finish();
    if (closing) return;
    closing = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease', fill: 'forwards' });
    image.animate([{ transform: 'none' }, { transform: 'scale(.97)' }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
    closing.finished.then(finish, () => {});
  };
  el.addEventListener('click', (e) => {
    if (e.target.closest('.lb-download')) {
      e.preventDefault();
      downloadReference(items[index].download);
      return;
    }
    const act = e.target.closest('[data-lb]')?.dataset.lb;
    const go = e.target.closest('[data-lb-go]');
    if (go) { const to = Number(go.dataset.lbGo); const d = Math.sign(to - index); index = to; show(d); }
    else if (act === 'prev') step(-1);
    else if (act === 'next') step(1);
    else if (act === 'close' || e.target === el || e.target.matches('.lb-figure')) close(true);
  });
  document.addEventListener('keydown', (e) => {
    if (el.hidden || closing) return;
    if (e.key === 'Escape') close(true);
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else if (vertical && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      ({ items, index } = vertical(e.key === 'ArrowDown' ? 1 : -1, items[index]));
      show();
    } else if (e.key === 'Tab') {
      // Keep focus inside the dialog.
      const focusable = $$('button, a[href]', el).filter((b) => !b.hidden && b.offsetParent);
      const i = focusable.indexOf(document.activeElement);
      const next = focusable[(i + (e.shiftKey ? -1 : 1) + focusable.length) % focusable.length];
      next?.focus();
    } else return;
    e.preventDefault();
  });
  let touchX = null;
  el.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    touchX = null;
  });
  return {
    // strip: show every item as a thumbnail under the picture; label: what the count counts.
    open(list, i = 0, onVertical = null, { strip: withStrip = false, label: name = '', returnFocus: findFocus = null } = {}) {
      if (!list.length) return;
      if (closing) finish();
      items = list;
      index = i;
      vertical = onVertical;
      returnFocus = findFocus;
      label = name;
      strip.hidden = !withStrip || list.length < 2;
      el.classList.toggle('has-strip', !strip.hidden);
      strip.innerHTML = strip.hidden ? '' : list.map((it, k) => `<button data-i18n-ignore type="button" data-lb-go="${k}" aria-label="${esc(it.title)}"><img data-media-src="${esc(it.thumb ?? it.src)}" alt="" decoding="async"></button>`).join('');
      lastFocus = document.activeElement;
      show();
      el.hidden = false;
      document.body.classList.add('lb-open');
      resultPreviews?.setPaused(true);
      $('.lb-close', el).focus();
      zoomFrom(image, lastFocus);
    },
    close,
    get isOpen() { return !el.hidden; },
  };
})();

useReferenceViewer(lightbox.open);

// ---- viewer ---------------------------------------------------------------------------
// Kept alive across hash changes inside the same task so switching one pane
// does not reload the other.
const wide = () => matchMedia('(min-width: 1100px)').matches;

// How a work was made, in the guide drawer.
function sourceFacts(r) {
  const harness = harnessOf(r);
  return `<div><dt>Harness</dt><dd>${harness ? esc(harness.name) : r.tool ? `<span data-i18n-ignore>${esc(r.tool)}</span>（<span>作者原始声明</span>）` : '未注明'}</dd></div>
      <div><dt>服务商</dt><dd>${esc(providerOf(r)?.name ?? '未注明')}</dd></div>`;
}
// Staff switches beside a verified work: [button, faces, toast].
const VIEWER_FACES = { 'arena-on': ['开启盲评', { show_arena: true }, '已开启盲评'], 'arena-off': ['移出盲评', { show_arena: false }, '已移出盲评'],
  hide: ['撤下', { show_gallery: false, show_arena: false }, '已撤下'] };
// A work's review state, who published it and how it was made.
function workFacts(r) {
  const info = STATUS[r.status];
  const admin = isStaff() && platform.activityReady && r.status === 'verified';
  const switches = admin ? [r.arena?.state === 'in_pool' ? 'arena-off' : r.arena?.state === 'off' ? 'arena-on' : '', 'hide'].filter(Boolean) : [];
  return `<div class="guide-block guide-status" data-status="${r.status}">
    <h3>核验状态</h3>
    <p class="guide-state">${statusBadge(r.status, { always: true })}${arenaText(r.arena) ? `<span>已公开</span> · <span>${esc(arenaText(r.arena))}</span>` : `<span>${esc(info.hint)}</span>`}</p>
    ${switches.length ? `<div class="actions">${switches.map((action) => `<button class="btn sm" data-face="${action}">${VIEWER_FACES[action][0]}</button>`).join('')}</div>` : ''}
    ${r.reason ? `<p data-i18n-ignore class="guide-reason">${esc(r.reason)}</p>` : ''}
    <dl class="facts">
      <div><dt>发布</dt><dd><span data-i18n-ignore>${esc(authorName(r))}</span>${r.addedAt ? ` · <span data-i18n-date="${esc(r.addedAt)}">${formatDate(r.addedAt)}</span>` : ''}</dd></div>
      ${sourceFacts(r)}
      ${r.artifact ? artifactRow(r, formatBytes) : r.files ? `<div><dt>文件</dt><dd>${r.files} 个 · ${formatBytes(r.bytes)}</dd></div>` : ''}
    </dl>
    ${r.note ? `<p data-i18n-ignore class="guide-note">${esc(r.note)}</p>` : ''}
  </div>`;
}

function createViewer(t) {
  const state = { panes: [], queries: [], active: 0, guide: store.get('guide') === '1' && wide() };
  const frameLoads = new Map();
  let blurTimer;
  const clearFrameLoads = () => { for (const stop of frameLoads.values()) stop(); frameLoads.clear(); };
  // Music works: the embedded players follow the site theme, and starting one pauses the other.
  const frameOrigin = (frame) => { try { return new URL(frame.src).origin; } catch { return ''; } };
  const postFrame = (frame, message) => {
    const origin = frame && frameOrigin(frame);
    if (frame?.contentWindow && origin) frame.contentWindow.postMessage(message, origin);
  };
  const currentTheme = () => {
    const theme = document.documentElement.dataset.theme;
    if (theme === 'light' || theme === 'dark') return theme;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };
  const syncAudioTheme = (frame) => {
    if (t.category === '音乐') postFrame(frame, { source: 'sp-arena-theme', theme: currentTheme() });
  };
  const themeObserver = new MutationObserver(() => {
    if (t.category === '音乐') $$('iframe', stage).forEach(syncAudioTheme);
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const onAudioMessage = (event) => {
    if (t.category !== '音乐' || event.data?.source !== 'sp-audio' || event.data.playing !== true) return;
    const frames = $$('iframe', stage);
    const sourceFrame = frames.find((frame) => event.source === frame.contentWindow && event.origin === frameOrigin(frame));
    if (!sourceFrame) return;
    for (const frame of frames) {
      if (frame !== sourceFrame) postFrame(frame, { source: 'sp-arena-audio', pause: true });
    }
  };
  addEventListener('message', onAudioMessage);
  const byId = (id) => t.results.find((r) => r.id === id);
  // A version the question no longer lists adds nothing to the option text.
  const versionLabel = (r) => variantsOf(t).find((variant) => variant.id === r.promptVariant)?.label;
  const options = () => sortedResults(t).map((r) => option(r.id, `${r.title} · ${label(r)}${versionLabel(r) ? ` · ${versionLabel(r)}` : ''}`, false, r.status !== 'verified' ? ` · ${STATUS[r.status].label}` : '')).join('');
  const many = t.results.length > 1;
  setPageTitle(['在线预览', { text: t.title, original: true }]);

  root.innerHTML = `<div class="viewer work-viewer">
    <header class="vbar">
      ${backLink('vback')}
      <div class="vnav">
        ${many ? `<button class="vtool icon-only" data-v="prev" aria-label="上一件作品" title="上一件（←）">${icon('prev')}</button>` : ''}
        <span class="vselect-wrap"><span class="vmark" aria-hidden="true"></span><select class="vselect" aria-label="选择预览作品">${options()}</select></span>
        ${many ? `<button class="vtool icon-only" data-v="next" aria-label="下一件作品" title="下一件（→）">${icon('next')}</button>` : ''}
      </div>
      <span class="split-context">并排对比 · 点击一栏以选中</span>
      <div class="vtools">
        ${aigcLabel()}
        ${hasExhibition(t) ? `<button class="vtool" data-v="exhibition" title="将当前作品加入三维沙盘">${icon('full')}<span class="vtool-text">沙盘</span></button>` : ''}
        <button class="vtool" data-v="guide" aria-label="操作指南" aria-pressed="false" title="操作指南（G）">${icon('guide')}<span class="vtool-text">指南</span></button>
        ${many ? `<button class="vtool" data-v="split" aria-label="并排对比" aria-pressed="false" title="并排对比（S）">${icon('split')}<span class="vtool-text">并排</span></button>` : ''}
        <button class="vtool" data-v="controls" aria-label="显示作品控件" aria-pressed="false" title="显示作品控件" hidden>${icon('menu')}<span class="vtool-text">显示作品控件</span></button>
        <a class="vtool" data-v="open" aria-label="在新窗口打开独立页面" target="_blank" rel="noopener" title="在新窗口打开独立页面">${icon('arrow')}<span class="vtool-text">新窗口</span></a>
        <button class="vtool" data-v="full" aria-label="全屏" title="全屏（F）">${icon('full')}<span class="vtool-text">全屏</span></button>
        <span class="vdivider" aria-hidden="true"></span>
        ${languageButton('vtool')}${themeButton('vtool icon-only')}
      </div>
    </header>
    <div class="vmain">
      <div class="stage"></div>
      <aside class="guide" aria-label="操作指南"></aside>
    </div>
  </div>`;
  document.body.classList.add('is-viewer');
  const el = $('.viewer', root);
  const stage = $('.stage', el);
  const guide = $('.guide', el);
  const controlsButton = $('[data-v="controls"]', el);
  const controls = createWorkControls(({ folded, count }) => {
    controlsButton.hidden = state.panes.length < 2 || !count;
    const text = folded ? '显示作品控件' : '隐藏作品控件';
    controlsButton.setAttribute('aria-label', text);
    controlsButton.setAttribute('aria-pressed', String(!folded));
    controlsButton.title = `${folded ? '显示' : '隐藏'}作品控件`;
    $('.vtool-text', controlsButton).textContent = text;
  });

  function paneHtml(i) {
    return `<section class="pane" data-pane="${i}">
      <div class="pane-head">
        <span class="pane-tag">${i === 0 ? 'A' : 'B'}</span>
        <select data-pane-pick="${i}" aria-label="${i === 0 ? '左' : '右'}栏的作品">${options()}</select>
        <button class="pane-close" data-close="${i}" title="关闭这一栏" aria-label="关闭这一栏">${icon('close')}</button>
      </div>
      <div class="pane-variants"></div>
      <div class="pane-body"></div>
    </section>`;
  }

  function load(i) {
    frameLoads.get(i)?.();
    frameLoads.delete(i);
    const r = byId(state.panes[i]);
    const pane = $(`[data-pane="${i}"]`, stage);
    const body = $('.pane-body', pane);
    const previous = $('iframe', body);
    if (previous) controls.remove(previous);
    $('select', pane).value = r.id;
    drawPaneUsage(pane, r);
    $('.pane-variants', pane).innerHTML = resultVariantButtons(t, r, i);
    $('.pane-variants', pane).hidden = !variantChoices(t, r).length;
    if (!r.scene) {
      body.innerHTML = `<div class="loader static"><b><span data-i18n-ignore>${esc(r.title)}</span></b><span>该作品尚未构建，无法在线预览。</span></div>`;
      return;
    }
    const split = state.panes.length > 1;
    const src = workFrameUrl(r.scene, state.queries[i], split && !hosted(r));
    const bg = versionedMedia(cover(r));
    // Works on the content origin get the frame sandbox that repeats the server's policy.
    const sandbox = hosted(r) ? '' : ' sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-pointer-lock allow-downloads" referrerpolicy="no-referrer"';
    // Replace the whole frame so the previous scene's WebGL context is released.
    body.innerHTML = `<iframe data-i18n-ignore src="${esc(src)}" title="${esc(r.title)} · ${esc(label(r))}" allow="fullscreen; autoplay; clipboard-write" allowfullscreen${sandbox}></iframe>
      <div class="loader"${bg ? ` style="--cover:url('${esc(bg)}')"` : ''}><div class="spinner" aria-hidden="true"></div><b><span data-i18n-ignore>${esc(r.title)}</span></b><span><span data-i18n-ignore>${esc(label(r))}</span> · 正在载入</span></div>`;
    const frame = $('iframe', body);
    if (split) controls.add(frame, { inject: hosted(r) });
    const loader = $('.loader', body);
    frameLoads.set(i, watchViewerFrame(frame, {
      onLoaded: () => { loader.classList.add('gone'); frameLoads.delete(Number(pane.dataset.pane)); syncAudioTheme(frame); },
      onSlow: () => {
        loader.innerHTML = `<b>作品尚未完成载入</b><span>可以重新载入这一侧，或继续等待。</span><button class="btn" type="button" data-pane-reload="${pane.dataset.pane}">${icon('reload')}重新载入当前栏</button>`;
      },
    }));
  }

  // Side by side, each pane names its work's usage under the pane title (token-cost design §5.1); the
  // line exists only then, so panes without usage stay exactly as they were.
  function drawPaneUsage(pane, r) {
    $('.pane-usage', pane)?.remove();
    if (state.panes.length > 1 && r?.usage) $('.pane-head', pane).insertAdjacentHTML('afterend', `<p class="pane-usage">${usageLine(r)}</p>`);
  }

  function renderGuide() {
    const r = byId(state.panes[state.active]);
    const g = r.guide ?? {};
    const split = state.panes.length > 1;
    guide.innerHTML = `<div class="guide-in">
      <div class="guide-head">
        <div><p class="eyebrow">${split ? `${state.active === 0 ? 'A 栏' : 'B 栏'} · ` : ''}操作指南</p><h2><span data-i18n-ignore>${esc(r.title)}</span></h2><p data-i18n-ignore class="guide-model"><span data-i18n-ignore>${esc(label(r))}</span></p></div>
        <button class="icon-btn" data-v="guide" aria-label="收起指南">${icon('close')}</button>
      </div>
      ${r.summary ? `<p class="guide-summary"><span data-i18n-ignore>${esc(r.summary)}</span></p>` : ''}
      ${workFacts(r)}${usageBlock(r, t, { entry: metrics?.supported === true })}
      ${platform.available ? `<div class="guide-block"><h3>表情</h3>${reactionBar(workKey(t, r), { locked: !interactive(r) }) || '<p class="fine">存疑作品不再接受互动。</p>'}</div>` : ''}
      ${g.presets?.length ? `<div class="guide-block"><h3>快速跳转</h3>
        <div class="presets">${g.presets.map((p) => `<button class="chip${state.queries[state.active] === p.query ? ' on' : ''}" data-preset="${esc(p.query)}"><span data-i18n-ignore>${esc(p.label)}</span></button>`).join('')}
        <button class="chip ghost" data-preset="">默认</button></div></div>` : ''}
      ${(g.sections ?? []).map((s) => `<div data-i18n-ignore class="guide-block"><h3>${esc(s.title)}</h3><dl class="keys">${s.items.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div>`).join('')}
      ${g.tips?.length ? `<div class="guide-block"><h3>看点</h3><ul data-i18n-ignore class="tips">${g.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      <div class="guide-block"><h3>本站快捷键</h3><dl class="keys">
        <div><dt>← / →</dt><dd>切换作品</dd></div>
        <div><dt>G · S · F</dt><dd>指南 · 并排 · 全屏</dd></div>
        <div><dt>R</dt><dd>重新载入当前栏</dd></div></dl>
        <p class="fine">点击场景后键盘会交给场景本身；点一下顶栏即可恢复本站快捷键。</p></div>
      <div class="guide-links">
        <a class="btn sm" href="${taskHref(t)}#shots">截图对照</a>
      </div>
    </div>`;
  }

  function sync() {
    const split = state.panes.length > 1;
    el.classList.toggle('split', split);
    el.classList.toggle('guide-open', state.guide);
    $$('.pane', stage).forEach((p, i) => p.classList.toggle('active', split && i === state.active));
    $$('.pane', stage).forEach((p, i) => drawPaneUsage(p, byId(state.panes[i])));
    const current = byId(state.panes[state.active]);
    $('.vselect', el).value = current.id;
    const m = modelOf(current);
    $('.vmark', el).innerHTML = m.logo ? `<img src="${esc(versionedMedia(m.logo))}" alt="">` : '';
    $('[data-v="guide"]', el).setAttribute('aria-pressed', String(state.guide));
    $('[data-v="split"]', el)?.setAttribute('aria-pressed', String(split));
    const open = $('[data-v="open"]', el);
    if (current.scene) open.href = workFrameUrl(current.scene, state.queries[state.active]);
    else open.removeAttribute('href');
    renderGuide();
  }

  function navigate(panes, active = state.active) {
    state.active = Math.min(active, panes.length - 1);
    const hash = viewHref(t, panes[0], panes[1]);
    if (location.hash !== hash) history.replaceState(history.state, '', hash);
    update(panes);
  }

  function update(panes) {
    const before = state.panes;
    if (panes.length === 1 && before.length === 2 && before.includes(panes[0])) {
      // Closing either comparison pane keeps the surviving document and its WebGL state.
      // Removing its sibling avoids detaching or moving the live iframe, which reloads it.
      const kept = before.indexOf(panes[0]);
      const section = $(`[data-pane="${kept}"]`, stage);
      const stop = frameLoads.get(kept);
      frameLoads.get(1 - kept)?.();
      frameLoads.clear();
      if (stop) frameLoads.set(0, stop);
      controls.clear();
      $(`[data-pane="${1 - kept}"]`, stage).remove();
      section.dataset.pane = '0';
      $('.pane-tag', section).textContent = 'A';
      $('[data-pane-pick]', section).dataset.panePick = '0';
      $('[data-pane-pick]', section).setAttribute('aria-label', '左栏的作品');
      $('[data-close]', section).dataset.close = '0';
      $$('[data-pane-variant]', section).forEach((button) => { button.dataset.paneVariant = '0'; });
      $$('[data-pane-reload]', section).forEach((button) => { button.dataset.paneReload = '0'; });
      state.queries = [state.queries[kept] ?? ''];
      state.panes = panes;
    } else if (panes.length !== before.length) {
      clearFrameLoads();
      controls.clear();
      if (panes.length > 1) controls.hide();
      stage.innerHTML = panes.map((_, i) => paneHtml(i)).join('');
      state.queries = panes.map((id, i) => (before[i] === id ? state.queries[i] ?? '' : ''));
      state.panes = panes;
      panes.forEach((_, i) => load(i));
    } else {
      panes.forEach((id, i) => {
        if (before[i] === id) return;
        state.panes[i] = id;
        state.queries[i] = '';
        load(i);
      });
    }
    state.active = Math.min(state.active, panes.length - 1);
    sync();
  }

  const cycle = (d) => {
    const ids = sortedResults(t).map((r) => r.id);
    const panes = [...state.panes];
    let i = ids.indexOf(panes[state.active]);
    do i = (i + d + ids.length) % ids.length; while (panes.length > 1 && panes.includes(ids[i]) && ids.length > 2);
    panes[state.active] = ids[i];
    navigate(panes);
  };
  const toggleGuide = () => {
    state.guide = !state.guide;
    if (wide()) store.set('guide', state.guide ? '1' : '0');
    sync();
  };
  const toggleSplit = () => {
    if (state.panes.length > 1) return navigate([state.panes[state.active]], 0);
    const other = sortedResults(t).find((r) => r.id !== state.panes[0]);
    if (other) navigate([state.panes[0], other.id], 1);
  };
  const reload = () => load(state.active);
  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.().catch(() => {});
  };

  el.addEventListener('click', (e) => {
    const retry = e.target.closest('[data-pane-reload]');
    if (retry) return load(Number(retry.dataset.paneReload));
    const variant = e.target.closest('[data-pane-variant]');
    if (variant && variant.dataset.variantResult) {
      const i = Number(variant.dataset.paneVariant), panes = [...state.panes];
      panes[i] = variant.dataset.variantResult;
      return navigate(panes, i);
    }
    const v = e.target.closest('[data-v]')?.dataset.v;
    if (v === 'exhibition') { location.hash = sandtableHref(t, state.panes); return; }
    if (v === 'guide') return toggleGuide();
    if (v === 'split') return toggleSplit();
    if (v === 'controls') return controls.toggle();
    if (v === 'full') return fullscreen();
    if (v === 'prev') return cycle(-1);
    if (v === 'next') return cycle(1);
    if (e.target.closest('[data-usage-edit]')) {
      const r = byId(state.panes[state.active]);
      openUsageSheet({ ...r, task: t.id });
      return;
    }
    const face = e.target.closest('[data-face]');
    if (face) {
      const r = byId(state.panes[state.active]);
      const [, faces, done] = VIEWER_FACES[face.dataset.face];
      face.disabled = true;
      setFaces(t.id, r.id, faces).then(() => { toast(`${done}：${r.title}`); return refreshPlatform('review'); },
        (error) => { toast(error.message); face.disabled = false; });
      return;
    }
    const preset = e.target.closest('[data-preset]');
    if (preset) {
      state.queries[state.active] = preset.dataset.preset;
      load(state.active);
      return sync();
    }
    const close = e.target.closest('[data-close]');
    if (close) {
      const keep = state.panes.filter((_, i) => i !== Number(close.dataset.close));
      return navigate(keep, 0);
    }
    const pane = e.target.closest('[data-pane]');
    if (pane && Number(pane.dataset.pane) !== state.active) {
      state.active = Number(pane.dataset.pane);
      sync();
    }
  });
  el.addEventListener('change', (e) => {
    if (e.target.matches('.vselect')) {
      const panes = [...state.panes];
      panes[state.active] = e.target.value;
      navigate(panes);
    } else if (e.target.matches('[data-pane-pick]')) {
      const i = Number(e.target.dataset.panePick);
      const panes = [...state.panes];
      panes[i] = e.target.value;
      navigate(panes, i);
    }
  });
  // Clicking into a frame does not bubble; focus moving into it marks that pane active.
  const onBlur = () => {
    clearTimeout(blurTimer);
    blurTimer = setTimeout(() => {
      const frame = document.activeElement;
      if (frame?.tagName !== 'IFRAME') return;
      if (!stage.contains(frame)) return;
      const i = Number(frame.closest('[data-pane]')?.dataset.pane);
      if (state.panes.length > 1 && i !== state.active) { state.active = i; sync(); }
    });
  };
  window.addEventListener('blur', onBlur);
  const onKey = (e) => {
    if (lightbox.isOpen || e.metaKey || e.ctrlKey || e.altKey || e.target.matches('input, select, textarea')) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowleft') cycle(-1);
    else if (k === 'arrowright') cycle(1);
    else if (k === 'g') toggleGuide();
    else if (k === 's' && many) toggleSplit();
    else if (k === 'f') fullscreen();
    else if (k === 'r') reload();
    else if (k === 'escape' && state.guide && !wide()) toggleGuide();
    else return;
    e.preventDefault();
  };
  document.addEventListener('keydown', onKey);
  // Usage, artifact sizes and the administrators' entry come with the metrics; the first preview of a
  // visit asks for them and redraws the pane lines and the guide once they are laid on the works.
  let gone = false;
  if (!metrics) void loadMetrics().then((info) => {
    if (gone || !info.supported || !state.panes.length) return;
    $$('.pane', stage).forEach((p, i) => drawPaneUsage(p, byId(state.panes[i])));
    renderGuide();
  });

  return {
    task: t,
    update,
    fullscreen: true,
    // Review state or reactions changed elsewhere; the frames stay as they are.
    onPlatformChange() {
      $('.vselect', el).innerHTML = options();
      $$('[data-pane-pick]', stage).forEach((select) => { select.innerHTML = options(); });
      const panes = state.panes.filter(byId);
      if (!panes.length) { location.hash = taskHref(t); return; }
      if (panes.length !== state.panes.length) return navigate(panes, 0);
      $$('[data-pane-pick]', stage).forEach((select, i) => { select.value = state.panes[i] ?? state.panes[0]; });
      sync();
    },
    destroy() {
      gone = true;
      clearFrameLoads();
      clearTimeout(blurTimer);
      themeObserver.disconnect();
      removeEventListener('message', onAudioMessage);
      controls.destroy();
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onBlur);
      document.body.classList.remove('is-viewer');
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    },
  };
}

// ---- router ---------------------------------------------------------------------------
function notFound(msg) {
  setPageTitle(['找不到页面', DATA.title]);
  root.innerHTML = `${header()}<main class="page wrap empty-page">${draftOrnamentHtml('is-empty-corner')}<p class="kicker"><span class="num">404</span></p><h1>找不到页面</h1><p>${esc(msg)}</p><a class="btn primary" href="#/">回到首页${icon('right')}</a></main>`;
}

// Platform pages live in their own modules and need the server; task ids never use these names.
// dimensions is the guided trial's staff chart and exists only in GUIDED_VOTING builds (see guidedTrial).
const PLATFORM_PAGES = { arena: './arena.js', leaderboard: './leaderboard.js', changelog: './changelog.js', team: './team.js', new: './publish.js', exam: './exam.js', submit: './submit.js', me: './account.js', review: './account.js', dimensions: './dimensions.js' };
const PAGE_TITLES = { arena: '盲评', leaderboard: '榜单', changelog: '更新日志', team: '开发者团队', new: '发起题目', exam: '资格考试', submit: '上传作品', me: '个人中心', review: '审核', dimensions: '维度图' };
const PAGE_SECTIONS = { arena: 'arena', leaderboard: 'leaderboard', changelog: '', team: '', new: 'new', exam: 'new', submit: 'questions', me: 'me', review: 'me', dimensions: 'arena' };
const guidedTrial = () => globalThis.SAME_PROMPT_CONFIG?.guidedVoting === true;
// The closed-book 后端 section belongs to the guided trial build only.
const libraryCategories = () => CATEGORIES.filter((c) => c.judging !== 'benchmark' || guidedTrial()).map((c) => c.name);
// A pointer resting on a link to one of these pages (or a finger landing on it) starts fetching the
// page's code, so the click usually finds it ready.
const warmed = new Set();
function warmPage(event) {
  const href = event.target.closest?.('a[href^="#/"]')?.getAttribute('href');
  const name = href ? routeParts(href)?.[0] : null;
  if (!name || !Object.hasOwn(PLATFORM_PAGES, name) || warmed.has(name)) return;
  warmed.add(name);
  import(PLATFORM_PAGES[name]).catch(() => warmed.delete(name));
}
for (const type of ['pointerover', 'touchstart', 'focusin']) document.addEventListener(type, warmPage, { passive: true });
function platformOffline(name) {
  const missing = catalogState() === 'static';
  const needsActivity = name === 'arena';
  const error = !platform.available ? platform.connectionError : !platform.sessionReady ? platform.sessionError : needsActivity ? platform.activityError : null;
  const connecting = platform.connecting || platform.sessionConnecting || (needsActivity && platform.activityConnecting);
  const waiting = !missing && !platform.mismatch && (!error || connecting);
  const title = PAGE_TITLES[name] ?? '展览馆';
  // The page itself explains a version mismatch, so the header notice is not repeated.
  root.innerHTML = `${pageStart({ title, section: PAGE_SECTIONS[name], description: SIDE_MOTTO })}<section class="block wrap catalog-status" aria-busy="${waiting}">
    <h3>${platform.mismatch ? `${esc(title)}暂时不可用` : waiting ? `正在载入${esc(title)}…` : missing ? '这里需要平台服务' : `${esc(title)}暂时未能载入`}</h3>
    <p role="status">${platform.mismatch ? '作品数据与平台服务版本不一致。可能是新版本正在发布，稍后刷新即可恢复。' : waiting ? needsActivity ? '盲评与榜单统计正在加载，题库可先浏览。' : '账户信息正在加载，题库可先浏览。' : missing ? `当前地址没有可用的平台服务。连接后即可使用${esc(title)}，作品仍可浏览。` : esc(error?.message)}</p>
    <div class="empty-actions">${platform.mismatch ? '<button type="button" class="btn primary" data-reload>刷新页面</button>' : '<button type="button" class="btn primary" data-platform-retry>重新连接</button>'}<a class="btn" href="#/questions">回到题库${icon('right')}</a></div>
  </section>${pageEnd()}`;
  const button = $('[data-platform-retry]', root);
  if (!button) return {};
  const update = () => {
    const seconds = Math.max(0, Math.ceil(((error?.retryAt ?? 0) - Date.now()) / 1000));
    const busy = platform.connecting || platform.sessionConnecting || (needsActivity && platform.activityConnecting);
    button.disabled = busy || seconds > 0 || waiting;
    button.textContent = busy || waiting ? '正在连接…' : seconds ? `${seconds} 秒后可重试` : '重新连接';
  };
  update();
  const timer = setInterval(update, 1000);
  root.onclick = (event) => {
    if (!event.target.closest('[data-platform-retry]') || button.disabled) return;
    void refreshPlatform('reconnect');
    update();
  };
  return { awaitingSession: !platform.sessionReady, awaitingActivity: needsActivity && !platform.activityReady, destroy: () => clearInterval(timer) };
}

function catalogPending() {
  const state = catalogState(), failed = state === 'error';
  root.innerHTML = `${libraryStart([LIBRARY])}<div class="collection-heading"><h2>全部题目</h2></div><section class="block wrap catalog-status" data-catalog-state="${state}" aria-busy="${!failed}">
    <p role="status">${failed ? esc(platform.mismatch ? '页面版本已更新，请刷新后继续。' : platform.connectionError?.message) : '最新题目与作品正在加载…'}</p>
    ${failed ? platform.mismatch ? RELOAD : '<button class="btn" type="button" data-platform-reconnect>重新连接</button>' : ''}
    ${failed ? '' : `<div class="task-list catalog-skeleton" aria-hidden="true">${Array.from({ length: 6 }, () => '<div class="task-card"><div class="question-visual"></div><div class="task-body"><i></i><i></i><i></i></div></div>').join('')}</div>`}
  </section>${footer()}</main></div>`;
  const retry = $('[data-platform-reconnect]', root);
  const update = () => {
    if (!retry) return;
    const seconds = Math.max(0, Math.ceil(((platform.connectionError?.retryAt ?? 0) - Date.now()) / 1000));
    retry.disabled = platform.connecting || seconds > 0;
    retry.textContent = platform.connecting ? '正在连接…' : seconds ? `${seconds} 秒后可重试` : '重新连接';
  };
  update();
  const timer = retry ? setInterval(update, 1000) : null;
  return { destroy() { if (timer) clearInterval(timer); } };
}

// ---- the way back ---------------------------------------------------------------------
// A sub-page's way back always leads one level up, the same page its breadcrumb names: on wide
// screens that crumb is the way back, on narrow ones a "返回" takes its place. When the page above
// is earlier in this tab's history, it goes back there for real and keeps its filters and scroll.
const PAGE_NAMES = { questions: '题库', arena: '盲评' };
function placeOf(hash) {
  const [p = '', a] = (routeParts(hash) ?? [hash]);
  const t = DATA.tasks.find((x) => x.id === p);
  if (t && !a) return { key: p, name: '题目', up: benchmarkTask(t) ? `${LIBRARY.href}/${encodeURIComponent(t.category)}` : LIBRARY.href };
  if (t) return { key: a === 'exhibition' || a === 'sandtable' ? `${p}/stage` : `${p}/view`, up: taskHref(t) };
  if (p === 'submit' && DATA.tasks.some((x) => x.id === a)) return { key: `submit/${a}`, up: `#/${a}` };
  if (p === 'arena' && a) return { key: `arena/${a}`, up: '#/arena' };
  // The library's form, domain and model index ride in its address but leave it the same page.
  const key = p === 'questions' ? p : [p, a].filter(Boolean).join('/');
  return { key, name: PAGE_NAMES[p], up: null };
}
// Keep each history entry, including forward entries, so browser traversal keeps its origin and scroll.
const visits = new Map();
let currentVisit = null;
let nextVisit = Date.now();
let back = null;
// Returns the scroll position to restore (the page's own when the reader went back to it) and
// whether this is such a return.
function retrace(from) {
  const here = placeOf(location.hash);
  // The page being left is still on screen, so its address and scroll are taken as it goes.
  if (from && currentVisit) Object.assign(visits.get(currentVisit), { hash: new URL(from).hash || '#/', scroll: scrollY });
  const visit = history.state?.visit;
  let entry = visits.get(visit);
  const returning = entry?.key === here.key;
  if (!returning) {
    // `from` is the history entry just before this one, when this visit followed a link from it.
    nextVisit = Math.max(nextVisit, visit ?? 0);
    entry = { key: here.key, visit: visit ?? ++nextVisit, from: visit ? null : currentVisit, scroll: 0 };
    visits.set(entry.visit, entry);
    if (!visit) history.replaceState({ ...history.state, visit: entry.visit }, '');
  }
  currentVisit = entry.visit;
  entry.hash = location.hash;
  resolveBack(entry, here);
  return { scroll: returning ? entry.scroll : 0, returning };
}
function resolveBack(entry, here) {
  entry.key = here.key;
  // Each visit's `from` is the history entry just before it, so walking them counts the steps back.
  back = null;
  if (here.up) {
    const above = placeOf(here.up);
    let prev = visits.get(entry.from), steps = 1;
    while (prev && prev.key !== above.key) { prev = visits.get(prev.from); steps++; }
    back = { up: here.up, text: above.name, href: prev?.hash ?? here.up, steps: prev ? steps : 0 };
  }
}
history.scrollRestoration = 'manual';
const plainClick = (event) => !event.defaultPrevented && !event.button && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
addEventListener('click', (event) => {
  if (!plainClick(event)) return;
  if (back?.steps && event.target.closest('.top-back, .vback, [data-back]')) {
    event.preventDefault();
    history.go(-back.steps);
    return;
  }
  // The exhibition and the sandtable are two views of one place, like the task page's panels.
  const mode = event.target.closest('[data-switch-mode]');
  if (mode) {
    event.preventDefault();
    const from = location.href;
    history.replaceState(history.state, '', mode.getAttribute('href'));
    route({ from });
  }
});
// "返回" names the page above it; the viewers keep it at every width, the other pages on narrow screens.
function backLink(cls) {
  return back ? `<a class="${cls}" href="${esc(back.href)}" title="返回${esc(back.text)}">${icon('prev')}<span class="back-text">返回<span class="back-place">${esc(back.text)}</span></span></a>` : '';
}

// Everything a platform page needs from the gallery.
const context = () => ({ DATA, heroArchive, backLink, MODELS, HARNESSES, PROVIDERS, header, footer, pageStart, sideNav, LIBRARY, pageEnd, label, modelOf, vendorOf, harnessOf, providerOf, sourceLine, cover, coverHtml, resultBadges, exhibitedModels, modelKey, entryKey, loadMetrics, taskHref, viewHref, workKey, interactive, inGallery, settleImages, packagedWork });

// The data pack holds its questions' assets: screenshots, scenes, models and capture conditions.
// The API decides which questions and works are public and holds their current fields; without
// it the pack is shown as an archive. Task and work objects stay the same across merges.
let PACK = new Map();
// The published package is an illustration source for the home hero only. It
// never populates the live catalog or the blind pool while the API is loading.
const heroArchive = () => [...PACK.values()].map(({ task, works }) => ({ ...task, results: [...works.values()] }));
const tasksById = new Map(), resultsByKey = new Map();
const packagedWork = (task, id) => PACK.get(task)?.works.get(id) ?? null;
// Fields a work keeps when the pack has none for it.
const UNPACKED = { source: null, readme: null, sourceLabel: '', captureNote: '', guide: {}, previewModel: null, previewLoader: null };
function resultOf(pack, w) {
  if (!platform.available) return { ...pack, status: 'verified' };
  return {
    ...(pack ?? UNPACKED),
    id: w.id,
    status: w.status,
    reason: w.reason ?? '',
    author: w.author,
    mine: w.mine,
    model: w.model ?? `x:${w.modelName}`,
    modelName: w.modelName,
    vendorName: w.vendor,
    effort: w.effort ?? '',
    tool: w.tool,
    harness: w.harness,
    harnessName: w.harnessName,
    provider: w.provider,
    providerName: w.providerName,
    promptVariant: w.promptVariant ?? pack?.promptVariant,
    generationMode: w.generationMode,
    humanIntervention: w.humanIntervention,
    note: w.note,
    title: w.title,
    summary: w.summary ?? '',
    addedAt: w.addedAt ?? pack?.addedAt,
    scene: w.scene ?? pack?.scene,
    previewModel: w.previewModel ?? pack?.previewModel ?? null,
    previewPoster: w.previewPoster ?? pack?.previewPoster ?? null,
    previewMode: w.previewMode ?? pack?.previewMode,
    previewCapture: w.previewCapture ?? pack?.previewCapture,
    gallery: pack?.gallery ?? (w.cover ? [{ src: w.cover, caption: '作者提供的封面' }] : []),
    captures: w.captures ?? pack?.captures ?? {},
    files: w.files,
    bytes: w.bytes,
    arena: w.arena,
    aiScore: w.aiScore ?? pack?.aiScore ?? null,
  };
}
function stable(map, key, fresh) {
  const kept = map.get(key);
  if (!kept) { map.set(key, fresh); return fresh; }
  for (const name of Object.keys(kept)) if (!Object.hasOwn(fresh, name)) delete kept[name];
  return Object.assign(kept, fresh);
}
let mergedCatalog = null;
function mergePlatform() {
  mergedCatalog = { works: platform.works, questions: platform.questions, state: catalogState() };
  if (!['ready', 'static'].includes(catalogState())) { DATA.tasks = []; return; }
  const listed = platform.available ? new Map(catalogQuestionsForBuild(platform.questions, guidedTrial()).map((q) => [q.id, q])) : null;
  const listedWorks = new Map();
  if (listed) for (const work of platform.works) {
    if (!listedWorks.has(work.task)) listedWorks.set(work.task, []);
    listedWorks.get(work.task).push(work);
  }
  const ids = [...[...PACK.keys()].filter((id) => !listed || listed.has(id)), ...(listed ? [...listed.keys()].filter((id) => !PACK.has(id)) : [])];
  DATA.tasks = ids.map((id) => {
    const pack = PACK.get(id);
    const works = listed ? (listedWorks.get(id) ?? []) : [...pack.works.values()];
    // Reference images come from the API when it holds them, otherwise from the pack.
    const own = listed?.get(id)?.references?.length ? listed.get(id) : pack?.task;
    return stable(tasksById, id, {
      ...(pack?.task ?? { id, conditions: [], promptVariants: [] }),
      ...listed?.get(id),
      references: own?.references ?? [],
      referenceCredit: own?.referenceCredit ?? '',
      results: works.map((w) => stable(resultsByKey, `${id}/${w.id}`, resultOf(pack?.works.get(w.id), w))),
    });
  });
  layMetrics();
}

// Measured usage and artifact sizes come from their own read (GET /api/works/metrics), asked for only by
// pages that show them. They are laid onto the same work objects, so every view, and the blind test after
// a reveal, reads r.usage and r.artifact; a catalog merge rebuilds the works, so they are laid again.
let metrics = null, metricsLaid = null;
function layMetrics() {
  if (!metrics || !DATA) return;
  for (const t of DATA.tasks) for (const r of t.results) {
    r.usage = metrics.usage[t.id]?.[r.id] ?? null;
    r.artifact = metrics.artifact[t.id]?.[r.id] ?? null;
  }
}
const loadMetrics = () => (metricsLaid ??= metricsInfo().then((info) => { metrics = info; layMetrics(); return info; }));

let page = null;
let routeVersion = 0;
// Following a link is one view transition: the old screen stays up while the new page draws and
// gathers its first data, for at most HOLD, then the two cross-fade. The top bar and the sidebar
// keep their own layers (studio.css), so an unchanged shell stays still. Past HOLD the page shows
// its own loading state and fills in when the data arrives. The opening card giving way to the first
// page, and a loading screen to its page, cross-fade the same way (motion.js).
const HOLD = 300;
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
// `from` is the address being left; a redraw in place (sign-in, a review) passes none, and the
// first route of a visit passes ''.
async function route({ keepScroll = false, from = null } = {}) {
  const version = ++routeVersion;
  const visit = keepScroll || from === null ? null : retrace(from);
  // Direct links enter before the catalog identifies their question. Reuse the
  // visit when a redraw can finally resolve its parent.
  if (!visit && currentVisit && currentVisit === history.state?.visit) resolveBack(visits.get(currentVisit), placeOf(location.hash));
  const scrollBack = keepScroll ? scrollY : visit?.scroll ?? 0;
  // The page's items rise in on arrival and a card's picture can carry over into the viewer (motion.js).
  const motion = scene(root, { navigation: from !== null, from });
  const viaTransition = Boolean(motion.transition && document.startViewTransition && document.visibilityState === 'visible');
  let drawing;
  if (viaTransition) {
    motion.leave();
    // A newer route or a theme switch skips this transition; the page is drawn all the same. HOLD
    // bounds the whole wait, so a page still fetching its code cross-fades in with its own loading
    // state rather than leaving the old screen frozen.
    const transition = document.startViewTransition(async () => {
      drawing = show(version, visit, scrollBack);
      const started = performance.now();
      const drawn = await Promise.race([drawing, delay(HOLD)]);
      if (drawn) await Promise.race([drawn.ready, delay(Math.max(0, HOLD - (performance.now() - started)))]);
      if (version === routeVersion) motion.arrive();
    });
    transition.ready.then(motion.play, motion.play);
    transition.finished.then(motion.settle, motion.settle);
    await transition.updateCallbackDone.catch(() => {});
  } else drawing = show(version, visit, scrollBack);
  const shown = viaTransition ? await drawing?.catch(() => {}) : await drawing;
  if (version === routeVersion) {
    motion.arrive();
    if (!viaTransition) motion.play();
  }
  if (version !== routeVersion || !shown?.ready) return motion.done();
  // A page that loads its data is only as tall as its loading state at first, so the way back
  // lands its scroll again once the data is drawn, unless the reader has scrolled meanwhile.
  const landed = scrollY;
  await shown.ready.catch(() => {});
  motion.done();
  if (version !== routeVersion) return;
  settleImages();
  if (shown.scrolls && scrollBack && scrollY === landed) scrollTo(0, scrollBack);
  motion.arrive();
}

// Every address shows one page. A page is whatever its renderer returns, all fields optional:
//   ready             a promise for its first data (route waits on it, see above)
//   fullscreen        it keeps its own scroll
//   onPlatformChange  it redraws itself when the session or reviews change; without it the
//                     router draws the page again in place
//   destroy           it lets go of timers, listeners and frames
// Pages may also set root.on* handlers; tearing a page down clears them.
function teardown(options) {
  page?.destroy?.(options);
  page = null;
  root.onclick = root.onchange = root.oninput = root.onsubmit = root.onkeydown = root.onpointerover = root.onfocusin = null;
  lightbox.close();
}

// Tears down the page on screen and draws the one at the address. Resolves to nothing when a
// newer route has taken over.
async function show(version, visit, scrollBack) {
  if (version !== routeVersion) return;
  const parts = routeParts(location.hash);
  const [taskId, a, vs, b] = parts ?? [];
  const platformPage = Object.hasOwn(PLATFORM_PAGES, taskId ?? '') && (taskId !== 'dimensions' || guidedTrial()) ? taskId : null;
  const t = platformPage ? null : DATA.tasks.find((x) => x.id === taskId);
  const inExhibition = t && hasExhibition(t) && (a === 'exhibition' || a === 'sandtable');
  // #/<task>/usage and #/<task>/cost open the task page on its usage view (unless a work has that id).
  const inUsage = t && !vs && (a === 'usage' || a === 'cost') && !t.results.some((r) => r.id === a);
  const inViewer = t && a && !inExhibition && !inUsage;
  // Home counts come from the public catalog. Authoring, legal and exam pages use their
  // own session/data reads; fetch shared reactions and pools only where they are shown.
  const accountActivity = taskId === 'me' ? a === 'works'
    : taskId === 'review' && !['members', 'log'].includes(a);
  void setActivityNeeded(Boolean(parts && (['questions', 'arena', 'leaderboard'].includes(taskId) || accountActivity || (t && !inExhibition))));
  const ids = inViewer ? [a, vs === 'vs' ? b : null].filter(Boolean) : [];
  const works = ids.filter((id, i) => t.results.some((r) => r.id === id) && ids.indexOf(id) === i);

  // The viewer stays up while the address moves between works of its task, so switching one pane
  // does not reload the other.
  if (!parts) {
    teardown();
    notFound('路径参数编码无效');
  } else if (!taskId && page?.home) {
    refreshAccountControls();
    page.onPlatformChange();
  } else if (works.length && page?.task === t && page.update) page.update(works);
  else {
    // Session/activity arrivals redraw the same task. Its public score read belongs
    // to that task, while leaving it (including a withdrawal) still cancels the read.
    teardown({ keepTaskScores: Boolean(t && !inViewer && !inExhibition && page?.scoreTask === t.id) });
    if (!taskId) page = renderLanding(root, context());
    else if (!['ready', 'static'].includes(catalogState()) && !['terms', 'privacy'].includes(taskId)) page = platformPage ? platformOffline(platformPage) : catalogPending();
    else if (taskId === 'questions') page = renderLibrary(parts.slice(1), Boolean(visit && !visit.returning));
    else if (taskId === 'terms' || taskId === 'privacy') page = renderLegal(root, context(), taskId);
    else if (platformPage) {
      if ((platformPage !== 'team' && !platform.available) || (!['leaderboard', 'changelog', 'team'].includes(platformPage) && !platform.sessionReady) || (platformPage === 'arena' && !platform.activityReady)) page = platformOffline(platformPage);
      else {
        root.innerHTML = `${header([{ text: PAGE_TITLES[platformPage] }], false, PAGE_SECTIONS[platformPage])}<main class="page wrap empty-page"><p class="muted">正在打开…</p></main>`;
        try {
          const module = await import(PLATFORM_PAGES[platformPage]);
          if (version !== routeVersion) return;
          page = module.mount(root, { ...context(), route: platformPage, param: a ?? null });
        } catch (error) {
          if (version !== routeVersion) return;
          root.innerHTML = `${header()}<main class="page wrap empty-page"></main>`;
          void showLoadFailure($('main', root), error, '页面加载失败', '<a class="btn" href="#/">回到首页</a>');
        }
      }
    } else if (!t && !initialPlatformSettled) {
      root.innerHTML = `${header([{ text: '题库' }], false, 'questions')}<main class="page wrap empty-page"><p class="muted" role="status">正在载入题目…</p></main>`;
    } else if (!t) notFound(`没有 id 为「${taskId}」的题目。`);
    else if (inExhibition) {
      root.innerHTML = `${galleryStageHeader(t, a)}<main class="page empty-page wrap"><p class="muted">正在打开预览…</p></main>`;
      try {
        const create = a === 'sandtable'
          ? (await import('./sandtable.js')).createSandtable
          : (await import('./exhibition.js')).createExhibition;
        if (version !== routeVersion) return;
        const staged = hostedTask(t);
        const stage = create(root, staged, { label, vendorOf, cover, header: galleryStageHeader(t, a), initial: (vs ?? '').split(',').filter((id) => staged.results.some((r) => r.id === id)) });
        // The 3D views keep the works they opened with; a review elsewhere shows on the next visit.
        page = { task: t, destroy: () => stage.destroy(), onPlatformChange() {} };
      } catch (error) {
        if (version !== routeVersion) return;
        root.innerHTML = '<main class="empty-page wrap"></main>';
        void showLoadFailure($('main', root), error, '展厅加载失败', `<a class="btn" href="${taskHref(t)}">返回作品</a>`);
      }
    } else if (!inViewer) page = taskPage(t);
    else if (!works.length) notFound(`「${t.title}」下没有 id 为「${a}」的作品。`);
    else {
      page = createViewer(t);
      page.update(works);
    }
  }
  syncThemeUi();
  settleImages();
  const scrolls = !page?.fullscreen;
  if (scrolls) scrollTo(0, scrollBack);
  return { ready: page?.ready, scrolls };
}

// BewlyBewly-style floating topbar auto-hide: tucks up on downward scroll, glides back on upward scroll.
(() => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const rootEl = document.documentElement;
  let lastY = Math.max(0, window.scrollY || 0);
  let ticking = false;
  const setHidden = (hide) => rootEl.classList.toggle('is-topbar-hidden', hide);
  const canHide = () => {
    const bar = document.querySelector('#app > .topbar:not(.sandbar)');
    if (!bar) return false;
    if (bar.matches(':hover') || bar.matches(':focus-within')) return false;
    if (document.querySelector('.account-menu')) return false;
    const cl = document.body.classList;
    if (cl.contains('lb-open') || cl.contains('is-viewer') || cl.contains('has-prompt-modal')) return false;
    return true;
  };
  const update = () => {
    ticking = false;
    const y = Math.max(0, window.scrollY || 0);
    rootEl.classList.toggle('is-topbar-scrolled', y > 10);
    if (y <= 36) {
      setHidden(false);
      lastY = y;
      return;
    }
    const dy = y - lastY;
    if (dy >= 8 && y > 72 && canHide()) {
      setHidden(true);
      lastY = y;
    } else if (dy <= -6) {
      setHidden(false);
      lastY = y;
    } else if (!canHide()) {
      setHidden(false);
      lastY = y;
    }
  };
  addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  addEventListener('mousemove', (e) => {
    if (e.clientY <= 22 && rootEl.classList.contains('is-topbar-hidden')) setHidden(false);
  }, { passive: true });
  addEventListener('hashchange', () => {
    lastY = 0;
    rootEl.classList.remove('is-topbar-scrolled');
    setHidden(false);
  });
})();

// Signing in or out, a review or an upload: merge the new state and redraw what shows it.
onPlatformChange((reason) => {
  if (!DATA) return;
  refreshAccountControls();
  // A lightweight account check leaves the public catalog alone. A session
  // refresh can also fetch a new catalog (e.g. after logout), which must merge.
  const sessionOnly = ['session', 'session-ready'].includes(reason);
  const sameCatalog = mergedCatalog?.works === platform.works && mergedCatalog?.questions === platform.questions && mergedCatalog?.state === catalogState();
  if (sessionOnly && sameCatalog && !page?.awaitingSession && !page?.fullscreen) return;
  mergePlatform();
  if (page?.task && !DATA.tasks.includes(page.task)) { void route({ keepScroll: true }); return; }
  const activeRoute = location.hash.replace(/^#\/?/, '').split('/')[0];
  if (reason === 'identity' && ['new', 'submit', 'me', 'review'].includes(activeRoute)) { void route({ keepScroll: true }); return; }
  if (sessionOnly && !page?.awaitingSession && !page?.home && !page?.fullscreen) return;
  if (reason === 'activity' && ['new', 'submit'].includes(location.hash.replace(/^#\/?/, '').split('/')[0]) && !page?.awaitingActivity) return;
  if (page?.onPlatformChange) return page.onPlatformChange(reason);
  route({ keepScroll: true });
});

try {
  const requests = requestPlatform();
  const res = await (bootRead('data') ?? fetch('data.json', { cache: 'no-cache', signal: AbortSignal.timeout(15000) }));
  if (res.status === 429) {
    const error = new Error('请稍后刷新页面。');
    error.status = 429;
    throw error;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  DATA = await res.json();
  PACK = new Map(catalogQuestionsForBuild(DATA.tasks, guidedTrial())
    .map(({ results, ...task }) => [task.id, { task, works: new Map(results.map((r) => [r.id, r])) }]));
  // 媒体缓存钥匙：数据包提交号前 8 位，nginx 长缓存依赖它换包失效。
  globalThis.SAME_PROMPT_CONFIG.assetVersion ??= DATA.buildInfo?.datapack?.slice(0, 8) ?? '';
  MODELS = new Map(DATA.models.map((m) => [m.id, m]));
  resolveModel = modelResolver(DATA.models);
  HARNESSES = new Map((DATA.harnesses ?? []).map((h) => [h.id, h]));
  PROVIDERS = new Map([['official', { id: 'official', name: '官方', listed: true }], ['unofficial', { id: 'unofficial', name: '非官方', listed: true }]]);
  mergePlatform();
  const platformConnection = connectPlatform(DATA.buildInfo, requests);
  platformConnection.catch(() => {});
  addEventListener('hashchange', (event) => route({ from: event.oldURL }));
  await route({ from: '' });
  // Amounts appear only once the server says so; then the gallery, preview or blind vote on screen is
  // redrawn with them. Forms (upload, account, review) refresh their own usage blocks instead.
  void loadPricing().then((pricing) => {
    const where = location.hash.replace(/^#\/?/, '').split('/')[0];
    if (!costShown(pricing) || ['new', 'submit', 'me', 'review'].includes(where)) return;
    if (page?.onPlatformChange) page.onPlatformChange('pricing'); else route({ keepScroll: true });
  });
  void startAnnouncements();
  // Enter the page frame while each work area loads its own data.
  const homeArrival = window.ArenaEntry?.ready(root, { prepareImages: deferredMedia.prepare });
  await platformConnection;
  initialPlatformSettled = true;
  if (!platform.available && resultSort === 'score') resultSort = 'added';
  mergePlatform();
  if (!back) {
    const here = placeOf(location.hash);
    if (here.up) back = { up: here.up, text: placeOf(here.up).name, href: here.up, steps: 0 };
  }
  // A mounted review already owns its arrival read; preserve it across startup settling.
  if (page?.review && /^#\/?review(?:\/|$)/.test(location.hash)) refreshAccountControls();
  else await route({ keepScroll: true });
  await (homeArrival ?? window.ArenaEntry?.ready(root, { prepareImages: deferredMedia.prepare }));
  startPlatformRecovery();
} catch (err) {
  window.ArenaEntry?.fail();
  const message = err.name === 'TimeoutError' ? '连接超时，请重试。' : err.message;
  root.innerHTML = err.status === 429
    ? `<main class="wrap empty-page">${languageButton()}<h1>访问较频繁</h1><p>${esc(err.message)}</p></main>`
    : `<main class="wrap empty-page">${languageButton()}<h1>数据加载失败</h1><p>${esc(message)}</p><div class="empty-actions">${RELOAD}</div></main>`;
}
