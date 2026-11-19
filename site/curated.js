// The curated rankings' structure (sections and the questions in them), read from /api/curated.
// Sections, their order and their questions all come from the server; nothing here names one.
import { api } from './platform.js';

let cache = null;
let task = null;
let generation = 0;

export function invalidateCurated() {
  generation += 1;
  cache = null;
  task = null;
}

export function curatedInfo({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cache.at < 60_000) return Promise.resolve(cache.data);
  if (!task) {
    const reading = generation;
    task = api('curated').then((data) => {
      const sections = (data.sections ?? []).slice().sort((a, b) => a.order - b.order);
      const info = { ...data, sections, taskIds: new Set(sections.flatMap((section) => section.taskIds ?? [])) };
      if (reading === generation) cache = { at: Date.now(), data: info };
      return info;
    }).finally(() => { if (reading === generation) task = null; });
  }
  return task;
}
// What has been read so far, for drawing before the read finishes.
export const curatedKnown = () => cache?.data ?? null;
