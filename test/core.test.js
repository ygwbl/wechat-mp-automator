'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { sandbox, fresh } = require('./helpers');

test('time：北京时间', () => {
  fresh();
  const t = require('../src/core/time');
  assert.strictEqual(t.today(new Date('2026-10-20T23:30:00Z')), '2026-10-21');
  assert.strictEqual(t.now(new Date(1792471255000)), '2026-10-20 12:40:55');
  assert.strictEqual(t.addDays('2026-10-31', 1), '2026-11-01');
  assert.strictEqual(t.hoursBetween('2026-10-20 12:00', '2026-10-22 12:00'), 48);
});

test('log：打码', () => {
  fresh();
  const { redact } = require('../src/core/log');
  assert.ok(!redact('?access_token=ABC123&x=1').includes('ABC123'));
  assert.ok(!redact('{"access_token":"ABC123"}').includes('ABC123'));
  assert.ok(!redact('Bearer sk-abcdef123456').includes('abcdef'));
  assert.ok(!redact('&secret=S3CR3T').includes('S3CR3T'));
});

test('config：.env 解析', () => {
  fresh();
  const { parseEnv } = require('../src/core/config');
  assert.deepStrictEqual(parseEnv('# c\nA=1\nB="x y"\n\nC=\n'), { A: '1', B: 'x y', C: '' });
});

test('stats：录入、同日覆盖、CSV 往返（含逗号和引号）', () => {
  sandbox();
  fresh();
  const stats = require('../src/tasks/stats');
  stats.record({ date: '2026-10-21', slug: 'a', title: '标题,带"引号"', values: { 阅读: 100, 点赞: 2 } });
  stats.record({ date: '2026-10-21', slug: 'a', values: { 阅读: 150 } });
  stats.record({ date: '2026-10-22', slug: 'a', values: { 阅读: 300 } });
  const rows = stats.read();
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].reads, 150);
  assert.strictEqual(rows[0].likes, 2);
  assert.strictEqual(rows[0].title, '标题,带"引号"');
  assert.strictEqual(stats.latest()[0].reads, 300);
  assert.throws(() => stats.record({ slug: 'a', values: { 收藏量: 1 } }), /不认识/);
});

test('report：未满 48 小时标「未稳定」，库存不足会提醒', () => {
  const dir = sandbox();
  fresh();
  const ledger = require('../src/core/ledger');
  ledger.set('a', { state: 'published', title: '甲', publishedAt: '2026-10-20 12:00:00' });
  require('../src/tasks/stats').record({ date: '2026-10-21', slug: 'a', values: { 阅读: 90 } });
  const md = require('../src/tasks/report').build('2026-10-21');
  assert.ok(md.includes('| 甲 | 90 |'));
  assert.ok(md.includes('未稳定'));
  assert.ok(md.includes('库存不到 3 篇'));
  assert.ok(fs.existsSync(dir));
});

test('explore：只存结构、地址去 token', () => {
  fresh();
  const { shape, scrub } = require('../src/tasks/explore');
  assert.deepStrictEqual(shape({ a: 1, b: [{ c: 'x' }], d: '{"e":2}' }), { a: 'number', b: [{ c: 'string' }], d: { '(json string)': { e: 'number' } } });
  assert.strictEqual(scrub('https://mp.weixin.qq.com/cgi-bin/x?a=1&token=123&f=json'), 'https://mp.weixin.qq.com/cgi-bin/x?a=1&token=*&f=*');
});

test('notify：没配置时不报错', async () => {
  fresh();
  delete process.env.NOTIFY_TYPE;
  assert.strictEqual(await require('../src/core/notify').send('t', 'b'), false);
});
