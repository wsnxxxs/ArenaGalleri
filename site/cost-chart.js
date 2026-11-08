// The leaderboard's cost chart (#/leaderboard/cost; token-cost design §5.5): score against cost
// multiple on a log scale, the frontier of entries nothing beats on both, the steps along it and the
// full numbers in a folded table. HTML/SVG builders only; leaderboard.js decides when it shows.
import { esc } from './ui.js';
import { formatMoney, formatMultiple } from './usage.js';

const W = 880, H = 440, M = { left: 58, right: 24, top: 34, bottom: 52 };
const fmt = (n) => Math.round(n).toLocaleString('en');

// x: 'multiple' (×, 1× is the question's median) or 'cost' (median cost per work, in CNY).
// points: [{ key, name, model, x, y, status, frontier }]
export function scatter(points, { x = 'multiple', connect = false, currency = 'CNY', fx } = {}) {
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const lo = Math.min(...xs, x === 'multiple' ? 1 : Infinity) / 1.25, hi = Math.max(...xs, x === 'multiple' ? 1 : -Infinity) * 1.25;
  const yStep = (Math.max(...ys) - Math.min(...ys)) > 300 ? 100 : 50;
  const yLo = Math.floor((Math.min(...ys) - 10) / yStep) * yStep, yHi = Math.ceil((Math.max(...ys) + 10) / yStep) * yStep;
  const px = (v) => M.left + Math.log(v / lo) / Math.log(hi / lo) * (W - M.left - M.right);
  const py = (v) => H - M.bottom - (v - yLo) / Math.max(yHi - yLo, 1) * (H - M.top - M.bottom);
  // Ticks at 1, 2 and 5 of each decade in range.
  const xTicks = [];
  for (let d = 10 ** Math.floor(Math.log10(lo)); d <= hi; d *= 10) for (const m of [1, 2, 5]) if (d * m >= lo && d * m <= hi) xTicks.push(d * m);
  const yTicks = []; for (let v = yLo; v <= yHi; v += yStep) yTicks.push(v);
  const xLabel = (v) => x === 'multiple' ? formatMultiple(v).replace(/\.?0+×$/, '×') : formatMoney(v, currency, fx);
  const front = points.filter((p) => p.frontier).sort((a, b) => a.x - b.x);
  const steps = front.slice(1).map((p, i) => `L${px(p.x).toFixed(1)},${py(front[i].y).toFixed(1)} L${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');
  const byModel = new Map();
  if (connect) for (const p of points) byModel.set(p.model, [...(byModel.get(p.model) ?? []), p]);
  const links = [...byModel.values()].filter((list) => list.length > 1)
    .map((list) => `<polyline class="cc-link" points="${list.sort((a, b) => a.x - b.x).map((p) => `${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ')}"></polyline>`).join('');
  const dot = (p) => {
    const cls = p.status === 'provisional' ? 'cc-dot is-provisional' : p.frontier ? 'cc-dot is-front' : 'cc-dot';
    return `<circle class="${cls}" cx="${px(p.x).toFixed(1)}" cy="${py(p.y).toFixed(1)}" r="${p.frontier ? 4.5 : 3.8}"><title>${esc(`${p.name} · ${xLabel(p.x)} · ${fmt(p.y)}`)}</title></circle>`;
  };
  // Only frontier entries are named on the chart; the table has the rest.
  const labels = front.map((p) => `<text class="cc-name" x="${(px(p.x) - 8).toFixed(1)}" y="${(py(p.y) - 9).toFixed(1)}" text-anchor="end" data-i18n-ignore>${esc(p.name)}</text>`).join('');
  return `<svg class="cost-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="评分与花费散点图，前沿 ${front.length} 个">
    <g class="cc-grid">${xTicks.map((v) => `<line x1="${px(v).toFixed(1)}" x2="${px(v).toFixed(1)}" y1="${M.top}" y2="${H - M.bottom}"></line>`).join('')}${yTicks.map((v) => `<line x1="${M.left}" x2="${W - M.right}" y1="${py(v).toFixed(1)}" y2="${py(v).toFixed(1)}"></line>`).join('')}</g>
    ${x === 'multiple' ? `<line class="cc-median" x1="${px(1).toFixed(1)}" x2="${px(1).toFixed(1)}" y1="${M.top}" y2="${H - M.bottom}"></line><text class="cc-note" x="${(px(1) + 6).toFixed(1)}" y="${H - M.bottom - 8}">同题中位</text>` : ''}
    <g class="cc-axis">${xTicks.map((v) => `<text x="${px(v).toFixed(1)}" y="${H - M.bottom + 18}" text-anchor="middle">${xLabel(v)}</text>`).join('')}${yTicks.map((v) => `<text x="${M.left - 8}" y="${(py(v) + 4).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`).join('')}</g>
    <text class="cc-title" x="${M.left - 8}" y="${M.top - 16}" text-anchor="end">评分 ↑</text>
    <text class="cc-title" x="${(M.left + W - M.right) / 2}" y="${H - 10}" text-anchor="middle">${x === 'multiple' ? '花费倍数（对数刻度，同题中位 = 1×）→ 更贵' : '单件中位花费（对数刻度）→ 更贵'}</text>
    ${links}
    ${front.length > 1 ? `<path class="cc-front" d="M${px(front[0].x).toFixed(1)},${py(front[0].y).toFixed(1)} ${steps}"></path>` : ''}
    ${points.filter((p) => !p.frontier).map(dot).join('')}${front.map(dot).join('')}
    ${labels}
  </svg>`;
}

// Each step along the frontier reads "this many times the cost, this many more points".
export function frontierSteps(front, { x = 'multiple', currency = 'CNY', fx } = {}) {
  if (!front.length) return '';
  const value = (p) => x === 'multiple' ? formatMultiple(p.x) : formatMoney(p.x, currency, fx);
  return `<ol class="cost-path" aria-label="前沿路径">${front.map((p, i) => `${i ? `<li class="cost-step" aria-hidden="true"><span>×${(p.x / front[i - 1].x).toFixed(1)}</span><span>+${fmt(p.y - front[i - 1].y)}</span></li>` : ''}
    <li class="cost-node"><b data-i18n-ignore>${esc(p.name)}</b><small>${value(p)} · ${fmt(p.y)}</small></li>`).join('')}</ol>`;
}

const STATUS = { front: '前沿', firm: '', provisional: '暂定', insufficient: '样本不足', unrated: '无评分' };
// rows: [{ name, works, tasks, multiple, medianCost, score?, status, frontier }]
export function costTable(rows, { currency = 'CNY', fx, scored = true } = {}) {
  return `<div class="board-wrap"><table class="board cost-table">
    <thead><tr><th class="c-model" scope="col">名称</th><th scope="col">花费倍数</th><th scope="col">单件中位</th><th scope="col">计入件数</th><th scope="col">题数</th>${scored ? '<th scope="col">评分</th>' : ''}<th scope="col">状态</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td class="c-model"><b data-i18n-ignore>${esc(r.name)}</b></td><td>${formatMultiple(r.multiple)}</td><td>${formatMoney(r.medianCost, currency, fx)}</td>
      <td><span data-i18n-number="${r.works}">${r.works}</span></td><td><span data-i18n-number="${r.tasks}">${r.tasks}</span></td>${scored ? `<td>${r.score == null ? '—' : fmt(r.score)}</td>` : ''}
      <td>${r.frontier ? '<span class="badge cost-tag">前沿</span>' : STATUS[r.status] ? `<span class="badge cost-tag is-soft">${STATUS[r.status]}</span>` : ''}</td></tr>`).join('')}</tbody>
  </table></div>`;
}
