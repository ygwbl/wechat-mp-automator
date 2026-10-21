'use strict';
// AI 起草：直接产出 Markdown 文件，status 固定是 draft —— AI 写的稿必须人看过、改成 ready 才会被推送。
const fs = require('fs');
const path = require('path');
const paths = require('../core/paths');
const llm = require('./llm');
const posts = require('../content/posts');
const { RULES } = require('../content/rules');
const { config } = require('../core/config');

function systemPrompt() {
  const c = config();
  const banned = RULES.filter((r) => r.level === 'error').map((r) => r.why);
  return `你在给一个养生类公众号写稿。读者是 30-55 岁、关心日常身体状态的普通人。
写法：
- 像懂行的朋友当面说话。短句，具体，有生活场景。少用形容词，多给可执行的细节（时间、次数、温度、顺序）。
- 讲「日常习惯怎么调整」，不讲「什么能治什么」。
- 正文 ${c.post.minChars}-${c.post.maxChars} 字。

绝对不能出现（出现就作废）：${banned.join('；')}。
不要写药名、保健品、具体疾病的预防或治疗效果。涉及症状时写「这种情况去医院看看」。

只输出一个 Markdown 文件，格式严格如下，不要解释：
---
title: 标题（${c.post.titleMax} 字以内，具体、有画面，不要震惊体）
digest: 一句话摘要（${c.post.digestMax} 字以内）
status: draft
---

开头 2-3 段：一个具体场景，引出常见误区。

## 小标题一

正文……

## 小标题二

正文……

## 小标题三

正文……

::: tip 什么时候该去医院
列出 2-3 个需要就医的信号。
:::

最后一段：今天就能做的一件小事，再问读者一个问题。`;
}

function strip(md) {
  return md.replace(/^```(?:markdown|md)?\s*\n/i, '').replace(/\n```\s*$/, '').trim() + '\n';
}

/**
 * @returns {{ file, post, lint }}
 */
async function draft(slug, topic, { notes = '', force = false } = {}) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error('文章名只能用小写字母、数字、横线，比如 2026-10-22-kongtiao');
  const file = posts.file(slug);
  if (fs.existsSync(file) && !force) throw new Error(`content/posts/${slug}.md 已存在，覆盖加 --force`);
  const out = await llm.chat([
    { role: 'system', content: systemPrompt() },
    { role: 'user', content: `选题：${topic}${notes ? `\n要求：${notes}` : ''}` },
  ]);
  let md = strip(out);
  if (!/^---\n/.test(md)) throw new Error('模型没按格式返回（缺少 --- 文件头）');
  md = md.replace(/^status:.*$/m, 'status: draft');
  if (!/^cover:/m.test(md)) md = md.replace(/^---\n/, `---\ncover: covers/${slug}.jpg\n`);
  fs.mkdirSync(paths.posts(), { recursive: true });
  fs.writeFileSync(file, md);
  const post = posts.load(slug);
  return { file, post, lint: posts.lint(post) };
}

async function cover(slug, { hint = '' } = {}) {
  const post = posts.load(slug);
  const prompt = `公众号文章头图，横版 3:2。主题：「${post.title}」。生活化场景摄影风格，自然光，色调温和偏暖，画面干净，单一主体。不要任何文字、水印、logo，不要药品。${hint}`;
  const buf = await llm.image(prompt);
  const out = post.cover || path.join(paths.covers(), `${slug}.jpg`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf);
  return out;
}

module.exports = { draft, cover, systemPrompt };
