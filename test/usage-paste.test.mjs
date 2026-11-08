import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAmount, parseDuration, recognize, warnings } from '../site/usage-paste.js';

// Every sample below is made up in the shape of the tool's output; none is a real measurement.

test('amounts accept k, M, thousands separators and 万, and reject anything else', () => {
  assert.equal(parseAmount('31k'), 31_000);
  assert.equal(parseAmount('1.6M'), 1_600_000);
  assert.equal(parseAmount(' 1,600,000 '), 1_600_000);
  assert.equal(parseAmount('3.1万'), 31_000);
  assert.equal(parseAmount('148'), 148);
  assert.equal(parseAmount(''), undefined);
  assert.equal(parseAmount('12x'), null);
  assert.equal(parseAmount('-5'), null);
  assert.equal(parseDuration('16m 20.1s'), 980.1);
  assert.equal(parseDuration('1h 2m 3s'), 3723);
  assert.equal(parseDuration('16:20'), 980);
  assert.equal(parseDuration('16 分 20 秒'), 980);
});

test('a Claude Code /cost summary adds up every model line and keeps the tool\'s own total apart', () => {
  const result = recognize(`Total cost:            $3.42
Total duration (API):  14m 52.3s
Total duration (wall): 16m 20.1s
Total code changes:    1620 lines added, 0 lines removed
Usage by model:
    claude-haiku:  1.0k input, 2.1k output, 0 cache read, 0 cache write ($0.01)
    claude-opus:  30.0k input, 58.9k output, 1.6m cache read, 148.0k cache write ($3.41)`);
  assert.equal(result.kind, 'claude-code');
  assert.deepEqual(result.usage, { input: 31_000, cacheRead: 1_600_000, cacheWrite: 148_000, output: 61_000, durationSec: 980.1 });
  assert.deepEqual(result.shown, { amount: 3.42, currency: 'USD' });
  assert.equal(result.parts, 2);
});

test('Codex: the closing line keeps its uncached input, the session log takes the last running total', () => {
  const line = recognize('Token usage: total=1,234,567 input=100,000 (+ 1,100,000 cached) output=34,567 (reasoning 12,000)');
  assert.deepEqual([line.kind, line.usage], ['codex', { input: 100_000, cacheRead: 1_100_000, output: 34_567, reasoning: 12_000 }]);
  const event = (input, cached, output, reasoning) => JSON.stringify({ type: 'event_msg', payload: { type: 'token_count', info: {
    total_token_usage: { input_tokens: input, cached_input_tokens: cached, output_tokens: output, reasoning_output_tokens: reasoning, total_tokens: input + output },
    last_token_usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0, total_tokens: 2 } } } });
  const log = [JSON.stringify({ type: 'session_meta' }), event(50_000, 30_000, 2_000, 500), event(400_000, 350_000, 9_000, 3_000), event(900_000, 820_000, 21_000, 7_000)].join('\n');
  const session = recognize(log);
  assert.equal(session.kind, 'codex');
  assert.deepEqual(session.usage, { input: 80_000, cacheRead: 820_000, output: 21_000, reasoning: 7_000, requests: 3 });
  // A request is a step up in total_tokens: a repeated snapshot is not another request.
  const repeated = recognize([event(50_000, 30_000, 2_000, 500), event(50_000, 30_000, 2_000, 500), event(400_000, 350_000, 9_000, 3_000)].join('\n'));
  assert.equal(repeated.usage.requests, 2);
  // Counters that go down were reset: nothing is filled and nothing is guessed.
  const reset = recognize([event(400_000, 350_000, 9_000, 3_000), event(50_000, 30_000, 2_000, 500)].join('\n'));
  assert.deepEqual([reset.reset, reset.usage], [true, {}]);
});

test('OpenAI input totals include cached tokens, which are taken out; Anthropic input is already uncached', () => {
  const responses = recognize(JSON.stringify({ id: 'resp_x', usage: { input_tokens: 120_000, input_tokens_details: { cached_tokens: 100_000 },
    output_tokens: 9_000, output_tokens_details: { reasoning_tokens: 4_000 }, total_tokens: 129_000 } }));
  assert.deepEqual([responses.kind, responses.usage], ['openai', { input: 20_000, cacheRead: 100_000, output: 9_000, reasoning: 4_000, requests: 1 }]);
  const chat = recognize(JSON.stringify({ prompt_tokens: 5_000, completion_tokens: 800, total_tokens: 5_800, prompt_tokens_details: { cached_tokens: 1_024 } }));
  assert.deepEqual(chat.usage, { input: 3_976, cacheRead: 1_024, output: 800, requests: 1 });
  const anthropic = recognize(JSON.stringify([
    { usage: { input_tokens: 12, cache_creation_input_tokens: 40_000, cache_read_input_tokens: 0, output_tokens: 3_000 } },
    { usage: { input_tokens: 8, cache_creation_input_tokens: 1_000, cache_read_input_tokens: 40_000, output_tokens: 2_000 } },
  ]));
  assert.deepEqual([anthropic.kind, anthropic.usage], ['anthropic', { input: 20, cacheRead: 40_000, cacheWrite: 41_000, output: 5_000, requests: 2 }]);
});

test('Gemini thoughts count as output and as its reasoning part; cached content leaves the input', () => {
  const lines = [
    { usageMetadata: { promptTokenCount: 10_000, cachedContentTokenCount: 6_000, candidatesTokenCount: 1_500, thoughtsTokenCount: 500, totalTokenCount: 12_000 } },
    { usageMetadata: { promptTokenCount: 4_000, candidatesTokenCount: 700, totalTokenCount: 4_700 } },
  ].map((o) => JSON.stringify(o)).join('\n');
  const result = recognize(lines);
  assert.deepEqual([result.kind, result.usage], ['gemini', { input: 8_000, cacheRead: 6_000, output: 2_700, reasoning: 500, requests: 2 }]);
});

test('the site\'s own record is read as is, and unknown text is not guessed', () => {
  const site = recognize('{"input": 31000, "cacheRead": 1620000, "output": 61000, "reasoning": 23000, "requests": 41, "durationSec": 980, "source": "log"}');
  assert.deepEqual([site.kind, site.usage], ['site', { input: 31_000, cacheRead: 1_620_000, output: 61_000, reasoning: 23_000, requests: 41, durationSec: 980 }]);
  assert.equal(recognize('hello world'), null);
  assert.equal(recognize('{"tokens": 5}'), null);
  assert.equal(recognize(''), null);
});

test('suspicious numbers are flagged without being refused', () => {
  assert.deepEqual(warnings({ input: 31, cacheRead: 1_600_000, output: 61_000 }).map((w) => w.field), ['input']);
  assert.deepEqual(warnings({ output: 1_000, reasoning: 2_000 }).map((w) => w.field), ['reasoning']);
  assert.deepEqual(warnings({ durationSec: 3 * 86_400 }).map((w) => w.field), ['durationSec']);
  assert.deepEqual(warnings({ input: 31_000, cacheRead: 1_600_000, output: 61_000, reasoning: 23_000, requests: 41, durationSec: 980 }), []);
});
