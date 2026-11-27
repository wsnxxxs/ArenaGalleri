import test from 'node:test';
import assert from 'node:assert/strict';
import { locale, setLocale, t, translateText, formatNumber, formatDate, formatTime } from '../site/i18n.js';

test('English interface phrases and explicit templates preserve dynamic values', () => {
  setLocale('en');
  assert.equal(locale(), 'en');
  assert.equal(translateText('登录'), 'Sign in');
  assert.equal(translateText('  第 12 组 · 匿名  '), '  Pair 12 · Anonymous  ');
  assert.equal(t('可盲评 {count} 件', { count: 7 }), '7 eligible works');
  assert.equal(translateText('加入展厅：模型原名'), 'Add to exhibition: 模型原名');
  assert.equal(translateText('在线预览：A  B，Claude'), 'Preview: A  B, Claude');
  assert.equal(translateText('可盲评 1 件'), '1 eligible work');
  assert.equal(translateText('· 本次已计入 1 组'), '· 1 pair counted this session');
  assert.equal(translateText('· 本次已计入 2 组'), '· 2 pairs counted this session');
});

test('a {term} slot translates a known interface phrase and leaves other text to the next template', () => {
  setLocale('en');
  assert.equal(translateText('正在载入榜单…'), 'Loading leaderboard…');
  assert.equal(translateText('返回题库'), 'Back to questions');
  assert.equal(translateText('撤下 2 件？'), 'Hide: 2 works?');
  assert.equal(translateText('已移出盲评：模型原名'), 'Removed from blind review: 模型原名');
  assert.equal(translateText('正在载入某个作品…'), 'Loading 某个作品…', 'unknown text falls through to the {value} form');
  assert.equal(translateText('注意：原文'), '注意：原文');
  setLocale('zh-CN');
});

test('unknown names and dollar characters survive template translation', () => {
  setLocale('en');
  for (const unchanged of ['constructor', '__proto__', 'toString']) {
    assert.equal(translateText(unchanged), unchanged);
    assert.equal(t(unchanged), unchanged);
  }
  const preview = translateText('在线预览：Model');
  for (const suffix of ['$&', '$$', "$'", '$`']) {
    const name = `Model ${suffix}`;
    const source = `  在线预览：${name}  `;
    assert.equal(translateText(source), `  ${preview} ${suffix}  `);
  }
  setLocale('zh-CN');
});

test('copy is matched as a whole phrase and Chinese switches back without changing content', () => {
  setLocale('en');
  assert.equal(translateText('作品原文中包含登录两个字'), '作品原文中包含登录两个字');
  assert.equal(translateText('<script>登录</script>'), '<script>登录</script>');
  setLocale('zh-CN');
  assert.equal(t('可盲评 {count} 件', { count: 7 }), '可盲评 7 件');
  assert.equal(translateText('登录'), '登录');
  setLocale('unsupported');
  assert.equal(locale(), 'zh-CN');
});

test('formatting follows the selected locale', () => {
  setLocale('en');
  assert.equal(formatNumber(1234), '1,234');
  assert.equal(formatDate('2026-10-11T12:00:00'), new Date('2026-10-11T12:00:00').toLocaleDateString('en', { year: 'numeric', month: '2-digit', day: '2-digit' }));
  setLocale('zh-CN');
  assert.equal(formatDate('2026-10-11T12:00:00'), new Date('2026-10-11T12:00:00').toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }));
});

test('API millisecond timestamps retain their date and time after DOM attributes stringify them', () => {
  const options = { timeZone: 'UTC' };
  for (const selected of ['en', 'zh-CN']) {
    setLocale(selected);
    for (const stamp of [1792713600000, 999999999999, 10000000000, -1792713600000]) {
      assert.equal(formatDate(String(stamp), options), formatDate(stamp, options));
      assert.equal(formatTime(String(stamp), options), formatTime(stamp, options));
      assert.doesNotMatch(formatDate(String(stamp), options), /invalid date/i);
    }
    assert.equal(formatTime('+1792713600000', options), formatTime(1792713600000, options));
  }
});

test('ISO, ordinary date strings, short years and empty values keep their existing date semantics', () => {
  for (const selected of ['en', 'zh-CN']) {
    setLocale(selected);
    for (const value of ['2026-10-23', '2026-10-23T14:30:00Z', 'October 23, 2026', '2026', '0', 'not a date']) {
      assert.equal(formatDate(value), new Date(value).toLocaleDateString(selected, { year: 'numeric', month: '2-digit', day: '2-digit' }));
      assert.equal(formatTime(value), new Date(value).toLocaleString(selected, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }));
    }
    for (const empty of [null, undefined, '', 0]) { assert.equal(formatDate(empty), ''); assert.equal(formatTime(empty), ''); }
  }
});

test('curated staff-history messages and viewer recovery copy translate with dynamic counts', () => {
  setLocale('en');
  assert.equal(translateText('精选榜等待比较'), 'Waiting for curated comparisons');
  assert.match(translateText('3 道精选题 · 12 次有效比较 · 含管理员历史票'), /3 curated questions · 12 valid comparisons · includes historical admin votes/);
  assert.match(translateText('统计认证成员的新选择，并纳入普通管理员和高级管理员的历史有效票；只计精选题，和大众榜分开计票。模型或配置在本榜至少有 21 场有效比较后上榜，在那之前不给出没有依据的名次。'), /historical votes.*21 valid comparisons/);
  setLocale('zh-CN');
  setLocale('en');
  assert.equal(translateText('作品尚未完成载入'), 'The work has not finished loading');
  setLocale('zh-CN');
});
