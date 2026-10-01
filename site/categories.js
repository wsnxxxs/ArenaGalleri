// Question categories: one fixed set that the library, the leaderboard and publishing all name
// the same way. A category also decides which submission formats its questions accept.
export const CATEGORIES = [
  { name: '文学', slug: 'text', glyph: 'text', templates: ['text'] },
  { name: '静态网页', slug: 'page', glyph: 'desktop', templates: ['static', 'vite'] },
  { name: '建模', slug: 'model', glyph: 'cube', templates: ['static', 'vite'] },
];
export const TEMPLATE_LABELS = { text: '纯文本 / Markdown', static: '纯 HTML / JavaScript', vite: 'Vite 静态网页' };

export const categoryOf = (name) => CATEGORIES.find((c) => c.name === name) ?? null;
// Questions that predate formats take their category's; the category itself is never a tag.
export const templatesOf = (task) => (task.templates?.length ? task.templates : categoryOf(task.category)?.templates ?? ['static', 'vite']);
export const tagsOf = (task) => (task.tags ?? []).filter((tag) => tag !== task.category);

// Categories present in the data, known ones first; an unknown category still gets a view.
export function tracksOf(tasks) {
  const present = [...new Set(tasks.map((t) => t.category).filter(Boolean))];
  const known = CATEGORIES.filter(({ name }) => present.includes(name)).map(({ name, slug, glyph }) => ({ name, slug, glyph }));
  const other = present.filter((name) => !categoryOf(name)).map((name) => ({ name, slug: name, glyph: 'grid' }));
  return [...known, ...other].map((track) => ({ ...track, tasks: tasks.filter((t) => t.category === track.name) }));
}
