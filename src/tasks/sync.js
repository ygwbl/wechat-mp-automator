'use strict';
// 同步状态：
//   - 草稿箱里还在 → 保持 pushed
//   - freepublish 已发布列表里有同标题 → published（拿到文章链接）
//   - 草稿箱里没了、发布列表也没有 → 多半是在后台/手机「群发」发出去了（群发不进 freepublish 列表）
//     标成 gone，提示用 gzh done 确认
const ledger = require('../core/ledger');
const log = require('../core/log');
const { now } = require('../core/time');

async function collectAll(fn, key) {
  const out = [];
  for (let offset = 0; offset < 200; offset += 20) {
    const j = await fn(offset, 20);
    const items = j[key] || [];
    out.push(...items);
    if (out.length >= (j.total_count || 0) || !items.length) break;
  }
  return out;
}

async function run({ client } = {}) {
  client = client || require('../wechat/api').makeClient();
  const pending = ledger.all().filter((p) => p.state === 'pushed' || p.state === 'gone');
  if (!pending.length) {
    log.info('没有等待确认的文章');
    return [];
  }

  const drafts = await collectAll((o, c) => client.listDrafts(o, c), 'item');
  const draftIds = new Set(drafts.map((d) => d.media_id));
  const pubs = await collectAll((o, c) => client.listPublished(o, c), 'item');
  const pubByTitle = new Map();
  for (const it of pubs) {
    for (const n of (it.content && it.content.news_item) || []) {
      if (!n.is_deleted) pubByTitle.set(n.title, { url: n.url, at: it.update_time });
    }
  }

  const changed = [];
  for (const p of pending) {
    const pub = pubByTitle.get(p.title);
    if (pub) {
      ledger.set(p.slug, { state: 'published', url: pub.url, publishedAt: pub.at ? now(new Date(pub.at * 1000)) : now() }, '发布列表里查到');
      log.info(`✔ ${p.slug} 已发布：${pub.url}`);
      changed.push(p.slug);
    } else if (!draftIds.has(p.draftId) && p.state !== 'gone') {
      ledger.set(p.slug, { state: 'gone' }, '草稿箱里没了，发布列表里也没有');
      log.warn(`${p.slug} 不在草稿箱了，也不在「发布」列表（群发的文章不会出现在这里）。确认已群发就运行 gzh done ${p.slug}`);
      changed.push(p.slug);
    } else if (draftIds.has(p.draftId)) {
      log.info(`${p.slug} 还在草稿箱，等你发表`);
    }
  }
  return changed;
}

module.exports = { run };
