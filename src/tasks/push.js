'use strict';
// 推草稿：选今天的文章 → 自检 → 上传图片 → draft/add → 回读核对 → 记台账 → 提醒
// 只进草稿箱，不发表。发表要你在手机「订阅号助手」或电脑后台点。
const posts = require('../content/posts');
const queue = require('../core/queue');
const ledger = require('../core/ledger');
const media = require('../wechat/media');
const notify = require('../core/notify');
const log = require('../core/log');
const { config } = require('../core/config');
const { today, now } = require('../core/time');
const { sha256 } = require('../core/files');

/**
 * @param {object} o
 *   slug    指定文章；不填按队列选
 *   force   今天已经推过也再推（会产生第二份草稿）
 *   dryRun  只选稿和自检，不调接口
 *   client  微信 API 客户端（测试注入）
 */
async function run(o = {}) {
  const date = today();
  const done = ledger.onDay(date);
  if (done.length && !o.force && !o.slug) {
    const d = done[0];
    log.info(`今天已经推过：${d.slug}（${d.state === 'published' ? '已发表' : '在草稿箱等你发表'}）。不重复推送。`);
    return { status: 'skip', reason: 'already-today', slug: d.slug };
  }

  let post;
  if (o.slug) {
    post = posts.load(o.slug);
    const r = posts.lint(post);
    if (!r.ok) throw new Error(`${o.slug} 自检不过：\n  - ${r.errors.join('\n  - ')}`);
    const l = ledger.get(o.slug);
    if (l && l.state === 'published' && !o.force) throw new Error(`${o.slug} 已经发表过了。确实要再推加 --force`);
  } else {
    const n = queue.next(date);
    for (const s of n.skipped) log.warn(`跳过 ${s.slug}：${s.why}`);
    post = n.post;
    if (!post) {
      const msg = '没有可推送的文章：content/posts/ 里没有「status: ready、自检通过、日期已到」的稿子';
      log.warn(msg);
      if (!o.dryRun) await notify.send('今天没稿', msg);
      return { status: 'empty' };
    }
  }

  log.info(`选中：${post.slug}《${post.title}》`);
  if (o.dryRun) return { status: 'dry', slug: post.slug };

  const client = o.client || require('../wechat/api').makeClient();

  // 1. 图片
  const urlOf = new Map();
  for (const f of posts.localImages(post)) {
    const r = await media.bodyImage(client, f);
    urlOf.set(f, r.url);
    log.info(`  正文图 ${require('path').basename(f)} → 已上传`);
  }
  const cover = await media.cover(client, post.cover);
  log.info('  封面 → 已上传');

  // 2. 正文
  const path = require('path');
  const paths = require('../core/paths');
  const html = posts.toHtml(post, {
    resolveImage: (src) => (/^https?:/.test(src) ? src : urlOf.get(path.resolve(paths.root(), 'content', src))),
  });

  // 3. 草稿
  const c = config();
  const article = {
    title: post.title,
    author: post.author,
    digest: post.digest,
    content: html,
    thumb_media_id: cover.media_id,
    need_open_comment: c.open_comment ? 1 : 0,
    only_fans_can_comment: 0,
  };
  if (post.meta.source_url) article.content_source_url = String(post.meta.source_url);
  const draftId = await client.addDraft(article);

  // 4. 回读核对：标题对得上、正文不是空的
  const back = await client.getDraft(draftId);
  const got = back.news_item && back.news_item[0];
  if (!got || got.title !== post.title || !got.content || got.content.length < html.length * 0.5) {
    throw new Error(`草稿 ${draftId} 回读不一致（标题：${got && got.title}），去后台草稿箱看一眼`);
  }

  ledger.set(post.slug, { state: 'pushed', draftId, hash: sha256(post.src), pushedAt: now(), title: post.title }, '推送到草稿箱');
  log.info(`✔ 已进草稿箱：《${post.title}》`);
  await notify.send('草稿已就绪，去发表', `《${post.title}》\n\n手机打开「订阅号助手」→ 草稿 → 发表。\n发完运行 gzh sync 或 gzh done ${post.slug}`);
  return { status: 'pushed', slug: post.slug, draftId };
}

module.exports = { run };
