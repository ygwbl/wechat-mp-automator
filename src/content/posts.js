'use strict';
// 文章仓库：content/posts/<slug>.md
// 文件名就是 slug，元信息写在文件头：
//   ---
//   title: 标题
//   digest: 摘要（可选）
//   cover: covers/xxx.jpg   （相对 content/）
//   date: 2026-10-22        （计划发布日，可选；不填就按 queue 顺序）
//   status: ready           （draft 不会被推送）
//   ---
const fs = require('fs');
const path = require('path');
const paths = require('../core/paths');
const { parse, plainText } = require('./markdown');
const { render } = require('./render');
const { scan } = require('./rules');
const { config } = require('../core/config');

function list() {
  const dir = paths.posts();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .map((f) => f.slice(0, -3))
    .sort();
}

function file(slug) {
  return path.join(paths.posts(), `${slug}.md`);
}

function load(slug) {
  const f = file(slug);
  if (!fs.existsSync(f)) throw new Error(`找不到文章 content/posts/${slug}.md`);
  const src = fs.readFileSync(f, 'utf8');
  const { meta, blocks } = parse(src);
  return {
    slug,
    file: f,
    src,
    title: String(meta.title || '').trim(),
    digest: String(meta.digest || '').trim(),
    author: String(meta.author || config().author || '').trim(),
    cover: meta.cover ? path.resolve(paths.root(), 'content', String(meta.cover)) : '',
    date: meta.date ? String(meta.date) : '',
    status: String(meta.status || 'draft'),
    meta,
    blocks,
  };
}

/** 渲染正文 HTML。resolveImage 推送时会被替换成「上传到微信后的 URL」 */
function toHtml(post, { resolveImage } = {}) {
  const c = config();
  return render(post.blocks, { theme: post.meta.theme || c.theme, footer: c.footer, resolveImage });
}

/** 正文图片（本地路径，绝对） */
function localImages(post) {
  const out = [];
  const walk = (bs) => bs.forEach((b) => {
    if (b.type === 'img' && !/^https?:/.test(b.src)) out.push(path.resolve(paths.root(), 'content', b.src));
    if (b.children) walk(b.children);
  });
  walk(post.blocks);
  return out;
}

/**
 * 发布前自检
 * @returns {{ ok, errors: string[], warnings: string[], stats }}
 */
function lint(post) {
  const c = config().post;
  const errors = [];
  const warnings = [];
  const body = plainText(post.blocks);
  const chars = body.replace(/\s+/g, '').length;

  if (!post.title) errors.push('缺少 title');
  else if ([...post.title].length > c.titleMax) errors.push(`标题 ${[...post.title].length} 字，超过 ${c.titleMax}`);
  if ([...post.digest].length > c.digestMax) errors.push(`摘要 ${[...post.digest].length} 字，超过 ${c.digestMax}`);
  if (!post.digest) warnings.push('没写 digest，微信会自动截正文开头当摘要');

  if (!post.cover) errors.push('缺少 cover（封面图）');
  else if (!fs.existsSync(post.cover)) errors.push(`封面文件不存在：${path.relative(paths.root(), post.cover)}`);

  for (const img of localImages(post)) {
    if (!fs.existsSync(img)) errors.push(`正文图片不存在：${path.relative(paths.root(), img)}`);
  }

  if (chars < c.minChars) errors.push(`正文 ${chars} 字，少于 ${c.minChars}`);
  if (chars > c.maxChars) warnings.push(`正文 ${chars} 字，超过建议的 ${c.maxChars}，手机上读着累`);
  if (!post.blocks.some((b) => b.type === 'h2')) warnings.push('没有 ## 小标题，长文不好扫读');

  for (const [where, text] of [['标题', post.title], ['摘要', post.digest], ['正文', body]]) {
    for (const h of scan(text, where)) {
      const msg = `${h.where}「${h.hit}」${h.why}：…${h.context}…`;
      (h.level === 'error' ? errors : warnings).push(msg);
    }
  }

  return { ok: errors.length === 0, errors, warnings, stats: { title: [...post.title].length, digest: [...post.digest].length, chars, h2: post.blocks.filter((b) => b.type === 'h2').length } };
}

module.exports = { list, file, load, toHtml, localImages, lint };
