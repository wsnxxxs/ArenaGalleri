// Scores belong to model configurations. Prefer a curated model within the winning configuration.
export function questionPreview(task, rows, keyOf) {
  const works = task.results.filter((result) => result.status !== 'questioned');
  if (rows?.length) {
    const winners = works.filter((result) => result.status === 'verified' && keyOf(result) === rows[0].key);
    return winners.find((result) => result.previewModel || result.previewLoader) ?? winners[0] ?? null;
  }
  return works.find((result) => result.model === 'astra-pro') ?? works.find((result) => Object.values(result.captures)[0] || result.gallery[0]?.src) ?? works[0] ?? null;
}
