'use strict';
// 台账 data/ledger.json：每篇文章走到哪一步了。
//   { posts: { <slug>: { state, draftId, hash, pushedAt, publishedAt, url, history: [] } } }
// state:
//   pushed     已进草稿箱，等人在手机/后台点发表
//   published  已确认发出（freepublish 查到 / 手动 gzh done 标记）
// 一天只推一篇：推之前看今天有没有 pushed 或 published 的。
const paths = require('./paths');
const { readJSON, writeJSON } = require('./files');
const { now, today } = require('./time');

function read() {
  return readJSON(paths.ledger(), { posts: {} });
}

function write(l) {
  writeJSON(paths.ledger(), l);
}

function get(slug) {
  return read().posts[slug] || null;
}

function set(slug, patch, note) {
  const l = read();
  const cur = l.posts[slug] || { history: [] };
  const next = { ...cur, ...patch, history: [...(cur.history || []), { at: now(), state: patch.state || cur.state, note: note || '' }] };
  l.posts[slug] = next;
  write(l);
  return next;
}

/** 某天（北京时间）推过或发过的文章 */
function onDay(date = today()) {
  const out = [];
  for (const [slug, p] of Object.entries(read().posts)) {
    if ((p.pushedAt || '').startsWith(date) || (p.publishedAt || '').startsWith(date)) out.push({ slug, ...p });
  }
  return out;
}

function all() {
  return Object.entries(read().posts).map(([slug, p]) => ({ slug, ...p }));
}

module.exports = { read, get, set, onDay, all };
