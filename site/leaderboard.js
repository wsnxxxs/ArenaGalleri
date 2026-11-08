import { setPageTitle } from './i18n.js';
import { routeParts } from './route-path.js';
// Leaderboard: the full page (#/leaderboard[/<category>|/<task>][/<domain>], or #/leaderboard/<domain>)
// and the panel on each task page.
import { $, brandMark, esc, formatDate, formatTime, icon, pad, store, vendorLine } from './ui.js';
import { apiRemembered, arenaScope, levelOf, platform, pricingInfo, recall } from './platform.js';
import { curatedInfo, curatedKnown } from './curated.js';
import { categoryLabel, domainsIn, domainList, domainsOf, tracksOf, votedTask } from './categories.js';
import { textMatches } from './match.js';
import { chartOpen, costShown, formatMoney, formatMultiple, frontier, groupCosts } from './usage.js';
import { costTable, frontierSteps, plottable, scatter } from './cost-chart.js';

const UNITS = { config: '按配置', model: '按模型' };
// A domain board below either line is shown, but flagged as too thin to rank on.
const THIN = { tasks: 2, votes: 50 };
const MIN_WORKS = 5;
const MIN_GAMES = 21;

export function visibleBoardEntries(data, showSmallSamples = false) {
  const visible = (row) => row.games >= MIN_GAMES && (showSmallSamples || row.works >= MIN_WORKS);
  return { rows: data.rows.filter(visible), unranked: [] };
}

export function watchBoardRefresh(reload) {
  let pending = false, stopped = false, timer, nextAt;
  const schedule = (data) => {
    if (stopped) return;
    const next = Date.parse(data?.nextUpdateAt);
    nextAt = Number.isFinite(next) ? Math.max(Date.now() + 1000, next) : Date.now() + 10 * 60_000;
    clearTimeout(timer);
    timer = setTimeout(refresh, nextAt - Date.now());
  };
  const refresh = async () => {
    if (stopped || document.visibilityState === 'hidden' || pending || Date.now() < nextAt) return;
    pending = true;
    try { schedule(await reload()); } catch { schedule(); } finally { pending = false; }
  };
  schedule();
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('focus', refresh);
  window.addEventListener('online', refresh);
  return { refresh, update: schedule, destroy() {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', refresh);
    window.removeEventListener('focus', refresh);
    window.removeEventListener('online', refresh);
  } };
}
export function boardTaskOptions(tasks, selected, activityReady, arena) {
  return `<option value="">全部题目（${tasks.length}）</option>${tasks.map((t) => {
    const ready = (arena[t.id]?.entries ?? 0) >= 2;
    const note = !activityReady ? '（统计加载中）' : ready ? `（${arena[t.id].works}）` : '（作品不足）';
    return `<option data-i18n-ignore data-i18n-option-original="${esc(t.title)}" data-i18n-option-suffix="${esc(note)}" value="${esc(t.id)}"${t.id === selected ? ' selected' : ''}${!activityReady || ready || t.id === selected ? '' : ' disabled'}>${esc(t.title)}${note}</option>`;
  }).join('')}`;
}
// v3 notes take every threshold from the board's own scoring block, so a configuration change needs no new copy.
const percent = (value) => Math.round(value * 100);
function v3Notes(s) {
  const level = typeof s.rankRange === 'object' ? s.rankRange?.level : s.rankRange;
  const weights = Object.entries(s.composite ?? {});
  const equal = weights.every(([, weight]) => weight === weights[0][1]);
  const labels = weights.map(([name]) => categoryLabel(name)).join('、');
  // A single-question board has no question threshold and no question-to-question spread (both 0).
  const single = !s.minimumTasks;
  return `<div><dt>区间</dt><dd>名次下的小字是 ${percent(level ?? 0.95)}% 的名次范围，只有一个可能名次时不写。${single ? '分数后的 ± 是投票随机性的范围，单题榜不加换题的波动。' : `分数后的 ± 同时算了投票的随机性和换题的波动（换题按 ${s.taskSpread} 分估计），悬停分数可看两部分各有多大。`}横条颜色越接近朱红，在本榜的位置越高；比较少于 ${platform.site?.limits.provisionalGames ?? 30} 次的标为「暂定」。</dd></div>
    <div><dt>达标</dt><dd>${single ? `至少 ${s.minimumGames} 场、有效投票者至少 ${s.minimumEffectiveVoters} 人才排名，单题榜不看题数。` : `分类榜和领域榜上，至少 ${s.minimumGames} 场、${s.minimumTasks} 道题，比较最多的一道题不超过 ${percent(s.maxTaskShare)}%，有效投票者至少 ${s.minimumEffectiveVoters} 人才排名；单题榜不看题数。`}满 ${s.minimumGames} 场但没有达标的列入「观察区」，并写明原因。</dd></div>
    ${weights.length && !single ? `<div><dt>综合</dt><dd>综合榜把${labels}${['', '一', '两', '三', '四', '五'][weights.length] ?? weights.length}张分类榜的分数${equal ? '等权平均' : `按 ${weights.map(([, weight]) => weight).join(' / ')} 加权平均`}。各类都达标的才排名，其余列在下方并显示各类名次。</dd></div>` : ''}
    ${s.weighted ? '<div><dt>权重</dt><dd>每票按投票时的身份取基础权重，同一投票者对同一模型超过 20 场后递减。胜平负和实际胜率是原始票数。</dd></div>' : ''}`;
}
// curated: { since, threshold } when the page shows a curated board, else null. scoring: the board's
// scoring block; version 3 replaces the interval, scope and display notes.
export const boardNotes = (open = false, curated = null, limitWorks = true, scoring = null) => `<details class="board-notes"${open ? ' open' : ''}>
  <summary>计分方法${icon('next')}</summary>
  <dl>
    <div><dt>比较</dt><dd>盲评每次展示同一道题的两件作品，左右随机、身份隐藏，投票之后才揭晓模型。</dd></div>
    <div><dt>计分</dt><dd>Bradley–Terry 模型根据全部有效比较，估计每个配置被偏好的强度，「不分伯仲」计为双方各得半场。分数折算到 Elo 刻度：1000 为平均水平，高出 400 分约等于被偏好的机会高十倍。结果与投票先后顺序无关。</dd></div>
    ${!curated && scoring?.version >= 3 ? v3Notes(scoring) : `<div><dt>区间</dt><dd>分数后的 ± 与横条表示约 95% 的不确定范围，横条颜色越接近朱红，在本榜的位置越高；比较少于 ${platform.site?.limits.provisionalGames ?? 30} 次的配置标为「暂定」。</dd></div>`}
    ${curated ? `<div><dt>范围</dt><dd>精选总榜合并全部精选题，各分区只合并本分区的题，各自重新计算，不截取总榜。只计同题比较，不平均各题分数。题目加入、移出或换分区后，下一次计算（10 分钟内）生效。</dd></div>
    <div><dt>计入</dt><dd>${curated.since ? `只统计 ${formatDate(curated.since)} 之后、投票当时为 Lv1 及以上的成员的选择` : '只统计投票当时为 Lv1 及以上的成员的选择'}；Lv0 和访客的选择只进大众榜。同一用户对同一对作品只计一次，跳过不计。同一配置（按模型时为同一模型）的两件作品之间的比较不参与计分，也不计入有效比较数。作品被标记存疑或删除后，相关投票自动移出，恢复后重新计入。</dd></div>
    <div><dt>入榜</dt><dd>模型在本榜范围内有效比较至少 21 场才入榜（总榜和每个分区分别判断，不借用大众榜的比较数）；按配置还要求该配置至少 21 场。</dd></div>
    <div><dt>与大众榜</dt><dd>两张榜用的是同一批盲评，计票范围不同。Lv1+ 在精选题上的一票同时计入两张榜。</dd></div>` : `${scoring?.version >= 3 ? '<div><dt>范围</dt><dd>各类型（写作 / 设计 / 三维）只统计该类题目，选择具体题目时只统计这道题。比较本身始终发生在同一道题之内。</dd></div>'
    : '<div><dt>范围</dt><dd>「综合」合并全部题目的比较；各类型（文本 / 设计 / 三维）只统计该类题目，选择具体题目时只统计这道题。比较本身始终发生在同一道题之内。票数多的类型对综合影响更大，所以综合榜在厂商之后列出各类型名次。</dd></div>'}
    <div><dt>领域</dt><dd>选择领域时只统计属于该领域的题目，可以和类型叠加；一道题属于两个领域时，它的比较在两边都完整计入。领域内少于 ${THIN.tasks} 道题有比较、或有效比较少于 ${THIN.votes} 次时标为「样本不足」，名次仅供参考。</dd></div>
    <div><dt>计入</dt><dd>统计全部计票的选择，包括 Lv0 成员、未绑定邮箱的账号和未登录的访客（访客按浏览器区分）；同一用户对同一对作品只计一次，跳过不计。同一配置（按模型时为同一模型）的两件作品之间的比较不参与计分，也不计入有效比较数。作品被标记存疑或删除后，相关投票自动移出，恢复后重新计入。</dd></div>`}
    <div><dt>单位</dt><dd>「按配置」把同一模型的不同推理档位分开计分；「按模型」把它们合并。</dd></div>
    ${!curated && scoring?.version >= 3 ? '' : `<div><dt>显示</dt><dd>每个模型或配置在当前榜单范围内至少有 21 场有效比较才显示。${limitWorks ? '默认再隐藏作品少于 5 件的条目，可勾选显示，不能绕过场次门槛。' : ''}比较少于 30 场仍标为「暂定」。</dd></div>`}
    <div><dt>来源筛选</dt><dd>按 Harness 或服务商筛选时，只统计两件作品在投票当时都满足条件的比较；计分单位不变。服务商分为官方、非官方，未填写的为「未注明」；只填了「其他」的 Harness 和未记录来源的较早投票按「未注明」统计。</dd></div>
    <div><dt>不计分</dt><dd>表情互动与浏览次数都不影响榜单。</dd></div>
    <div><dt>更新</dt><dd>每 10 分钟计算一次，新投票将在下一次更新时计入。</dd></div>
  </dl>
</details>`;

// Each interval shows its own stretch of one grey-to-ink ramp spanning the axis; vermilion is kept
// for the top three places.
const tone = (at) => `color-mix(in srgb, var(--ink) ${Math.round(at)}%, var(--line-2))`;

// v3 places an entry in one of three groups; partial only exists on the overall (composite) board.
const GROUPS = { ranked: '已排名', partial: '未覆盖全部大类', watch: '观察区' };
const isV3 = (data) => data?.scoring?.version >= 3;
let boards = 0;

export function mountBoard(container, ctx) {
  const limitWorks = !ctx.task;
  // The guided trial build previews the next scoring; curated boards keep the current one.
  const nextBoard = globalThis.SAME_PROMPT_CONFIG?.guidedVoting === true && !ctx.curated;
  // Only the board without task, category or domain is the composite (contract: contracts/leaderboard-v3.md).
  const overall = !ctx.task && !ctx.category && !ctx.domain && !ctx.curated;
  // v3 defaults to models on the overall board and configurations elsewhere, each remembered on its own.
  // A board once seen as v3 starts that way next time, so the switch day costs one extra read at most.
  let v3 = !ctx.curated && (nextBoard || store.get('board-scoring') === '3');
  const unitKey = () => v3 ? `board-unit-${overall ? 'overall' : 'scoped'}` : 'board-unit';
  const pickUnit = () => {
    const saved = store.get(unitKey());
    return saved === 'model' || saved === 'config' ? saved : v3 && overall ? 'model' : 'config';
  };
  let unit = pickUnit();
  const openGroups = new Set();
  // Cost (token-cost design §5.5): only on aggregate public boards, and only when the server shows
  // amounts (GET /api/pricing showCost). Until then nothing here changes the board.
  const costScope = !ctx.task && !ctx.curated && !ctx.embedded && Boolean(ctx.DATA);
  let pricing = null, costOn = false;
  let costBy = null, costX = 'multiple', connect = true;
  let currency = ['CNY', 'USD'].includes(store.get('usage-currency')) ? store.get('usage-currency') : document.documentElement?.lang === 'en' ? 'USD' : 'CNY';
  const board = ++boards;
  let tips = 0;
  let showSmallSamples = store.get('board-show-small-samples') === 'true';
  let currentData = null;
  let request = null;
  let destroyed = false;
  let query = '';
  let text = '';
  // Provenance filters live on the full page only: the embedded board also drives the task page's score sort.
  const filters = { harness: '', provider: '' };
  const filterable = !ctx.embedded;
  const filterActive = () => Boolean(filters.harness || filters.provider);

  const modelOf = (row) => ctx.modelOf({ model: row.model, modelName: row.modelName, vendor: row.vendor });
  const filterSelect = (field, label, registry) => `<label class="result-sort">${label}<select data-board-filter="${field}" aria-label="按${label}筛选榜单">
    <option value="">全部${/^[A-Za-z]/.test(label) ? ' ' : ''}${label}</option><option value="unset"${filters[field] === 'unset' ? ' selected' : ''}>未注明</option>
    ${[...(registry?.values() ?? [])].filter((entry) => entry.listed || entry.id === filters[field])
      .map((entry) => `<option${field === 'provider' ? '' : ' data-i18n-ignore'} value="${esc(entry.id)}"${entry.id === filters[field] ? ' selected' : ''}>${esc(entry.name)}</option>`).join('')}
  </select></label>`;
  const standingsOf = (data, row) => (ctx.tracks ?? [])
    .filter((track) => data.standings?.[track.name]?.[row.key])
    .map((track) => `<span data-board-standing>${esc(`${track.label}第 ${data.standings[track.name][row.key]}`)}</span>`);

  // Curated empty states explain the comparison threshold and how to contribute.
  function curatedEmpty(data) {
    const taskIds = data.scope?.taskIds ?? [];
    const votes = data.totals?.votes ?? 0;
    const staffHistory = data.scope?.includesStaffHistory ?? ctx.info?.includesStaffHistory;
    const since = data.scope?.countingStartedAt ?? ctx.info?.countingStartedAt;
    const level = levelOf();
    const go = level >= 1 ? '<button class="btn primary sm" type="button" data-curated-arena>去盲评精选题</button><a class="btn sm" href="#/leaderboard">查看大众榜</a>'
      : level === 0 ? '<a class="btn primary sm" href="#/exam">参加资格考试</a><a class="btn sm" href="#/arena">去盲评（计入大众榜）</a>'
        : '<button class="btn primary sm" type="button" data-auth="login">登录</button><a class="btn sm" href="#/leaderboard">查看大众榜</a>';
    if (!taskIds.length) {
      return ctx.sectionId
        ? '<div class="board-empty"><p class="board-empty-title">这个分区还没有题目</p><p>管理员把题目放进这个分区后才开始计票。</p><div class="board-empty-actions"><a class="btn sm" href="#/leaderboard/curated">查看精选总榜</a></div></div>'
        : '<div class="board-empty"><p class="board-empty-title">还没有精选题目</p><p>管理员挑选题目后，精选榜才开始计票。</p><div class="board-empty-actions"><a class="btn sm" href="#/leaderboard">查看大众榜</a></div></div>';
    }
    const counts = `${taskIds.length} 道精选题 · ${votes} 次有效比较${staffHistory ? ' · 含管理员历史票' : since ? ` · ${formatDate(since)} 起` : ''}`;
    const explanation = staffHistory
      ? '统计认证成员的新选择，并纳入普通管理员和高级管理员的历史有效票；只计精选题，和大众榜分开计票。'
      : '这里只统计 Lv1 及以上成员在精选题上的选择，和大众榜分开计票。';
    return votes
      ? `<div class="board-empty"><p class="board-empty-title">精选榜收集中</p><p>已有 ${votes} 次有效比较，模型或配置在本榜范围内至少有 ${data.minimumGames ?? 21} 场有效比较才显示。</p><p class="board-meta">${counts}</p><div class="board-empty-actions">${go}</div></div>`
      : `<div class="board-empty"><p class="board-empty-title">精选榜等待比较</p><p>${explanation}模型或配置在本榜至少有 ${data.minimumGames ?? 21} 场有效比较后上榜，在那之前不给出没有依据的名次。</p><p class="board-meta">${counts}</p><div class="board-empty-actions">${go}</div></div>`;
  }

  // Toolbar, update time and the notes above the table; v2 keeps its work-count switch, v3 reads its thresholds.
  function head(data, count, hiddenCount = 0) {
    const { totals } = data;
    const v3Board = isV3(data);
    const unsupported = (filterActive() && !data.filters) || (ctx.category && data.category === undefined) || (ctx.domain && data.domain === undefined);
    const thin = ctx.domain && data.domain !== undefined && count && ((totals.tasks ?? 0) < THIN.tasks || totals.votes < THIN.votes);
    const meta = `${totals.votes} 次有效比较 · ${totals.voters} 位参与者 · ${count} 个${unit === 'model' ? '模型' : '配置'}${v3Board ? '排名' : '有评分'}${data.filters ? ' · 仅统计两件作品来源都符合筛选的比较' : ''}`;
    // On the full page the sidebar already counts comparisons and voters, so search leads the toolbar.
    const search = `<label class="collection-search">${icon('search')}<input type="search" data-board-search aria-label="搜索模型" placeholder="搜索模型" value="${esc(text)}"></label>`;
    const unitControl = `<div class="seg" role="group" aria-label="计分单位">${Object.entries(UNITS).map(([value, text]) => `<button data-board-unit="${value}" aria-pressed="${value === unit}">${text}</button>`).join('')}</div>`
      + (costOn && costScope ? `<div class="seg" role="group" aria-label="视图">${[['rank', '排名'], ['cost', '花费图']].map(([value, text]) => `<button data-board-view="${value}" aria-pressed="${value === (ctx.view ?? 'rank')}">${text}</button>`).join('')}</div>` : '');
    const s = data.scoring;
    return (filterable
      ? `<div class="collection-toolbar">${search}<div class="toolbar-actions">${typeof ctx.toolbar === 'function' ? ctx.toolbar() : ctx.toolbar ?? ''}${filterSelect('harness', 'Harness', ctx.HARNESSES)}${filterSelect('provider', '服务商', ctx.PROVIDERS)}${unitControl}</div></div>${data.filters ? '<p class="muted">仅统计两件作品来源都符合筛选的比较。</p>' : ''}`
      : `<div class="board-head"><p class="board-meta">${meta}</p>${unitControl}</div>`)
      + `<p class="board-meta"><span>每 10 分钟更新一次</span>${data.updatedAt ? ` · <span>最近计算</span> <time datetime="${esc(data.updatedAt)}" data-i18n-time="${esc(data.updatedAt)}">${esc(formatTime(data.updatedAt))}</time>` : ''}</p>`
      + (limitWorks && !v3Board && ctx.view !== 'cost' ? `<div class="board-display"><label class="board-sample-toggle"><input type="checkbox" data-board-small${showSmallSamples ? ' checked' : ''}><span>显示作品少于 5 件的条目</span></label>${hiddenCount ? `<span class="board-meta">已隐藏 ${hiddenCount} 个作品不足 5 件的条目</span>` : ''}</div>` : '')
      + (v3Board ? `<p class="muted">当前范围内至少有 ${s.minimumGames} 场有效比较才显示；${s.minimumGames}–${(data.provisionalGames ?? 30) - 1} 场标为暂定。</p>` : '<p class="muted">当前范围内至少有 21 场有效比较才显示；21–29 场标为暂定。</p>')
      + (nextBoard ? '<p class="muted">测试计分：这里预览新的 v3 计分，正式榜单仍按现行方法计算。</p>' : '')
      + (ctx.curated && unit === 'config' ? '<p class="muted">入榜同时要求模型与当前配置各有至少 21 场有效比较。</p>' : '')
      + (ctx.curated && count && totals.votes < 50 ? `<p class="muted">精选榜刚开始计票：目前 ${totals.votes} 次有效比较，名次可能随新票大幅变动。</p>` : '')
      + (unsupported ? '<p class="muted">后端暂不支持这项筛选，下面是未筛选的榜单。</p>' : '')
      + (thin ? `<p class="muted">样本不足：「${esc(ctx.domain)}」目前只有 ${totals.tasks ?? 0} 道题、${totals.votes} 次有效比较参与计分，名次可能随新票大幅变动，仅供参考。</p>` : '');
  }

  // Nothing to list: say why, by filter, curated state or the first votes.
  function empty(data, top, unranked) {
    if (data.filters) {
      return `${top}<div class="board-empty">
        <p class="board-empty-title">这个筛选下还没有可计分的比较</p>
        <p>只有两件作品在投票时来源都符合筛选的比较才计入。${unranked.length ? `符合条件的${unit === 'model' ? '模型' : '配置'}有 ${unranked.length} 个。` : ''}</p>
      </div>`;
    }
    if (ctx.curated) return `${top}${curatedEmpty(data)}`;
    return `${top}<div class="board-empty">
        <p class="board-empty-title">${esc(ctx.emptyTitle ?? '榜单还在等第一批盲评')}</p>
        <p>票数积累之前，这里不给出没有依据的名次。${unranked.length ? `目前有 ${unranked.length} 个${unit === 'model' ? '模型' : '配置'}的已验证作品在等待比较。` : ''}</p>
        <a class="btn primary sm" href="#/arena${ctx.task ? `/${esc(ctx.task.id)}` : ''}">${icon('blind')}去盲评</a>
      </div>`;
  }

  const unrankedList = (unranked) => unranked.length ? `<details class="board-unranked"><summary>还没有比较数据的${unit === 'model' ? '模型' : '配置'} · ${unranked.length}${icon('next')}</summary><p data-i18n-ignore>${unranked.map((row) => `${esc(row.modelName)}${row.effort ? ` · ${esc(row.effort)}` : ''}`).join('、')}</p></details>` : '';
  const searchText = (row, m) => esc([row.modelName, row.effort, m.vendor].join(' ').toLowerCase());
  const nameParts = (data, row) => `<b data-i18n-ignore>${esc(row.modelName)}</b>${row.effort ? `<span class="badge" data-i18n-ignore>${esc(row.effort)}</span>` : ''}${row.provisional ? `<span class="badge provisional" title="比较少于 ${data.provisionalGames} 次">暂定</span>` : ''}`;
  const recordCells = (row) => row.games == null ? '<td class="c-games">—</td><td class="c-record">—</td><td class="c-rate">—</td>'
    : `<td class="c-games"><span data-i18n-number="${row.games}">${row.games}</span></td>
      <td class="c-record"><span data-i18n-number="${row.wins}">${row.wins}</span><span>·</span><span data-i18n-number="${row.draws}">${row.draws}</span><span>·</span><span data-i18n-number="${row.losses}">${row.losses}</span></td>
      <td class="c-rate">${Math.round(row.winRate * 100)}%</td>`;
  const rangeBar = (row, at) => {
    const from = at(row.score - row.interval), to = at(row.score + row.interval);
    return `<span class="range"><s style="left:${at(1000)}%"></s><i style="left:${from}%;width:${(to - from).toFixed(2)}%;background:linear-gradient(90deg, ${tone(from)}, ${tone(to)})"></i><em style="left:${at(row.score)}%"></em></span>`;
  };
  const axis = (rows) => {
    const low = Math.min(1000, ...rows.map((row) => row.score - row.interval));
    const high = Math.max(1000, ...rows.map((row) => row.score + row.interval));
    return (value) => (((value - low) / Math.max(high - low, 1)) * 100).toFixed(2);
  };

  // ---- cost ----------------------------------------------------------------------------
  // The works this board covers: its questions (category, domain) and its source filters. Medians stay
  // per question; the filters only pick which works join a group (usage.groupCosts).
  const tasksInScope = () => ctx.DATA.tasks.filter((t) => votedTask(t) && (!ctx.category || t.category === ctx.category)
    && (!ctx.domain || domainsOf(t).includes(ctx.domain)));
  const passes = (w) => (!filters.harness || (filters.harness === 'unset' ? !w.harness : w.harness === filters.harness))
    && (!filters.provider || (ctx.providerOf(w)?.id ?? 'unset') === filters.provider);
  const harnessName = (w) => ctx.harnessOf(w)?.name ?? '未注明 Harness';
  const COST_KEYS = {
    config: (w) => ctx.entryKey(w), model: (w) => ctx.modelKey(w),
    harness: (w) => harnessName(w), pair: (w) => `${ctx.modelKey(w)} ${harnessName(w)}`,
  };
  const COST_NAMES = {
    config: (w) => ctx.label(w), model: (w) => ctx.modelOf(w).name,
    harness: (w) => harnessName(w), pair: (w) => `${ctx.modelOf(w).name} · ${harnessName(w)}`,
  };
  const costsBy = (by) => groupCosts(tasksInScope(), { pricing, keyOf: COST_KEYS[by], modelOf: (w) => ctx.modelOf(w).id ?? w.model, include: passes });
  // The chart opens once 8 configurations have 5 counted works each, whatever the unit on screen.
  const costReady = () => costOn && costScope && chartOpen(costsBy('config'));
  const money = (cny) => formatMoney(cny, currency, pricing?.fx);
  const scoresOf = (rows) => new Map(rows.map((row) => [row.key, row.score]));
  const rankedRows = (data) => isV3(data) ? data.rows : visibleBoardEntries(data, true).rows;
  // Groups on the chart: rated, with enough works; the frontier is drawn from the firm ones.
  function costPoints(scores, by) {
    const points = [...costsBy(by).values()].map((g) => ({ ...g, name: COST_NAMES[by](g.sample), model: ctx.modelKey(g.sample), score: scores.get(g.key) ?? null }));
    const rated = points.filter((p) => p.score != null && p.status !== 'insufficient').map((p) => ({ ...p, x: costX === 'multiple' ? p.multiple : p.medianCost, y: p.score }));
    const front = new Set(frontier(rated.filter((p) => p.status === 'firm')).map((p) => p.key));
    return { points, rated: rated.map((p) => ({ ...p, frontier: front.has(p.key) })), front };
  }
  // The ranking table's cost column, once the chart is open: multiple, median per work and count.
  function costColumn(rows) {
    if (!costReady() || (ctx.view ?? 'rank') !== 'rank') return null;
    const { points, front } = costPoints(scoresOf(rows), unit);
    return { groups: new Map(points.map((p) => [p.key, p])), front };
  }
  function costCell(cost, row) {
    if (!cost) return '';
    const g = cost.groups.get(row.key);
    if (!g || g.status === 'insufficient') return '<td class="c-cost">—</td>';
    const tag = cost.front.has(row.key) ? '<span class="badge cost-tag">前沿</span>' : g.status === 'provisional' ? '<span class="badge cost-tag is-soft">暂定</span>' : '';
    return `<td class="c-cost"><span class="cost-mult">${tag}<b>${formatMultiple(g.multiple)}</b></span><small>${money(g.medianCost)} / 件 · ${g.works} 件</small></td>`;
  }
  const COST_HEAD = '<th class="c-cost" scope="col">花费</th>';
  const COST_NOTE = '<p class="fine cost-note">花费列：各题花费 ÷ 同题中位的几何平均，以及单件花费中位；件数是管理员实测的件数，不是「作品」列的全部作品。按官方标价折算，名次仍按评分。</p>';

  // The cost view: the chart for configurations or models, a cost table for Harness groupings.
  function controlsOf(by, scored, seg, select) {
    return `<div class="cost-controls">${select}${scored ? seg('横轴', [['multiple', '花费倍数'], ['cost', '单件中位']], costX) : ''}${seg('币种', [['CNY', '¥'], ['USD', '$']], currency)}
      ${scored && by === 'config' ? `<label class="board-sample-toggle"><input type="checkbox" data-cost-connect${connect ? ' checked' : ''}><span>连接同一模型的档位</span></label>` : ''}</div>`;
  }
  function costView(data) {
    const by = costBy ?? unit;
    const scored = by === 'config' || by === 'model';
    const select = `<label class="result-sort">分组<select data-cost-by aria-label="花费图分组">${Object.entries({ config: '按配置', model: '按模型', harness: '按 Harness', pair: '按模型 + Harness' })
      .map(([value, text]) => `<option value="${value}"${value === by ? ' selected' : ''}>${text}</option>`).join('')}</select></label>`;
    const seg = (name, options, current) => `<div class="seg" role="group" aria-label="${name}">${options.map(([value, text]) => `<button type="button" data-cost-set="${name}" data-value="${value}" aria-pressed="${value === current}">${text}</button>`).join('')}</div>`;
    const configs = costsBy('config');
    if (!chartOpen(configs)) {
      const ready = [...configs.values()].filter((g) => g.works >= 5).length;
      return `<div class="board-empty cost-closed"><p class="board-empty-title">花费图还在积累记录</p>
        <p>至少 8 个配置各有 5 件以上计入记录后开放。目前 ${ready} 个配置达到，管理员已实测 ${tasksInScope().reduce((sum, t) => sum + t.results.filter((w) => w.usage && passes(w)).length, 0)} 件作品。在那之前，可以在各题的「花费」视图里直接比较。</p>
        <div class="board-empty-actions"><button class="btn sm" type="button" data-board-view="rank">回到排名</button></div></div>`;
    }
    const all = costPoints(scoresOf(rankedRows(data)), by);
    // The search narrows what is drawn and listed; the frontier stays the whole board's.
    const matches = (p) => textMatches(query, `${p.name} ${p.sample?.harnessName ?? ''}`.toLowerCase());
    const points = all.points.filter(matches), rated = all.rated.filter(matches);
    const front = rated.filter((p) => p.frontier).sort((a, b) => a.x - b.x);
    // A log axis cannot place 0: zero-cost entries are named under the chart and stay in the table.
    const zero = rated.filter((p) => !plottable(p));
    const tableRows = points.map((p) => ({ ...p, status: scored && p.score == null && p.status !== 'insufficient' ? 'unrated' : p.status, frontier: front.some((f) => f.key === p.key) }))
      .sort((a, b) => Number(a.status === 'insufficient') - Number(b.status === 'insufficient') || a.multiple - b.multiple);
    if (query && !points.length) return `${controlsOf(by, scored, seg, select)}<p class="muted">没有匹配的模型，请换个关键词。</p>`;
    const controls = controlsOf(by, scored, seg, select);
    const legend = '<p class="cost-legend" aria-hidden="true"><span><i class="is-front"></i>前沿</span><span><i></i>其他</span><span><i class="is-provisional"></i>暂定（3–4 件），不参与前沿</span><span><i class="is-line"></i>前沿线</span></p>';
    return `${controls}
      <p class="muted">花费图仍在试行，全部按暂定看待。评分来自全部有效比较，花费只来自管理员实测的作品，两者各自独立。</p>
      ${scored ? (rated.filter(plottable).length >= 2 ? `${legend}<div class="cost-scroll">${scatter(rated, { x: costX, connect: connect && by === 'config', currency, fx: pricing?.fx })}</div>
        ${zero.length ? `<p class="fine cost-zero">花费为 0，无法画在对数轴上：<span data-i18n-ignore>${zero.map((p) => esc(p.name)).join('、')}</span>。它们仍列在数据表里。</p>` : ''}
        ${front.length ? `<div class="cost-path-wrap"><p class="usage-label">前沿路径</p>${frontierSteps(front, { x: costX, currency, fx: pricing?.fx })}</div>` : ''}` : '<p class="muted">当前筛选下有评分且样本足够的条目不足两个，暂不作图。</p>')
        : `<p class="muted">${by === 'harness' ? 'Harness 没有评分，这里只按花费倍数排序。' : '模型 + Harness 没有评分，这里只按花费倍数排序。'}</p>`}
      ${scored ? `<details class="board-unranked cost-data"><summary>查看数据表${icon('next')}</summary>${costTable(tableRows, { currency, fx: pricing?.fx })}</details>` : costTable(tableRows, { currency, fx: pricing?.fx, scored: false })}`;
  }

  function table(data, { rows, unranked }) {
    if (isV3(data)) return tableV3(data, unranked);
    const hiddenCount = limitWorks && !showSmallSamples ? visibleBoardEntries(data, true).rows.length - rows.length : 0;
    const top = head(data, rows.length, hiddenCount);
    if (!rows.length && hiddenCount) {
      return `${top}<div class="board-empty"><p class="board-empty-title">当前没有作品数达到 5 件的条目</p><p>勾选「显示作品少于 5 件的条目」可查看已有评分，暂定标记仍保留。</p></div>`;
    }
    if (!rows.length) return empty(data, top, unranked);
    const at = axis(rows);
    const cost = costColumn(rows);
    const body = rows.map((row, index) => {
      const rank = index + 1;
      const m = modelOf(row);
      return `<tr${row.provisional ? ' class="is-provisional"' : ''} data-board-row="${searchText(row, m)}">
      <td class="c-rank${rank <= 3 ? ' is-top' : ''}">${pad(rank)}</td>
      <td class="c-model"><span class="board-model">${brandMark(m, 'brand-mark sm')}<span class="board-name">${nameParts(data, row)}<small>${[vendorLine(m), ...standingsOf(data, row)].join(' · ')}</small></span></span></td>
      <td class="c-score"><b><span data-i18n-number="${row.score}">${row.score}</span></b><small>±<span data-i18n-number="${row.interval}">${row.interval}</span></small></td>
      <td class="c-range" aria-hidden="true">${rangeBar(row, at)}</td>${costCell(cost, row)}
      ${recordCells(row)}
      <td class="c-works"><span data-i18n-number="${row.works}">${row.works}</span></td>
    </tr>`;
    }).join('');
    return `${top}<div class="board-wrap"><table class="board">
      <thead><tr><th class="c-rank" scope="col">名次</th><th class="c-model" scope="col">${unit === 'model' ? '模型' : '模型 · 档位'}</th><th class="c-score" scope="col">评分</th><th class="c-range" scope="col"><span class="sr">区间</span></th>${cost ? COST_HEAD : ''}<th class="c-games" scope="col">比较</th><th class="c-record" scope="col">胜 · 平 · 负</th><th class="c-rate" scope="col">胜率</th><th class="c-works" scope="col">作品</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>${cost ? COST_NOTE : ''}
    <p class="muted filter-empty" data-board-none hidden>没有匹配的模型，请换个关键词。</p>
    ${unrankedList(unranked)}`;
  }

  // v3 (plan 03): the server ranks and groups; the page adds rank ranges, the composite's category
  // columns, and the two folded groups below the ranking.
  function tableV3(data, unranked) {
    const s = data.scoring;
    const rows = data.rows, partial = data.partial ?? [], watch = data.watch ?? [];
    const top = head(data, rows.length);
    if (!rows.length && !partial.length && !watch.length) return empty(data, top, unranked);
    // The composite lists its categories as columns on wide screens and as a line under the name on narrow ones.
    const cats = overall ? Object.keys(s.composite ?? {}) : [];
    const composite = cats.length > 0;
    const cost = costColumn(rows);
    const columns = (composite ? 7 + cats.length : 8) + (cost ? 1 : 0);
    const at = axis(rows);
    // Numbers stay with their words (no-break spaces); platform.css lets a Chinese reason break only after its comma.
    const nb = (text) => text.replaceAll(' ', '\u00a0');
    const reasonText = (row) => (row.reasons ?? []).map((reason) => `<span>${reason === 'coverage' ? '没有哪一类达标'
      : reason === 'tasks' ? nb(`${row.tasks} 道题，不足 ${s.minimumTasks} 道`)
        : reason === 'task-share' ? nb(row.taskShare == null ? `单题占比超过 ${percent(s.maxTaskShare)}%` : `单题占 ${Math.ceil(row.taskShare * 100)}%，超过 ${percent(s.maxTaskShare)}%`)
          : reason === 'voters' ? nb(row.effectiveVoters == null ? `有效投票者不足 ${s.minimumEffectiveVoters} 人` : `有效投票者 ${Math.floor(row.effectiveVoters)} 人，不足 ${s.minimumEffectiveVoters} 人`)
            : esc(reason)}</span>`).join('<span> · </span>');
    const partLabel = (part) => part?.rank ? `第 ${part.rank}` : '未达标';
    const partsLine = (row) => composite ? `<small class="board-parts">${cats.map((c) => `<span class="board-part${row.parts?.[c]?.rank ? '' : ' is-missing'}"><span>${esc(categoryLabel(c))}</span> <span>${partLabel(row.parts?.[c])}</span></span>`).join('<span> · </span>')}</small>` : '';
    // What a score and its ± are made of, per group (contracts/leaderboard-v3.md): a ranked composite row is
    // the three category scores combined, and its intervalVotes is a pooled diagnostic that must not be split
    // out; a composite watch row is the weighted pooled reference score; other boards split votes and questions.
    const spreadOf = (row, group) => {
      if (composite && group === 'ranked') return '三类区间合成，已含投票和换题的波动';
      if (row.intervalVotes == null) return composite ? '混合池参考分，不参与综合排名' : '';
      const votes = Math.round(row.intervalVotes), tasks = Math.round(Math.sqrt(Math.max(0, row.interval ** 2 - row.intervalVotes ** 2)));
      const split = tasks ? `投票 ±${votes}，换题 ±${tasks}` : `投票 ±${votes}`;
      return composite ? `混合池参考分，不参与综合排名；${split}` : split;
    };
    // The explanation sits in a focusable button: hover, keyboard focus or a tap shows it (platform.css .score-tip).
    const scoreCell = (row, group) => {
      if (row.score == null) return '<td class="c-score">—</td>';
      const value = `<b><span data-i18n-number="${Math.round(row.score)}">${Math.round(row.score)}</span></b><small>±<span data-i18n-number="${Math.round(row.interval)}">${Math.round(row.interval)}</span></small>`;
      const spread = spreadOf(row, group);
      if (!spread) return `<td class="c-score">${value}</td>`;
      const id = `board-tip-${board}-${++tips}`;
      return `<td class="c-score"><span class="score-tip"><button type="button" class="score-tip-btn" data-score-tip aria-describedby="${id}">${value}</button><span class="score-tip-text" role="tooltip" id="${id}">${spread}</span></span></td>`;
    };
    const line = (row, m, extra = '') => `<td class="c-model"><span class="board-model">${brandMark(m, 'brand-mark sm')}<span class="board-name">${nameParts(data, row)}<small>${[vendorLine(m), ...(ctx.task || row.tasks == null ? [] : [`<span>${row.tasks} 道题</span>`])].join(' · ')}</small>${extra}</span></span></td>`;
    const tail = (row) => `${recordCells(row)}${composite ? '' : `<td class="c-works">${row.works == null ? '—' : `<span data-i18n-number="${row.works}">${row.works}</span>`}</td>`}`;
    const render = (group) => (row) => {
      const m = modelOf(row);
      const rank = group === 'ranked' ? `<td class="c-rank${row.rank <= 3 ? ' is-top' : ''}">${pad(row.rank)}${row.rankLow != null && row.rankHigh != null && row.rankLow !== row.rankHigh ? `<small class="rank-range">${row.rankLow}–${row.rankHigh}</small>` : ''}</td>` : '<td class="c-rank">—</td>';
      const reasons = group === 'watch' ? `<small class="board-reasons">${reasonText(row)}</small>` : '';
      const middle = group === 'watch' ? (composite ? `<td class="c-reason" colspan="${cats.length}">${reasonText(row)}</td>` : '')
        : cats.map((c) => {
          const part = row.parts?.[c];
          return `<td class="c-part${part?.rank ? '' : ' is-missing'}">${part?.aligned != null ? `<span data-i18n-number="${Math.round(part.aligned)}">${Math.round(part.aligned)}</span>` : ''}<small>${partLabel(part)}</small></td>`;
        }).join('');
      return `<tr class="${[`is-${group}`, row.provisional ? 'is-provisional' : ''].filter(Boolean).join(' ')}" data-board-row="${searchText(row, m)}" data-board-in="${group}">
      ${rank}
      ${line(row, m, group === 'watch' ? reasons : partsLine(row))}
      ${scoreCell(row, group)}
      <td class="c-range" aria-hidden="true">${group === 'ranked' ? rangeBar(row, at) : ''}</td>${costCell(cost, row)}
      ${middle}
      ${tail(row)}
    </tr>`;
    };
    const fold = (group, note, list) => {
      if (!list.length) return '';
      const open = openGroups.has(group);
      return `<tbody class="board-group${open ? ' is-open' : ''}" data-board-group="${group}">
      <tr class="board-group-head"><th colspan="${columns}" scope="rowgroup"><button type="button" data-board-group-toggle="${group}" aria-expanded="${open}">${icon('next')}<b>${GROUPS[group]}</b><span class="board-group-count" data-i18n-number="${list.length}">${list.length}</span><span class="board-group-note">${note}</span></button></th></tr>
      ${list.map(render(group)).join('')}
    </tbody>`;
    };
    const noun = unit === 'model' ? '模型' : '配置';
    return `${top}<p class="board-meta board-found" data-board-found hidden></p><div class="board-wrap"><table class="board is-v3${composite ? ' is-composite' : ''}${cost ? ' has-cost' : ''}">
      <thead><tr><th class="c-rank" scope="col">名次</th><th class="c-model" scope="col">${unit === 'model' ? '模型' : '模型 · 档位'}</th><th class="c-score" scope="col">评分</th><th class="c-range" scope="col"><span class="sr">区间</span></th>${cost ? COST_HEAD : ''}${cats.map((c) => `<th class="c-part" scope="col">${esc(categoryLabel(c))}</th>`).join('')}<th class="c-games" scope="col">比较</th><th class="c-record" scope="col">胜 · 平 · 负</th><th class="c-rate" scope="col">实际胜率</th>${composite ? '' : '<th class="c-works" scope="col">作品</th>'}</tr></thead>
      <tbody data-board-group="ranked">${rows.length ? rows.map(render('ranked')).join('') : `<tr class="board-group-empty"><td colspan="${columns}">还没有达标的${noun}，已有成绩的列在下方。</td></tr>`}</tbody>
      ${fold('partial', '有各类名次，缺类的不进综合排名', partial)}
      ${fold('watch', '有分数，暂不排名', watch)}
    </table></div>${cost ? COST_NOTE : ''}
    <p class="muted filter-empty" data-board-none hidden>没有匹配的模型，请换个关键词。</p>
    ${unrankedList(unranked)}`;
  }

  // Search covers every group: a folded group with matches opens, and a line says where the matches are.
  function applyQuery() {
    // The cost view has no rows to hide: it redraws its chart and tables for the query.
    const costBody = ctx.view === 'cost' && pricing && currentData ? $('[data-cost-body]', container) : null;
    if (costBody) costBody.innerHTML = costView(currentData);
    const rows = [...container.querySelectorAll('[data-board-row]')];
    const found = {};
    for (const row of rows) {
      row.hidden = !textMatches(query, row.dataset.boardRow);
      if (!row.hidden) found[row.dataset.boardIn ?? ''] = (found[row.dataset.boardIn ?? ''] ?? 0) + 1;
    }
    const shown = Object.values(found).reduce((sum, n) => sum + n, 0);
    const none = $('[data-board-none]', container);
    if (none) none.hidden = shown > 0 || !rows.length;
    for (const group of container.querySelectorAll('tbody[data-board-group]')) {
      const name = group.dataset.boardGroup;
      const open = name === 'ranked' || openGroups.has(name) || Boolean(query && found[name]);
      group.classList.toggle('is-open', open);
      $('[data-board-group-toggle]', group)?.setAttribute('aria-expanded', String(open));
    }
    const where = $('[data-board-found]', container);
    if (where) {
      where.hidden = !query || !shown;
      where.innerHTML = ['<span>搜索结果</span>', ...Object.keys(GROUPS).filter((name) => found[name]).map((name) => `<span>${GROUPS[name]}</span> <span data-i18n-number="${found[name]}">${found[name]}</span>`)].join(' · ');
    }
  }

  let drawn = false;
  function draw(data) {
    if (ctx.curated && data.audience !== 'curated') throw new Error('后端尚未支持精选榜，请更新后端后重试');
    if (!Array.isArray(data.rows) || !Array.isArray(data.unranked) || !data.totals) throw new Error('服务暂时不可用，请稍后重试。');
    // The scoring version decides the default unit; a board that changed version reloads in its own default.
    if (!ctx.curated && isV3(data) !== v3) {
      v3 = isV3(data);
      store.set('board-scoring', v3 ? '3' : '2');
      if (pickUnit() !== unit) {
        unit = pickUnit();
        load();
        return;
      }
    }
    if (ctx.view === 'cost' && costScope) {
      const typing = document.activeElement?.matches('[data-board-search]');
      container.innerHTML = head(data, rankedRows(data).length) + `<div data-cost-body>${pricing ? costView(data) : '<p class="muted">正在载入花费…</p>'}</div>`;
      if (typing) $('[data-board-search]', container)?.focus();
      currentData = data;
      ctx.onData?.(data, { visibleRows: rankedRows(data).length });
      drawn = true;
      return;
    }
    // A fresh board can land while the reader types; the search keeps its focus.
    const typing = document.activeElement?.matches('[data-board-search]');
    const togglingSamples = document.activeElement?.matches('[data-board-small]');
    const visible = v3 ? { rows: data.rows, unranked: [] } : visibleBoardEntries(data, !limitWorks || showSmallSamples);
    container.innerHTML = table(data, visible) + (ctx.embedded ? boardNotes(false, null, limitWorks, data.scoring) : '');
    if (typing) $('[data-board-search]', container)?.focus();
    if (togglingSamples) $('[data-board-small]', container)?.focus();
    applyQuery();
    currentData = data;
    ctx.onData?.(data, { visibleRows: visible.rows.length });
    drawn = true;
  }
  // A board seen before draws at once from memory; the fresh one replaces it only if it differs.
  function load() {
    if (destroyed) return Promise.resolve();
    const params = new URLSearchParams({ by: unit, ...(ctx.curated ? { audience: 'curated', ...(ctx.sectionId ? { sectionId: ctx.sectionId } : {}) } : ctx.task ? { task: ctx.task.id } : { ...(ctx.category ? { category: ctx.category } : {}), ...(ctx.domain ? { domain: ctx.domain } : {}) }) });
    if (filterable) for (const [field, value] of Object.entries(filters)) if (value) params.set(field, value);
    const path = `leaderboard${nextBoard ? '/next' : ''}?${params}`;
    if (request?.path === path) return request.promise;
    request?.controller.abort();
    const controller = new AbortController();
    const reading = { path, controller, promise: null };
    request = reading;
    let known = recall(path);
    let fromMemory = false;
    container.setAttribute('aria-busy', 'true');
    $('[data-board-error]', container)?.remove();
    // Include the JSON body in the deadline. Cancelled responses may finish late;
    // only this request may draw or clear the busy state.
    let reject;
    const cancelled = new Promise((_, fail) => { reject = fail; });
    const onAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(new DOMException('连接超时，请重试。', 'TimeoutError')), 15000);
    reading.promise = (async () => { try {
      if (known) {
        try { draw(known); fromMemory = true; }
        catch { known = null; } // A malformed cached answer must not prevent a fresh retry.
      }
      const data = await Promise.race([apiRemembered(path, { signal: controller.signal }), cancelled]);
      if (destroyed || request !== reading || controller.signal.aborted) return;
      if (JSON.stringify(data) !== JSON.stringify(known)) draw(data);
      ctx.onLoad?.(data);
      return data;
    } catch (error) {
      if (error.name === 'AbortError' || destroyed || request !== reading) return;
      const message = `<div data-board-error role="status"><p class="muted">榜单暂时无法载入：${esc(error.message)}</p><button class="btn sm" type="button" data-board-retry>重试加载</button></div>`;
      if (fromMemory) container.insertAdjacentHTML('afterbegin', message);
      else container.innerHTML = message;
    } finally {
      clearTimeout(timer);
      controller.signal.removeEventListener('abort', onAbort);
      if (request === reading) { request = null; container.removeAttribute('aria-busy'); }
    } })();
    return reading.promise;
  }

  // One score explanation at a time, whether a mouse hovers it, the keyboard focuses it or a tap opens it.
  // Hovering the open explanation keeps it; Escape closes it. Near the top of the scrolling table it opens downward.
  const closeTips = (except) => {
    for (const tip of container.querySelectorAll('.score-tip.is-open')) if (tip !== except) tip.classList.remove('is-open');
  };
  const openTip = (tip) => {
    closeTips(tip);
    const wrap = tip.closest('.board-wrap')?.getBoundingClientRect(), box = tip.getBoundingClientRect();
    const height = tip.querySelector('.score-tip-text')?.offsetHeight ?? 0;
    // The first visible row of a folded group opens downward too, so the group's heading stays readable.
    // Rows hidden by the search are skipped.
    let above = tip.closest('tr')?.previousElementSibling;
    while (above?.hidden) above = above.previousElementSibling;
    const underHeading = above?.classList.contains('board-group-head');
    tip.classList.toggle('is-below', Boolean(wrap) && (underHeading ? wrap.bottom - box.bottom > height + 8
      : box.top - wrap.top < height + 8 && wrap.bottom - box.bottom > box.top - wrap.top));
    tip.classList.add('is-open');
  };
  const onOver = (e) => {
    const tip = e.pointerType === 'mouse' && e.target.closest?.('.score-tip');
    if (tip && !tip.classList.contains('is-open')) openTip(tip);
  };
  const onOut = (e) => {
    const tip = e.pointerType === 'mouse' && e.target.closest?.('.score-tip');
    if (tip && !tip.contains(e.relatedTarget) && !tip.contains(document.activeElement)) tip.classList.remove('is-open');
  };
  const onFocusIn = (e) => { if (e.target.matches?.('[data-score-tip]:focus-visible')) openTip(e.target.parentElement); };
  const onFocusOut = (e) => { if (e.target.matches?.('[data-score-tip]')) e.target.parentElement.classList.remove('is-open'); };
  const onKey = (e) => { if (e.key === 'Escape') closeTips(); };
  const onClick = (e) => {
    if (e.target.closest('.score-tip-text')) return;
    const tip = e.target.closest('[data-score-tip]')?.parentElement;
    if (tip?.classList.contains('is-open') && e.pointerType !== 'mouse') return void tip.classList.remove('is-open');
    if (tip) return void openTip(tip);
    closeTips();
    if (e.target.closest('[data-board-retry]')) return void load();
    const view = e.target.closest('[data-board-view]');
    if (view) return void ctx.setView?.(view.dataset.boardView);
    const costSet = e.target.closest('[data-cost-set]');
    if (costSet) {
      if (costSet.dataset.costSet === '币种') { currency = costSet.dataset.value; store.set('usage-currency', currency); }
      else costX = costSet.dataset.value;
      return void (currentData && draw(currentData));
    }
    const fold = e.target.closest('[data-board-group-toggle]');
    if (fold) {
      const name = fold.dataset.boardGroupToggle;
      if (!openGroups.delete(name)) openGroups.add(name);
      return void applyQuery();
    }
    if (e.target.closest('[data-curated-arena]')) {
      arenaScope.set(currentData?.scope?.taskIds ?? []);
      location.hash = '#/arena/random';
      return;
    }
    const button = e.target.closest('[data-board-unit]');
    if (!button || button.dataset.boardUnit === unit) return;
    unit = button.dataset.boardUnit;
    costBy = null;
    store.set(unitKey(), unit);
    load();
  };
  const onChange = (e) => {
    if (limitWorks && e.target.matches('[data-board-small]')) {
      showSmallSamples = e.target.checked;
      store.set('board-show-small-samples', String(showSmallSamples));
      if (currentData) draw(currentData);
      return;
    }
    if (e.target.matches('[data-cost-connect]')) { connect = e.target.checked; return void (currentData && draw(currentData)); }
    if (e.target.matches('[data-cost-by]')) {
      const by = e.target.value;
      costBy = by === 'harness' || by === 'pair' ? by : null;
      if (!costBy && by !== unit) { unit = by; store.set(unitKey(), unit); return void load(); }
      return void (currentData && draw(currentData));
    }
    const select = e.target.closest('[data-board-filter]');
    if (!select) return;
    filters[select.dataset.boardFilter] = select.value;
    load();
  };
  container.addEventListener('click', onClick);
  container.addEventListener('change', onChange);
  // Escape also dismisses an explanation opened by hovering while focus is elsewhere on the page.
  container.ownerDocument?.addEventListener('keydown', onKey);
  container.addEventListener('focusin', onFocusIn);
  container.addEventListener('focusout', onFocusOut);
  container.addEventListener('pointerover', onOver);
  container.addEventListener('pointerout', onOut);
  const loading = load();
  // Amounts and the cost view wait for the server's switch; with it off the board stays as it was.
  if (costScope) (ctx.pricing ?? pricingInfo()).then((info) => {
    if (destroyed) return;
    pricing = info;
    costOn = costShown(info);
    if (!costOn && ctx.view === 'cost') return void ctx.setView?.('rank', true);
    if (currentData && (costOn || ctx.view === 'cost')) draw(currentData);
  });
  return {
    ready: drawn ? null : loading,
    reload: load,
    search(value) {
      text = value;
      query = value.trim().toLowerCase();
      applyQuery();
    },
    destroy() {
      destroyed = true;
      request?.controller.abort();
      container.removeEventListener('click', onClick);
      container.removeEventListener('change', onChange);
      container.ownerDocument?.removeEventListener('keydown', onKey);
      container.removeEventListener('focusin', onFocusIn);
      container.removeEventListener('focusout', onFocusOut);
      container.removeEventListener('pointerover', onOver);
      container.removeEventListener('pointerout', onOut);
    },
  };
}

// The page's views are 综合 plus one per voted category; a task narrows its category's view.
// A domain narrows 综合 or a category (never a task) and rides as the last part of the address.
// The curated rankings sit beside them: #/leaderboard/curated (overall) and .../curated/<sectionId>.
// AI-graded questions are not ranked here.
export function mount(root, ctx) {
  const tasks = ctx.DATA.tasks.filter(votedTask);
  const tracks = tracksOf(tasks);
  const parts = (routeParts(location.hash) ?? []).slice(1);
  // A trailing /cost opens the cost chart of the same board (#/leaderboard[/<category>][/<domain>]/cost).
  const costView = parts.at(-1) === 'cost';
  if (costView) parts.pop();
  const [first = null, second = null] = parts;
  const rankHref = ['#/leaderboard', ...parts.map(encodeURIComponent)].join('/');
  const setView = (view, replace = false) => {
    const href = view === 'cost' ? `${rankHref}/cost` : rankHref;
    if (replace) location.replace(href); else location.hash = href;
  };
  const curated = first === 'curated';
  if (curated && second === 'frontend') {
    location.replace('#/leaderboard/curated');
    return {};
  }
  const sectionId = curated ? second : null;
  const task = !curated && first ? tasks.find((t) => t.id === first) ?? null : null;
  const track = curated ? null : task ? tracks.find((x) => x.name === task.category) ?? null : first ? tracks.find((x) => x.slug === first) ?? null : null;
  const hasDomain = (name) => tasks.some((t) => domainsOf(t).includes(name));
  const domain = curated || task ? null : !track && hasDomain(first) ? first : track && hasDomain(second) ? second : null;
  if ((first && !curated && !task && !track && !domain) || (costView && (curated || task))) {
    location.replace(task ? rankHref : '#/leaderboard');
    return {};
  }
  const base = track ? `#/leaderboard/${encodeURIComponent(track.slug)}` : '#/leaderboard';
  // Tasks of the current category (and domain), in the task page's select idiom: the option text carries the count.
  const listed = track ? track.tasks.filter((t) => !domain || domainsOf(t).includes(domain)) : [];
  const taskSelect = () => track ? `<label class="result-sort">题目<select data-board-task aria-label="按题目查看">${boardTaskOptions(listed, task?.id, platform.activityReady, platform.arena)}</select></label>` : '';
  const domains = task || curated ? [] : domainsIn(track?.tasks ?? tasks, domainList(platform));
  const domainSelect = domains.length ? `<label class="result-sort">领域<select data-board-domain aria-label="按领域查看">
      <option value="">全部领域</option>
      ${domains.map((d) => `<option value="${esc(d.name)}"${d.name === domain ? ' selected' : ''}>${esc(d.name)}（${d.tasks.length} 题）</option>`).join('')}
    </select></label>` : '';

  // The curated group is drawn from what the server says; sections without questions stay out of public view.
  const curatedNav = (info) => {
    const sections = (info?.sections ?? []).filter((section) => section.questionCount > 0);
    const total = (info?.sections ?? []).reduce((sum, section) => sum + (section.questionCount ?? 0), 0);
    const link = (href, glyph, text, current, count) => `<a class="side-link" href="${esc(href)}"${current ? ' aria-current="page"' : ''}>${icon(glyph)}<span data-i18n-ignore>${esc(text)}</span><span class="nav-count">${count}</span></a>`;
    if (info && !total) return `<nav class="side-nav section-nav" aria-label="精选榜"><button class="side-link" type="button" disabled>${icon('rank')}总榜 · 暂无精选题</button></nav>`;
    return `<nav class="side-nav section-nav" aria-label="精选榜">${info ? [
      `<a class="side-link" href="#/leaderboard/curated"${curated && !sectionId ? ' aria-current="page"' : ''}>${icon('rank')}总榜<span class="nav-count">${total}</span></a>`,
      ...sections.map((section) => link(`#/leaderboard/curated/${encodeURIComponent(section.id)}`, 'bookmark', section.name, section.id === sectionId, section.questionCount)),
    ].join('') : `<a class="side-link" href="#/leaderboard/curated"${curated && !sectionId ? ' aria-current="page"' : ''}>${icon('rank')}总榜</a>`}</nav>`;
  };
  const stat = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;

  let board = null, live = null, destroyed = false, drawn = null, notesScoring = 'null';
  const onChange = (e) => {
    const select = e.target.closest('[data-board-task]');
    if (select) location.hash = select.value ? `#/leaderboard/${encodeURIComponent(select.value)}` : domain ? `${base}/${encodeURIComponent(domain)}` : base;
    const scope = e.target.closest('[data-board-domain]');
    if (scope) location.hash = scope.value ? `${base}/${encodeURIComponent(scope.value)}` : base;
  };
  const onInput = (e) => { if (e.target.matches('[data-board-search]')) board?.search(e.target.value); };
  root.addEventListener('change', onChange);
  root.addEventListener('input', onInput);

  // Draw the page. A curated view needs the structure first (names, counts, since-date); the others only
  // refresh the curated group of the side nav once it arrives.
  function render(info) {
    notesScoring = 'null';
    live?.destroy();
    board?.destroy();
    const section = sectionId ? info?.sections.find((x) => x.id === sectionId) ?? null : null;
    const scopeTitle = curated ? (sectionId ? `精选 · ${section?.name ?? ''}` : '精选总榜')
      : task?.title ?? (domain ? `${track ? `${track.label} · ` : ''}${domain}排行` : track ? `${track.label}排行` : '综合排行');
    const crumbs = [{ text: '排行榜', ...(task || track || domain || curated ? { href: '#/leaderboard' } : {}) }];
    if (curated) crumbs.push(sectionId ? { text: '精选榜', href: '#/leaderboard/curated' } : { text: '精选榜' }, ...(sectionId ? [{ text: section?.name ?? '', original: true }] : []));
    if (track) crumbs.push(task || domain ? { text: track.label, href: base } : { text: track.label });
    if (domain) crumbs.push({ text: domain });
    if (task) crumbs.push({ text: task.title, original: true });
    const since = info?.countingStartedAt;
    const description = !curated ? '由全部计票的盲评选择计算。分数反映作品在同题比较中被偏好的程度，区间越窄，结论越可靠。'
      : sectionId ? `精选总榜中「${section?.name ?? ''}」分区的 ${section?.questionCount ?? 0} 道题，单独计算名次。`
        : !info?.includesStaffHistory ? `只统计 Lv1 及以上成员（通过资格考试）在精选题上的选择，题目由管理员挑选。和大众榜分开计票${since ? `，${formatDate(since)} 起从零累计` : ''}。`
        : `统计认证成员${since ? `自 ${formatDate(since)} 起` : ''}在精选题上的选择，并纳入普通管理员和高级管理员的历史有效票。题目由管理员挑选，和大众榜分开计票。`;
    root.innerHTML = `${ctx.pageStart({ title: '排行榜', section: 'leaderboard', heading: scopeTitle, headingOriginal: Boolean(task), crumbs, description,
      meta: `<dl class="side-stats" data-stats>
          ${stat('有效比较', !curated && platform.activityReady ? pad(platform.totals.votes) : '—')}
          ${stat('参与者', !curated && platform.activityReady ? pad(platform.totals.voters) : '—')}
        </dl>`,
      nav: `<div class="board-nav-groups">
      <section class="board-nav-group">
        <h2 class="board-nav-title">大众榜</h2>
        ${ctx.sideNav('大众榜', [['#/leaderboard', 'rank', '综合', !curated && !track && !task && !domain, tasks.length],
          ...tracks.map((x) => [`#/leaderboard/${encodeURIComponent(x.slug)}`, x.glyph, x.label, x === track, x.tasks.length])])}
      </section>
      <section class="board-nav-group" data-curated-nav>
        <h2 class="board-nav-title">精选榜</h2>
        ${curatedNav(info)}
      </section>
    </div>` })}
    <section class="block wrap">
      <div data-board><p class="muted">正在载入榜单…</p></div>
      ${boardNotes(false, curated ? { since, threshold: 30 } : null, !task)}
    </section>
  ${ctx.pageEnd()}`;
    drawn = info;
    if (curated && !info) return;
    board = mountBoard($('[data-board]', root), {
      ...ctx,
      task,
      curated,
      sectionId,
      info,
      category: task ? null : track?.name ?? null,
      domain,
      tracks: task || track || domain || curated ? null : tracks,
      toolbar: () => domainSelect + taskSelect(),
      view: costView ? 'cost' : 'rank',
      setView,
      emptyTitle: domain ? `${domain}榜单还在等第一批盲评` : track && !task ? `${track.label}榜单还在等第一批盲评` : undefined,
      onLoad: (data) => live?.update(data),
      onData: (data, { visibleRows }) => {
        // v3 notes are written from the board's own thresholds.
        const notes = $('.board-notes', root);
        if (notes && JSON.stringify(data.scoring ?? null) !== notesScoring) {
          notesScoring = JSON.stringify(data.scoring ?? null);
          notes.outerHTML = boardNotes(notes.open, curated ? { since: info?.countingStartedAt, threshold: 30 } : null, !task, data.scoring);
        }
        const stats = $('[data-stats]', root);
        if (stats) stats.innerHTML = stat('有效比较', pad(data.totals.votes)) + stat('参与者', pad(data.totals.voters)) + stat(data.by === 'model' ? '上榜模型' : '上榜配置', pad(visibleRows));
      },
    });
    live = watchBoardRefresh(() => board.reload());
    return board.ready;
  }
  setPageTitle(['榜单', curated ? (sectionId ? '精选榜' : '精选总榜') : { text: task?.title ?? (domain ? `${track ? `${track.label} · ` : ''}${domain}排行` : track ? `${track.label}排行` : '综合排行'), original: Boolean(task) }, ctx.DATA.title]);
  const known = curatedKnown();
  let ready = render(known);
  const loaded = curatedInfo().then((info) => {
    if (destroyed) return;
    if (sectionId && !info.sections.some((section) => section.id === sectionId && section.questionCount >= 0)) {
      location.replace('#/leaderboard/curated');
      return;
    }
    // Curated views depend on the structure; others only refresh the curated group.
    if (curated && !known) return render(info);
    if (curated && (JSON.stringify(info.sections) !== JSON.stringify(known.sections)
      || info.includesStaffHistory !== known.includesStaffHistory || info.countingStartedAt !== known.countingStartedAt)) return render(info);
    const group = $('[data-curated-nav]', root);
    if (group) group.innerHTML = `<h2 class="board-nav-title">精选榜</h2>${curatedNav(info)}`;
  }, () => { if (curated && !destroyed && !drawn) { $('[data-board]', root).innerHTML = '<p class="muted">精选榜暂时无法载入，请稍后重试。</p>'; } });
  if (curated && !known) ready = loaded;
  return {
    ready,
    onPlatformChange: (reason) => {
      if (reason === 'activity' || reason === 'identity') {
        const select = $('[data-board-task]', root);
        if (select) select.innerHTML = boardTaskOptions(listed, select.value, platform.activityReady, platform.arena);
        return live?.refresh();
      }
      if (!['session', 'session-ready'].includes(reason)) return live?.refresh();
    },
    destroy: () => {
      destroyed = true;
      live?.destroy();
      board?.destroy();
      root.removeEventListener('change', onChange);
      root.removeEventListener('input', onInput);
    },
  };
}
