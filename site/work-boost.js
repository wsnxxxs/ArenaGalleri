// New-work boost on task pages: while the default "added" sort is active, recently
// added verified works from these vendors move to independent front cards, right
// after the first card (usually the task's cover lead). They are moved, not copied,
// so a model keeps its ordinary representative further down the list.
export const BOOST_VENDORS = new Set([
  'OpenAI', 'Anthropic', 'Google', 'xAI', 'Meta', 'Moonshot AI',
  'Z.ai', 'Zhipu AI (Z.ai)', 'DeepSeek', 'ByteDance', 'ByteDance Seed',
  'MiniMax', 'Alibaba', 'Tencent', 'StepFun', 'Xiaomi', 'Mistral',
  'Cognition', 'Cursor', 'Meituan', 'inclusionAI', 'NVIDIA', 'rednote hilab',
]);
export const BOOST_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export function boostOrder(results, { sort = 'added', now = Date.now(), vendorOf = (r) => r.vendor ?? '' } = {}) {
  if (sort !== 'added') return results;
  const boosted = results.filter((r) => r.status === 'verified' && BOOST_VENDORS.has(vendorOf(r))
    && now - (Date.parse(r.addedAt) || 0) <= BOOST_WINDOW_MS);
  if (!boosted.length) return results;
  boosted.sort((a, b) => (Date.parse(b.addedAt) || 0) - (Date.parse(a.addedAt) || 0));
  const moving = new Set(boosted);
  const rest = results.filter((r) => !moving.has(r));
  return [...rest.slice(0, 1), ...boosted, ...rest.slice(1)];
}
