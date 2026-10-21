'use strict';
// 数据：data/stats.csv，一行 = 某篇文章在某天的累计数据。
//   date,slug,title,reads,likes,wows,shares,comments,follows
// 来源两种：
//   gzh stat <slug> 阅读=120 点赞=3 ...      手动录（看手机后台的数字）
//   gzh import <后台导出的 xls/csv>           后续支持；或浏览器采集（gzh explore 摸清页面后再加）
const fs = require('fs');
const paths = require('../core/paths');
const { writeAtomic } = require('../core/files');
const { today } = require('../core/time');

const COLS = ['date', 'slug', 'title', 'reads', 'likes', 'wows', 'shares', 'comments', 'follows'];
const ALIAS = { 阅读: 'reads', 点赞: 'likes', 在看: 'wows', 推荐: 'wows', 分享: 'shares', 转发: 'shares', 留言: 'comments', 评论: 'comments', 关注: 'follows', 涨粉: 'follows' };

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ''));
}

function read() {
  const f = paths.stats();
  if (!fs.existsSync(f)) return [];
  const [head, ...rows] = parseCSV(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
  return rows.map((r) => {
    const o = Object.fromEntries(head.map((h, i) => [h, r[i]]));
    for (const k of COLS.slice(3)) o[k] = o[k] === '' || o[k] == null ? null : Number(o[k]);
    return o;
  });
}

function write(rows) {
  const lines = [COLS.join(','), ...rows.map((r) => COLS.map((c) => csvCell(r[c])).join(','))];
  // BOM 让 Excel 正确识别中文
  writeAtomic(paths.stats(), '﻿' + lines.join('\n') + '\n');
}

/** 录入/更新一条。同一天同一篇覆盖。 */
function record({ date = today(), slug, title = '', values }) {
  const rows = read();
  const i = rows.findIndex((r) => r.date === date && r.slug === slug);
  const base = i >= 0 ? rows[i] : { date, slug, title };
  const next = { ...base, title: title || base.title };
  for (const [k, v] of Object.entries(values)) {
    const col = ALIAS[k] || k;
    if (!COLS.slice(3).includes(col)) throw new Error(`不认识的字段「${k}」，可用：${Object.keys(ALIAS).join(' ')}`);
    next[col] = Number(v);
  }
  if (i >= 0) rows[i] = next; else rows.push(next);
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug));
  write(rows);
  return next;
}

/** 每篇文章最新一条 */
function latest() {
  const m = new Map();
  for (const r of read()) {
    const cur = m.get(r.slug);
    if (!cur || r.date >= cur.date) m.set(r.slug, r);
  }
  return [...m.values()];
}

module.exports = { read, write, record, latest, parseCSV, COLS, ALIAS };
