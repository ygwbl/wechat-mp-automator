'use strict';
// 版式主题。公众号编辑器会剥掉 <style> 和 class，所以所有样式都是行内的。
// 想换风格，加一个主题对象，在 config.json 里设 "theme": "名字"。

const FONT = "-apple-system,BlinkMacSystemFont,'Helvetica Neue','PingFang SC','Microsoft YaHei',sans-serif";

const paper = {
  name: 'paper',
  desc: '纸本：暖白底、墨色字、青绿点缀，编号小标题',
  root: `font-family:${FONT};font-size:16px;line-height:1.9;color:#33302b;letter-spacing:0.04em;text-align:justify;padding:0 4px;`,
  p: 'margin:0 0 1.15em;',
  h2: {
    wrap: 'margin:2.2em 0 1em;',
    num: 'display:block;font-size:13px;line-height:1;color:#2f7d74;letter-spacing:0.2em;margin-bottom:6px;font-weight:600;',
    text: 'display:block;font-size:18px;line-height:1.5;color:#1f1d1a;font-weight:700;',
    rule: 'display:block;width:28px;height:2px;background:#2f7d74;margin-top:10px;',
  },
  h3: 'margin:1.6em 0 .6em;font-size:16px;font-weight:700;color:#1f1d1a;',
  strong: 'color:#1f1d1a;font-weight:700;',
  mark: 'background:linear-gradient(transparent 58%,#f3dfa8 58%);padding:0 1px;',
  quote: 'margin:1.6em 0;padding:2px 0 2px 14px;border-left:2px solid #c9c2b4;color:#6d665b;font-size:15px;',
  list: 'margin:0 0 1.15em;padding-left:1.4em;',
  li: 'margin:0 0 .35em;',
  hr: 'border:0;height:1px;background:#e6e1d6;margin:2em 18%;',
  img: 'display:block;width:100%;height:auto;border-radius:4px;margin:1.4em 0 .4em;',
  caption: 'text-align:center;font-size:13px;color:#9a9385;margin:0 0 1.4em;',
  box: {
    tip: { wrap: 'margin:1.8em 0;padding:16px 18px;background:#eef5f3;border-radius:6px;', title: 'margin:0 0 .5em;font-size:15px;font-weight:700;color:#2f7d74;', body: 'font-size:15px;color:#3e4a47;' },
    warn: { wrap: 'margin:1.8em 0;padding:16px 18px;background:#fbf1ea;border-radius:6px;', title: 'margin:0 0 .5em;font-size:15px;font-weight:700;color:#b5603a;', body: 'font-size:15px;color:#5a4a40;' },
    note: { wrap: 'margin:1.8em 0;padding:16px 18px;background:#f4f2ec;border-radius:6px;', title: 'margin:0 0 .5em;font-size:15px;font-weight:700;color:#5c564b;', body: 'font-size:15px;color:#5c564b;' },
  },
  footer: {
    follow: 'margin:2.4em 0 0;padding:14px 0;border-top:1px solid #e6e1d6;border-bottom:1px solid #e6e1d6;text-align:center;font-size:15px;color:#2f7d74;',
    disclaimer: 'margin:1.6em 0 0;text-align:center;font-size:12px;line-height:1.8;color:#aaa395;',
  },
};

const plain = {
  ...paper,
  name: 'plain',
  desc: '素净：黑白灰，无装饰色',
  root: `font-family:${FONT};font-size:16px;line-height:1.85;color:#2b2b2b;letter-spacing:0.03em;padding:0 4px;`,
  h2: {
    wrap: 'margin:2em 0 .9em;',
    num: 'display:inline;font-size:18px;color:#999;font-weight:700;margin-right:8px;',
    text: 'display:inline;font-size:18px;color:#111;font-weight:700;',
    rule: 'display:none;',
  },
  mark: 'background:#f2f2f2;padding:0 2px;',
  box: {
    tip: { wrap: 'margin:1.8em 0;padding:14px 16px;border:1px solid #e5e5e5;border-radius:4px;', title: 'margin:0 0 .4em;font-weight:700;color:#111;', body: 'font-size:15px;color:#444;' },
    warn: { wrap: 'margin:1.8em 0;padding:14px 16px;border:1px solid #e5e5e5;border-left:3px solid #333;', title: 'margin:0 0 .4em;font-weight:700;color:#111;', body: 'font-size:15px;color:#444;' },
    note: { wrap: 'margin:1.8em 0;padding:14px 16px;background:#f7f7f7;', title: 'margin:0 0 .4em;font-weight:700;color:#111;', body: 'font-size:15px;color:#444;' },
  },
  footer: {
    follow: 'margin:2.4em 0 0;text-align:center;font-size:15px;color:#555;',
    disclaimer: 'margin:1.4em 0 0;text-align:center;font-size:12px;color:#aaa;',
  },
};

const THEMES = { paper, plain };

function getTheme(name) {
  const t = THEMES[name || 'paper'];
  if (!t) throw new Error(`没有主题「${name}」，可选：${Object.keys(THEMES).join('、')}`);
  return t;
}

module.exports = { getTheme, THEMES };
