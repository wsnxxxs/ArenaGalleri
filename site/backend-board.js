import { $, brandMark, esc, icon, pad, store } from './ui.js';
import { api } from './platform.js';
import { textMatches } from './match.js';
import { formatTokens } from './usage.js';

export const BACKEND_TIERS = [
  { tier: 'EZ', slug: 'ez', name: '基础维护卷', weight: 1, languages: ['Python'], languageLabel: 'Python', status: '头部基本解决' },
  { tier: 'HD', slug: 'hd', name: '底层系统卷', weight: 2, languages: ['Go', 'C'], languageLabel: 'Go + C', status: '头部基本解决' },
  { tier: 'IN', slug: 'in', name: '高耦合排障卷', weight: 1, languages: ['Python'], languageLabel: 'Python', status: '深水区分化' },
  { tier: 'AT', slug: 'at', name: '架构演进卷', weight: 2, languages: ['Python'], languageLabel: 'Python', status: '头部基本解决' },
];

const TIER_MAP = new Map(BACKEND_TIERS.map((item) => [item.tier, item]));
const UNRELIABLE_STORE_KEY = 'backend-board-show-unreliable';

export function backendTierMeta(tier) {
  const key = String(tier ?? '').trim().toUpperCase();
  return TIER_MAP.get(key) ?? null;
}

const num = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const formatScore = (value, digits = 2) => (value == null ? '—' : value.toFixed(digits));
const rowName = (row) => String(row?.name ?? row?.modelName ?? row?.model ?? '').trim();
const isUnreliableRow = (row) => Boolean(row?.unreliable || row?.status === 'unreliable');
function rowNote(row, isTier = false) {
  const direct = String(row?.note ?? row?.missing ?? row?.remark ?? '').trim();
  if (direct) return direct;
  if (isTier) return '';
  if (Array.isArray(row?.hours) && row.hours.length === 4) {
    return row.hours.map((h) => `${h}h`).join(' / ');
  }
  const parts = [];
  const timeoutTiers = [];
  for (const code of ['EZ', 'HD', 'IN', 'AT']) {
    const n = String(row?.[`${code.toLowerCase()}Note`] ?? '').trim();
    if (!n) continue;
    if (n === '超时熔断') timeoutTiers.push(code);
    else parts.push(`${code}: ${n}`);
  }
  if (timeoutTiers.length) parts.unshift(`${timeoutTiers.join('/')} 超时熔断`);
  return parts.join(' · ');
}

function tierScore(row, code) {
  const raw = row?.scores?.[code] ?? row?.tiers?.[code] ?? row?.parts?.[code] ?? row?.[code] ?? row?.[code.toLowerCase()];
  if (raw && typeof raw === 'object') return num(raw.score ?? raw.value);
  return num(raw);
}

function compositeTotal(row) {
  const explicit = num(row?.total600 ?? row?.totalScore ?? row?.compositeScore ?? row?.total ?? row?.score);
  if (explicit != null) return explicit;
  const parts = BACKEND_TIERS.map((t) => ({ weight: t.weight, score: tierScore(row, t.tier) }));
  if (parts.every((p) => p.score != null)) {
    return parts.reduce((sum, p) => sum + p.score * p.weight, 0);
  }
  return null;
}

function formatTokenValue(row, isTier = false) {
  const millions = num(isTier ? (row?.tokensM ?? row?.totalTokensM) : (row?.totalTokensM ?? row?.tokensM));
  if (millions != null) return `${millions.toFixed(2)}M`;
  const raw = isTier ? (row?.tokens ?? row?.totalTokens ?? row?.token) : (row?.totalTokens ?? row?.tokens ?? row?.token);
  if (typeof raw === 'string' && raw.trim()) return esc(raw.trim());
  const n = num(raw);
  return n == null ? '—' : esc(formatTokens(n));
}

function formatBrs(row) {
  const raw = row?.brs ?? row?.brsHealth ?? row?.health ?? row?.diffHealth;
  if (raw == null || raw === '') return '—';
  if (typeof raw === 'object') {
    const label = raw.label ?? raw.status ?? '';
    const value = raw.value ?? raw.score;
    if (label && value != null) return `${esc(label)} · ${esc(value)}`;
    return esc(label || value || '—');
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const pct = raw > 0 && raw <= 1 ? raw * 100 : raw;
    return `${Number(pct.toFixed(1))}%`;
  }
  return esc(String(raw));
}

function scoreBar(score, max) {
  if (score == null || !(max > 0)) return '';
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  return `<span class="range backend-range" aria-hidden="true"><i style="left:0;width:${pct.toFixed(2)}%;background:linear-gradient(90deg, var(--ink), var(--accent))"></i><em style="left:${pct.toFixed(2)}%"></em></span>`;
}

function languagePills(languages) {
  return (languages ?? []).map((lang) => `<span class="tag-lang" data-i18n-ignore>${esc(lang)}</span>`).join('');
}

function backendNotes(isTier) {
  return `<details class="board-notes">
    <summary>计分方法${icon('next')}</summary>
    <dl>
      <div><dt>合成公式</dt><dd>Total = EZ×1 + HD×2 + IN×1 + AT×2，满分 600，同步换算为 100.00 百分制。${isTier ? '当前页面展示单卷实测成绩，总分与加权汇总见「合成总榜」。' : 'EZ（基础维护卷，Python）×1、HD（底层系统卷，Go + C）×2、IN（高耦合排障卷，Python）×1、AT（架构演进卷，Python）×2。'}</dd></div>
      <div><dt>BRS 与 Diff</dt><dd>BRS 健康度衡量模型在多轮迭代修复与长链路改动中的回归稳定性；Diff 纪律要求补丁收敛在目标范围，避免越界改动或破坏既有测试约定。</dd></div>
      <div><dt>不可靠参考项</dt><dd>标注「灰测」或「V3转算」的条目来自灰度评测窗口或旧版 V3 基准分数折算，样本或题目口径不完全一致；默认显示供参考，取消勾选即可只看同口径正式实测。</dd></div>
      <div><dt>未完赛条目</dt><dd>缺卷或仅测单卷的模型不参与 4 卷合成总榜排名，单独列在「未完赛参考（缺卷）」区域。</dd></div>
    </dl>
  </details>`;
}

export function mountBackendBoard(container, ctx = {}) {
  const tier = ctx.tier ? String(ctx.tier).toUpperCase() : null;
  const fallback = ctx.task?.benchmark ?? null;
  let destroyed = false;
  let request = null;
  let currentData = null;
  let query = '';
  let text = '';
  let showUnreliable = store.get(UNRELIABLE_STORE_KEY) !== 'false';

  const resolveModel = (row) => {
    const input = { model: row?.model, modelName: rowName(row), vendor: row?.vendor };
    if (typeof ctx.DATA?.model === 'function') return ctx.DATA.model(input);
    if (typeof ctx.modelOf === 'function') return ctx.modelOf(input);
    return { name: input.modelName, vendor: input.vendor ?? '', logo: '' };
  };

  const rowSearchText = (row, m, isTier = false) => [rowName(row), m?.vendor, row?.effort, row?.harness, row?.badge, rowNote(row, isTier)].filter(Boolean).join(' ').toLowerCase();

  const modelIdentityCell = (row) => {
    const m = resolveModel(row);
    const name = rowName(row) || m.name;
    const subParts = [
      m.vendor ? `<span data-i18n-ignore>${esc(m.vendor)}</span>` : '',
      row?.harness ? `<span data-i18n-ignore>${esc(row.harness)}</span>` : '',
    ].filter(Boolean);
    return `<td class="c-model"><span class="board-model">${brandMark(m, 'brand-mark sm')}<span class="board-name"><b data-i18n-ignore>${esc(name)}</b>${row?.effort ? `<span class="badge" data-i18n-ignore>${esc(row.effort)}</span>` : ''}${row?.badge ? `<span class="badge backend-badge" data-i18n-ignore>${esc(row.badge)}</span>` : ''}${subParts.length ? `<small>${subParts.join(' · ')}</small>` : ''}</span></span></td>`;
  };

  const toolbarHtml = () => `<div class="collection-toolbar backend-toolbar">
    <label class="collection-search">${icon('search')}<input type="search" data-backend-search aria-label="搜索模型、档位、Harness 或备注" placeholder="搜索模型、档位、Harness 或备注" value="${esc(text)}"></label>
    <div class="toolbar-actions">
      <label class="board-sample-toggle"><input type="checkbox" data-backend-unreliable${showUnreliable ? ' checked' : ''}><span>显示不可靠参考项（灰测 / V3转算）</span></label>
    </div>
  </div>`;

  const normalizeTiers = (data) => {
    const raw = Array.isArray(data?.tiers) ? data.tiers : null;
    return BACKEND_TIERS.map((base) => {
      const found = raw?.find((item) => String(item?.tier ?? item?.code ?? '').toUpperCase() === base.tier);
      return {
        ...base,
        ...found,
        tier: base.tier,
        slug: base.slug,
        languages: Array.isArray(found?.languages) && found.languages.length ? found.languages : base.languages,
        languageLabel: found?.languageLabel ?? base.languageLabel,
        weight: num(found?.weight) ?? base.weight,
        status: found?.statusLabel ?? found?.status ?? base.status,
      };
    });
  };

  function renderComposite(data) {
    const tiers = normalizeTiers(data);
    const allRows = Array.isArray(data?.rows) ? data.rows : [];
    const allPartial = Array.isArray(data?.partialRows) ? data.partialRows : Array.isArray(data?.partial) ? data.partial : [];
    const visibleRows = showUnreliable ? allRows : allRows.filter((r) => !isUnreliableRow(r));
    const visiblePartial = showUnreliable ? allPartial : allPartial.filter((r) => !isUnreliableRow(r));

    const pills = `<div class="backend-tiers" role="navigation" aria-label="后端分卷入口">${tiers.map((item) => `<a class="backend-tier-pill" href="#/leaderboard/backend/${esc(item.slug)}">
      <div class="backend-tier-top"><span class="backend-tier-code" data-i18n-ignore>${esc(item.tier)}</span><span class="backend-tier-weight">×${item.weight}</span></div>
      <strong class="backend-tier-name">${esc(item.name)}</strong>
      <div class="backend-tier-langs">${languagePills(item.languages)}</div>
      <span class="backend-tier-status">${esc(item.status)}</span>
    </a>`).join('')}</div>`;

    const header = `<section class="backend-hero">
      <div class="backend-hero-main">
        <div class="backend-hero-title">
          <span class="badge backend-ratio-badge">权重 1 : 2 : 1 : 2</span>
          <h2><span data-i18n-ignore>${esc(data?.suite ?? data?.benchmark ?? 'AGB-Bench v4.1')}</span> · <span>后端合成总榜</span></h2>
        </div>
        <p class="backend-hero-formula"><code data-i18n-ignore>Total = EZ×1 + HD×2 + IN×1 + AT×2</code> · <span>满分 600 / 百分制 100.00</span></p>
      </div>
      ${pills}
    </section>`;

    const bodyRows = visibleRows.map((row, index) => {
      const rank = showUnreliable && num(row?.rank) != null ? num(row.rank) : index + 1;
      const m = resolveModel(row);
      const total = compositeTotal(row);
      const pct = num(row?.total100 ?? row?.percentScore ?? row?.avgScore ?? row?.score100) ?? (total != null ? total / 6 : null);
      const noteText = rowNote(row, false);
      const cls = [isUnreliableRow(row) ? 'is-unreliable' : '', rank === 1 ? 'is-first' : ''].filter(Boolean).join(' ');
      return `<tr${cls ? ` class="${cls}"` : ''} data-backend-row="${esc(rowSearchText(row, m, false))}">
        <td class="c-rank${rank <= 3 ? ' is-top' : ''}">${pad(rank)}</td>
        ${modelIdentityCell(row)}
        <td class="c-score backend-score-cell">
          <div class="backend-score-values"><b>${formatScore(total)}</b><small>/ 600</small><span class="backend-pct">${formatScore(pct)} / 100</span></div>
          ${scoreBar(total, 600)}
        </td>
        ${tiers.map((item) => `<td class="c-part">${formatScore(tierScore(row, item.tier))}</td>`).join('')}
        <td class="c-tokens">${formatTokenValue(row, false)}</td>
        <td class="c-note">${noteText ? `<span data-i18n-ignore>${esc(noteText)}</span>` : '—'}</td>
      </tr>`;
    }).join('');

    const tableHtml = visibleRows.length
      ? `<div class="board-wrap"><table class="board backend-table">
          <thead><tr>
            <th class="c-rank" scope="col">名次</th>
            <th class="c-model" scope="col">模型 · 档位 · Harness</th>
            <th class="c-score" scope="col">合成总分 / 600</th>
            <th class="c-part" scope="col">EZ ×1 <small data-i18n-ignore>Python</small></th>
            <th class="c-part" scope="col">HD ×2 <small data-i18n-ignore>Go+C</small></th>
            <th class="c-part" scope="col">IN ×1 <small data-i18n-ignore>Python</small></th>
            <th class="c-part" scope="col">AT ×2 <small data-i18n-ignore>Python</small></th>
            <th class="c-tokens" scope="col">总 Token</th>
            <th class="c-note" scope="col">备注</th>
          </tr></thead>
          <tbody>${bodyRows}</tbody>
        </table></div>`
      : `<div class="board-empty"><p class="board-empty-title">暂无可显示的模型条目</p><p>勾选「显示不可靠参考项（灰测 / V3转算）」或等待新数据发布。</p></div>`;

    const partialRowsHtml = visiblePartial.map((row) => {
      const m = resolveModel(row);
      const total = compositeTotal(row);
      const noteText = rowNote(row, false);
      return `<tr class="is-partial${isUnreliableRow(row) ? ' is-unreliable' : ''}" data-backend-row="${esc(rowSearchText(row, m, false))}">
        <td class="c-rank">—</td>
        ${modelIdentityCell(row)}
        <td class="c-score backend-score-cell">
          <div class="backend-score-values"><b>${formatScore(total)}</b><small>/ 600</small></div>
        </td>
        ${tiers.map((item) => `<td class="c-part">${formatScore(tierScore(row, item.tier))}</td>`).join('')}
        <td class="c-tokens">${formatTokenValue(row, false)}</td>
        <td class="c-note">${noteText ? `<span data-i18n-ignore>${esc(noteText)}</span>` : '—'}</td>
      </tr>`;
    }).join('');

    const partialSection = visiblePartial.length
      ? `<section class="backend-partial" data-backend-partial>
          <div class="backend-partial-head"><h3>未完赛参考（缺卷）</h3><p>缺卷或仅测单卷的模型不计入 4 卷合成总榜名次，仅作横向参考。</p></div>
          <div class="board-wrap"><table class="board backend-table is-partial">
            <thead><tr>
              <th class="c-rank" scope="col">名次</th>
              <th class="c-model" scope="col">模型 · 档位 · Harness</th>
              <th class="c-score" scope="col">已测总分</th>
              <th class="c-part" scope="col">EZ ×1</th>
              <th class="c-part" scope="col">HD ×2</th>
              <th class="c-part" scope="col">IN ×1</th>
              <th class="c-part" scope="col">AT ×2</th>
              <th class="c-tokens" scope="col">总 Token</th>
              <th class="c-note" scope="col">备注</th>
            </tr></thead>
            <tbody>${partialRowsHtml}</tbody>
          </table></div>
        </section>`
      : '';

    return `<div class="backend-board">${header}${toolbarHtml()}${tableHtml}
      <p class="muted filter-empty" data-backend-none hidden>没有匹配的模型，请换个关键词。</p>
      ${partialSection}${backendNotes(false)}</div>`;
  }

  function renderTier(data) {
    const base = backendTierMeta(data?.tier ?? tier) ?? { tier, slug: String(tier).toLowerCase(), name: data?.name ?? tier, weight: 1, languages: ['Python'], languageLabel: 'Python', status: '' };
    const languages = Array.isArray(data?.languages) && data.languages.length ? data.languages : base.languages;
    const weight = num(data?.weight) ?? base.weight;
    const tierInfo = Array.isArray(data?.tiers) ? data.tiers.find((t) => String(t?.code ?? t?.tier ?? '').toUpperCase() === base.tier) : null;
    const status = data?.statusLabel ?? tierInfo?.statusLabel ?? data?.status ?? base.status;
    const tierName = data?.name ?? tierInfo?.name ?? data?.tierName ?? base.name;
    const allRows = Array.isArray(data?.rows) ? data.rows : [];
    const visibleRows = showUnreliable ? allRows : allRows.filter((r) => !isUnreliableRow(r));

    const header = `<section class="backend-hero is-tier">
      <div class="backend-hero-main">
        <div class="backend-hero-title">
          <span class="backend-tier-code" data-i18n-ignore>${esc(base.tier)}</span>
          <h2><span>${esc(tierName)}</span></h2>
          <div class="backend-tier-langs">${languagePills(languages)}</div>
        </div>
        <p class="backend-hero-meta">
          <span>总榜权重 ×${weight}</span>
          ${status ? ` · <span>${esc(status)}</span>` : ''}
          · <span data-i18n-ignore>${esc(data?.suite ?? data?.benchmark ?? 'AGB-Bench v4.1')}</span>
        </p>
      </div>
      <a class="btn sm" href="#/leaderboard/backend">查看合成总榜 (1:2:1:2)${icon('right')}</a>
    </section>`;

    const bodyRows = visibleRows.map((row, index) => {
      const rank = showUnreliable && num(row?.rank) != null ? num(row.rank) : index + 1;
      const m = resolveModel(row);
      const score = num(row?.score ?? row?.totalScore);
      const noteText = rowNote(row, true);
      const cls = [isUnreliableRow(row) ? 'is-unreliable' : '', rank === 1 ? 'is-first' : ''].filter(Boolean).join(' ');
      return `<tr${cls ? ` class="${cls}"` : ''} data-backend-row="${esc(rowSearchText(row, m, true))}">
        <td class="c-rank${rank <= 3 ? ' is-top' : ''}">${pad(rank)}</td>
        ${modelIdentityCell(row)}
        <td class="c-score backend-score-cell">
          <div class="backend-score-values"><b>${formatScore(score)}</b><small>/ 100</small></div>
          ${scoreBar(score, 100)}
        </td>
        <td class="c-brs">${formatBrs(row)}</td>
        <td class="c-tokens">${formatTokenValue(row, true)}</td>
        <td class="c-note">${noteText ? `<span data-i18n-ignore>${esc(noteText)}</span>` : '—'}</td>
      </tr>`;
    }).join('');

    const tableHtml = visibleRows.length
      ? `<div class="board-wrap"><table class="board backend-table is-tier">
          <thead><tr>
            <th class="c-rank" scope="col">名次</th>
            <th class="c-model" scope="col">模型 · 档位 · Harness</th>
            <th class="c-score" scope="col">得分 / 100</th>
            <th class="c-brs" scope="col">BRS 健康度</th>
            <th class="c-tokens" scope="col">Token</th>
            <th class="c-note" scope="col">备注</th>
          </tr></thead>
          <tbody>${bodyRows}</tbody>
        </table></div>`
      : `<div class="board-empty"><p class="board-empty-title">暂无可显示的模型条目</p><p>勾选「显示不可靠参考项（灰测 / V3转算）」或等待新数据发布。</p></div>`;

    return `<div class="backend-board">${header}${toolbarHtml()}${tableHtml}
      <p class="muted filter-empty" data-backend-none hidden>没有匹配的模型，请换个关键词。</p>
      ${backendNotes(true)}</div>`;
  }

  function applyQuery() {
    const rows = [...container.querySelectorAll('[data-backend-row]')];
    let shown = 0;
    for (const row of rows) {
      const visible = textMatches(query, row.dataset.backendRow ?? '');
      row.hidden = !visible;
      if (visible) shown++;
    }
    const partial = $('[data-backend-partial]', container);
    if (partial) {
      const hasPartial = [...partial.querySelectorAll('[data-backend-row]')].some((row) => !row.hidden);
      partial.hidden = !hasPartial;
    }
    const none = $('[data-backend-none]', container);
    if (none) none.hidden = shown > 0 || !rows.length;
  }

  function draw(data) {
    if (destroyed) return;
    currentData = data;
    const typing = document.activeElement?.matches?.('[data-backend-search]');
    const toggling = document.activeElement?.matches?.('[data-backend-unreliable]');
    container.innerHTML = tier ? renderTier(data) : renderComposite(data);
    if (typing) $('[data-backend-search]', container)?.focus();
    if (toggling) $('[data-backend-unreliable]', container)?.focus();
    applyQuery();
    ctx.onLoad?.(data);
  }

  function load() {
    if (destroyed) return Promise.resolve();
    const path = tier ? `leaderboard/backend?tier=${encodeURIComponent(tier)}` : 'leaderboard/backend';
    if (request?.path === path) return request.promise;
    request?.controller.abort();
    const controller = new AbortController();
    const reading = { path, controller, promise: null };
    request = reading;
    container.setAttribute('aria-busy', 'true');
    // As in leaderboard.js: the deadline also covers reading the body, and a timeout shows its own message.
    let reject;
    const cancelled = new Promise((_, fail) => { reject = fail; });
    controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true });
    const timer = setTimeout(() => controller.abort(new DOMException('连接超时，请重试。', 'TimeoutError')), 15000);
    reading.promise = (async () => {
      try {
        const data = await Promise.race([api(path, { signal: controller.signal }), cancelled]);
        if (destroyed || request !== reading || controller.signal.aborted) return;
        if (!data || !Array.isArray(data.rows)) throw new Error('服务暂时不可用，请稍后重试。');
        draw(data);
        return data;
      } catch (error) {
        if (error?.name === 'AbortError' || destroyed || request !== reading) return;
        if (tier && fallback && Array.isArray(fallback.rows)) {
          const data = { ...fallback, tier };
          draw(data);
          return data;
        }
        container.innerHTML = `<div class="board-empty" data-board-error role="status"><p class="board-empty-title">后端榜单暂时无法载入</p><p>${esc(error.message)}</p><div class="board-empty-actions"><button class="btn sm" type="button" data-backend-retry>重试加载</button></div></div>`;
      } finally {
        clearTimeout(timer);
        if (request === reading) {
          request = null;
          container.removeAttribute('aria-busy');
        }
      }
    })();
    return reading.promise;
  }

  const onInput = (event) => {
    if (!event.target.matches('[data-backend-search]')) return;
    text = event.target.value;
    query = text.trim().toLowerCase();
    applyQuery();
  };

  const onChange = (event) => {
    if (!event.target.matches('[data-backend-unreliable]')) return;
    showUnreliable = event.target.checked;
    store.set(UNRELIABLE_STORE_KEY, String(showUnreliable));
    if (currentData) draw(currentData);
  };

  const onClick = (event) => {
    if (event.target.closest('[data-backend-retry]')) void load();
  };

  container.addEventListener('input', onInput);
  container.addEventListener('change', onChange);
  container.addEventListener('click', onClick);
  const ready = load();

  return {
    ready,
    reload: load,
    destroy() {
      destroyed = true;
      request?.controller.abort();
      container.removeEventListener('input', onInput);
      container.removeEventListener('change', onChange);
      container.removeEventListener('click', onClick);
    },
  };
}
