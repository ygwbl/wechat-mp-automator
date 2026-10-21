#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const log = require('../src/core/log');

const HELP = `日升月落 · 公众号工具

写稿
  new <文章名> "标题"                  新建一篇空白稿（content/posts/<文章名>.md）
  ai <文章名> "选题" [--notes 要求]     AI 起草（状态是 draft，你改完再设 ready）
  cover <文章名> [--hint 画面描述]      AI 生成封面
  check [文章名]                       自检：合规词、字数、封面。不填 = 检查全部
  preview <文章名>                     生成手机宽度预览 dist/<文章名>.html

发布
  next                                今天会推哪篇
  push [文章名] [--dry] [--force]      推送到公众号草稿箱（一天一篇）。--dry 只选稿不推
  sync                                查草稿箱/发布列表，更新状态
  done <文章名> [文章链接]              手动标记已发表（群发出去的文章微信接口查不到，要手动标）
  status                              台账：哪些在草稿箱、哪些已发

数据
  stat <文章名> 阅读=120 点赞=3 ...     录入数据（字段：阅读 点赞 在看 分享 留言 关注）
  report                              生成复盘 reports/<今天>.md

其他
  explore [--minutes 20]              打开后台，记录真实页面和接口（给自动群发/采集做准备）
  daily                               定时任务用：sync → push → report
`;

function take(args, name) {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  const hasVal = v !== undefined && !v.startsWith('--');
  args.splice(i, hasVal ? 2 : 1);
  return hasVal ? v : true;
}

function printLint(slug, r) {
  const s = r.stats;
  console.log(`${r.ok ? '✔' : '✖'} ${slug}  标题 ${s.title} · 摘要 ${s.digest} · 正文 ${s.chars} 字 · 小标题 ${s.h2}`);
  for (const e of r.errors) console.log(`    ✖ ${e}`);
  for (const w of r.warnings) console.log(`    ! ${w}`);
}

const STATE = { pushed: '在草稿箱', published: '已发表', gone: '不在草稿箱（待确认）' };

async function main(argv) {
  const args = [...argv];
  const cmd = args.shift();
  const posts = require('../src/content/posts');
  const ledger = require('../src/core/ledger');

  switch (cmd) {
    case 'new': {
      const [slug, title = ''] = args;
      if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error('用法：new <文章名> "标题"；文章名只能用小写字母、数字、横线');
      const f = posts.file(slug);
      if (fs.existsSync(f)) throw new Error(`${path.relative(process.cwd(), f)} 已存在`);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, `---\ntitle: ${title}\ndigest: \ncover: covers/${slug}.jpg\nstatus: draft\n---\n\n开头写一个具体的场景。\n\n## 第一个小标题\n\n正文。\n\n::: tip 什么时候该去医院\n写清楚哪些情况要就医。\n:::\n`);
      console.log(f);
      return 0;
    }
    case 'ai': {
      const notes = take(args, '--notes');
      const force = !!take(args, '--force');
      const [slug, topic] = args;
      if (!slug || !topic) throw new Error('用法：ai <文章名> "选题"');
      const { file, lint } = await require('../src/ai/write').draft(slug, topic, { notes: notes === true ? '' : notes, force });
      printLint(slug, lint);
      console.log(`草稿：${file}\n看过改好后把 status 改成 ready。`);
      return 0;
    }
    case 'cover': {
      const hint = take(args, '--hint');
      const out = await require('../src/ai/write').cover(args[0], { hint: hint === true ? '' : hint });
      console.log(out);
      return 0;
    }
    case 'check': {
      const slugs = args[0] ? [args[0]] : posts.list();
      if (!slugs.length) { console.log('content/posts/ 里还没有文章。用 gzh new 新建。'); return 0; }
      let bad = 0;
      for (const s of slugs) {
        const p = posts.load(s);
        const r = posts.lint(p);
        printLint(`${s}${p.status === 'ready' ? '' : ` [${p.status}]`}`, r);
        if (!r.ok) bad++;
      }
      return bad ? 1 : 0;
    }
    case 'preview': {
      const p = posts.load(args[0]);
      const { previewPage } = require('../src/content/render');
      const paths = require('../src/core/paths');
      const out = path.join(paths.dist(), `${p.slug}.html`);
      const html = posts.toHtml(p, { resolveImage: (src) => (/^https?:/.test(src) ? src : path.resolve(paths.root(), 'content', src).replace(/\\/g, '/').replace(/^/, 'file:///')) });
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, previewPage({ title: p.title, author: p.author, html }));
      printLint(p.slug, posts.lint(p));
      console.log(out);
      return 0;
    }
    case 'next': {
      const { post, rest, skipped } = require('../src/core/queue').next();
      const today = ledger.onDay();
      if (today.length) console.log(`今天已推：${today[0].slug}（${STATE[today[0].state]}）`);
      console.log(post ? `下一篇：${post.slug}《${post.title}》` : '没有可推送的文章');
      if (rest.length) console.log(`之后：${rest.map((p) => p.slug).join('、')}`);
      for (const s of skipped) console.log(`  跳过 ${s.slug}：${s.why}`);
      return 0;
    }
    case 'push': {
      const dryRun = !!take(args, '--dry');
      const force = !!take(args, '--force');
      const r = await require('../src/tasks/push').run({ slug: args[0], dryRun, force });
      return r.status === 'empty' ? 1 : 0;
    }
    case 'sync':
      await require('../src/tasks/sync').run();
      return 0;
    case 'done': {
      const [slug, url = ''] = args;
      const cur = ledger.get(slug);
      if (!cur) posts.load(slug);
      const { now } = require('../src/core/time');
      ledger.set(slug, { state: 'published', publishedAt: now(), url: url || (cur && cur.url) || '', title: (cur && cur.title) || posts.load(slug).title }, '手动标记已发表');
      console.log(`✔ ${slug} 已标记为已发表`);
      return 0;
    }
    case 'status': {
      const all = ledger.all().sort((a, b) => String(b.pushedAt || b.publishedAt).localeCompare(String(a.pushedAt || a.publishedAt)));
      if (!all.length) console.log('台账是空的，还没推过文章。');
      for (const p of all.slice(0, 30)) console.log(`${(p.publishedAt || p.pushedAt || '').slice(0, 16)}  ${STATE[p.state] || p.state}  ${p.slug}《${p.title || ''}》${p.url ? `  ${p.url}` : ''}`);
      return 0;
    }
    case 'stat': {
      const [slug, ...kv] = args;
      if (!slug || !kv.length) throw new Error('用法：stat <文章名> 阅读=120 点赞=3');
      const values = Object.fromEntries(kv.map((x) => {
        const m = x.match(/^([^=]+)=(\d+)$/);
        if (!m) throw new Error(`看不懂「${x}」，格式是 字段=数字`);
        return [m[1], m[2]];
      }));
      const l = ledger.get(slug);
      const title = (l && l.title) || (fs.existsSync(posts.file(slug)) ? posts.load(slug).title : '');
      const r = require('../src/tasks/stats').record({ slug, title, values });
      console.log(`✔ ${r.date} ${slug} 阅读 ${r.reads ?? '—'} 点赞 ${r.likes ?? '—'} 在看 ${r.wows ?? '—'} 分享 ${r.shares ?? '—'}`);
      return 0;
    }
    case 'report':
      console.log(require('../src/tasks/report').run());
      return 0;
    case 'explore': {
      const m = take(args, '--minutes');
      await require('../src/tasks/explore').run({ minutes: Number(m) || 20 });
      return 0;
    }
    case 'daily': {
      let code = 0;
      const step = async (name, fn) => {
        try { await fn(); } catch (e) { log.error(`${name}：${e.message}`); code = 1; }
      };
      await step('sync', () => require('../src/tasks/sync').run());
      await step('push', () => require('../src/tasks/push').run());
      await step('report', () => require('../src/tasks/report').run());
      return code;
    }
    case undefined:
    case 'help':
    case '-h':
    case '--help':
      console.log(HELP);
      return 0;
    default:
      console.log(`没有「${cmd}」这个命令\n\n${HELP}`);
      return 2;
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((c) => process.exit(c)).catch((e) => {
    log.error(e.message);
    if (process.env.GZH_DEBUG) console.error(e.stack);
    process.exit(1);
  });
}

module.exports = { main };
