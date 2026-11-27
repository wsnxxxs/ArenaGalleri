import test from 'node:test';
import assert from 'node:assert/strict';
import { boostOrder, boostedWorks } from '../site/work-boost.js';

const now = Date.parse('2026-11-27T00:00:00Z');
const work = (id, vendor, addedAt, status = 'verified') => ({ id, vendor, addedAt, status });

test('recent works from major vendors move behind the first card, which never moves', () => {
  const lead = work('lead', 'Anthropic', '2026-11-26T00:00:00Z');
  const older = work('older', 'Anthropic', '2026-01-01T00:00:00Z');
  const fresh = work('fresh', 'OpenAI', '2026-11-25T00:00:00Z');
  const other = work('other', 'Small Lab', '2026-11-26T00:00:00Z');
  const order = boostOrder([lead, older, other, fresh], { now });
  assert.deepEqual(order.map((r) => r.id), ['lead', 'fresh', 'older', 'other']);
  assert.deepEqual(boostedWorks(order, { now }).map((r) => r.id), ['fresh'], 'the cover lead is never boosted');
  assert.equal(boostOrder([lead, fresh], { now, sort: 'score' })[1], fresh, 'other sorts keep their order');
});
