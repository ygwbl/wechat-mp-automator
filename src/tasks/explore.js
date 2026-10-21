'use strict';
// 浏览器探索：打开公众号后台，你正常点一遍（发表、看数据），这里只「看」不「点」：
//   - 记录每个页面的地址、标题、可点击元素（按钮文字 + 稳定的 id/name/data-*）
//   - 记录后台发出的 JSON 接口请求（地址去掉 token 后保存，响应只存字段结构不存数值）
// 结果写到 data/explore/<时间>/。用来给第二阶段（自动群发、自动采集数据）照着真实页面写代码，
// 不依赖任何旧脚本里的选择器。
//
// 需要：npm install playwright-core，本机有 Chrome 或 Edge。
const fs = require('fs');
const path = require('path');
const paths = require('../core/paths');
const log = require('../core/log');
const { now } = require('../core/time');

function findBrowser() {
  const cands = [
    process.env.GZH_BROWSER,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ].filter(Boolean);
  const hit = cands.find((p) => fs.existsSync(p));
  if (!hit) throw new Error('找不到 Chrome / Edge。装一个，或在 .env 里设 GZH_BROWSER=浏览器路径');
  return hit;
}

/** 只保留结构：{a: 1, b: [{c: "x"}]} → {a: "number", b: [{c: "string"}]} */
function shape(v, depth = 0) {
  if (depth > 6) return '…';
  if (Array.isArray(v)) return v.length ? [shape(v[0], depth + 1)] : [];
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).slice(0, 60).map(([k, x]) => [k, shape(x, depth + 1)]));
  if (typeof v === 'string' && /^\s*[[{]/.test(v)) {
    try { return { '(json string)': shape(JSON.parse(v), depth + 1) }; } catch { /* 普通字符串 */ }
  }
  return typeof v;
}

const scrub = (u) => u.replace(/([?&](token|access_token|ticket|key|f)=)[^&]*/g, '$1*');

async function run({ minutes = 20 } = {}) {
  let chromium;
  try { ({ chromium } = require('playwright-core')); } catch { throw new Error('先运行 npm install（需要 playwright-core）'); }

  const out = path.join(paths.explore(), now().replace(/[: ]/g, '-'));
  fs.mkdirSync(out, { recursive: true });
  const pages = [];
  const apis = new Map();

  const ctx = await chromium.launchPersistentContext(paths.profile(), {
    executablePath: findBrowser(), headless: false, viewport: null, locale: 'zh-CN',
  });
  const page = ctx.pages()[0] || (await ctx.newPage());

  ctx.on('response', async (res) => {
    try {
      const u = res.url();
      if (!/mp\.weixin\.qq\.com\/(cgi-bin|misc|mp)\//.test(u)) return;
      if (!/json/.test(res.headers()['content-type'] || '')) return;
      const key = scrub(u.split('#')[0]);
      if (apis.has(key)) return;
      const body = await res.json().catch(() => null);
      apis.set(key, { method: res.request().method(), status: res.status(), shape: body ? shape(body) : null, at: now() });
    } catch { /* 忽略 */ }
  });

  async function snapshot() {
    try {
      const info = await page.evaluate(() => {
        const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
        const attrs = (e) => Object.fromEntries([...e.attributes].filter((a) => /^(id|name|role|type|placeholder|aria-label|data-[\w-]+)$/.test(a.name)).map((a) => [a.name, a.value.slice(0, 60)]));
        const clickables = [...document.querySelectorAll('button,a,[role=button],input,textarea,[contenteditable=true]')]
          .filter(vis).slice(0, 200)
          .map((e) => ({ tag: e.tagName.toLowerCase(), text: (e.innerText || e.value || '').trim().slice(0, 30), ...attrs(e) }))
          .filter((x) => x.text || x.id || x.name || x.placeholder);
        return { title: document.title, clickables };
      });
      pages.push({ at: now(), url: scrub(page.url()), ...info });
      fs.writeFileSync(path.join(out, 'pages.json'), JSON.stringify(pages, null, 2));
      fs.writeFileSync(path.join(out, 'apis.json'), JSON.stringify(Object.fromEntries(apis), null, 2));
      await page.screenshot({ path: path.join(out, `${String(pages.length).padStart(3, '0')}.png`) }).catch(() => {});
    } catch { /* 页面切换中，下次再拍 */ }
  }

  page.on('framenavigated', (f) => { if (f === page.mainFrame()) setTimeout(snapshot, 2500); });
  // 弹窗（发表确认之类）出现时也拍一次
  page.on('domcontentloaded', () => setTimeout(snapshot, 1500));
  await page.goto('https://mp.weixin.qq.com/');
  log.info(`浏览器已打开。扫码登录后，像平时一样操作：进草稿箱、点发表（可以在最后一步取消）、看数据页。${minutes} 分钟后自动结束，或直接关掉浏览器。`);
  log.info('这个工具只记录，不会替你点任何按钮。');

  const timer = setInterval(snapshot, 15000);
  await Promise.race([
    new Promise((r) => ctx.on('close', r)),
    new Promise((r) => setTimeout(r, minutes * 60000)),
  ]);
  clearInterval(timer);
  await snapshot();
  await ctx.close().catch(() => {});
  log.info(`已记录 ${pages.length} 个页面快照、${apis.size} 个接口 → ${path.relative(paths.root(), out)}`);
  return out;
}

module.exports = { run, shape, scrub };
