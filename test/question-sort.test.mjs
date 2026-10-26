import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { popularQuestions, recommendQuestions } from '../site/question-recommendations.js';

const app = readFileSync(new URL('../site/app.js', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const stateSource = app.slice(app.indexOf('const questionSorts ='), app.indexOf('// ---- home '));
const rankSource = app.slice(app.indexOf('function rankedTasks('), app.indexOf('// Form and domain ride'));
const tasks = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, title: id, date: `2026-10-0${i + 1}`, results: Array.from({ length: i }, (_, j) => ({ model: `m${j}`, status: 'verified' })) }));
const ids = rows => Array.from(rows, ({ task }) => task.id);
function environment(saved, random = [0.8, 0.1, 0.6, 0.3]) {
  let index = 0;
  const context = { DATA: { tasks: structuredClone(tasks) }, store: { get: () => saved },
    Math: Object.assign(Object.create(Math), { random: () => random[index++ % random.length] }),
    byName: (a, b) => a.localeCompare(b), counted: task => task.results,
    popularQuestions, recommendQuestions, registeredOf: work => work.model, modelKey: work => work.model };
  vm.runInNewContext(`${stateSource}\n${rankSource}\nglobalThis.state = homeState; globalThis.rank = rankedTasks; globalThis.choices = questionSorts;`, context);
  return context;
}

test('first visits and invalid preferences use a random order that survives filters and catalog refreshes', () => {
  const e = environment();
  assert.equal(e.state.sort, 'random');
  const order = ids(e.rank());
  assert.deepEqual(order, ['b', 'd', 'c', 'a']);
  assert.deepEqual(ids(e.rank([e.DATA.tasks[0], e.DATA.tasks[2]])), ['c', 'a']);
  e.DATA.tasks = structuredClone(e.DATA.tasks).reverse();
  assert.deepEqual(ids(e.rank()), order, 'replacing catalog objects cannot reshuffle a reading session');
  e.state.sort = 'works'; e.rank(); e.state.sort = 'random';
  assert.deepEqual(ids(e.rank()), order, 'switching away and back keeps the same random order');
  assert.deepEqual(tasks.map(t => t.id), ['a', 'b', 'c', 'd']);
  assert.notDeepEqual(ids(environment(undefined, [0.1, 0.8, 0.3, 0.6]).rank()), order, 'a fresh load uses fresh randomness');
  assert.equal(environment('obsolete').state.sort, 'random');
});

test('explicit sort preferences remain valid, and the popularity option uses the shared score', () => {
  for (const value of ['random', 'popularity', 'recommended', 'works', 'date', 'title']) {
    assert.equal(environment(value).state.sort, value);
  }
  const e = environment('popularity');
  assert.equal(e.choices.popularity, '热度（高到低）');
  assert.deepEqual(ids(e.rank()), ids(popularQuestions(e.DATA.tasks)));
  assert.deepEqual(ids(environment('works').rank()), ['d', 'c', 'b', 'a']);
  assert.deepEqual(ids(environment('date').rank()), ['d', 'c', 'b', 'a']);
  assert.deepEqual(ids(environment('title').rank()), ['a', 'b', 'c', 'd']);
});
