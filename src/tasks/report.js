'use strict';
// 周报/复盘：台账 + 数据表 → reports/<日期>.md
// 只陈述数字，结论留给人。发布不满 48 小时的数据标注「未稳定」。
const path = require('path');
const paths = require('../core/paths');
const ledger = require('../core/ledger');
const stats = require('./stats');
const queue = require('../core/queue');
const { writeAtomic } = require('../core/files');
const { today, now, hoursBetween } = require('../core/time');

function median(xs) {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function build(date = today()) {
  const posts = ledger.all().filter((p) => p.state === 'published' || p.state === 'gone');
  const latest = new Map(stats.latest().map((r) => [r.slug, r]));
  const L = [`# 运营复盘 ${date}`, '', `生成于 ${now()}`, ''];

  const rows = posts
    .map((p) => ({ ...p, s: latest.get(p.slug) }))
    .sort((a, b) => String(b.publishedAt || b.pushedAt).localeCompare(String(a.publishedAt || a.pushedAt)));

  L.push('## 已发文章', '');
  if (!rows.length) L.push('还没有已发表的文章。', '');
  else {
    L.push('| 发表 | 文章 | 阅读 | 点赞 | 在看 | 分享 | 留言 | 涨粉 | 数据日期 |', '|---|---|--:|--:|--:|--:|--:|--:|---|');
    for (const r of rows.slice(0, 20)) {
      const s = r.s || {};
      const when = (r.publishedAt || r.pushedAt || '').slice(0, 16);
      const fresh = s.date && when && hoursBetween(when, `${s.date} 23:59`) < 48 ? '（未稳定）' : '';
      const v = (k) => (s[k] == null ? '—' : s[k]);
      L.push(`| ${when} | ${r.title || r.slug} | ${v('reads')} | ${v('likes')} | ${v('wows')} | ${v('shares')} | ${v('comments')} | ${v('follows')} | ${s.date || '未录入'}${fresh} |`);
    }
    L.push('');
    const stable = rows.filter((r) => r.s && r.s.reads != null && hoursBetween((r.publishedAt || r.pushedAt).slice(0, 16), `${r.s.date} 23:59`) >= 48);
    if (stable.length >= 3) {
      const med = median(stable.map((r) => r.s.reads));
      const hi = stable.filter((r) => r.s.reads >= med * 3).map((r) => r.title || r.slug);
      L.push(`发表满 48 小时的 ${stable.length} 篇：阅读中位数 **${med}**。${hi.length ? `明显高于中位数（3 倍以上）：${hi.join('、')}。` : ''}`, '');
    }
    const missing = rows.filter((r) => !r.s).map((r) => r.slug);
    if (missing.length) L.push(`还没录数据：${missing.join('、')}（\`gzh stat <文章> 阅读=… 点赞=…\`）`, '');
  }

  const waiting = ledger.all().filter((p) => p.state === 'pushed');
  if (waiting.length) L.push('## 在草稿箱等发表', '', ...waiting.map((p) => `- ${p.slug}《${p.title}》 推送于 ${p.pushedAt}`), '');

  const { ok, skipped } = queue.candidates(date);
  L.push('## 库存', '', `可推送：${ok.length} 篇${ok.length ? `（下一篇 ${ok[0].slug}）` : ''}`);
  if (ok.length < 3) L.push('', '⚠ 库存不到 3 篇，该写稿了。');
  if (skipped.length) L.push('', '自检没过的：', ...skipped.map((s) => `- ${s.slug}：${s.why}`));
  L.push('');
  return L.join('\n');
}

function run(date = today()) {
  const file = path.join(paths.reports(), `${date}.md`);
  writeAtomic(file, build(date));
  return file;
}

module.exports = { build, run, median };
