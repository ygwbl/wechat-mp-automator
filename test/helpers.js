'use strict';
// 测试工具：临时项目目录 + 假的微信接口
const fs = require('fs');
const os = require('os');
const path = require('path');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gzh-'));
  process.env.GZH_ROOT = dir;
  process.env.GZH_NO_LOGFILE = '1';
  for (const d of ['content/posts', 'content/covers', 'content/images']) fs.mkdirSync(path.join(dir, d), { recursive: true });
  return dir;
}

// 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const PARA = '早上起床先别急着坐起来，躺着把手脚活动一分钟，让身体从睡眠状态慢慢醒过来，再侧身起床，动作放慢，这样一整天都更有精神。';

function writePost(dir, slug, over = {}) {
  const meta = { title: '起床前先做这一步', digest: '一分钟的小动作', cover: `covers/${slug}.png`, status: 'ready', ...over.meta };
  const body = over.body || [
    '很多人闹钟一响就猛地坐起来。', '',
    `## 先活动手脚`, '', PARA, '', PARA, '', PARA, '',
    `## 侧身起床`, '', PARA, '', PARA, '', PARA, '',
    `## 喝半杯温水`, '', PARA, '', PARA, '', PARA, '',
    '![晨光](images/a.png)', '',
    '::: tip 什么时候该去医院', '起床时经常头晕眼前发黑，去医院看看。', ':::', '',
    '明早就试试这三步，你平时起床先做什么？',
  ].join('\n');
  const head = Object.entries(meta).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${v}`).join('\n');
  fs.writeFileSync(path.join(dir, 'content/posts', `${slug}.md`), `---\n${head}\n---\n\n${body}\n`);
  if (!over.noCover) fs.writeFileSync(path.join(dir, 'content/covers', `${slug}.png`), PNG);
  fs.writeFileSync(path.join(dir, 'content/images/a.png'), PNG);
}

/** 内存版公众号：记录调用，支持 stable_token / uploadimg / add_material / draft / freepublish */
function fakeWechat() {
  const s = { calls: [], drafts: new Map(), published: [], tokenCalls: 0, n: 0, failNext: null };
  const reply = (obj) => ({ ok: true, status: 200, text: async () => JSON.stringify(obj), json: async () => obj });
  s.fetch = async (url, init = {}) => {
    const u = new URL(url);
    const api = u.pathname;
    s.calls.push(api);
    if (s.failNext && s.failNext.api === api) { const e = s.failNext; s.failNext = null; return reply({ errcode: e.code, errmsg: 'fail' }); }
    const body = init.body && typeof init.body === 'string' ? JSON.parse(init.body) : null;
    switch (api) {
      case '/cgi-bin/stable_token': s.tokenCalls++; return reply({ access_token: `T${s.tokenCalls}`, expires_in: 7200 });
      case '/cgi-bin/media/uploadimg': return reply({ url: `http://mmbiz.qpic.cn/img${++s.n}` });
      case '/cgi-bin/material/add_material': return reply({ media_id: `COVER${++s.n}`, url: `http://mmbiz.qpic.cn/c${s.n}` });
      case '/cgi-bin/draft/add': { const id = `DRAFT${++s.n}`; s.drafts.set(id, body.articles); return reply({ media_id: id }); }
      case '/cgi-bin/draft/get': return reply({ news_item: s.drafts.get(body.media_id) || [] });
      case '/cgi-bin/draft/batchget': return reply({ total_count: s.drafts.size, item: [...s.drafts.keys()].map((media_id) => ({ media_id })) });
      case '/cgi-bin/freepublish/batchget': return reply({ total_count: s.published.length, item: s.published });
      default: return reply({ errcode: 404, errmsg: 'unknown api' });
    }
  };
  s.client = () => require('../src/wechat/api').makeClient({ fetch: s.fetch, appid: 'wx1', secret: 's' });
  return s;
}

/** 每个测试前清掉 require 缓存，让模块重新读 GZH_ROOT */
function fresh() {
  for (const k of Object.keys(require.cache)) if (k.includes(`${path.sep}src${path.sep}`)) delete require.cache[k];
}

module.exports = { sandbox, writePost, fakeWechat, fresh, PNG, PARA };
