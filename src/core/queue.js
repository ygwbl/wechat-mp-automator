'use strict';
// 选「今天该推哪篇」：
//   1. date 等于今天的 ready 文章（定点发，比如节气）
//   2. 否则：没有 date、或 date 已过的 ready 文章里，按文件名排序取第一篇
// 已推过 / 已发过的跳过，自检不过的跳过（并说明原因）。
const posts = require('../content/posts');
const ledger = require('./ledger');
const { today } = require('./time');

function candidates(date = today()) {
  const skipped = [];
  const ok = [];
  for (const slug of posts.list()) {
    let p;
    try { p = posts.load(slug); } catch (e) { skipped.push({ slug, why: e.message }); continue; }
    const l = ledger.get(slug);
    if (l && (l.state === 'pushed' || l.state === 'published')) continue;
    if (p.status !== 'ready') continue;
    if (p.date && p.date > date) continue;
    const r = posts.lint(p);
    if (!r.ok) { skipped.push({ slug, why: `自检不过：${r.errors[0]}${r.errors.length > 1 ? ` 等 ${r.errors.length} 项` : ''}` }); continue; }
    ok.push(p);
  }
  ok.sort((a, b) => {
    const ad = a.date === date ? 0 : 1;
    const bd = b.date === date ? 0 : 1;
    return ad - bd || a.slug.localeCompare(b.slug);
  });
  return { ok, skipped };
}

function next(date = today()) {
  const { ok, skipped } = candidates(date);
  return { post: ok[0] || null, rest: ok.slice(1), skipped };
}

module.exports = { candidates, next };
