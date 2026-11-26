import assert from 'node:assert/strict';
import test from 'node:test';
import { createQuestionSearch, matchesQuery, searchMatch } from '../site/categories.js';

const task = { title: '黑洞', summary: '事件视界', category: '建模', domains: ['天文'], tags: ['Legacy'],
  prompt: '用 Three.js 模拟引力透镜，\n并用 OrbitControls 控制视角', promptVariants: [{ id: 'short', prompt: '加入 WebGPU 后处理' }] };

test('a search matches every word against the question and each version of its prompt', () => {
  for (const query of ['', '  ', 'three.js', 'threejs', 'Three-JS', '三维 天文', '引力透镜 webgpu', '黑洞']) assert.ok(matchesQuery(task, query), query);
  for (const query of ['化学', 'three.js 化学', 'legacy']) assert.ok(!matchesQuery(task, query), query);
});

test('words the question names itself rank above words found only in a prompt, which come with a snippet', () => {
  assert.deepEqual(searchMatch(task, '黑洞 天文'), { inPrompt: false });
  const { inPrompt, snippet } = searchMatch(task, '黑洞 orbitcontrols');
  assert.equal(inPrompt, true);
  assert.equal(snippet.hit, 'OrbitControls');
  assert.match(snippet.before, /^…?.*并用 $/);
  assert.equal(snippet.after, ' 控制视角');
  assert.equal(searchMatch(task, 'webgpu').snippet.hit, 'WebGPU', 'the short version is searched too');
});

test('a library search reuses prompt text across queries and keeps prompt snippets', () => {
  let reads = 0;
  const question = { title: 'Night sky', get prompt() { reads++; return 'Use Three.js and WebGPU.'; } };
  const search = createQuestionSearch();
  assert.deepEqual(search('night')(question), { inPrompt: false });
  assert.equal(reads, 0, 'direct hits do not need a prompt index');
  assert.equal(search('night threejs')(question).snippet.hit, 'Three.js');
  assert.equal(search('webgpu')(question).snippet.hit, 'WebGPU');
  assert.equal(search('threejs CSS')(question), null);
  assert.equal(reads, 1);
});
