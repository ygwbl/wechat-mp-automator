'use strict';
// AST → 公众号可用的 HTML（全部行内样式，只用 section/p/span/strong/img/ul/ol/li/blockquote）
const { getTheme } = require('./themes');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s, t) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, `<strong style="${t.strong}">$1</strong>`)
    .replace(/==(.+?)==/g, `<span style="${t.mark}">$1</span>`);
}

/**
 * @param {object[]} blocks  markdown.parse 的结果
 * @param {object}   opts    { theme, footer: {follow, disclaimer}, resolveImage(src) => url }
 */
function render(blocks, opts = {}) {
  const t = getTheme(opts.theme);
  const img = opts.resolveImage || ((src) => src);
  let n = 0;

  const one = (b) => {
    switch (b.type) {
      case 'p': return `<p style="${t.p}">${inline(b.text, t)}</p>`;
      case 'h2': {
        n++;
        const num = String(n).padStart(2, '0');
        return `<section style="${t.h2.wrap}"><span style="${t.h2.num}">${num}</span><span style="${t.h2.text}">${inline(b.text, t)}</span><span style="${t.h2.rule}"></span></section>`;
      }
      case 'h3': return `<p style="${t.h3}">${inline(b.text, t)}</p>`;
      case 'quote': return `<blockquote style="${t.quote}">${inline(b.text, t)}</blockquote>`;
      case 'ul':
      case 'ol': {
        const tag = b.type;
        return `<${tag} style="${t.list}">${b.items.map((x) => `<li style="${t.li}">${inline(x, t)}</li>`).join('')}</${tag}>`;
      }
      case 'hr': return `<section style="${t.hr}"></section>`;
      case 'img': {
        const cap = b.alt ? `<p style="${t.caption}">${esc(b.alt)}</p>` : '';
        return `<img src="${esc(img(b.src))}" alt="${esc(b.alt)}" style="${t.img}">${cap}`;
      }
      case 'box': {
        const s = t.box[b.kind] || t.box.note;
        const title = b.title ? `<p style="${s.title}">${inline(b.title, t)}</p>` : '';
        const inner = b.children.map(one).join('').replace(new RegExp(`style="${t.p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'), `style="margin:0 0 .5em;"`);
        return `<section style="${s.wrap}">${title}<section style="${s.body}">${inner}</section></section>`;
      }
      default: return '';
    }
  };

  const body = blocks.map(one).join('\n');
  const f = opts.footer || {};
  const tail = [
    f.follow ? `<p style="${t.footer.follow}">${inline(f.follow, t)}</p>` : '',
    f.disclaimer ? `<p style="${t.footer.disclaimer}">${inline(f.disclaimer, t)}</p>` : '',
  ].filter(Boolean).join('\n');
  return `<section style="${t.root}">\n${body}${tail ? `\n${tail}` : ''}\n</section>`;
}

/** 本地预览页：模拟手机宽度 */
function previewPage({ title, author, html }) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:#ecebe7;"><main style="max-width:420px;margin:24px auto;background:#fff;padding:28px 20px 40px;box-shadow:0 1px 8px rgba(0,0,0,.06);">
<h1 style="font-size:22px;line-height:1.4;margin:0 0 10px;color:#1f1d1a;">${esc(title)}</h1>
<p style="margin:0 0 24px;font-size:14px;color:#8a8478;">${esc(author || '')}</p>
${html}
</main></body></html>`;
}

module.exports = { render, previewPage, esc };
