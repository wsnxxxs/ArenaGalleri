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
export const domainList = (platform) => (platform?.domains?.length ? platform.domains : DOMAINS);
// Questions carry no tags of their own: a search looks through their words and every version of
// the prompt, where a stack such as Three.js is already named. Each space-separated word must appear.
// Letters fold to lower case and spaces, dots, hyphens and underscores drop out, so threejs finds
// Three.js; `at` maps each folded character back to the original for the snippet.
function fold(text) {
  let folded = '';
  const at = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i].toLowerCase();
    if (/[\s.\-_]/.test(char)) continue;
    folded += char;
    for (let n = 0; n < char.length; n++) at.push(i);
  }
  return { folded, at };
}
const SNIPPET = { before: 18, after: 36 };

// Null when a word is missing. Otherwise `inPrompt` says some word was found only in a prompt, with
// the stretch of prompt around the first such word.
export function searchMatch(task, query) {
  const words = query.split(/\s+/).map((word) => fold(word).folded).filter(Boolean);
  if (!words.length) return { inPrompt: false };
  // The separator survives folding, so a word cannot run from the title into the summary.
  const own = fold([task.title, task.summary, categoryLabel(task.category), ...domainsOf(task)].join('|')).folded;
  const prompts = [task.prompt ?? '', ...(task.promptVariants ?? []).map((variant) => variant.prompt ?? '')]
    .filter(Boolean).map((text) => ({ text, ...fold(text) }));
  const promptOnly = words.filter((word) => !own.includes(word));
  if (promptOnly.some((word) => !prompts.some(({ folded }) => folded.includes(word)))) return null;
  if (!promptOnly.length) return { inPrompt: false };
  const word = promptOnly[0];
  const { text, folded, at } = prompts.find((prompt) => prompt.folded.includes(word));
  const index = folded.indexOf(word);
  const start = at[index], end = at[index + word.length - 1] + 1;
  const from = Math.max(0, start - SNIPPET.before), to = Math.min(text.length, end + SNIPPET.after);
  const flat = (part) => part.replace(/\s+/g, ' ');
  return { inPrompt: true, snippet: { before: `${from > 0 ? '…' : ''}${flat(text.slice(from, start))}`, hit: flat(text.slice(start, end)), after: `${flat(text.slice(end, to))}${to < text.length ? '…' : ''}` } };
}
export const matchesQuery = (task, query) => searchMatch(task, query) !== null;

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
