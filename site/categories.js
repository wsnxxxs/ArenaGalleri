// Questions sit on two axes. The category is the form of the answer (text, page, 3D): it groups the
// library and the leaderboard and decides which submission formats a question accepts. Stored names
// stay as they are, so links and votes keep working; `label` is what readers see.
// Domains say what a question is about (数学, 化学, 建筑…): one or two per question, for browsing only.
export const CATEGORIES = [
  { name: '文学', label: '文本', slug: 'text', glyph: 'text', templates: ['text'] },
  { name: '静态网页', label: '网页', slug: 'page', glyph: 'desktop', templates: ['static', 'vite'] },
  { name: '建模', label: '三维', slug: 'model', glyph: 'cube', templates: ['static', 'vite'] },
];
export const TEMPLATE_LABELS = { text: '纯文本 / Markdown', static: '纯 HTML / JavaScript', vite: 'Vite 静态网页' };
// The backend may send its own list in bootstrap (`domains`); this one stands in without it.
export const DOMAINS = ['数学', '物理', '化学', '生物', '天文', '建筑', '自然景观', '交通与机械', '产品与品牌', '文学艺术', '游戏娱乐'];
export const MAX_DOMAINS = 2;

export const categoryOf = (name) => CATEGORIES.find((c) => c.name === name) ?? null;
export const categoryLabel = (name) => categoryOf(name)?.label ?? name ?? '';
// Questions that predate formats take their category's; the category itself is never a tag.
export const templatesOf = (task) => (task.templates?.length ? task.templates : categoryOf(task.category)?.templates ?? ['static', 'vite']);
export const domainsOf = (task) => task.domains ?? [];
export const tagsOf = (task) => (task.tags ?? []).filter((tag) => tag !== task.category && !domainsOf(task).includes(tag));
export const domainList = (platform) => (platform?.domains?.length ? platform.domains : DOMAINS);

// Categories present in the data, known ones first; an unknown category still gets a view.
export function tracksOf(tasks) {
  const present = [...new Set(tasks.map((t) => t.category).filter(Boolean))];
  const known = CATEGORIES.filter(({ name }) => present.includes(name)).map(({ name, label, slug, glyph }) => ({ name, label, slug, glyph }));
  const other = present.filter((name) => !categoryOf(name)).map((name) => ({ name, label: name, slug: name, glyph: 'grid' }));
  return [...known, ...other].map((track) => ({ ...track, tasks: tasks.filter((t) => t.category === track.name) }));
}

// Domains present in the data, in the list's order; ones off the list follow.
export function domainsIn(tasks, list = DOMAINS) {
  const present = new Set(tasks.flatMap(domainsOf));
  return [...list.filter((d) => present.has(d)), ...[...present].filter((d) => !list.includes(d))]
    .map((name) => ({ name, tasks: tasks.filter((t) => domainsOf(t).includes(name)) }));
}
