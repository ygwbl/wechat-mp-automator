'use strict';
// 文章 = 一个 Markdown 文件，开头是 --- 包起来的元信息。
// 支持的写法刻意很少，够写公众号就行：
//   ## 小标题        自动编号
//   > 引用           一段金句/提醒
//   ::: tip 标题     提示框（::: 结尾）。常用：::: tip 什么时候该去医院
//   - 列表 / 1. 列表
//   ![说明](图片路径)
//   **加粗**  ==高亮==
//   ---              分隔线

function parseFrontMatter(src) {
  const text = src.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i < 1 || /^\s*#/.test(line)) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    else if (v === 'true' || v === 'false') v = v === 'true';
    else if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
    meta[k] = v;
  }
  return { meta, body: text.slice(m[0].length) };
}

/** 块级解析，返回 AST 数组 */
function parseBlocks(body) {
  const lines = body.split('\n');
  const blocks = [];
  let para = [];
  const flush = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join('') });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();

    if (!t) { flush(); continue; }

    let m;
    if ((m = t.match(/^##\s+(.+)$/))) { flush(); blocks.push({ type: 'h2', text: m[1].trim() }); continue; }
    if ((m = t.match(/^###\s+(.+)$/))) { flush(); blocks.push({ type: 'h3', text: m[1].trim() }); continue; }
    if (/^(-{3,}|\*{3,})$/.test(t)) { flush(); blocks.push({ type: 'hr' }); continue; }
    if ((m = t.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/))) { flush(); blocks.push({ type: 'img', alt: m[1], src: m[2] }); continue; }

    if ((m = t.match(/^:::\s*(\w+)\s*(.*)$/))) {
      flush();
      const inner = [];
      for (i++; i < lines.length && lines[i].trim() !== ':::'; i++) inner.push(lines[i]);
      blocks.push({ type: 'box', kind: m[1], title: m[2].trim(), children: parseBlocks(inner.join('\n')) });
      continue;
    }

    if (t.startsWith('>')) {
      flush();
      const q = [];
      for (; i < lines.length && lines[i].trim().startsWith('>'); i++) q.push(lines[i].trim().replace(/^>\s?/, ''));
      i--;
      blocks.push({ type: 'quote', text: q.join('') });
      continue;
    }

    if ((m = t.match(/^([-*]|\d+[.、])\s+(.+)$/))) {
      flush();
      const ordered = /^\d/.test(m[1]);
      const items = [];
      for (; i < lines.length; i++) {
        const mm = lines[i].trim().match(/^([-*]|\d+[.、])\s+(.+)$/);
        if (!mm || /^\d/.test(mm[1]) !== ordered) break;
        items.push(mm[2]);
      }
      i--;
      blocks.push({ type: ordered ? 'ol' : 'ul', items });
      continue;
    }

    para.push(t);
  }
  flush();
  return blocks;
}

function parse(src) {
  const { meta, body } = parseFrontMatter(src);
  return { meta, blocks: parseBlocks(body) };
}

/** 去掉行内标记，得到纯文本（用于计数和合规扫描） */
function plainInline(s) {
  return String(s).replace(/\*\*(.+?)\*\*/g, '$1').replace(/==(.+?)==/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

function plainText(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.text) out.push(plainInline(b.text));
    if (b.items) out.push(...b.items.map(plainInline));
    if (b.title) out.push(b.title);
    if (b.children) out.push(plainText(b.children));
  }
  return out.join('\n');
}

module.exports = { parse, parseFrontMatter, parseBlocks, plainText, plainInline };
