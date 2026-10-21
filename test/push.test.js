'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { sandbox, writePost, fakeWechat, fresh } = require('./helpers');

test('push：上传图片 → 建草稿 → 回读核对 → 记台账', async () => {
  const dir = sandbox();
  fresh();
  writePost(dir, 'a');
  const wx = fakeWechat();
  const r = await require('../src/tasks/push').run({ client: wx.client() });
  assert.strictEqual(r.status, 'pushed');
  assert.deepStrictEqual(wx.calls, ['/cgi-bin/stable_token', '/cgi-bin/media/uploadimg', '/cgi-bin/material/add_material', '/cgi-bin/draft/add', '/cgi-bin/draft/get']);
  const art = [...wx.drafts.values()][0][0];
  assert.strictEqual(art.title, '起床前先做这一步');
  assert.ok(art.content.includes('http://mmbiz.qpic.cn/img'), '正文图片要换成微信地址');
  assert.ok(!art.content.includes('images/a.png'));
  assert.ok(art.thumb_media_id.startsWith('COVER'));
  const l = require('../src/core/ledger').get('a');
  assert.strictEqual(l.state, 'pushed');
  assert.strictEqual(l.draftId, r.draftId);
});

test('push：同一天第二次不推；同一张图不重复上传', async () => {
  const dir = sandbox();
  fresh();
  writePost(dir, 'a');
  writePost(dir, 'b');
  const wx = fakeWechat();
  const push = require('../src/tasks/push');
  await push.run({ client: wx.client() });
  const r2 = await push.run({ client: wx.client() });
  assert.strictEqual(r2.status, 'skip');
  assert.strictEqual(wx.drafts.size, 1);
  // 指定文章强推，图片和 token 走缓存
  const before = wx.calls.length;
  await push.run({ slug: 'b', client: wx.client() });
  const after = wx.calls.slice(before);
  assert.ok(!after.includes('/cgi-bin/stable_token'), 'token 应该缓存');
  assert.ok(!after.includes('/cgi-bin/media/uploadimg'), '同一张正文图不该重复上传');
});

test('push：自检不过的稿不推；没稿时返回 empty', async () => {
  const dir = sandbox();
  fresh();
  writePost(dir, 'bad', { meta: { title: '喝它能降血压' } });
  const wx = fakeWechat();
  const r = await require('../src/tasks/push').run({ client: wx.client() });
  assert.strictEqual(r.status, 'empty');
  assert.strictEqual(wx.calls.length, 0);
});

test('push：接口报错不记台账（不会误以为推过）', async () => {
  const dir = sandbox();
  fresh();
  writePost(dir, 'a');
  const wx = fakeWechat();
  wx.failNext = { api: '/cgi-bin/draft/add', code: 40164 };
  await assert.rejects(() => require('../src/tasks/push').run({ client: wx.client() }), /白名单/);
  assert.strictEqual(require('../src/core/ledger').get('a'), null);
});

test('api：token 失效自动刷新一次', async () => {
  sandbox();
  fresh();
  const wx = fakeWechat();
  const c = wx.client();
  await c.listDrafts();
  wx.failNext = { api: '/cgi-bin/draft/batchget', code: 40001 };
  await c.listDrafts();
  assert.strictEqual(wx.tokenCalls, 2);
});

test('sync：发布列表查到 → published；草稿没了也查不到 → gone', async () => {
  const dir = sandbox();
  fresh();
  writePost(dir, 'a');
  writePost(dir, 'b', { meta: { title: '另一篇' } });
  const wx = fakeWechat();
  const push = require('../src/tasks/push');
  const ra = await push.run({ slug: 'a', client: wx.client() });
  const rb = await push.run({ slug: 'b', client: wx.client() });
  wx.drafts.delete(ra.draftId);
  wx.drafts.delete(rb.draftId);
  wx.published.push({ article_id: 'x', update_time: 1792471255, content: { news_item: [{ title: '起床前先做这一步', url: 'https://mp.weixin.qq.com/s/abc', is_deleted: false }] } });
  await require('../src/tasks/sync').run({ client: wx.client() });
  const ledger = require('../src/core/ledger');
  assert.strictEqual(ledger.get('a').state, 'published');
  assert.strictEqual(ledger.get('a').url, 'https://mp.weixin.qq.com/s/abc');
  assert.strictEqual(ledger.get('a').publishedAt, '2026-10-20 12:40:55');
  assert.strictEqual(ledger.get('b').state, 'gone');
});
