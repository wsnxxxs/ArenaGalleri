// Developer team: the public starter page (#/team, #/team/<id>).
// Mirrors the #/changelog shell and timeline layout so contributor profiles can grow naturally.
import { locale, setPageTitle } from './i18n.js';
import { $, esc, icon } from './ui.js';
import { toast } from './platform.js';

const GROUPS = {
  origin: ['发起与统筹', 'Origin & Direction', 'guide'],
  engineering: ['产品与工程', 'Product & Engineering', 'code'],
  curation: ['题库与评测', 'Benchmarks & Review', 'blind'],
  community: ['社区与共建', 'Community & Contributors', 'user'],
};

const CHAPTERS = [
  {
    id: 'preface',
    zh: '序言 · 关于亿模亿样',
    en: 'Preface · About ArenaGalleri',
    entries: [
      {
        id: 'intro',
        code: '00',
        tagZh: '缘起',
        tagEn: 'Origin',
        group: 'origin',
        provisional: false,
        titleZh: '为什么不是一个人做出的平台',
        titleEn: 'Built together, not by one person',
        bodyZh: [
          '「亿模亿样」希望把同一份提示词交给不同 AI 模型，让可运行的网页、三维场景、文字与音乐作品并排接受真实检验。',
          '从最初的灵感与题目策划，到前端展览架构、隔离沙盒运行、盲评统计机制与题库日常维护，这个平台一直是在多位伙伴的协作、讨论与反复打磨中成型。',
          '当前页面作为开发团队介绍的初版框架，后续将逐步补充核心开发者、出题人与长期贡献者的署名、角色分工与个人主页链接。',
        ].join('\n\n'),
        bodyEn: [
          'ArenaGalleri puts the same prompt to different AI models so interactive web works, 3D scenes, writing, and music can be compared side by side.',
          'From initial prompt curation and exhibition UI engineering to isolated sandboxes, blind evaluation, and day-to-day moderation, the platform has been shaped through ongoing collaboration.',
          'This page serves as an opening structure for the team directory; individual contributor names, roles, and profile links will be added in upcoming updates.',
        ].join('\n\n'),
        link: '#/questions',
        linkZh: '浏览题库',
        linkEn: 'Browse questions',
      },
    ],
  },
  {
    id: 'roster',
    zh: '协作分工 · 成员名录整理中',
    en: 'Working Groups · Roster Coming Soon',
    entries: [
      {
        id: 'direction',
        code: '01',
        tagZh: '策划统筹',
        tagEn: 'Direction',
        group: 'origin',
        provisional: true,
        titleZh: '项目发起与整体方向',
        titleEn: 'Project initiation & overall direction',
        bodyZh: [
          '负责平台立意、评测标准设定、盲评机制设计与长期路线规划，协调各个方向保持统一的研究与策展水准。',
          '- 评测理念与公平性原则维护\n- 跨领域选题方向与版本节奏推进',
        ].join('\n\n'),
        bodyEn: [
          'Guides the platform vision, evaluation methodology, blind-arena design, and long-term roadmap across tracks.',
          '- Fairness principles and blind comparison rules\n- Cross-domain benchmark planning and release cadence',
        ].join('\n\n'),
      },
      {
        id: 'engineering',
        code: '02',
        tagZh: '前端与平台',
        tagEn: 'Engineering',
        group: 'engineering',
        provisional: true,
        titleZh: '展览前端、评测服务与基础设施',
        titleEn: 'Exhibition frontend, evaluation backend & infrastructure',
        bodyZh: [
          '负责静态展览馆与互动平台的前后端工程、沙盒安全隔离、自动化截图与多模型采样流水线，以及站点稳定性保障。',
          '- 并排对比视图、沙盘与展厅交互体验\n- 提交审核、榜单聚合与服务部署运维',
        ].join('\n\n'),
        bodyEn: [
          'Builds and maintains the gallery interface, sandbox isolation, automated capture pipelines, and server operations.',
          '- Side-by-side viewer, sandtable, and exhibition stage\n- Submission review workflow, ranking service, and deployment ops',
        ].join('\n\n'),
      },
      {
        id: 'curation',
        code: '03',
        tagZh: '题库与审校',
        tagEn: 'Benchmarks',
        group: 'curation',
        provisional: true,
        titleZh: '题目设计、采样复现与内容审核',
        titleEn: 'Prompt design, model sampling & submission review',
        bodyZh: [
          '持续设计覆盖语言、推理、设计、三维与音乐的高区分度题目，复现各模型真实输出，并承担作品与新题的社区审核。',
          '- 多模型横向采样与提示词打磨\n- 分类体系校准与解决状态追踪',
        ].join('\n\n'),
        bodyEn: [
          'Authors high-signal prompts across Language, Reasoning, Design, 3D, and Music, reproduces model outputs, and reviews community submissions.',
          '- Multi-model sampling and prompt iteration\n- Taxonomy maintenance and question solve-status tracking',
        ].join('\n\n'),
      },
      {
        id: 'community',
        code: '04',
        tagZh: '开放共建',
        tagEn: 'Community',
        group: 'community',
        provisional: false,
        titleZh: '每一位出题人、投稿者与盲评参与者',
        titleEn: 'Every prompt author, contributor, and blind-arena voter',
        bodyZh: [
          '除了核心开发与维护成员外，亿模亿样的丰富题库与榜单数据同样离不开每一位发起新题、补全模型作品、参与盲评投票并提出改进建议的朋友。',
          '如果你也想参与题目共建或加入开发协作，欢迎从发起一道新题开始，或通过页脚邮箱与我们联系。',
        ].join('\n\n'),
        bodyEn: [
          'Beyond core maintainers, ArenaGalleri grows thanks to everyone who authors prompts, submits model runs, casts blind-arena votes, and shares feedback.',
          'If you would like to contribute prompts or collaborate on development, start by proposing a question or reach out via the contact email in the footer.',
        ].join('\n\n'),
        link: '#/new',
        linkZh: '发起新题',
        linkEn: 'Propose a question',
      },
    ],
  },
];

const ALL_ENTRIES = CHAPTERS.flatMap((c) => c.entries);
const english = () => locale() === 'en';
const groupName = (key) => GROUPS[key][english() ? 1 : 0];
const chapterTitle = (chapter) => (english() ? chapter.en : chapter.zh);
const entryView = (entry) => (english()
  ? { tag: entry.tagEn, title: entry.titleEn, body: entry.bodyEn, linkText: entry.linkEn }
  : { tag: entry.tagZh, title: entry.titleZh, body: entry.bodyZh, linkText: entry.linkZh });

function inline(source) {
  return esc(source).split(/(`[^`]+`)/).map((part, i) => (i % 2 ? `<code>${part.slice(1, -1)}</code>` : part
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, text, url) => (/^(#\/|https:\/\/|mailto:)/.test(url)
      ? `<a href="${url}"${url.startsWith('https://') ? ' target="_blank" rel="noopener"' : ''}>${text}</a>` : whole)))).join('');
}

function bodyHtml(text) {
  const blocks = [];
  for (const line of String(text).split(/\r?\n/)) {
    const item = line.match(/^(-|\d+\.)\s+(.*)$/);
    const tag = item ? (item[1] === '-' ? 'ul' : 'ol') : 'p';
    const last = blocks.at(-1);
    if (!line.trim()) { blocks.push(null); continue; }
    if (last && last.tag === tag && tag !== 'p') last.lines.push(item[2]);
    else if (last && tag === 'p' && last.tag === 'p') last.lines.push(line.trim());
    else blocks.push({ tag, lines: [item ? item[2] : line.trim()] });
  }
  return blocks.filter(Boolean).map(({ tag, lines }) => (tag === 'p'
    ? `<p>${lines.map(inline).join('<br>')}</p>`
    : `<${tag}>${lines.map((l) => `<li>${inline(l)}</li>`).join('')}</${tag}>`)).join('');
}

const linkHtml = (entry, view) => (entry.link && view.linkText
  ? `<a class="text-link changelog-more" data-i18n-ignore href="${esc(entry.link)}"${entry.link.startsWith('https://') ? ' target="_blank" rel="noopener"' : ''}>${esc(view.linkText)}${icon(entry.link.startsWith('https://') ? 'arrow' : 'right')}</a>`
  : '');

export function mount(root, ctx) {
  const rawTarget = ctx.param ? String(ctx.param) : null;
  const target = rawTarget && ALL_ENTRIES.some((e) => e.id === rawTarget) ? rawTarget : null;
  let group = '', destroyed = false;

  const counts = () => Object.fromEntries(['', ...Object.keys(GROUPS)].map((k) => [k, k ? ALL_ENTRIES.filter((e) => e.group === k).length : ALL_ENTRIES.length]));
  const stat = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  const navButton = (value, glyph, name, count) => `<button type="button" class="side-link" data-team-group="${value}"${value === group ? ' aria-current="page"' : ''}${count === 0 ? ' disabled' : ''}>${icon(glyph)}<span data-i18n-ignore>${esc(name)}</span><span class="nav-count">${count}</span></button>`;
  const nav = () => {
    const c = counts();
    return `<nav class="side-nav section-nav changelog-nav" aria-label="团队分工">${navButton('', 'grid', english() ? 'All' : '全部', c[''])}${Object.entries(GROUPS).map(([k, [zh, en, glyph]]) => navButton(k, glyph, english() ? en : zh, c[k])).join('')}</nav>`;
  };
  const heading = () => (english()
    ? (group ? GROUPS[group][1] : 'All roles')
    : (group ? GROUPS[group][0] : '全部板块'));

  const entryHtml = (entry) => {
    const view = entryView(entry);
    const provisionalBadge = entry.provisional
      ? `<span class="badge provisional" data-i18n-ignore>${english() ? 'Roster TBD' : '待补充名单'}</span>`
      : '';
    return `<article class="changelog-entry" id="team-${esc(entry.id)}" aria-labelledby="team-title-${esc(entry.id)}">
      <div class="changelog-when"><data data-i18n-ignore value="${esc(entry.code)}">${esc(entry.code)}</data><span data-i18n-ignore>${esc(view.tag)}</span></div>
      <p class="changelog-kind"><span class="badge" data-i18n-ignore>${esc(groupName(entry.group))}</span>${provisionalBadge}</p>
      <div class="changelog-head"><h3 id="team-title-${esc(entry.id)}" data-i18n-ignore>${esc(view.title)}</h3><button type="button" class="btn ghost sm changelog-copy" data-team-copy="${esc(entry.id)}" data-i18n-original-attrs="aria-label" aria-label="${esc(english() ? 'Copy link to this section' : '复制这部分内容的链接')}">${icon('link')}</button></div>
      <div class="changelog-body" data-i18n-ignore>${bodyHtml(view.body)}</div>
      ${linkHtml(entry, view)}
    </article>`;
  };

  const listHtml = () => {
    const missing = rawTarget && !target
      ? `<p class="changelog-note" data-i18n-ignore role="status">${english() ? 'That team section does not exist yet.' : '该团队栏目暂不存在或正在整理中。'}</p>`
      : '';
    const chapters = CHAPTERS.map((chapter) => ({
      chapter,
      items: group ? chapter.entries.filter((e) => e.group === group) : chapter.entries,
    })).filter(({ items }) => items.length);
    return missing + chapters.map(({ chapter, items }) => `<section class="changelog-month" aria-label="${esc(chapterTitle(chapter))}">
      <h3 class="changelog-month-head" data-i18n-ignore>${esc(chapterTitle(chapter))}</h3>${items.map(entryHtml).join('')}</section>`).join('');
  };

  const paint = () => {
    $('.changelog-nav', root).outerHTML = nav();
    $('.collection-heading h2', root).textContent = heading();
    $('[data-team-list]', root).innerHTML = listHtml();
  };

  function draw() {
    const open = target && ALL_ENTRIES.find((e) => e.id === target);
    const crumbs = open
      ? [{ text: '开发者团队', href: '#/team' }, { text: entryView(open).title, original: true }]
      : [{ text: '开发者团队' }];
    root.innerHTML = `${ctx.pageStart({
      title: '开发者团队',
      section: '',
      heading: heading(),
      headingOriginal: true,
      crumbs,
      description: '亿模亿样不是一个人做出的平台——题库策划、前端展览、盲评系统与日常维护由多位伙伴共同完成。',
      caption: '<span class="collection-caption">初版序言 · 成员名录整理中</span>',
      meta: `<dl class="side-stats">${stat('协作板块', Object.keys(GROUPS).length)}${stat('页面状态', '持续补充')}</dl>`,
      nav: nav(),
    })}<section class="block wrap" data-team-list>${listHtml()}</section>${ctx.pageEnd()}`;
    setPageTitle(open
      ? ['开发者团队', { text: entryView(open).title, original: true }, ctx.DATA.title]
      : ['开发者团队', ctx.DATA.title]);
  }

  function arrive() {
    const el = target && $(`#team-${target}`, root);
    if (el) { el.scrollIntoView({ block: 'start' }); el.classList.add('is-target'); }
  }

  const onClick = (event) => {
    const filter = event.target.closest('[data-team-group]');
    if (filter) { group = filter.dataset.teamGroup; paint(); return; }
    const copy = event.target.closest('[data-team-copy]');
    if (copy) {
      navigator.clipboard?.writeText(`${location.origin}${location.pathname}#/team/${copy.dataset.teamCopy}`)
        .then(
          () => toast(english() ? 'Link copied' : '已复制链接'),
          () => toast(english() ? 'Copy failed — please copy from the address bar' : '复制失败，请从地址栏复制'),
        );
    }
  };
  const relocalize = () => { if (!destroyed) draw(); };

  root.addEventListener('click', onClick);
  window.addEventListener('localechange', relocalize);

  draw();
  arrive();
  return {
    ready: Promise.resolve(),
    onPlatformChange() {},
    destroy() {
      destroyed = true;
      root.removeEventListener('click', onClick);
      window.removeEventListener('localechange', relocalize);
    },
  };
}
