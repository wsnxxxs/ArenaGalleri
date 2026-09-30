// Leaderboard: the full page (#/leaderboard[/<task>]) and the panel on each task page.
import { $, brandMark, esc, icon, pad, store } from './ui.js';
import { api, platform } from './platform.js';

const UNITS = { config: '按配置', model: '按模型' };

export const boardNotes = (open = false) => `<details class="board-notes"${open ? ' open' : ''}>
  <summary>计分方法${icon('next')}</summary>
  <dl>
    <div><dt>比较</dt><dd>盲评每次展示同一道题的两件作品，左右随机、身份隐藏，投票之后才揭晓模型。</dd></div>
    <div><dt>计分</dt><dd>Bradley–Terry 模型根据全部有效比较，估计每个配置被偏好的强度，「不分伯仲」计为双方各得半场。分数折算到 Elo 刻度：1000 为平均水平，高出 400 分约等于被偏好的机会高十倍。结果与投票先后顺序无关。</dd></div>
    <div><dt>区间</dt><dd>分数后的 ± 与横条表示约 95% 的不确定范围；比较少于 ${platform.site?.limits.provisionalGames ?? 30} 次的配置标为「暂定」。</dd></div>
    <div><dt>计入</dt><dd>只统计登录用户对两件已验证作品的选择；同一用户对同一对作品只计一次，跳过不计。作品被标记存疑或删除后，相关投票自动移出，恢复后重新计入。</dd></div>
    <div><dt>单位</dt><dd>「按配置」把同一模型的不同推理档位分开计分；「按模型」把它们合并。「全部题目」合并各题的比较结果，比较本身始终发生在同一道题之内。</dd></div>
    <div><dt>来源筛选</dt><dd>按 Harness 或服务商筛选时，只统计两件作品在投票当时都满足条件的比较；计分单位不变。只填了「其他」的作品和较早的投票都算作「未注明」。</dd></div>
    <div><dt>不计分</dt><dd>表情互动与浏览次数都不影响榜单。</dd></div>
  </dl>
</details>`;

export function mountBoard(container, ctx) {
  let unit = store.get('board-unit') === 'model' ? 'model' : 'config';
  let controller = null;
  let destroyed = false;
  // Provenance filters live on the full page only: the embedded board also drives the task page's score sort.
  const filters = { harness: '', provider: '' };
  const filterable = !ctx.embedded;
  const filterActive = () => Boolean(filters.harness || filters.provider);

  const mark = (row) => brandMark(ctx.MODELS.get(row.model) ?? { name: row.modelName }, 'brand-mark sm');
  const filterSelect = (field, label, registry) => `<label class="result-sort">${label}<select data-board-filter="${field}" aria-label="按${label}筛选榜单">
    <option value="">全部</option><option value="unset"${filters[field] === 'unset' ? ' selected' : ''}>未注明</option>
    ${[...(registry?.values() ?? [])].filter((entry) => entry.listed || entry.id === filters[field])
      .map((entry) => `<option value="${esc(entry.id)}"${entry.id === filters[field] ? ' selected' : ''}>${esc(entry.name)}</option>`).join('')}
  </select></label>`;

  function table(data) {
    const { rows, unranked, totals } = data;
    const unsupported = filterActive() && !data.filters;
    const head = `<div class="board-head">
      <p class="board-meta">${totals.votes} 次有效比较 · ${totals.voters} 位参与者 · ${rows.length} 个${unit === 'model' ? '模型' : '配置'}有评分${data.filters ? ' · 仅统计两件作品来源都符合筛选的比较' : ''}</p>
      ${filterable ? `<div class="board-filters">${filterSelect('harness', 'Harness', ctx.HARNESSES)}${filterSelect('provider', '服务商', ctx.PROVIDERS)}</div>` : ''}
      <div class="seg" role="group" aria-label="计分单位">${Object.entries(UNITS).map(([value, text]) => `<button data-board-unit="${value}" aria-pressed="${value === unit}">${text}</button>`).join('')}</div>
    </div>${unsupported ? '<p class="muted">后端暂不支持来源筛选，下面是未筛选的榜单。</p>' : ''}`;
    if (!rows.length && data.filters) {
      return `${head}<div class="board-empty">
        <p class="board-empty-title">这个筛选下还没有可计分的比较</p>
        <p>只有两件作品在投票时来源都符合筛选的比较才计入。${unranked.length ? `符合条件的${unit === 'model' ? '模型' : '配置'}有 ${unranked.length} 个。` : ''}</p>
      </div>`;
    }
    if (!rows.length) {
      return `${head}<div class="board-empty">
        <p class="board-empty-title">榜单还在等第一批盲评</p>
        <p>票数积累之前，这里不给出没有依据的名次。${unranked.length ? `目前有 ${unranked.length} 个${unit === 'model' ? '模型' : '配置'}的已验证作品在等待比较。` : ''}</p>
        <a class="btn primary sm" href="#/arena${ctx.task ? `/${esc(ctx.task.id)}` : ''}">${icon('blind')}去盲评</a>
      </div>`;
    }
    const low = Math.min(1000, ...rows.map((row) => row.score - row.interval));
    const high = Math.max(1000, ...rows.map((row) => row.score + row.interval));
    const at = (value) => (((value - low) / Math.max(high - low, 1)) * 100).toFixed(2);
    const body = rows.map((row) => `<tr${row.provisional ? ' class="is-provisional"' : ''}>
      <td class="c-rank">${pad(row.rank)}</td>
      <td class="c-model"><span class="board-model">${mark(row)}<span class="board-name"><b>${esc(row.modelName)}</b>${row.effort ? `<span class="badge">${esc(row.effort)}</span>` : ''}${row.provisional ? `<span class="badge provisional" title="比较少于 ${data.provisionalGames} 次">暂定</span>` : ''}<small>${esc(row.vendor || '厂商未知')}</small></span></span></td>
      <td class="c-score"><b>${row.score}</b><small>±${row.interval}</small></td>
      <td class="c-range" aria-hidden="true"><span class="range"><s style="left:${at(1000)}%"></s><i style="left:${at(row.score - row.interval)}%;width:${(at(row.score + row.interval) - at(row.score - row.interval)).toFixed(2)}%"></i><em style="left:${at(row.score)}%"></em></span></td>
      <td class="c-games">${row.games}</td>
      <td class="c-record">${row.wins}<span>·</span>${row.draws}<span>·</span>${row.losses}</td>
      <td class="c-rate">${Math.round(row.winRate * 100)}%</td>
      <td class="c-works">${row.works}</td>
    </tr>`).join('');
    return `${head}<div class="board-wrap"><table class="board">
      <thead><tr><th class="c-rank" scope="col">名次</th><th class="c-model" scope="col">${unit === 'model' ? '模型' : '模型 · 档位'}</th><th class="c-score" scope="col">评分</th><th class="c-range" scope="col"><span class="sr">区间</span></th><th class="c-games" scope="col">比较</th><th class="c-record" scope="col">胜 · 平 · 负</th><th class="c-rate" scope="col">胜率</th><th class="c-works" scope="col">作品</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>
    ${unranked.length ? `<details class="board-unranked"><summary>还没有比较数据的${unit === 'model' ? '模型' : '配置'} · ${unranked.length}${icon('next')}</summary><p>${unranked.map((row) => `${esc(row.modelName)}${row.effort ? ` · ${esc(row.effort)}` : ''}`).join('、')}</p></details>` : ''}`;
  }

  async function load() {
    controller?.abort();
    controller = new AbortController();
    container.setAttribute('aria-busy', 'true');
    try {
      const query = new URLSearchParams({ by: unit, ...(ctx.task ? { task: ctx.task.id } : {}) });
      if (filterable) for (const [field, value] of Object.entries(filters)) if (value) query.set(field, value);
      const data = await api(`leaderboard?${query}`, { signal: controller.signal });
      if (destroyed) return;
      container.innerHTML = table(data) + (ctx.embedded ? boardNotes() : '');
      ctx.onData?.(data);
    } catch (error) {
      if (error.name === 'AbortError' || destroyed) return;
      container.innerHTML = `<p class="muted">榜单暂时无法载入：${esc(error.message)}</p>`;
    } finally {
      container.removeAttribute('aria-busy');
    }
  }

  const onClick = (e) => {
    const button = e.target.closest('[data-board-unit]');
    if (!button || button.dataset.boardUnit === unit) return;
    unit = button.dataset.boardUnit;
    store.set('board-unit', unit);
    load();
  };
  const onChange = (e) => {
    const select = e.target.closest('[data-board-filter]');
    if (!select) return;
    filters[select.dataset.boardFilter] = select.value;
    load();
  };
  container.addEventListener('click', onClick);
  container.addEventListener('change', onChange);
  load();
  return {
    reload: load,
    destroy() {
      destroyed = true;
      controller?.abort();
      container.removeEventListener('click', onClick);
      container.removeEventListener('change', onChange);
    },
  };
}

export function mount(root, ctx) {
  const task = ctx.param ? ctx.DATA.tasks.find((t) => t.id === ctx.param) : null;
  if (ctx.param && !task) {
    location.replace('#/leaderboard');
    return {};
  }
  const ranked = ctx.DATA.tasks.filter((t) => (platform.arena[t.id]?.entries ?? 0) >= 2);
  root.innerHTML = `${ctx.pageStart({ title: '排行榜', section: 'leaderboard', heading: task?.title ?? '全部题目的偏好排名',
    crumbs: task ? [{ text: '排行榜', href: '#/leaderboard' }, { text: task.title }] : undefined,
    description: '由真实盲评投票计算。分数反映作品在同题比较中被偏好的程度，区间越窄，结论越可靠。',
    meta: `<dl class="side-stats" data-stats>
          <div><dt>有效比较</dt><dd>${pad(platform.totals.votes)}</dd></div>
          <div><dt>参与者</dt><dd>${pad(platform.totals.voters)}</dd></div>
        </dl>`,
    nav: ctx.sideNav('按题目查看', [['#/leaderboard', 'rank', '全部题目', !task], ...ranked.map((t) => [`#/leaderboard/${t.id}`, 'text', t.title, t === task])]) })}
    <section class="block wrap">
      <div data-board></div>
      ${boardNotes(true)}
    </section>
  ${ctx.pageEnd()}`;
  const board = mountBoard($('[data-board]', root), {
    ...ctx,
    task,
    onData: (data) => {
      const stats = $('[data-stats]', root);
      if (stats) stats.innerHTML = `<div><dt>有效比较</dt><dd>${pad(data.totals.votes)}</dd></div><div><dt>参与者</dt><dd>${pad(data.totals.voters)}</dd></div><div><dt>${data.by === 'model' ? '上榜模型' : '上榜配置'}</dt><dd>${pad(data.rows.length)}</dd></div>`;
    },
  });
  document.title = `榜单${task ? ` · ${task.title}` : ''} · ${ctx.DATA.title}`;
  return {
    onPlatformChange: () => board.reload(),
    destroy: () => board.destroy(),
  };
}
